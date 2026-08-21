# 搜索引擎重构 + 时间线/搜索合并 Spec

## Why
当前 `db.ts` 在每次进入搜索页 `onMounted` 时都从零重建 FlexSearch 内存索引，数据量大时首屏慢、卡顿；搜索与时间线是两个独立视图，数据源分散；Deepseek 导出本身是树状结构（同一轮对话可被多次"重新生成"与"修改后重生成"，单轮最多 6×6=36 个分支），现有扁平 messages 列表无法表达这一层级。

本次重构：把索引构建移到"导入时一次"，提供本地/云端多档搜索模型，并将时间线与搜索合并为一个统一的"探索"视图（日期-对话-轮次-亚轮次-子轮次五层树）。

## What Changes
- **BREAKING** 移除 Search.vue / Timeline.vue 两个旧视图，合并为 `Explore.vue`（路由 `/explore`，旧 `/search` 与 `/timeline` 重定向到 `/explore`）。
- **BREAKING** `db.ts` 重构：新增 `searchIndex` 对象仓库（IndexedDB）持久化 FlexSearch 序列化索引；移除"每次进入页面重建索引"，改为"导入时构建一次 + 增量更新"。
- 新增三档搜索模型选择器（持久化到用户配置 `localStorage`）：
  - `local_v1`（默认，免费，IndexedDB + FlexSearch，不上传任何个人数据）
  - `cloud_v1`（IndexedDB 缓存 + Meilisearch 云端混合，有使用限制/限流）
  - `cloud_v2`（Elasticsearch，未来版本，前端禁用并标注"即将推出"）
- 后端新增 Meilisearch 集成（`meilisearch` npm 包），在 `POST /api/configs` 与 `PUT /api/configs/:id/upload` 导入流程中**同步推送到 Meilisearch 索引**（仅 `cloudSyncEnabled=true` 用户触发）。
- 新增 `GET /api/search?q=&configId=&limit=` 云端搜索端点（cloud_v1），带 express-rate-limit（例如 30 次/分钟/用户）。
- 解析器 `deepseekParser.ts` 增强：在原有扁平 `messages[]` 基础上，额外输出 `turns: Turn[]` 五层树结构。
- 数据库 schema 增强：`Conversation` 增加 `turnCount`、`Message` 增加 `turnIndex`/`versionIndex`/`subTurnIndex`（可空，用于快速定位）；保留 `rawMapping` 作为树真相源。
- 前端五层树组件：`Date > Conversation > Turn > Version > SubTurn`，支持搜索词过滤后定位到具体子轮次。

