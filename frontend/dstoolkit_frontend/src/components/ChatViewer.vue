<script setup lang="ts">
import { computed, nextTick, ref, watch, h } from 'vue'
import {
  NButton,
  NEmpty,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NText,
  NIcon,
} from 'naive-ui'
import dayjs from 'dayjs'
import {
  PersonOutline,
  SparklesSharp,
  CreateOutline,
  CheckmarkOutline,
  CloseOutline,
  SendOutline,
  ChevronDownOutline,
  GitBranchOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { message } from '@/utils/naive'
import MarkdownView from './MarkdownView.vue'
import GitFloatingPanel from '@/git/components/GitFloatingPanel.vue'
import type { ParsedConversation, ParsedMessage } from '@/types'

const props = defineProps<{
  conversation: ParsedConversation | null
  apiKeys: Array<{ id: number; name: string }>
}>()

const authStore = useAuthStore()

const messages = ref<ParsedMessage[]>([])
const selectedKeyId = ref<number | null>(null)
const selectedModel = ref<string>('deepseek-chat')
const inputText = ref('')
const streaming = ref(false)
const streamingContent = ref('')
const editingIndex = ref<number | null>(null)
const editText = ref('')
const showGitPanel = ref(false)

const bottomRef = ref<HTMLElement | null>(null)

const keyOptions = computed(() =>
  props.apiKeys.map((k) => ({ label: k.name, value: k.id })),
)

const modelOptions = [
  { label: 'deepseek-chat', value: 'deepseek-chat' },
  { label: 'deepseek-reasoner', value: 'deepseek-reasoner' },
]

watch(
  () => props.conversation,
  (conv) => {
    messages.value = conv ? [...conv.messages] : []
    editingIndex.value = null
    editText.value = ''
    streaming.value = false
    streamingContent.value = ''
  },
  { immediate: true },
)

function scrollToBottom() {
  nextTick(() => {
    bottomRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  })
}

let scrollTimer: ReturnType<typeof setTimeout> | null = null
function throttledScrollToBottom() {
  if (scrollTimer) return
  scrollTimer = setTimeout(() => {
    scrollTimer = null
    nextTick(() => {
      bottomRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, 200)
}

watch(() => messages.value.length, scrollToBottom)
watch(streamingContent, throttledScrollToBottom)

function toPayload(msgs: ParsedMessage[]) {
  return msgs.map((m) => ({ role: m.role.toLowerCase(), content: m.content }))
}

async function runStream(payload: Array<{ role: string; content: string }>) {
  streaming.value = true
  streamingContent.value = ''
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        keyId: selectedKeyId.value,
        model: selectedModel.value,
        messages: payload,
      }),
    })
    if (!response.body) throw new Error('No stream body')
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let stopped = false
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') {
          stopped = true
          break
        }
        try {
          const parsed = JSON.parse(data)
          if (parsed.error) {
            console.error(parsed.error)
            stopped = true
            break
          }
          const delta = parsed.choices?.[0]?.delta?.content
          if (delta) streamingContent.value += delta
        } catch {
          /* ignore */
        }
      }
      if (stopped) break
    }
  } catch (err) {
    console.error(err)
    message.error('请求失败，请检查网络或 API Key')
  } finally {
    streaming.value = false
    if (scrollTimer) {
      clearTimeout(scrollTimer)
      scrollTimer = null
    }
    scrollToBottom()
  }
}

function makeAssistant(): ParsedMessage {
  return {
    nodeId: `stream-${Date.now()}`,
    parentId: null,
    role: 'ASSISTANT',
    model: selectedModel.value,
    content: streamingContent.value,
    insertedAt: new Date().toISOString(),
  }
}

async function sendMessage() {
  const text = inputText.value.trim()
  if (!text || streaming.value) return
  if (selectedKeyId.value == null) {
    message.warning('请先选择一个 API Key')
    return
  }
  messages.value.push({
    nodeId: `user-${Date.now()}`,
    parentId: null,
    role: 'USER',
    model: null,
    content: text,
    insertedAt: new Date().toISOString(),
  })
  inputText.value = ''
  await runStream(toPayload(messages.value))
  messages.value.push(makeAssistant())
}

