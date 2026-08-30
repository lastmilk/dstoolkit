<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { h } from 'vue'
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
  GitBranchOutline,
  TimeOutline,
  DownloadOutline,
  ArrowUndoOutline,
  DocumentTextOutline,
  ArchiveOutline,
} from '@vicons/ionicons5'
import AppIcon from '@/components/AppIcon.vue'
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
import type { UploadFile } from 'tdesign-vue-next'
import type { ChatRepo, RepoCommit, UploadResult } from '@/types'

const auth = useAuthStore()
const router = useRouter()

const repos = ref<ChatRepo[]>([])
const loading = ref(false)

async function reload() {
  loading.value = true
  try {
    if (auth.cloudSyncEnabled) {
      const res: any = await request.get('/repos')
      repos.value = res.repos ?? res.configs ?? []
    } else {
      const local = await getLocalConfigs()
      repos.value = local.map((c: any) => ({
        id: null,
        name: c.name,
        description: null,
        conversationCount: c.conversationCount ?? 0,
        commitCount: 0,
        lastCommitSha: null,
        lastCommitAt: c.updatedAt ?? null,
        updatedAt: c.updatedAt,
      }))
    }
  } finally {
    loading.value = false
  }
}

// ═══════════ 创建/更新仓库模态框 ═══════════
const modalVisible = ref(false)
const modalMode = ref<'create' | 'update'>('create')
const modalName = ref('')
const modalDescription = ref('')
const modalFile = ref<File | null>(null)
const modalTarget = ref<ChatRepo | null>(null)
const submitting = ref(false)

function openCreate() {
  modalMode.value = 'create'
  modalName.value = ''
  modalDescription.value = ''
  modalFile.value = null
  modalTarget.value = null
  modalVisible.value = true
}

function openUpdate(item: ChatRepo) {
  modalMode.value = 'update'
  modalName.value = item.name
  modalDescription.value = item.description ?? ''
  modalFile.value = null
  modalTarget.value = item
  modalVisible.value = true
}

function onFileChange(files: Array<UploadFile>) {
  // TDesign 单文件选择每次变更都会以新文件列表回调，取第一个的 raw（File 对象）
  const f = files?.[0]
  modalFile.value = f?.raw ?? null
}

async function submitModal() {
  if (modalMode.value === 'create' && !modalName.value.trim()) {
    message.error('请填写仓库名称')
    return
  }
  if (!modalFile.value && modalMode.value === 'create') {
    // 允许创建空仓库（不强制上传文件）
  }
  if (modalFile.value && modalMode.value === 'create' && !modalName.value.trim()) {
    message.error('请填写仓库名称')
    return
  }
  submitting.value = true
  try {
    const fd = new FormData()
    if (modalFile.value) {
      fd.append('file', modalFile.value)
    }
    fd.append('name', modalName.value.trim())
    if (modalDescription.value.trim()) {
      fd.append('description', modalDescription.value.trim())
    }

    if (modalMode.value === 'create') {
      const res = (await request.post('/repos', fd)) as UploadResult
      if (!res.persisted) {
        await saveLocalConfig(res.config, res.conversations ?? [])
        try {
          await buildAndPersistIndex(res.config.deepseekUserId, res.conversations ?? [])
        } catch {
          /* 索引构建失败不阻断流程 */
        }
      }
      const count = res.conversations?.length ?? res.conversationCount ?? 0
      message.success(`仓库已创建${modalFile.value ? `（导入 ${count} 个对话）` : '（空仓库）'}`)
    } else {
      // 更新模式：上传新数据包
      if (!modalFile.value) {
        message.error('请选择要导入的 zip 数据包')
        submitting.value = false
        return
      }
      const fd2 = new FormData()
      fd2.append('file', modalFile.value)
      const res = (await request.put(`/repos/${modalTarget.value?.id}/upload`, fd2)) as UploadResult
      if (!res.persisted) {
        await saveLocalConfig(res.config, res.conversations ?? [])
        try {
          const changedConvIds = (res.conversations ?? []).map((c) => c.deepseekConvId)
          await incrementalUpdateIndex(
            res.config.deepseekUserId,
            changedConvIds,
            res.conversations ?? [],
          )
        } catch {
          /* 索引构建失败不阻断流程 */
        }
      }
      const count = res.conversations?.length ?? res.conversationCount ?? 0
      message.success(`数据已更新（共 ${count} 个对话${res.added ? `，+${res.added} 新增` : ''}）`)
    }
    modalVisible.value = false
    await reload()
  } catch (e: any) {
    message.error(e?.response?.data?.error || '操作失败')
  } finally {
    submitting.value = false
  }
}

