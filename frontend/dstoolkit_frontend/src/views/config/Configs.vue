<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  NButton,
  NSpace,
  NCard,
  NModal,
  NForm,
  NFormItem,
  NInput,
  NUpload,
  NTag,
  NText,
  NEmpty,
  NSpin,
  type UploadFileInfo,
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { request } from '@/utils/request'
import { message } from '@/utils/naive'
import {
  saveLocalConfig,
  getLocalConfigs,
  deleteLocalConfig,
  buildAndPersistIndex,
  incrementalUpdateIndex,
} from '@/utils/db'
import type { DeepseekConfig, UploadResult } from '@/types'

const auth = useAuthStore()
const router = useRouter()

interface ConfigItem extends Omit<DeepseekConfig, 'updatedAt'> {
  updatedAt?: number | string
}

const configs = ref<ConfigItem[]>([])
const loading = ref(false)

async function reload() {
  loading.value = true
  try {
    if (auth.cloudSyncEnabled) {
      const res: any = await request.get('/configs')
      configs.value = res.configs
    } else {
      const local = await getLocalConfigs()
      configs.value = local.map((c: any) => ({
        id: null,
        name: c.name,
        deepseekUserId: c.deepseekUserId,
        deepseekEmail: c.deepseekEmail,
        deepseekMobile: c.deepseekMobile,
        updatedAt: c.updatedAt,
      }))
    }
  } finally {
    loading.value = false
  }
}

// 新增 / 更新 模态框
const modalVisible = ref(false)
const modalMode = ref<'create' | 'update'>('create')
const modalName = ref('')
const modalFile = ref<File | null>(null)
const modalTarget = ref<ConfigItem | null>(null)
const submitting = ref(false)

function openCreate() {
  modalMode.value = 'create'
  modalName.value = ''
  modalFile.value = null
  modalTarget.value = null
  modalVisible.value = true
}

function openUpdate(item: ConfigItem) {
  modalMode.value = 'update'
  modalName.value = item.name
  modalFile.value = null
  modalTarget.value = item
  modalVisible.value = true
}

function onFileChange(data: { fileList: UploadFileInfo[] }) {
  const f = data.fileList[0]
  modalFile.value = f?.file ?? null
}

async function submitModal() {
  if (!modalFile.value) {
    message.error('请选择 Deepseek 导出的 zip 压缩包')
    return
  }
  if (modalMode.value === 'create' && !modalName.value.trim()) {
    message.error('请填写配置名称')
    return
  }
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('file', modalFile.value)
    fd.append('name', modalName.value.trim())
    const res = (await request.post('/configs', fd)) as UploadResult
    if (!res.persisted) {
      // cloud off：保存到本地 IndexedDB（saveLocalConfig 会按 deepseekUserId 增量 upsert）
      await saveLocalConfig(res.config, res.conversations ?? [])
      // 本地模式：导入时一次构建 FlexSearch 索引并持久化到 IndexedDB
      try {
        if (modalMode.value === 'update' && modalTarget.value) {
          const changedConvIds = (res.conversations ?? []).map((c) => c.deepseekConvId)
          await incrementalUpdateIndex(
            modalTarget.value.deepseekUserId,
            changedConvIds,
            res.conversations ?? [],
          )
        } else {
          await buildAndPersistIndex(res.config.deepseekUserId, res.conversations ?? [])
        }
      } catch {
        /* 索引构建失败不阻断上传流程，下次进入探索页可手动重建 */
      }
    }
    const count = res.conversations?.length ?? res.conversationCount ?? 0
    message.success(
      res.persisted
        ? `已${modalMode.value === 'update' ? '更新' : '新增'}云端配置（${count} 条会话）`
        : `已${modalMode.value === 'update' ? '更新' : '新增'}本地配置（${count} 条会话）`,
    )
    modalVisible.value = false
    await reload()
  } finally {
    submitting.value = false
  }
}

async function removeConfig(item: ConfigItem) {
  if (auth.cloudSyncEnabled && item.id) {
    await request.delete(`/configs/${item.id}`)
  } else {
    await deleteLocalConfig(item.deepseekUserId)
  }
  message.success('已删除')
  await reload()
}

function viewConversations() {
  router.push('/explore')
}

function fmtDate(d: any) {
  if (!d) return ''
  return new Date(d).toLocaleString()
}

onMounted(reload)
</script>

<template>
  <div>
    <NSpace justify="space-between" align="center" style="margin-bottom: 16px;">
      <h2 style="margin: 0;">Deepseek 配置</h2>
      <NSpace align="center" :size="12">
        <NTag :type="auth.cloudSyncEnabled ? 'success' : 'default'" size="small">
          {{ auth.cloudSyncEnabled ? '云端存储' : '仅本地' }}
        </NTag>
        <NButton type="primary" @click="openCreate">新增配置</NButton>
      </NSpace>
    </NSpace>

    <NSpin :show="loading">
      <NEmpty v-if="!loading && configs.length === 0" description="还没有配置，点击右上角新增" style="padding: 40px 0;" />
      <NSpace v-else :size="16" wrap>
        <NCard
          v-for="c in configs"
          :key="c.deepseekUserId"
          class="neu-card"
          style="width: 360px;"
          :bordered="false"
        >
          <h3 style="margin: 0 0 8px;">{{ c.name }}</h3>
          <NSpace vertical :size="4" style="font-size: 13px; color: var(--text-muted);">
            <NText depth="3">Deepseek 用户：{{ c.deepseekUserId.slice(0, 13) }}…</NText>
            <NText depth="3" v-if="c.deepseekMobile">手机：{{ c.deepseekMobile }}</NText>
            <NText depth="3">会话数：{{ c.conversationCount ?? '—' }}</NText>
            <NText depth="3">更新时间：{{ fmtDate(c.updatedAt) }}</NText>
          </NSpace>
          <template #action>
            <NSpace justify="end" :size="8">
              <NButton size="small" @click="viewConversations">查看</NButton>
              <NButton size="small" type="primary" ghost @click="openUpdate(c)">更新</NButton>
              <NButton size="small" type="error" ghost @click="removeConfig(c)">删除</NButton>
            </NSpace>
          </template>
        </NCard>
      </NSpace>
    </NSpin>

    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="modalMode === 'create' ? '新增 Deepseek 配置' : '更新配置（上传新数据包）'"
      style="width: 460px; max-width: 92vw;"
    >
      <NForm label-placement="top">
        <NFormItem label="配置名称" v-if="modalMode === 'create'">
          <NInput v-model:value="modalName" placeholder="给这个 Deepseek 账号起个名字" />
        </NFormItem>
        <NFormItem v-else label="配置名称">
          <NInput :value="modalName" disabled />
        </NFormItem>
        <NFormItem label="数据压缩包（zip）">
          <NUpload
            :max="1"
            accept=".zip"
            :default-upload="false"
            @change="onFileChange"
            :file-list="[]"
          >
            <NButton>选择 zip 文件</NButton>
          </NUpload>
          <NText v-if="modalFile" depth="3" style="margin-left: 8px;">{{ modalFile.name }}</NText>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitModal">确定</NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>
