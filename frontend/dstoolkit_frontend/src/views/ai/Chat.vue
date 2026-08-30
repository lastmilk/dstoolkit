<script setup lang="ts">
/**
 * AI 聊天页（Element-Plus 容器布局 + TDesign Chat 组件）
 *  - Element-Plus 容器布局 + 玻璃拟态卡片包裹
 *  - Pinia + localStorage 持久化消息历史（key: ai_chat_history）
 *  - 清空历史（sweetalert 二次确认）、导出会话
 *  - 模拟 AI 回复：setTimeout 1 秒随机话术
 */
import { ref, watch, nextTick, onMounted } from 'vue'
import { defineStore } from 'pinia'
import {
  ElContainer, ElHeader, ElMain, ElButton, ElIcon, ElSpace,
  ElTooltip,
} from 'element-plus'
import {
  ChatDotRound, Delete, Download, RefreshRight, MagicStick, User,
} from '@element-plus/icons-vue'
import { useToast } from 'vue-toastification'
import Swal from 'sweetalert2'

const STORAGE_KEY = 'ai_chat_history'

export type ChatRole = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: ChatRole
  content: string
  timestamp: number
}

const aiReplies = [
  '好的，我来帮您分析一下这个问题。根据您的描述，建议可以从以下几个角度入手：一是梳理业务流程中的关键节点，二是检查数据链路的完整性，三是验证边界条件是否覆盖。',
  '这个问题很有意思！让我思考一下：通常这类场景可以采用分层解耦的思路，先做抽象再做具体实现。需要我给出具体的代码示例吗？',
  '明白了，您的需求我已经记录。基于最佳实践，我建议优先考虑性能与可维护性的平衡，渐进式迭代比一步到位更稳妥。',
  '收到！我为您整理了 3 条可行方案：\n1. 方案 A：快速落地，适合 MVP 验证\n2. 方案 B：平衡架构，适合中长期\n3. 方案 C：极致优化，适合高并发场景\n您倾向于哪种？',
  '没问题～这就让我帮您处理。另外提醒一下，记得备份关键数据，并在测试环境先验证哦。',
  '我已经理解了您的意图，如果需要更深入的讨论，可以把上下文再补充详细一些，我会给出更精准的建议！',
]

const defaultMessages: ChatMessage[] = [
  {
    id: 'init-1',
    role: 'assistant',
    content: '您好！我是 Chronos AI 助手 🤖，擅长数据分析、架构建议与代码解读。有什么可以帮您的吗？',
    timestamp: Date.now() - 3600_000,
  },
  {
    id: 'init-2',
    role: 'user',
    content: '你好，我想了解一下如何优化前端项目的构建速度？',
    timestamp: Date.now() - 3500_000,
  },
  {
    id: 'init-3',
    role: 'assistant',
    content: '前端构建优化可以从以下几个维度入手：\n\n**1. 依赖层面**\n- 升级构建工具到最新稳定版（Vite 8 / Webpack 5 等）\n- 使用更轻量的替代库（如 dayjs 替代 moment）\n- 通过 `include/exclude` 精确匹配转译范围\n\n**2. 缓存层面**\n- 开启持久化缓存（cacheDir / filesystem cache）\n- 合理配置 splitChunks，将不变的 vendor 拆分出来\n\n**3. 并行与增量**\n- 利用多核 CPU 进行并行压缩/转译\n- 开发阶段使用 HMR + 按需加载，避免冷启动全量构建\n\n需要我针对您当前的项目给出具体配置建议吗？',
    timestamp: Date.now() - 3400_000,
  },
  {
    id: 'init-4',
    role: 'user',
    content: '好的，谢谢！我用的是 Vite，可以再详细说说 Vite 的优化技巧吗？',
    timestamp: Date.now() - 3300_000,
  },
  {
    id: 'init-5',
    role: 'assistant',
    content: '针对 Vite 项目，推荐以下实战技巧：\n\n✅ **开发阶段**\n- `server.warmup` 预热常用路由/组件入口\n- 使用 `optimizeDeps.include` 预构建大型依赖，避免按需加载时的二次预构建\n- 合理拆分动态 import，减少单 chunk 体积\n\n✅ **构建阶段**\n- `build.rollupOptions.output.manualChunks` 按策略分包（vue/echarts/antd 等各成一包）\n- 开启 `build.minify: \'esbuild\'`，相比 terser 快 20~40 倍\n- `build.target` 适当提升（如 `es2020`），减少 polyfill 体积\n\n✅ **监控分析**\n- `npx vite-bundle-analyzer` 分析产物体积\n- `--debug` 启动看预构建与插件耗时\n\n需要我帮您写一份 Vite 配置模板吗？',
    timestamp: Date.now() - 3200_000,
  },
]

