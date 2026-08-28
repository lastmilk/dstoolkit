import path from 'node:path'
import fs from 'node:fs/promises'
import { createHash } from 'node:crypto'
import simpleGit, { SimpleGit, StatusResult, LogResult, DefaultLogFields } from 'simple-git'
import { env } from '../config/env.js'
import { prisma } from '../utils/prisma.js'

/**
 * DsToolkit Git 仓库结构（每个用户独立一个）：
 *
 * {repo-root}/
 * ├── README.md                        仓库说明（系统自动维护）
 * ├── profile.json                     用户基础资料（公开字段）
 * ├── configs/                         Deepseek 配置清单
 * │   └── {configId}-{sanitized(name)}.json
 * ├── conversations/                   每个 Deepseek 会话一个子目录
 * │   └── {deepseekConvId}-{sanitized(title)}/
 * │       ├── meta.json                会话元数据（标题、时间、turnCount）
 * │       └── messages.jsonl           消息逐行 JSON（便于 diff）
 * ├── summaries/                       AI 摘要
 * │   └── conv-{convId}.json
 * ├── knowledge/                       知识卡片
 * │   └── card-{cardId}.json
 * ├── folders/
 * │   └── structure.json               文件夹树 + 标签映射
 * ├── assembly/                        ⭐ 通用装配配置（行业研究插件集成点）
 * │   ├── plugins.json                 启用的连接器（TDX/iFinD/Eastmoney 等，不含密钥）
 * │   ├── pipelines.json               数据流水线配置
 * │   ├── dashboards.json              可视化仪表盘装配
 * │   ├── search-enhancers.json        搜索增强器配置
 * │   └── report-templates.json        研究简报报告模板
 * ├── reports/                         流水线产物（markdown/HTML 简报）
 * └── .gitignore
 */

// ────────────────────────────────────────────────────────────────
// 基础工具
// ────────────────────────────────────────────────────────────────

function sanitizeForPath(s: string, maxLen = 60): string {
  const cleaned = s.replace(/[^\w\u4e00-\u9fa5.-]+/g, '-').replace(/^-+|-+$/g, '')
  return cleaned.slice(0, maxLen) || 'item'
}

function repoRootAbs(): string {
  return path.resolve(env.git.reposRoot)
}

function repoBarePath(userId: number, repoName: string): string {
  return path.join(repoRootAbs(), `${userId}-${sanitizeForPath(repoName, 40)}.git`)
}

function repoWorkPath(userId: number): string {
  return path.join(repoRootAbs(), '_work', `user-${userId}`)
}

export function repoCloneUrl(username: string): string {
  if (env.git.httpBase) return `${env.git.httpBase.replace(/\/$/, '')}/${username}.git`
  // fallback：相对路径，由前端拼接完整地址
  return `/git/${username}.git`
}

function jsonStringifyPretty(obj: unknown): string {
  return JSON.stringify(obj, null, 2) + '\n'
}

// 统计一个目录的字节大小（含子目录）
async function dirSize(dir: string): Promise<number> {
  let total = 0
  const stack = [dir]
  while (stack.length) {
    const cur = stack.pop()!
    const entries = await fs.readdir(cur, { withFileTypes: true }).catch(() => [])
    for (const e of entries) {
      const p = path.join(cur, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.isFile()) {
        total += await fs.stat(p).then((s) => s.size).catch(() => 0)
      }
    }
  }
  return total
}

// ────────────────────────────────────────────────────────────────
// 仓库初始化 / 生命周期
// ────────────────────────────────────────────────────────────────

export interface RepoInitResult {
  repository: {
    id: number
    userId: number
    repoName: string
    status: string
    repoPath: string
    cloneUrl: string
  }
  firstCommitHash: string
}

export async function ensureRepoForUser(userId: number): Promise<{ id: number; repoName: string } | null> {
  const existing = await prisma.gitRepository.findUnique({ where: { userId } })
  if (existing) return { id: existing.id, repoName: existing.repoName }
  return null
}

