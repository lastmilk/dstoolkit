# Tasks

## 后端

- [x] Task 1: Prisma schema 增强：`Conversation` 加 `turnCount Int @default(0)`；`Message` 加 `turnIndex Int?`/`versionIndex Int?`/`subTurnIndex Int?` 并建索引；执行 `prisma db push`。
  - [x] SubTask 1.1: 编辑 schema.prisma
  - [x] SubTask 1.2: 运行 `npx prisma db push --skip-generate` 并 `npx prisma generate`

- [x] Task 2: 增强解析器 `deepseekParser.ts` 输出五层树。
  - [x] SubTask 2.1: 在 `ParsedConversation` 上增加 `turns: Turn[]` 类型定义
  - [x] SubTask 2.2: 实现从 mapping 树提取 turns 算法（USER 节点 → ASSISTANT 子节点为 versions → 修改后的 USER 子节点为 subTurns）
  - [x] SubTask 2.3: 在 `ParsedMessage` 上附加 `turnIndex`/`versionIndex`/`subTurnIndex`
  - [x] SubTask 2.4: 扩展 `test-parser.ts` 打印第一会话的 turns 结构，验证 36 上限场景

- [x] Task 3: Meilisearch 集成服务 `services/meilisearch.ts`。
  - [x] SubTask 3.1: 安装 `meilisearch` 依赖；在 `env.ts` 加 `meiliHost`/`meiliApiKey`（可选）
  - [x] SubTask 3.2: 实现 `indexDocuments(userId, docs[])`、`deleteDocuments(userId, nodeIds[])`、`search(userId, q, opts)` 三个方法
  - [x] SubTask 3.3: 主索引名 `dstoolkit_<userId>`，可配置不可用时优雅降级（不抛错，仅日志）

- [x] Task 4: 导入流程同步推送到 Meilisearch。
  - [x] SubTask 4.1: `config.routes.ts` 的 `POST /` 与 `PUT /:id/upload` 在 cloud=true 落库成功后调用 `indexDocuments`
  - [x] SubTask 4.2: 增量更新时，对 `updatedAt` 变更的会话先 `deleteDocuments` 旧 nodeId 再 `indexDocuments` 新文档

- [x] Task 5: 新增云端搜索路由 `search.routes.ts`。
  - [x] SubTask 5.1: `GET /api/search?q=&configId=&limit=` 调用 `meilisearch.search`，返回 `{ results: [{convId, nodeId, title, content, role, turnIndex, versionIndex, subTurnIndex}] }`
  - [x] SubTask 5.2: 应用 `express-rate-limit`（30 次/分钟/用户，按 `req.user.id`）
  - [x] SubTask 5.3: 在 `index.ts` 注册路由 `/api/search`

- [x] Task 6: `conversation.routes.ts` 的 `GET /:configId/conversations/:convId` 增加返回 `turns` 字段（从 `rawMapping` 实时计算，或从 `messages` 上的 index 字段聚合）。

## 前端

- [x] Task 7: 类型与 IndexedDB 重构 `utils/db.ts`。
  - [x] SubTask 7.1: `types/index.ts` 加 `Turn`/`Version`/`SubTurn` 接口；`ParsedConversation.turns`
  - [x] SubTask 7.2: IndexedDB schema 升级到 v2：新增 `searchIndex`（keyPath: `deepseekUserId`，存 FlexSearch 序列化字节）与 `searchMeta`（keyPath: `deepseekUserId`）对象仓库
  - [x] SubTask 7.3: 实现 `buildAndPersistIndex(deepseekUserId, convs)`：构建 + `export()` + 写 IDB + 写 meta
  - [x] SubTask 7.4: 实现 `loadPersistedIndex(deepseekUserId)`：从 IDB 读字节 + `import()` 到 FlexSearch 实例
  - [x] SubTask 7.5: 实现 `incrementalUpdateIndex(deepseekUserId, changedConvIds, convs)`：删除旧文档 + add 新文档 + 重新 export 持久化
  - [x] SubTask 7.6: 移除 `buildSearchIndex` 全量重建函数；`searchConversations` 改为从持久化索引查询
  - [x] SubTask 7.7: 新增 `cloudSearch(q, configId, limit)` 调用 `/api/search`，结果写入 IDB 缓存

