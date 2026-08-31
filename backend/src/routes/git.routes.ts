/**
 * Git 体系 REST API 路由
 * 覆盖：
 *  - /api/git/repos                          仓库 CRUD + 列表
 *  - /api/git/repos/:id                      仓库详情
 *  - /api/git/repos/:id/branches             分支列表/创建/删除/保护
 *  - /api/git/repos/:id/branches/:name       分支详情 / 更新 / 删除
 *  - /api/git/repos/:id/commits              提交历史
 *  - /api/git/repos/:id/commits/:sha         提交详情（含diff）
 *  - /api/git/repos/:id/tags                 标签列表/创建/删除
 *  - /api/git/repos/:id/tree/:branchOrSha    查看文件树 / 读文件（?path=）
 *  - /api/git/repos/:id/compare              比较 (?base=...&head=...)
 *  - /api/git/repos/:id/merge                合并分支
 *  - /api/git/repos/:id/cherry-pick          cherry-pick
 *  - /api/git/repos/:id/revert               revert
 *  - /api/git/repos/:id/reset                reset
 *  - /api/git/repos/:id/stash                stash / stash pop
 *  - /api/git/repos/:id/reflog               reflog
 *  - /api/git/repos/:id/prs                  PR列表 / 创建
 *  - /api/git/repos/:id/prs/:number          PR详情 / 更新 / 合并 / 关闭
 *  - /api/git/repos/:id/prs/:number/reviews  审查
 *  - /api/git/repos/:id/prs/:number/comments 评论
 *  - /api/git/repos/:id/prs/:number/merge    合并
 *  - /api/git/conversations/:convId/repo     对话关联仓库（自动创建/获取）
 */
import { Router } from 'express'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/async.js'
import { verifyJwt, type AuthedRequest } from '../middleware/auth.js'
import { gitObjects, gitCommits, gitRepos, pullRequests } from '../services/git.services.js'
import { z } from 'zod'

const router = Router()
router.use(verifyJwt)

function user(req: AuthedRequest) {
  if (!req.user) throw Object.assign(new Error('未登录'), { status: 401 })
  return req.user
}

// ══════════════════════════════════════════════
// 工具：获取仓库 + 权限校验
// ══════════════════════════════════════════════

async function ensureRepoAccess(repoId: number, userId: number, requirePermission: 'READ' | 'WRITE' | 'MAINTAINER' | 'OWNER' = 'READ') {
  const repo = await prisma.gitRepo.findUnique({ where: { id: repoId }, include: { owner: true } })
  if (!repo) throw Object.assign(new Error('仓库不存在'), { status: 404 })
  if (repo.visibility === 'PUBLIC' && requirePermission === 'READ') return { repo }
  const collab = await prisma.repoCollaborator.findFirst({ where: { repoId, userId } })
  const levels: Record<string, number> = { OWNER: 4, MAINTAINER: 3, WRITE: 2, TRIAGE: 1, READ: 0 }
  const myLevel = repo.ownerId === userId ? 4 : collab ? levels[collab.permission] ?? -1 : -1
  const need = levels[requirePermission]
  if (myLevel < need) throw Object.assign(new Error(`需要 ${requirePermission} 权限`), { status: 403 })
  return { repo, collab: collab ?? undefined, myLevel }
}

// ══════════════════════════════════════════════
// 对话 → 仓库（自动创建）
// ══════════════════════════════════════════════

router.post('/conversations/:convId/repo', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const convId = Number(req.params.convId)
  const conv = await prisma.conversation.findUnique({
    where: { id: convId },
    include: { config: true },
  })
  if (!conv) return res.status(404).json({ error: '对话不存在' })
  if (conv.config.userId !== u.id) return res.status(403).json({ error: '无权访问该对话' })
  // 有则返回，无则创建
  const exist = await prisma.gitRepo.findFirst({ where: { conversationId: convId } })
  if (exist) {
    return res.json({ repo: exist, created: false, defaultBranch: await prisma.gitBranch.findFirst({ where: { repoId: exist.id, isDefault: true } }) })
  }
  const result = await gitRepos.createRepo({
    name: `conv-${conv.deepseekConvId}`,
    ownerId: u.id,
    description: conv.title,
    conversationId: conv.id,
    author: { name: u.username, email: `${u.username}@dstoolkit.local`, userId: u.id },
  })
  return res.json({
    created: true,
    repo: result.repo,
    defaultBranch: result.defaultBranch,
    initCommitId: result.initCommit.id,
    initCommitSha: result.initCommit.sha256,
  })
}))