/**
 * 创建/初始化用户的 Git 仓库：
 * 1. 创建 bare 仓库（用于 HTTP smart protocol 克隆）
 * 2. 在临时工作目录执行首次提交（README + 目录结构）
 * 3. 将首次提交推送到 bare 仓库
 * 4. 写入 MySQL 的 GitRepository 行
 */
export async function initUserRepo(userId: number, forceReinit = false): Promise<RepoInitResult> {
  await fs.mkdir(repoRootAbs(), { recursive: true })
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } })
  const existing = await prisma.gitRepository.findUnique({ where: { userId } })

  if (existing && !forceReinit) {
    const cloneUrl = repoCloneUrl(user.username)
    return {
      repository: {
        id: existing.id,
        userId,
        repoName: existing.repoName,
        status: existing.status,
        repoPath: existing.repoPath,
        cloneUrl,
      },
      firstCommitHash: existing.lastCommitHash || '',
    }
  }

  const repoName = sanitizeForPath(user.username, 40) || `user-${userId}`
  const barePath = repoBarePath(userId, repoName)
  const workPath = repoWorkPath(userId)

  // 清理遗留（如 forceReinit=true）
  await fs.rm(barePath, { recursive: true, force: true })
  await fs.rm(workPath, { recursive: true, force: true })

  try {
    // 1. 初始化 bare 仓库
    await fs.mkdir(barePath, { recursive: true })
    const bareGit = simpleGit(barePath)
    await bareGit.init(true, ['-b', 'main'])

    // 2. 初始化工作副本并生成初始内容
    await fs.mkdir(workPath, { recursive: true })
    const workGit: SimpleGit = simpleGit(workPath)
    await workGit.init(false, ['-b', 'main'])
    await workGit.addConfig('user.name', env.git.botName, undefined, 'local')
    await workGit.addConfig('user.email', env.git.botEmail, undefined, 'local')

    await writeInitialRepoStructure(workPath, user.username, userId)

    await workGit.add('.')
    const commitMsg = `feat(repo): initialize DsToolkit cloud repo for ${user.username}\n\n- Created by dstoolkit-bot at registration/cloud-sync enable`
    const commitRes = await workGit.commit(commitMsg, undefined, { '--no-gpg-sign': null })
    const commitHash = commitRes.commit || ''

    // 3. 推送至 bare 仓库
    await workGit.addRemote('origin', barePath)
    await workGit.push(['-u', 'origin', 'main'])

    // 4. DB 记录
    const repoSize = await dirSize(barePath)
    const dbRepo = existing
      ? await prisma.gitRepository.update({
          where: { id: existing.id },
          data: {
            repoName,
            repoPath: barePath,
            status: 'ACTIVE',
            sizeBytes: repoSize,
            lastCommitHash: commitHash,
            lastCommitAt: new Date(),
            lastPushAt: new Date(),
            commitsCount: 1,
          },
        })
      : await prisma.gitRepository.create({
          data: {
            userId,
            repoName,
            repoPath: barePath,
            status: 'ACTIVE',
            defaultBranch: 'main',
            sizeBytes: repoSize,
            lastCommitHash: commitHash,
            lastCommitAt: new Date(),
            lastPushAt: new Date(),
            commitsCount: 1,
          },
        })

    // 记录提交审计
    await recordCommitAudit(dbRepo.id, {
      commitHash,
      message: commitMsg,
      author: env.git.botName,
      authorEmail: env.git.botEmail,
      branchName: 'main',
      changedModules: ['PROFILE', 'CONFIGS', 'CONVERSATIONS', 'SUMMARIES', 'KNOWLEDGE', 'FOLDERS', 'ASSEMBLY'],
      filesAdded: 12,
      filesModified: 0,
      filesDeleted: 0,
    })

    return {
      repository: {
        id: dbRepo.id,
        userId,
        repoName: dbRepo.repoName,
        status: dbRepo.status,
        repoPath: dbRepo.repoPath,
        cloneUrl: repoCloneUrl(user.username),
      },
      firstCommitHash: commitHash,
    }
  } catch (e) {
    // 标记 ERROR 状态
    await prisma.gitRepository.upsert({
      where: { userId },
      create: { userId, repoName, repoPath: barePath, status: 'ERROR', sizeBytes: 0 },
      update: { status: 'ERROR' },
    })
    throw e
  }
}