const useAiChatStore = defineStore('aiChat', {
  state: () => ({
    messages: [] as ChatMessage[],
  }),
  getters: {
    hasMessages: (s) => s.messages.length > 0,
  },
  actions: {
    load() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (Array.isArray(parsed) && parsed.length) {
            this.messages = parsed
            return
          }
        }
      } catch (_) {
        // ignore
      }
      this.messages = JSON.parse(JSON.stringify(defaultMessages))
      this.persist()
    },
    persist() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.messages))
      } catch (_) {
        // ignore
      }
    },
    add(msg: ChatMessage) {
      this.messages.push(msg)
      this.persist()
    },
    clear() {
      this.messages = []
      try { localStorage.removeItem(STORAGE_KEY) } catch (_) { /* ignore */ }
    },
    restoreDefault() {
      this.messages = JSON.parse(JSON.stringify(defaultMessages))
      this.persist()
    },
  },
})

function formatContent(text: string): string {
  const escapeHtml = (s: string) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const escaped = escapeHtml(text)
  let html = escaped
    .replace(/^### (.*)$/gm, '<h4 class="md-h4">$1</h4>')
    .replace(/^## (.*)$/gm, '<h3 class="md-h3">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>')
    .replace(/`([^`]+?)`/g, '<code class="md-code">$1</code>')
    .replace(/^- (.*)$/gm, '<li class="md-li">$1</li>')
    .replace(/^✅ /gm, '<span class="md-check">✅&nbsp;</span>')
    .replace(/\n/g, '<br/>')
  return html
}

const toast = useToast()
const store = useAiChatStore()

const inputValue = ref('')
const isLoading = ref(false)
const chatContainerRef = ref<HTMLElement | null>(null)

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function scrollToBottom() {
  nextTick(() => {
    const el = chatContainerRef.value
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  })
}

watch(
  () => store.messages.length,
  () => scrollToBottom(),
)

onMounted(() => {
  store.load()
  scrollToBottom()
})

function pickAiReply(): string {
  return aiReplies[Math.floor(Math.random() * aiReplies.length)] ?? ''
}

function handleSend() {
  const text = inputValue.value.trim()
  if (!text || isLoading.value) return
  store.add({
    id: uid(),
    role: 'user',
    content: text,
    timestamp: Date.now(),
  })
  inputValue.value = ''
  isLoading.value = true
  setTimeout(() => {
    store.add({
      id: uid(),
      role: 'assistant',
      content: pickAiReply(),
      timestamp: Date.now(),
    })
    isLoading.value = false
  }, 1000)
}

async function handleClearHistory() {
  const result = await Swal.fire({
    title: '确认清空对话历史？',
    text: '此操作将删除当前全部聊天记录，且无法恢复。',
    icon: 'warning',
    iconColor: '#F59E0B',
    showCancelButton: true,
    confirmButtonText: '确认清空',
    cancelButtonText: '取消',
    customClass: {
      popup: 'sweet-popup',
      title: 'sweet-title',
      confirmButton: 'sweet-btn-confirm',
      cancelButton: 'sweet-btn-cancel',
    },
    buttonsStyling: false,
  })
  if (result.isConfirmed) {
    store.clear()
    toast.success('对话历史已清空')
  }
}

function handleRestoreDemo() {
  store.restoreDefault()
  toast.info('已恢复示例对话')
}

function handleExport() {
  if (!store.hasMessages) {
    toast.warning('当前没有可导出的对话')
    return
  }
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  const lines: string[] = []
  lines.push(`# Chronos AI 对话导出`)
  lines.push(`> 导出时间：${now.toLocaleString()}`)
  lines.push(`> 消息数：${store.messages.length}`)
  lines.push('')
  lines.push('---')
  lines.push('')
  for (const m of store.messages) {
    const t = new Date(m.timestamp).toLocaleString()
    const role = m.role === 'user' ? '👤 用户' : '🤖 Chronos AI'
    lines.push(`### ${role}  ·  ${t}`)
    lines.push('')
    lines.push(m.content)
    lines.push('')
  }
  const content = lines.join('\n')
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `ai-chat-${stamp}.md`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 2000)
  toast.success('对话已导出为 Markdown 文件')
}

