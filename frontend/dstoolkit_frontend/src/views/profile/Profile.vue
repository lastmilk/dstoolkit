<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  NCard,
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  NText,
  NTag,
  NDataTable,
  NPopconfirm,
  NCode,
  NSelect,
  NModal,
  NIcon,
  type DataTableColumns,
  type SelectOption,
} from 'naive-ui'
import { h } from 'vue'
import {
  PersonCircleOutline,
  KeyOutline,
  ShieldOutline,
  CloudOutline,
  CloudOfflineOutline,
  SaveOutline,
  LockClosedOutline,
  AddOutline,
  TrashOutline,
  CopyOutline,
  RibbonOutline,
  CalendarOutline,
  TimeOutline,
  HourglassOutline,
  CreateOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  RocketOutline,
  FingerPrintOutline,
  LogOutOutline,
} from '@vicons/ionicons5'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { request } from '@/utils/request'
import { message } from '@/utils/naive'
import type { ApiKeyItem, ApiTokenItem, CreatedApiToken } from '@/types'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  message.success('已退出登录')
  router.push('/login')
}

const newUsername = ref(auth.user?.username || '')
async function saveUsername() {
  if (!newUsername.value) return
  await auth.updateProfile(newUsername.value)
  message.success('用户信息已更新')
}

const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
async function savePassword() {
  if (newPwd.value !== confirmPwd.value) {
    message.error('两次新密码不一致')
    return
  }
  await auth.changePassword(oldPwd.value, newPwd.value)
  message.success('登录密码已更新')
  oldPwd.value = ''
  newPwd.value = ''
  confirmPwd.value = ''
}

const apiKeys = ref<ApiKeyItem[]>([])
const keyName = ref('')
const keyValue = ref('')
async function loadApiKeys() {
  const res: any = await request.get('/apikeys')
  apiKeys.value = res.apiKeys
}
async function addKey() {
  if (!keyName.value || !keyValue.value) {
    message.error('请填写名称和 Key')
    return
  }
  await request.post('/apikeys', { name: keyName.value, key: keyValue.value })
  keyName.value = ''
  keyValue.value = ''
  await loadApiKeys()
  message.success('密钥已添加')
}
async function deleteKey(id: number) {
  await request.delete(`/apikeys/${id}`)
  await loadApiKeys()
  message.success('密钥已删除')
}

const columns: DataTableColumns<ApiKeyItem> = [
  { title: '名称', key: 'name' },
  { title: '密钥（掩码）', key: 'masked', render: (r) => h(NCode, { code: r.masked, language: 'text' }) },
  { title: '创建时间', key: 'createdAt', render: (r) => new Date(r.createdAt).toLocaleString() },
  {
    title: '操作',
    key: 'actions',
    render: (r) =>
      h(NPopconfirm, { onPositiveClick: () => deleteKey(r.id) }, { default: () => '确认删除此密钥？', trigger: () => h(NButton, { size: 'small', type: 'error', ghost: true }, { default: () => '删除' }) }),
  },
]

const apiTokens = ref<ApiTokenItem[]>([])
const tokenName = ref('')
const tokenExpiry = ref<number>(30)
const tokenCreating = ref(false)
const newlyCreated = ref<CreatedApiToken | null>(null)
const showTokenModal = ref(false)

const expiryOptions: SelectOption[] = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
  { label: '365 天', value: 365 },
  { label: '永久有效', value: 0 },
]

async function loadApiTokens() {
  const res: any = await request.get('/tokens')
  apiTokens.value = res.tokens
}

async function createToken() {
  if (!tokenName.value.trim()) {
    message.error('请填写令牌名称')
    return
  }
  tokenCreating.value = true
  try {
    const res: any = await request.post('/tokens', {
      name: tokenName.value.trim(),
      expiresInDays: tokenExpiry.value || undefined,
    })
    newlyCreated.value = res as CreatedApiToken
    showTokenModal.value = true
    tokenName.value = ''
    await loadApiTokens()
    message.success('API 令牌已生成，请立即保存')
  } finally {
    tokenCreating.value = false
  }
}

async function deleteToken(id: number) {
  await request.delete(`/tokens/${id}`)
  await loadApiTokens()
  message.success('令牌已撤销')
}

async function copyNewToken() {
  if (!newlyCreated.value) return
  try {
    await navigator.clipboard.writeText(newlyCreated.value.token)
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败，请手动选择文本复制')
  }
}