async function writeInitialRepoStructure(workPath: string, username: string, userId: number) {
  const subDirs = ['configs', 'conversations', 'summaries', 'knowledge', 'folders', 'assembly', 'reports']
  for (const d of subDirs) await fs.mkdir(path.join(workPath, d), { recursive: true })

  await fs.writeFile(
    path.join(workPath, 'README.md'),
    `# DsToolkit Cloud Repository — ${username}\n\n` +
      `This Git repository is your personal DsToolkit cloud workspace.\n` +
      `It contains your Deepseek conversations, AI summaries, knowledge cards,\n` +
      `and **通用装配 (Assembly)** configurations for plugins like\n` +
      `\`trae-remote-official:industry-researcher\`.\n\n` +
      `## Repository Layout\n\n` +
      `- \`profile.json\` — your public profile\n` +
      `- \`configs/\` — Deepseek account import configurations\n` +
      `- \`conversations/\` — one subdirectory per conversation (meta + messages JSONL)\n` +
      `- \`summaries/\` — AI-generated conversation summaries\n` +
      `- \`knowledge/\` — AI-generated knowledge cards\n` +
      `- \`folders/structure.json\` — folder tree + tag mapping\n` +
      `- \`assembly/\` — ⭐ Plugin / pipeline / dashboard / report template assembly\n` +
      `- \`reports/\` — output from assembly pipeline runs (markdown/html)\n\n` +
      `## Updating via Git\n\n` +
      `\`\`\`bash\n` +
      `git clone ${env.git.httpBase || 'https://<dstoolkit-host>/git'}/${username}.git\n` +
      `# edit files (e.g. assembly/pipelines.json)\n` +
      `git add assembly/\n` +
      `git commit -m "feat(assembly): add new energy-sector research pipeline"\n` +
      `git push\n` +
      `\`\`\`\n\n` +
      `On push, DsToolkit will:\n` +
      `1. Re-import changed conversations/configs back into the database\n` +
      `2. Validate and enable any updated assembly configurations\n` +
      `3. Trigger any pipelines whose config changed (see \`reports/\` for output)\n\n` +
      `— Auto-generated by DsToolkit (user #${userId}). Do not delete this file.\n`,
  )

  await fs.writeFile(
    path.join(workPath, 'profile.json'),
    jsonStringifyPretty({
      username,
      userId,
      createdAt: new Date().toISOString(),
      cloudSyncEnabled: true,
      description: 'Edit via DsToolkit Profile page; direct edits here are overwritten.',
    }),
  )

  await fs.writeFile(
    path.join(workPath, 'assembly', 'plugins.json'),
    jsonStringifyPretty({
      _doc: '通用装配：启用的行业研究 (industry-researcher) 连接器。密钥不存 Git，走 Dstoolkit 后台加密。',
      _schema: 'https://github.com/lastmilk/dstoolkit/blob/main/docs/assembly/plugins-schema.md',
      // 列出所有已授权服务名（具体 access_token 通过 API 设置，不落库明文）
      enabledProviders: [
        // { name: 'tdx', displayName: '通达信', scopes: ['quotes', 'kline', 'screener'], enabled: true }
      ],
    }),
  )

  await fs.writeFile(
    path.join(workPath, 'assembly', 'pipelines.json'),
    jsonStringifyPretty({
      _doc: '通用装配：数据流水线 — 将会话 + 行业数据装配为研究简报',
      pipelines: [
        // {
        //   id: 'weekly-battery-report',
        //   name: '新能源电池周报',
        //   provider: 'ifind',
        //   inputs: { conversations: ['tag:电池产业链'], sectors: ['电池', '锂电材料'] },
        //   steps: ['fetch_industry_fundamentals', 'merge_conversation_knowledge', 'render_report'],
        //   outputs: ['reports/weekly-battery-{{date}}.md'],
        //   triggerOnPush: true,
        // }
      ],
    }),
  )

  await fs.writeFile(
    path.join(workPath, 'assembly', 'dashboards.json'),
    jsonStringifyPretty({
      dashboards: [
        // { id: 'battery-market', layout: '2col', widgets: [...] }
      ],
    }),
  )

  await fs.writeFile(
    path.join(workPath, 'assembly', 'search-enhancers.json'),
    jsonStringifyPretty({
      enhancers: [
        // { id: 'industry-knowledge-graph', provider: 'eastmoney', autoExpand: true }
      ],
    }),
  )

  await fs.writeFile(
    path.join(workPath, 'assembly', 'report-templates.json'),
    jsonStringifyPretty({
      templates: [
        // { id: 'standard-industry', sections: ['概览','产业链','竞争格局','估值对比','投资机会与风险'] }
      ],
    }),
  )

  await fs.writeFile(
    path.join(workPath, 'folders', 'structure.json'),
    jsonStringifyPretty({ folders: [], tags: [], items: [] }),
  )

  await fs.writeFile(
    path.join(workPath, '.gitignore'),
    `# Assembly secrets — NEVER commit tokens or keys\nsecrets/\n*.local.json\n.DS_Store\nnode_modules/\n`,
  )

  await fs.writeFile(
    path.join(workPath, 'reports', '.gitkeep'),
    '',
  )
  await fs.writeFile(path.join(workPath, 'configs', '.gitkeep'), '')
  await fs.writeFile(path.join(workPath, 'conversations', '.gitkeep'), '')
  await fs.writeFile(path.join(workPath, 'summaries', '.gitkeep'), '')
  await fs.writeFile(path.join(workPath, 'knowledge', '.gitkeep'), '')
}

