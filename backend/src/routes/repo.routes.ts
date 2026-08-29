import { Router } from 'express'
import multer from 'multer'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/async.js'
import { verifyJwt, type AuthedRequest } from '../middleware/auth.js'
import { parsePaging } from '../utils/paging.js'
import { aggregateTurnsFromMessages } from '../services/turns.js'
import { importZipToRepo, loadRepoConversationRows, upsertConversations } from '../services/conversationStore.js'
import {
  extractConversationsJson,
  parseZipUnified,
  serializeSnapshot,
  snapshotConversationFromDb,
  parseSnapshot,
  fromSnapshotConversation,
} from '../services/unifiedParser.js'
import * as gitRepo from '../services/gitRepo.js'

/**
 * 聊天记录仓库路由（Git 版本化）。
 * 一个仓库 = 一个 Git 仓库；上传 zip = 提交一份统一格式的 conversations.json 快照。
 * 挂载于 /api/repos，同时以 /api/configs 兼容旧客户端。
 */
const router = Router()
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200MB
})

router.use(verifyJwt)

function publicRepo(c: any, gitInfo?: { commitCount: number; snapshotBytes: number } | null) {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    defaultBranch: c.defaultBranch || 'main',
    lastCommitSha: c.lastCommitSha ?? null,
    lastCommitAt: c.lastCommitAt ?? null,
    commitCount: gitInfo?.commitCount ?? c.commitCount ?? 0,
    snapshotBytes: gitInfo?.snapshotBytes ?? null,
    conversationCount: c._count?.conversations ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

/** 将仓库当前 DB 全量状态序列化为规范快照并 commit，同步 Git 元信息到 DB */
async function snapshotAndCommit(
  userId: number,
  repoId: number,
  message: string,
): Promise<gitRepo.CommitResult> {
  const rows = await loadRepoConversationRows(repoId)
  const snapshotJson = serializeSnapshot(rows.map(snapshotConversationFromDb))
  const commit = await gitRepo.commitSnapshot(userId, repoId, snapshotJson, message)
  await prisma.chatRepo.update({
    where: { id: repoId },
    data: {
      lastCommitSha: commit.sha,
      lastCommitAt: new Date(),
      commitCount: { increment: 1 },
    },
  })
  return commit
}

/** 首次访问 Git 历史时回填初始提交（老配置自动成为仓库） */
async function ensureBackfill(userId: number, repoId: number): Promise<void> {
  const dirHasGit = await gitRepo.repoDiskInfo(userId, repoId)
  if (!dirHasGit.initialized || dirHasGit.commitCount > 0) return
  await snapshotAndCommit(userId, repoId, '初始提交（回填当前数据快照）')
}

// POST /api/repos/parse  multipart: file(zip)  仅解析（本地模式用，不落库不提交）
router.post('/parse', upload.single('file'), asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 zip 压缩包' })
  const conversations: Array<Record<string, unknown>> = []
  const { sources } = await parseZipUnified(req.file.buffer, (conv) => {
    // 本地模式回传轻量结构：不含原始 mapping（IndexedDB 存扁平消息即可）
    conversations.push({
      deepseekConvId: conv.deepseekConvId,
      title: conv.title,
      insertedAt: conv.insertedAt.toISOString(),
      updatedAt: conv.updatedAt.toISOString(),
      turnCount: conv.turns.length,
      messages: conv.messages.map((m) => ({
        ...m,
        insertedAt: m.insertedAt.toISOString(),
      })),
      turns: conv.turns,
    })
  })
  return res.json({ persisted: false, sources, conversations, conversationCount: conversations.length })
}))

// POST /api/repos  multipart: file?(zip) + name + description?
router.post('/', upload.single('file'), asyncHandler(async (req: AuthedRequest, res) => {
  const name = String(req.body.name || '').trim()
  if (!name) return res.status(400).json({ error: '请填写仓库名称' })
  const description = String(req.body.description || '').trim() || null
  const userId = req.user!.id

  const dup = await prisma.chatRepo.findFirst({ where: { userId, name } })
  if (dup) return res.status(409).json({ error: '已存在同名仓库' })

  const repo = await prisma.chatRepo.create({
    data: { userId, name, description },
  })

  let imported = 0
  if (req.file) {
    const r = await importZipToRepo(userId, repo.id, req.file.buffer)
    imported = r.total
    await snapshotAndCommit(
      userId,
      repo.id,
      `导入数据包: +${r.added} 新增 / ~${r.updated} 更新 / 共 ${r.total} 会话`,
    )
  } else {
    // 空仓库初始化提交
    await snapshotAndCommit(userId, repo.id, '初始化仓库')
  }

  const fresh = await prisma.chatRepo.findUniqueOrThrow({
    where: { id: repo.id },
    include: { _count: { select: { conversations: true } } },
  })
  return res.json({
    persisted: true,
    repo: publicRepo(fresh),
    // 兼容旧客户端字段
    config: publicRepo(fresh),
    conversationCount: imported,
  })
}))

