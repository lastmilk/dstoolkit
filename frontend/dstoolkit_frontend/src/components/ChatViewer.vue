<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import dayjs from 'dayjs'
import type { TNode } from 'tdesign-vue-next'
import {
  PersonOutline,
  SparklesSharp,
  CreateOutline,
  CheckmarkOutline,
  CloseOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { message } from '@/utils/feedback'
import AppIcon from '@/components/AppIcon.vue'
import MarkdownView from './MarkdownView.vue'
import type { ParsedConversation, ParsedMessage } from '@/types'
import type { ScrollToBottomParams } from '@tdesign-vue-next/chat'

const props = defineProps<{
  conversation: ParsedConversation | null
  apiKeys: Array<{ id: number; name: string }>
}>()

const authStore = useAuthStore()

const messages = ref<ParsedMessage[]>([])
const selectedKeyId = ref<number | undefined>(undefined)
const selectedModel = ref<string>('deepseek-chat')
const inputText = ref('')
const streaming = ref(false)
const streamingContent = ref('')
const editingIndex = ref<number | null>(null)
const editText = ref('')

const chatListRef = ref<{ scrollToBottom?: (params?: ScrollToBottomParams) => void } | null>(null)

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
    chatListRef.value?.scrollToBottom?.({ behavior: 'smooth' })
  })
}