// ────────────────────────────────────────────────────────────────
// 写入 API：将 DB 中的用户数据同步到 Git 仓库
// ────────────────────────────────────────────────────────────────

export type ChangedModule =
  | 'PROFILE' | 'CONFIGS' | 'CONVERSATIONS' | 'SUMMARIES'
  | 'KNOWLEDGE' | 'FOLDERS' | 'ASSEMBLY' | 'REPORTS'

export interface CommitContext {
  userId: number
  message: string
  authorName?: string
  authorEmail?: string
  changedModules: ChangedModule[]
}

/**
 * 将某个模块的最新数据写回 Git 仓库并自动提交。
 * 这是"通用装配"的核心：每次数据变更都会留下 Git 审计轨迹。
 */
export async function snapshotModuleAndCommit(
  ctx: CommitContext,
  buildFn: (workPath: string) => Promise<{ filesAdded: number; filesModified: number; filesDeleted: number }>,
): Promise<{ commitHash: string; shortHash: string }> {
  const repo = await prisma.gitRepository.findUnique({ where: { userId: ctx.userId } })
  if (!repo) throw new Error('用户未初始化 Git 仓库，请先开启云端同步')

  const workPath = repoWorkPath(ctx.userId)
  await fs.mkdir(workPath, { recursive: true })
  const workGit = simpleGit(workPath)

  // 如果工作副本不存在，则从 bare 仓库 clone 出来
  if (!await fs.stat(path.join(workPath, '.git')).catch(() => null)) {
    await workGit.clone(repo.repoPath, workPath, ['-b', repo.defaultBranch]).catch(async () => {
      // clone 失败（可能是空目录）→ 退化为 init + pull
      await workGit.init(false, ['-b', repo.defaultBranch])
      await workGit.addRemote('origin', repo.repoPath)
      await workGit.pull('origin', repo.defaultBranch).catch(() => {})
    })
    await workGit.addConfig('user.name', ctx.authorName || env.git.botName, undefined, 'local')
    await workGit.addConfig('user.email', ctx.authorEmail || env.git.botEmail, undefined, 'local')
  } else {
    try { await workGit.pull('origin', repo.defaultBranch) } catch {/* 允许首次无 pull */ }
  }

  const { filesAdded, filesModified, filesDeleted } = await buildFn(workPath)

  // 检查大小
  const size = await dirSize(workPath)
  if (size > env.git.maxRepoSizeMB * 1024 * 1024) {
    throw new Error(`仓库超出 ${env.git.maxRepoSizeMB}MB 上限，请清理后再提交`)
  }

  await workGit.add('.')
  const status: StatusResult = await workGit.status()
  if (!status.isClean()) {
    const res = await workGit.commit(ctx.message, undefined, { '--no-gpg-sign': null })
    const commitHash = res.commit || ''
    try { await workGit.push(['origin', repo.defaultBranch]) } catch (e) {
      console.warn('[git] push to origin failed, will retry on next commit', e)
    }
    // 更新 DB
    await prisma.gitRepository.update({
      where: { id: repo.id },
      data: {
        lastCommitHash: commitHash,
        lastCommitAt: new Date(),
        commitsCount: { increment: 1 },
        sizeBytes: size,
      },
    })
    await recordCommitAudit(repo.id, {
      commitHash,
      message: ctx.message,
      author: ctx.authorName || env.git.botName,
      authorEmail: ctx.authorEmail || env.git.botEmail,
      branchName: repo.defaultBranch,
      changedModules: ctx.changedModules,
      filesAdded,
      filesModified,
      filesDeleted,
    })
    return { commitHash, shortHash: commitHash.slice(0, 8) }
  }

  // 无变更
  return { commitHash: repo.lastCommitHash || '', shortHash: (repo.lastCommitHash || '').slice(0, 8) }
}