async function removeRepo(item: ChatRepo) {
  if (auth.cloudSyncEnabled && item.id) {
    await request.delete(`/repos/${item.id}`)
  } else {
    // 本地模式需要 deepseekUserId，从旧字段获取
    const local = await getLocalConfigs()
    const target = local.find((c: any) => c.name === item.name)
    if (target) {
      await deleteLocalConfig(target.deepseekUserId)
    }
  }
  message.success('仓库已删除')
  await reload()
}

function viewConversations() {
  router.push('/explore')
}

// ═══════════ 版本历史 Drawer ═══════════
const historyDrawerVisible = ref(false)
const historyLoading = ref(false)
const historyCommits = ref<RepoCommit[]>([])
const historyRepo = ref<ChatRepo | null>(null)
const historySnapshotBytes = ref<number>(0)
const rollbackLoading = ref(false)

async function openHistory(item: ChatRepo) {
  if (!item.id) {
    message.info('本地模式不支持版本历史')
    return
  }
  historyRepo.value = item
  historyDrawerVisible.value = true
  historyLoading.value = true
  historyCommits.value = []
  try {
    const res: any = await request.get(`/repos/${item.id}/history`)
    historyCommits.value = res.commits ?? []
    historySnapshotBytes.value = res.snapshotBytes ?? 0
  } catch (e: any) {
    message.error(e?.response?.data?.error || '加载历史失败')
  } finally {
    historyLoading.value = false
  }
}

async function rollbackTo(sha: string) {
  if (!historyRepo.value?.id || rollbackLoading.value) return
  rollbackLoading.value = true
  try {
    await request.post(`/repos/${historyRepo.value.id}/rollback`, { sha })
    message.success('已回滚到指定版本')
    await openHistory(historyRepo.value)
    await reload()
  } catch (e: any) {
    message.error(e?.response?.data?.error || '回滚失败')
  } finally {
    rollbackLoading.value = false
  }
}

function downloadSnapshot(sha: string) {
  if (!historyRepo.value?.id) return
  window.open(`/api/repos/${historyRepo.value.id}/commits/${sha}/download`, '_blank')
}

function fmtDate(d: any) {
  if (!d) return ''
  return new Date(d).toLocaleString('zh-CN')
}

