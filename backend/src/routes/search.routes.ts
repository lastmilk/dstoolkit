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

// GET /api/search/suggest?q=  搜索联想（基于用户对话标题 + 历史搜索）
router.get('/suggest', asyncHandler(async (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim()
  const limit = Math.min(Number(req.query.limit) || 8, 20)

  const suggestions: { text: string; type: string }[] = []

  if (q) {
    // 1. 匹配对话标题前缀/包含
    const convs = await prisma.conversation.findMany({
      where: {
        title: { contains: q },
        config: { userId: req.user!.id },
      },
      select: { title: true },
      distinct: ['title'],
      take: limit,
      orderBy: { insertedAt: 'desc' },
    })
    for (const c of convs) {
      suggestions.push({ text: c.title, type: 'conversation' })
    }
  }

  // 2. 用户最近搜索词
  const recent = await prisma.searchQuery.findMany({
    where: q ? { userId: req.user!.id, query: { contains: q } } : { userId: req.user!.id },
    select: { query: true },
    distinct: ['query'],
    take: limit,
    orderBy: { createdAt: 'desc' },
  })
  for (const r of recent) {
    if (!suggestions.find((s) => s.text === r.query)) {
      suggestions.push({ text: r.query, type: 'history' })
    }
  }

  // 3. 无输入时返回热门搜索词（近 30 天） + AI 摘要标签高频词
  if (!q) {
    const userId = req.user!.id
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000)
    const seen = new Set(suggestions.map((s) => s.text))

    // 3a. 热门搜索（近30天加权）
    const popular = await prisma.searchQuery.groupBy({
      by: ['query'],
      where: { userId, createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
      orderBy: { _count: { query: 'desc' } },
      take: limit,
    })
    for (const p of popular) {
      if (!seen.has(p.query)) {
        suggestions.push({ text: p.query, type: 'popular' })
        seen.add(p.query)
      }
    }

    // 3b. AI 摘要高频标签（作为补充的推荐热词）
    if (suggestions.length < limit) {
      const tagRows = await prisma.convSummary.findMany({
        where: { userId, createdAt: { gte: thirtyDaysAgo } },
        select: { tags: true },
        take: 500,
        orderBy: { createdAt: 'desc' },
      })
      const tagCount = new Map<string, number>()
      for (const row of tagRows) {
        const tags = Array.isArray(row.tags) ? (row.tags as any[]) : []
        for (const t of tags) {
          const s = String(t).trim()
          if (s.length >= 2) tagCount.set(s, (tagCount.get(s) || 0) + 1)
        }
      }
      const topTags = Array.from(tagCount.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, limit)
      for (const [tag] of topTags) {
        if (!seen.has(tag)) {
          suggestions.push({ text: tag, type: 'trending' })
          seen.add(tag)
        }
      }

      // 3c. 近 30 天对话标题关键词作为兜底
      if (suggestions.length < limit) {
        const titleRows = await prisma.conversation.findMany({
          where: { config: { userId }, insertedAt: { gte: thirtyDaysAgo } },
          select: { title: true },
          take: 500,
          orderBy: { insertedAt: 'desc' },
        })
        // 简单中文/英文热词提取（2~8字连续）
        const counter = new Map<string, number>()
        for (const r of titleRows) {
          const matches = (r.title || '').match(/[\u4e00-\u9fa5]{2,8}|[A-Za-z][A-Za-z0-9_-]{2,}/g)
          if (!matches) continue
          for (const m of matches) {
            counter.set(m, (counter.get(m) || 0) + 1)
          }
        }
        const topTitles = Array.from(counter.entries())
          .filter(([k, v]) => v >= 2 && k.length >= 2)
          .sort((a, b) => b[1] - a[1])
          .slice(0, limit)
        for (const [kw] of topTitles) {
          if (!seen.has(kw)) {
            suggestions.push({ text: kw, type: 'topic' })
            seen.add(kw)
          }
        }
      }
    }
  }

  res.json({ suggestions: suggestions.slice(0, limit) })
}))