// ─────────────────── 具体各模块的 build 函数 ───────────────────

/** 同步用户资料 → profile.json */
export async function writeProfileSnapshot(userId: number) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { username: true, tier: true, aiCredits: true, cloudSyncEnabled: true, createdAt: true },
  })
  return snapshotModuleAndCommit(
    { userId, changedModules: ['PROFILE'], message: `chore(profile): sync profile for ${user.username}` },
    async (workPath) => {
      await fs.writeFile(path.join(workPath, 'profile.json'), jsonStringifyPretty({
        username: user.username,
        userId,
        tier: user.tier,
        aiCredits: user.aiCredits,
        cloudSyncEnabled: user.cloudSyncEnabled,
        createdAt: user.createdAt.toISOString(),
        updatedAt: new Date().toISOString(),
      }))
      return { filesAdded: 0, filesModified: 1, filesDeleted: 0 }
    },
  )
}

/** 同步 Deepseek 配置 → configs/ */
export async function writeConfigsSnapshot(userId: number) {
  const configs = await prisma.deepseekConfig.findMany({
    where: { userId },
    include: { _count: { select: { conversations: true } } },
  })
  return snapshotModuleAndCommit(
    { userId, changedModules: ['CONFIGS'], message: `chore(configs): sync ${configs.length} deepseek config(s)` },
    async (workPath) => {
      const dir = path.join(workPath, 'configs')
      await fs.mkdir(dir, { recursive: true })
      // 删除旧 .gitkeep 之外的文件，保持与 DB 一致
      for (const f of await fs.readdir(dir)) {
        if (f !== '.gitkeep' && f.endsWith('.json')) {
          await fs.rm(path.join(dir, f), { force: true })
        }
      }
      for (const c of configs) {
        const fname = `${c.id}-${sanitizeForPath(c.name)}.json`
        await fs.writeFile(path.join(dir, fname), jsonStringifyPretty({
          id: c.id,
          name: c.name,
          deepseekUserId: c.deepseekUserId,
          deepseekEmail: c.deepseekEmail,
          deepseekMobile: c.deepseekMobile,
          conversationCount: c._count.conversations,
          createdAt: c.createdAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }))
      }
      return { filesAdded: configs.length, filesModified: 0, filesDeleted: 0 }
    },
  )
}