function startEdit(index: number) {
  const m = messages.value[index]
  if (!m) return
  editingIndex.value = index
  editText.value = m.content
}

function cancelEdit() {
  editingIndex.value = null
  editText.value = ''
}

async function saveEdit() {
  if (editingIndex.value == null) return
  const idx = editingIndex.value
  const editedText = editText.value.trim()
  if (!editedText || streaming.value) return
  messages.value = messages.value.slice(0, idx)
  messages.value.push({
    nodeId: `user-edit-${Date.now()}`,
    parentId: null,
    role: 'USER',
    model: null,
    content: editedText,
    insertedAt: new Date().toISOString(),
  })
  editingIndex.value = null
  editText.value = ''
  await runStream(toPayload(messages.value))
  messages.value.push(makeAssistant())
}

const canSend = computed(
  () =>
    !streaming.value &&
    inputText.value.trim().length > 0 &&
    selectedKeyId.value != null,
)
</script>

<template>
  <div class="chat-viewer surface">
    <!-- ============ 空状态 ============ -->
    <div v-if="!conversation" class="empty-state">
      <div class="empty-icon brand-gradient">
        <NIcon size="32"><SparklesSharp /></NIcon>
      </div>
      <h3 class="empty-title">选择一个对话开始</h3>
      <p class="empty-sub">
        在左侧面板中选择一条会话，<br />
        查看历史消息并支持继续对话
      </p>
    </div>

    <!-- ============ 有对话 ============ -->
    <template v-else>
      <!-- 顶部标题栏 -->
      <div class="chat-header">
        <div class="chat-title-wrap">
          <div class="chat-avatar ai-avatar-sm">
            <NIcon size="14"><SparklesSharp /></NIcon>
          </div>
          <div class="chat-title-text">
            <div class="chat-title">{{ conversation.title }}</div>
            <div class="chat-meta">
              <NTag size="small" type="primary" round :bordered="false">
                {{ messages.length }} 条消息
              </NTag>
              <span class="chat-date">
                {{ dayjs(conversation.insertedAt).format('YYYY-MM-DD HH:mm') }}
              </span>
            </div>
          </div>
        </div>
        <div class="chat-header-actions">
          <NButton
            v-if="conversation.id != null"
            size="small"
            ghost
            type="primary"
            :title="showGitPanel ? '关闭Git面板' : '打开Git面板'"
            @click="showGitPanel = !showGitPanel"
          >
            <template #icon><NIcon size="14"><GitBranchOutline /></NIcon></template>
            Git
            <NTag v-if="conversation.gitRepo?.commitCount" size="small" round type="success" :bordered="false" style="margin-left: 4px;">
              {{ conversation.gitRepo.commitCount }}
            </NTag>
          </NButton>
        </div>
      </div>

      <!-- 消息流 -->
      <div class="chat-thread">
        <div
          v-for="(m, index) in messages"
          :key="m.nodeId"
          :class="['msg-row', m.role === 'USER' ? 'msg-row-user' : 'msg-row-ai']"
        >
          <!-- 头像 -->
          <div :class="['msg-avatar', m.role === 'USER' ? 'user-avatar' : 'ai-avatar']">
            <NIcon size="16">
              <component :is="m.role === 'USER' ? PersonOutline : SparklesSharp" />
            </NIcon>
          </div>

          <!-- 内容主体 -->
          <div :class="['msg-bubble-wrap', m.role === 'USER' ? 'user-wrap' : 'ai-wrap']">
            <!-- 角色标签（仅 AI） -->
            <div v-if="m.role === 'ASSISTANT'" class="msg-role-row">
              <span class="role-name">Deepseek AI</span>
              <span v-if="m.model" class="model-tag">{{ m.model }}</span>
            </div>

            <!-- 气泡 -->
            <div :class="['msg-bubble', m.role === 'USER' ? 'user-bubble' : 'ai-bubble']">
              <template v-if="editingIndex === index">
                <div class="edit-wrap">
                  <NInput
                    v-model:value="editText"
                    type="textarea"
                    :autosize="{ minRows: 2, maxRows: 8 }"
                  />
                  <div class="edit-actions">
                    <NButton
                      size="small"
                      type="primary"
                      :loading="streaming"
                      @click="saveEdit"
                    >
                      <template #icon><NIcon size="14"><CheckmarkOutline /></NIcon></template>
                      保存并重新生成
                    </NButton>
                    <NButton size="small" ghost @click="cancelEdit">
                      <template #icon><NIcon size="14"><CloseOutline /></NIcon></template>
                      取消
                    </NButton>
                  </div>
                </div>
              </template>

              <template v-else>
                <MarkdownView v-if="m.role === 'ASSISTANT'" :content="m.content" />
                <div v-else class="user-text">{{ m.content }}</div>

                <!-- 消息脚注 + 操作 -->
                <div class="msg-footer">
                  <span class="msg-time">
                    {{ dayjs(m.insertedAt).format('MM-DD HH:mm:ss') }}
                  </span>
                  <div class="msg-actions">
                    <button
                      v-if="m.role === 'USER'"
                      class="msg-action-btn"
                      :disabled="streaming"
                      @click="startEdit(index)"
                      title="编辑此消息并重新生成"
                    >
                      <NIcon size="13"><CreateOutline /></NIcon>
                      <span>编辑</span>
                    </button>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>

        <!-- 流式生成中 bubble -->
        <div v-if="streaming" class="msg-row msg-row-ai">
          <div class="msg-avatar ai-avatar ai-avatar-pulse">
            <NIcon size="16"><SparklesSharp /></NIcon>
          </div>
          <div class="msg-bubble-wrap ai-wrap">
            <div class="msg-role-row">
              <span class="role-name">Deepseek AI</span>
              <span class="model-tag">{{ selectedModel }}</span>
              <span class="streaming-tag streaming-on">生成中…</span>
            </div>
            <div class="msg-bubble ai-bubble ai-bubble-streaming">
              <NSpin v-if="!streamingContent" size="small" />
              <MarkdownView v-else :content="streamingContent" />
              <span class="caret-blink"></span>
            </div>
          </div>
        </div>

        <div ref="bottomRef" class="scroll-anchor"></div>
      </div>

      <!-- 底部控制 + 输入区 -->
      <div class="chat-input-area">
        <!-- 控制栏：模型 + Key -->
        <div class="composer-toolbar">
          <div class="toolbar-label">继续对话</div>
          <NSpace align="center" :size="10" wrap>
            <div class="select-unit">
              <span class="select-icon-wrap">
                <NIcon size="14" style="color: var(--primary);"><SparklesSharp /></NIcon>
              </span>
              <NSelect
                v-model:value="selectedModel"
                :options="modelOptions"
                size="small"
                style="width: 160px;"
              />
            </div>

            <div class="select-unit">
              <span class="select-icon-wrap select-icon-key">
                <NIcon size="13" style="color: var(--success);"><CheckmarkOutline /></NIcon>
              </span>
              <NSelect
                v-model:value="selectedKeyId"
                :options="keyOptions"
                placeholder="选择 API Key"
                size="small"
                :clearable="false"
                style="width: 180px;"
              />
            </div>
          </NSpace>
        </div>

        <!-- 输入框 + 发送按钮 -->
        <div class="composer-input-wrap">
          <NInput
            v-model:value="inputText"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 5 }"
            placeholder="输入消息继续对话…（Enter 发送，Shift+Enter 换行）"
            class="composer-input"
            @keyup.enter.exact.prevent="sendMessage"
          />
          <NButton
            type="primary"
            size="medium"
            class="send-btn"
            :loading="streaming"
            :disabled="!canSend"
            @click="sendMessage"
          >
            <template #icon v-if="!streaming">
              <NIcon size="16"><SendOutline /></NIcon>
            </template>
            {{ streaming ? '生成中' : '发送' }}
          </NButton>
        </div>

        <div v-if="selectedKeyId == null" class="composer-hint">
          <NIcon size="12" style="color: var(--warning);"><CheckmarkOutline /></NIcon>
          <span>请先在下拉框中选择一个 API Key，才能继续对话</span>
        </div>
      </div>

      <!-- Git 浮动面板：仅在 convId 存在（云端模式）时可用 -->
      <GitFloatingPanel
        v-if="showGitPanel && conversation?.id != null"
        :conv-id="conversation.id"
        :conversation="conversation"
        class="git-floating-wrap"
      />
    </template>
  </div>