## Impact
- Affected specs: 无（首个 spec）
- Affected code:
  - 前端：[db.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/frontend/dstoolkit_frontend/src/utils/db.ts)、[Search.vue](file:///home/pmfish/Documents/trae_projects/dstoolkit/frontend/dstoolkit_frontend/src/views/search/Search.vue)、[Timeline.vue](file:///home/pmfish/Documents/trae_projects/dstoolkit/frontend/dstoolkit_frontend/src/views/timeline/Timeline.vue)、[router/index.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/frontend/dstoolkit_frontend/src/router/index.ts)、[types/index.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/frontend/dstoolkit_frontend/src/types/index.ts)
  - 后端：[deepseekParser.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/services/deepseekParser.ts)、[config.routes.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/routes/config.routes.ts)、[conversation.routes.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/routes/conversation.routes.ts)、新增 [search.routes.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/routes/search.routes.ts)、新增 [services/meilisearch.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/services/meilisearch.ts)、[config/env.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/src/config/env.ts)、[prisma/schema.prisma](file:///home/pmfish/Documents/trae_projects/dstoolkit/backend/prisma/schema.prisma)
  - 新增依赖：后端 `meilisearch`；前端无新增（FlexSearch 已支持 export/import）

## ADDED Requirements

### Requirement: 三档搜索模型
系统 SHALL 提供三种搜索模型供用户在前端选择：`local_v1`、`cloud_v1`、`cloud_v2`，选择项持久化到 `localStorage`。

#### Scenario: 默认本地模型
- **WHEN** 用户首次进入探索页且未选择过搜索模型
- **THEN** 默认使用 `local_v1`，UI 显示"本地 v1（免费）"标签

#### Scenario: 切换到云端 v1
- **WHEN** 用户选择 `cloud_v1`
- **AND** 用户 `cloudSyncEnabled=true`
- **THEN** 搜索先查本地 IndexedDB 缓存，未命中时请求 `/api/search`，返回结果后写入 IndexedDB 供 FlexSearch 下次使用
- **AND** 后端应用 express-rate-limit（默认 30 次/分钟/用户），超限返回 429

#### Scenario: 云端 v2 不可用
- **WHEN** 用户尝试选择 `cloud_v2`
- **THEN** 该选项在 UI 中被禁用（disabled）并标注"即将推出（Elasticsearch）"，无法选中

#### Scenario: 云端 v1 但未开启云同步
- **WHEN** 用户选择 `cloud_v1` 但 `cloudSyncEnabled=false`
- **THEN** UI 提示"请先在个人中心开启云端存储开关"，并回退到 `local_v1`

### Requirement: 导入时一次构建索引
系统 SHALL 在导入 Deepseek 压缩包时（无论是上传到云端还是本地存储）一次性构建并持久化搜索索引，后续访问探索页时不再重建。

#### Scenario: 本地导入
- **WHEN** 用户 `cloudSyncEnabled=false` 上传 zip
- **THEN** 前端收到解析结果后立即构建 FlexSearch 索引，调用 `index.export()` 序列化后写入 IndexedDB `searchIndex` 对象仓库（key 为 `deepseekUserId`）
- **AND** 写入 `searchMeta` 仓库记录 `{ deepseekUserId, indexedCount, builtAt, contentHash }`
- **AND** 再次进入探索页时直接从 IndexedDB `import()` 序列化索引，毫秒级可用

#### Scenario: 云端导入
- **WHEN** 用户 `cloudSyncEnabled=true` 上传 zip
- **THEN** 后端在落库后同步推送文档到 Meilisearch 索引（文档 id = `msg:${convId}:${nodeId}`，字段含 `content`/`title`/`role`/`model`/`convId`/`configId`/`userId`/`turnIndex`/`versionIndex`/`subTurnIndex`/`insertedAt`）
- **AND** 前端把首次云端搜索结果缓存到 IndexedDB 并用 FlexSearch 建索引（惰性构建，无需用户手动触发）

#### Scenario: 增量更新索引
- **WHEN** 用户对已有配置上传新 zip（增量合并）
- **AND** 某会话 `updatedAt` 更新
- **THEN** 本地：从 IDB 删除该会话旧文档后增量 add 新文档；云端：Meilisearch 删除旧文档后批量 add 新文档
- **AND** 不重建其它未变更会话的索引

### Requirement: 五层树结构
系统 SHALL 把 Deepseek 对话解析为五层树：`Date > Conversation > Turn > Version > SubTurn`。

#### Scenario: 树结构定义
- **GIVEN** Deepseek 单轮对话最多 6 次重新生成，每次重新生成可再修改 6 次（共 36 个分支）
- **THEN** 第 3 层 Turn = 一个 USER 消息（用户提问）；第 4 层 Version = 该 USER 消息的 ASSISTANT 子节点（同一提问的不同重生成版本，最多 6 个）；第 5 层 SubTurn = 对某 Version 的 USER 修改追问（再 6 个）
- **AND** 解析器输出 `turns: { turnIndex, userNodeId, versions: { versionIndex, assistantNodeId, subTurns: { subTurnIndex, userNodeId, assistantNodeId }[] }[] }[]`

#### Scenario: 探索页五层树渲染
- **WHEN** 用户进入探索页未输入搜索词
- **THEN** 默认渲染时间线模式：按日期分组（L1）展开，每个日期下显示会话列表（L2），点击会话展开轮次列表（L3），点击轮次展开版本列表（L4），点击版本展开子轮次列表（L5）
- **AND** 每层节点显示对应的统计标签（日期：N 个对话；会话：N 轮；轮次：N 个版本；版本：N 个子轮次）

#### Scenario: 搜索过滤五层树
- **WHEN** 用户输入搜索词并搜索
- **THEN** 搜索结果在五层树中以"定位到具体子轮次"形式高亮展开（自动展开父链路）
- **AND** 未命中节点折叠，命中节点以 `search-hit` 样式高亮

### Requirement: 时间线与搜索合并
系统 SHALL 把原 `/search` 与 `/timeline` 两个路由合并为 `/explore`，并在合并视图内同时支持"时间线浏览"和"关键词搜索"两种模式。

#### Scenario: 旧路由重定向
- **WHEN** 用户访问 `/search` 或 `/timeline`
- **THEN** 路由重定向到 `/explore`

#### Scenario: 模式切换
- **WHEN** 用户在探索页顶部切换"时间线/搜索"标签
- **THEN** 时间线模式：展示五层树全量数据；搜索模式：展示搜索词过滤后的五层树
- **AND** 搜索框为空时，搜索模式自动回退到时间线模式

## MODIFIED Requirements

### Requirement: Deepseek 解析器输出树结构
原 `parseDeepseekZip` 仅输出扁平 `messages[]`，现 SHALL 额外输出 `turns: Turn[]` 五层树结构，并保留 `messages[]` 用于向后兼容与搜索索引。

#### Scenario: 输出结构
- **GIVEN** Deepseek 的 `mapping` 是 parent/children 树
- **THEN** `ParsedConversation.turns` 字段返回树结构，每层带 `index` 与 `nodeId`
- **AND** `messages[]` 保持扁平，但每条 `ParsedMessage` 额外携带 `turnIndex?`/`versionIndex?`/`subTurnIndex?`（ASSISTANT 消息带 versionIndex，USER 追问带 subTurnIndex）

## REMOVED Requirements

### Requirement: 进入搜索页重建索引
**Reason**: 首屏慢、数据量大时卡顿；改为导入时一次构建 + 增量更新。
**Migration**: `Search.vue` 的 `onMounted(buildIndex)` 删除；构建逻辑迁移到 `Configs.vue` 上传成功回调与 `db.ts` 的 `buildAndPersistIndex` 函数。
