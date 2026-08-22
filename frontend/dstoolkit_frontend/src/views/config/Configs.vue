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
  RocketOutline,
  ServerOutline,
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
    message.error('请选择 Deepseek 导出的 zip 数据包')
    return
  }
  if (modalMode.value === 'create' && !modalName.value.trim()) {
    message.error('请给这个时间线起个名字')
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
        /* 索引构建失败不阻断流程 */
      }
    }
    const count = res.conversations?.length ?? res.conversationCount ?? 0
    message.success(
      res.persisted
        ? `已${modalMode.value === 'update' ? '校准' : '接入'}云端时间线（${count} 个节点）`
        : `已${modalMode.value === 'update' ? '校准' : '接入'}本地时间线（${count} 个节点）`,
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
  message.success('时间线已移除')
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
  <div class="page-enter" style="display: flex; flex-direction: column; gap: 18px;">
    <!-- Chronos 横幅 -->
    <div class="chronos-page-banner">
      <div class="banner-glow-1"></div>
      <div class="banner-glow-2"></div>
      <div class="banner-inner">
        <div class="banner-title-block">
          <div class="chronos-eyebrow">
            <NIcon size="12"><ServerOutline /></NIcon>
            <span>TIMELINE ARCHIVE // 时间线档案库</span>
          </div>
          <h1 class="chronos-page-title">
            时间线配置
            <span class="title-accent">· 档案管理</span>
          </h1>
          <p class="chronos-page-sub">
            管理已接入的 Deepseek 时间线档案，支持本地存储舱与量子云端双模式同步
          </p>
        </div>
        <div class="banner-actions">
          <span :class="['mode-pill', auth.cloudSyncEnabled ? 'cloud' : 'local']">
            <NIcon size="12">
              <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
            </NIcon>
            {{ auth.cloudSyncEnabled ? '量子云端已连接' : '本地存储舱模式' }}
          </span>
          <NButton type="primary" size="medium" @click="openCreate" class="chronos-btn-banner">
            <template #icon><NIcon size="16"><AddOutline /></NIcon></template>
            接入新时间线
          </NButton>
        </div>
      </div>
    </div>

    <!-- 配置列表 -->
    <NSpin :show="loading">
      <NEmpty
        v-if="!loading && configs.length === 0"
        description="还没有接入的时间线，点击上方接入新档案"
        style="padding: 60px 0;"
      />
      <div
        v-else
        class="config-grid"
      >
        <div
          v-for="c in configs"
          :key="c.deepseekUserId"
          class="chronos-panel config-card page-enter"
        >
          <div class="panel-corner tl"></div>
          <div class="panel-corner tr"></div>
          <div class="panel-corner bl"></div>
          <div class="panel-corner br"></div>
          <div class="card-glow"></div>

          <div class="config-head">
            <div class="config-head-left">
              <div class="config-avatar">
                <NIcon size="20"><PersonCircleOutline /></NIcon>
                <div class="avatar-ring"></div>
              </div>
              <div class="config-head-text">
                <h3>{{ c.name }}</h3>
                <span class="config-id-tag">
                  <NIcon size="10" style="margin-right: 2px;"><HardwareChipOutline /></NIcon>
                  {{ c.deepseekUserId.slice(0, 10) }}…
                </span>
              </div>
            </div>
          </div>

          <div class="config-meta">
            <div class="meta-row">
              <NIcon size="14" style="color: var(--chronos-primary);"><PersonCircleOutline /></NIcon>
              <NText depth="3" class="meta-text">用户ID：{{ c.deepseekUserId.slice(0, 13) }}…</NText>
            </div>
            <div v-if="c.deepseekMobile" class="meta-row">
              <NIcon size="14" style="color: var(--chronos-accent);"><HardwareChipOutline /></NIcon>
              <NText depth="3" class="meta-text">手机：{{ c.deepseekMobile }}</NText>
            </div>
            <div class="meta-row">
              <NIcon size="14" style="color: var(--chronos-rose);"><ChatbubbleEllipsesOutline /></NIcon>
              <NText depth="3" class="meta-text">时间节点：</NText>
              <NTag size="small" round class="chronos-count-tag">
                <RocketOutline style="font-size: 11px; margin-right: 4px;" />
                {{ c.conversationCount ?? '—' }}
              </NTag>
            </div>
            <div class="meta-row">
              <NIcon size="14" style="color: var(--chronos-warning);"><CalendarOutline /></NIcon>
              <NText depth="3" class="meta-text">最近校准：{{ fmtDate(c.updatedAt) }}</NText>
            </div>
          </div>

          <div class="card-actions">
            <NButton size="small" @click="viewConversations" class="action-btn">
              <template #icon><NIcon size="14"><EyeOutline /></NIcon></template>
              查看
            </NButton>
            <NButton size="small" type="primary" ghost @click="openUpdate(c)" class="action-btn">
              <template #icon><NIcon size="14"><RefreshOutline /></NIcon></template>
              校准
            </NButton>
            <NButton size="small" type="error" ghost @click="removeConfig(c)" class="action-btn">
              <template #icon><NIcon size="14"><TrashOutline /></NIcon></template>
              移除
            </NButton>
          </div>
        </div>
      </div>
    </NSpin>

    <!-- 模态框 -->
    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="modalMode === 'create' ? '接入新的时间线档案' : '重新校准此时间线（上传新数据包）'"
      class="chronos-modal"
      style="width: 480px; max-width: 92vw;"
      :bordered="false"
    >
      <NForm label-placement="top">
        <NFormItem label="时间线名称" v-if="modalMode === 'create'">
          <NInput v-model:value="modalName" placeholder="给这个 Deepseek 时间线起个代号" />
        </NFormItem>
        <NFormItem v-else label="时间线名称">
          <NInput :value="modalName" disabled />
        </NFormItem>
        <NFormItem label="数据包（zip 压缩包）">
          <NUpload
            :max="1"
            accept=".zip"
            :default-upload="false"
            @change="onFileChange"
            :file-list="[]"
          >
            <NButton>
              <template #icon><NIcon size="14"><FolderOpenOutline /></NIcon></template>
              选择数据包
            </NButton>
          </NUpload>
          <div v-if="modalFile" style="margin-top: 10px;">
            <span class="chronos-file-tag">
              📦 {{ modalFile.name }}
            </span>
          </div>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitModal">
            <template #icon v-if="!submitting"><NIcon size="14"><RocketOutline /></NIcon></template>
            {{ modalMode === 'create' ? '接入' : '校准' }}
          </NButton>
        </NSpace>
      </template>
    </NModal>
  </div>
</template>

<style scoped>
.chronos-page-banner {
  position: relative;
  padding: 22px 24px;
  border-radius: var(--chronos-radius-lg);
  background:
    linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(168, 85, 247, 0.08) 50%, rgba(16, 185, 129, 0.06) 100%),
    linear-gradient(180deg, rgba(17, 26, 53, 0.95) 0%, rgba(11, 18, 38, 0.98) 100%);
  border: 1px solid var(--chronos-border);
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
  background: radial-gradient(circle, var(--chronos-accent) 0%, transparent 70%);
}
.banner-glow-2 {
  width: 200px; height: 200px;
  bottom: -100px; left: 20%;
  background: radial-gradient(circle, var(--chronos-primary) 0%, transparent 70%);
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
  color: var(--chronos-success);
  font-family: var(--chronos-mono);
  padding: 4px 10px;
  background: rgba(16, 185, 129, 0.08);
  border-radius: 4px;
  border: 1px solid rgba(16, 185, 129, 0.18);
  margin-bottom: 10px;
}
.chronos-page-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--chronos-text);
  line-height: 1.2;
}
.title-accent {
  color: var(--chronos-primary);
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  opacity: 0.85;
}
.chronos-page-sub {
  margin: 6px 0 0;
  font-size: 13.5px;
  color: var(--chronos-text-muted);
  line-height: 1.55;
  max-width: 520px;
}

