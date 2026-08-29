import { Router } from 'express'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/async.js'
import { verifyJwt, type AuthedRequest } from '../middleware/auth.js'

const router = Router()
router.use(verifyJwt)

function cnParts(d: Date) {
  const u = new Date(d.getTime() + 8 * 3600 * 1000)
  return { date: u.toISOString().slice(0, 10), hour: u.getUTCHours() }
}

// ═══════════ 热力词：周期映射 ═══════════
const PERIOD_DAYS: Record<string, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  'all': 365 * 10, // 10年视为全部
}

/**
 * 简单的中文/英文分词 + 停用词过滤
 * 说明：不引入重型分词库，使用基础规则即可满足热力词分析
 */
const STOP_WORDS = new Set([
  // 中文常用停用词
  '的', '了', '和', '是', '就', '都', '而', '及', '与', '在', '也', '为', '这',
  '那', '有', '我', '你', '他', '她', '它', '们', '个', '上', '下', '不', '吗',
  '吧', '呢', '啊', '哦', '嗯', '哈', '什么', '怎么', '这个', '那个', '可以',
  '一下', '一个', '一些', '如何', '是否', '因为', '所以', '但是', '如果', '或者',
  '已经', '进行', '通过', '需要', '使用', '实现', '问题', '方法', '方式', '时候',
  // 英文停用词
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'of', 'at', 'by', 'for', 'with', 'about', 'to', 'from', 'in', 'on',
  'this', 'that', 'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
  'what', 'which', 'who', 'whom', 'how', 'when', 'where', 'why', 'can', 'could',
  'should', 'would', 'may', 'might', 'shall', 'will', 'do', 'does', 'did', 'have',
  'has', 'had', 'not', 'no', 'nor', 'if', 'then', 'else', 'so', 'than', 'too',
  'very', 'just', 'also', 'now', 'here', 'there', 'as', 'into', 'more', 'some',
  'such', 'only', 'own', 'same', 'than', 'too', 'very',
])

function extractKeywords(text: string): string[] {
  if (!text) return []
  const raw: string[] = []
  // 1. 中文连续汉字（2~10字，过滤单字停用词）
  const cnMatches = text.match(/[\u4e00-\u9fa5]{2,10}/g)
  if (cnMatches) raw.push(...cnMatches)
  // 2. 英文单词（>=3 字母）
  const enMatches = text.match(/[A-Za-z][A-Za-z0-9_-]{2,}/g)
  if (enMatches) raw.push(...enMatches.map((w) => w.toLowerCase()))
  // 3. 代码相关（驼峰保留、短横线保留原大小写）
  return raw.filter((w) => !STOP_WORDS.has(w.toLowerCase()) && w.length >= 2)
}

/**
 * 计算趋势状态：
 *  up     → 当前周期频率显著高于上一周期（>=25% 增量）
 *  down   → 当前周期频率显著低于上一周期（>=25% 减量）
 *  stable → 平稳
 *  new    → 上一周期为 0
 */
function computeTrend(cur: number, prev: number): 'up' | 'down' | 'stable' | 'new' {
  if (prev === 0) return cur > 0 ? 'new' : 'stable'
  const ratio = (cur - prev) / prev
  if (ratio >= 0.25) return 'up'
  if (ratio <= -0.25) return 'down'
  return 'stable'
}