// ══════════════════════════════════════════════
// 仓库 CRUD
// ══════════════════════════════════════════════

router.get('/repos', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const { repos, total } = await gitRepos.listRepos({
    userId: u.id,
    ownerId: req.query.ownerId ? Number(req.query.ownerId) : undefined,
    visibility: req.query.visibility as any,
    search: String(req.query.search ?? ''),
    limit: Number(req.query.limit ?? 50),
    offset: Number(req.query.offset ?? 0),
  })
  return res.json({ repos, total })
}))

const createRepoSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  visibility: z.enum(['PRIVATE', 'INTERNAL', 'PUBLIC']).default('PRIVATE'),
  initialContent: z.array(z.object({ path: z.string(), content: z.string() })).optional(),
  conversationId: z.number().optional(),
})

router.post('/repos', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const body = createRepoSchema.parse(req.body)
  const result = await gitRepos.createRepo({
    ...body,
    ownerId: u.id,
    author: { name: u.username, email: `${u.username}@dstoolkit.local`, userId: u.id },
  })
  return res.status(201).json({
    repo: result.repo,
    defaultBranch: result.defaultBranch,
    initCommitId: result.initCommit.id,
    initCommitSha: result.initCommit.sha256,
  })
}))

router.get('/repos/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  const repo = await gitRepos.getRepo(id, u.id)
  if (!repo) return res.status(404).json({ error: '仓库不存在或无权访问' })
  return res.json({ repo })
}))

// ══════════════════════════════════════════════
// 分支
// ══════════════════════════════════════════════

router.get('/repos/:id/branches', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id)
  const branches = await gitRepos.listBranches(id)
  return res.json({ branches })
}))

const createBranchSchema = z.object({
  name: z.string().min(1).max(100),
  fromBranchName: z.string().optional(),
  fromCommitSha: z.string().optional(),
})

router.post('/repos/:id/branches', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const body = createBranchSchema.parse(req.body)
  const branch = await gitRepos.createBranch({ repoId: id, createdById: u.id, ...body })
  return res.status(201).json({ branch })
}))

router.delete('/repos/:id/branches/:name', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const force = req.query.force === 'true'
  await gitRepos.deleteBranch({ repoId: id, branchName: req.params.name, userId: u.id, force })
  return res.json({ ok: true })
}))

const protectBranchSchema = z.object({
  level: z.enum(['NONE', 'REVIEW', 'APPROVAL', 'LOCKED']),
  requiredApprovals: z.number().int().min(0).max(10).optional(),
  requireStatusChecks: z.boolean().optional(),
})

router.post('/repos/:id/branches/:name/protect', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'MAINTAINER')
  const body = protectBranchSchema.parse(req.body)
  const branch = await gitRepos.protectBranch({ repoId: id, branchName: req.params.name, ...body })
  return res.json({ branch })
}))

// ══════════════════════════════════════════════
// 标签
// ══════════════════════════════════════════════

router.get('/repos/:id/tags', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id)
  const tags = await gitRepos.listTags(id)
  return res.json({ tags })
}))

const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  targetCommitSha: z.string().optional(),
  annotated: z.boolean().optional(),
  message: z.string().optional(),
  semver: z.object({ major: z.number().int(), minor: z.number().int(), patch: z.number().int(), prerelease: z.string().optional() }).optional(),
})

router.post('/repos/:id/tags', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const body = createTagSchema.parse(req.body)
  const tag = await gitRepos.createTag({ repoId: id, taggerUserId: u.id, ...body })
  return res.status(201).json({ tag })
}))

router.delete('/repos/:id/tags/:name', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  await gitRepos.deleteTag(id, req.params.name, u.id)
  return res.json({ ok: true })
}))

