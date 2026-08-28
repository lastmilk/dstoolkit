import type { Conversation, PageResponse } from '@/types'

const TITLES = [
  'React 性能优化完整指南',
  'TypeScript 类型体操实战',
  '如何设计高可用微服务架构',
  '深度学习入门：从线性回归到 Transformer',
  'Node.js 异步编程最佳实践',
  'Vue3 Composition API 深度解析',
  'Rust 内存安全机制详解',
  'Kubernetes 生产环境部署实践',
  'WebAssembly 性能测试与对比',
  'GraphQL vs REST：如何选择 API 架构',
  'Docker 容器化部署完整流程',
  'Redis 缓存设计与一致性方案',
  '大语言模型 RAG 系统搭建',
  'CSS Grid 与 Flexbox 布局对比',
  'Next.js App Router 迁移经验'
]

const convs: Conversation[] = TITLES.map((t, i) => ({
  id: i + 1,
  configId: 1,
  deepseekConvId: 'conv_' + (1000 + i),
  title: t,
  insertedAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
  updatedAt: new Date(Date.now() - i * 86400000 * 2 + 3600000).toISOString(),
  turnCount: 8 + ((i * 7) % 40),
  summaryTldr:
    i % 3 === 0
      ? '涵盖核心原理、实战案例与常见坑点，结构化整理为 5 条最佳实践。'
      : undefined,
  summaryTags:
    i % 2 === 0
      ? ['架构', '性能']
      : i % 3 === 0
        ? ['AI', '模型']
        : ['前端', '工程化']
}))

export default async function getConversations(params: {
  page?: number
  pageSize?: number
  keyword?: string
}): Promise<PageResponse<Conversation>> {
  const page = params.page ?? 1
  const pageSize = params.pageSize ?? 10
  const kw = params.keyword?.trim().toLowerCase() || ''
  const filtered = kw
    ? convs.filter((c) => c.title.toLowerCase().includes(kw))
    : convs
  const start = (page - 1) * pageSize
  return {
    records: filtered.slice(start, start + pageSize),
    total: filtered.length,
    page,
    pageSize
  }
}