// PUT /api/repos/:id/upload  multipart: file(zip)  增量导入 → 新 commit
router.put('/:id/upload', upload.single('file'), asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 zip 压缩包' })
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })

  const r = await importZipToRepo(req.user!.id, repo.id, req.file.buffer)
  const commit = await snapshotAndCommit(
    req.user!.id,
    repo.id,
    `导入数据包: +${r.added} 新增 / ~${r.updated} 更新 / 共 ${r.total} 会话`,
  )

  const fresh = await prisma.chatRepo.findUniqueOrThrow({
    where: { id: repo.id },
    include: { _count: { select: { conversations: true } } },
  })
  return res.json({
    persisted: true,
    repo: publicRepo(fresh),
    config: publicRepo(fresh),
    conversationCount: r.total,
    added: r.added,
    updated: r.updated,
    commit,
  })
}))

// GET /api/repos  列出我的仓库
router.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const repos = await prisma.chatRepo.findMany({
    where: { userId: req.user!.id },
    include: { _count: { select: { conversations: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return res.json({ repos: repos.map((r) => publicRepo(r)), configs: repos.map((r) => publicRepo(r)) })
}))

// GET /api/repos/:id  仓库详情 + 会话列表（lite）
router.get('/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({
    where: { id, userId: req.user!.id },
    include: {
      conversations: {
        select: {
          id: true,
          deepseekConvId: true,
          title: true,
          insertedAt: true,
          updatedAt: true,
          source: true,
          _count: { select: { messages: true } },
        },
        orderBy: { insertedAt: 'desc' },
      },
    },
  })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })
  return res.json({ repo: publicRepo(repo), conversations: repo.conversations })
}))

// GET /api/repos/:id/conversations-batch  批量返回会话 + messages + turns（不含 rawMapping）
router.get('/:id/conversations-batch', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })
  const { page, pageSize, paged } = parsePaging(req)
  const where = { configId: id }
  const [convs, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      select: {
        id: true,
        deepseekConvId: true,
        title: true,
        insertedAt: true,
        updatedAt: true,
        turnCount: true,
        messages: {
          select: {
            nodeId: true,
            parentId: true,
            role: true,
            model: true,
            content: true,
            insertedAt: true,
            turnIndex: true,
            versionIndex: true,
            subTurnIndex: true,
          },
          orderBy: { insertedAt: 'asc' },
        },
      },
      orderBy: { insertedAt: 'desc' },
      ...(paged ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    }),
    paged ? prisma.conversation.count({ where }) : Promise.resolve(undefined),
  ])
  const result = convs.map((c) => ({
    ...c,
    turns: aggregateTurnsFromMessages(c.messages),
  }))
  if (paged) {
    return res.json({ conversations: result, total: total ?? 0, page, pageSize, hasMore: page * pageSize < (total ?? 0) })
  }
  return res.json({ conversations: result })
}))

// GET /api/repos/:id/conversations-lite  轻量版：仅会话元数据
router.get('/:id/conversations-lite', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })
  const { page, pageSize, paged } = parsePaging(req)
  const where = { configId: id }
  const [convs, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      select: {
        id: true,
        deepseekConvId: true,
        title: true,
        insertedAt: true,
        updatedAt: true,
        turnCount: true,
      },
      orderBy: { insertedAt: 'desc' },
      ...(paged ? { skip: (page - 1) * pageSize, take: pageSize } : {}),
    }),
    paged ? prisma.conversation.count({ where }) : Promise.resolve(undefined),
  ])
  if (paged) {
    return res.json({ conversations: convs, total: total ?? 0, page, pageSize, hasMore: page * pageSize < (total ?? 0) })
  }
  return res.json({ conversations: convs })
}))

// GET /api/repos/:id/conversations/:convId  单个会话完整 messages + 聚合 turns
router.get('/:id/conversations/:convId', asyncHandler(async (req: AuthedRequest, res) => {
  const configId = Number(req.params.id)
  const deepseekConvId = req.params.convId
  const repo = await prisma.chatRepo.findFirst({ where: { id: configId, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })
  const conv = await prisma.conversation.findFirst({
    where: { configId, deepseekConvId },
    include: { messages: { orderBy: { insertedAt: 'asc' } } },
  })
  if (!conv) return res.status(404).json({ error: '会话不存在' })
  const turns = aggregateTurnsFromMessages(conv.messages)
  return res.json({ ...conv, turns })
}))

// PUT /api/repos/:id  重命名 / 改描述
router.put('/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })
  const name = req.body?.name !== undefined ? String(req.body.name).trim() : repo.name
  const description = req.body?.description !== undefined
    ? (String(req.body.description).trim() || null)
    : repo.description
  if (!name) return res.status(400).json({ error: '仓库名称不能为空' })
  if (name !== repo.name) {
    const dup = await prisma.chatRepo.findFirst({ where: { userId: req.user!.id, name, id: { not: id } } })
    if (dup) return res.status(409).json({ error: '已存在同名仓库' })
  }
  const updated = await prisma.chatRepo.update({
    where: { id },
    data: { name, description },
    include: { _count: { select: { conversations: true } } },
  })
  return res.json({ repo: publicRepo(updated) })
}))

