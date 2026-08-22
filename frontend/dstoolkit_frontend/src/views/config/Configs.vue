<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { h } from 'vue'
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
  NIcon,
  type UploadFileInfo,
} from 'naive-ui'
import {
  CloudOutline,
  CloudOfflineOutline,
  AddOutline,
  FolderOpenOutline,
  EyeOutline,
  RefreshOutline,
  TrashOutline,
  PersonCircleOutline,
  ChatbubbleEllipsesOutline,
  CalendarOutline,
  HardwareChipOutline,
} from '@vicons/ionicons5'
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
      await saveLocalConfig(res.config, res.conversations ?? [])
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
  <div class="page-enter">
    <!-- 页面头部 -->
    <div class="page-header" style="margin-bottom: 24px;">
      <NSpace align="center" :size="14" wrap>
        <div class="page-header-icon">
          <NIcon size="22"><FolderOpenOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <h2 style="margin: 0 0 4px;">Deepseek 配置</h2>
          <p class="page-header-sub">
            管理你导入的 Deepseek 账号配置，支持本地存储与云端同步两种模式
          </p>
        </div>
        <NSpace align="center" :size="10">
          <span v-if="auth.cloudSyncEnabled" class="pill pill-success">
            <NIcon size="12"><CloudOutline /></NIcon>
            云端存储
          </span>
          <span v-else class="pill pill-default">
            <NIcon size="12"><CloudOfflineOutline /></NIcon>
            仅本地
          </span>
          <NButton type="primary" @click="openCreate">
            <template #icon><NIcon size="16"><AddOutline /></NIcon></template>
            新增配置
          </NButton>
        </NSpace>
      </NSpace>
    </div>

    <!-- 配置列表 -->
    <NSpin :show="loading">
      <NEmpty
        v-if="!loading && configs.length === 0"
        description="还没有配置，点击右上角新增"
        style="padding: 60px 0;"
      />
      <div
        v-else
        class="config-grid"
        style="display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px;"
      >
        <div
          v-for="c in configs"
          :key="c.deepseekUserId"
          class="surface surface-hover config-card page-enter"
          style="padding: 20px;"
        >
          <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div
                class="config-avatar"
                style="width: 40px; height: 40px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%); color: var(--primary);"
              >
                <NIcon size="20"><PersonCircleOutline /></NIcon>
              </div>
              <div>
                <h3 style="margin: 0 0 2px; font-size: 16px;">{{ c.name }}</h3>
                <span class="pill pill-default" style="font-size: 11px;">
                  <NIcon size="10" style="margin-right: 2px;"><HardwareChipOutline /></NIcon>
                  {{ c.deepseekUserId.slice(0, 10) }}…
                </span>
              </div>
            </div>
          </div>

          <div class="config-meta" style="display: grid; grid-template-columns: 1fr; gap: 10px; margin-bottom: 18px;">
            <div class="meta-row" style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
              <NIcon size="14" style="color: var(--text-muted);"><PersonCircleOutline /></NIcon>
              <NText depth="3" style="font-size: 13px;">用户ID：{{ c.deepseekUserId.slice(0, 13) }}…</NText>
            </div>
            <div v-if="c.deepseekMobile" class="meta-row" style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
              <NIcon size="14" style="color: var(--text-muted);"><HardwareChipOutline /></NIcon>
              <NText depth="3" style="font-size: 13px;">手机：{{ c.deepseekMobile }}</NText>
            </div>
            <div class="meta-row" style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
              <NIcon size="14" style="color: var(--text-muted);"><ChatbubbleEllipsesOutline /></NIcon>
              <NText depth="3" style="font-size: 13px;">会话数：</NText>
              <NTag size="small" type="info" round>{{ c.conversationCount ?? '—' }}</NTag>
            </div>
            <div class="meta-row" style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
              <NIcon size="14" style="color: var(--text-muted);"><CalendarOutline /></NIcon>
              <NText depth="3" style="font-size: 13px;">更新：{{ fmtDate(c.updatedAt) }}</NText>
            </div>
          </div>

          <div
            class="card-actions"
            style="display: flex; gap: 8px; padding-top: 14px; border-top: 1px solid var(--border-subtle);"
          >
            <NButton size="small" @click="viewConversations">
              <template #icon><NIcon size="14"><EyeOutline /></NIcon></template>
              查看
            </NButton>
            <NButton size="small" type="primary" ghost @click="openUpdate(c)">
              <template #icon><NIcon size="14"><RefreshOutline /></NIcon></template>
              更新
            </NButton>
            <NButton size="small" type="error" ghost @click="removeConfig(c)">
              <template #icon><NIcon size="14"><TrashOutline /></NIcon></template>
              删除
            </NButton>
          </div>
        </div>
      </div>
    </NSpin>

    <!-- 模态框 -->
    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="modalMode === 'create' ? '新增 Deepseek 配置' : '更新配置（上传新数据包）'"
      style="width: 480px; max-width: 92vw;"
      :bordered="false"
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
            <NButton>
              <template #icon><NIcon size="14"><FolderOpenOutline /></NIcon></template>
              选择 zip 文件
            </NButton>
          </NUpload>
          <div v-if="modalFile" style="margin-top: 10px;">
            <span class="pill pill-primary" style="font-size: 12px;">
              📎 {{ modalFile.name }}
            </span>
          </div>
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
</style>
