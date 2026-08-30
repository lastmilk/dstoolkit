<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
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
import { message } from '@/utils/feedback'
import {
  saveLocalConfig,
  getLocalConfigs,
  deleteLocalConfig,
  buildAndPersistIndex,
  incrementalUpdateIndex,
} from '@/utils/db'
import type { DeepseekConfig, UploadResult } from '@/types'
import type { UploadFile } from 'tdesign-vue-next'

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

function onFileChange(files: Array<UploadFile>) {
  const f = files[files.length - 1]
  modalFile.value = f?.raw ?? null
}

async function submitModal() {
  if (!modalFile.value) {
    message.error('请选择 Deepseek 导出的 zip 数据包')
    return
  }
  if (modalMode.value === 'create' && !modalName.value.trim()) {
    message.error('请给这个账号起个名字')
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
        ? `已${modalMode.value === 'update' ? '更新' : '导入'}云端账号（${count} 个对话）`
        : `已${modalMode.value === 'update' ? '更新' : '导入'}本地账号（${count} 个对话）`,
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
  message.success('账号已移除')
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
    <!-- 横幅 -->
    <div class="chronos-page-banner">
      <div class="banner-glow-1"></div>
      <div class="banner-glow-2"></div>
      <div class="banner-inner">
        <div class="banner-title-block">
          <div class="chronos-eyebrow">
            <AppIcon :size="12"><ServerOutline /></AppIcon>
            <span>ACCOUNT MANAGEMENT // 账号管理</span>
          </div>
          <h1 class="chronos-page-title">
            账号配置
            <span class="title-accent">· 数据管理</span>
          </h1>
          <p class="chronos-page-sub">
            管理已导入的 Deepseek 账号配置，支持本地存储与云端同步两种模式
          </p>
        </div>
        <div class="banner-actions">
          <span :class="['mode-pill', auth.cloudSyncEnabled ? 'cloud' : 'local']">
            <AppIcon :size="12">
              <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
            </AppIcon>
            {{ auth.cloudSyncEnabled ? '云端同步已开启' : '本地模式' }}
          </span>
          <t-button theme="primary" @click="openCreate" class="chronos-btn-banner">
            <template #icon><AppIcon :size="16"><AddOutline /></AppIcon></template>
            导入新账号
          </t-button>
        </div>
      </div>
    </div>

    <!-- 配置列表 -->
    <t-loading :loading="loading">
      <t-empty
        v-if="!loading && configs.length === 0"
        description="还没有导入的账号，点击上方导入新账号"
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
                <AppIcon :size="20"><PersonCircleOutline /></AppIcon>
                <div class="avatar-ring"></div>
              </div>
              <div class="config-head-text">
                <h3>{{ c.name }}</h3>
                <span class="config-id-tag">
                  <AppIcon :size="10" style="margin-right: 2px;"><HardwareChipOutline /></AppIcon>
                  {{ c.deepseekUserId.slice(0, 10) }}…
                </span>
              </div>
            </div>
          </div>

          <div class="config-meta">
            <div class="meta-row">
              <AppIcon :size="14" style="color: var(--primary);"><PersonCircleOutline /></AppIcon>
              <span class="meta-text">用户ID：{{ c.deepseekUserId.slice(0, 13) }}…</span>
            </div>
            <div v-if="c.deepseekMobile" class="meta-row">
              <AppIcon :size="14" style="color: var(--accent);"><HardwareChipOutline /></AppIcon>
              <span class="meta-text">手机：{{ c.deepseekMobile }}</span>
            </div>
            <div class="meta-row">
              <AppIcon :size="14" style="color: var(--warning);"><CalendarOutline /></AppIcon>
              <span class="meta-text">最近更新：{{ fmtDate(c.updatedAt) }}</span>
            </div>
          </div>

          <div class="card-actions">
            <t-button size="small" @click="viewConversations" class="action-btn">
              <template #icon><AppIcon :size="14"><EyeOutline /></AppIcon></template>
              查看
            </t-button>
            <t-button size="small" theme="primary" variant="outline" @click="openUpdate(c)" class="action-btn">
              <template #icon><AppIcon :size="14"><RefreshOutline /></AppIcon></template>
              更新
            </t-button>
            <t-button size="small" theme="danger" variant="outline" @click="removeConfig(c)" class="action-btn">
              <template #icon><AppIcon :size="14"><TrashOutline /></AppIcon></template>
              移除
            </t-button>
          </div>
        </div>
      </div>
    </t-loading>

    <!-- 模态框 -->
    <t-dialog
      v-model:visible="modalVisible"
      :header="modalMode === 'create' ? '导入新的 Deepseek 账号' : '更新此账号数据（上传新数据包）'"
      width="480px"
      :dialog-style="{ maxWidth: '92vw' }"
      dialog-class-name="chronos-modal"
    >
      <t-form label-align="top">
        <t-form-item label="账号名称" v-if="modalMode === 'create'">
          <t-input v-model="modalName" placeholder="例如：工作主账号、个人账号" />
        </t-form-item>
        <t-form-item v-else label="账号名称">
          <t-input :value="modalName" disabled />
        </t-form-item>
        <t-form-item label="数据包（zip 压缩包）">
          <t-upload
            accept=".zip"
            :auto-upload="false"
            theme="custom"
            @change="onFileChange"
          >
            <t-button>
              <template #icon><AppIcon :size="14"><FolderOpenOutline /></AppIcon></template>
              选择数据包
            </t-button>
          </t-upload>
          <div v-if="modalFile" style="margin-top: 10px;">
            <span class="chronos-file-tag">
              📦 {{ modalFile.name }}
            </span>
          </div>
        </t-form-item>
      </t-form>
      <template #footer>
        <div style="display: flex; justify-content: flex-end; gap: 8px;">
          <t-button @click="modalVisible = false">取消</t-button>
          <t-button theme="primary" :loading="submitting" @click="submitModal">
            <template #icon v-if="!submitting"><AppIcon :size="14"><RocketOutline /></AppIcon></template>
            {{ modalMode === 'create' ? '导入' : '更新' }}
          </t-button>
        </div>
      </template>
    </t-dialog>
  </div>
</template>

<style scoped>
.chronos-page-banner {
  position: relative;
  padding: 22px 24px;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, rgba(14, 165, 233, 0.08) 0%, rgba(79, 70, 229, 0.08) 50%, rgba(16, 185, 129, 0.06) 100%),
    linear-gradient(180deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.98) 100%);
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
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
}
.banner-glow-2 {
  width: 200px; height: 200px;
  bottom: -100px; left: 20%;
  background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
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
  color: var(--success);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  padding: 4px 10px;
  background: var(--success-soft);
  border-radius: 4px;
  border: 1px solid rgba(16, 185, 129, 0.18);
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
  color: var(--primary);
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
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  letter-spacing: 0.03em;
}
.mode-pill.cloud {
  background: var(--success-soft);
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.25);
}
.mode-pill.local {
  background: var(--surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.chronos-btn-banner {
  box-shadow: 0 4px 16px rgba(79, 70, 229, 0.25);
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
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.config-card:hover {
  transform: translateY(-2px);
  border-color: rgba(79, 70, 229, 0.3);
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08), 0 0 20px rgba(79, 70, 229, 0.06);
}
.card-glow {
  position: absolute;
  top: -40px; right: -40px;
  width: 140px; height: 140px;
  background: radial-gradient(circle, rgba(79, 70, 229, 0.15) 0%, transparent 65%);
  pointer-events: none;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
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
  background: linear-gradient(135deg, rgba(14, 165, 233, 0.2), rgba(79, 70, 229, 0.2));
  color: var(--primary);
  position: relative;
}
.avatar-ring {
  position: absolute;
  inset: -3px;
  border-radius: 14px;
  border: 1px solid rgba(79, 70, 229, 0.35);
  opacity: 0.7;
}
.config-head-text h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.config-id-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--border-subtle);
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
  color: var(--text-secondary);
}
.chronos-count-tag {
  background: var(--primary-soft) !important;
  color: var(--primary) !important;
  border: 1px solid rgba(79, 70, 229, 0.2) !important;
  font-weight: 600;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  display: inline-flex;
  align-items: center;
}

.card-actions {
  display: flex;
  gap: 8px;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
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
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: var(--radius);
  font-size: 12px;
  font-weight: 600;
  border: 1px solid rgba(79, 70, 229, 0.2);
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
