import type {
  Conversation,
  Message,
  ConvSummary,
  KnowledgeCard
} from '@/types'

export interface DetailResponse {
  conversation: Conversation
  messages: Message[]
  summary: ConvSummary | null
  knowledgeCards: KnowledgeCard[]
}

export default async function getConversationDetail(params: {
  conversationId?: number
}): Promise<DetailResponse> {
  const id = params.conversationId ?? 1
  const conversation: Conversation = {
    id,
    configId: 1,
    deepseekConvId: 'conv_' + (1000 + id),
    title: 'React 性能优化完整指南',
    insertedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    turnCount: 24,
    summaryTldr:
      '从渲染原理出发，结合 memo/useMemo/useCallback 与代码分割，给出完整的性能优化清单。',
    summaryTags: ['React', '性能', '前端']
  }

  const messages: Message[] = [
    {
      id: 1,
      conversationId: id,
      nodeId: 'n1',
      role: 'USER',
      content:
        '我的 React 列表渲染很慢，尤其是 1000 条以上的数据，有什么优化方案？',
      insertedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      turnIndex: 0
    },
    {
      id: 2,
      conversationId: id,
      nodeId: 'n2',
      parentId: 'n1',
      role: 'ASSISTANT',
      model: 'deepseek-chat',
      content: `## 核心优化思路

首先排查**渲染次数过多**与**单条渲染成本**：

\`\`\`tsx
// ❌ 不要在 render 中创建新对象/函数
<List items={items} renderItem={(i) => <Row item={i} />} />

// ✅ 抽离 renderItem，配合 memo
const Row = React.memo(({ item }) => <div>{item.name}</div>)
\`\`\`

### 1. 虚拟列表（必做）
1000+ 条必须用虚拟滚动，推荐 \`react-window\` 或 \`@tanstack/react-virtual\`。

### 2. 合理拆分 memo
- 列表项包 \`React.memo\`
- props 使用稳定引用（useMemo/useCallback）

### 3. 延迟加载与分页
结合 IntersectionObserver 实现无限滚动。
`,
      insertedAt: new Date(Date.now() - 86400000 * 3 + 30000).toISOString(),
      turnIndex: 0
    },
    {
      id: 3,
      conversationId: id,
      nodeId: 'n3',
      parentId: 'n2',
      role: 'USER',
      content:
        '那 useMemo 和 useCallback 的区别是什么？什么时候该用哪个？',
      insertedAt: new Date(Date.now() - 86400000 * 3 + 60000).toISOString(),
      turnIndex: 1
    },
    {
      id: 4,
      conversationId: id,
      nodeId: 'n4',
      parentId: 'n3',
      role: 'ASSISTANT',
      model: 'deepseek-chat',
      content: `**一句话总结**：\`useMemo\` 缓存**值**，\`useCallback\` 缓存**函数引用**。

> 本质上 \`useCallback(fn, deps)\` = \`useMemo(() => fn, deps)\`

### 使用场景对比
| 场景 | 推荐 |
|------|------|
| 传给子组件的函数 props | useCallback |
| 计算量大的派生数据（过滤/排序/聚合） | useMemo |
| 作为 useEffect 的依赖 | 两者皆可，按类型选 |

### 反模式
- ❌ 所有函数都套 useCallback（反而增加开销）
- ❌ deps 写 [] 但函数内部用到了会变的变量
`,
      insertedAt: new Date(Date.now() - 86400000 * 3 + 90000).toISOString(),
      turnIndex: 1
    }
  ]

  const summary: ConvSummary = {
    id: id,
    conversationId: id,
    userId: 1,
    tldr:
      '围绕 React 列表性能问题，系统梳理了虚拟列表、memo、useMemo/useCallback 三大核心优化手段，并附代码示例与常见反模式。',
    summary:
      '本次对话从实际的慢列表问题切入，分三层展开：(1) 诊断工具与定位思路；(2) 虚拟滚动的实现与选型；(3) 细粒度 memo 优化，包括 useMemo 与 useCallback 的区别、反模式。整体形成了可落地的性能优化 checklist。',
    tags: ['React', '性能优化', '虚拟列表', 'Memo'],
    confidence: 0.92,
    model: 'deepseek-chat',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
  }

  const knowledgeCards: KnowledgeCard[] = [
    {
      id: 1,
      conversationId: id,
      title: '虚拟列表选型对比',
      content:
        'react-window：轻量、API 简单，适合标准列表；@tanstack/react-virtual：功能更强，支持动态高度和横向滚动；自实现：万条以上自定义场景。',
      category: '前端',
      tags: ['React', '性能'],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: 2,
      conversationId: id,
      title: 'useMemo vs useCallback 速记',
      content:
        'useMemo → 缓存值；useCallback → 缓存函数引用。两者都依赖 deps 数组，依赖频繁变化的情况下反而有额外开销。',
      category: 'React',
      tags: ['Hooks', '性能'],
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString()
    }
  ]

  return { conversation, messages, summary, knowledgeCards }
}
