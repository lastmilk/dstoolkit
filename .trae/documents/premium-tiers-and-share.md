# dstoolkit 会员体系 + 分享功能 实现计划

## 范围（已与用户确认）
- ✅ 核心变现层：等级模型(pro/plus/ultimate) + 卡密兑换(混合模式) + 存储配额(轮次硬限+MB软限) + RESTful API 限流 + 定价页 + 个人中心等级展示
- ✅ 完整分享功能：网页完整版 + 5 种主题 + 密码 + 个人专属短链
- ⏸ 下阶段：好友位、PR 提交权限、更多图表

## 关键决策
- 卡密：**混合模式**——管理员可批量生成卡密(赠送/测试)，同时支持对接 kufaka API 校验外部售出的卡密
- 配额：**两者结合**——轮次硬限(1000/无限) + MB 软限(超限阻止上传并提示升级)
- 等级：FREE / PRO / PLUS / ULTIMATE
  - FREE: 50MB + 200 轮 + 无 API + 本地分享预览
  - PRO(¥9.9 永久): 100MB + 1000 轮 + 无 API + 分享(完整版+5主题+密码)
  - PLUS(年/永久): 300MB + 无限轮 + API(60/min) + 分享(+专属短链) + 内测功能
  - ULTIMATE(年/永久): 300MB + 无限轮 + API(300/min) + 分享(+专属短链) + 内测 + 好友位/PR(下阶段)

## 一、数据库 Schema (prisma/schema.prisma)

新增枚举与模型：
- `enum Tier { FREE PRO PLUS ULTIMATE }`
- `enum CardDuration { PERMANENT ANNUAL }`
- `enum CardStatus { UNUSED USED REVOKED }`
- `model RedeemCard`：code(unique)、tier、duration、source(MANUAL/KUFAKA)、status、batchId、createdBy/usedBy 关系、redeemedAt、expiresAt
- `model Share`：slug(unique)、userId、configId、deepseekConvId、title、theme、passwordHash、viewCount、expiresAt
- `User` 新增：tier(默认 FREE)、tierActivatedAt、tierExpiresAt(年费到期)、isPermanentTier

## 二、后端 (backend/src)

### 2.1 等级与配额 (新文件 `services/subscription.ts` + `utils/quota.ts`)
- `getUserTier(user)`: 返回当前有效等级（考虑过期）
- `getQuotaLimits(tier)`: 返回 { maxMb, maxTurns, apiRatePerMin, canShare, canCustomSlug }
- `getUserUsage(userId)`: 统计已用 MB（SUM LENGTH(rawMapping)+LENGTH(content)）和已用轮次（SUM turnCount）
- 配额校验：上传会话前检查，超轮次直接拒绝，超 MB 软限拒绝并提示升级

### 2.2 卡密兑换 (新文件 `routes/subscription.routes.ts`)
- `POST /api/subscription/redeem { code }`：
  1. 先查本地 RedeemCard，unused → 激活并标记 used
  2. 本地未找到且配置了 kufaka → 调 kufaka 校验 API，有效则创建 RedeemCard(source=KUFAKA) 并激活
  3. 否则返回"卡密无效"
- `GET /api/subscription/status`: 返回当前等级、到期、用量、配额
- 激活逻辑：PRO 永久；PLUS/ULTIMATE 按 duration 设 tierExpiresAt(年费) 或 isPermanentTier(永久)。升级时若新等级更高则覆盖。

### 2.3 kufaka 对接 (新文件 `services/kufaka.ts`)
- `validateCard(code)`: 调用 kufaka 验证接口（URL/Key 由 env 配置），返回 { valid, tier?, duration? } 或 null
- 未配置时直接返回 null（降级为纯本地卡密）

### 2.4 RESTful API 限流 (修改 `middleware/auth.ts` 的 verifyApiToken)
- FREE/PRO: 返回 403 "当前等级无 API 权限，请升级至 PLUS 或更高"
- PLUS: 60 req/min；ULTIMATE: 300 req/min
- 用 express-rate-limit 的 keyGenerator + 自定义 handler 实现

### 2.5 分享 (新文件 `routes/share.routes.ts` + `routes/public.routes.ts`)
- `POST /api/shares`: 创建分享（校验等级：FREE 禁止；PRO 自动 slug；PLUS/ULTIMATE 可自定义 slug）
- `GET /api/shares`: 列出我的分享
- `DELETE /api/shares/:id`: 删除分享
- `GET /api/public/shares/:slug`: 公开访问（无 auth），校验密码（如有），返回会话完整 messages+turns

### 2.6 管理后台 (修改 `routes/admin.routes.ts`)
- `POST /api/admin/cards/generate`: 批量生成卡密（tier, duration, count, expiresAt?）
- `GET /api/admin/cards`: 分页查看卡密（按 batchId/status 筛选）
- `POST /api/admin/cards/:id/revoke`: 作废卡密
- `GET /api/admin/users`: 已有，补充 tier 字段返回
- `PUT /api/admin/users/:id/tier`: 管理员手动调整用户等级（应急用）

## 三、用户前端 (frontend/dstoolkit_frontend)

### 3.1 定价页 (新视图 `views/pricing/Pricing.vue`)
- 三栏卡片对比 Pro/Plus/Ultimate 功能与价格
- Pro ¥9.9 永久；Plus/Ultimate 年付/永久（占位价，可配置）
- 按钮：跳转 kufaka 购买 + "已有卡密？立即激活"
- 路由 `/pricing`（公开，meta.public）

### 3.2 个人中心 (修改 `views/profile/Profile.vue`)
- 顶部展示当前等级徽章 + 到期时间 + 用量/配额进度条
- 卡密兑换输入框 + "激活"按钮
- 我的分享列表入口

### 3.3 分享创建 (修改 `components/ChatViewer.vue` 或 Explore)
- "分享"按钮 → 弹窗：主题选择(5种)、密码(可选)、自定义短链(PLUS/ULTIMATE)
- 创建后返回短链 URL，一键复制

### 3.4 公开分享页 (新视图 `views/share/ShareView.vue` + 路由 `/s/:slug`)
- 无需登录
- 如有密码：先显示密码输入
- 渲染完整对话（复用 ChatViewer/MarkdownView/TurnTree）
- 5 种主题 CSS 变量切换

### 3.5 auth store (修改 `stores/auth.ts`)
- User 类型增加 tier/tierExpiresAt/isPermanentTier
- 新增 getters: currentTier, isPro, isPlus, isUltimate

## 四、Admin 前端 (frontend/dstoolkit_admin)
- 新视图 `views/Cards.vue`：卡密生成、列表、作废（用 BaseTable）
- 新视图 `views/UserTiers.vue` 或扩展 Users.vue：显示/调整用户等级
- 路由菜单补充

## 五、5 种分享主题
default / ocean / forest / sunset / mono —— 通过 CSS 变量切换背景、主色、卡片色。均兼容 neu-morphism 风格。

## 六、验证步骤
1. `prisma db push` 同步 schema
2. backend typecheck + build
3. admin typecheck + build
4. frontend typecheck + build
5. 端到端冒烟：管理员生成卡密 → 用户兑换 → 等级生效 → 配额阻止上传 → 创建分享 → 公开访问(含密码)