</template>

<style scoped>
.chat-viewer {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  min-width: 0;
}

/* ============ 空状态 ============ */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 32px;
}
.empty-icon {
  width: 64px;
  height: 64px;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 8px 20px rgba(79, 70, 229, 0.28),
    0 4px 8px rgba(124, 58, 237, 0.16);
  margin-bottom: 8px;
}
.empty-title {
  font-size: 17px;
  font-weight: 600;
  margin: 0;
  color: var(--text);
}
.empty-sub {
  text-align: center;
  font-size: 13.5px;
  line-height: 1.7;
  color: var(--text-muted);
  margin: 0;
}

/* ============ 顶部标题栏 ============ */
.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}
.chat-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
}
.ai-avatar-sm {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
}
.chat-title-text { min-width: 0; }
.chat-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 380px;
}
.chat-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 3px;
}
.chat-date {
  font-size: 12px;
  color: var(--text-muted);
}

/* ============ 消息流 ============ */
.chat-thread {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 24px 20px;
  display: flex;
  flex-direction: column;
  gap: 22px;
  background:
    radial-gradient(circle at 100% 0%, rgba(79, 70, 229, 0.035) 0%, transparent 50%),
    var(--bg);
}

.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
}
.msg-row-user { flex-direction: row-reverse; }