router.get('/', asyncHandler(async (req: AuthedRequest, res) => {
  const configId = req.query.configId ? Number(req.query.configId) : undefined
  const convWhere: any = configId
    ? { configId, repo: { userId: req.user!.id } }
    : { repo: { userId: req.user!.id } }

  const convs = await prisma.conversation.findMany({
    where: convWhere,
    select: { insertedAt: true },
    take: 10000,
  })
  const msgs = await prisma.message.findMany({
    where: { conversation: convWhere },
    select: { insertedAt: true, role: true, model: true },
    take: 100000,
  })

  const dailyConv = new Map<string, number>()
  for (const c of convs) {
    const k = cnParts(c.insertedAt).date
    dailyConv.set(k, (dailyConv.get(k) || 0) + 1)
  }
  const dailyMsg = new Map<string, { date: string; user: number; assistant: number }>()
  for (const m of msgs) {
    const k = cnParts(m.insertedAt).date
    const cur = dailyMsg.get(k) || { date: k, user: 0, assistant: 0 }
    if (m.role === 'USER') cur.user++
    else cur.assistant++
    dailyMsg.set(k, cur)
  }
  const modelDist = new Map<string, number>()
  for (const m of msgs) {
    if (m.model) modelDist.set(m.model, (modelDist.get(m.model) || 0) + 1)
  }
  const hours = new Array(24).fill(0)
  for (const m of msgs) hours[cnParts(m.insertedAt).hour]++

  return res.json({
    totalConversations: convs.length,
    totalMessages: msgs.length,
    dailyConversations: Array.from(dailyConv.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    dailyMessages: Array.from(dailyMsg.values()).sort((a, b) => a.date.localeCompare(b.date)),
    modelDistribution: Array.from(modelDist.entries()).map(([model, count]) => ({ model, count })),
    activeHours: hours.map((count, hour) => ({ hour, count })),
  })
}))

// GET /api/stats/hotwords?period=7d&limit=50
// 返回聚合热力词：结合搜索历史 + 对话标题 + 摘要标签
router.get('/hotwords', asyncHandler(async (req: AuthedRequest, res) => {
  const period = String(req.query.period || '30d')
  const days = PERIOD_DAYS[period] ?? PERIOD_DAYS['30d']
  const limit = Math.min(Number(req.query.limit) || 50, 100)
  const now = new Date()
  const curStart = new Date(now.getTime() - days * 86400 * 1000)
  const prevStart = new Date(curStart.getTime() - days * 86400 * 1000)

  const userId = req.user!.id
  const convWhere: any = { repo: { userId } }

  // ═══ 数据源1：搜索记录（SearchQuery）═══
  const [curSearchGroup, prevSearchGroup] = await Promise.all([
    prisma.searchQuery.groupBy({
      by: ['query'],
      where: { userId, createdAt: { gte: curStart } },
      _count: { _all: true },
      take: 200,
      orderBy: { _count: { query: 'desc' } },
    }),
    prisma.searchQuery.groupBy({
      by: ['query'],
      where: { userId, createdAt: { gte: prevStart, lt: curStart } },
      _count: { _all: true },
      take: 200,
      orderBy: { _count: { query: 'desc' } },
    }),
  ])

  // ═══ 数据源2：对话标题关键词（当前周期）═══
  const recentConvs = await prisma.conversation.findMany({
    where: { ...convWhere, insertedAt: { gte: curStart } },
    select: { title: true, insertedAt: true },
    take: 2000,
    orderBy: { insertedAt: 'desc' },
  })

  // ═══ 数据源3：AI 摘要的 tags（高质量主题标签）═══
  const summaryTags = await prisma.convSummary.findMany({
    where: { userId, createdAt: { gte: curStart } },
    select: { tags: true, createdAt: true },
    take: 1000,
  })

  // 上一周期对话标题（用于趋势对比）
  const prevConvs = await prisma.conversation.findMany({
    where: { ...convWhere, insertedAt: { gte: prevStart, lt: curStart } },
    select: { title: true },
    take: 2000,
  })

  // ═══════════ 聚合：当前周期 ═══════════
  const curCounter = new Map<string, number>()
  // 权重：搜索词 x3（代表用户主动关注）、摘要标签 x2（AI 提炼的高价值）、标题关键词 x1
  for (const s of curSearchGroup) {
    const kws = extractKeywords(s.query)
    for (const kw of kws) {
      curCounter.set(kw, (curCounter.get(kw) || 0) + s._count._all * 3)
    }
    // 完整搜索词也计入（短词时尤其有用）
    const q = s.query.trim()
    if (q.length >= 2) {
      curCounter.set(q, (curCounter.get(q) || 0) + s._count._all * 2)
    }
  }
  for (const c of recentConvs) {
    for (const kw of extractKeywords(c.title || '')) {
      curCounter.set(kw, (curCounter.get(kw) || 0) + 1)
    }
  }
  for (const s of summaryTags) {
    const tags = Array.isArray(s.tags) ? (s.tags as any[]) : []
    for (const t of tags) {
      const tag = String(t).trim()
      if (tag.length >= 2) {
        curCounter.set(tag, (curCounter.get(tag) || 0) + 2)
        // 标签内部的关键词也提取
        for (const kw of extractKeywords(tag)) {
          if (kw !== tag) curCounter.set(kw, (curCounter.get(kw) || 0) + 1)
        }
      }
    }
  }

  // ═══════════ 聚合：上一周期（只用于趋势）═══════════
  const prevCounter = new Map<string, number>()
  const prevSearchMap = new Map(prevSearchGroup.map((s) => [s.query.toLowerCase(), s._count._all]))
  for (const [q, cnt] of prevSearchMap) {
    for (const kw of extractKeywords(q)) {
      prevCounter.set(kw, (prevCounter.get(kw) || 0) + cnt * 3)
    }
    const qq = q.trim()
    if (qq.length >= 2) prevCounter.set(qq, (prevCounter.get(qq) || 0) + cnt * 2)
  }
  for (const c of prevConvs) {
    for (const kw of extractKeywords(c.title || '')) {
      prevCounter.set(kw, (prevCounter.get(kw) || 0) + 1)
    }
  }

  // ═══════════ 排序 + 归一化 + 输出 ═══════════
  type HotWord = {
    word: string
    weight: number
    count: number
    sources: string[]
    trend: 'up' | 'down' | 'stable' | 'new'
    trendDelta: number
  }
  const words: HotWord[] = []
  for (const [word, w] of curCounter.entries()) {
    const prev = prevCounter.get(word) || 0
    // 判断来源
    const sources: string[] = []
    const wLower = word.toLowerCase()
    if (curSearchGroup.some((s) => s.query.toLowerCase().includes(wLower))) sources.push('search')
    if (recentConvs.some((c) => (c.title || '').toLowerCase().includes(wLower))) sources.push('title')
    if (summaryTags.some((s) =>
      (Array.isArray(s.tags) ? s.tags as any[] : []).some((t: any) =>
        String(t).toLowerCase().includes(wLower),
      ),
    )) sources.push('summary')
    words.push({
      word,
      weight: w,
      count: Math.ceil(w / 3), // 近似出现次数（用于展示）
      sources,
      trend: computeTrend(w, prev),
      trendDelta: w - prev,
    })
  }
  words.sort((a, b) => b.weight - a.weight)
  const top = words.slice(0, limit)

  // 归一化 weight 到 score 0-100，便于前端渲染大小
  const maxW = top.length ? top[0].weight : 0
  const minW = top.length ? top[top.length - 1].weight : 0
  const range = maxW - minW || 1
  const hotwords = top.map((w) => ({
    ...w,
    score: maxW === minW ? 60 : Math.round(30 + ((w.weight - minW) / range) * 70),
  }))

  // 总体统计
  const totalSearchQueries = curSearchGroup.reduce((s, x) => s + x._count._all, 0)
  const totalConvs = recentConvs.length
  const uniqueKeywords = hotwords.length

  return res.json({
    period,
    updatedAt: now.toISOString(),
    summary: { totalSearchQueries, totalConversations: totalConvs, uniqueKeywords },
    hotwords,
  })
}))

export default router
