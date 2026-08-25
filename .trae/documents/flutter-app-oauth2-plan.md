# DsToolKit Flutter App + 后端 OAuth2 开发计划

> 依据：`PRD.md`（第 3 章 Flutter 方案 + 第 6 章 OAuth2 体系）
> 用户决策：**后端 OAuth2+PKCE + Flutter App 核心功能；付费相关一律跳转 Web 解决，App 内不做任何付费/内购/卡密功能。**
> 不含：Git 同步引擎、浏览器插件、油猴脚本、设备管理、推送通知、生物识别（后续迭代）。

---

## 1. 现状分析（Phase 1 探索结论）

| 项 | 现状 |
|---|---|
| `/api/v1/*` RESTful API | ✅ 已实现（`backend/src/routes/v1.routes.ts`）：`/me`、`/configs`、`/configs/:id/conversations`（分页 lite）、`/configs/:id/conversations/:convId`（完整 messages + turns 聚合）、`/search`、`/stats`，鉴权为 `verifyApiToken`（`Bearer dstk_...`，SHA-256 存 `ApiToken` 表） |
| OAuth2 端点 | ❌ 未实现（PRD Phase 1 未开始，无 `OAuthClient/OAuthCode/OAuthToken` 表） |
| JWT 登录 | ✅ `POST /api/auth/login`，`/api/auth/me` 返回 tier |
| Web 前端 | Vue3 + NaiveUI，`https://dstoolkit.cn`，`/pricing`、`/login` 已存在；路由 `createWebHistory` |
| turns 结构 | `aggregateTurnsFromMessages` 返回 `Turn{ turnIndex, userNodeId, versions[] }`，`Version{ versionIndex, assistantNodeId, subTurns[] }`，`SubTurn{ subTurnIndex, userNodeId, assistantNodeId? }` |
| CORS | 仅放行 frontendOrigin/adminOrigin；App 原生 HTTP（dio）不受 CORS 限制，无需改动 |

**关键设计决策**：OAuth 授权码流程成功后，后端**直接生成 `dstk_` 格式 token 并写入现有 `ApiToken` 表**（PRD 6.2 轨 2 兼容方案），同时写 `OAuthToken` 表维护 refresh 关联。这样 `/api/v1/*` 与 `verifyApiToken` **零改动**即可被 App 使用。

---

## 2. 改动方案

### A. 后端 `backend/`

#### A1. Prisma Schema 扩展（`backend/prisma/schema.prisma`）

新增 3 个模型（简化自 PRD 2.1，去掉 Sync 系列和 DeviceSession）：

```prisma
model OAuthClient {
  id           Int       @id @default(autoincrement())
  clientId     String    @unique
  name         String
  redirectUris Json
  scopes       Json
  isPublic     Boolean   @default(true)   // PKCE，无 client_secret
  enabled      Boolean   @default(true)
  createdAt    DateTime  @default(now())
  codes        OAuthCode[]
  tokens       OAuthToken[]
}

model OAuthCode {
  id                  Int       @id @default(autoincrement())
  codeHash            String    @unique   // SHA256(code)
  clientId            Int
  client              OAuthClient @relation(fields: [clientId], references: [id], onDelete: Cascade)
  userId              Int
  user                User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  scopes              Json
  redirectUri         String    @db.Text
  codeChallenge       String
  codeChallengeMethod String    @default("S256")
  expiresAt           DateTime            // 10 分钟
  used                Boolean   @default(false)
  createdAt           DateTime  @default(now())
}

model OAuthToken {
  id                Int       @id @default(autoincrement())
  accessHash        String    @unique   // SHA256(dstk_ token) —— 同步写 ApiToken 表
  refreshHash       String?   @unique
  clientId          Int
  client            OAuthClient @relation(fields: [clientId], references: [id], onDelete: Cascade)
  userId            Int
  user              User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  apiTokenId        Int                 // 关联 ApiToken 行，revoke 时联动删除
  scopes            Json
  accessExpiresAt   DateTime            // 30 天
  refreshExpiresAt  DateTime?           // 60 天
  createdAt         DateTime  @default(now())
  lastUsedAt        DateTime?
}
```

`User` 模型补充反向关系字段。执行 `prisma generate + db push`（注意用 `node node_modules/prisma/build/index.js generate` 绕过 pnpm 构建脚本问题）。

#### A2. 新增 `backend/src/routes/oauth2.routes.ts`（挂载 `/api/oauth`）