function fmtBytes(bytes: number) {
  if (!bytes) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

const hasRepos = computed(() => repos.value.length > 0)

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
            <span>GIT REPOSITORY // 聊天仓库</span>
          </div>
          <h1 class="chronos-page-title">
            聊天仓库
            <span class="title-accent">· Git 版本化</span>
          </h1>
          <p class="chronos-page-sub">
            以 Git 仓库管理你的对话记录，每次导入即一次提交，支持版本回滚。兼容 DeepSeek 与 ChatGPT 导出格式。
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
            创建仓库
          </t-button>
        </div>
      </div>
    </div>

    <!-- 仓库列表 -->
    <t-loading :loading="loading">
      <t-empty
        v-if="!loading && !hasRepos"
        description="还没有聊天仓库，点击上方创建"
        style="padding: 60px 0;"
      />
      <div
        v-else
        class="repo-grid"
      >
        <div
          v-for="r in repos"
          :key="r.id ?? r.name"
          class="chronos-panel repo-card page-enter"
        >
          <div class="panel-corner tl"></div>
          <div class="panel-corner tr"></div>
          <div class="panel-corner bl"></div>
          <div class="panel-corner br"></div>
          <div class="card-glow"></div>

          <div class="repo-head">
            <div class="repo-head-left">
              <div class="repo-avatar">
                <AppIcon :size="20"><GitBranchOutline /></AppIcon>
                <div class="avatar-ring"></div>
              </div>
              <div class="repo-head-text">
                <h3>{{ r.name }}</h3>
                <span class="repo-id-tag">
                  <AppIcon :size="10" style="margin-right: 2px;"><HardwareChipOutline /></AppIcon>
                  {{ r.defaultBranch || 'main' }}
                </span>
              </div>
            </div>
            <t-tag v-if="r.commitCount" size="small" shape="round" theme="primary" variant="light">
              <template #icon><AppIcon :size="12"><GitBranchOutline /></AppIcon></template>
              {{ r.commitCount }} 次提交
            </t-tag>
          </div>

          <p v-if="r.description" class="repo-desc">{{ r.description }}</p>

          <div class="repo-meta">
            <div class="meta-row">
              <AppIcon :size="14" style="color: var(--primary);"><ChatbubbleEllipsesOutline /></AppIcon>
              <span class="meta-text">{{ r.conversationCount ?? 0 }} 个对话</span>
            </div>
            <div v-if="r.lastCommitSha" class="meta-row">
              <AppIcon :size="14" style="color: var(--accent);"><GitBranchOutline /></AppIcon>
              <span class="meta-text">最新提交：{{ r.lastCommitSha.slice(0, 7) }}</span>
            </div>
            <div class="meta-row">
              <AppIcon :size="14" style="color: var(--warning);"><CalendarOutline /></AppIcon>
              <span class="meta-text">最近更新：{{ fmtDate(r.updatedAt) }}</span>
            </div>
          </div>

          <div class="card-actions">
            <t-button size="small" @click="viewConversations" class="action-btn">
              <template #icon><AppIcon :size="14"><EyeOutline /></AppIcon></template>
              查看
            </t-button>
            <t-button size="small" theme="primary" variant="outline" @click="openHistory(r)" class="action-btn" :disabled="!r.id">
              <template #icon><AppIcon :size="14"><TimeOutline /></AppIcon></template>
              历史
            </t-button>
            <t-button size="small" theme="primary" variant="outline" @click="openUpdate(r)" class="action-btn">
              <template #icon><AppIcon :size="14"><RefreshOutline /></AppIcon></template>
              更新
            </t-button>
            <t-popconfirm
              :content="`确定删除仓库「${r.name}」？所有对话数据和 Git 历史将被清除。`"
              @confirm="removeRepo(r)"
            >
              <t-button size="small" theme="danger" variant="outline" class="action-btn">
                <template #icon><AppIcon :size="14"><TrashOutline /></AppIcon></template>
                删除
              </t-button>
            </t-popconfirm>
          </div>
        </div>
      </div>
    </t-loading>

    <!-- 创建/更新仓库模态框 -->
    <t-dialog
      v-model:visible="modalVisible"
      :header="modalMode === 'create' ? '创建聊天仓库' : '更新仓库数据'"
      class="chronos-modal"
      width="min(500px, 92vw)"
      :footer="false"
    >
      <t-form label-align="top">
        <t-form-item label="仓库名称" v-if="modalMode === 'create'">
          <t-input v-model="modalName" placeholder="例如：工作主仓库、个人对话" />
        </t-form-item>
        <t-form-item v-else label="仓库名称">
          <t-input :value="modalName" disabled />
        </t-form-item>
        <t-form-item label="描述（可选）" v-if="modalMode === 'create'">
          <t-textarea
            v-model="modalDescription"
            placeholder="简要描述这个仓库的用途"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </t-form-item>
        <t-form-item :label="modalMode === 'create' ? '数据包（可选，zip 压缩包）' : '数据包（zip 压缩包）'">
          <t-upload
            theme="custom"
            :auto-upload="false"
            accept=".zip"
            @change="onFileChange"
          >
            <t-button>
              <template #icon><AppIcon :size="14"><FolderOpenOutline /></AppIcon></template>
              选择数据包
            </t-button>
          </t-upload>
          <div v-if="modalFile" style="margin-top: 10px;">
            <span class="chronos-file-tag">
              <AppIcon :size="14" style="margin-right: 4px;"><ArchiveOutline /></AppIcon>
              {{ modalFile.name }}
            </span>
          </div>
          <span style="font-size: 12px; margin-top: 6px; display: block; color: var(--text-muted);">
            支持 DeepSeek 和 ChatGPT 导出的 zip 包（仅需 conversations.json）
          </span>
        </t-form-item>
      </t-form>
      <div style="display: flex; justify-content: flex-end; gap: 8px;">
        <t-button @click="modalVisible = false">取消</t-button>
        <t-button theme="primary" :loading="submitting" @click="submitModal">
          <template #icon v-if="!submitting"><AppIcon :size="14"><RocketOutline /></AppIcon></template>
          {{ modalMode === 'create' ? '创建' : '更新' }}
        </t-button>
      </div>
    </t-dialog>

    <!-- 版本历史 Drawer -->
    <t-drawer
      v-model:visible="historyDrawerVisible"
      size="520px"
      placement="right"
      :header="`版本历史 · ${historyRepo?.name ?? ''}`"
      close-btn
      :footer="false"
    >
      <t-loading :loading="historyLoading">
        <div v-if="!historyLoading && historyCommits.length === 0" style="padding: 40px 0;">
          <t-empty description="暂无提交历史" />
        </div>
        <div v-else style="padding: 4px 0;">
          <!-- 仓库概览 -->
          <t-descriptions v-if="historyRepo" :column="1" size="small" bordered class="repo-info-desc">
            <t-descriptions-item label="仓库">{{ historyRepo.name }}</t-descriptions-item>
            <t-descriptions-item label="分支">{{ historyRepo.defaultBranch || 'main' }}</t-descriptions-item>
            <t-descriptions-item label="提交数">{{ historyCommits.length }}</t-descriptions-item>
            <t-descriptions-item label="快照大小">{{ fmtBytes(historySnapshotBytes) }}</t-descriptions-item>
          </t-descriptions>

          <!-- 提交时间线 -->
          <div class="history-timeline">
            <t-timeline>
              <t-timeline-item
                v-for="(commit, idx) in historyCommits"
                :key="commit.sha"
                :dot-color="idx === 0 ? 'var(--td-success-color)' : 'var(--td-component-stroke)'"
                :label="fmtDate(commit.date)"
              >
                <div class="commit-header">
                  <span class="commit-sha">{{ commit.shortSha }}</span>
                  <span v-if="idx === 0" class="commit-latest">最新</span>
                </div>
                <div class="commit-body">
                  <div class="commit-message">{{ commit.message }}</div>
                  <div class="commit-actions">
                    <t-button size="small" variant="text" @click="downloadSnapshot(commit.sha)">
                      <template #icon><AppIcon :size="12"><DownloadOutline /></AppIcon></template>
                      下载
                    </t-button>
                    <t-popconfirm
                      v-if="idx !== 0"
                      :content="`确定回滚到 ${commit.shortSha}？这将追加一条回滚提交，不会丢失当前历史。`"
                      @confirm="rollbackTo(commit.sha)"
                    >
                      <t-button size="small" variant="text" theme="warning" :loading="rollbackLoading">
                        <template #icon><AppIcon :size="12"><ArrowUndoOutline /></AppIcon></template>
                        回滚
                      </t-button>
                    </t-popconfirm>
                    <span v-else style="font-size: 11px; color: var(--text-muted);">（当前版本）</span>
                  </div>
                </div>
              </t-timeline-item>
            </t-timeline>
          </div>
        </div>
      </t-loading>
    </t-drawer>
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

.repo-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}
.repo-card {
  padding: 20px;
  position: relative;
  overflow: hidden;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}
