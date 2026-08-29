<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { h } from 'vue'
import {
  NButton,
  NSpace,
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
  NDrawer,
  NDrawerContent,
  NPopconfirm,
  NTimeline,
  NTimelineItem,
  NDescriptions,
  NDescriptionsItem,
  NScrollbar,
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
  GitBranchOutline,
  TimeOutline,
  DownloadOutline,
  ArrowUndoOutline,
  DocumentTextOutline,
  ArchiveOutline,
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

function onFileChange(data: { fileList: UploadFileInfo[] }) {
  const f = data.fileList[0]
  modalFile.value = f?.file ?? null
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
  if (!historyRepo.value?.id) return
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
            <NIcon size="12"><ServerOutline /></NIcon>
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
            <NIcon size="12">
              <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
            </NIcon>
            {{ auth.cloudSyncEnabled ? '云端同步已开启' : '本地模式' }}
          </span>
          <NButton type="primary" size="medium" @click="openCreate" class="chronos-btn-banner">
            <template #icon><NIcon size="16"><AddOutline /></NIcon></template>
            创建仓库
          </NButton>
        </div>
      </div>
    </div>

    <!-- 仓库列表 -->
    <NSpin :show="loading">
      <NEmpty
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
                <NIcon size="20"><GitBranchOutline /></NIcon>
                <div class="avatar-ring"></div>
              </div>
              <div class="repo-head-text">
                <h3>{{ r.name }}</h3>
                <span class="repo-id-tag">
                  <NIcon size="10" style="margin-right: 2px;"><HardwareChipOutline /></NIcon>
                  {{ r.defaultBranch || 'main' }}
                </span>
              </div>
            </div>
            <NTag v-if="r.commitCount" size="small" round type="info">
              <template #icon><NIcon size="12"><GitBranchOutline /></NIcon></template>
              {{ r.commitCount }} 次提交
            </NTag>
          </div>

          <p v-if="r.description" class="repo-desc">{{ r.description }}</p>

          <div class="repo-meta">
            <div class="meta-row">
              <NIcon size="14" style="color: var(--primary);"><ChatbubbleEllipsesOutline /></NIcon>
              <NText depth="3" class="meta-text">{{ r.conversationCount ?? 0 }} 个对话</NText>
            </div>
            <div v-if="r.lastCommitSha" class="meta-row">
              <NIcon size="14" style="color: var(--accent);"><GitBranchOutline /></NIcon>
              <NText depth="3" class="meta-text">最新提交：{{ r.lastCommitSha.slice(0, 7) }}</NText>
            </div>
            <div class="meta-row">
              <NIcon size="14" style="color: var(--warning);"><CalendarOutline /></NIcon>
              <NText depth="3" class="meta-text">最近更新：{{ fmtDate(r.updatedAt) }}</NText>
            </div>
          </div>

          <div class="card-actions">
            <NButton size="small" @click="viewConversations" class="action-btn">
              <template #icon><NIcon size="14"><EyeOutline /></NIcon></template>
              查看
            </NButton>
            <NButton size="small" type="info" ghost @click="openHistory(r)" class="action-btn" :disabled="!r.id">
              <template #icon><NIcon size="14"><TimeOutline /></NIcon></template>
              历史
            </NButton>
            <NButton size="small" type="primary" ghost @click="openUpdate(r)" class="action-btn">
              <template #icon><NIcon size="14"><RefreshOutline /></NIcon></template>
              更新
            </NButton>
            <NPopconfirm @positive-click="removeRepo(r)">
              <template #trigger>
                <NButton size="small" type="error" ghost class="action-btn">
                  <template #icon><NIcon size="14"><TrashOutline /></NIcon></template>
                  删除
                </NButton>
              </template>
              确定删除仓库「{{ r.name }}」？所有对话数据和 Git 历史将被清除。
            </NPopconfirm>
          </div>
        </div>
      </div>
    </NSpin>

    <!-- 创建/更新仓库模态框 -->
    <NModal
      v-model:show="modalVisible"
      preset="card"
      :title="modalMode === 'create' ? '创建聊天仓库' : '更新仓库数据'"
      class="chronos-modal"
      style="width: 500px; max-width: 92vw;"
      :bordered="false"
    >
      <NForm label-placement="top">
        <NFormItem label="仓库名称" v-if="modalMode === 'create'">
          <NInput v-model:value="modalName" placeholder="例如：工作主仓库、个人对话" />
        </NFormItem>
        <NFormItem v-else label="仓库名称">
          <NInput :value="modalName" disabled />
        </NFormItem>
        <NFormItem label="描述（可选）" v-if="modalMode === 'create'">
          <NInput
            v-model:value="modalDescription"
            type="textarea"
            placeholder="简要描述这个仓库的用途"
            :autosize="{ minRows: 2, maxRows: 4 }"
          />
        </NFormItem>
        <NFormItem :label="modalMode === 'create' ? '数据包（可选，zip 压缩包）' : '数据包（zip 压缩包）'">
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
              <NIcon size="14" style="margin-right: 4px;"><ArchiveOutline /></NIcon>
              {{ modalFile.name }}
            </span>
          </div>
          <NText depth="3" style="font-size: 12px; margin-top: 6px; display: block;">
            支持 DeepSeek 和 ChatGPT 导出的 zip 包（仅需 conversations.json）
          </NText>
        </NFormItem>
      </NForm>
      <template #footer>
        <NSpace justify="end">
          <NButton @click="modalVisible = false">取消</NButton>
          <NButton type="primary" :loading="submitting" @click="submitModal">
            <template #icon v-if="!submitting"><NIcon size="14"><RocketOutline /></NIcon></template>
            {{ modalMode === 'create' ? '创建' : '更新' }}
          </NButton>
        </NSpace>
      </template>
    </NModal>

    <!-- 版本历史 Drawer -->
    <NDrawer
      v-model:show="historyDrawerVisible"
      :width="520"
      placement="right"
    >
      <NDrawerContent
        :title="`版本历史 · ${historyRepo?.name ?? ''}`"
        closable
      >
        <NSpin :show="historyLoading">
          <div v-if="!historyLoading && historyCommits.length === 0" style="padding: 40px 0;">
            <NEmpty description="暂无提交历史" />
          </div>
          <div v-else style="padding: 4px 0;">
            <!-- 仓库概览 -->
            <NDescriptions v-if="historyRepo" label-placement="left" :column="1" size="small" bordered class="repo-info-desc">
              <NDescriptionsItem label="仓库">{{ historyRepo.name }}</NDescriptionsItem>
              <NDescriptionsItem label="分支">{{ historyRepo.defaultBranch || 'main' }}</NDescriptionsItem>
              <NDescriptionsItem label="提交数">{{ historyCommits.length }}</NDescriptionsItem>
              <NDescriptionsItem label="快照大小">{{ fmtBytes(historySnapshotBytes) }}</NDescriptionsItem>
            </NDescriptions>

            <!-- 提交时间线 -->
            <div class="history-timeline">
              <NTimeline>
                <NTimelineItem
                  v-for="(commit, idx) in historyCommits"
                  :key="commit.sha"
                  :type="idx === 0 ? 'success' : 'default'"
                  :time="fmtDate(commit.date)"
                >
                  <template #header>
                    <div class="commit-header">
                      <span class="commit-sha">{{ commit.shortSha }}</span>
                      <span v-if="idx === 0" class="commit-latest">最新</span>
                    </div>
                  </template>
                  <div class="commit-body">
                    <div class="commit-message">{{ commit.message }}</div>
                    <div class="commit-actions">
                      <NButton size="tiny" quaternary @click="downloadSnapshot(commit.sha)">
                        <template #icon><NIcon size="12"><DownloadOutline /></NIcon></template>
                        下载
                      </NButton>
                      <NPopconfirm
                        v-if="idx !== 0"
                        @positive-click="rollbackTo(commit.sha)"
                        :disabled="rollbackLoading"
                      >
                        <template #trigger>
                          <NButton size="tiny" quaternary type="warning" :loading="rollbackLoading">
                            <template #icon><NIcon size="12"><ArrowUndoOutline /></NIcon></template>
                            回滚
                          </NButton>
                        </template>
                        确定回滚到 {{ commit.shortSha }}？这将追加一条回滚提交，不会丢失当前历史。
                      </NPopconfirm>
                      <NText v-else depth="3" style="font-size: 11px;">（当前版本）</NText>
                    </div>
                  </div>
                </NTimelineItem>
              </NTimeline>
            </div>
          </div>
        </NSpin>
      </NDrawerContent>
    </NDrawer>
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
