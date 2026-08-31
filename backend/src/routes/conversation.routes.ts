import { Router } from 'express'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/async.js'
import { verifyJwt, type AuthedRequest } from '../middleware/auth.js'

const router = Router()
router.use(verifyJwt)

// GET /api/conversations?configId=&q=  服务端搜索（cloud=true 时可用）
router.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const configId = req.query.configId ? Number(req.query.configId) : undefined
  const q = String(req.query.q || '').trim()
  const where: any = {}
  if (configId) {
    const config = await prisma.deepseekConfig.findFirst({ where: { id: configId, userId: req.user!.id } })
    if (!config) return res.status(404).json({ error: '配置不存在' })
    where.configId = configId
  } else {
    where.config = { userId: req.user!.id }
  }
  if (q) {
    where.OR = [
      { title: { contains: q } },
      { messages: { some: { content: { contains: q } } } },
    ]
  }
  const conversations = await prisma.conversation.findMany({
    where,
    select: {
      id: true,
      deepseekConvId: true,
      title: true,
      insertedAt: true,
      updatedAt: true,
      _count: { select: { messages: true } },
      gitRepo: { select: { id: true, name: true, visibility: true, defaultBranch: true, commitCount: true } },
    },
    orderBy: { insertedAt: 'desc' },
    take: 200,
  })
  return res.json({ conversations })
}))

// GET /api/conversations/:id/git-repo  查询某个对话绑定的 Git 仓库
router.get('/:id/git-repo', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const conv = await prisma.conversation.findFirst({
    where: { id, config: { userId: req.user!.id } },
    select: {
      id: true,
      deepseekConvId: true,
      title: true,
      gitRepo: {
        include: {
          owner: { select: { id: true, username: true } },
          branches: { orderBy: { isDefault: 'desc' }, take: 20 },
          _count: { select: { commits: true, branches: true, tags: true, pullRequests: true, collaborators: true } },
        },
      },
    },
  })
  if (!conv) return res.status(404).json({ error: '会话不存在' })
  return res.json({ conversation: conv, repo: conv.gitRepo })
}))

// POST /api/conversations/:id/git-repo/init  为对话手动初始化 Git 仓库（之前没创建过的场景）
router.post('/:id/git-repo/init', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const userId = req.user!.id
  const conv = await prisma.conversation.findFirst({
    where: { id, config: { userId } },
    select: { id: true, deepseekConvId: true, title: true },
  })
  if (!conv) return res.status(404).json({ error: '会话不存在' })

  const existing = await prisma.gitRepo.findFirst({ where: { conversationId: conv.id } })
  if (existing) {
    return res.json({ repoId: existing.id, existed: true })
  }

  // 避免循环依赖：通过动态 import 调用 gitConversationHooks
  const { gitConversationHooks } = await import('../services/gitConversationHook.service.js')
  await gitConversationHooks.afterConversationUpserted(userId, conv.id)

  const repo = await prisma.gitRepo.findFirst({
    where: { conversationId: conv.id },
    select: { id: true, name: true },
  })
  return res.json({ repoId: repo?.id ?? null, existed: false })
}))

export default router