.banner-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.mode-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: var(--chronos-radius-full);
  font-size: 12px;
  font-weight: 600;
  font-family: var(--chronos-mono);
  letter-spacing: 0.03em;
}
.mode-pill.cloud {
  background: var(--chronos-success-soft);
  color: var(--chronos-success);
  border: 1px solid rgba(16, 185, 129, 0.25);
}
.mode-pill.local {
  background: var(--chronos-surface-2);
  color: var(--chronos-text-secondary);
  border: 1px solid var(--chronos-border);
}
.chronos-btn-banner {
  box-shadow: 0 4px 16px rgba(0, 212, 255, 0.25);
}

.config-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.config-card {
  padding: 20px;
  position: relative;
  overflow: hidden;
  transition: all var(--chronos-transition);
}
.config-card:hover {
  transform: translateY(-2px);
  border-color: rgba(0, 212, 255, 0.3);
  box-shadow: 0 10px 30px rgba(0,0,0,0.2), 0 0 20px rgba(0, 212, 255, 0.06);
}
.card-glow {
  position: absolute;
  top: -40px; right: -40px;
  width: 140px; height: 140px;
  background: radial-gradient(circle, rgba(168, 85, 247, 0.15) 0%, transparent 65%);
  pointer-events: none;
  transition: all var(--chronos-transition);
}
.config-card:hover .card-glow {
  transform: scale(1.15);
  opacity: 0.9;
}

.config-head {
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}
.config-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.config-avatar {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.2), rgba(168, 85, 247, 0.2));
  color: var(--chronos-primary);
  position: relative;
}
.avatar-ring {
  position: absolute;
  inset: -3px;
  border-radius: 14px;
  border: 1px solid rgba(0, 212, 255, 0.35);
  opacity: 0.7;
}
.config-head-text h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--chronos-text);
}
.config-id-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--chronos-radius-full);
  background: var(--chronos-surface-2);
  color: var(--chronos-text-muted);
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--chronos-border-subtle);
}

.config-meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 18px;
  position: relative;
  z-index: 1;
}
.meta-row {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}
.meta-text {
  font-size: 13px;
  color: var(--chronos-text-secondary);
}
.chronos-count-tag {
  background: rgba(0, 212, 255, 0.1) !important;
  color: var(--chronos-primary) !important;
  border: 1px solid rgba(0, 212, 255, 0.2) !important;
  font-weight: 600;
  font-family: var(--chronos-mono);
  display: inline-flex;
  align-items: center;
}

.card-actions {
  display: flex;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--chronos-border-subtle);
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
}
.action-btn {
  flex: 1;
  min-width: 80px;
}

.chronos-file-tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 12px;
  background: rgba(0, 212, 255, 0.1);
  color: var(--chronos-primary);
  border-radius: var(--chronos-radius);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(0, 212, 255, 0.2);
}

/* 响应式 */
@media (max-width: 720px) {
  .chronos-page-banner { padding: 18px 16px; }
  .chronos-page-title { font-size: 20px; }
  .banner-actions { width: 100%; }
  .banner-actions .mode-pill { flex: 1; justify-content: center; }
  .config-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .chronos-page-banner { padding: 16px 14px; }
  .chronos-page-title { font-size: 18px; }
  .chronos-page-sub { font-size: 12.5px; }
  .config-card { padding: 16px; }
  .action-btn { flex: 1 1 calc(50% - 4px); }
}
</style>
