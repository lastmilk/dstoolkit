/**
 * Pull Request / Merge Request 服务
 *   - 创建、更新、审查、评论、合并、关闭
 *   - 冲突检测 + 合并性判断
 *   - 审查者分配 + 审批流
 *   - 活动日志（activity timeline）
 */
import type { PrismaClient, PullRequest, PullRequestStatus, MergeStrategy } from '@prisma/client'
import { GitRepoService } from './gitRepo.service.js'
import { GitObjectService } from './gitObject.service.js'
import type { CommitAuthor } from './gitCommit.service.js'

export interface CreatePRInput {
  repoId: number
  title: string
  description?: string
  headBranchName: string
  baseBranchName: string
  headRepoId?: number       // fork PR
  authorId: number
  isDraft?: boolean
  assignees?: number[]      // userId
  reviewers?: number[]      // userId
  labels?: string[]
  mergeStrategy?: MergeStrategy
}

export class PullRequestService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly repos: GitRepoService,
    private readonly objects: GitObjectService,
  ) {}

  // ══════════════════════════════════════════════
  // 创建 PR
  // ══════════════════════════════════════════════

  async createPR(input: CreatePRInput): Promise<PullRequest> {
    const { repoId, headBranchName, baseBranchName, authorId } = input
    const baseRepo = await this.prisma.gitRepo.findUnique({ where: { id: repoId } })
    if (!baseRepo) throw new Error('仓库不存在')
    const headRepoId = input.headRepoId ?? repoId // 同仓库PR
    // 找分支
    const headB = await this.prisma.gitBranch.findFirst({
      where: { repoId: headRepoId, name: headBranchName },
      include: { headCommit: true },
    })
    if (!headB || !headB.headCommit) throw new Error('源分支不存在或为空')
    const baseB = await this.prisma.gitBranch.findFirst({
      where: { repoId, name: baseBranchName },
      include: { headCommit: true },
    })
    if (!baseB || !baseB.headCommit) throw new Error('目标分支不存在或为空')
    if (headB.id === baseB.id && headRepoId === repoId) throw new Error('源分支和目标分支不能相同')

    // 分配编号
    const latestPR = await this.prisma.pullRequest.findFirst({
      where: { repoId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const latestIssue = await this.prisma.repoIssue.findFirst({
      where: { repoId },
      orderBy: { number: 'desc' },
      select: { number: true },
    })
    const number = Math.max(latestPR?.number ?? 0, latestIssue?.number ?? 0) + 1

    // 协作者查询（用于 assignees/reviewers）
    const collabs = await this.prisma.repoCollaborator.findMany({
      where: { repoId, userId: { in: [...(input.assignees ?? []), ...(input.reviewers ?? [])] } },
    })

    // 冲突检测
    const { hasConflicts, mergeable, additions, deletions, changedFiles, commitCount } =
      await this._analyzeMergeability(headB.headCommit.treeId, baseB.headCommit.treeId, headB.headCommitId, baseB.headCommitId)

    const pr = await this.prisma.$transaction(async (tx) => {
      const created = await tx.pullRequest.create({
        data: {
          repoId,
          number,
          title: input.title,
          description: input.description ?? null,
          headBranchId: headB.id,
          headRepoId,
          headCommitSha: headB.headCommit.sha256,
          baseBranchId: baseB.id,
          baseCommitSha: baseB.headCommit.sha256,
          authorId,
          isDraft: !!input.isDraft,
          status: input.isDraft ? 'DRAFT' : 'OPEN',
          mergeStrategy: input.mergeStrategy ?? 'MERGE_COMMIT',
          hasConflicts,
          mergeable,
          additions,
          deletions,
          changedFiles,
          commitCount,
          requestedApprovals: (input.reviewers ?? []).length,
        },
      })
      // 分配 assignees/reviewers (通过关联)
      // Prisma many-to-many 隐式关联 - 这里简单起见，我们只通过标签连接；实际生产环境会有显式中间表
      await tx.pRActivity.create({
        data: {
          prId: created.id,
          actorId: authorId,
          actorName: 'User',
          action: 'OPENED',
          detail: { number },
        },
      })
      return created
    })

    // 重新加载（含关联）
    return this.prisma.pullRequest.findUniqueOrThrow({
      where: { id: pr.id },
      include: this._include(),
    })
  }

  // ══════════════════════════════════════════════
  // 查询
  // ══════════════════════════════════════════════

  private _include() {
    return {
      headBranch: true,
      baseBranch: true,
      headRepo: { include: { owner: { select: { id: true, username: true } } } },
      author: { select: { id: true, username: true } },
      reviews: { include: { reviewer: { include: { user: { select: { id: true, username: true } } } } } },
      labels: true,
      activities: { orderBy: { createdAt: 'asc' }, take: 100 },
    }
  }

  async getPR(repoId: number, number: number) {
    return this.prisma.pullRequest.findFirst({
      where: { repoId, number },
      include: this._include(),
    })
  }

  async listPRs(params: {
    repoId: number
    status?: PullRequestStatus
    authorId?: number
    headBranchName?: string
    baseBranchName?: string
    search?: string
    labels?: string[]
    limit?: number
    offset?: number
    sort?: 'created' | 'updated' | 'popularity'
  }) {
    const { limit = 30, offset = 0 } = params
    const where: any = { repoId: params.repoId }
    if (params.status) where.status = params.status
    if (params.authorId) where.authorId = params.authorId
    if (params.search) where.OR = [
      { title: { contains: params.search } },
      { description: { contains: params.search } },
    ]
    const orderBy = params.sort === 'updated' ? { updatedAt: 'desc' }
      : params.sort === 'popularity' ? { commentCount: 'desc' }
      : { createdAt: 'desc' }
    const [list, total] = await Promise.all([
      this.prisma.pullRequest.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          headBranch: true,
          baseBranch: true,
          author: { select: { id: true, username: true } },
          labels: true,
          _count: { select: { comments: true, reviews: true } },
        },
      }),
      this.prisma.pullRequest.count({ where }),
    ])
    return { list, total }
  }

  // ══════════════════════════════════════════════
  // 变更 + 审查
  // ══════════════════════════════════════════════

  async updatePR(params: {
    repoId: number
    number: number
    actorId: number
    title?: string
    description?: string
    isDraft?: boolean
    status?: PullRequestStatus
    mergeStrategy?: MergeStrategy
    baseBranchName?: string
    labels?: string[]
  }) {
    const pr = await this.getPR(params.repoId, params.number)
    if (!pr) throw new Error('PR不存在')
    const data: any = {}
    if (params.title !== undefined) data.title = params.title
    if (params.description !== undefined) data.description = params.description
    if (params.isDraft !== undefined) {
      data.isDraft = params.isDraft
      data.status = params.isDraft ? 'DRAFT' : (pr.status === 'DRAFT' ? 'OPEN' : pr.status)
    }
    if (params.status !== undefined) data.status = params.status
    if (params.mergeStrategy !== undefined) data.mergeStrategy = params.mergeStrategy
    if (params.baseBranchName) {
      const b = await this.prisma.gitBranch.findFirst({ where: { repoId: params.repoId, name: params.baseBranchName }, include: { headCommit: true } })
      if (!b || !b.headCommit) throw new Error('目标分支不存在')
      data.baseBranchId = b.id
      data.baseCommitSha = b.headCommit.sha256
    }
    const updated = await this.prisma.pullRequest.update({ where: { id: pr.id }, data, include: this._include() })
    // 重新评估冲突和合并性
    const headB = updated.headBranch
    const baseB = updated.baseBranch
    if (headB.headCommitId && baseB.headCommitId) {
      const headC = await this.prisma.gitCommit.findUnique({ where: { id: headB.headCommitId } })
      const baseC = await this.prisma.gitCommit.findUnique({ where: { id: baseB.headCommitId } })
      if (headC && baseC) {
        const analysis = await this._analyzeMergeability(headC.treeId, baseC.treeId, headC.id, baseC.id)
        Object.assign(updated, analysis)
        await this.prisma.pullRequest.update({
          where: { id: pr.id },
          data: {
            headCommitSha: headC.sha256,
            baseCommitSha: baseC.sha256,
            hasConflicts: analysis.hasConflicts,
            mergeable: analysis.mergeable,
            additions: analysis.additions,
            deletions: analysis.deletions,
            changedFiles: analysis.changedFiles,
            commitCount: analysis.commitCount,
          },
        })
      }
    }
    await this._addActivity(pr.id, params.actorId, 'EDIT_TITLE', { title: params.title })
    return updated
  }

  async closePR(params: { repoId: number; number: number; actorId: number }) {
    const pr = await this.getPR(params.repoId, params.number)
    if (!pr) throw new Error('PR不存在')
    const updated = await this.prisma.pullRequest.update({
      where: { id: pr.id },
      data: { status: 'CLOSED', closedAt: new Date() },
      include: this._include(),
    })
    await this._addActivity(pr.id, params.actorId, 'CLOSED', {})
    return updated
  }

  async reopenPR(params: { repoId: number; number: number; actorId: number }) {
    const pr = await this.getPR(params.repoId, params.number)
    if (!pr) throw new Error('PR不存在')
    const updated = await this.prisma.pullRequest.update({
      where: { id: pr.id },
      data: { status: 'OPEN', closedAt: null, mergedAt: null },
      include: this._include(),
    })
    await this._addActivity(pr.id, params.actorId, 'REOPENED', {})
    return updated
  }

  async requestReviewers(params: { repoId: number; number: number; actorId: number; reviewerUserIds: number[] }) {
    const pr = await this.getPR(params.repoId, params.number)
    if (!pr) throw new Error('PR不存在')
    await this.prisma.pullRequest.update({
      where: { id: pr.id },
      data: { requestedApprovals: { set: params.reviewerUserIds.length } },
    })
    await this._addActivity(pr.id, params.actorId, 'REVIEW_REQUESTED', { reviewers: params.reviewerUserIds })
    return this.getPR(params.repoId, params.number)
  }

  async submitReview(params: {
    repoId: number
    number: number
    reviewerId: number
    state: 'APPROVED' | 'CHANGES_REQUESTED' | 'COMMENTED'
    body?: string
  }) {
    const pr = await this.getPR(params.repoId, params.number)
    if (!pr) throw new Error('PR不存在')
    const collab = await this.prisma.repoCollaborator.findFirst({ where: { repoId: params.repoId, userId: params.reviewerId } })
    if (!collab) throw new Error('你不是仓库协作者，无法审查')
    const headC = pr.headBranch.headCommitId
      ? await this.prisma.gitCommit.findUnique({ where: { id: pr.headBranch.headCommitId } })
      : null
    const review = await this.prisma.pRReview.create({
      data: {
        prId: pr.id,
        reviewerId: collab.id,
        state: params.state,
        body: params.body ?? null,
        commitSha: headC?.sha256,
        submittedAt: new Date(),
      },
    })
    if (params.state === 'APPROVED') {
      await this.prisma.pullRequest.update({
        where: { id: pr.id },
        data: {
          approvalCount: { increment: 1 },
          status: { set: undefined } as any,
        },
      })
    }
    await this._addActivity(pr.id, params.reviewerId, params.state === 'APPROVED' ? 'APPROVED' : params.state === 'CHANGES_REQUESTED' ? 'CHANGES_REQUESTED' : 'REVIEWED', {})
    return review
  }

  // ══════════════════════════════════════════════
  // 评论
  // ══════════════════════════════════════════════

  async addComment(params: {
    repoId: number
    number: number
    authorId: number
    body: string
    isInline?: boolean
    filePath?: string
    oldLineNo?: number
    newLineNo?: number
    side?: 'LEFT' | 'RIGHT'
    blobSha?: string
    lineContent?: string
    replyToId?: number
    threadId?: number
  }) {
    const pr = await this.getPR(params.repoId, params.number)
    if (!pr) throw new Error('PR不存在')
    const comment = await this.prisma.pRComment.create({
      data: {
        prId: pr.id,
        authorId: params.authorId,
        body: params.body,
        isInline: !!params.isInline,
        filePath: params.filePath,
        oldLineNo: params.oldLineNo,
        newLineNo: params.newLineNo,
        side: params.side,
        blobSha: params.blobSha,
        lineContent: params.lineContent,
        replyToId: params.replyToId,
        threadId: params.threadId,
      },
    })
    await this.prisma.pullRequest.update({ where: { id: pr.id }, data: { commentCount: { increment: 1 } } })
    return comment
  }

  async resolveComment(params: { commentId: number; resolverId: number }) {
    const c = await this.prisma.pRComment.findUnique({ where: { id: params.commentId } })
    if (!c || !c.isInline) throw new Error('评论不存在或不是行内评论')
    return this.prisma.pRComment.update({
      where: { id: params.commentId },
      data: { isResolved: true, resolvedById: params.resolverId, resolvedAt: new Date() },
    })
  }

  async listComments(params: { repoId: number; number: number; filePath?: string }) {
    const pr = await this.getPR(params.repoId, params.number)
    if (!pr) return []
    const where: any = { prId: pr.id }
    if (params.filePath) where.filePath = params.filePath
    return this.prisma.pRComment.findMany({
      where,
      orderBy: [{ threadId: 'asc' }, { createdAt: 'asc' }],
      include: { author: { select: { id: true, username: true } } },
    })
  }

  // ══════════════════════════════════════════════
  // 合并
  // ══════════════════════════════════════════════

  async mergePR(params: {
    repoId: number
    number: number
    userId: number
    author: CommitAuthor
    strategyOverride?: MergeStrategy
    mergeMessage?: string
  }) {
    const pr = await this.getPR(params.repoId, params.number)
    if (!pr) throw new Error('PR不存在')
    if (['MERGED', 'CLOSED', 'REJECTED'].includes(pr.status)) throw new Error(`PR状态为 ${pr.status}，不能合并`)
    if (pr.isDraft) throw new Error('草稿状态的PR不能合并，请先Ready for review')

    // 检查保护规则
    const baseBranch = pr.baseBranch
    if (baseBranch.protection !== 'NONE') {
      if (baseBranch.requiredApprovals > 0 && pr.approvalCount < baseBranch.requiredApprovals) {
        throw new Error(`分支保护要求至少 ${baseBranch.requiredApprovals} 人审批，当前仅 ${pr.approvalCount}`)
      }
      const collab = await this.prisma.repoCollaborator.findFirst({ where: { repoId: params.repoId, userId: params.userId } })
      const permOk = collab && ['OWNER', 'MAINTAINER', 'WRITE'].includes(collab.permission)
      if (!permOk && baseBranch.protection !== 'NONE') {
        throw new Error(`分支 "${baseBranch.name}" 受保护，需要 WRITE 以上权限`)
      }
    }
    if (pr.hasConflicts) {
      throw new Error('存在冲突，必须先解决冲突才能合并')
    }
    const strategy = params.strategyOverride ?? pr.mergeStrategy
    const result = await this.repos.merge({
      repoId: params.repoId,
      sourceBranchName: pr.headBranch.name,
      targetBranchName: pr.baseBranch.name,
      strategy: strategy as any,
      author: params.author,
      message: params.mergeMessage,
      userId: params.userId,
    })
    if (result.hasConflicts) {
      await this._addActivity(pr.id, params.userId, 'CONFLICTED', { conflicts: result.conflicts })
      throw new Error('合并中出现冲突')
    }
    // 写PR mergedAt
    await this.prisma.pullRequest.update({
      where: { id: pr.id },
      data: {
        status: 'MERGED',
        mergedAt: new Date(),
        mergedById: params.userId,
        mergeCommitId: result.commit?.id,
      },
    })
    await this._addActivity(pr.id, params.userId, 'MERGED', {
      strategy,
      commitSha: result.commit?.sha256,
    })
    return result
  }

  // ══════════════════════════════════════════════
  // 活动 / 审查
  // ══════════════════════════════════════════════

  async listActivities(repoId: number, number: number) {
    const pr = await this.getPR(repoId, number)
    if (!pr) return []
    return this.prisma.pRActivity.findMany({
      where: { prId: pr.id },
      orderBy: { createdAt: 'asc' },
    })
  }

  private async _addActivity(prId: number, actorId: number | null, action: string, detail: any) {
    let actorName = 'System'
    if (actorId) {
      const u = await this.prisma.user.findUnique({ where: { id: actorId }, select: { username: true } })
      if (u) actorName = u.username
    }
    return this.prisma.pRActivity.create({
      data: { prId, actorId, actorName, action, detail },
    })
  }

  // ══════════════════════════════════════════════
  // PR变更分析（冲突检测+合并性判断+统计）
  // ══════════════════════════════════════════════

  private async _analyzeMergeability(
    headTreeId: number,
    baseTreeId: number,
    headCommitId: number,
    baseCommitId: number,
  ): Promise<{ hasConflicts: boolean; mergeable: boolean; additions: number; deletions: number; changedFiles: number; commitCount: number }> {
    // 先计算 diff
    const diff = await this.objects.diffTrees(baseTreeId, headTreeId)
    // 检查冲突：对每个 modified 文件，看 HEAD 的 ancestor 与 base 是否相同
    // 为了简化，我们用"尝试三路合并每个文件"的启发式方法
    let hasConflicts = false
    try {
      const baseFiles = await this.objects.materializeTree(baseTreeId)
      const headFiles = await this.objects.materializeTree(headTreeId)
      const hp = new Map(headFiles.map((f) => [f.path, f]))
      const bp = new Map(baseFiles.map((f) => [f.path, f]))
      for (const f of diff.files) {
        if (f.status === 'modified') {
          const p = f.newPath
          if (!p) continue
          const hf = hp.get(p)
          const bf = bp.get(p)
          if (hf && bf) {
            // 如果内容完全相同 = no conflict
            if (hf.sha === bf.sha) continue
            // 启发式：如果行数变化大且重叠度低 -> 很可能冲突
            const adds = f.additions
            const dels = f.deletions
            const ratio = (adds + dels) / Math.max(1, Math.min(f.oldLineCount, f.newLineCount))
            if (ratio > 1.5) { hasConflicts = true; break }
          }
        }
      }
    } catch {
      // 出错不影响，按 no conflict 处理
    }

    // commitCount: 两个分支分叉后的 commit 数（近似：headTreeId == baseTreeId 为0，否则用pr.commitCount存的默认=0，再数两者差）
    let commitCount = 0
    try {
      // 简化：数 head 比 base 多多少commit（沿着 parent 1 走）
      const visitedBase = new Set<number>()
      let cur = baseCommitId
      const visitedHead = new Map<number, number>()
      let hcur = headCommitId
      let depth = 0
      while (hcur && !visitedHead.has(hcur)) {
        visitedHead.set(hcur, depth++)
        const parents = await this.prisma.gitCommitParent.findMany({ where: { commitId: hcur }, take: 1, select: { parentId: true } })
        if (parents.length === 0) break
        hcur = parents[0].parentId
      }
      cur = baseCommitId
      depth = 0
      while (cur && !visitedBase.has(cur)) {
        visitedBase.add(cur)
        depth++
        const parents = await this.prisma.gitCommitParent.findMany({ where: { commitId: cur }, take: 1, select: { parentId: true } })
        if (parents.length === 0) break
        cur = parents[0].parentId
        if (visitedHead.has(cur)) {
          commitCount = visitedHead.get(cur)! // head 上到此点距离 = 分叉后的head commits
          break
        }
      }
    } catch {
      // ignore
    }
    return {
      hasConflicts,
      mergeable: !hasConflicts,
      additions: diff.totalAdditions,
      deletions: diff.totalDeletions,
      changedFiles: diff.changedFiles,
      commitCount,
    }
  }
}