/** 同步会话 → conversations/{convId}-{title}/  */
export async function writeConversationsSnapshot(userId: number, configId: number) {
  const config = await prisma.deepseekConfig.findFirstOrThrow({ where: { id: configId, userId } })
  const convs = await prisma.conversation.findMany({
    where: { configId },
    include: { messages: { orderBy: { insertedAt: 'asc' } } },
    take: 200, // 限制单次快照：大型账号建议分页处理
  })
  return snapshotModuleAndCommit(
    {
      userId,
      changedModules: ['CONVERSATIONS'],
      message: `chore(conversations): sync ${convs.length} conversation(s) for config #${configId}`,
    },
    async (workPath) => {
      const dir = path.join(workPath, 'conversations')
      await fs.mkdir(dir, { recursive: true })
      let added = 0, mod = 0, del = 0
      for (const c of convs) {
        const sub = path.join(dir, `${c.deepseekConvId}-${sanitizeForPath(c.title)}`)
        await fs.mkdir(sub, { recursive: true })
        const metaPath = path.join(sub, 'meta.json')
        const msgsPath = path.join(sub, 'messages.jsonl')
        const meta = {
          id: c.id,
          deepseekConvId: c.deepseekConvId,
          configId: c.configId,
          title: c.title,
          turnCount: c.turnCount,
          insertedAt: c.insertedAt.toISOString(),
          updatedAt: c.updatedAt.toISOString(),
        }
        const existed = await fs.stat(metaPath).catch(() => null)
        await fs.writeFile(metaPath, jsonStringifyPretty(meta))
        // messages.jsonl — 每条消息一行，便于 git diff
        const lines = c.messages.map((m) => JSON.stringify({
          nodeId: m.nodeId,
          parentId: m.parentId,
          role: m.role,
          model: m.model,
          turnIndex: m.turnIndex,
          versionIndex: m.versionIndex,
          subTurnIndex: m.subTurnIndex,
          insertedAt: m.insertedAt.toISOString(),
          content: m.content,
        }))
        await fs.writeFile(msgsPath, lines.join('\n') + '\n')
        if (existed) mod += 2
        else added += 2
      }
      return { filesAdded: added, filesModified: mod, filesDeleted: del }
    },
  )
}

/** 同步摘要 + 知识卡片 */
export async function writeAISnapshots(userId: number) {
  const [summaries, cards] = await Promise.all([
    prisma.convSummary.findMany({ where: { userId } }),
    prisma.knowledgeCard.findMany({ where: { userId } }),
  ])
  return snapshotModuleAndCommit(
    {
      userId,
      changedModules: ['SUMMARIES', 'KNOWLEDGE'],
      message: `chore(ai): sync ${summaries.length} summaries + ${cards.length} knowledge cards`,
    },
    async (workPath) => {
      const sDir = path.join(workPath, 'summaries')
      const kDir = path.join(workPath, 'knowledge')
      await fs.mkdir(sDir, { recursive: true })
      await fs.mkdir(kDir, { recursive: true })
      for (const s of summaries) {
        await fs.writeFile(path.join(sDir, `conv-${s.conversationId}.json`), jsonStringifyPretty({
          id: s.id,
          conversationId: s.conversationId,
          tldr: s.tldr,
          summary: s.summary,
          tags: s.tags,
          confidence: s.confidence,
          model: s.model,
          createdAt: s.createdAt.toISOString(),
        }))
      }
      for (const k of cards) {
        await fs.writeFile(path.join(kDir, `card-${k.id}.json`), jsonStringifyPretty({
          id: k.id,
          conversationId: k.conversationId,
          title: k.title,
          content: k.content,
          category: k.category,
          tags: k.tags,
          sourceNodeId: k.sourceNodeId,
          createdAt: k.createdAt.toISOString(),
        }))
      }
      return { filesAdded: summaries.length + cards.length, filesModified: 0, filesDeleted: 0 }
    },
  )
}

/** 同步文件夹 + 标签结构 */
export async function writeFoldersSnapshot(userId: number) {
  const [folders, tags, items] = await Promise.all([
    prisma.folder.findMany({ where: { userId } }),
    prisma.convTag.findMany({ where: { userId } }),
    prisma.conversationTag.findMany({
      where: { OR: [{ folder: { userId } }, { tag: { userId } }] },
      select: { conversationId: true, folderId: true, tagId: true, createdAt: true },
    }),
  ])
  return snapshotModuleAndCommit(
    { userId, changedModules: ['FOLDERS'], message: 'chore(folders): sync folder tree + tags' },
    async (workPath) => {
      await fs.mkdir(path.join(workPath, 'folders'), { recursive: true })
      await fs.writeFile(path.join(workPath, 'folders', 'structure.json'), jsonStringifyPretty({
        exportedAt: new Date().toISOString(),
        folders: folders.map((f) => ({
          id: f.id, name: f.name, parentId: f.parentId, color: f.color, icon: f.icon,
          createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString(),
        })),
        tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color, createdAt: t.createdAt.toISOString() })),
        items,
      }))
      return { filesAdded: 0, filesModified: 1, filesDeleted: 0 }
    },
  )
}