// ══════════════════════════════════════════════
// 提交历史 / 详情
// ══════════════════════════════════════════════

router.get('/repos/:id/commits', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id)
  const { commits, total } = await gitCommits.getCommitHistory({
    repoId: id,
    branchName: req.query.branchName as string | undefined,
    branchId: req.query.branchId ? Number(req.query.branchId) : undefined,
    authorUserId: req.query.authorUserId ? Number(req.query.authorUserId) : undefined,
    grep: req.query.grep as string | undefined,
    changeType: req.query.changeType as string | undefined,
    limit: Number(req.query.limit ?? 50),
    offset: Number(req.query.offset ?? 0),
  })
  return res.json({ commits, total })
}))

router.get('/repos/:id/commits/:sha', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id)
  const data = await gitCommits.getCommit(id, req.params.sha)
  if (!data) return res.status(404).json({ error: 'commit不存在' })
  return res.json(data)
}))

// ══════════════════════════════════════════════
// 文件树 / 读文件 / 比较 / merge
// ══════════════════════════════════════════════

router.get('/repos/:id/tree/:ref', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id)
  const ref = decodeURIComponent(req.params.ref)
  let treeId: number | null = null
  // 1) 先看是不是分支名
  const branch = await prisma.gitBranch.findFirst({ where: { repoId: id, name: ref }, include: { headCommit: true } })
  if (branch?.headCommit) treeId = branch.headCommit.treeId
  // 2) 标签名
  if (!treeId) {
    const tag = await prisma.gitTag.findFirst({ where: { repoId: id, name: ref }, include: { commit: true } })
    if (tag?.commit) treeId = tag.commit.treeId
  }
  // 3) 直接是 commit sha
  if (!treeId) {
    const c = await prisma.gitCommit.findFirst({
      where: { repoId: id, sha256: ref.length === 64 ? ref : { startsWith: ref } },
    })
    if (c) treeId = c.treeId
  }
  if (!treeId) return res.status(404).json({ error: 'ref不存在' })
  const path = req.query.path as string | undefined
  if (path) {
    const file = await gitObjects.readFileFromTree(treeId, path)
    if (!file) return res.status(404).json({ error: '文件不存在' })
    return res.json({
      path,
      blob: {
        id: file.blob.id,
        sha: file.blob.sha256,
        sizeBytes: file.blob.sizeBytes,
        mimeType: file.blob.mimeType,
        encoding: file.blob.encoding,
        content: file.blob.content,
      },
      messageId: file.messageId,
    })
  }
  const files = await gitObjects.materializeTree(treeId)
  return res.json({ treeId, files })
}))

router.get('/repos/:id/compare', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id)
  const base = req.query.base as string
  const head = req.query.head as string
  if (!base || !head) return res.status(400).json({ error: '需要 base 和 head 参数' })
  async function refToTree(r: string): Promise<number> {
    const b = await prisma.gitBranch.findFirst({ where: { repoId: id, name: r }, include: { headCommit: true } })
    if (b?.headCommit) return b.headCommit.treeId
    const c = await prisma.gitCommit.findFirst({ where: { repoId: id, sha256: r.length === 64 ? r : { startsWith: r } } })
    if (c) return c.treeId
    throw Object.assign(new Error(`ref ${r} 不存在`), { status: 404 })
  }
  const [baseTree, headTree] = await Promise.all([refToTree(base), refToTree(head)])
  const diff = await gitObjects.diffTrees(baseTree, headTree)
  const unified = gitObjects.diffSummaryToUnified(diff)
  return res.json({ base, head, diff, unified })
}))

const mergeSchema = z.object({
  sourceBranchName: z.string(),
  targetBranchName: z.string(),
  strategy: z.enum(['MERGE_COMMIT', 'SQUASH', 'REBASE', 'FAST_FORWARD']).default('MERGE_COMMIT'),
  message: z.string().optional(),
})

router.post('/repos/:id/merge', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const body = mergeSchema.parse(req.body)
  const result = await gitRepos.merge({
    repoId: id,
    userId: u.id,
    author: { name: u.username, email: `${u.username}@dstoolkit.local`, userId: u.id },
    ...body,
  })
  return res.json(result)
}))

