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
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { request } from '@/utils/request'
import { message } from '@/utils/naive'
import type { ApiKeyItem, ApiTokenItem, CreatedApiToken } from '@/types'

const auth = useAuthStore()

// 用户名
const newUsername = ref(auth.user?.username || '')
async function saveUsername() {
  if (!newUsername.value) return
  await auth.updateProfile(newUsername.value)
  message.success('用户名已更新')
}

// 密码
const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
async function savePassword() {
  if (newPwd.value !== confirmPwd.value) {
    message.error('两次新密码不一致')
    return
  }
  await auth.changePassword(oldPwd.value, newPwd.value)
  message.success('密码已更新')
  oldPwd.value = ''
  newPwd.value = ''
  confirmPwd.value = ''
}

// API Key
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
  message.success('API Key 已保存')
}
async function deleteKey(id: number) {
  await request.delete(`/apikeys/${id}`)
  await loadApiKeys()
  message.success('已删除')
}

const columns: DataTableColumns<ApiKeyItem> = [
  { title: '名称', key: 'name' },
  { title: 'Key（掩码）', key: 'masked', render: (r) => h(NCode, { code: r.masked, language: 'text' }) },
  { title: '创建时间', key: 'createdAt', render: (r) => new Date(r.createdAt).toLocaleString() },
  {
    title: '操作',
    key: 'actions',
    render: (r) =>
      h(NPopconfirm, { onPositiveClick: () => deleteKey(r.id) }, { default: () => '确认删除？', trigger: () => h(NButton, { size: 'small', type: 'error', ghost: true }, { default: () => '删除' }) }),
  },
]

// RESTful API 访问令牌（区别于上面的 Deepseek API Key）
// 令牌明文仅在创建时返回一次，服务端只存 SHA-256 哈希
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
  { label: '永不过期', value: 0 },
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
    message.success('令牌已创建，请立即复制保存')
  } finally {
    tokenCreating.value = false
  }
}

async function deleteToken(id: number) {
  await request.delete(`/tokens/${id}`)
  await loadApiTokens()
  message.success('已删除')
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
  { title: '过期时间', key: 'expiresAt', width: 170, render: (r) => (r.expiresAt ? new Date(r.expiresAt).toLocaleString() : '永不') },
  {
    title: '操作',
    key: 'actions',
    width: 90,
    render: (r) =>
      h(NPopconfirm, { onPositiveClick: () => deleteToken(r.id) }, { default: () => '确认删除该令牌？删除后立即失效。', trigger: () => h(NButton, { size: 'small', type: 'error', ghost: true }, { default: () => '删除' }) }),
  },
]

onMounted(() => {
  loadApiKeys()
  loadApiTokens()
})
</script>