const tokenColumns: DataTableColumns<ApiTokenItem> = [
  { title: '名称', key: 'name', width: 160 },
  { title: '令牌前缀', key: 'masked', render: (r) => h(NCode, { code: r.masked, language: 'text' }) },
  {
    title: '状态',
    key: 'status',
    width: 100,
    render: (r) => {
      if (r.expiresAt && new Date(r.expiresAt) < new Date()) {
        return h(NTag, { type: 'error', size: 'small' }, { default: () => '已过期' })
      }
      return h(NTag, { type: 'success', size: 'small' }, { default: () => '有效' })
    },
  },
  { title: '创建时间', key: 'createdAt', width: 170, render: (r) => new Date(r.createdAt).toLocaleString() },
  { title: '最后使用', key: 'lastUsedAt', width: 170, render: (r) => (r.lastUsedAt ? new Date(r.lastUsedAt).toLocaleString() : '—') },
  { title: '过期时间', key: 'expiresAt', width: 170, render: (r) => (r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '永久') },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    render: (r) =>
      h(NPopconfirm, { onPositiveClick: () => deleteToken(r.id) }, { default: () => '确认撤销该令牌？撤销后立即失效。', trigger: () => h(NButton, { size: 'small', type: 'error', ghost: true }, { default: () => '撤销' }) }),
  },
]

onMounted(() => {
  loadApiKeys()
  loadApiTokens()
})
</script>