| 端点 | 鉴权 | 逻辑 |
|---|---|---|
| `POST /api/oauth/authorize` | `verifyJwt` | body: `{ clientId, redirectUri, scope, state, codeChallenge, codeChallengeMethod }`。校验 client 存在/enabled、redirectUri 在注册列表内 → 生成随机 code（仅存 SHA256，10 分钟过期，一次性）→ 返回 `{ redirectUrl: "<redirectUri>?code=...&state=..." }` |
| `POST /api/oauth/token` | 无 | `grant_type=authorization_code`：code 哈希查 `OAuthCode`，校验未用/未过期/redirectUri 匹配/PKCE（`BASE64URL(SHA256(code_verifier)) == codeChallenge`）→ 标记 used → 生成 `dstk_` token（`generateApiToken()`）写 `ApiToken`（name: `OAuth · <clientName>`，无过期或 30 天）+ 写 `OAuthToken`（access/refresh 哈希）→ 返回 `{ access_token, refresh_token, token_type: "Bearer", expires_in, scope }`。`grant_type=refresh_token`：refresh 哈希校验 → 轮换（删旧签新） |
| `POST /api/oauth/revoke` | 无 | body: `{ token }`，按哈希删 `ApiToken` + `OAuthToken`（App 登出用） |

复用现有工具：`generateApiToken/hashToken`（`utils/apitoken.ts`）、`asyncHandler`、zod 参数校验（与 `token.routes.ts` 风格一致）。

#### A3. 内置客户端 seed（`backend/src/index.ts` 的 `seed()`）

```typescript
{ clientId: 'dstk-mobile-app', name: 'DsToolKit Mobile App', isPublic: true,
  redirectUris: ['dstoolkit://oauth-callback'],
  scopes: ['read:conversations', 'search', 'profile', 'offline_access'] }
```

#### A4. `index.ts` 注册：`app.use('/api/oauth', oauth2Routes)`

**不做 tier 门槛**：PRD 中"创建 API Token 需 PLUS+"针对浏览器插件同步；App 基础阅读对所有等级开放，OAuth 登录仅要求已注册账号。

### B. Web 前端 `frontend/dstoolkit_frontend/`（授权确认页）

- 新增 `src/views/oauth/Authorize.vue` + 路由 `/oauth/authorize`（`meta: { public: true }`，未登录时由页面自行跳 `/login?redirect=/oauth/authorize?...`）
- 页面：读取 URL query（client_id/redirect_uri/scope/state/code_challenge/code_challenge_method）→ NaiveUI 卡片展示"DsToolKit App 请求访问你的对话数据"+ 权限列表 + 同意/拒绝按钮 → 调 `POST /api/oauth/authorize`（带 JWT）→ `window.location.href = redirectUrl`（触发 `dstoolkit://` 回跳）
- 拒绝：跳回 `redirect_uri?error=access_denied`

### C. Flutter App `flutter_app/`（全新目录）

#### C1. 技术栈（PRD 3.1）

- Flutter 3.24+ / Dart 3.5+；**Riverpod 2.x**（状态）、**go_router**（路由+深链）、**dio**（网络 + Token 刷新拦截器）、**flutter_secure_storage**（token 存储）、**drift**（SQLite 离线缓存）、**webview_flutter 4.x**（OAuth 授权页）、**flutter_markdown + flutter_math_fork**（渲染 + 降级策略）、**url_launcher**（跳 Web 付费）、**fl_chart**（统计图）、**freezed + json_serializable + build_runner**（模型）
- 主题：Material 3 + Neu-morphism 软 UI 风格（柔和阴影/圆角，深浅色双主题），SVG 图标（flutter_svg）

#### C2. 目录结构（PRD 3.2 裁剪为核心功能）

```
flutter_app/
├── lib/
│   ├── main.dart                    # ProviderScope + 主题初始化
│   ├── app.dart                     # MaterialApp.router
│   ├── core/
│   │   ├── constants/api_constants.dart  # apiBase（prod https://api.dstoolkit.cn/api / dev http://10.0.2.2:3000/api）+ webBase（https://dstoolkit.cn）
│   │   ├── router/app_router.dart        # go_router；/login /home /conversation/:configId/:convId /search /stats /profile；深链 dstoolkit://oauth-callback
│   │   └── theme/app_theme.dart
│   ├── data/
│   │   ├── api/
│   │   │   ├── dio_client.dart      # 拦截器：注入 Bearer dstk_；401 → refresh_token 轮换 → 失败清 storage 跳登录
│   │   │   ├── oauth_api.dart       # POST /api/oauth/token、/revoke
│   │   │   └── v1_api.dart          # /api/v1: me/configs/conversations/detail/search/stats
│   │   ├── models/                  # freezed: User, Config, ConversationLite, Message, Turn, Version, SubTurn, ConversationDetail, SearchResult, Stats
│   │   ├── local/app_database.dart  # drift: conversations 表（lite 元数据缓存）+ messages 表（看过的详情缓存）+ kv 表（head/同步时间）
│   │   └── repositories/            # conversation_repository（网络优先/离线回退）等
│   ├── features/
│   │   ├── auth/                    # 登录页：PKCE 生成 → WebView 打开 {webBase}/oauth/authorize → NavigationDelegate 拦截 dstoolkit:// 取 code → 换 token → secure storage
│   │   ├── home/                    # 底部 4 Tab：对话 / 搜索 / 统计 / 我的
│   │   ├── conversation/
│   │   │   ├── list/                # config 选择 + 分页列表 + 下拉刷新 + drift 缓存
│   │   │   └── detail/              # 聊天气泡（Markdown + 代码高亮 + 公式渲染失败降级纯文本）+ TurnTree 版本切换（多 version 时横向切换器）
│   │   ├── search/                  # 调 /api/v1/search，结果点击跳详情
│   │   ├── stats/                   # /api/v1/stats 计数卡片 + fl_chart 简图
│   │   └── profile/                 # /api/v1/me 用户信息 + 当前等级徽章 + 「升级订阅」按钮（url_launcher 外部浏览器打开 {webBase}/pricing）+ 登出（revoke + 清 storage + 清 drift 缓存）
│   └── widgets/
│       ├── chat_bubble.dart         # Markdown 气泡 + try/catch 降级
│       └── turn_tree.dart           # 版本/分支切换控件
├── pubspec.yaml
├── android/app/src/main/AndroidManifest.xml  # INTERNET 权限 + <intent-filter> scheme="dstoolkit" + debug usesCleartextTraffic
└── ios/Runner/Info.plist                      # CFBundleURLSchemes: dstoolkit
```