/* 头像 */
.msg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  margin-top: 2px;
}
.ai-avatar {
  background: linear-gradient(135deg, #4F46E5 0%, #8B5CF6 100%);
  color: #fff;
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
}
.ai-avatar-pulse {
  position: relative;
}
.ai-avatar-pulse::after {
  content: '';
  position: absolute;
  inset: -3px;
  border-radius: 12px;
  border: 2px solid var(--primary-soft);
  animation: ping 1.6s cubic-bezier(0, 0, 0.2, 1) infinite;
}
@keyframes ping {
  75%, 100% { transform: scale(1.3); opacity: 0; }
}
.user-avatar {
  background: var(--bg-2);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

/* 气泡主体 */
.msg-bubble-wrap {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}
.user-wrap { align-items: flex-end; }
.ai-wrap   { align-items: flex-start; }

/* 角色标签行（仅 AI） */
.msg-role-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.role-name {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text);
}
.model-tag {
  font-size: 11px;
  font-weight: 500;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 2px 8px;
  border-radius: var(--radius-full);
}
.streaming-tag {
  font-size: 11px;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  color: var(--text-muted);
  background: var(--bg-2);
}
.streaming-on {
  color: var(--success);
  background: var(--success-soft);
  animation: breathe 1.6s ease-in-out infinite;
}
@keyframes breathe {
  0%, 100% { opacity: 0.7; }
  50% { opacity: 1; }
}

/* 气泡 */
.msg-bubble {
  max-width: 82%;
  padding: 12px 16px;
  border-radius: 14px;
  position: relative;
  line-height: 1.7;
}

.user-bubble {
  background: linear-gradient(135deg, var(--primary) 0%, #6366F1 100%);
  color: #fff;
  border-top-right-radius: 4px;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.22),
    0 2px 4px rgba(79, 70, 229, 0.14);
}
.ai-bubble {
  background: var(--surface);
  border: 1px solid var(--border);
  border-top-left-radius: 4px;
  box-shadow: var(--shadow-xs);
}
.ai-bubble-streaming {
  min-width: 180px;
}

/* 用户纯文本（非 markdown） */
.user-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.75;
  font-size: 14px;
  color: #fff;
}
/* 用户消息内的 code */
.user-text :deep(code) {
  background: rgba(255,255,255,0.22);
  padding: 2px 7px;
  border-radius: 6px;
  font-family: 'JetBrains Mono', Consolas, monospace;
  font-size: 0.88em;
}

