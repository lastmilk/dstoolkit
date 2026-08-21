# Checklist

## Spec 覆盖
- [x] spec.md 包含三档搜索模型（local_v1 / cloud_v1 / cloud_v2）的需求
- [x] spec.md 包含导入时一次构建索引 + 增量更新的需求
- [x] spec.md 包含五层树（Date > Conversation > Turn > Version > SubTurn）的需求
- [x] spec.md 包含时间线与搜索合并为 /explore 的需求
- [x] spec.md 标注 BREAKING：移除 Search.vue / Timeline.vue 旧视图

## 后端
- [x] prisma schema.prisma：Conversation.turnCount 与 Message.turnIndex/versionIndex/subTurnIndex 已添加
- [x] `prisma db push` 成功执行，数据库结构同步
- [x] deepseekParser.ts 输出 `turns: Turn[]` 五层树结构
- [x] ParsedMessage 额外携带 turnIndex/versionIndex/subTurnIndex
- [x] test-parser.ts 打印第一会话 turns 结构，符合 36 上限语义
- [x] services/meilisearch.ts 实现 indexDocuments/deleteDocuments/search 三方法
- [x] meiliHost/meiliApiKey 加入 env.ts，可选（缺失时优雅降级）
- [x] config.routes.ts 导入流程 cloud=true 时调用 indexDocuments
- [x] 增量更新时先 deleteDocuments 旧 nodeId 再 indexDocuments 新文档
- [x] search.routes.ts 实现 GET /api/search 带限流（30 次/分钟/用户）
- [x] index.ts 注册 /api/search 路由
- [x] conversation.routes.ts GET /:configId/conversations/:convId 返回 turns 字段（aggregateTurnsFromMessages）
- [x] 后端 `npm run typecheck` 通过

## 前端 - 基础设施
- [x] types/index.ts 加 Turn/Version/SubTurn 接口，ParsedConversation.turns
- [x] db.ts IndexedDB 升级到 v2，新增 searchIndex 与 searchMeta 对象仓库
- [x] buildAndPersistIndex(deepseekUserId, convs) 实现：构建 + export + 写 IDB + 写 meta
- [x] loadPersistedIndex(deepseekUserId) 实现：从 IDB 读字节 + import 到 FlexSearch
- [x] incrementalUpdateIndex 实现：删除旧文档 + add 新文档 + 重新持久化
- [x] 移除 buildSearchIndex 全量重建函数
- [x] searchConversations 改为从持久化索引查询（async）
- [x] cloudSearch(q, configId, limit) 实现：调用 /api/search + 结果写入 IDB 缓存
- [x] stores/searchModel.ts 实现：model 状态 + localStorage 持久化 + isCloudV2Disabled/canUseCloud getters

## 前端 - 视图
- [x] views/explore/Explore.vue 创建：顶部搜索框 + 模型选择器 + 模式切换
- [x] components/TurnTree.vue 创建：五层递归 NTree 树
- [x] 时间线模式：从 loadAllConversations 聚合五层树
- [x] 搜索模式：按模型调 searchConversations 或 cloudSearch，命中节点自动展开父链路
- [x] 点击子轮次节点打开 NDrawer 显示 Markdown 对话
- [x] router/index.ts 新增 /explore；/search 与 /timeline 重定向到 /explore
- [x] 删除 views/search/Search.vue 与 views/timeline/Timeline.vue
- [x] MainLayout.vue 菜单合并为"探索"单项
- [x] Configs.vue 上传成功回调调用 buildAndPersistIndex 或 incrementalUpdateIndex

## 前端 - 搜索模型 UI 细节
- [x] local_v1 标签"local v1（免费 · 不上传数据）"
- [x] cloud_v1 标签"cloud v1（Meilisearch 混合 · 有限流）"
- [x] cloud_v2 选项 disabled 且文案"cloud v2（即将推出 · Elasticsearch）"
- [x] cloud_v2 无法被选中
- [x] 切换 cloud_v1 但 cloudSyncEnabled=false 时提示并回退 local_v1

## 验证
- [x] 前端 `npm run type-check` 通过
- [x] 前端 `npm run build-only` 通过
- [x] 后端 `npm run dev` 启动无报错（含 Meilisearch 禁用日志）
- [x] 前端 `npm run dev` 启动无报错
- [x] 注册 admin → 上传样本 zip → 解析器输出 turns 结构（first conv turns=1）
- [x] /explore 默认 local_v1、五层树可展开（构建成功 + 路由 200）
- [x] GET /api/configs/:id/conversations/:convId 返回 turns（turnCount=3, turns.length=3, Turn/Version/SubTurn 结构正确）
- [x] GET /api/search?q=微调 → 优雅降级返回 {q, count:0, results:[]}（Meili 未配置）
- [x] cloud_v2 选项无法选中（NRadio disabled）
- [x] /search 与 /timeline 自动重定向到 /explore（路由配置）
