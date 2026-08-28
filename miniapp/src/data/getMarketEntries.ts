import type { MarketEntry } from '@/types'

const ENTRIES: MarketEntry[] = [
  {
    id: 1,
    name: 'Chronos 时间线',
    url: 'https://dstoolkit.cn/timeline',
    description: '按时间维度浏览你的所有对话，支持按日/周聚合。',
    category: 'official',
    iconId: 1,
    createdAt: '2026-01-01T00:00:00Z'
  },
  {
    id: 2,
    name: 'Alpaca 格式转换器',
    url: 'https://dstoolkit.cn/alpaca',
    description: '一键将 DeepSeek 对话导出为 Alpaca JSON 用于微调训练。',
    category: 'official',
    iconId: 6,
    createdAt: '2026-02-01T00:00:00Z'
  },
  {
    id: 3,
    name: '对话对比视图',
    url: 'https://dstoolkit.cn/compare',
    description: '左右分栏对比两次对话的回答差异，辅助 Prompt 迭代。',
    category: 'tool',
    iconId: 8,
    createdAt: '2026-03-01T00:00:00Z'
  },
  {
    id: 4,
    name: 'AI 整理助手',
    url: 'https://dstoolkit.cn/organize',
    description: '批量为历史对话打标签、建文件夹，清理知识库。',
    category: 'tool',
    iconId: 3,
    createdAt: '2026-04-01T00:00:00Z'
  },
  {
    id: 5,
    name: 'Markdown 导出',
    url: 'https://dstoolkit.cn/export',
    description: '将会话导出为结构清晰的 Markdown / PDF 文件。',
    category: 'tool',
    iconId: 201,
    createdAt: '2026-05-01T00:00:00Z'
  },
  {
    id: 6,
    name: '公开分享市场',
    url: 'https://dstoolkit.cn/market',
    description: '浏览其他用户分享的高质量对话，一键收藏到自己的库。',
    category: 'community',
    iconId: 160,
    createdAt: '2026-06-01T00:00:00Z'
  }
]

export default async function getMarketEntries(params: {
  category?: string
}): Promise<MarketEntry[]> {
  if (!params.category || params.category === 'all') {
    return ENTRIES
  }
  return ENTRIES.filter((e) => e.category === params.category)
}