// GET /api/repos/:id/history  提交历史（首次访问自动回填初始提交）
router.get('/:id/history', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })

  await ensureBackfill(req.user!.id, id)
  const commits = await gitRepo.listHistory(req.user!.id, id)
  const disk = await gitRepo.repoDiskInfo(req.user!.id, id)
  return res.json({
    defaultBranch: repo.defaultBranch,
    commits: commits.map((c) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.message.trim(),
      author: c.author,
      date: new Date(c.timestamp * 1000).toISOString(),
    })),
    commitCount: commits.length,
    snapshotBytes: disk.snapshotBytes,
  })
}))

// GET /api/repos/:id/commits/:sha/download  下载指定提交的 conversations.json
router.get('/:id/commits/:sha/download', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })
  const text = await gitRepo.readSnapshotAt(req.user!.id, id, req.params.sha)
  if (text == null) return res.status(404).json({ error: '提交不存在或快照不可读' })
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="conversations-${req.params.sha.slice(0, 7)}.json"`)
  return res.send(Buffer.from(text, 'utf8'))
}))

// POST /api/repos/:id/rollback  body: { sha }  回滚到指定提交（追加回滚 commit，不改写历史）
router.post('/:id/rollback', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const sha = String(req.body?.sha || '').trim()
  if (!sha) return res.status(400).json({ error: '缺少 sha 参数' })
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })

  const snapshotText = await gitRepo.readSnapshotAt(req.user!.id, id, sha)
  if (snapshotText == null) return res.status(404).json({ error: '提交不存在或快照不可读' })

  const { conversations: snapConvs } = parseSnapshot(snapshotText)
  const parsed = snapConvs.map((sc) => ({ conv: fromSnapshotConversation(sc), source: sc.source }))

  // 1. 删除快照中不存在的会话（先收集 Meili 文档 id 用于清理索引）
  const keepIds = parsed.map((p) => p.conv.deepseekConvId)
  const removedConvs = await prisma.conversation.findMany({
    where: { configId: id, deepseekConvId: { notIn: keepIds } },
    select: { id: true, deepseekConvId: true },
  })
  if (removedConvs.length > 0) {
    const removedMsgs = await prisma.message.findMany({
      where: { conversationId: { in: removedConvs.map((c) => c.id) } },
      select: { conversation: { select: { deepseekConvId: true } }, nodeId: true },
    })
    const { deleteDocuments } = await import('../services/meilisearch.js')
    try {
      await deleteDocuments(
        req.user!.id,
        removedMsgs.map((m) => `msg:${m.conversation.deepseekConvId}:${m.nodeId}`),
      )
    } catch (e) {
      console.warn('[meilisearch] rollback cleanup failed', e)
    }
    await prisma.conversation.deleteMany({
      where: { configId: id, deepseekConvId: { notIn: keepIds } },
    })
  }

  // 2. 强制重建快照中的会话（无视 updatedAt，确保与快照一致）
  const stats = await upsertConversations(req.user!.id, id, parsed, { force: true })

  // 3. 追加回滚提交（内容 = 目标快照）
  const commit = await snapshotAndCommit(
    req.user!.id,
    id,
    `回滚到 ${sha.slice(0, 7)}: 共 ${keepIds.length} 会话`,
  )

  return res.json({
    ok: true,
    restored: keepIds.length,
    removed: removedConvs.length,
    stats,
    commit,
  })
}))

// DELETE /api/repos/:id  删除仓库（DB 级联 + 磁盘 Git 仓库）
router.delete('/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })
  await prisma.chatRepo.delete({ where: { id } })
  gitRepo.deleteRepoDisk(req.user!.id, id)
  return res.json({ ok: true })
}))

// 兼容旧客户端：POST /api/repos/extract 供内部解压复用（提取 conversations.json 校验）
router.post('/extract', upload.single('file'), asyncHandler(async (req: AuthedRequest, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传 zip 压缩包' })
  try {
    extractConversationsJson(req.file.buffer)
    return res.json({ ok: true })
  } catch (e: any) {
    return res.status(400).json({ error: e?.message || '解析失败' })
  }
}))

export default router
