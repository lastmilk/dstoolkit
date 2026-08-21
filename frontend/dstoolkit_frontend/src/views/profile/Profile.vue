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
  type DataTableColumns,
  type SelectOption,
} from 'naive-ui'
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

import { h } from 'vue'

onMounted(() => {
  loadApiKeys()
  loadApiTokens()
})
</script>

<template>
  <NSpace vertical :size="20">
    <div class="neu-card">
      <NSpace align="center" :size="12" style="margin-bottom: 12px;">
        <h3 style="margin: 0;">账号信息</h3>
        <NTag v-if="auth.isAdmin" type="warning" size="small">管理员</NTag>
        <NTag :type="auth.cloudSyncEnabled ? 'success' : 'default'" size="small">
          云端存储{{ auth.cloudSyncEnabled ? '已开启' : '已关闭' }}
        </NTag>
      </NSpace>
      <NSpace :size="40" align="start">
        <NForm label-placement="left" style="min-width: 320px;">
          <NFormItem label="用户名">
            <NInput v-model:value="newUsername" placeholder="用户名" />
          </NFormItem>
          <NButton type="primary" @click="saveUsername">保存用户名</NButton>
        </NForm>
        <NForm label-placement="left" style="min-width: 360px;">
          <NFormItem label="原密码"><NInput v-model:value="oldPwd" type="password" /></NFormItem>
          <NFormItem label="新密码"><NInput v-model:value="newPwd" type="password" /></NFormItem>
          <NFormItem label="确认密码"><NInput v-model:value="confirmPwd" type="password" /></NFormItem>
          <NButton type="primary" @click="savePassword">修改密码</NButton>
        </NForm>
      </NSpace>
    </div>

    <div class="neu-card">
      <h3 style="margin: 0 0 12px;">API Key 管理</h3>
      <NText depth="3" style="font-size: 13px; display: block; margin-bottom: 12px;">
        在此保存你的 Deepseek API Key，余额查询等功能会用到。Key 加密存储于云端，列表仅显示掩码。
      </NText>
      <NSpace :size="12" align="end" style="margin-bottom: 16px;">
        <NFormItem label="名称" :show-feedback="false"><NInput v-model:value="keyName" placeholder="如：工作 Key" style="width: 200px;" /></NFormItem>
        <NFormItem label="Key" :show-feedback="false"><NInput v-model:value="keyValue" placeholder="sk-..." style="width: 280px;" /></NFormItem>
        <NButton type="primary" @click="addKey">新增</NButton>
      </NSpace>
      <NDataTable :columns="columns" :data="apiKeys" :bordered="false" size="small" />
    </div>

    <div class="neu-card">
      <NSpace align="center" :size="12" style="margin-bottom: 12px;">
        <h3 style="margin: 0;">RESTful API 访问令牌</h3>
        <NTag type="info" size="small">v1</NTag>
      </NSpace>
      <NText depth="3" style="font-size: 13px; display: block; margin-bottom: 12px;">
        生成访问令牌后，可通过 RESTful API（/api/v1/*）访问你的数据。令牌明文仅在此创建时显示一次，服务端只存哈希，请立即复制保存。了解接口细节请查阅 API 文档。
      </NText>
      <NSpace :size="12" align="end" style="margin-bottom: 16px;">
        <NFormItem label="名称" :show-feedback="false"><NInput v-model:value="tokenName" placeholder="如：脚本采集" style="width: 200px;" /></NFormItem>
        <NFormItem label="有效期" :show-feedback="false">
          <NSelect v-model:value="tokenExpiry" :options="expiryOptions" style="width: 140px;" />
        </NFormItem>
        <NButton type="primary" :loading="tokenCreating" @click="createToken">生成令牌</NButton>
      </NSpace>
      <NDataTable :columns="tokenColumns" :data="apiTokens" :bordered="false" size="small" :scroll-x="900" />
    </div>

    <NModal v-model:show="showTokenModal" preset="card" title="令牌已创建（明文仅此一次）" style="width: 600px;" :mask-closable="false">
      <NSpace vertical :size="12">
        <NText type="warning" style="font-size: 13px;">
          请立即复制并妥善保存以下令牌。关闭后无法再次查看，如丢失只能重新创建。
        </NText>
        <NCode v-if="newlyCreated" :code="newlyCreated.token" language="text" word-wrap />
        <NSpace justify="end">
          <NButton @click="showTokenModal = false">我已保存</NButton>
          <NButton type="primary" @click="copyNewToken">复制令牌</NButton>
        </NSpace>
      </NSpace>
    </NModal>
  </NSpace>
</template>