function formatTime(ts: number) {
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}
</script>

<template>
  <el-container class="ai-chat-page">
    <!-- 页面头部 -->
    <el-header class="ai-chat-header page-enter" height="auto">
      <div class="ai-head-left">
        <div class="ai-head-icon">
          <el-icon :size="22"><ChatDotRound /></el-icon>
        </div>
        <div class="ai-head-main">
          <div class="ai-head-meta">
            <span class="chrono-stamp">AI // CHAT ASSISTANT</span>
          </div>
          <h2 class="ai-head-title">智能对话 · Chronos AI</h2>
          <p class="ai-head-sub">与 AI 助手自由交流，历史自动保存本地</p>
        </div>
      </div>

      <!-- 功能栏 -->
      <el-space :size="8" wrap class="ai-head-actions">
        <el-tooltip content="恢复示例对话" placement="bottom">
          <el-button size="default" @click="handleRestoreDemo">
            <el-icon><RefreshRight /></el-icon>
            <span>&nbsp;示例对话</span>
          </el-button>
        </el-tooltip>
        <el-tooltip content="导出为 Markdown" placement="bottom">
          <el-button size="default" type="success" plain @click="handleExport">
            <el-icon><Download /></el-icon>
            <span>&nbsp;导出会话</span>
          </el-button>
        </el-tooltip>
        <el-tooltip content="清空历史记录" placement="bottom">
          <el-button size="default" type="danger" plain @click="handleClearHistory">
            <el-icon><Delete /></el-icon>
            <span>&nbsp;清空历史</span>
          </el-button>
        </el-tooltip>
      </el-space>
    </el-header>

    <!-- 主体：玻璃拟态卡片包裹聊天区 -->
    <el-main class="ai-chat-main">
      <div class="glass-card ai-chat-card page-enter">
        <!-- 消息列表 -->
        <div class="chat-messages" ref="chatContainerRef">
          <template v-if="store.messages.length === 0">
            <div class="chat-empty">
              <el-icon :size="44" class="empty-icon"><MagicStick /></el-icon>
              <div class="empty-title">对话已清空</div>
              <div class="empty-sub">试试发送第一条消息，或点击「示例对话」恢复演示</div>
            </div>
          </template>
          <template v-else>
            <div
              v-for="m in store.messages"
              :key="m.id"
              class="chat-msg"
              :class="m.role === 'user' ? 'msg-user' : 'msg-ai'"
            >
              <div class="msg-avatar" :class="m.role === 'user' ? 'av-user' : 'av-ai'">
                <el-icon :size="18"><component :is="m.role === 'user' ? User : MagicStick" /></el-icon>
              </div>
              <div class="msg-body">
                <div class="msg-meta">
                  <span class="msg-role">{{ m.role === 'user' ? '我' : 'Chronos AI' }}</span>
                  <span class="msg-time">{{ formatTime(m.timestamp) }}</span>
                </div>
                <div class="msg-bubble">
                  <div class="msg-content" v-html="formatContent(m.content)"></div>
                </div>
              </div>
            </div>

            <div v-if="isLoading" class="chat-msg msg-ai">
              <div class="msg-avatar av-ai">
                <el-icon :size="18"><MagicStick /></el-icon>
              </div>
              <div class="msg-body">
                <div class="msg-meta">
                  <span class="msg-role">Chronos AI</span>
                  <span class="msg-time typing">正在输入…</span>
                </div>
                <div class="msg-bubble ai-typing">
                  <span class="typing-dot d1"></span>
                  <span class="typing-dot d2"></span>
                  <span class="typing-dot d3"></span>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 输入区 -->
        <div class="chat-input-bar">
          <el-input
            v-model="inputValue"
            type="textarea"
            :rows="2"
            resize="none"
            placeholder="输入消息，Enter 发送 / Shift+Enter 换行…"
            @keydown.enter.exact.prevent="handleSend"
            class="chat-input"
          />
          <el-button
            type="primary"
            size="large"
            :disabled="!inputValue.trim() || isLoading"
            @click="handleSend"
            class="send-btn"
          >
            <el-icon><ChatDotRound /></el-icon>
            <span>&nbsp;发送</span>
          </el-button>
        </div>
      </div>
    </el-main>
  </el-container>