/* 流式光标 */
.caret-blink {
  display: inline-block;
  width: 2px;
  height: 16px;
  background: var(--primary);
  margin-left: 4px;
  vertical-align: text-bottom;
  animation: blink 1s step-end infinite;
  border-radius: 1px;
}
@keyframes blink {
  50% { opacity: 0; }
}

/* 消息脚注 */
.msg-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid var(--border-subtle);
}
.user-bubble .msg-footer {
  border-top-color: rgba(255,255,255,0.14);
}
.msg-time {
  font-size: 11.5px;
  color: var(--text-muted);
}
.user-bubble .msg-time {
  color: rgba(255,255,255,0.75);
}
.msg-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.msg-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  font-size: 11.5px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.msg-action-btn:hover:not(:disabled) {
  background: var(--bg-2);
  border-color: var(--border);
  color: var(--text-secondary);
}
.user-bubble .msg-action-btn {
  color: rgba(255,255,255,0.78);
}
.user-bubble .msg-action-btn:hover:not(:disabled) {
  background: rgba(255,255,255,0.16);
  border-color: rgba(255,255,255,0.22);
  color: #fff;
}

/* 编辑面板 */
.edit-wrap { display: flex; flex-direction: column; gap: 10px; min-width: 260px; }
.edit-actions { display: flex; gap: 8px; }

.scroll-anchor { height: 1px; }

/* ============ 底部输入 ============ */
.chat-input-area {
  padding: 14px 20px 18px;
  border-top: 1px solid var(--border-subtle);
  background: var(--surface);
  flex-shrink: 0;
}
.composer-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}
.toolbar-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-secondary);
  letter-spacing: 0.04em;
}
.select-unit {
  display: inline-flex;
  align-items: center;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: 10px;
  padding: 2px 2px 2px 8px;
  gap: 6px;
  transition: all var(--transition-fast);
}
.select-unit:focus-within {
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: var(--shadow-focus);
}
.select-icon-wrap {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border-radius: 6px;
  background: var(--primary-soft);
}
.select-icon-key {
  background: var(--success-soft);
}
.select-unit :deep(.n-select) { width: auto; }
.select-unit :deep(.n-base-selection) {
  background: transparent;
  border: none;
  box-shadow: none !important;
  height: 30px;
}

.composer-input-wrap {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  padding: 10px;
  background: var(--surface-2);
  border: 1px solid var(--border);
  border-radius: 14px;
  transition: all var(--transition-fast);
}
.composer-input-wrap:focus-within {
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: var(--shadow-focus);
}
.composer-input {
  flex: 1;
  background: transparent !important;
}
.composer-input :deep(.n-input__input-el),
.composer-input :deep(.n-input__textarea-el) {
  background: transparent !important;
  padding: 6px 4px !important;
  line-height: 1.6;
}
.composer-input :deep(.n-input__border),
.composer-input :deep(.n-input__state-border) {
  display: none;
}
.send-btn {
  height: 40px;
  flex-shrink: 0;
}

.composer-hint {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 8px;
  padding: 0 4px;
}

/* ============ Git 面板集成 ============ */
.chat-header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.git-floating-wrap {
  position: absolute;
  top: 68px;
  right: 16px;
  z-index: 50;
  max-width: min(460px, 42vw);
  max-height: calc(100% - 88px);
}
.chat-viewer {
  position: relative;
}

@media (max-width: 640px) {
  .chat-thread { padding: 16px 12px; gap: 18px; }
  .chat-header { padding: 12px 16px; }
  .chat-input-area { padding: 12px 14px 16px; }
  .msg-bubble { max-width: 88%; padding: 10px 14px; }
  .git-floating-wrap {
    top: auto;
    right: 8px;
    left: 8px;
    bottom: 16px;
    max-width: none;
    max-height: 62vh;
  }
}
</style>