/**
 * 将一份"通用装配"配置写入仓库的 assembly/ 目录。
 * 这是 industry-researcher 插件集成的核心接口：
 *  - PLUGIN_CONNECTOR → assembly/plugins.json 中的 enabledProviders 项
 *  - DATA_PIPELINE    → assembly/pipelines.json 中的 pipelines 项
 *  - DASHBOARD        → assembly/dashboards.json 中的 dashboards 项
 *  - SEARCH_ENHANCER  → assembly/search-enhancers.json 中的 enhancers 项
 *  - REPORT_TEMPLATE  → assembly/report-templates.json 中的 templates 项
 */
export async function writeAssemblySnapshot(
  userId: number,
  assemblyType: string,
  payload: any,
  message?: string,
) {
  const fileMap: Record<string, string> = {
    PLUGIN_CONNECTOR: 'plugins.json',
    DATA_PIPELINE: 'pipelines.json',
    DASHBOARD: 'dashboards.json',
    SEARCH_ENHANCER: 'search-enhancers.json',
    REPORT_TEMPLATE: 'report-templates.json',
  }
  const fname = fileMap[assemblyType] || 'misc.json'
  return snapshotModuleAndCommit(
    {
      userId,
      changedModules: ['ASSEMBLY'],
      message: message || `feat(assembly): update ${fname} via API`,
    },
    async (workPath) => {
      const fpath = path.join(workPath, 'assembly', fname)
      await fs.mkdir(path.dirname(fpath), { recursive: true })
      await fs.writeFile(fpath, jsonStringifyPretty(payload))
      return { filesAdded: 0, filesModified: 1, filesDeleted: 0 }
    },
  )
}

/** 写入流水线产物（研究报告）并提交 */
export async function writeReportArtifact(
  userId: number,
  relPath: string,
  content: string,
  commitMessage: string,
) {
  return snapshotModuleAndCommit(
    { userId, changedModules: ['REPORTS'], message: commitMessage },
    async (workPath) => {
      const abs = path.join(workPath, relPath)
      await fs.mkdir(path.dirname(abs), { recursive: true })
      const existed = await fs.stat(abs).catch(() => null)
      await fs.writeFile(abs, content)
      return { filesAdded: existed ? 0 : 1, filesModified: existed ? 1 : 0, filesDeleted: 0 }
    },
  )
}

// ────────────────────────────────────────────────────────────────
// 读取 API：仓库信息、提交历史、diff、文件内容
// ────────────────────────────────────────────────────────────────

export async function getRepoStatus(userId: number) {
  const repo = await prisma.gitRepository.findUnique({
    where: { userId },
    include: { _count: { select: { commits: true, assemblies: true } } },
  })
  if (!repo) return null
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { username: true } })
  return {
    id: repo.id,
    repoName: repo.repoName,
    status: repo.status,
    isPublic: repo.isPublic,
    defaultBranch: repo.defaultBranch,
    sizeBytes: repo.sizeBytes,
    sizeMB: +(repo.sizeBytes / 1024 / 1024).toFixed(2),
    commitsCount: repo.commitsCount,
    lastCommitHash: repo.lastCommitHash,
    lastCommitAt: repo.lastCommitAt,
    lastPushAt: repo.lastPushAt,
    cloneUrl: repoCloneUrl(user.username),
    assembliesCount: repo._count.assemblies,
  }
}

export async function getCommitLog(userId: number, limit = 20, page = 1) {
  const repo = await prisma.gitRepository.findUnique({ where: { userId } })
  if (!repo) return { commits: [], total: 0 }
  const where = { repoId: repo.id }
  const skip = (page - 1) * limit
  const [rows, total] = await Promise.all([
    prisma.gitCommit.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take: limit,
    }),
    prisma.gitCommit.count({ where }),
  ])
  return { commits: rows, total }
}

