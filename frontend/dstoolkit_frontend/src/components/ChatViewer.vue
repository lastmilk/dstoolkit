<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import {
  NButton,
  NCard,
  NEmpty,
  NInput,
  NSelect,
  NSpace,
  NSpin,
  NTag,
  NText,
} from 'naive-ui'
import dayjs from 'dayjs'
import { useAuthStore } from '@/stores/auth'
import { message } from '@/utils/naive'
import MarkdownView from './MarkdownView.vue'
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
  if (scrollTimer) return // already scheduled
  scrollTimer = setTimeout(() => {
    scrollTimer = null
    nextTick(() => {
      bottomRef.value?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }, 200) // throttle to max once per 200ms
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
          /* ignore parse errors for incomplete lines */
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
    // non-throttled scroll to ensure we reach the very bottom after the last token
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
  // Truncate messages after the edited index, then push the edited version
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
  <div class="chat-viewer neu-card">
    <NEmpty
      v-if="!conversation"
      description="选择左侧对话查看"
      style="padding: 60px 0;"
    />

    <template v-else>
      <div class="chat-header">
        <NText strong>{{ conversation.title }}</NText>
        <NTag size="small" type="default">
          {{ messages.length }} 条消息
        </NTag>
      </div>

      <div class="chat-thread">
        <div
          v-for="(m, index) in messages"
          :key="m.nodeId"
          :class="['row', m.role === 'USER' ? 'row-user' : 'row-assistant']"
        >
          <div :class="['bubble', m.role === 'USER' ? 'bubble-user' : 'bubble-assistant']">
            <template v-if="editingIndex === index">
              <NInput
                v-model:value="editText"
                type="textarea"
                :autosize="{ minRows: 2, maxRows: 8 }"
                style="margin-bottom: 8px;"
              />
              <NSpace :size="8">
                <NButton size="small" type="primary" :loading="streaming" @click="saveEdit">
                  保存并重新生成
                </NButton>
                <NButton size="small" @click="cancelEdit">取消</NButton>
              </NSpace>
            </template>

            <template v-else>
              <MarkdownView v-if="m.role === 'ASSISTANT'" :content="m.content" />
              <div v-else class="user-text">{{ m.content }}</div>

              <div class="bubble-meta">
                <NText v-if="m.model" depth="3" style="font-size: 12px;">
                  {{ m.model }}
                </NText>
                <NText depth="3" style="font-size: 12px;">
                  {{ dayjs(m.insertedAt).format('YYYY-MM-DD HH:mm:ss') }}
                </NText>
                <NButton
                  v-if="m.role === 'USER'"
                  size="tiny"
                  text
                  :disabled="streaming"
                  @click="startEdit(index)"
                >
                  编辑
                </NButton>
              </div>
            </template>
          </div>
        </div>

        <div v-if="streaming" class="row row-assistant">
          <div class="bubble bubble-assistant">
            <NSpin v-if="!streamingContent" size="small" />
            <MarkdownView v-else :content="streamingContent" />
          </div>
        </div>

        <div ref="bottomRef"></div>
      </div>

      <div class="chat-input neu-inset">
        <NSpace align="center" :size="12" wrap>
          <NSelect
            v-model:value="selectedKeyId"
            :options="keyOptions"
            placeholder="选择 API Key"
            style="width: 200px;"
          />
          <NSelect
            v-model:value="selectedModel"
            :options="modelOptions"
            style="width: 180px;"
          />
        </NSpace>
        <NSpace align="flex-end" :size="12" style="margin-top: 10px;">
          <NInput
            v-model:value="inputText"
            type="textarea"
            :autosize="{ minRows: 1, maxRows: 6 }"
            placeholder="输入消息继续对话…"
            style="flex: 1;"
            @keyup.enter.exact.prevent="sendMessage"
          />
          <NButton
            type="primary"
            :loading="streaming"
            :disabled="!canSend"
            @click="sendMessage"
          >
            发送
          </NButton>
        </NSpace>
      </div>
    </template>
  </div>
</template>

<style scoped>
.chat-viewer {
  height: 70vh;
  display: flex;
  flex-direction: column;
  padding: 16px;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--shadow-dark);
}

.chat-thread {
  flex: 1;
  overflow-y: auto;
  padding: 8px 4px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.row {
  display: flex;
}
.row-user {
  justify-content: flex-end;
}
.row-assistant {
  justify-content: flex-start;
}

.bubble {
  max-width: 75%;
  padding: 12px 16px;
  border-radius: 14px;
  box-shadow: 4px 4px 8px var(--shadow-dark), -4px -4px 8px var(--shadow-light);
  background: var(--surface);
}

.bubble-user {
  background: rgba(77, 107, 254, 0.12);
  border-bottom-right-radius: 4px;
}

.bubble-assistant {
  background: var(--surface);
  border-bottom-left-radius: 4px;
}

.user-text {
  white-space: pre-wrap;
  word-break: break-word;
  line-height: 1.7;
}

.bubble-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.chat-input {
  margin-top: 12px;
}
</style>
