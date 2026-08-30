<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRoute } from 'vue-router'
import { request } from '@/utils/request'
import ChatViewer from '@/components/ChatViewer.vue'
import type { ParsedConversation } from '@/types'

const route = useRoute()
const slug = computed(() => String(route.params.slug || ''))

const loading = ref(true)
const error = ref('')
const requiresPassword = ref(false)
const password = ref('')
const theme = ref('default')
const title = ref('')
const viewCount = ref(0)
const conversation = ref<ParsedConversation | null>(null)

async function fetchShare() {
  loading.value = true
  error.value = ''
  try {
    const res: any = await request.get(`/public/shares/${slug.value}`, {
      headers: password.value ? { 'X-Share-Password': password.value } : undefined,
    })
    theme.value = res.share.theme || 'default'
    title.value = res.share.title || ''
    viewCount.value = res.share.viewCount || 0
    conversation.value = res.conversation
    requiresPassword.value = false
  } catch (e: any) {
    const status = e?.response?.status
    if (status === 401 && e?.response?.data?.requiresPassword) {
      requiresPassword.value = true
    } else {
      error.value = e?.response?.data?.error || '加载失败'
    }
  } finally {
    loading.value = false
  }
}

function submitPassword() {
  if (!password.value) return
  fetchShare()
}

onMounted(fetchShare)
</script>

<template>
  <div class="share-root" :class="`theme-${theme}`">
    <header class="share-header">
      <div class="share-brand">
        <span class="logo">Deepseek</span>
        <span class="sub">dstoolkit · 分享</span>
      </div>
      <span style="font-size: 12px; color: var(--text-muted);">浏览 {{ viewCount }} 次</span>
    </header>

    <main class="share-main">
      <div v-if="loading" class="share-loading">
        <t-loading loading size="large" />
        <span style="margin-top: 12px; color: var(--text-muted);">正在加载分享…</span>
      </div>

      <div v-else-if="requiresPassword" class="share-pw neu-card">
        <h3>此分享需要密码</h3>
        <span style="font-size: 13px; margin-bottom: 12px; display: block; color: var(--text-muted);">
          请输入分享者设置的访问密码
        </span>
        <t-space align="end">
          <t-input
            v-model="password"
            type="password"
            placeholder="访问密码"
            style="width: 240px;"
            @keyup.enter="submitPassword"
          />
          <t-button theme="primary" @click="submitPassword">验证</t-button>
        </t-space>
      </div>

      <div v-else-if="error" class="share-error">
        <t-empty :description="error" />
      </div>

      <div v-else-if="conversation" class="share-conv">
        <div class="share-title neu-card">
          <h2>{{ title }}</h2>
          <span style="font-size: 13px; color: var(--text-muted);">
            {{ conversation.messages.length }} 条消息 · {{ conversation.turns?.length ?? conversation.turnCount ?? 0 }} 轮对话
          </span>
        </div>
        <ChatViewer :conversation="conversation" :api-keys="[]" />
      </div>
    </main>

    <footer class="share-footer">
      <span style="font-size: 12px; color: var(--text-muted);">
        由 dstoolkit 生成 · 主题：{{ theme }}
      </span>
    </footer>
  </div>
</template>

<style scoped>
.share-root {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--bg);
}
.share-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--shadow-dark);
}
.share-brand { display: flex; align-items: baseline; gap: 8px; }
.share-brand .logo { font-weight: 700; color: var(--primary); font-size: 16px; }
.share-brand .sub { font-size: 12px; color: var(--text-muted); }
.share-main { flex: 1; padding: 24px; max-width: 900px; margin: 0 auto; width: 100%; }
.share-loading { display: flex; flex-direction: column; align-items: center; padding: 80px 0; }
.share-pw { max-width: 360px; margin: 60px auto; text-align: center; }
.share-pw h3 { margin: 0 0 8px; }
.share-error { padding: 80px 0; }
.share-conv { display: flex; flex-direction: column; gap: 16px; }
.share-title { margin-bottom: 4px; }
.share-title h2 { margin: 0 0 4px; font-size: 20px; }
.share-footer { text-align: center; padding: 16px; }

/* ===== 5 种主题：通过覆盖 neu-morphism CSS 变量切换 ===== */
.theme-default {
  --bg: #e6e9f0; --surface: #eef1f6; --text: #2c3e50; --text-muted: #7a869a;
  --primary: #4d6bfe; --shadow-light: #ffffff; --shadow-dark: #c5cad6;
}
.theme-ocean {
  --bg: #d6e6f5; --surface: #e8f1fa; --text: #1a3a52; --text-muted: #5a7a92;
  --primary: #1e88e5; --shadow-light: #f4faff; --shadow-dark: #a8c8e0;
}
.theme-forest {
  --bg: #dde8d8; --surface: #eaf0e4; --text: #2d3f24; --text-muted: #6a7a5c;
  --primary: #4caf50; --shadow-light: #f5faf0; --shadow-dark: #bccba8;
}
.theme-sunset {
  --bg: #f5e6d8; --surface: #faf0e4; --text: #4a2f1a; --text-muted: #9a7a5c;
  --primary: #ff7043; --shadow-light: #fff5ea; --shadow-dark: #e0c8a8;
}
.theme-mono {
  --bg: #2a2a2a; --surface: #333333; --text: #e0e0e0; --text-muted: #9a9a9a;
  --primary: #b0b0b0; --shadow-light: #3d3d3d; --shadow-dark: #1f1f1f;
  color-scheme: dark;
}
</style>
