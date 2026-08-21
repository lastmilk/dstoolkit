# 搜索修复 + 筛选 + 全真模拟对话渲染

## Summary

修复搜索 bug（云端模式下关键词搜索返回空结果）、增加搜索范围筛选（用户消息/AI回复/标题）、将信息渲染重构为全真模拟 AI 对话界面（支持续聊、改上下文、流式输出）。

## Current State Analysis

### 搜索 Bug 根因

`db.ts` 的 `searchConversations` 关键词搜索路径（非正则）在第 348-349 行：
```ts
// Keyword search via persisted FlexSearch index.
if (!deepseekUserId) return []
```

在云端模式（`cloudSyncEnabled=true`）下，`Explore.vue` 的 `init()` 仅在 `!auth.cloudSyncEnabled` 时设置 `localUserId.value`。因此云端模式下 `localUserId.value` 始终为 `undefined`，导致 `searchConversations(q, false, 200, undefined, conversations.value)` 在第 349 行直接返回空数组。

即使切换到 `local_v1` 搜索模型，云端模式也找不到 FlexSearch 索引（索引只在本地的 IndexedDB 中构建）。

### 当前渲染方式

`Explore.vue` 用 `NDrawer` 显示对话，每条消息用 `MarkdownView` 渲染。无续聊能力，无流式输出。

### API Key 与 Deepseek API

- API Key 加密存储在 MySQL `ApiKey` 表（`keyCipher` 字段，AES 加密）
- 后端 `deepseekApi.ts` 已有 `getDeepseekBalance` 调用 Deepseek API 的模式
- `env.deepseekApiBase` = `https://api.deepseek.com`
- Deepseek API 兼容 OpenAI 格式：`POST /chat/completions`，支持 `stream: true`（SSE）

## Proposed Changes

### 1. 修复搜索：用 includes() 替代 FlexSearch 关键词搜索

**文件**: `frontend/dstoolkit_frontend/src/utils/db.ts`

**原因**: 用户数据量（12 会话/76 消息）下 `String.includes()` 耗时 < 1ms，FlexSearch 的 export/import/indexMap 机制过于复杂且在云端模式下完全失效。

**改动**:
- 重写 `searchConversations` 的关键词搜索路径（非正则分支）：改用大小写不敏感的 `String.includes()` 遍历 conversations 的 messages，不再依赖 FlexSearch 索引
- 新增 `SearchFilters` 参数：`{ user: boolean, assistant: boolean, title: boolean }`，默认全 true
- 保留正则搜索路径不变（已经直接遍历 conversations，不依赖 FlexSearch）
- 保留 FlexSearch 相关函数（`buildAndPersistIndex` 等）不删除，但 `searchConversations` 不再调用它们
- 新增导出 `searchConversationsWithFilters(q, useRegex, filters, limit, conversations)` 或在现有签名上加 `filters` 参数

**签名变更**:
```ts
export interface SearchFilters {
  user: boolean       // 搜索 USER 消息
  assistant: boolean  // 搜索 ASSISTANT 消息
  title: boolean      // 搜索会话标题
}

export async function searchConversations(
  q: string,
  useRegex: boolean,
  limit: number,
  filters: SearchFilters,           // 新增
  conversations?: ParsedConversation[],
  deepseekUserId?: string,          // 降为可选（FlexSearch 路径仍用，但不再主路径）
): Promise<SearchResult[]>
```

### 2. 搜索筛选 UI

**文件**: `frontend/dstoolkit_frontend/src/views/explore/Explore.vue`

**改动**:
- 在搜索框旁新增三个 `NCheckbox`：用户消息 / AI 回复 / 标题，默认全选
- `doSearch` 传入 `filters` 参数
- 结果映射保持不变（`r.conversation.messages.find((m) => m.content === r.content)` 仍可用，因为 includes 搜索返回的 `content` 就是原始消息内容）

### 3. 全真模拟对话渲染组件

**新文件**: `frontend/dstoolkit_frontend/src/components/ChatViewer.vue`

一个类似 Deepseek 原版的对话查看器组件：

**Props**:
- `conversation: ParsedConversation` — 当前对话
- `apiKeys: ApiKeyItem[]` — 用户存储的 API Key 列表（用于续聊）

**功能**:
- 全屏对话流（非 Drawer），用户消息右对齐、AI 回复左对齐，带头像/角色标签
- 每条消息支持 Markdown 渲染（复用 `MarkdownView`）+ 代码高亮
- 每条 AI 消息显示模型名（`deepseek-chat` 等）+ 时间戳
- **续聊**：底部输入框，用户输入新消息后调用后端 `/api/chat` 流式接口，AI 回复以流式方式逐字渲染
- **编辑上下文**：每条用户消息旁有"编辑"按钮，点击后变为可编辑文本框，保存后重新生成 AI 回复（调用 `/api/chat` 传入编辑后的上下文）
- **模型选择**：下拉框选择 `deepseek-chat` / `deepseek-reasoner`
- **API Key 选择**：下拉框选择已存储的 API Key（从 `apiKeys` prop 中取）