let scrollTimer: ReturnType<typeof setTimeout> | null = null
function throttledScrollToBottom() {
  if (scrollTimer) return
  scrollTimer = setTimeout(() => {
    scrollTimer = null
    scrollToBottom()
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

function onInputSend() {
  void sendMessage()
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

// 渲染函数：AI 消息头部名称（Deepseek AI + 模型标签）
function aiNameNode(m: ParsedMessage): TNode {
  return (h) =>
    h('span', { class: 'chat-item-name' }, [
      'Deepseek AI',
      m.model
        ? h('span', { class: 'model-tag' }, m.model)
        : null,
    ])
}
// 渲染函数：流式中的 AI 名称（含"生成中"指示）
function aiStreamingNameNode(): TNode {
  return (h) =>
    h('span', { class: 'chat-item-name' }, [
      'Deepseek AI',
      h('span', { class: 'model-tag' }, selectedModel.value),
      h('span', { class: 'streaming-tag streaming-on' }, '生成中…'),
    ])
}
</script>

<template>
  <div class="chat-viewer surface">
    <!-- ============ 空状态 ============ -->
    <div v-if="!conversation" class="empty-state">
      <div class="empty-icon brand-gradient">
        <AppIcon :size="32"><SparklesSharp /></AppIcon>
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
            <AppIcon :size="14"><SparklesSharp /></AppIcon>
          </div>
          <div class="chat-title-text">
            <div class="chat-title">{{ conversation.title }}</div>
            <div class="chat-meta">
              <t-tag size="small" theme="primary" shape="round" variant="light">
                {{ messages.length }} 条消息
              </t-tag>
              <span class="chat-date">
                {{ dayjs(conversation.insertedAt).format('YYYY-MM-DD HH:mm') }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 消息流：TDesign Chat 组件 -->
      <div class="chat-thread">
        <t-chat-list
          ref="chatListRef"
          class="chat-list"
          :show-scroll-button="true"
        >
          <template v-for="(m, index) in messages" :key="m.nodeId">
            <!-- 编辑态：保留原面板 -->
            <div v-if="editingIndex === index" class="msg-row msg-row-user">
              <div class="msg-avatar user-avatar">
                <AppIcon :size="16"><PersonOutline /></AppIcon>
              </div>
              <div class="edit-wrap">
                <t-textarea
                  v-model="editText"
                  :autosize="{ minRows: 2, maxRows: 8 }"
                />
                <div class="edit-actions">
                  <t-button
                    size="small"
                    theme="primary"
                    :loading="streaming"
                    @click="saveEdit"
                  >
                    <template #icon><AppIcon :size="14"><CheckmarkOutline /></AppIcon></template>
                    保存并重新生成
                  </t-button>
                  <t-button size="small" variant="outline" @click="cancelEdit">
                    <template #icon><AppIcon :size="14"><CloseOutline /></AppIcon></template>
                    取消
                  </t-button>
                </div>
              </div>
            </div>

            <!-- 普通消息：t-chat-item -->
            <t-chat-item
              v-else
              :role="m.role === 'USER' ? 'user' : 'assistant'"
              :variant="m.role === 'USER' ? 'base' : 'outline'"
              :datetime="dayjs(m.insertedAt).format('MM-DD HH:mm:ss')"
              :name="m.role === 'ASSISTANT' ? aiNameNode(m) : ''"
            >
              <template #avatar>
                <div :class="['msg-avatar', m.role === 'USER' ? 'user-avatar' : 'ai-avatar']">
                  <AppIcon :size="16">
                    <component :is="m.role === 'USER' ? PersonOutline : SparklesSharp" />
                  </AppIcon>
                </div>
              </template>
              <template #content>
                <MarkdownView v-if="m.role === 'ASSISTANT'" :content="m.content" />
                <span v-else class="user-text">{{ m.content }}</span>
              </template>
              <template v-if="m.role === 'USER'" #actions>
                <t-button
                  variant="text"
                  size="small"
                  :disabled="streaming"
                  title="编辑此消息并重新生成"
                  @click="startEdit(index)"
                >
                  <template #icon><AppIcon :size="13"><CreateOutline /></AppIcon></template>
                  编辑
                </t-button>
              </template>
            </t-chat-item>
          </template>

          <!-- 流式生成中 -->
          <t-chat-item
            v-if="streaming"
            role="assistant"
            variant="outline"
            :name="aiStreamingNameNode()"
            :text-loading="!streamingContent"
            animation="gradient"
          >
            <template #avatar>
              <div class="msg-avatar ai-avatar ai-avatar-pulse">
                <AppIcon :size="16"><SparklesSharp /></AppIcon>
              </div>
            </template>
            <template #content>
              <MarkdownView :content="streamingContent" />
            </template>
          </t-chat-item>
        </t-chat-list>
      </div>

      <!-- 底部控制 + 输入区（无 API Key 时只读，如 ShareView） -->
      <div v-if="apiKeys.length > 0" class="chat-input-area">
        <!-- 控制栏：模型 + Key -->
        <div class="composer-toolbar">
          <div class="toolbar-label">继续对话</div>
          <t-space align="center" :size="10" break-line>
            <div class="select-unit">
              <span class="select-icon-wrap">
                <AppIcon :size="14" style="color: var(--primary);"><SparklesSharp /></AppIcon>
              </span>
              <t-select
                v-model="selectedModel"
                :options="modelOptions"
                size="small"
                style="width: 160px;"
              />
            </div>

            <div class="select-unit">
              <span class="select-icon-wrap select-icon-key">
                <AppIcon :size="13" style="color: var(--success);"><CheckmarkOutline /></AppIcon>
              </span>
              <t-select
                v-model="selectedKeyId"
                :options="keyOptions"
                placeholder="选择 API Key"
                size="small"
                :clearable="false"
                style="width: 180px;"
              />
            </div>
          </t-space>
        </div>

        <!-- TDesign Chat 输入框（Enter 发送，Shift+Enter 换行） -->
        <t-chat-input
          v-model="inputText"
          :autosize="{ minRows: 1, maxRows: 5 }"
          placeholder="输入消息继续对话…（Enter 发送，Shift+Enter 换行）"
          :stop-disabled="true"
          @send="onInputSend"
        />

        <div v-if="selectedKeyId == null" class="composer-hint">
          <AppIcon :size="12" style="color: var(--warning);"><CheckmarkOutline /></AppIcon>
          <span>请先在下拉框中选择一个 API Key，才能继续对话</span>
        </div>
      </div>
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

/* ============ 消息流（TDesign Chat） ============ */
.chat-thread {
  flex: 1;
  min-height: 0;
  display: flex;
  background:
    radial-gradient(circle at 100% 0%, rgba(79, 70, 229, 0.035) 0%, transparent 50%),
    var(--bg);
}
.chat-list {
  flex: 1;
  min-width: 0;
}
.chat-thread :deep(.t-chat) {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: transparent;
}
.chat-thread :deep(.t-chat__list) {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 22px 20px;
  box-sizing: border-box;
}
/* 消息条目间距与宽度 */
.chat-thread :deep(.t-chat-item) {
  margin-bottom: 18px;
}
.chat-thread :deep(.t-chat-item__inner),
.chat-thread :deep(.t-chat__text) {
  max-width: 100%;
}

/* ============ 头像（沿用原配色，嵌入 t-chat-item #avatar 插槽） ============ */
.msg-avatar {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
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

/* ============ 名称/时间行补充 ============ */
.chat-item-name {
  display: inline-flex;
  align-items: center;
  gap: 8px;
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

/* 用户消息纯文本 */
.user-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.75;
  font-size: 14px;
}

/* ============ 编辑行 ============ */
.msg-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  width: 100%;
  margin-bottom: 18px;
  padding: 0 4px;
}
.msg-row-user { flex-direction: row-reverse; }
.edit-wrap {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 260px;
  max-width: 82%;
  flex: 1;
}
.edit-actions { display: flex; gap: 8px; }

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
.select-unit :deep(.t-select) { width: auto; }
.select-unit :deep(.t-input) {
  background: transparent;
  border: none;
  box-shadow: none !important;
  height: 30px;
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

@media (max-width: 640px) {
  .chat-thread :deep(.t-chat__list) { padding: 16px 12px; }
  .chat-header { padding: 12px 16px; }
  .chat-input-area { padding: 12px 14px 16px; }
}
</style>
