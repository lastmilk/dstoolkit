import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { search } from '../services/meilisearch.js'
import { prisma } from '../utils/prisma.js'
import { env } from '../config/env.js'
import { verifyJwt, type AuthedRequest } from '../middleware/auth.js'
import { asyncHandler } from '../utils/async.js'

const router = Router()

// 每用户每分钟 30 次搜索，超限返回 429
const searchLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute per user
  keyGenerator: (req) => String((req as AuthedRequest).user?.id || req.ip),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: '搜索请求过于频繁，请稍后再试（每分钟限 30 次）' },
})

router.use(verifyJwt, searchLimiter)

// SQL LIKE fallback: when Meilisearch is disabled, search directly in the database.
// Returns results in the same format as Meilisearch's MeiliSearchResult.
async function sqlFallbackSearch(
  userId: number,
  q: string,
  limit: number,
  configId?: number,
) {
  const convWhere: any = { config: { userId } }
  if (configId) convWhere.configId = configId

  // Search messages (USER + ASSISTANT content)
  const messages = await prisma.message.findMany({
    where: {
      content: { contains: q },
      conversation: convWhere,
    },
    include: {
      conversation: {
        select: { deepseekConvId: true, title: true, configId: true },
      },
    },
    orderBy: { insertedAt: 'desc' },
    take: limit,
  })

  // Search conversation titles
  const titleConvs = await prisma.conversation.findMany({
    where: { title: { contains: q }, ...convWhere },
    select: {
      deepseekConvId: true,
      title: true,
      configId: true,
      messages: {
        select: { nodeId: true, turnIndex: true, versionIndex: true, subTurnIndex: true },
        take: 1,
      },
    },
    take: limit,
  })

  const results = [
    ...messages.map((m) => ({
      convId: m.conversation.deepseekConvId,
      nodeId: m.nodeId,
      title: m.conversation.title,
      content: m.content,
      role: m.role,
      turnIndex: m.turnIndex,
      versionIndex: m.versionIndex,
      subTurnIndex: m.subTurnIndex,
    })),
    ...titleConvs.map((c) => ({
      convId: c.deepseekConvId,
      nodeId: c.messages[0]?.nodeId ?? `title:${c.deepseekConvId}`,
      title: c.title,
      content: c.title,
      role: 'TITLE',
      turnIndex: null,
      versionIndex: null,
      subTurnIndex: null,
    })),
  ]
  return results.slice(0, limit)
}

// GET /api/search?q=&configId=&limit=  云端搜索（cloud_v1 + SQL fallback）
router.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim()
  if (!q) return res.status(400).json({ error: '缺少搜索词' })
  const configId = req.query.configId ? Number(req.query.configId) : undefined
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50

  // Try Meilisearch first if enabled
  if (env.meiliEnabled) {
    const { results } = await search(req.user!.id, q, { limit, configId })
    if (results.length > 0) return res.json({ q, count: results.length, results })
  }

  // SQL LIKE fallback (always run when Meili disabled, or when Meili returned 0)
  const results = await sqlFallbackSearch(req.user!.id, q, limit, configId)
  return res.json({ q, count: results.length, results })
}))

export default router