<template>
  <div class="page-enter" style="display: flex; flex-direction: column; gap: 18px;">
      <div class="banner-glow-1"></div>
      <div class="banner-glow-2"></div>
      <div class="banner-inner">
        <div class="banner-title-block">
          <div class="chronos-eyebrow">
            <NIcon size="12"><FingerPrintOutline /></NIcon>
            <span>PROFILE // 个人中心</span>
          </div>
          <h1 class="chronos-page-title">
            个人资料
            <span class="title-accent">· 账号设置</span>
          </h1>
          <p class="chronos-page-sub">
            管理你的个人信息、账号安全与令牌密钥
          </p>
        </div>
        <div class="banner-id">
          <div class="id-avatar">
            <NIcon size="32" style="color: var(--primary);"><PersonCircleOutline /></NIcon>
            <div class="id-ring r1"></div>
            <div class="id-ring r2"></div>
          </div>
          <div class="id-info">
            <div class="id-name">{{ auth.user?.username || '未命名用户' }}</div>
            <div class="id-tags">
              <NTag v-if="auth.isAdmin" size="small" round class="tag-admin">
                <NIcon size="11" style="margin-right: 2px;"><RibbonOutline /></NIcon>
                管理员
              </NTag>
              <span :class="['id-mode-tag', auth.cloudSyncEnabled ? 'cloud' : 'local']">
                <NIcon size="10" style="margin-right: 3px;">
                  <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
                </NIcon>
                云端{{ auth.cloudSyncEnabled ? '已连接' : '离线' }}
              </span>
            </div>
          </div>
        </div>
      </div>
 

    <div class="chronos-panel section-card page-enter">
      <div class="panel-corner tl"></div>
      <div class="panel-corner tr"></div>
      <div class="panel-corner bl"></div>
      <div class="panel-corner br"></div>

      <div class="section-header">
        <div class="section-icon">
          <NIcon size="19"><PersonCircleOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <h3>用户信息</h3>
          <div class="section-sub">
            维护你的个人信息与登录密码，确保账号安全
          </div>
        </div>
      </div>

      <div class="account-grid">
        <div>
          <div class="sub-section-title">
            <NIcon size="14" style="color: var(--primary);"><CreateOutline /></NIcon>
            更新用户名
          </div>
          <NForm label-placement="top">
            <NFormItem label="用户名">
              <NInput v-model:value="newUsername" placeholder="请输入用户名" />
            </NFormItem>
            <NButton type="tertiary" @click="saveUsername">
              <template #icon><NIcon size="14"><SaveOutline /></NIcon></template>
              保存
            </NButton>
          </NForm>
        </div>

        <div>
          <div class="sub-section-title">
            <NIcon size="14" style="color: var(--accent);"><LockClosedOutline /></NIcon>
            修改登录密码
          </div>
          <NForm label-placement="top">
            <NFormItem label="原密码"><NInput v-model:value="oldPwd" type="password" show-password-on="click" /></NFormItem>
            <NFormItem label="新密码"><NInput v-model:value="newPwd" type="password" show-password-on="click" /></NFormItem>
            <NFormItem label="确认新密码"><NInput v-model:value="confirmPwd" type="password" show-password-on="click" /></NFormItem>
            <NButton type="tertiary" @click="savePassword">
              <template #icon><NIcon size="14"><LockClosedOutline /></NIcon></template>
              更新密码
            </NButton>
          </NForm>
        </div>
      </div>
    </div>

    <div class="chronos-panel section-card page-enter delay-1">
      <div class="panel-corner tl"></div>
      <div class="panel-corner tr"></div>
      <div class="panel-corner bl"></div>
      <div class="panel-corner br"></div>

      <div class="section-header">
        <div class="section-icon accent">
          <NIcon size="19"><KeyOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <h3>API 密钥管理</h3>
          <div class="section-sub">
            添加 Deepseek API Key 供功能调用，密钥加密存储，列表仅显示掩码
          </div>
        </div>
      </div>

      <div class="add-row">
        <NSpace :size="12" align="end" wrap>
          <NFormItem label="名称" :show-feedback="false" style="margin-bottom: 0;">
            <NInput v-model:value="keyName" placeholder="如：工作密钥" style="width: 200px;" />
          </NFormItem>
          <NFormItem label="密钥内容" :show-feedback="false" style="margin-bottom: 0;">
            <NInput v-model:value="keyValue" placeholder="sk-..." style="width: 320px;" />
          </NFormItem>
          <NButton type="tertiary" @click="addKey">
            <template #icon><NIcon size="14"><AddOutline /></NIcon></template>
            添加
          </NButton>
        </NSpace>
      </div>

      <NDataTable :columns="columns" :data="apiKeys" :bordered="false" size="small" :single-line="false" />
    </div>

    <div class="chronos-panel section-card page-enter delay-2">
      <div class="panel-corner tl"></div>
      <div class="panel-corner tr"></div>
      <div class="panel-corner bl"></div>
      <div class="panel-corner br"></div>

      <div class="section-header">
        <div class="section-icon success">
          <NIcon size="19"><ShieldOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <div class="section-title-row">
            <h3>API 访问令牌</h3>
            <span class="version-tag">v1</span>
          </div>
          <div class="section-sub">
            生成访问令牌后，可通过 RESTful API（/api/v1/*）访问数据。明文仅在创建时显示一次，服务端仅存哈希，请立即保存。
          </div>
        </div>
      </div>

      <div class="add-row">
        <NSpace :size="12" align="end" wrap>
          <NFormItem label="名称" :show-feedback="false" style="margin-bottom: 0;">
            <NInput v-model:value="tokenName" placeholder="如：脚本采集" style="width: 200px;" />
          </NFormItem>
          <NFormItem label="有效期" :show-feedback="false" style="margin-bottom: 0;">
            <NSelect v-model:value="tokenExpiry" :options="expiryOptions" style="width: 160px;" />
          </NFormItem>
          <NButton type="tertiary" :loading="tokenCreating" @click="createToken">
            <template #icon><NIcon size="14"><RocketOutline /></NIcon></template>
            生成令牌
          </NButton>
        </NSpace>
      </div>

      <NDataTable :columns="tokenColumns" :data="apiTokens" :bordered="false" size="small" :scroll-x="900" />
    </div>

    <div class="logout-row">
      <NButton size="large" type="error" ghost @click="handleLogout">
        <template #icon><NIcon size="16"><LogOutOutline /></NIcon></template>
        退出登录
      </NButton>
    </div>

    <NModal
      v-model:show="showTokenModal"
      preset="card"
      title="令牌已生成（仅此一次显示明文）"
      style="width: 620px; max-width: 92vw;"
      :mask-closable="false"
      :bordered="false"
      class="chronos-modal"
    >
      <NSpace vertical :size="14">
        <div class="token-warning">
          <NIcon size="20" style="color: var(--warning); flex-shrink: 0; margin-top: 1px;"><HourglassOutline /></NIcon>
          <div>
            请立即复制并妥善保存以下令牌。关闭后无法再次查看，如丢失只能重新生成新令牌。
          </div>
        </div>
        <div class="token-display">
          <div class="token-label">
            <TimeOutline style="font-size: 11px; margin-right: 5px;" />
            BEARER TOKEN
          </div>
          <NCode v-if="newlyCreated" :code="newlyCreated.token" language="text" word-wrap class="token-code" />
        </div>
        <NSpace justify="end" style="padding-top: 6px;">
          <NButton @click="showTokenModal = false">
            <template #icon><NIcon size="15"><CheckmarkCircleOutline /></NIcon></template>
            我已保存
          </NButton>
          <NButton type="primary" @click="copyNewToken">
            <template #icon><NIcon size="15"><CopyOutline /></NIcon></template>
            复制令牌
          </NButton>
        </NSpace>
      </NSpace>
    </NModal>
  </div>
</template>

<style scoped>
.chronos-page-banner {
  position: relative;
  padding: 22px 24px;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(255, 90, 140, 0.07) 50%, rgba(0, 212, 255, 0.08) 100%),
    linear-gradient(180deg, rgba(17, 26, 53, 0.95) 0%, rgba(11, 18, 38, 0.98) 100%);
  border: 1px solid var(--border);
  overflow: hidden;
}
.banner-glow-1, .banner-glow-2 {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(60px);
  opacity: 0.4;
}
.banner-glow-1 {
  width: 260px; height: 260px;
  top: -120px; right: -80px;
  background: radial-gradient(circle, #EC4899 0%, transparent 70%);
}
.banner-glow-2 {
  width: 200px; height: 200px;
  bottom: -100px; left: 20%;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
}
.banner-inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.chronos-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--accent);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 4px 10px;
  background: rgba(168, 85, 247, 0.08);
  border-radius: 4px;
  border: 1px solid rgba(168, 85, 247, 0.18);
  margin-bottom: 10px;
}
.chronos-page-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--text);
  line-height: 1.2;
}
.title-accent {
  color: #EC4899;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  opacity: 0.85;
}
.chronos-page-sub {
  margin: 6px 0 0;
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.55;
  max-width: 520px;
}

.banner-id {
  display: flex;
  align-items: center;
  gap: 16px;
}
.id-avatar {
  position: relative;
  width: 72px; height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.18), rgba(168, 85, 247, 0.18));
  flex-shrink: 0;
}
.id-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
}
.id-ring.r1 {
  inset: -4px;
  border-top-color: rgba(0, 212, 255, 0.5);
  border-right-color: rgba(0, 212, 255, 0.3);
  animation: spin 4s linear infinite;
}
.id-ring.r2 {
  inset: -10px;
  border-bottom-color: rgba(168, 85, 247, 0.5);
  border-left-color: rgba(168, 85, 247, 0.3);
  animation: spin 6s linear infinite reverse;
}
@keyframes spin { to { transform: rotate(360deg); } }
.id-name {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}
.id-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.tag-admin {
  background: rgba(245, 158, 11, 0.12) !important;
  color: var(--warning) !important;
  border: 1px solid rgba(245, 158, 11, 0.25) !important;
}
.id-mode-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.03em;
}
.id-mode-tag.cloud {
  background: var(--success-soft);
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.id-mode-tag.local {
  background: var(--surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.section-card { padding: 24px; position: relative; overflow: hidden; }
.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.section-icon {
  width: 38px; height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 212, 255, 0.12);
  color: var(--primary);
  flex-shrink: 0;
  position: relative;
}
.section-icon.accent {
  background: rgba(168, 85, 247, 0.12);
  color: var(--accent);
}
.section-icon.success {
  background: rgba(16, 185, 129, 0.12);
  color: var(--success);
}
.section-header h3 {
  margin: 0 0 2px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.section-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.section-title-row h3 { margin: 0; }
.version-tag {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 212, 255, 0.1);
  color: var(--primary);
  border: 1px solid rgba(0, 212, 255, 0.2);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}
.section-sub {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.account-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 32px;
}
.sub-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 14px;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.03em;
}

.add-row {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 14px 16px;
  margin: 16px 0;
}

.token-warning {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: var(--radius);
  font-size: 13px;
  color: #92400E;
  line-height: 1.6;
}
.token-display {
  padding: 14px 16px;
  background: #0F172A;
  border-radius: var(--radius);
  border: 1px solid #1E293B;
}
.token-label {
  font-size: 11px;
  color: #94A3B8;
  font-weight: 600;
  margin-bottom: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
}
.token-code {
  color: #E2E8F0;
  font-size: 13px;
  background: transparent;
  padding: 0;
}

@media (max-width: 800px) {
  .account-grid {
    grid-template-columns: 1fr !important;
    gap: 24px !important;
  }
}
@media (max-width: 720px) {
  .chronos-page-banner { padding: 18px 16px; }
  .chronos-page-title { font-size: 20px; }
  .banner-id { order: -1; }
  .id-avatar { width: 60px; height: 60px; }
  .section-card { padding: 18px 16px; }
}
@media (max-width: 480px) {
  .chronos-page-banner { padding: 16px 14px; }
  .chronos-page-title { font-size: 18px; }
  .chronos-page-sub { font-size: 12.5px; }
  .id-name { font-size: 16px; }
}

.logout-row {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}
</style>