</template>

<style scoped>
.ai-chat-page {
  width: 100%;
  height: 100%;
  min-height: calc(100vh - 120px);
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 4px 2px 32px;
}

/* ═══════════ 头部 ═══════════ */
.ai-chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 18px 4px 4px;
  flex-wrap: wrap;
}
.ai-head-left {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
}
.ai-head-icon {
  width: 48px; height: 48px;
  border-radius: 14px;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.14), rgba(14, 165, 233, 0.12));
  color: var(--primary, #4F46E5);
  flex-shrink: 0;
  border: 1px solid rgba(79, 70, 229, 0.2);
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.12);
}
.ai-head-main { flex: 1; min-width: 0; }
.ai-head-meta {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;
}
.ai-head-title {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.01em;
  color: var(--text, #0F172A);
}
.ai-head-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.55;
}
.chrono-stamp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 10.5px;
  font-weight: 600;
  color: #4F46E5;
  background: rgba(79, 70, 229, 0.09);
  border: 1px solid rgba(79, 70, 229, 0.16);
  border-radius: 6px;
  letter-spacing: 0.06em;
}
.ai-head-actions { flex-shrink: 0; }

/* ═══════════ 聊天卡片（玻璃拟态） ═══════════ */
.ai-chat-main {
  padding: 0 4px;
  flex: 1;
  display: flex;
}
.ai-chat-card {
  flex: 1;
  padding: 0;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 240px);
  min-height: 540px;
  border-radius: 18px;
}

/* ═══════════ 消息列表 ═══════════ */
.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 22px 22px 18px;
  display: flex;
  flex-direction: column;
  gap: 18px;
}
.chat-empty {
  margin: auto;
  text-align: center;
  color: var(--text-muted);
  padding: 60px 20px;
}
.empty-icon {
  color: var(--primary);
  opacity: 0.6;
  margin-bottom: 14px;
}
.empty-title {
  font-size: 16px;
  font-weight: var(--font-weight-bold);
  color: var(--text-secondary);
  margin-bottom: 6px;
}
.empty-sub {
  font-size: 13px;
  color: var(--text-muted);
}

