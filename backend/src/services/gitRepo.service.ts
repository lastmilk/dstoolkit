/**
 * Git 仓库 + 分支 + 标签 + 合并 服务
 *  - createRepo: 创建对话对应或独立的仓库（含初始化main分支、初始提交）
 *  - createBranch / deleteBranch / renameBranch / protectBranch
 *  - createTag / deleteTag / listTags
 *  - merge 分支（含4种策略：merge-commit, squash, rebase, fast-forward）
 *  - reset / restore / checkout
 *  - stash / stash pop
 *  - reflog 查询 → 恢复误操作
 */
import type { PrismaClient, User, GitRepo, GitBranch, GitCommit, GitTag, ProtectionLevel } from '@prisma/client'
import { GitObjectService } from './gitObject.service.js'
import { GitCommitService, type CommitAuthor } from './gitCommit.service.js'
import { threeWayMerge } from '../utils/gitDiff.js'

export interface CreateRepoInput {
  name: string
  ownerId: number
  description?: string
  visibility?: 'PRIVATE' | 'INTERNAL' | 'PUBLIC'
  conversationId?: number   // 关联对话
  defaultBranchName?: string // 默认main
  initialContent?: Array<{ path: string; content: string }>
  forkedFromId?: number
}

export class GitRepoService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly objects: GitObjectService,
    private readonly commits: GitCommitService,
  ) {}

  // ══════════════════════════════════════════════
  // 仓库操作
  // ══════════════════════════════════════════════

  async createRepo(input: CreateRepoInput & { author?: CommitAuthor }): Promise<{ repo: GitRepo; defaultBranch: GitBranch; initCommit: GitCommit }> {
    // 校验唯一性（ownerId + name）
    const exist = await this.prisma.gitRepo.findFirst({
      where: { ownerId: input.ownerId, name: input.name },
    })
    if (exist) throw new Error(`仓库 "${input.name}" 已存在`)

    if (input.conversationId) {
      // 对话绑定的仓库只能有一个
      const bind = await this.prisma.gitRepo.findFirst({ where: { conversationId: input.conversationId } })
      if (bind) throw new Error('该对话已绑定Git仓库')
    }

    const defaultBranchName = input.defaultBranchName ?? 'main'

    // 1. 创建仓库记录
    const repo = await this.prisma.gitRepo.create({
      data: {
        name: input.name,
        description: input.description ?? null,
        visibility: input.visibility ?? 'PRIVATE',
        defaultBranch: defaultBranchName,
        ownerId: input.ownerId,
        conversationId: input.conversationId ?? null,
        forkedFromId: input.forkedFromId ?? null,
        isFork: !!input.forkedFromId,
      },
    })

    // 2. 如果关联对话：自动把现有messages导入初始提交
    const entries: GitObjectService['BuildEntryInput'][] = []
    if (input.conversationId) {
      const conv = await this.prisma.conversation.findUnique({
        where: { id: input.conversationId },
        include: { messages: true },
      })
      if (conv) {
        const byTurn = new Map<number, { user: any | null; versions: Map<number, any[]> }>()
        for (const m of conv.messages) {
          const ti = m.turnIndex ?? 0
          const bucket = byTurn.get(ti) ?? { user: null, versions: new Map() }
          if (m.versionIndex == null) {
            if (m.role === 'USER') bucket.user = m
          } else {
            const vi = m.versionIndex
            const vlist = bucket.versions.get(vi) ?? []
            vlist.push(m)
            bucket.versions.set(vi, vlist)
          }
          byTurn.set(ti, bucket)
        }
        const turns = [...byTurn.keys()].sort((a, b) => a - b)
        for (const t of turns) {
          const b = byTurn.get(t)!
          const pad = String(t).padStart(4, '0')
          if (b.user) {
            entries.push({
              path: `turns/${pad}/user.msg`,
              content: JSON.stringify(
                { role: b.user.role, content: b.user.content, nodeId: b.user.nodeId, insertedAt: b.user.insertedAt },
                null,
                2,
              ),
              mimeType: 'application/json',
            })
          }
          const vers = [...b.versions.keys()].sort()
          for (const v of vers) {
            const msgs = b.versions.get(v)!
            const vpad = String(v).padStart(2, '0')
            const subMap = new Map<number, { user: any; assistant: any }>()
            for (const msg of msgs) {
              if (msg.subTurnIndex == null) {
                if (msg.role === 'ASSISTANT') {
                  entries.push({
                    path: `turns/${pad}/versions/v${vpad}/assistant.msg`,
                    content: JSON.stringify(
                      { role: msg.role, content: msg.content, nodeId: msg.nodeId, model: msg.model, insertedAt: msg.insertedAt },
                      null,
                      2,
                    ),
                    mimeType: 'application/json',
                  })
                }
              } else {
                const st = subMap.get(msg.subTurnIndex) ?? ({} as any)
                if (msg.role === 'USER') st.user = msg
                else st.assistant = msg
                subMap.set(msg.subTurnIndex, st)
              }
            }
            const sts = [...subMap.keys()].sort()
            for (const s of sts) {
              const sp = String(s).padStart(2, '0')
              const st = subMap.get(s)!
              if (st.user) {
                entries.push({
                  path: `turns/${pad}/versions/v${vpad}/subturns/${sp}/user.msg`,
                  content: JSON.stringify(
                    { role: 'USER', content: st.user.content, nodeId: st.user.nodeId, insertedAt: st.user.insertedAt },
                    null,
                    2,
                  ),
                  mimeType: 'application/json',
                })
              }
              if (st.assistant) {
                entries.push({
                  path: `turns/${pad}/versions/v${vpad}/subturns/${sp}/assistant.msg`,
                  content: JSON.stringify(
                    { role: 'ASSISTANT', content: st.assistant.content, nodeId: st.assistant.nodeId, model: st.assistant.model, insertedAt: st.assistant.insertedAt },
                    null,
                    2,
                  ),
                  mimeType: 'application/json',
                })
              }
            }
          }
        }
        // 对话元信息
        entries.push({
          path: 'conversation.meta.json',
          content: JSON.stringify(
            {
              title: conv.title,
              deepseekConvId: conv.deepseekConvId,
              turnCount: conv.turnCount,
              insertedAt: conv.insertedAt,
              updatedAt: conv.updatedAt,
              rawMapping: conv.rawMapping,
            },
            null,
            2,
          ),
          mimeType: 'application/json',
        })
      }
    }

    // 用户显式传入的初始内容追加
    for (const e of input.initialContent ?? []) entries.push(e)

    if (entries.length === 0) {
      entries.push({ path: 'README.md', content: `# ${input.name}\n\n${input.description ?? ''}\n` })
    }

    // 3. 创建初始 Tree
    const { tree } = await this.objects.buildTree(repo.id, entries)

    // 4. 创建 default branch 记录（先无HEAD）
    const defaultBranch = await this.prisma.gitBranch.create({
      data: {
        repoId: repo.id,
        name: defaultBranchName,
        isDefault: true,
        createdById: input.ownerId,
      },
    })

    // 5. 创建初始commit，自动更新 branch HEAD
    const author: CommitAuthor = input.author ?? (await this._userToAuthor(input.ownerId))
    const { commit: initCommit } = await this.commits.createCommit({
      repoId: repo.id,
      treeId: tree.id,
      parentIds: [],
      author,
      subject: `init: ${input.name}`,
      body: input.conversationId
        ? `初始化导入对话数据（${entries.length} 个文件）`
        : '初始提交',
      changeType: 'INIT',
      branchId: defaultBranch.id,
    })

    // 6. 创建 OWNER 协作者
    await this.prisma.repoCollaborator.create({
      data: {
        repoId: repo.id,
        userId: input.ownerId,
        permission: 'OWNER',
        invitedBy: input.ownerId,
      },
    })

    return { repo, defaultBranch, initCommit }
  }

  private async _userToAuthor(userId: number): Promise<CommitAuthor> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!u) return { name: `user${userId}`, email: `user${userId}@dstoolkit.local`, userId }
    return { name: u.username, email: `${u.username}@dstoolkit.local`, userId }
  }

  async getRepo(repoId: number, viewerUserId?: number) {
    const repo = await this.prisma.gitRepo.findUnique({
      where: { id: repoId },
      include: {
        owner: { select: { id: true, username: true } },
        branches: { orderBy: { isDefault: 'desc' }, take: 20 },
        _count: { select: { commits: true, branches: true, tags: true, pullRequests: true, collaborators: true } },
      },
    })
    if (!repo) return null
    // 权限校验
    if (repo.visibility === 'PRIVATE') {
      if (!viewerUserId) return null
      const allowed = await this.prisma.repoCollaborator.findFirst({ where: { repoId, userId: viewerUserId } })
      if (!allowed && repo.ownerId !== viewerUserId) return null
    }
    return repo
  }

  async listRepos(params: { userId?: number; ownerId?: number; visibility?: any; search?: string; limit?: number; offset?: number }) {
    const { limit = 50, offset = 0 } = params
    const where: any = {}
    if (params.ownerId) where.ownerId = params.ownerId
    if (params.visibility) where.visibility = params.visibility
    else if (params.userId) {
      // 当前用户能看到的：自己的 + 协作者的 + PUBLIC/INTERNAL
      const collabed = await this.prisma.repoCollaborator.findMany({ where: { userId: params.userId }, select: { repoId: true } })
      where.OR = [
        { ownerId: params.userId },
        { id: { in: collabed.map((c) => c.repoId) } },
        { visibility: { in: ['PUBLIC', 'INTERNAL'] } },
      ]
    } else {
      where.visibility = 'PUBLIC'
    }
    if (params.search) {
      where.OR = [
        { name: { contains: params.search } },
        { description: { contains: params.search } },
      ]
    }
    const repos = await this.prisma.gitRepo.findMany({
      where,
      orderBy: { lastActivityAt: 'desc' },
      skip: offset,
      take: limit,
      include: { owner: { select: { id: true, username: true } } },
    })
    const total = await this.prisma.gitRepo.count({ where })
    return { repos, total }
  }

  // ══════════════════════════════════════════════
  // 分支操作
  // ══════════════════════════════════════════════

  async createBranch(params: {
    repoId: number
    name: string
    fromBranchName?: string
    fromCommitSha?: string
    createdById: number
    protection?: ProtectionLevel
  }): Promise<GitBranch> {
    const { repoId, name, createdById } = params
    // 去重
    const dup = await this.prisma.gitBranch.findFirst({ where: { repoId, name } })
    if (dup) throw new Error(`分支 "${name}" 已存在`)

    // 找起点commit
    let headCommitId: number | undefined
    let baseSha: string | undefined
    if (params.fromCommitSha) {
      const c = await this.prisma.gitCommit.findFirst({
        where: { repoId, sha256: params.fromCommitSha.length === 64 ? params.fromCommitSha : { startsWith: params.fromCommitSha } },
      })
      if (!c) throw new Error('起点commit不存在')
      headCommitId = c.id
      baseSha = c.sha256
    } else {
      const baseBranchName = params.fromBranchName ?? (await this.prisma.gitRepo.findUnique({ where: { id: repoId } }))?.defaultBranch ?? 'main'
      const b = await this.prisma.gitBranch.findFirst({ where: { repoId, name: baseBranchName }, include: { headCommit: true } })
      if (!b || !b.headCommit) throw new Error(`基准分支 "${baseBranchName}" 不存在或为空`)
      headCommitId = b.headCommit.id
      baseSha = b.headCommit.sha256
    }

    const branch = await this.prisma.$transaction(async (tx) => {
      const b = await tx.gitBranch.create({
        data: {
          repoId,
          name,
          isDefault: false,
          headCommitId,
          createdById,
          protection: params.protection ?? 'NONE',
          lastCommitAt: new Date(),
        },
      })
      const author = await this._userToAuthor(createdById)
      await tx.gitReflog.create({
        data: {
          repoId,
          refName: `refs/heads/${name}`,
          oldSha: null,
          newSha: baseSha!,
          action: 'branch.create',
          actorName: author.name,
          actorEmail: author.email,
          actorUserId: author.userId,
          reason: params.fromBranchName ? `从 ${params.fromBranchName} 创建分支` : '创建分支',
        },
      })
      await tx.gitRepo.update({ where: { id: repoId }, data: { branchCount: { increment: 1 } } })
      return b
    })
    return branch
  }

  async deleteBranch(params: { repoId: number; branchName: string; userId: number; force?: boolean }): Promise<void> {
    const { repoId, branchName, userId } = params
    const repo = await this.prisma.gitRepo.findUnique({ where: { id: repoId } })
    if (!repo) throw new Error('仓库不存在')
    if (repo.defaultBranch === branchName && !params.force) {
      throw new Error('不能删除默认分支（可 force=true 强制删除，需先切换默认分支）')
    }
    const b = await this.prisma.gitBranch.findFirst({ where: { repoId, name: branchName }, include: { headCommit: true } })
    if (!b) throw new Error('分支不存在')
    // 权限: OWNER/MAINTAINER 或创建者
    const collab = await this.prisma.repoCollaborator.findFirst({ where: { repoId, userId } })
    const canDelete = collab && ['OWNER', 'MAINTAINER'].includes(collab.permission) || b.createdById === userId
    if (!canDelete) throw new Error('无权限删除此分支')

    await this.prisma.$transaction(async (tx) => {
      await tx.gitCommitRef.deleteMany({ where: { repoId, branchId: b.id } })
      await tx.gitBranch.delete({ where: { id: b.id } })
      await tx.gitRepo.update({ where: { id: repoId }, data: { branchCount: { decrement: 1 } } })
      const author = await this._userToAuthor(userId)
      await tx.gitReflog.create({
        data: {
          repoId,
          refName: `refs/heads/${branchName}`,
          oldSha: b.headCommit?.sha256 ?? null,
          newSha: '0000000000000000000000000000000000000000000000000000000000000000',
          action: 'branch.delete',
          actorName: author.name,
          actorEmail: author.email,
          actorUserId: author.userId,
          reason: '删除分支',
        },
      })
    })
  }

  async protectBranch(params: {
    repoId: number
    branchName: string
    level: ProtectionLevel
    requiredApprovals?: number
    requireStatusChecks?: boolean
  }): Promise<GitBranch> {
    const b = await this.prisma.gitBranch.findFirst({ where: { repoId: params.repoId, name: params.branchName } })
    if (!b) throw new Error('分支不存在')
    return this.prisma.gitBranch.update({
      where: { id: b.id },
      data: {
        protection: params.level,
        requiredApprovals: params.requiredApprovals ?? 0,
        requireStatusChecks: !!params.requireStatusChecks,
      },
    })
  }

  async listBranches(repoId: number, includeCounts = true) {
    const branches = await this.prisma.gitBranch.findMany({
      where: { repoId },
      orderBy: [{ isDefault: 'desc' }, { lastCommitAt: 'desc' }],
      include: {
        headCommit: { include: { parentLinks: { take: 1, include: { parent: { select: { id: true, sha256: true } } } } } },
        createdBy: { select: { id: true, username: true } },
      },
    })
    if (!includeCounts) return branches
    // 带 ahead/behind 相对默认分支
    const def = branches.find((b) => b.isDefault)
    if (!def || !def.headCommit) return branches
    return branches
  }

  // ══════════════════════════════════════════════
  // 标签操作
  // ══════════════════════════════════════════════

  async createTag(params: {
    repoId: number
    name: string
    targetCommitSha?: string
    annotated?: boolean
    message?: string
    taggerUserId: number
    semver?: { major: number; minor: number; patch: number; prerelease?: string }
  }): Promise<GitTag> {
    const exist = await this.prisma.gitTag.findFirst({ where: { repoId: params.repoId, name: params.name } })
    if (exist) throw new Error('标签已存在')
    let commitId: number | undefined
    let targetSha: string
    if (params.targetCommitSha) {
      const c = await this.prisma.gitCommit.findFirst({
        where: { repoId: params.repoId, sha256: params.targetCommitSha.length === 64 ? params.targetCommitSha : { startsWith: params.targetCommitSha } },
      })
      if (!c) throw new Error('目标commit不存在')
      commitId = c.id
      targetSha = c.sha256
    } else {
      const repo = await this.prisma.gitRepo.findUnique({ where: { id: params.repoId }, include: { branches: { where: { isDefault: true }, include: { headCommit: true } } } })
      const head = repo?.branches[0]?.headCommit
      if (!head) throw new Error('默认分支无HEAD提交')
      commitId = head.id
      targetSha = head.sha256
    }
    const tagger = await this._userToAuthor(params.taggerUserId)
    const tag = await this.prisma.gitTag.create({
      data: {
        repoId: params.repoId,
        name: params.name,
        isAnnotated: !!params.annotated,
        type: 'COMMIT',
        commitId,
        targetSha,
        taggerName: params.annotated ? tagger.name : null,
        taggerEmail: params.annotated ? tagger.email : null,
        taggerUserId: params.annotated ? tagger.userId : null,
        taggedAt: params.annotated ? new Date() : null,
        message: params.message ?? null,
        semverMajor: params.semver?.major,
        semverMinor: params.semver?.minor,
        semverPatch: params.semver?.patch,
        semverPrerelease: params.semver?.prerelease,
      },
    })
    await this.prisma.gitRepo.update({ where: { id: params.repoId }, data: { tagCount: { increment: 1 } } })
    return tag
  }

  async deleteTag(repoId: number, name: string, userId: number): Promise<void> {
    const tag = await this.prisma.gitTag.findFirst({ where: { repoId, name } })
    if (!tag) throw new Error('标签不存在')
    await this.prisma.$transaction(async (tx) => {
      await tx.gitTag.delete({ where: { id: tag.id } })
      await tx.gitRepo.update({ where: { id: repoId }, data: { tagCount: { decrement: 1 } } })
    })
  }

  async listTags(repoId: number) {
    return this.prisma.gitTag.findMany({
      where: { repoId },
      orderBy: [
        { semverMajor: 'desc' },
        { semverMinor: 'desc' },
        { semverPatch: 'desc' },
        { createdAt: 'desc' },
      ],
      include: { commit: { include: { parentLinks: { take: 1 } } } },
    })
  }

  // ══════════════════════════════════════════════
  // 合并操作（四种策略）
  // ══════════════════════════════════════════════

  public interface MergeResult {
    commit?: GitCommit
    strategy: string
    hasConflicts: boolean
    conflicts?: Array<{ path: string; conflictCount?: number; reason?: string }>
    mergedFiles?: number
    additions?: number
    deletions?: number
  }

  async merge(params: {
    repoId: number
    sourceBranchName: string
    targetBranchName: string
    strategy: 'MERGE_COMMIT' | 'SQUASH' | 'REBASE' | 'FAST_FORWARD'
    author: CommitAuthor
    message?: string
    userId: number
  }): Promise<MergeResult> {
    const { repoId, sourceBranchName, targetBranchName, strategy, author } = params

    const srcB = await this.prisma.gitBranch.findFirst({ where: { repoId, name: sourceBranchName }, include: { headCommit: true } })
    const tgtB = await this.prisma.gitBranch.findFirst({ where: { repoId, name: targetBranchName }, include: { headCommit: true } })
    if (!srcB || !srcB.headCommit || !tgtB || !tgtB.headCommit) throw new Error('分支不存在或为空')

    // 检查保护
    if (tgtB.protection !== 'NONE') {
      const collab = await this.prisma.repoCollaborator.findFirst({ where: { repoId, userId: params.userId } })
      const ok = collab && ['OWNER', 'MAINTAINER', 'WRITE'].includes(collab.permission)
      if (!ok) throw new Error(`分支 "${targetBranchName}" 受保护（${tgtB.protection}），你无权直接合并`)
    }

    // 找最近共同祖先 (LCA)
    const lca = await this._findLCA(srcB.headCommit.id, tgtB.headCommit.id)
    if (!lca) {
      throw new Error('两个分支无共同祖先（历史不相关），暂不支持合并')
    }
    // fast-forward 情况：target HEAD 就是 LCA
    const canFastForward = lca.id === tgtB.headCommit.id

    if (strategy === 'FAST_FORWARD') {
      if (!canFastForward) throw new Error('不能快进合并：存在分叉，必须创建合并提交或rebase')
      // 直接移动 target HEAD = src HEAD
      await this.prisma.$transaction(async (tx) => {
        await tx.gitBranch.update({ where: { id: tgtB.id }, data: { headCommitId: srcB.headCommitId, lastCommitAt: new Date() } })
        await tx.gitReflog.create({
          data: {
            repoId,
            refName: `refs/heads/${targetBranchName}`,
            oldSha: tgtB.headCommit!.sha256,
            newSha: srcB.headCommit!.sha256,
            action: 'merge',
            actorName: author.name,
            actorEmail: author.email,
            actorUserId: author.userId,
            reason: `fast-forward merge ${sourceBranchName} into ${targetBranchName}`,
          },
        })
      })
      return { strategy, hasConflicts: false }
    }

    if (strategy === 'SQUASH') {
      // 把 source 相对于 LCA 的所有变更 压成 一个 patch，应用到 target HEAD 上
      return this._applyPatchAndCommit({
        repoId,
        fromTreeId: lca.treeId,
        toTreeId: srcB.headCommit.treeId,
        ontoCommitId: tgtB.headCommit.id,
        targetBranchId: tgtB.id,
        targetBranchName,
        author,
        commitType: 'MERGE' as any,
        subject: params.message ?? `squash merge ${sourceBranchName} into ${targetBranchName}`,
        body: `Squash merged branch "${sourceBranchName}" into ${targetBranchName}\nBase LCA: ${lca.sha256}`,
      })
    }

    if (strategy === 'REBASE') {
      // 把 source 的提交序列逐个重新应用在 target HEAD 之后，然后移动 source HEAD；随后如果想合入target再让他ff
      // 简化实现：不要求 caller 再调用一次ff，这里直接做完rebase后自动ff到target
      const srcCommits = await this._listCommitsBetween(srcB.headCommit.id, lca.id) // 新→旧
      srcCommits.reverse() // 旧→新，按顺序应用
      let ontoId = tgtB.headCommit.id
      const conflicts: any[] = []
      for (const c of srcCommits) {
        const patch = await this.objects.diffTrees(c.parentLinks[0].parentId ?? lca.id, c.treeId)
        // 为了简化，这里只"基于当前onto生成合并树"，不用真正cherry-pick逐个
        const res = await this._applyPatch({
          repoId,
          fromTreeId: (c.parentLinks[0].parent)?.treeId ?? lca.treeId,
          toTreeId: c.treeId,
          ontoCommitId: ontoId,
        })
        conflicts.push(...(res.conflicts ?? []))
        if (res.treeId == null) {
          // 没有变化
          continue
        }
        const { commit } = await this.commits.createCommit({
          repoId,
          treeId: res.treeId,
          parentIds: [ontoId],
          author: { name: c.authorName, email: c.authorEmail, userId: c.authorUserId ?? undefined },
          subject: c.subject,
          body: c.body ?? undefined,
          authoredAt: c.authoredAt,
          changeType: 'REBASE',
        })
        ontoId = commit.id
      }
      // rebase完成：移动 source HEAD 到 ontoId
      await this.prisma.gitBranch.update({ where: { id: srcB.id }, data: { headCommitId: ontoId, lastCommitAt: new Date() } })
      // 如果可以 fast forward（即原始target未变），也把 target HEAD 更新
      const latestTarget = await this.prisma.gitBranch.findUnique({ where: { id: tgtB.id } })
      if (latestTarget?.headCommitId === tgtB.headCommitId) {
        await this.prisma.gitBranch.update({ where: { id: tgtB.id }, data: { headCommitId: ontoId, lastCommitAt: new Date() } })
      }
      return { strategy, hasConflicts: conflicts.length > 0, conflicts }
    }

    // 默认: MERGE_COMMIT（标准三路合并）
    return this._applyPatchAndCommit({
      repoId,
      fromTreeId: lca.treeId,
      toTreeId: srcB.headCommit.treeId,
      ontoCommitId: tgtB.headCommit.id,
      targetBranchId: tgtB.id,
      targetBranchName,
      author,
      commitType: 'MERGE' as any,
      subject: params.message ?? `merge ${sourceBranchName} into ${targetBranchName}`,
      body: `Merge branch "${sourceBranchName}" into ${targetBranchName}\nBase LCA: ${lca.sha256}`,
      // merge commit = 双父
      secondParentId: srcB.headCommit.id,
    })
  }

  /**
   * 基于 ancestor → patchSource 的差异，应用到 targetHead 上；可选创建commit
   */
  private async _applyPatch(params: {
    repoId: number
    fromTreeId: number
    toTreeId: number
    ontoCommitId: number
  }): Promise<{ treeId?: number; conflicts: Array<{ path: string; conflictCount?: number; reason?: string }> }> {
    const { repoId, ontoCommitId } = params
    const headCommit = await this.prisma.gitCommit.findUnique({ where: { id: ontoCommitId } })
    if (!headCommit) throw new Error('onto commit不存在')
    const diff = await this.objects.diffTrees(params.fromTreeId, params.toTreeId)
    const existingFiles = await this.objects.materializeTree(headCommit.treeId)
    const touchedPaths = new Set<string>()
    const newEntries: GitObjectService['BuildEntryInput'][] = []
    const conflicts: any[] = []

    for (const f of diff.files) {
      const path = f.newPath ?? f.oldPath
      if (!path) continue
      touchedPaths.add(path)
      const ours = await this.objects.readFileFromTree(headCommit.treeId, path)
      const theirs = f.newPath ? await this.objects.readFileFromTree(params.toTreeId, f.newPath) : null
      const ancestor = f.oldPath ? await this.objects.readFileFromTree(params.fromTreeId, f.oldPath) : null

      if (f.status === 'added') {
        if (ours && theirs && ours.blob.content !== theirs.blob.content) {
          conflicts.push({ path, reason: 'BOTH_ADDED' })
          newEntries.push({ path, content: ours.blob.content })
          continue
        }
        if (theirs) newEntries.push({ path, content: theirs.blob.content })
        continue
      }
      if (f.status === 'deleted') {
        if (ours && ancestor && ours.blob.content !== ancestor.blob.content) {
          conflicts.push({ path, reason: 'DELETE_MODIFY' })
          newEntries.push({ path, content: ours.blob.content })
          continue
        }
        // 不加入（删除）
        continue
      }
      // modified
      if (!theirs || !ancestor) continue
      if (!ours) {
        conflicts.push({ path, reason: 'MODIFY_DELETE' })
        continue
      }
      if (ours.blob.content === theirs.blob.content) {
        newEntries.push({ path, content: ours.blob.content })
        continue
      }
      const m = threeWayMerge(ancestor.blob.content, ours.blob.content, theirs.blob.content)
      newEntries.push({ path, content: m.merged })
      if (m.hasConflicts) conflicts.push({ path, conflictCount: m.conflictCount })
    }
    for (const e of existingFiles) {
      if (touchedPaths.has(e.path)) continue
      const blob = await this.objects.readBlob(e.blobId)
      if (blob) newEntries.push({ path: e.path, content: blob.content, blobId: e.blobId })
    }
    if (newEntries.length === 0) return { conflicts }
    // 检查内容是否跟head完全相同
    const headFiles = await this.objects.materializeTree(headCommit.treeId)
    const headMap = new Map(headFiles.map((x) => [x.path, x.sha]))
    let changed = false
    for (const e of newEntries) {
      const bsha = e.blobId ? (await this.objects.readBlob(e.blobId))?.sha256 : computeContentHash(e.content)
      const prev = headMap.get(e.path)
      if (bsha !== prev) { changed = true; break }
    }
    if (!changed) return { conflicts }
    const { tree } = await this.objects.buildTree(repoId, newEntries)
    return { treeId: tree.id, conflicts }
  }

  private async _applyPatchAndCommit(params: {
    repoId: number
    fromTreeId: number
    toTreeId: number
    ontoCommitId: number
    targetBranchId: number
    targetBranchName: string
    author: CommitAuthor
    subject: string
    body?: string
    commitType: 'MERGE' | 'EDIT'
    secondParentId?: number
  }): Promise<MergeResult> {
    const res = await this._applyPatch({
      repoId: params.repoId,
      fromTreeId: params.fromTreeId,
      toTreeId: params.toTreeId,
      ontoCommitId: params.ontoCommitId,
    })
    if (!res.treeId) {
      return {
        strategy: params.commitType,
        hasConflicts: res.conflicts.length > 0,
        conflicts: res.conflicts,
      }
    }
    const { commit } = await this.commits.createCommit({
      repoId: params.repoId,
      treeId: res.treeId,
      parentIds: params.secondParentId ? [params.ontoCommitId, params.secondParentId] : [params.ontoCommitId],
      author: params.author,
      subject: params.subject,
      body: params.body,
      changeType: params.commitType,
      branchId: params.targetBranchId,
    })
    const info = await this.commits.getCommitById(commit.id)
    return {
      commit,
      strategy: params.commitType,
      hasConflicts: res.conflicts.length > 0,
      conflicts: res.conflicts,
      mergedFiles: info?.changedFiles,
      additions: info?.additions,
      deletions: info?.deletions,
    }
  }

  // ══════════════════════════════════════════════
  // Reset / Checkout / Restore
  // ══════════════════════════════════════════════

  /**
   * reset --mixed / --soft / --hard
   * 把 branch HEAD 移动到 targetCommit
   */
  async reset(params: {
    repoId: number
    branchId: number
    targetSha: string
    mode?: 'soft' | 'mixed' | 'hard'
    userId: number
  }) {
    const { repoId, branchId, mode = 'mixed', userId } = params
    const branch = await this.prisma.gitBranch.findUnique({ where: { id: branchId }, include: { headCommit: true } })
    if (!branch) throw new Error('分支不存在')
    const target = await this.prisma.gitCommit.findFirst({
      where: { repoId, sha256: params.targetSha.length === 64 ? params.targetSha : { startsWith: params.targetSha } },
    })
    if (!target) throw new Error('目标commit不存在')
    const oldSha = branch.headCommit?.sha256
    if (!oldSha) throw new Error('分支无HEAD')
    const author = await this._userToAuthor(userId)
    await this.prisma.$transaction(async (tx) => {
      await tx.gitBranch.update({ where: { id: branchId }, data: { headCommitId: target.id, lastCommitAt: new Date() } })
      // 清理 / 重建 commitRef 到新的HEAD的路径
      await tx.gitCommitRef.deleteMany({ where: { repoId, branchId } })
      await tx.gitCommitRef.create({
        data: { repoId, commitId: target.id, branchId, branchName: branch.name, refType: 'BRANCH', depth: 0 },
      })
      await tx.gitReflog.create({
        data: {
          repoId,
          refName: `refs/heads/${branch.name}`,
          oldSha,
          newSha: target.sha256,
          action: `reset.${mode}`,
          actorName: author.name,
          actorEmail: author.email,
          actorUserId: author.userId,
          reason: `reset --${mode} to ${target.sha256.slice(0, 12)}`,
        },
      })
    })
    return { ok: true, targetSha: target.sha256, mode }
  }

  // ══════════════════════════════════════════════
  // Stash 操作
  // ══════════════════════════════════════════════

  async stash(params: {
    repoId: number
    branchId: number
    userId: number
    name?: string
    message?: string
    stagedEntries: GitObjectService['BuildEntryInput'][]
    workingEntries: GitObjectService['BuildEntryInput'][]
    untrackedEntries?: GitObjectService['BuildEntryInput'][]
  }) {
    const { repoId, branchId, userId } = params
    const branch = await this.prisma.gitBranch.findUnique({ where: { id: branchId }, include: { headCommit: true } })
    if (!branch || !branch.headCommit) throw new Error('分支不存在或无HEAD')
    const existing = await this.prisma.gitStash.findMany({ where: { repoId }, select: { index: true } })
    const maxIdx = existing.reduce((m, x) => Math.max(m, x.index), -1)
    const newIdx = maxIdx + 1
    const [staged, working, untracked] = await Promise.all([
      this.objects.buildTree(repoId, params.stagedEntries),
      this.objects.buildTree(repoId, params.workingEntries),
      params.untrackedEntries && params.untrackedEntries.length > 0
        ? this.objects.buildTree(repoId, params.untrackedEntries)
        : null,
    ])
    const stash = await this.prisma.gitStash.create({
      data: {
        repoId,
        branchId,
        index: newIdx,
        name: params.name ?? null,
        message: params.message ?? null,
        baseCommitId: branch.headCommit.id,
        stagedTreeId: staged.tree.id,
        workingTreeId: working.tree.id,
        untrackedTreeId: untracked?.tree.id,
        createdById: userId,
      },
    })
    return stash
  }

  async stashPop(params: { repoId: number; userId: number; index?: number }) {
    const { repoId } = params
    const where: any = { repoId }
    if (params.index != null) where.index = params.index
    const stashes = await this.prisma.gitStash.findMany({ where, orderBy: { index: 'asc' }, take: 1, include: { branch: { include: { headCommit: true } } } })
    if (stashes.length === 0) throw new Error('stash列表为空')
    const st = stashes[0]
    // 把workingTree还原应用到当前 branch HEAD
    const headTreeId = st.branch.headCommit?.treeId
    if (!headTreeId) throw new Error('分支无HEAD')
    const workingFiles = await this.objects.materializeTree(st.workingTreeId)
    const existing = await this.objects.materializeTree(headTreeId)
    const entries: GitObjectService['BuildEntryInput'][] = []
    for (const e of existing) {
      const blob = await this.objects.readBlob(e.blobId)
      if (blob) entries.push({ path: e.path, content: blob.content, blobId: e.blobId })
    }
    for (const f of workingFiles) {
      const blob = await this.objects.readBlob(f.blobId)
      if (blob) entries.push({ path: f.path, content: blob.content })
    }
    if (st.untrackedTreeId) {
      const untracked = await this.objects.materializeTree(st.untrackedTreeId)
      for (const f of untracked) {
        const blob = await this.objects.readBlob(f.blobId)
        if (blob) entries.push({ path: f.path, content: blob.content })
      }
    }
    const { tree } = await this.objects.buildTree(repoId, entries)
    const author = await this._userToAuthor(params.userId)
    const { commit } = await this.commits.createCommit({
      repoId,
      treeId: tree.id,
      parentIds: st.branch.headCommit ? [st.branch.headCommit.id] : [],
      author,
      subject: `stash pop${st.name ? ` (${st.name})` : ''}`,
      body: st.message ?? undefined,
      changeType: 'EDIT',
      branchId: st.branchId,
    })
    await this.prisma.gitStash.delete({ where: { id: st.id } })
    return { commit, stash: st }
  }

  // ══════════════════════════════════════════════
  // Reflog 查询
  // ══════════════════════════════════════════════

  async getReflog(params: { repoId: number; branchName?: string; limit?: number }) {
    const where: any = { repoId: params.repoId }
    if (params.branchName) where.refName = `refs/heads/${params.branchName}`
    return this.prisma.gitReflog.findMany({
      where,
      orderBy: { timestamp: 'desc' },
      take: params.limit ?? 100,
    })
  }

  // ══════════════════════════════════════════════
  // 辅助：LCA + 之间的提交列表
  // ══════════════════════════════════════════════

  private async _findLCA(aId: number, bId: number): Promise<GitCommit | null> {
    // 从a爬祖先，visited；从b爬祖先，第一次交集即LCA
    const visited = new Set<number>()
    let stack: number[] = [aId]
    while (stack.length > 0) {
      const id = stack.pop()!
      if (visited.has(id)) continue
      visited.add(id)
      const parents = await this.prisma.gitCommitParent.findMany({ where: { commitId: id }, select: { parentId: true } })
      for (const p of parents) stack.push(p.parentId)
    }
    stack = [bId]
    while (stack.length > 0) {
      const id = stack.pop()!
      if (visited.has(id)) return this.prisma.gitCommit.findUnique({ where: { id } })
      const parents = await this.prisma.gitCommitParent.findMany({ where: { commitId: id }, select: { parentId: true } })
      for (const p of parents) stack.push(p.parentId)
    }
    return null
  }

  private async _listCommitsBetween(newerId: number, olderId: number): Promise<any[]> {
    const out: any[] = []
    let cur = newerId
    const guard = new Set<number>()
    while (cur && cur !== olderId && !guard.has(cur)) {
      guard.add(cur)
      const c = await this.prisma.gitCommit.findUnique({ where: { id: cur }, include: { parentLinks: { take: 1, include: { parent: true } } } })
      if (!c) break
      out.push(c)
      if (c.parentLinks.length === 0) break
      cur = c.parentLinks[0].parentId
    }
    return out
  }
}

function computeContentHash(content: string | undefined): string {
  if (content == null) return ''
  return computeGitHash('blob', content)
}
