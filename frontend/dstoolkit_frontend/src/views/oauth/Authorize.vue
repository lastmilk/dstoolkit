<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElButton, ElIcon } from 'element-plus'
import { Lock, Phone, Close, Loading } from '@element-plus/icons-vue'
import { request } from '@/utils/request'
import { useAuthStore } from '@/stores/auth'

interface OAuthQuery {
  client_id?: string
  redirect_uri?: string
  scope?: string
  state?: string
  code_challenge?: string
  code_challenge_method?: string
  [key: string]: string | undefined
}

interface AuthorizeResponse {
  redirectUrl: string
  [key: string]: unknown
}

const route = useRoute()
const auth = useAuthStore()

const loading = ref<boolean>(false)
const errorMsg = ref<string>('')
const clientName = ref<string>('DsToolKit App')

const q = computed<OAuthQuery>(() => route.query as OAuthQuery)

const SCOPE_LABELS: Record<string, string> = {
  'read:conversations': '读取你的对话列表与消息内容',
  'write:sync': '提交对话同步数据',
  search: '使用全文搜索',
  profile: '读取你的账号基本信息',
  offline_access: '离线访问（签发刷新令牌）',
}

const scopeList = computed<string[]>(() =>
  String(q.value.scope || '')
    .split(' ')
    .filter(Boolean),
)

const clientLabel = computed<string>(() => {
  if (q.value.client_id === 'dstk-mobile-app') return 'DsToolKit 移动应用'
  if (q.value.client_id === 'dstk-browser-ext') return 'DsToolKit 浏览器插件'
  return q.value.client_id || '未知应用'
})

onMounted((): void => {
  if (!q.value.client_id || !q.value.redirect_uri || !q.value.code_challenge) {
    errorMsg.value = '缺少必要的授权参数（client_id / redirect_uri / code_challenge）'
    return
  }
  if (!auth.isLoggedIn) {
    const current: string = location.pathname + location.search
    location.href = `/login?redirect=${encodeURIComponent(current)}`
  }
})

async function onApprove(): Promise<void> {
  loading.value = true
  errorMsg.value = ''
  try {
    const res: AuthorizeResponse = await request.post('/oauth/authorize', {
      clientId: q.value.client_id,
      redirectUri: q.value.redirect_uri,
      scope: q.value.scope || '',
      state: q.value.state || '',
      codeChallenge: q.value.code_challenge,
      codeChallengeMethod: q.value.code_challenge_method || 'S256',
    }) as AuthorizeResponse
    location.href = res.redirectUrl
  } catch (e: unknown) {
    const err = e as { response?: { data?: { error?: string } } }
    errorMsg.value = err?.response?.data?.error || '授权失败，请重试'
    loading.value = false
  }
}

function onDeny(): void {
  const url: URL = new URL(q.value.redirect_uri || 'dstoolkit://oauth-callback')
  url.searchParams.set('error', 'access_denied')
  if (q.value.state) url.searchParams.set('state', q.value.state)
  location.href = url.toString()
}
</script>

<template>
  <div class="oauth-shell">
    <div class="oauth-card glass-card">
      <div class="oauth-icon">
        <ElIcon :size="36"><Phone /></ElIcon>
      </div>
      <h2 class="oauth-title">授权请求</h2>
      <p class="oauth-desc">
        <strong>{{ clientLabel }}</strong> 请求访问你的 DsToolKit 账号
      </p>

      <div class="oauth-scopes">
        <div v-if="scopeList.length === 0" class="scope-item">基础账号信息</div>
        <div v-for="s in scopeList" :key="s" class="scope-item">
          <span class="scope-icon"><ElIcon :size="16"><Lock /></ElIcon></span>
          {{ SCOPE_LABELS[s] || s }}
        </div>
      </div>

      <div v-if="errorMsg" class="oauth-error">
        {{ errorMsg }}
      </div>

      <div class="oauth-actions">
        <ElButton size="large" text @click="onDeny" :disabled="loading">
          <template #icon><ElIcon><Close /></ElIcon></template>
          拒绝
        </ElButton>
        <ElButton size="large" type="primary" @click="onApprove" :loading="loading" :disabled="!!errorMsg">
          同意授权
        </ElButton>
      </div>

      <p class="oauth-hint">授权后将返回 DsToolKit 应用，你随时可在应用内退出登录以撤销访问。</p>
      <div v-if="loading" class="oauth-loading">
        <ElIcon class="is-loading" :size="20"><Loading /></ElIcon>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oauth-shell {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(145deg, #e8ecf3, #f5f7fa);
  padding: 24px;
}

.oauth-card {
  width: 100%;
  max-width: 420px;
  background: #fdfdfe;
  border-radius: 20px;
  padding: 40px 36px 28px;
  box-shadow:
    10px 10px 24px rgba(163, 177, 198, 0.35),
    -10px -10px 24px rgba(255, 255, 255, 0.9);
  text-align: center;
}

.oauth-icon {
  width: 72px;
  height: 72px;
  margin: 0 auto 16px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4a6cf7;
  background: linear-gradient(145deg, #eef1f8, #dde3ee);
  box-shadow:
    inset 4px 4px 8px rgba(163, 177, 198, 0.3),
    inset -4px -4px 8px rgba(255, 255, 255, 0.9);
}

.oauth-title {
  margin: 0 0 8px;
  font-size: 20px;
  font-weight: 600;
  color: #2c3e5d;
}

.oauth-desc {
  margin: 0 0 20px;
  color: #6b7a99;
  font-size: 14px;
}

.oauth-desc strong {
  color: #2c3e5d;
}

.oauth-scopes {
  text-align: left;
  background: #f4f6fb;
  border-radius: 12px;
  padding: 12px 16px;
  margin-bottom: 20px;
}

.scope-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 0;
  font-size: 13px;
  color: #4a5573;
}

.scope-icon {
  color: #4a6cf7;
  display: inline-flex;
}

.oauth-error {
  color: #d03050;
  font-size: 13px;
  margin-bottom: 16px;
  background: rgba(208, 48, 80, 0.06);
  border-radius: 8px;
  padding: 8px 12px;
}

.oauth-actions {
  display: flex;
  gap: 12px;
  justify-content: center;
}

.oauth-hint {
  margin: 18px 0 0;
  font-size: 12px;
  color: #9aa7bf;
}

.oauth-loading {
  margin-top: 12px;
}
</style>