**流式渲染实现**:
- 用 `fetch` 调用 `/api/chat`（不走 axios，因为 axios 不支持 SSE 流读取）
- `ReadableStream` + `TextDecoder` 逐行读取 SSE `data:` 行
- 解析 JSON chunk，提取 `choices[0].delta.content`
- 增量追加到当前 AI 消息的 content，触发 Vue 响应式更新
- 流结束后，将完整 AI 回复追加到对话消息列表

### 4. 后端流式聊天端点

**新文件**: `backend/src/routes/chat.routes.ts`

**端点**: `POST /api/chat`（SSE 流式响应）

**请求体**:
```json
{
  "keyId": 1,
  "model": "deepseek-chat",
  "messages": [{ "role": "user", "content": "你好" }],
  "configId": 2,
  "convId": "abc-123"
}
```

**实现**:
- `verifyJwt` 鉴权
- 从 DB 查 `ApiKey`（按 `keyId` + `userId`），解密得到明文 key
- 调用 `fetch(${env.deepseekApiBase}/chat/completions, { method: POST, headers: { Authorization: Bearer ${key}, 'Content-Type': 'application/json' }, body: JSON.stringify({ model, messages, stream: true }) })`
- 设置响应头 `Content-Type: text/event-stream` + `Cache-Control: no-cache` + `Connection: keep-alive`
- 用 `ReadableStream` 读取 Deepseek 返回的 SSE 流，逐行 pipe 到 `res.write()`
- 流结束后 `res.end()`
- 错误处理：API key 无效、Deepseek 返回错误等，返回 SSE 错误事件

**注册**: `index.ts` 中 `app.use('/api/chat', chatRoutes)`

### 5. Explore.vue 集成 ChatViewer

**文件**: `frontend/dstoolkit_frontend/src/views/explore/Explore.vue`

**改动**:
- 移除 `NDrawer` + `MarkdownView` 的旧渲染
- 引入 `ChatViewer` 组件
- 点击 TurnTree 节点时，不再打开 Drawer，而是：
  - 在右侧面板（或全屏覆盖）打开 `ChatViewer`
  - 传入当前 conversation + 用户 API Keys
- 布局改为左右分栏：左侧 TurnTree，右侧 ChatViewer（类似 IDE 布局）
- 移动端：ChatViewer 全屏覆盖

### 6. 加载用户 API Keys

**文件**: `frontend/dstoolkit_frontend/src/views/explore/Explore.vue`

**改动**:
- `init()` 中加载用户的 API Keys：`const { apiKeys } = await request.get('/apikeys')`
- 传给 `ChatViewer`

## Assumptions & Decisions

1. **FlexSearch 保留但不用于主搜索路径**：用户数据量小（< 1000 消息），`includes()` 足够快（< 5ms）。FlexSearch 的 build/persist/load 机制过于复杂且在云端模式失效，降级为可选优化。
2. **搜索不区分本地/云端模式**：`searchConversations` 只需要 `conversations` 参数（已在内存中），不再需要 `deepseekUserId`。无论本地还是云端模式，搜索都直接遍历内存中的 conversations。
3. **流式聊天走后端代理**：API Key 不暴露到前端；后端解密 key 后代理调用 Deepseek API，SSE 流式转发。
4. **ChatViewer 布局**：桌面端左右分栏（树 40% + 对话 60%），移动端全屏切换。
5. **编辑上下文**：用户编辑某条消息后，截取该消息及之前的所有消息作为上下文，调用 `/api/chat` 重新生成。新回复追加到对话末尾（不修改原始数据，只在 UI 层面追加）。
6. **续聊**：用户在底部输入新消息，以当前对话的所有消息为上下文，调用 `/api/chat` 流式生成回复。

## Verification

1. 搜索修复：在云端模式下输入关键词（如"微调"），验证返回包含该关键词的消息
2. 搜索筛选：取消勾选"AI 回复"，搜索只返回 USER 消息中的命中
3. 对话渲染：点击树节点，右侧面板显示对话流，Markdown 正确渲染
4. 续聊：在对话底部输入新消息，AI 流式回复逐字显示
5. 编辑上下文：编辑某条用户消息，AI 重新生成回复
6. 模型选择：切换 `deepseek-chat` / `deepseek-reasoner`
7. API Key 选择：选择不同的 API Key 进行续聊
8. typecheck + build 通过
