# Deepseek 对话查看工具 dstoolkit — 实施计划

## 一、Summary（摘要）

构建一个 Deepseek 对话查看工具 **dstoolkit**，支持：账号系统、上传 Deepseek 数据压缩包（增量合并 / 新建配置）、基于 IndexedDB+FlexSearch 的极速搜索（支持正则）、多类型时间线、折线统计图、Alpaca 格式转换、余额查询、应用市场、ElementPlus 后台管理。

架构为 **三端**：
- `backend/`：Node.js + Express + Prisma + MySQL 的 REST API。
- `frontend/dstoolkit_frontend/`：Vue3 + NaiveUI 的用户端（在现有脚手架上扩展）。
- `frontend/dstoolkit_admin/`：Vue3 + ElementPlus 的独立后台应用（新建）。

## 二、Current State Analysis（现状分析，基于实际探索）

### 已存在
- `backend/assest/deepseek_data-2026-08-19(1)/`：Deepseek 样例数据（`user.json` + `conversations.json`）及其 `.zip`。
- `frontend/dstoolkit_frontend/`：`npm create vue@latest` 生成的全新脚手架（Vue 3.5 / Vue Router 5 / Pinia 4 / Vite 8 / TS 6），含 `@`→`src` 别名（见 [vite.config.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/frontend/dstoolkit_frontend/vite.config.ts)），仅有默认 HelloWorld/AboutView（见 [router/index.ts](file:///home/pmfish/Documents/trae_projects/dstoolkit/frontend/dstoolkit_frontend/src/router/index.ts)、[App.vue](file:///home/pmfish/Documents/trae_projects/dstoolkit/frontend/dstoolkit_frontend/src/App.vue)）。
- 后端无任何 Node 工程（无 package.json / 入口）。

### Deepseek 数据格式（已用 Python 解析样例确认）
`user.json`（单行）：
```json
{"user_id":"2cbf2720-...","email":null,"mobile":{"mobile_number":"18136051007","area_code":"+86"},"oauth_profiles":null}
```
`conversations.json`（数组，样例 12 条），每条结构：
```jsonc
{
  "id": "20339595-...",            // UUID
  "title": "AI微调数据格式",
  "inserted_at": "2026-08-18T21:02:35.557000+08:00",
  "updated_at":  "2026-08-18T21:03:13.398000+08:00",
  "mapping": {                      // 树结构，key=节点id
    "root": { "id":"root","parent":null,"children":["1"],"message":null },
    "1": {
      "id":"1","parent":"root","children":["2"],
      "message": {
        "model":"deepseek-chat",
        "inserted_at":"2026-08-18T21:03:02.813000+08:00",
        "fragments":[ { "type":"REQUEST",  "content":"用户提问" } ]
      }
    },
    "2": {
      "id":"2","parent":"1","children":[],
      "message": {
        "model":"deepseek-chat",
        "inserted_at":"...",
        "fragments":[ { "type":"RESPONSE", "content":"AI回答" } ]
      }
    }
  }
}
```
**关键点**：非扁平 `role` 数组，而是 `parent/children` 树（类似 ChatGPT 导出，支持重生成分支）。消息体在 `message.fragments[]`，`type` 为 `REQUEST`(用户) / `RESPONSE`(AI)。无顶层 `tokens` 字段（统计以消息数/时间为主，token 若存在于个别 message 则按需读取）。

## 三、架构与项目结构

```
dstoolkit/
├── backend/
│   ├── package.json  tsconfig.json  .env
│   ├── prisma/schema.prisma
│   ├── src/
│   │   ├── index.ts                 # Express 启动 + cors + 路由挂载
│   │   ├── config/env.ts             # 读取 .env（DB/JWT/前端来源）
│   │   ├── middleware/auth.ts        # JWT 校验 + 可选 admin 守卫
│   │   ├── routes/                   # auth / config / conversation / apikey / balance / stats / timeline / alpaca / market / admin
│   │   ├── services/
│   │   │   ├── deepseekParser.ts     # 解压 zip → 读 user.json+conversations.json → 树→扁平消息
│   │   │   ├── deepseekApi.ts        # 调 Deepseek 余额 API（代理，密钥服务端解密）
│   │   │   └── alpacaConverter.ts    # 对话 → Alpaca JSON
│   │   └── utils/crypto.ts token.ts
│   └── assest/                        # 保留样例数据
├── frontend/
│   ├── dstoolkit_frontend/           # 现有，扩展为 NaiveUI 用户端
│   └── dstoolkit_admin/              # 新建，ElementPlus 后台
```

## 四、数据库设计（Prisma schema，MySQL）

```prisma
model User {
  id              Int      @id @default(autoincrement())
  username        String   @unique
  passwordHash    String
  role            Role     @default(USER)        // USER / ADMIN
  cloudSyncEnabled Boolean @default(false)       // 云端存储开关
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
  configs          DeepseekConfig[]
  apiKeys          ApiKey[]
}

model DeepseekConfig {                      // "新增 deepseek 配置"
  id              Int      @id @default(autoincrement())
  user            User     @relation(fields:[userId],references:[id],onDelete:Cascade)
  userId          Int
  name            String                              // 用户输入的名称
  deepseekUserId  String                              // 取自 user.json.user_id
  deepseekEmail   String?   @db.Text
  deepseekMobile  String?   @db.Text
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  @@unique([userId, deepseekUserId])              // 同账号同 deepseek 用户=增量
  conversations   Conversation[]
}

model Conversation {
  id              Int      @id @default(autoincrement())
  config          DeepseekConfig @relation(fields:[configId],references:[id],onDelete:Cascade)
  configId        Int
  deepseekConvId  String
  title           String   @db.Text
  insertedAt      DateTime                       // 取自导出 inserted_at
  updatedAt      DateTime
  rawMapping      Json       @db.LongText        // 原始树，便于后台/时间线
  messages        Message[]
  @@unique([configId, deepseekConvId])
}

model Message {                              // 扁平化后的线性消息（便于搜索/统计）
  id              Int      @id @default(autoincrement())
  conversation    Conversation @relation(fields:[conversationId],references:[id],onDelete:Cascade)
  conversationId  Int
  nodeId          String
  parentId        String?
  role            MsgRole                       // USER / ASSISTANT
  model           String?
  content         String @db.LongText
  insertedAt      DateTime
  @@index([conversationId])
  @@index([role])
}

model ApiKey {                              // 始终云端持久化（余额查询跨会话需要）
  id        Int      @id @default(autoincrement())
  user      User     @relation(fields:[userId],references:[id],onDelete:Cascade)
  userId    Int
  name      String
  keyCipher String   @db.Text                 // AES 加密存储
  createdAt DateTime @default(now())
  @@unique([userId, name])
}

model AppMarketEntry {                     // 应用市场占位
  id          Int      @id @default(autoincrement())
  name        String
  url         String   @db.Text
  description String?  @db.Text
  category    String   @default("official")
  createdAt   DateTime @default(now())
}

enum Role { USER ADMIN }
enum MsgRole { USER ASSISTANT }
```

## 五、后端实现（backend/，Node.js + Express + Prisma）

### 0 公共
- `src/index.ts`：Express + `cors`（允许两个前端来源）+ `express.json`（限 50mb，zip 解析后可能较大）+ 路由前缀 `/api`。
- `config/env.ts`：从 `.env` 读取 `DATABASE_URL`、`JWT_SECRET`、`JWT_EXPIRES`、`FRONTEND_ORIGIN`、`ADMIN_ORIGIN`、`DEEPSEEK_API_BASE`、`AES_KEY`。
- `middleware/auth.ts`：`verifyJwt`（解析 Bearer，挂 `req.user`）、`requireAdmin`（role=ADMIN 才放行）。
- `utils/crypto.ts`：`bcrypt` 哈希密码；`AES-256-GCM` 加解密 API Key。
- `utils/token.ts`：签发/校验 JWT（access）。

### 1 账号系统 — `routes/auth.routes.ts`
- `POST /api/auth/register`：用户名+密码注册（首个用户自动 ADMIN，便于初始化后台）。
- `POST /api/auth/login`：校验密码 → 签 JWT。
- `GET /api/auth/me`：当前用户信息。
- `PUT /api/auth/profile`：改用户名。
- `PUT /api/auth/password`：校验旧密码后改新密码。
- `PUT /api/auth/cloud-sync`：切换 `cloudSyncEnabled`。

### 2 Deepseek 配置 & 上传 — `routes/config.routes.ts` + `conversation.routes.ts` + `services/deepseekParser.ts`
- `deepseekParser.ts`：
  1. `multer` 接收 zip（内存）→ `adm-zip` 解压。
  2. 找 `user.json` → 解析 `{user_id, email, mobile}`。
  3. 找 `conversations.json` → 解析数组 → 对每条：树→扁平化（DFS 从 `root` 沿 `children` 主干，收集所有节点 message.fragments，`REQUEST`=USER、`RESPONSE`=ASSISTANT，按 `inserted_at` 排序）。
  4. 返回 `{ deepseekUser, conversations:[{deepseekConvId,title,insertedAt,updatedAt,mapping, messages:[{nodeId,parentId,role,model,content,insertedAt}]}] }`。
- `POST /api/configs`（带 `multipart/form-data`：zip + name）：
  1. 解析后按 `(userId, deepseekUserId)` 查找现有 config。
  2. 命中→**增量更新**：对不在该 config 的 `deepseekConvId` 新增；已存在则按 `updatedAt` 更新 mapping/messages。未命中→新建 config。
  3. 若 `user.cloudSyncEnabled=true`：写入 MySQL（Conversation/Message）；返回结构化数据。
  4. 若 `false`：**不落库**，仅返回结构化数据给前端存 IndexedDB。
- `PUT /api/configs/:id/upload`：同上，归属该校 config 增量。
- `GET /api/configs` / `GET /api/configs/:id` / `DELETE /api/configs/:id`：CRUD（cloud=false 时仅返回本地已有索引，后端无数据则提示）。
- `GET /api/conversations?configId=&q=`：服务端按 title/content 模糊搜索（cloud=true 时可用）。

### 3 API Key — `routes/apikey.routes.ts`
- `POST/GET/DELETE /api/apikeys`：增删查（密钥加密存库，列表只返回 name+掩码）。

### 4 余额查询 — `routes/balance.routes.ts` + `services/deepseekApi.ts`
- `GET /api/balance/:keyId`：取该用户 API Key 解密 → 调 `GET {DEEPSEEK_API_BASE}/user/balance`（或对应余额端点）→ 返回余额。错误统一包装。

### 5 时间线 — `routes/timeline.routes.ts`
- `GET /api/timeline?configId=&type=`：聚合为多种类型：`by_day`（每日对话数）、`by_model`（按模型分布的时序）、`by_session`（会话级事件）。cloud=true 从 DB 聚合；cloud=false 时前端用 IndexedDB 本地聚合（后端提供同样的聚合函数，前端调用本地版）。

### 6 统计图 — `routes/stats.routes.ts`
- `GET /api/stats?configId=&from=&to=&granularity=`：返回折线数据序列（每日消息数、每日对话数、模型占比、活跃时段）。前端用 echarts 渲染。

### 7 Alpaca 转换 — `routes/alpaca.routes.ts` + `services/alpacaConverter.ts`
- `POST /api/alpaca/convert?configId=&conversationIds=`：取扁平消息，按 REQUEST→RESPONSE 配对，输出 Alpaca `{instruction,input,output}` 或多轮 `{conversations:[{role,content}]}`。
- `GET /api/alpaca/download?...`：返回 `application/json` 文件流供下载。

### 8 应用市场 — `routes/market.routes.ts`
- `GET /api/market`：公开列表（首条占位：Deepseek 官网）。
- `POST/PUT/DELETE /api/market`：仅 admin。

### 9 后台管理接口 — `routes/admin.routes.ts`（全部 `requireAdmin`）
- 用户列表/禁用、配置/会话/消息查看、API Key 管理、市场 CRUD、全局统计。

## 六、前端用户端（frontend/dstoolkit_frontend/，Vue3 + NaiveUI）

### 0 基础设施
- `npm i naive-ui @vicons/ionicons5 axios flexsearch idb echarts vue-echarts markdown-it highlight.js dayjs @types/markdown-it`。
- `src/main.ts`：挂载 NaiveUI（`createDiscreteApi` 或 `n-config-provider`，支持暗色）。
- `src/utils/request.ts`：axios 实例，请求注入 `Authorization`，401 跳登录。
- `src/stores/auth.ts`：用户态、JWT、cloudSyncEnabled 持久化（localStorage）。
- `src/utils/db.ts`：`idb` 封装 IndexedDB（stores: `conversations`、`messages`、`flexIndex`）。FlexSearch `Index` 用 `export/import` 存入 IndexedDB，登录后恢复、退出清空。
- `src/router/index.ts`：改为带布局的路由 + 全局 `beforeEach` 登录守卫。

### 1 布局 — `src/layouts/MainLayout.vue`
- `n-layout` 侧边栏（菜单：搜索 / 时间线 / 统计 / Alpaca / 余额 / 应用市场 / 个人中心）+ 顶栏（用户菜单、cloud 开关切换）。Neu-morphism 风格（用户偏好）：柔和阴影、圆角、中性色。SVG 图标（用 `@vicons` 提供的 SVG，不使用 emoji）。

### 2 视图
- `views/auth/Login.vue`、`Register.vue`。
- `views/profile/Profile.vue`：改用户名/密码、API Key 管理（列表/新增/删除/掩码）、cloud 开关。
- `views/config/Configs.vue`：配置列表、`新增配置`（上传 zip + 名称）、`更新`（对某 config 再上传 zip 增量）。
- `views/search/Search.vue`：
  - 从 IndexedDB（cloud=false）或后端（cloud=true，可懒加载到 IndexedDB）取消息建 FlexSearch 索引。
  - 搜索框 + 正则开关（`new RegExp(q)` 对结果二次过滤/高亮）。
  - 结果列表 → 点击展开完整对话（markdown 渲染 + 代码高亮）。
- `views/timeline/Timeline.vue`：调 `/api/timeline` 或本地聚合，用 `n-timeline` 多类型切换。
- `views/stats/Stats.vue`：echarts 折线图（每日消息/对话数、模型占比饼图、活跃时段热力）。
- `views/alpaca/Alpaca.vue`：选 config/会话 → 预览 → 下载 JSON。
- `views/balance/Balance.vue`：选已存 API Key → 查询余额展示。
- `views/market/Market.vue`：卡片列表（Deepseek 官网占位）。

### 3 cloud 开关行为
- 切到 ON：上传的对话 + 索引落库；登录后从后端拉取并重建本地索引。
- 切到 OFF：清空 IndexedDB 中该账号的对话/索引；之后上传仅本地。
- 退出登录：清空 IndexedDB（搜索/对话数据），需重新登录才能使用。

## 七、后台管理（frontend/dstoolkit_admin/，Vue3 + ElementPlus，新建独立工程）

### 0 初始化
- 在 `frontend/` 下 `npm create vue@latest dstoolkit_admin`（TS+Router+Pinia）。
- `npm i element-plus @element-plus/icons-vue axios echarts vue-echarts`。
- `main.ts` 全量引入 ElementPlus + 图标。
- `vite.config.ts` 设 `@` 别名与 dev 代理 `/api` → `http://localhost:3000`。
- 与用户端共享同一个后端 `/api`，admin 登录用 `role=ADMIN` 账号。

### 1 视图（`@element-plus` 组件）
- `layouts/AdminLayout.vue`：`el-container` + `el-aside` 菜单 + `el-header`。
- `views/Login.vue`：仅允许 ADMIN 登录。
- `views/Dashboard.vue`：全局统计卡片 + 折线图。
- `views/Users.vue`：用户表（`el-table`，禁用/查看）。
- `views/Configs.vue`：所有用户的 Deepseek 配置与会话浏览（树形/详情抽屉）。
- `views/ApiKeys.vue`：API Key 管理表。
- `views/Market.vue`：应用市场条目 CRUD（`el-form` 弹窗）。

## 八、依赖清单

**backend/**（`package.json` 新建）
- 运行时：`express`、`cors`、`multer`、`adm-zip`、`@prisma/client`、`bcryptjs`、`jsonwebtoken`、`dotenv`、`express-rate-limit`、`zod`（校验）。
- 开发：`prisma`、`typescript`、`tsx`（dev 运行 TS）、`@types/...`、`nodemon`（或 `tsx watch`）。
- DB：`DATABASE_URL=mysql://dstoolkit:qs992400@156.238.234.95:3306/dstoolkit`。

**dstoolkit_frontend/**
- 新增：`naive-ui`、`@vicons/ionicons5`、`axios`、`flexsearch`、`idb`、`echarts`、`vue-echarts`、`markdown-it`、`highlight.js`、`dayjs`、`@types/markdown-it`、`@types/flexsearch`。

**dstoolkit_admin/**
- `element-plus`、`@element-plus/icons-vue`、`axios`、`echarts`、`vue-echarts`、`dayjs`、`pinia`、`vue-router`。

## 九、实施顺序（分阶段）

1. **后端骨架**：初始化 backend（package/ts/.env/Prisma schema + 迁移）、Express+路由占位、JWT/bcrypt、连通远程 MySQL（建表）。
2. **解析器**：`deepseekParser.ts` 用 `backend/assest/` 样例验证树→扁平输出正确。
3. **账号 + 配置上传 + API Key + 市场**接口（cloud 两条分支）。
4. **用户端骨架**：NaiveUI 接入、布局、登录/注册/个人中心、配置列表与上传、IndexedDB 封装、cloud 开关。
5. **搜索（FlexSearch+正则）**：建索引、搜索、markdown 渲染。
6. **时间线 / 统计 / Alpaca / 余额** 后端接口 + 前端视图。
7. **后台 admin 工程**：初始化、ElementPlus 布局、各管理页。
8. **收尾**：暗色主题、Neu-morphism 样式细化、错误提示、README（按需）。

## 十、假设与决策（Assumptions & Decisions）

- **认证**：JWT access token（7d），bcrypt 哈希；首个注册用户自动为 ADMIN，方便初始化后台。
- **cloud 开关语义（已确认）**：同时控制原始对话记录与搜索索引是否落 MySQL。OFF=仅 IndexedDB、退出登录清空、需重新登录使用。API Key 始终落库（余额查询跨会话所需）。
- **增量判定**：以 `user.json.user_id` 为准，匹配 `(userId, deepseekUserId)`；命中即增量合并会话（按 `deepseekConvId` 去重、按 `updatedAt` 更新），否则新建配置。
- **树→线性**：DFS 遍历 `mapping`，按节点 `inserted_at` 排序收集 fragments；`REQUEST`=USER、`RESPONSE`=ASSISTANT。Alpaca 按 REQUEST→RESPONSE 顺序配对。
- **统计口径**：以消息数/对话数/时间/模型为主（样例无统一 token 字段）；若个别 message 含 token 信息则额外读取但不依赖。
- **目录命名**：保留现有 `backend/assest`（原拼写，不改名以避免破坏引用），样例数据留作解析器测试夹具。
- **后端栈**：Express + Prisma + mysql2（Prisma 内置）。统一用 `/api` 前缀，两前端 dev 代理到此。
- **样式**：遵循用户偏好——Neu-morphism 风格、SVG 图标（`@vicons`/`@element-plus/icons-vue`，禁 emoji）、模块化设计。
- **DB 连接信息**（用户提供）：`156.238.234.95:3306` / `dstoolkit` / `qs992400` / 库 `dstoolkit`，写入 `.env`（不提交密钥到仓库）。

## 十一、验证步骤（Verification）

1. **后端解析器**：对 `backend/assest/deepseek_data-2026-08-19(1).zip` 调用 `deepseekParser`，断言输出 12 条会话、每条 messages 已扁平、REQUEST/RESPONSE 正确归类。
2. **账号**：注册→登录→拿 token；`/api/auth/me` 返回正确；改密后旧 token 失效或可继续（按实现）。
3. **上传增量**：先用样例 zip 建配置 A；再次上传同一 zip（改名）应识别为同 deepseekUserId → 增量更新而非新建。
4. **cloud 开关**：OFF 时上传后查 MySQL 无新增 Conversation/Message；ON 时有；退出登录后前端 IndexedDB 为空。
5. **搜索**：建索引后输入关键词命中；开启正则输入 `\d{4}` 仅返回含 4 位数字的内容。
6. **时间线/统计**：返回数据点数量与样例时间范围一致；echarts 正常渲染。
7. **Alpaca**：转换输出符合 Alpaca schema（instruction/output 成对）。
8. **余额**：用真实 API Key 调用返回余额（或后端返回明确错误）。
9. **admin**：ADMIN 登录后可见全部用户数据；普通 USER 登录 admin 被拒。
10. **构建**：`npm run build`（三端）均通过；`vue-tsc` 类型检查通过。