.repo-card:hover {
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
.repo-card:hover .card-glow {
  transform: scale(1.15);
  opacity: 0.9;
}

.repo-head {
  margin-bottom: 12px;
  position: relative;
  z-index: 1;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}
.repo-head-left {
  display: flex;
  align-items: center;
  gap: 12px;
}
.repo-avatar {
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
.repo-head-text h3 {
  margin: 0 0 4px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.repo-id-tag {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  background: var(--surface-2);
  color: var(--text-muted);
  font-size: 11px;
  font-weight: 500;
  border: 1px solid var(--border-subtle);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
}
.repo-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  position: relative;
  z-index: 1;
}

.repo-meta {
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
  min-width: 70px;
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

/* 历史 Drawer 样式 */
.repo-info-desc {
  margin-bottom: 20px;
}
.history-timeline {
  padding: 4px 0;
}
.commit-header {
  display: flex;
  align-items: center;
  gap: 8px;
}
.commit-sha {
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 2px 8px;
  border-radius: 4px;
  border: 1px solid rgba(79, 70, 229, 0.18);
}
.commit-latest {
  font-size: 10px;
  font-weight: 700;
  color: var(--success);
  background: var(--success-soft);
  padding: 1px 6px;
  border-radius: 3px;
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.commit-body {
  margin-top: 6px;
}
.commit-message {
  font-size: 13px;
  color: var(--text);
  line-height: 1.5;
  margin-bottom: 8px;
  white-space: pre-wrap;
}
.commit-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}

/* 响应式 */
@media (max-width: 720px) {
  .chronos-page-banner { padding: 18px 16px; }
  .chronos-page-title { font-size: 20px; }
  .banner-actions { width: 100%; }
  .banner-actions .mode-pill { flex: 1; justify-content: center; }
  .repo-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .chronos-page-banner { padding: 16px 14px; }
  .chronos-page-title { font-size: 18px; }
  .chronos-page-sub { font-size: 12.5px; }
  .repo-card { padding: 16px; }
  .action-btn { flex: 1 1 calc(50% - 4px); }
}
</style>