.chat-msg {
  display: flex;
  gap: 12px;
  max-width: 100%;
  animation: msg-in 260ms var(--ease-out) both;
}
@keyframes msg-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
.msg-user { flex-direction: row-reverse; }
.msg-avatar {
  width: 38px; height: 38px;
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
}
.av-ai {
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.16), rgba(14, 165, 233, 0.14));
  color: var(--primary);
  border: 1px solid rgba(79, 70, 229, 0.18);
}
.av-user {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.16), rgba(20, 184, 166, 0.14));
  color: #059669;
  border: 1px solid rgba(16, 185, 129, 0.18);
}
.msg-body {
  max-width: min(82%, 760px);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.msg-user .msg-body { align-items: flex-end; }
.msg-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 4px;
  font-size: 11.5px;
}
.msg-role {
  font-weight: var(--font-weight-semibold, 600);
  color: var(--text-secondary);
}
.msg-time {
  color: var(--text-muted);
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 11px;
}
.msg-time.typing {
  color: var(--primary);
  animation: pulse-text 1.2s ease-in-out infinite;
}
@keyframes pulse-text {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

.msg-bubble {
  padding: 12px 15px;
  border-radius: 14px;
  font-size: 14px;
  line-height: 1.7;
  word-break: break-word;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  border: 1px solid transparent;
}
.msg-ai .msg-bubble {
  background: color-mix(in srgb, var(--surface-2, #F8FAFC) 92%, transparent);
  border: 1px solid color-mix(in srgb, var(--border) 60%, transparent);
  border-top-left-radius: 4px;
  color: var(--text);
}
.msg-user .msg-bubble {
  background: linear-gradient(135deg, #4F46E5, #6366F1);
  color: #FFFFFF;
  border-top-right-radius: 4px;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.22);
}

.msg-content :deep(.md-h3) {
  font-size: 15px;
  font-weight: var(--font-weight-bold);
  margin: 10px 0 6px;
  color: inherit;
}
.msg-content :deep(.md-h4) {
  font-size: 13.5px;
  font-weight: var(--font-weight-bold);
  margin: 10px 0 4px;
  color: inherit;
}
.msg-content :deep(.md-bold) {
  font-weight: var(--font-weight-bold);
}
.msg-content :deep(.md-code) {
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 12.5px;
  padding: 2px 6px;
  border-radius: 6px;
  background: rgba(79, 70, 229, 0.10);
  color: var(--primary);
}
.msg-user .msg-bubble .msg-content :deep(.md-code) {
  background: rgba(255, 255, 255, 0.18);
  color: #FFFFFF;
}
.msg-content :deep(.md-li) {
  display: block;
  margin: 2px 0 2px 4px;
  padding-left: 16px;
  position: relative;
}
.msg-content :deep(.md-li)::before {
  content: '•';
  position: absolute;
  left: 2px;
  color: var(--primary);
  font-weight: var(--font-weight-bold);
}
.msg-user .msg-bubble .msg-content :deep(.md-li)::before {
  color: rgba(255, 255, 255, 0.85);
}
.msg-content :deep(.md-check) {
  font-weight: var(--font-weight-bold);
}

/* AI 正在输入动画 */
.ai-typing {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 14px 18px;
  min-width: 80px;
}
.typing-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--primary);
  opacity: 0.5;
  animation: typing-bounce 1.2s ease-in-out infinite;
}
.typing-dot.d2 { animation-delay: 0.18s; }
.typing-dot.d3 { animation-delay: 0.36s; }
@keyframes typing-bounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.45; }
  30% { transform: translateY(-6px); opacity: 1; }
}

/* ═══════════ 输入区 ═══════════ */
.chat-input-bar {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 14px 18px 18px;
  border-top: 1px solid color-mix(in srgb, var(--border) 70%, transparent);
  background: color-mix(in srgb, var(--surface) 60%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
  backdrop-filter: saturate(180%) blur(14px);
  border-bottom-left-radius: 18px;
  border-bottom-right-radius: 18px;
}
.chat-input {
  flex: 1;
}
.chat-input :deep(.el-textarea__inner) {
  border-radius: 12px;
  padding: 10px 14px;
  font-size: 14px;
  font-family: var(--font-family-harmony);
  line-height: 1.6;
  min-height: 44px !important;
  max-height: 160px !important;
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}
.chat-input :deep(.el-textarea__inner:focus) {
  border-color: var(--primary);
  box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.12);
}
.send-btn {
  height: 44px;
  padding: 0 20px;
  border-radius: 12px;
  font-weight: var(--font-weight-semibold, 600);
  flex-shrink: 0;
}

/* ═══════════ 响应式 ═══════════ */
@media (max-width: 768px) {
  .ai-chat-header { padding: 14px 2px 4px; }
  .ai-head-title { font-size: 19px; }
  .ai-chat-card {
    min-height: 500px;
    height: calc(100vh - 300px);
    border-radius: 14px;
  }
  .chat-messages { padding: 16px 14px 12px; }
  .msg-body { max-width: 85%; }
  .chat-input-bar { padding: 12px 12px 14px; }
  .send-btn { padding: 0 14px; }
}
</style>
