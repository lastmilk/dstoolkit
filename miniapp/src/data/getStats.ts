import type { StatsData } from '@/types'
import { lastNDays } from '@/utils/date'

export default async function getStats(params: {
  range?: '7d' | '30d' | 'all'
}): Promise<StatsData> {
  const days = params.range === '7d' ? 7 : params.range === 'all' ? 90 : 30
  const dates = lastNDays(days)
  const trend = dates.map((d, i) => ({
    date: d,
    conversations: 2 + ((i * 3) % 12),
    messages: 20 + ((i * 17) % 120)
  }))

  return {
    totalConversations: 328,
    totalMessages: 5842,
    totalTokens: 2_480_000,
    activeDays: 64,
    trend,
    hotWords: [
      { word: 'React', count: 38 },
      { word: 'TypeScript', count: 31 },
      { word: '性能优化', count: 24 },
      { word: 'Node.js', count: 19 },
      { word: 'LLM', count: 16 },
      { word: '架构', count: 14 },
      { word: 'Docker', count: 11 },
      { word: '数据库', count: 9 }
    ],
    tierDistribution: [
      { tier: 'FREE', count: 1 },
      { tier: 'PRO', count: 58 },
      { tier: 'PLUS', count: 35 },
      { tier: 'ULTIMATE', count: 6 }
    ]
  }
}