<template>
  <div class="page-enter" style="display: flex; flex-direction: column; gap: 20px;">
    <!-- 页面头部 -->
    <div class="page-header">
      <NSpace align="center" :size="14" wrap>
        <div class="page-header-icon">
          <NIcon size="22"><PersonCircleOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <h2 style="margin: 0 0 4px;">个人中心</h2>
          <p class="page-header-sub">
            管理你的账号信息、API Key 以及 RESTful API 访问令牌
          </p>
        </div>
      </NSpace>
    </div>

    <!-- 账号信息 -->
    <div class="surface section-card page-enter" style="padding: 24px;">
      <div class="section-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 20px;">
        <div class="section-icon" style="width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--primary-soft); color: var(--primary); flex-shrink: 0;">
          <NIcon size="19"><PersonCircleOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 2px; font-size: 16px;">账号信息</h3>
          <div style="display: flex; align-items: center; gap: 8px;">
            <NTag v-if="auth.isAdmin" type="warning" size="small" round>
              <NIcon size="11" style="margin-right: 2px;"><RibbonOutline /></NIcon>
              管理员
            </NTag>
            <span :class="['pill', auth.cloudSyncEnabled ? 'pill-success' : 'pill-default']" style="font-size: 11px;">
              <NIcon size="10" style="margin-right: 3px;">
                <CloudOutline v-if="auth.cloudSyncEnabled" />
                <CloudOfflineOutline v-else />
              </NIcon>
              云端存储{{ auth.cloudSyncEnabled ? '已开启' : '已关闭' }}
            </span>
          </div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 32px;" class="account-grid">
        <!-- 用户名 -->
        <div>
          <div class="sub-section-title" style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 14px;">
            <NIcon size="14" style="color: var(--primary);"><CreateOutline /></NIcon>
            修改用户名
          </div>
          <NForm label-placement="top">
            <NFormItem label="用户名">
              <NInput v-model:value="newUsername" placeholder="用户名" />
            </NFormItem>
            <NButton type="primary" @click="saveUsername">
              <template #icon><NIcon size="14"><SaveOutline /></NIcon></template>
              保存用户名
            </NButton>
          </NForm>
        </div>

        <!-- 密码 -->
        <div>
          <div class="sub-section-title" style="display: flex; align-items: center; gap: 6px; font-size: 13px; font-weight: 600; color: var(--text-secondary); margin-bottom: 14px;">
            <NIcon size="14" style="color: var(--accent);"><LockClosedOutline /></NIcon>
            修改密码
          </div>
          <NForm label-placement="top">
            <NFormItem label="原密码"><NInput v-model:value="oldPwd" type="password" show-password-on="click" /></NFormItem>
            <NFormItem label="新密码"><NInput v-model:value="newPwd" type="password" show-password-on="click" /></NFormItem>
            <NFormItem label="确认密码"><NInput v-model:value="confirmPwd" type="password" show-password-on="click" /></NFormItem>
            <NButton type="primary" @click="savePassword">
              <template #icon><NIcon size="14"><LockClosedOutline /></NIcon></template>
              修改密码
            </NButton>
          </NForm>
        </div>
      </div>
    </div>

    <!-- API Key 管理 -->
    <div class="surface section-card page-enter delay-1" style="padding: 24px;">
      <div class="section-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <div class="section-icon" style="width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--accent-soft); color: var(--accent); flex-shrink: 0;">
          <NIcon size="19"><KeyOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <h3 style="margin: 0 0 2px; font-size: 16px;">API Key 管理</h3>
          <NText depth="3" style="font-size: 13px;">
            在此保存你的 Deepseek API Key，余额查询等功能会用到。Key 加密存储于云端，列表仅显示掩码。
          </NText>
        </div>
      </div>

      <div class="add-row" style="background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius); padding: 14px 16px; margin: 16px 0;">
        <NSpace :size="12" align="end" wrap>
          <NFormItem label="名称" :show-feedback="false" style="margin-bottom: 0;">
            <NInput v-model:value="keyName" placeholder="如：工作 Key" style="width: 200px;" />
          </NFormItem>
          <NFormItem label="Key" :show-feedback="false" style="margin-bottom: 0;">
            <NInput v-model:value="keyValue" placeholder="sk-..." style="width: 320px;" />
          </NFormItem>
          <NButton type="primary" @click="addKey">
            <template #icon><NIcon size="14"><AddOutline /></NIcon></template>
            新增
          </NButton>
        </NSpace>
      </div>

      <NDataTable :columns="columns" :data="apiKeys" :bordered="false" size="small" :single-line="false" />
    </div>

    <!-- RESTful API 访问令牌 -->
    <div class="surface section-card page-enter delay-2" style="padding: 24px;">
      <div class="section-header" style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
        <div class="section-icon" style="width: 38px; height: 38px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--success-soft); color: var(--success); flex-shrink: 0;">
          <NIcon size="19"><ShieldOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 2px;">
            <h3 style="margin: 0; font-size: 16px;">RESTful API 访问令牌</h3>
            <span class="pill pill-info" style="font-size: 11px;">v1</span>
          </div>
          <NText depth="3" style="font-size: 13px;">
            生成访问令牌后，可通过 RESTful API（/api/v1/*）访问你的数据。令牌明文仅在此创建时显示一次，服务端只存哈希，请立即复制保存。
          </NText>
        </div>
      </div>

      <div class="add-row" style="background: var(--surface-2); border: 1px solid var(--border-subtle); border-radius: var(--radius); padding: 14px 16px; margin: 16px 0;">
        <NSpace :size="12" align="end" wrap>
          <NFormItem label="名称" :show-feedback="false" style="margin-bottom: 0;">
            <NInput v-model:value="tokenName" placeholder="如：脚本采集" style="width: 200px;" />
          </NFormItem>
          <NFormItem label="有效期" :show-feedback="false" style="margin-bottom: 0;">
            <NSelect v-model:value="tokenExpiry" :options="expiryOptions" style="width: 160px;" />
          </NFormItem>
          <NButton type="primary" :loading="tokenCreating" @click="createToken">
            <template #icon><NIcon size="14"><ShieldOutline /></NIcon></template>
            生成令牌
          </NButton>
        </NSpace>
      </div>

      <NDataTable :columns="tokenColumns" :data="apiTokens" :bordered="false" size="small" :scroll-x="900" />
    </div>

    <!-- 新建令牌弹窗 -->
    <NModal
      v-model:show="showTokenModal"
      preset="card"
      title="令牌已创建（明文仅此一次）"
      style="width: 620px; max-width: 92vw;"
      :mask-closable="false"
      :bordered="false"
    >
      <NSpace vertical :size="14">
        <div
          style="display: flex; align-items: flex-start; gap: 12px; padding: 14px 16px; background: var(--warning-soft); border: 1px solid rgba(245,158,11,0.2); border-radius: var(--radius);"
        >
          <NIcon size="20" style="color: var(--warning); flex-shrink: 0; margin-top: 1px;"><HourglassOutline /></NIcon>
          <div style="font-size: 13px; color: #92400E; line-height: 1.6;">
            请立即复制并妥善保存以下令牌。关闭后无法再次查看，如丢失只能重新创建。
          </div>
        </div>
        <div style="padding: 14px 16px; background: #0F172A; border-radius: var(--radius); border: 1px solid #1E293B;">
          <div style="font-size: 11px; color: #94A3B8; font-weight: 600; margin-bottom: 8px; letter-spacing: 0.02em; text-transform: uppercase;">
            Bearer Token
          </div>
          <NCode v-if="newlyCreated" :code="newlyCreated.token" language="text" word-wrap style="color: #E2E8F0; font-size: 13px; background: transparent; padding: 0;" />
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
.page-header-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%);
  color: var(--primary);
  flex-shrink: 0;
}
.page-header-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
.section-card {
  transition: box-shadow var(--transition);
}
.section-card:hover {
  box-shadow: var(--shadow-sm);
}
@media (max-width: 800px) {
  .account-grid {
    grid-template-columns: 1fr !important;
    gap: 24px !important;
  }
}
</style>
