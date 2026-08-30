# 计划：ChatViewer 重写为 TDesign Chat（vue-next-chat）+ 全站自绘控件 TDesign 化

## Summary

1. 安装 `@tdesign-vue-next/chat@0.6.0`，用它**重写现有 ChatViewer** 为全新 AI 对话界面（Explore 继续对话 + ShareView 只读两处复用，不加新页面）。
2. 将全站遗留的**自绘控件**统一替换为 TDesign 原生控件：
   - Pricing：计费周期切换（billing-tab 按钮）、套餐 CTA 按钮、支付方式单选卡（隐藏 input radio）
   - Explore：热门搜索 chips（qw-chip）、AI 智能过滤 chips（ai-chip）
   - Alpaca：模式切换容器（mode-toggle，内部已是 t-switch，改为 t-radio-button 分段）
   - ChatViewer 的 msg-action-btn 随 B 项重写一并消失（由 ChatItem 操作能力承接）
3. 移动端底部 tabbar 保留自定义实现（TDesign 无 TabBar 组件），仅做样式微调。

## Current State Analysis

- 项目已全局注册 `tdesign-vue-next@1.20.7`（main.ts `app.use(TDesign)`），类型走 `types: ["tdesign-vue-next/global.d.ts"]`；命令式反馈在 `src/utils/feedback.ts`。
- `src/components/ChatViewer.vue`（约 700 行）：自绘消息流 + MarkdownView 渲染；`runStream()` 用 fetch 调 `POST /api/chat`（Bearer token，body: `{keyId, model, messages}`），解析 OpenAI 风格 SSE（`data: {choices:[{delta:{content}}]}`、`data: [DONE]`）；支持：历史消息展示、用户消息"编辑并重新生成"、模型/API Key 下拉、流式气泡 + loading。被 `Explore.vue:1060`（含 apiKeys）与 `ShareView.vue:96`（apiKeys=[], 只读）复用。
- 遗留自绘控件（已逐处确认行号）：
  - `Pricing.vue:554-567` 计费周期 `.billing-tab` 原生按钮组（单选语义，`selectBilling(tier.id, b.period)`，位于可点击卡片内需 `.stop`）
  - `Pricing.vue:588-595` `.tier-cta` 原生按钮（`selectTier(tier.id)`，同在卡片内）
  - `Pricing.vue:665-704` 支付方式：`<label class="payment-card">` + 隐藏 `<input type="radio">`（`selectedPayment`/`selectPayment`/`methodAvailability` 禁用逻辑）
  - `Explore.vue:757-781` 热搜词云 `.qw-chip` 原生按钮（点击即搜 `clickHotword(w.word)`，带逐项动态颜色/字号内联样式）
  - `Explore.vue:827-843` AI 过滤 `.ai-chip` 原生按钮（单选切换 `toggleAiFilter(f.id)`）
  - `Alpaca.vue:161-168` `.mode-toggle` 自绘容器包着 `t-switch`（多轮/单轮切换）
  - `ChatViewer.vue:310-319` `.msg-action-btn` 原生按钮（编辑重发）
- `@tdesign-vue-next/chat`：npm 最新 0.6.0（MIT，依赖 tdesign-vue-next）。提供 `Chat`（Chatbot 整合件）、`ChatList`、`ChatItem`、`ChatInput`、`ChatAction`、`ChatActionBar`、`ChatContent`、`ChatLoading`、`ChatMarkdown`；支持自定义协议 `chatServiceConfig.onMessage` 映射 SSE。

## Proposed Changes

### A. 引入 @tdesign-vue-next/chat

- 文件：`frontend/dstoolkit_frontend/package.json`、`src/main.ts`、`tsconfig.app.json`
- 做法：
  1. `npm i @tdesign-vue-next/chat --legacy-peer-deps`（沿用项目 .npmrc 环境的安装习惯）
  2. `main.ts`：`import TDesignChat from '@tdesign-vue-next/chat'` + `import '@tdesign-vue-next/chat/es/style/index.css'`，`app.use(TDesign).use(TDesignChat)`
  3. `tsconfig.app.json` 的 `types` 增加 `"@tdesign-vue-next/chat/global"`（编辑器提示）

### B. 用 vue-next-chat 重写 ChatViewer（全新 AI 对话界面）

