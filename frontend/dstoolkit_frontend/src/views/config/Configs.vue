<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  ElButton,
  ElSpace,
  ElCard,
  ElDialog,
  ElForm,
  ElFormItem,
  ElInput,
  ElUpload,
  ElTag,
  ElEmpty,
  ElIcon,
} from 'element-plus'
import type { UploadFile, UploadFiles } from 'element-plus'
import {
  Upload,
  Download,
  Plus,
  FolderOpened,
  View,
  Refresh,
  Delete,
  User,
  ChatDotRound,
  Calendar,
  Coin,
  Promotion,
  Service,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { request } from '@/utils/request'
import { toast } from '@/utils/toast'
import * as sweetalert from '@/utils/sweetalert'
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

function onFileChange(uploadFiles: UploadFiles) {
  const f = uploadFiles[0]
  modalFile.value = f?.raw ?? null
}

async function submitModal() {
  if (!modalFile.value) {
    toast.error('请选择 Deepseek 导出的 zip 数据包')
    return
  }
  if (modalMode.value === 'create' && !modalName.value.trim()) {
    toast.error('请给这个账号起个名字')
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
    const count: number = res.conversations?.length ?? res.conversationCount ?? 0
    toast.success(
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
  const ok = await sweetalert.confirm('确定移除此账号？', '本地索引与缓存数据将一并清理，此操作不可撤销。')
  if (!ok) return
  if (auth.cloudSyncEnabled && item.id) {
    await request.delete(`/configs/${item.id}`)
  } else {
    await deleteLocalConfig(item.deepseekUserId)
  }
  toast.success('账号已移除')
  await reload()
}

function viewConversations() {
  router.push('/explore')
}

function fmtDate(d: number | string | undefined | null): string {
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
            <el-icon :size="12"><Service /></el-icon>
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
            <el-icon :size="12">
              <component :is="auth.cloudSyncEnabled ? Upload : Download" />
            </el-icon>
            {{ auth.cloudSyncEnabled ? '云端同步已开启' : '本地模式' }}
          </span>
          <el-button type="primary" size="default" @click="openCreate" class="chronos-btn-banner">
            <template #icon><el-icon :size="16"><Plus /></el-icon></template>
            导入新账号
          </el-button>
        </div>
      </div>
    </div>

    <!-- 配置列表 -->
    <div v-loading="loading" style="min-height: 200px;">
      <el-empty
        v-if="!loading && configs.length === 0"
        description="还没有导入的账号，点击上方导入新账号"
        :image-size="80"
        style="padding: 60px 0;"
      />
      <div
        v-else
        class="config-grid"
      >
        <el-card
          v-for="c in configs"
          :key="c.deepseekUserId"
          class="glass-card config-card page-enter"
          shadow="never"
        >
          <div class="panel-corner tl"></div>
          <div class="panel-corner tr"></div>
          <div class="panel-corner bl"></div>
          <div class="panel-corner br"></div>
          <div class="card-glow"></div>

          <div class="config-head">
            <div class="config-head-left">
              <div class="config-avatar">
                <el-icon :size="20"><User /></el-icon>
                <div class="avatar-ring"></div>
              </div>
              <div class="config-head-text">
                <h3>{{ c.name }}</h3>
                <span class="config-id-tag">
                  <el-icon :size="10" style="margin-right: 2px;"><Coin /></el-icon>
                  {{ c.deepseekUserId.slice(0, 10) }}…
                </span>
              </div>
            </div>
          </div>

          <div class="config-meta">
            <div class="meta-row">
              <el-icon :size="14" style="color: var(--primary);"><User /></el-icon>
              <span class="meta-text">用户ID：{{ c.deepseekUserId.slice(0, 13) }}…</span>
            </div>
            <div v-if="c.deepseekMobile" class="meta-row">
              <el-icon :size="14" style="color: var(--accent);"><Coin /></el-icon>
              <span class="meta-text">手机：{{ c.deepseekMobile }}</span>
            </div>
            <div class="meta-row">
              <el-icon :size="14" style="color: var(--warning);"><Calendar /></el-icon>
              <span class="meta-text">最近更新：{{ fmtDate(c.updatedAt) }}</span>
            </div>
          </div>

          <div class="card-actions">
            <el-button size="small" @click="viewConversations" class="action-btn">
              <template #icon><el-icon :size="14"><View /></el-icon></template>
              查看
            </el-button>
            <el-button size="small" type="primary" plain @click="openUpdate(c)" class="action-btn">
              <template #icon><el-icon :size="14"><Refresh /></el-icon></template>
              更新
            </el-button>
            <el-button size="small" type="danger" plain @click="removeConfig(c)" class="action-btn">
              <template #icon><el-icon :size="14"><Delete /></el-icon></template>
              移除
            </el-button>
          </div>
        </el-card>
      </div>
    </div>

    <!-- 模态框 -->
    <el-dialog
      v-model="modalVisible"
      :title="modalMode === 'create' ? '导入新的 Deepseek 账号' : '更新此账号数据（上传新数据包）'"
      class="chronos-modal"
      width="480px"
    >
      <el-form label-position="top">
        <el-form-item label="账号名称" v-if="modalMode === 'create'">
          <el-input v-model="modalName" placeholder="例如：工作主账号、个人账号" />
        </el-form-item>
        <el-form-item v-else label="账号名称">
          <el-input :model-value="modalName" disabled />
        </el-form-item>
        <el-form-item label="数据包（zip 压缩包）">
          <el-upload
            :limit="1"
            accept=".zip"
            :auto-upload="false"
            :on-change="(uf, ufs) => onFileChange(ufs)"
            :file-list="[]"
          >
            <el-button>
              <template #icon><el-icon :size="14"><FolderOpened /></el-icon></template>
              选择数据包
            </el-button>
          </el-upload>
          <div v-if="modalFile" style="margin-top: 10px;">
            <span class="chronos-file-tag">
              📦 {{ modalFile.name }}
            </span>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-space justify="end">
          <el-button @click="modalVisible = false">取消</el-button>
          <el-button type="primary" :loading="submitting" @click="submitModal">
            <template #icon v-if="!submitting"><el-icon :size="14"><Promotion /></el-icon></template>
            {{ modalMode === 'create' ? '导入' : '更新' }}
          </el-button>
        </el-space>
      </template>
    </el-dialog>
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
  position: relative;
  overflow: visible;
}
.config-card :deep(.el-card__body) {
  padding: 0;
  position: relative;
  z-index: 1;
}
.config-card:hover {
  border-color: rgba(79, 70, 229, 0.3) !important;
  box-shadow: 0 10px 30px rgba(15, 23, 42, 0.08), 0 0 20px rgba(79, 70, 229, 0.06) !important;
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