- [x] Task 8: 新增搜索模型 store `stores/searchModel.ts`。
  - [x] SubTask 8.1: Pinia store 状态 `model: 'local_v1' | 'cloud_v1' | 'cloud_v2'`，持久化到 `localStorage`
  - [x] SubTask 8.2: getter `isCloudV1`/`isCloudV2Disabled`/`canUseCloud`（依赖 auth.cloudSyncEnabled）
  - [x] SubTask 8.3: action `setModel(m)` 切换时校验云同步开关

- [x] Task 9: 合并视图 `views/explore/Explore.vue`。
  - [x] SubTask 9.1: 顶部搜索框 + 搜索模型选择器（NRadioGroup：local_v1/cloud_v1/cloud_v2，cloud_v2 禁用）
  - [x] SubTask 9.2: 顶部模式切换（时间线/搜索）
  - [x] SubTask 9.3: 五层树组件 `components/TurnTree.vue`（NCollapse 递归：日期 > 会话 > 轮次 > 版本 > 子轮次）
  - [x] SubTask 9.4: 时间线模式：从 `loadAllConversations` 加载后聚合为五层树
  - [x] SubTask 9.5: 搜索模式：根据当前模型调用 `searchConversations` 或 `cloudSearch`，命中节点自动展开父链路
  - [x] SubTask 9.6: 点击子轮次节点打开 NDrawer 显示完整 Markdown 对话

- [x] Task 10: 路由与旧视图迁移。
  - [x] SubTask 10.1: `router/index.ts` 新增 `/explore`；`/search` 与 `/timeline` 重定向到 `/explore`
  - [x] SubTask 10.2: 删除 `views/search/Search.vue` 与 `views/timeline/Timeline.vue`
  - [x] SubTask 10.3: `MainLayout.vue` 菜单项"快速搜索"与"时间线"合并为"探索"单项
  - [x] SubTask 10.4: `Configs.vue` 上传成功回调调用 `buildAndPersistIndex` 或 `incrementalUpdateIndex`

- [x] Task 11: 搜索模型选择 UI 细节。
  - [x] SubTask 11.1: cloud_v2 选项 disabled 且文案"cloud v2（即将推出 · Elasticsearch）"
  - [x] SubTask 11.2: local_v1 标签"local v1（免费 · 不上传数据）"
  - [x] SubTask 11.3: cloud_v1 标签"cloud v1（Meilisearch 混合 · 有限流）"

## 验证

- [x] Task 12: 类型检查 + 构建 + 烟雾测试。
  - [x] SubTask 12.1: 后端 `npm run typecheck`；前端 `npm run type-check`；admin 无需改动
  - [x] SubTask 12.2: 后端 `npm run dev` + 前端 `npm run dev`，启动无报错
  - [x] SubTask 12.3: 注册 admin → 上传样本 zip（`backend/assest/deepseek_data-2026-08-19(1).zip`）→ 检查 Meilisearch 索引推送日志
  - [x] SubTask 12.4: 进入 `/explore` 验证：默认 local_v1、五层树展开、搜索命中高亮
  - [x] SubTask 12.5: 切换 cloud_v1 → 搜索 → 验证 `/api/search` 返回结果且写入 IDB
  - [x] SubTask 12.6: cloud_v2 选项无法选中
  - [x] SubTask 12.7: 关闭后重开浏览器 → 进入 `/explore` → 索引从 IDB 恢复，无需重建

# Task Dependencies
- [Task 2] depends on [Task 1]（解析器输出的 index 字段需 schema 支持）
- [Task 4] depends on [Task 2] 与 [Task 3]
- [Task 5] depends on [Task 3]
- [Task 7.2] 需先完成（IDB v2）才能做 [Task 7.3-7.7]
- [Task 9] depends on [Task 7] 与 [Task 8]
- [Task 10] depends on [Task 9]
- [Task 12] depends on 全部
- 可并行：[Task 3] 与 [Task 7]、[Task 8] 与 [Task 2]