#### C3. OAuth PKCE 登录流程（PRD 3.4.1）

1. 生成 `code_verifier`（32B random）+ `code_challenge = BASE64URL(SHA256(verifier))` + `state`
2. WebView 打开 `{webBase}/oauth/authorize?response_type=code&client_id=dstk-mobile-app&redirect_uri=dstoolkit://oauth-callback&scope=...&state=...&code_challenge=...&code_challenge_method=S256`
3. 用户在 WebView 内完成 Web 登录（复用现有登录页）+ 授权确认
4. `NavigationDelegate` 拦截 `dstoolkit://oauth-callback?code=...&state=...`（校验 state），阻断导航
5. `POST {apiBase}/oauth/token`（grant_type=authorization_code + code_verifier）→ 获得 `dstk_` access_token + refresh_token → flutter_secure_storage 保存
6. 后续请求 `Authorization: Bearer dstk_...`；过期自动 refresh；refresh 失效 → 回登录页

#### C4. 付费相关处理（用户特别要求）

- App 内**无**定价页、卡密兑换、余额、充值入口
- 唯一付费触点：profile 页「升级订阅 / 查看定价」按钮 + tier 不足提示 → `url_launcher` 外部浏览器打开 `https://dstoolkit.cn/pricing`（审核友好，无内购）

#### C5. 数据模型（与后端 JSON 对齐）

- `ConversationLite`: `{ id, deepseekConvId, title, insertedAt, updatedAt, turnCount }`
- `ConversationDetail`: `{ ...conv, messages: Message[], turns: Turn[] }`（`Message`: nodeId/parentId/role/model/content/insertedAt/turnIndex/versionIndex/subTurnIndex）
- `Turn{ turnIndex, userNodeId, versions: Version[] }` / `Version{ versionIndex, assistantNodeId, subTurns: SubTurn[] }` / `SubTurn{ subTurnIndex, userNodeId, assistantNodeId? }`

---

## 3. 假设与决策

1. OAuth token 直接落 `ApiToken` 表（dstk_ 格式），复用 `verifyApiToken`，`/api/v1/*` 零改动
2. App 登录不设 PLUS 门槛（所有等级可登录基础阅读）；tier 信息仅作展示与升级引导
3. App 内不做注册，登录页提供「没有账号？去官网注册」链接（url_launcher）
4. 离线缓存为"看过的内容可离线回看"，不做 PRD 的 Git 增量同步协议（后端无 sync 端点）
5. dev 环境：API `http://10.0.2.2:3000/api`（Android 模拟器），Web `http://10.0.2.2:5173`（需放行 cleartext）；prod 走 `api.dstoolkit.cn` / `dstoolkit.cn`
6. 后端构建沿用项目已知绕过方式（直接调 tsc / prisma 二进制）

## 4. 实施顺序

1. 后端：schema → oauth2.routes.ts → seed → 注册 → build 验证
2. Web 前端：Authorize.vue → build 验证
3. Flutter：脚手架（pubspec/主题/路由/dio/drift）→ auth 流程 → 对话列表/详情 → 搜索 → 统计 → profile → 平台配置（scheme/权限）
4. 端到端联调（模拟器）

## 5. 验证

1. **后端**：`node node_modules/typescript/bin/tsc` 编译通过；启动 `./node_modules/.bin/tsx watch src/index.ts`；curl 脚本验证 authorize→token→/api/v1/me 全链路（手工 PKCE 计算）
2. **Web 前端**：`npm run build` 通过；浏览器走 /oauth/authorize 授权页 UI
3. **Flutter**：`flutter analyze` 无错误；Android 模拟器实跑：登录（WebView 授权回跳）→ 对话列表 → 详情 Markdown/TurnTree → 搜索 → 统计 → profile 跳转 Web 定价 → 登出