- 文件：`src/components/ChatViewer.vue`（整体重写，保持对外 props 不变：`conversation: ParsedConversation | null`、`apiKeys: Array<{id, name}>`）
- **架构决策：组合式**（`ChatList` + `ChatItem` + `ChatLoading` + `ChatInput` + `ChatAction`），**不用** `Chat`/Chatbot 整合件 —— 理由：现有 `runStream()` 的 Bearer 鉴权、keyId/model 注入、OpenAI 格式 SSE 解析已被验证可用；整合件的 `chatServiceConfig` 对自定义 header/body 的支持未确认，组合式零后端改动、风险最低，同时获得官方气泡/头像/Markdown/打字机视觉。
- **实施首步（关键）**：安装后先读 `node_modules/@tdesign-vue-next/chat/es/*.d.ts`（ChatItem/ChatInput/ChatList 的 props/slots/emits），以下映射按 0.6.x 文档常见 API 预写，实现时以 d.ts 为准校正：
  - 历史消息：`ParsedMessage[]` → `ChatItem`（`role: 'user'|'assistant'`、`avatar`（用户 PersonOutline / AI SparklesSharp，沿用现有配色 class）、`name`（用户名 / 'Deepseek AI'）、`datetime`（dayjs MM-DD HH:mm:ss）、`content`（AI 走 `ChatMarkdown` 或 ChatItem 的 markdown 渲染；用户为纯文本）、`text-variant`/气泡样式按官方默认）
  - 流式中：末尾渲染 `ChatItem` + `ChatLoading`（animation）承接现有 `streaming/streamingContent` 状态；保留现有节流滚动到底逻辑
  - 编辑重发：用户消息的 `ChatItem` 操作区（`ChatAction` 处理复制等默认项 + 自定义"编辑"动作按钮 `t-button variant="text" size="small"`）触发现有 `startEdit/saveEdit` 流程；编辑态输入框用 `t-textarea`（沿用现逻辑）
  - 输入区：`ChatInput`（替代自绘 composer：t-textarea + 发送 t-button + toolbar），上方保留模型/Key 两个 `t-select`（现有 `modelOptions/keyOptions` 逻辑不动）；`canSend` 门控不变；ShareView 因 `apiKeys` 为空 → 只渲染 `ChatList`/`ChatItem` 只读列表，不渲染输入区（现有行为保持）
  - 空状态：`conversation` 为 null 时的占位 UI 保留现有设计
- 样式：气泡/头像配色沿用现有主题变量（--primary/--surface/--border）；scoped 样式大幅精简（视觉主要由 Chat 组件承担）

### C. 自绘控件 TDesign 化

1. **Pricing.vue**
   - 计费周期切换（L555-567）：`.billing-tab` 按钮组 → `t-radio-group`（`variant="default-filled"` 按钮 型，`size="small"`），`:value="getBilling(tier).period"`、`@change="(v) => selectBilling(tier.id, String(v))"`；外层包 `<div class="billing-toggle" @click.stop>` 阻断卡片点击冒泡
   - 套餐 CTA（L589-595）：`button.tier-cta` → `t-button`（`block`；`tier.highlight` 时 `theme="primary"`，否则 `variant="outline"`），保留箭头 `#icon`；同样置于 `@click.stop` 包裹层
   - 支付方式卡（L665-704）：`<label>`+隐藏 input → `<div class="payment-card" role="radio">` + 卡内 `t-radio`（`:value="m.id"`、`:disabled="!methodAvailability[m.id]"`、`@change="selectPayment(m.id)"`，或 `t-radio-group v-model` + `t-radio`）；选中态 `.selected` class 由 `selectedPayment === m.id` 驱动不变；品牌 SVG 图标与禁用逻辑原样保留
2. **Explore.vue**
   - 热搜词云（L759-779）：`button.qw-chip` → `t-tag`（`@click="clickHotword(w.word)"`，`style` 保留逐项颜色/字号/动画延迟内联样式，`cursor: pointer`）——词云是"点击即搜"动作 chips，保色彩云视觉，仅换原生 TDesign 组件承载
   - AI 过滤 chips（L833-842）：`button.ai-chip`（单选切换）→ `t-check-tag`（`:checked="activeAiFilter === f.id"`、`@change="toggleAiFilter(f.id)"`，size 由内容自定义 class 微调）
3. **Alpaca.vue**
   - 模式切换（L161-168）：`.mode-toggle` 容器 + t-switch → `t-radio-group variant="default-filled" size="small"` + 两个 `t-radio-button`（`多轮对话`/`单轮问答`，v-model 绑定 `multiTurn` 布尔，change 时做 boolean 转换），删除自绘容器样式
4. **MainLayout.vue 底部 tabbar**：保留现有自定义实现，仅将 `.tabbar-item` 的按下态/激活态颜色对齐 TDesign 令牌（--td-brand-color 已由主题系统映射，基本无需改动，目检微调即可）

## Assumptions & Decisions

- **不新增页面**：仅重构现有 ChatViewer，Explore/ShareView 调用方式不变（props 兼容）。
- **后端零改动**：`/api/chat` 保持 OpenAI 风格 SSE，由前端现有 `runStream` 消化。
- **组合式而非 Chatbot 整合件**：保住鉴权/编辑重发/Key 选择等现有能力，避免对 chatServiceConfig 未文档化能力的依赖。
- vue-next-chat 0.6.0 文档标注多语言暂不支持（新版），组件内文案（如 placeholder）以 props/插槽自定义为准；如遇中文默认文案缺口，用 scoped CSS/props 兜底，不回退 0.4 版本。
- `t-radio-*` / `t-check-tag` / `t-tag` 均为已注册全局组件，无需逐文件 import。

## Verification

1. `cd frontend/dstoolkit_frontend && ./node_modules/.bin/vue-tsc --noEmit -p tsconfig.app.json` → 零错误
2. `./node_modules/.bin/vite build` → 成功（EXIT=0）
3. 启动 dev server（`[::1]:5173`），浏览器冒烟：
   - `/portal`、`/login`、`/register` 控制台零错误（回归）
   - `/pricing`（若无需登录可看）：计费切换 radio 生效、CTA 不触发卡片冒泡点击、支付卡选中/禁用正常
   - ChatViewer 相关（Explore/ShareView 需登录）：请用户登录后目检——历史消息渲染、流式输出、编辑重发、模型/Key 切换、ShareView 只读无输入框
4. 残留扫描：`rg '<button' src/views src/components`（排除 MainLayout tabbar）确认无遗漏自绘交互按钮；`rg 'naive-ui|<N[A-Z]'` 保持为零