const cherryPickSchema = z.object({
  targetCommitSha: z.string(),
  branchId: z.number(),
  message: z.string().optional(),
})

router.post('/repos/:id/cherry-pick', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const body = cherryPickSchema.parse(req.body)
  const result = await gitCommits.cherryPick({
    repoId: id,
    targetCommitSha: body.targetCommitSha,
    branchId: body.branchId,
    author: { name: u.username, email: `${u.username}@dstoolkit.local`, userId: u.id },
    message: body.message,
  })
  return res.json(result)
}))

const revertSchema = z.object({
  targetCommitSha: z.string(),
  branchId: z.number(),
  message: z.string().optional(),
})

router.post('/repos/:id/revert', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const body = revertSchema.parse(req.body)
  const result = await gitCommits.revert({
    repoId: id,
    targetCommitSha: body.targetCommitSha,
    branchId: body.branchId,
    author: { name: u.username, email: `${u.username}@dstoolkit.local`, userId: u.id },
    message: body.message,
  })
  return res.json(result)
}))

const resetSchema = z.object({
  branchId: z.number(),
  targetSha: z.string(),
  mode: z.enum(['soft', 'mixed', 'hard']).default('mixed'),
})

router.post('/repos/:id/reset', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const body = resetSchema.parse(req.body)
  const r = await gitRepos.reset({ repoId: id, userId: u.id, ...body })
  return res.json(r)
}))

const stashSchema = z.object({
  branchId: z.number(),
  name: z.string().optional(),
  message: z.string().optional(),
  stagedEntries: z.array(z.any()),
  workingEntries: z.array(z.any()),
  untrackedEntries: z.array(z.any()).optional(),
})

router.post('/repos/:id/stash', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const body = stashSchema.parse(req.body)
  const stash = await gitRepos.stash({ repoId: id, userId: u.id, ...body })
  return res.json({ stash })
}))

router.post('/repos/:id/stash/pop', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const index = req.body.index != null ? Number(req.body.index) : undefined
  const result = await gitRepos.stashPop({ repoId: id, userId: u.id, index })
  return res.json(result)
}))

router.get('/repos/:id/reflog', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id)
  const entries = await gitRepos.getReflog({
    repoId: id,
    branchName: req.query.branchName as string | undefined,
    limit: Number(req.query.limit ?? 100),
  })
  return res.json({ entries })
}))

// ══════════════════════════════════════════════
// Pull Request
// ══════════════════════════════════════════════

router.get('/repos/:id/prs', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id)
  const { list, total } = await pullRequests.listPRs({
    repoId: id,
    status: (req.query.status as any) ?? undefined,
    authorId: req.query.authorId ? Number(req.query.authorId) : undefined,
    headBranchName: req.query.headBranchName as string | undefined,
    baseBranchName: req.query.baseBranchName as string | undefined,
    search: req.query.search as string | undefined,
    limit: Number(req.query.limit ?? 30),
    offset: Number(req.query.offset ?? 0),
    sort: (req.query.sort as any) ?? 'created',
  })
  return res.json({ list, total })
}))

const createPRSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(50000).optional(),
  headBranchName: z.string(),
  baseBranchName: z.string(),
  headRepoId: z.number().optional(),
  isDraft: z.boolean().optional(),
  mergeStrategy: z.enum(['MERGE_COMMIT', 'SQUASH', 'REBASE', 'FAST_FORWARD']).optional(),
})

router.post('/repos/:id/prs', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const body = createPRSchema.parse(req.body)
  const pr = await pullRequests.createPR({
    repoId: id,
    authorId: u.id,
    ...body,
  })
  return res.status(201).json({ pr })
}))

router.get('/repos/:id/prs/:number', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id)
  const number = Number(req.params.number)
  const pr = await pullRequests.getPR(id, number)
  if (!pr) return res.status(404).json({ error: 'PR不存在' })
  return res.json({ pr })
}))

const updatePRSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  isDraft: z.boolean().optional(),
  status: z.enum(['OPEN', 'DRAFT', 'REVIEWING', 'APPROVED', 'MERGED', 'REJECTED', 'CLOSED']).optional(),
  mergeStrategy: z.enum(['MERGE_COMMIT', 'SQUASH', 'REBASE', 'FAST_FORWARD']).optional(),
  baseBranchName: z.string().optional(),
  labels: z.array(z.string()).optional(),
})