/** 读取仓库中某个文件的内容（通过最新 working copy） */
export async function readRepoFile(userId: number, repoRelPath: string): Promise<string | null> {
  const workPath = repoWorkPath(userId)
  const abs = path.join(workPath, repoRelPath)
  return await fs.readFile(abs, 'utf-8').catch(() => null)
}

/** 执行 git diff（通过 simple-git） */
export async function diffCommits(userId: number, fromHash?: string, toHash?: string): Promise<string> {
  const repo = await prisma.gitRepository.findUnique({ where: { userId } })
  if (!repo) return ''
  const workPath = repoWorkPath(userId)
  const workGit = simpleGit(workPath)
  try {
    await workGit.pull('origin', repo.defaultBranch).catch(() => {})
    if (fromHash && toHash) return workGit.diff([`${fromHash}..${toHash}`])
    if (fromHash) return workGit.diff([fromHash])
    return workGit.diff()
  } catch (e) {
    console.warn('[git] diff failed', e)
    return ''
  }
}

// ────────────────────────────────────────────────────────────────
// 辅助：提交审计落库
// ────────────────────────────────────────────────────────────────

async function recordCommitAudit(repoId: number, data: {
  commitHash: string
  message: string
  author: string
  authorEmail: string
  branchName: string
  changedModules: string[]
  filesAdded: number
  filesModified: number
  filesDeleted: number
}) {
  if (!data.commitHash) return
  const shortHash = data.commitHash.slice(0, 8)
  // SHA-256 产生的 hash 可能重复的概率极低，这里直接 upsert 即可
  await prisma.gitCommit.create({
    data: {
      repoId,
      commitHash: data.commitHash,
      shortHash,
      message: data.message.slice(0, 10000),
      author: data.author,
      authorEmail: data.authorEmail,
      branchName: data.branchName,
      changedModules: data.changedModules as any,
      filesAdded: data.filesAdded,
      filesModified: data.filesModified,
      filesDeleted: data.filesDeleted,
    },
  }).catch(() => {/* 重复忽略 */})
}

// ────────────────────────────────────────────────────────────────
// 归档 / 删除
// ────────────────────────────────────────────────────────────────

export async function archiveRepo(userId: number) {
  const repo = await prisma.gitRepository.findUnique({ where: { userId } })
  if (!repo) return null
  const workPath = repoWorkPath(userId)
  await fs.rm(workPath, { recursive: true, force: true })
  return prisma.gitRepository.update({ where: { id: repo.id }, data: { status: 'ARCHIVED' } })
}

export async function deleteRepo(userId: number) {
  const repo = await prisma.gitRepository.findUnique({ where: { userId } })
  if (!repo) return null
  await Promise.all([
    fs.rm(repo.repoPath, { recursive: true, force: true }),
    fs.rm(repoWorkPath(userId), { recursive: true, force: true }),
  ])
  return prisma.gitRepository.delete({ where: { id: repo.id } })
}

// ────────────────────────────────────────────────────────────────
// Git HTTP Smart Protocol 辅助：根据 username 定位仓库路径
// ────────────────────────────────────────────────────────────────

export async function resolveBareRepoByUsername(username: string): Promise<{ repoPath: string; userId: number } | null> {
  const user = await prisma.user.findUnique({ where: { username }, include: { gitRepos: true } })
  if (!user || user.gitRepos.length === 0) return null
  const repo = user.gitRepos[0]
  if (repo.status === 'ARCHIVED' || repo.status === 'ERROR') return null
  return { repoPath: repo.repoPath, userId: user.id }
}

/**
 * 更新 repo.lastPushAt（用于 HTTP smart protocol 接收 push 后调用）
 */
export async function markPush(userId: number) {
  await prisma.gitRepository.update({ where: { userId }, data: { lastPushAt: new Date() } })
}

export function sha256(s: string): string {
  return createHash('sha256').update(s).digest('hex')
}