// GET /api/search/hotwords?limit=30
// 轻量级热力词接口：Explore 页面搜索框下的快速热词云（近 30 天）
router.get('/hotwords', asyncHandler(async (req: AuthedRequest, res) => {
  const userId = req.user!.id
  const limit = Math.min(Number(req.query.limit) || 30, 60)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400 * 1000)
  const counter = new Map<string, { weight: number; type: string }>()

  // 1. 搜索记录（权重 x3）
  const searchGroup = await prisma.searchQuery.groupBy({
    by: ['query'],
    where: { userId, createdAt: { gte: thirtyDaysAgo } },
    _count: { _all: true },
    orderBy: { _count: { query: 'desc' } },
    take: 100,
  })
  for (const s of searchGroup) {
    const q = s.query.trim()
    if (!q) continue
    const cur = counter.get(q) || { weight: 0, type: 'search' }
    cur.weight += s._count._all * 3
    counter.set(q, cur)
  }

  // 2. 摘要标签（权重 x2）
  const summaries = await prisma.convSummary.findMany({
    where: { userId, createdAt: { gte: thirtyDaysAgo } },
    select: { tags: true },
    take: 500,
  })
  for (const sum of summaries) {
    const tags = Array.isArray(sum.tags) ? (sum.tags as any[]) : []
    for (const t of tags) {
      const s = String(t).trim()
      if (s.length < 2) continue
      const cur = counter.get(s) || { weight: 0, type: 'tag' }
      cur.weight += 2
      if (cur.weight >= 2 && cur.type !== 'search') cur.type = 'tag'
      counter.set(s, cur)
    }
  }

  // 3. 对话标题关键词（权重 x1）
  const convs = await prisma.conversation.findMany({
    where: { config: { userId }, insertedAt: { gte: thirtyDaysAgo } },
    select: { title: true },
    take: 1000,
  })
  for (const c of convs) {
    const matches = (c.title || '').match(/[\u4e00-\u9fa5]{2,8}|[A-Za-z][A-Za-z0-9_-]{2,}/g)
    if (!matches) continue
    for (const m of matches) {
      const cur = counter.get(m) || { weight: 0, type: 'title' }
      cur.weight += 1
      if (cur.type === 'title' && cur.weight >= 2) cur.type = 'title'
      counter.set(m, cur)
    }
  }

  // 排序 + 归一化
  const list = Array.from(counter.entries())
    .map(([word, v]) => ({ word, weight: v.weight, type: v.type }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, limit)
  const max = list[0]?.weight || 1
  const min = list[list.length - 1]?.weight || 0
  const range = max - min || 1
  const hotwords = list.map((w) => ({
    word: w.word,
    type: w.type,
    count: w.weight,
    score: max === min ? 60 : Math.round(30 + ((w.weight - min) / range) * 70),
  }))

  res.json({ hotwords, total: hotwords.length })
}))

// AI 过滤器预设（根据用户对话内容自动分类）
const AI_FILTERS = [
  { id: 'code', label: '只看代码相关', keywords: ['code', '代码', 'function', '函数', 'bug', 'error', '报错', '编程', 'React', 'Vue', 'Python', 'TypeScript', 'Java'] },
  { id: 'work', label: '只看工作项目', keywords: ['项目', '工作', '需求', '方案', '会议', '周报', '文档'] },
  { id: 'learning', label: '只看学习笔记', keywords: ['学习', '教程', '笔记', '面试', '算法', '知识点', '复习'] },
  { id: 'recent', label: '近 30 天高价值', keywords: [] }, // 特殊：按时间 + 摘要置信度
]

router.get('/filters', asyncHandler(async (_req: AuthedRequest, res) => {
  res.json({ filters: AI_FILTERS })
}))

// GET /api/search?q=&configId=&limit=  云端搜索（cloud_v1 + SQL fallback）
router.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim()
  if (!q) return res.status(400).json({ error: '缺少搜索词' })
  const configId = req.query.configId ? Number(req.query.configId) : undefined
  const limit = req.query.limit ? Math.min(Number(req.query.limit), 200) : 50

  // 记录搜索行为（异步，不阻塞响应）
  prisma.searchQuery.create({
    data: { userId: req.user!.id, query: q },
  }).catch(() => {})

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