router.patch('/repos/:id/prs/:number', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  const number = Number(req.params.number)
  const pr = await pullRequests.getPR(id, number)
  if (!pr) return res.status(404).json({ error: 'PR不存在' })
  // 作者或协作者WRITE以上可改
  if (pr.authorId !== u.id) await ensureRepoAccess(id, u.id, 'WRITE')
  const body = updatePRSchema.parse(req.body)
  const updated = await pullRequests.updatePR({ repoId: id, number, actorId: u.id, ...body })
  return res.json({ pr: updated })
}))

router.post('/repos/:id/prs/:number/close', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  const number = Number(req.params.number)
  const pr = await pullRequests.getPR(id, number)
  if (!pr) return res.status(404).json({ error: 'PR不存在' })
  if (pr.authorId !== u.id) await ensureRepoAccess(id, u.id, 'WRITE')
  const updated = await pullRequests.closePR({ repoId: id, number, actorId: u.id })
  return res.json({ pr: updated })
}))

router.post('/repos/:id/prs/:number/reopen', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  const number = Number(req.params.number)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const updated = await pullRequests.reopenPR({ repoId: id, number, actorId: u.id })
  return res.json({ pr: updated })
}))

router.post('/repos/:id/prs/:number/merge', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  const number = Number(req.params.number)
  await ensureRepoAccess(id, u.id, 'WRITE')
  const strategy = req.body.strategy
  const result = await pullRequests.mergePR({
    repoId: id,
    number,
    userId: u.id,
    author: { name: u.username, email: `${u.username}@dstoolkit.local`, userId: u.id },
    strategyOverride: strategy,
    mergeMessage: req.body.message,
  })
  return res.json(result)
}))

const reviewSchema = z.object({
  state: z.enum(['APPROVED', 'CHANGES_REQUESTED', 'COMMENTED']),
  body: z.string().optional(),
})

router.post('/repos/:id/prs/:number/reviews', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  const number = Number(req.params.number)
  await ensureRepoAccess(id, u.id, 'READ')
  const body = reviewSchema.parse(req.body)
  const review = await pullRequests.submitReview({ repoId: id, number, reviewerId: u.id, ...body })
  return res.status(201).json({ review })
}))

const commentSchema = z.object({
  body: z.string().min(1),
  isInline: z.boolean().optional(),
  filePath: z.string().optional(),
  oldLineNo: z.number().optional(),
  newLineNo: z.number().optional(),
  side: z.enum(['LEFT', 'RIGHT']).optional(),
  blobSha: z.string().optional(),
  lineContent: z.string().optional(),
  replyToId: z.number().optional(),
  threadId: z.number().optional(),
})

router.get('/repos/:id/prs/:number/comments', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  const number = Number(req.params.number)
  await ensureRepoAccess(id, u.id)
  const comments = await pullRequests.listComments({ repoId: id, number, filePath: req.query.filePath as string })
  return res.json({ comments })
}))

router.post('/repos/:id/prs/:number/comments', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  const number = Number(req.params.number)
  await ensureRepoAccess(id, u.id, 'READ')
  const body = commentSchema.parse(req.body)
  const comment = await pullRequests.addComment({ repoId: id, number, authorId: u.id, ...body })
  return res.status(201).json({ comment })
}))

router.post('/repos/:id/prs/:number/comments/:commentId/resolve', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  await ensureRepoAccess(id, u.id, 'READ')
  const commentId = Number(req.params.commentId)
  const c = await pullRequests.resolveComment({ commentId, resolverId: u.id })
  return res.json({ comment: c })
}))

router.get('/repos/:id/prs/:number/activities', asyncHandler(async (req: AuthedRequest, res) => {
  const u = user(req)
  const id = Number(req.params.id)
  const number = Number(req.params.number)
  await ensureRepoAccess(id, u.id)
  const activities = await pullRequests.listActivities(id, number)
  return res.json({ activities })
}))

export default router
