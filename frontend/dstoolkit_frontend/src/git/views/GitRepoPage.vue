<script setup lang="ts">
/**
 * GitRepoPage —— 主仓库页（集成所有Tab）
 * 路由参数: :repoId (number)
 * Tab: code, commits, branches, tags, compare, prs, reflog, insights
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import RepoHeaderBar from '../components/RepoHeaderBar.vue'
import BranchSelector from '../components/BranchSelector.vue'
import FileTreeViewer, { type TreeFile } from '../components/FileTreeViewer.vue'
import CommitGraph from '../components/CommitGraph.vue'
import DiffFileViewer from '../components/DiffFileViewer.vue'
import PullRequestCard from '../components/PullRequestCard.vue'
import PRCommentThread from '../components/PRCommentThread.vue'
import {
  getRepo, listBranches, listTags, createBranch,
  listCommits, getCommitDetail,
  readRepoTree, compareRefs,
  mergeBranches, cherryPickCommit, revertCommit, resetBranch,
  getReflog, stash, stashPop,
  listPRs, createPR, getPR, updatePR, closePR, reopenPR, mergePR,
  listPRComments, addPRComment, resolvePRComment, listPRActivities, submitPRReview,
} from '../api/gitClient'
import type * as T from '../types/types'
import type * as API from '../types/apiContract'
import { shortSha } from '../types/hash'

const route = useRoute()
const router = useRouter()

const repoId = computed(() => Number(route.params.repoId))
const tab = ref<TabKey>((route.query.tab as TabKey) ?? 'code')
type TabKey = 'code' | 'commits' | 'branches' | 'tags' | 'compare' | 'prs' | 'insights' | 'reflog'
watch(tab, v => router.replace({ query: { ...route.query, tab: v } }))

// ===== 基础信息 =====
const repo = ref<T.GitRepoEntity | null>(null)
const branches = ref<T.GitBranchEntity[]>([])
const tags = ref<T.GitTagEntity[]>([])
const loading = ref(false)

async function reloadBasics() {
  loading.value = true
  try {
    const [repoR, brR, tgR] = await Promise.all([
      getRepo(repoId.value),
      listBranches(repoId.value),
      listTags(repoId.value),
    ])
    repo.value = repoR.data.repo
    branches.value = brR.data.branches
    tags.value = tgR.data.tags
    // 选择默认分支
    if (!currentRef.value && branches.value.length) {
      const def = branches.value.find(b => b.isDefault) ?? branches.value[0]
      currentRef.value = def.name
    }
  } finally { loading.value = false }
}

// ===== Code Tab =====
const currentRef = ref<string>('')
const currentPath = ref<string>('')
const treeFiles = ref<TreeFile[]>([])
const fileContent = ref<{ path: string; content: string; mime: string; size: number } | null>(null)
const loadingTree = ref(false)
const viewMode = ref<'split' | 'unified'>('split')

async function loadTree() {
  if (!repo.value) return
  loadingTree.value = true
  try {
    const r = await readRepoTree(repoId.value, currentRef.value, currentPath.value)
    const d = r.data
    if ('files' in d) {
      treeFiles.value = d.files.map(f => ({
        path: f.path,
        mode: f.mode,
        blobId: f.blobId,
        sha: f.sha,
        sizeBytes: f.sizeBytes,
        mimeType: f.mimeType,
        messageId: f.messageId ?? undefined,
      }))
      fileContent.value = null
    } else if ('content' in d) {
      fileContent.value = {
        path: d.path,
        content: d.content,
        mime: d.mimeType,
        size: d.sizeBytes,
      }
      // 父目录文件树
      const p = d.path.lastIndexOf('/')
      const dir = p > 0 ? d.path.slice(0, p) : ''
      if (dir !== currentPath.value) {
        const t = await readRepoTree(repoId.value, currentRef.value, dir || undefined)
        if ('files' in t.data) {
          treeFiles.value = t.data.files.map(f => ({
            path: f.path, blobId: f.blobId, sha: f.sha,
            sizeBytes: f.sizeBytes, mimeType: f.mimeType,
          }))
        }
      }
    }
  } finally { loadingTree.value = false }
}

function onFileClick(path: string) {
  currentPath.value = path
  loadTree()
}

function backToDirOf(p: string) {
  const i = p.lastIndexOf('/')
  currentPath.value = i > 0 ? p.slice(0, i) : ''
  fileContent.value = null
  loadTree()
}

// ===== Commits Tab =====
const commits = ref<any[]>([])
const commitLimit = ref(50)
const selectedCommitSha = ref<string | null>(null)
const selectedCommitDetail = ref<API.GetCommitDetailResponse | null>(null)
const loadingCommits = ref(false)

async function loadCommits() {
  loadingCommits.value = true
  try {
    const r = await listCommits(repoId.value, {
      branchName: currentRef.value || undefined,
      limit: commitLimit.value,
    })
    commits.value = r.data.commits
    if (selectedCommitSha.value) loadCommitDetail(selectedCommitSha.value)
  } finally { loadingCommits.value = false }
}

async function loadCommitDetail(sha: string) {
  selectedCommitSha.value = sha
  try {
    const r = await getCommitDetail(repoId.value, sha)
    selectedCommitDetail.value = r.data
  } catch { selectedCommitDetail.value = null }
}

// ===== Branches Tab =====
function onCreateBranch(name: string, base: string) {
  createBranch(repoId.value, { name, fromBranchName: base })
    .then(() => { reloadBasics(); loadCommits() })
}
function onDeleteBranch(b: T.GitBranchEntity) {
  if (!confirm(`确认删除分支 ${b.name}？此操作不可恢复。`)) return
  deleteBranchSafe(b)
}
async function deleteBranchSafe(b: T.GitBranchEntity) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = await import('../api/gitClient').then(() => listBranches) // noop
  // 使用 import 上面已 import 的函数：直接引用即可
  ;(window as any).__noop__ = 0
}
// re-export deleteBranch (we already imported via listBranches above but import was without deleteBranch)
import { deleteBranch } from '../api/gitClient'
async function doDeleteBranch(b: T.GitBranchEntity) {
  await deleteBranch(repoId.value, b.name, b.isDefault ? false : true)
  await reloadBasics()
  if (currentRef.value === b.name) {
    const def = branches.value.find(x => x.isDefault) ?? branches.value[0]
    currentRef.value = def?.name ?? ''
  }
}

// ===== Compare =====
const compareBase = ref('')
const compareHead = ref('')
const compareResult = ref<API.CompareResponse | null>(null)

watch([compareBase, compareHead], async () => {
  if (!compareBase.value || !compareHead.value) { compareResult.value = null; return }
  try {
    const r = await compareRefs(repoId.value, compareBase.value, compareHead.value)
    compareResult.value = r.data
  } catch { compareResult.value = null }
})
watch(currentRef, v => { if (!compareBase.value) compareBase.value = v })

// ===== Merge actions (cherry-pick/revert/reset/stash) =====
const resetMode = ref<'HARD' | 'SOFT' | 'MIXED'>('MIXED')
const resetTargetSha = ref('')
async function doReset() {
  if (!confirm(`执行 git reset --${resetMode.value.toLowerCase()} ${shortSha(resetTargetSha.value, 7)}？`)) return
  await resetBranch(repoId.value, { branchName: currentRef.value, targetSha: resetTargetSha.value, mode: resetMode.value })
  await Promise.all([loadCommits(), loadTree()])
  flashMsg('重置完成')
}

async function doCherryPick(sha: string) {
  const r = await cherryPickCommit(repoId.value, { sha, ontoBranchName: currentRef.value })
  flashMsg(r.data.message)
  await Promise.all([loadCommits(), loadTree()])
}
async function doRevert(sha: string) {
  const r = await revertCommit(repoId.value, { sha, ontoBranchName: currentRef.value })
  flashMsg(r.data.message)
  await Promise.all([loadCommits(), loadTree()])
}

async function doMerge(strategy: T.MergeStrategy) {
  if (!compareBase.value || !compareHead.value) return
  const r = await mergeBranches(repoId.value, {
    baseBranchName: compareBase.value, headBranchName: compareHead.value,
    strategy, message: `Merge ${compareHead.value} into ${compareBase.value}`,
    authorUserId: (repo.value?.ownerId) ?? undefined,
  })
  flashMsg(r.data.message)
  if (r.data.status === 'MERGED' || r.data.status === 'FAST_FORWARD') {
    await Promise.all([loadCommits(), loadTree(), reloadBasics()])
  }
}

// ===== Reflog =====
const reflog = ref<T.ReflogEntryEntity[]>([])
const loadingReflog = ref(false)
async function loadReflog() {
  loadingReflog.value = true
  try {
    const r = await getReflog(repoId.value, undefined, 200)
    reflog.value = r.data.entries
  } finally { loadingReflog.value = false }
}
function checkoutViaReflog(entry: T.ReflogEntryEntity) {
  // 简化：用 reset --hard 回到 entry.newCommitSha
  if (!confirm(`将 ${entry.branchName} 重置到 ${entry.newCommitSha?.slice(0, 7)}？（HARD reset）`)) return
  resetTargetSha.value = entry.newCommitSha!
  currentRef.value = entry.branchName
  resetMode.value = 'HARD'
  doReset()
}

const stashMessage = ref('')
async function doStash() {
  await stash(repoId.value, {
    branchName: currentRef.value,
    message: stashMessage.value || undefined,
  })
  flashMsg('已 stash')
  await loadReflog()
}
async function doStashPop() {
  await stashPop(repoId.value).then(r => flashMsg(r.data.message || 'Stash pop 成功'))
  await loadReflog()
}

// ===== PRs =====
const prStatus = ref<T.PullRequestStatus | 'all'>('all')
const prList = ref<T.PullRequestEntity[]>([])
const loadingPR = ref(false)
async function loadPRs() {
  loadingPR.value = true
  try {
    const r = await listPRs(repoId.value, {
      status: prStatus.value === 'all' ? undefined : prStatus.value,
      limit: 100, sort: 'updated',
    })
    prList.value = r.data.items
  } finally { loadingPR.value = false }
}

const creatingPR = ref(false)
const newPR = ref({ headBranchName: '', baseBranchName: '', title: '', description: '' })
async function openCreatePR() {
  newPR.value = {
    headBranchName: compareHead.value || currentRef.value,
    baseBranchName: compareBase.value || branches.value.find(b => b.isDefault)?.name || '',
    title: '',
    description: '',
  }
  creatingPR.value = true
}
async function submitNewPR() {
  if (!newPR.value.title || !newPR.value.headBranchName || !newPR.value.baseBranchName) return
  await createPR(repoId.value, newPR.value as any)
  creatingPR.value = false
  flashMsg('PR 已创建')
  await loadPRs()
}

const openPR = ref<T.PullRequestEntity | null>(null)
const openPRComments = ref<T.PRCommentEntity[]>([])
const openPRActivities = ref<T.PRActivityEntity[]>([])
const openPRDiff = ref<API.CompareResponse | null>(null)
async function openPRDetail(pr: T.PullRequestEntity) {
  openPR.value = pr
  const [cR, aR] = await Promise.all([
    listPRComments(repoId.value, pr.number),
    listPRActivities(repoId.value, pr.number),
  ])
  openPRComments.value = cR.data.items
  openPRActivities.value = aR.data.items
  // diff
  try {
    const dr = await compareRefs(repoId.value, pr.baseBranchName, pr.headBranchName)
    openPRDiff.value = dr.data
  } catch { openPRDiff.value = null }
}
async function submitComment(body: string, replyToId?: number, filePath?: string, lineNumber?: number, side?: 'LEFT' | 'RIGHT') {
  if (!openPR.value) return
  const r = await addPRComment(repoId.value, openPR.value.number, {
    body, replyToId, filePath, lineNumber, side,
  })
  openPRComments.value = [...openPRComments.value, r.data.comment]
}
async function resolveComment(id: number) {
  await resolvePRComment(repoId.value, openPR.value!.number, id)
  // refresh
  const r = await listPRComments(repoId.value, openPR.value!.number)
  openPRComments.value = r.data.items
}

async function mergeThisPR() {
  if (!openPR.value) return
  const r = await mergePR(repoId.value, openPR.value.number, { mergeStrategy: 'THREE_WAY' })
  flashMsg(r.data.message)
  await reloadBasics()
  await loadPRs()
  openPR.value = null
}
async function closeThisPR() {
  if (!openPR.value) return
  await closePR(repoId.value, openPR.value.number)
  await loadPRs()
  openPRDetail({ ...openPR.value, status: 'CLOSED' })
}

// ===== Utils =====
const flash = ref<{ msg: string; ts: number } | null>(null)
function flashMsg(msg: string) { flash.value = { msg, ts: Date.now() } }

watch([repoId, currentRef, tab], () => {
  if (tab.value === 'code') loadTree()
  else if (tab.value === 'commits') loadCommits()
  else if (tab.value === 'prs') loadPRs()
  else if (tab.value === 'reflog') loadReflog()
}, { immediate: false })

onMounted(async () => {
  await reloadBasics()
  if (tab.value === 'code') await loadTree()
  if (tab.value === 'commits') await loadCommits()
  if (tab.value === 'prs') await loadPRs()
  if (tab.value === 'reflog') await loadReflog()
})

const defaultBranchName = computed(() => branches.value.find(b => b.isDefault)?.name ?? '')

function onCommitLineClick(c: any) {
  loadCommitDetail(c.sha256)
}

function onLineClickDiff(side: 'LEFT' | 'RIGHT', lineNo: number, path: string) {
  if (openPR.value) {
    // 给 PR 评论加上"当前正在查看的行"上下文
    pendingCommentLine.value = { side, lineNo, path }
  }
}
const pendingCommentLine = ref<{ side: 'LEFT' | 'RIGHT'; lineNo: number; path: string } | null>(null)

// merge strategy UI
const mergeStrategy = ref<T.MergeStrategy>('THREE_WAY')

// Insights Tab
const contributors = computed(() => {
  // 统计 commits 中每位作者提交数
  const map = new Map<string, { name: string; count: number; additions: number; deletions: number; lastAt: string }>()
  for (const c of commits.value) {
    const n = c.authorName
    if (!map.has(n)) map.set(n, { name: n, count: 0, additions: 0, deletions: 0, lastAt: c.committedAt })
    const x = map.get(n)!
    x.count++
    x.additions += c.additions
    x.deletions += c.deletions
    if (c.committedAt > x.lastAt) x.lastAt = c.committedAt
  }
  return [...map.values()].sort((a, b) => b.count - a.count)
})

function prTotalDiff() {
  if (!openPRDiff.value) return { additions: 0, deletions: 0, files: 0 }
  return openPRDiff.value.files.reduce(
    (acc, f) => ({
      additions: acc.additions + f.additions,
      deletions: acc.deletions + f.deletions,
      files: acc.files + 1,
    }),
    { additions: 0, deletions: 0, files: 0 },
  )
}
</script>

<template>
  <div class="repo-page">
    <div v-if="flash" class="repo-flash neu-card">{{ flash.msg }}</div>
    <div v-if="loading && !repo" class="repo-loading">加载中...</div>
    <template v-else-if="repo">
      <RepoHeaderBar
        :repo="repo"
        :branches="branches"
        :tags="tags"
        :tab="tab"
        @update:tab="tab = $event"
      />

      <!-- ============= CODE TAB ============= -->
      <div v-if="tab === 'code'" class="tab-section">
        <div class="tool-row">
          <BranchSelector
            v-model="currentRef"
            :branches="branches"
            :tags="tags"
            allow-create
            :default-branch-name="defaultBranchName"
            @create-branch="onCreateBranch"
          />
          <div class="tool-actions">
            <button class="btn" @click="loadTree">🔄 刷新</button>
            <button class="btn" @click="tab = 'compare'">🆚 比较</button>
            <button class="btn" @click="openCreatePR">+ 新建 PR</button>
          </div>
        </div>
        <div class="breadcrumb" v-if="currentPath">
          <span class="crumb" @click="currentPath=''; fileContent=null; loadTree()">📁 根</span>
          <template v-for="(part, idx) in currentPath.split('/')" :key="idx">
            <span class="crumb-sep">/</span>
            <span
              class="crumb"
              @click="() => { const parts = currentPath.split('/').slice(0, idx+1).join('/'); if (idx === currentPath.split('/').length-1) { backToDirOf(currentPath) } else { currentPath = parts; loadTree(); } }"
            >{{ part }}</span>
          </template>
        </div>
        <div class="two-col">
          <div class="col-left">
            <div v-if="loadingTree" class="mini-loading">加载中...</div>
            <FileTreeViewer
              v-else
              :files="treeFiles"
              empty-text="空仓库，首次对话后会生成初始快照"
              @file-click="onFileClick"
            />
          </div>
          <div class="col-right neu-card" style="padding: 12px 14px;">
            <div v-if="fileContent">
              <div class="file-head">
                <div class="file-head-l">
                  <span class="file-path">{{ fileContent.path }}</span>
                  <span class="file-meta">{{ fileContent.mime }} · {{ (fileContent.size/1024).toFixed(1) }}KB</span>
                </div>
                <button class="btn btn-sm" @click="backToDirOf(fileContent.path)">← 返回</button>
              </div>
              <pre class="file-content">{{ fileContent.content }}</pre>
            </div>
            <div v-else class="empty-file">
              <div style="font-size: 36px;">🗂️</div>
              <div style="margin-top: 10px; color: var(--text-muted);">选择左侧文件查看内容 · 当前 ref: <code>{{ currentRef }}</code></div>
            </div>
          </div>
        </div>

        <!-- 快速操作：Reset / Cherry-pick / Revert -->
        <div class="quick-ops neu-card" style="padding: 14px;">
          <div class="qo-title">⚡ 快速操作（版本控制）</div>
          <div class="qo-row">
            <div class="qo-block">
              <label>Reset 目标 SHA</label>
              <input v-model="resetTargetSha" placeholder="commit sha 或 短SHA" class="qo-input" />
              <label>Reset 模式</label>
              <select v-model="resetMode" class="qo-input">
                <option value="MIXED">MIXED（保留变更到工作区）</option>
                <option value="SOFT">SOFT（仅移动HEAD到暂存区）</option>
                <option value="HARD">HARD（彻底丢弃，危险）</option>
              </select>
              <button class="btn btn-danger" :disabled="!resetTargetSha" @click="doReset">执行 Reset</button>
            </div>
            <div class="qo-block">
              <label>Stash 备注（可选）</label>
              <input v-model="stashMessage" placeholder="save WIP..." class="qo-input" />
              <div style="display: flex; gap: 8px;">
                <button class="btn" @click="doStash">📦 Stash</button>
                <button class="btn" @click="doStashPop">📤 Stash Pop</button>
              </div>
            </div>
            <div class="qo-block">
              <label>提示</label>
              <div class="qo-tip">
                · 对话的每次消息自动生成 commit<br>
                · 可以在这里手动管理分支、回滚到历史状态<br>
                · 在 Compare / PR Tab 可以跨分支进行讨论与合并
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ============= COMMITS TAB ============= -->
      <div v-else-if="tab === 'commits'" class="tab-section">
        <div class="tool-row">
          <BranchSelector v-model="currentRef" :branches="branches" :tags="tags" />
          <div class="tool-actions">
            <select v-model="commitLimit" class="qo-input" style="width: auto;">
              <option :value="20">20 commits</option>
              <option :value="50">50 commits</option>
              <option :value="100">100 commits</option>
              <option :value="200">200 commits</option>
            </select>
            <button class="btn" @click="loadCommits">🔄 刷新</button>
          </div>
        </div>
        <div v-if="loadingCommits" class="mini-loading">加载中...</div>
        <CommitGraph
          v-else
          :commits="commits as any"
          :selected-id="selectedCommitDetail?.commit?.id ?? null"
          @commit-click="onCommitLineClick"
        />
        <div v-if="selectedCommitDetail" class="commit-detail neu-card" style="margin-top: 14px; padding: 14px;">
          <div class="cd-head">
            <div>
              <div class="cd-subject">{{ selectedCommitDetail.commit.subject }}</div>
              <div class="cd-meta">
                <span class="cd-sha">{{ shortSha(selectedCommitDetail.commit.sha256, 8) }}</span>
                · <span>{{ selectedCommitDetail.commit.authorName }}</span>
                · <span>{{ new Date(selectedCommitDetail.commit.committedAt).toLocaleString() }}</span>
              </div>
              <div class="cd-meta" v-if="selectedCommitDetail.commit.body" style="margin-top: 8px; white-space: pre-wrap;">
                {{ selectedCommitDetail.commit.body }}
              </div>
            </div>
            <div class="cd-actions">
              <button class="btn btn-sm" @click="doCherryPick(selectedCommitDetail.commit.sha256)">🍒 拣选到 {{ currentRef }}</button>
              <button class="btn btn-sm btn-danger" @click="doRevert(selectedCommitDetail.commit.sha256)">↩️ 在 {{ currentRef }} 回滚</button>
              <button
                class="btn btn-sm"
                @click="resetTargetSha = selectedCommitDetail!.commit.sha256; tab = 'code'; flashMsg('已填入 Reset Sha，切换到 Code Tab → 快速操作执行')"
              >🎯 设为 Reset 目标</button>
            </div>
          </div>
          <div class="cd-stats">
            <span>📁 {{ selectedCommitDetail.diff.files.length }} 个文件变更</span>
            <span style="color: var(--success)">+{{ selectedCommitDetail.diff.additions }}</span>
            <span style="color: var(--danger)">-{{ selectedCommitDetail.diff.deletions }}</span>
          </div>
          <div class="diff-view-mode">
            <span :class="{ active: viewMode === 'split' }" @click="viewMode = 'split'">Split</span>
            <span :class="{ active: viewMode === 'unified' }" @click="viewMode = 'unified'">Unified</span>
          </div>
          <DiffFileViewer
            v-for="f in selectedCommitDetail.diff.files"
            :key="f.oldPath + f.newPath"
            :file="f"
            :view-mode="viewMode"
          />
        </div>
      </div>

      <!-- ============= BRANCHES TAB ============= -->
      <div v-else-if="tab === 'branches'" class="tab-section neu-card" style="padding: 16px;">
        <div class="tbl-head">
          <h3>🌿 分支列表（{{ branches.length }}）</h3>
          <button class="btn btn-primary" @click="creatingBranch = true">+ 新建分支</button>
          <div v-if="creatingBranch" class="create-branch-bar">
            <input v-model="newBranchName" placeholder="feature/xxx" />
            <label>起点:</label>
            <select v-model="baseBranchName">
              <option v-for="b in branches" :key="b.id" :value="b.name">{{ b.name }}</option>
            </select>
            <button class="btn btn-primary" @click="onCreateBranch(newBranchName, baseBranchName); creatingBranch=false; newBranchName='';">创建</button>
            <button class="btn" @click="creatingBranch=false">取消</button>
          </div>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>分支名</th>
              <th>默认</th>
              <th>保护</th>
              <th>Head commit</th>
              <th>提交数</th>
              <th>最近更新</th>
              <th style="text-align: right;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="b in branches" :key="b.id">
              <td class="tbl-b-name">🌿 <code>{{ b.name }}</code></td>
              <td>
                <span v-if="b.isDefault" class="badge default">默认</span>
              </td>
              <td>
                <span v-if="b.protectionLevel === 'NONE'" class="badge">无</span>
                <span v-else-if="b.protectionLevel === 'PROTECTED'" class="badge warn">受保护</span>
                <span v-else class="badge danger">锁定</span>
              </td>
              <td class="tbl-monospace">{{ b.headCommitSha?.slice(0, 8) }}</td>
              <td>{{ b.commitCount }}</td>
              <td>{{ new Date(b.updatedAt).toLocaleString() }}</td>
              <td style="text-align: right;">
                <button class="btn btn-sm" @click="currentRef = b.name; tab = 'code'">进入</button>
                <button class="btn btn-sm danger" :disabled="b.isDefault" @click="doDeleteBranch(b)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ============= TAGS TAB ============= -->
      <div v-else-if="tab === 'tags'" class="tab-section neu-card" style="padding: 16px;">
        <div class="tbl-head">
          <h3>🏷️ 标签列表（{{ tags.length }}）</h3>
          <button class="btn btn-primary" @click="creatingTag = true">+ 新建标签</button>
          <div v-if="creatingTag" class="create-branch-bar">
            <input v-model="newTag.name" placeholder="v1.0.0" />
            <label>目标 commit SHA:</label>
            <input v-model="newTag.targetSha" :placeholder="defaultBranchName + ' head'" />
            <input v-model="newTag.title" placeholder="可选标题" />
            <button class="btn btn-primary" @click="doCreateTag">创建</button>
            <button class="btn" @click="creatingTag=false">取消</button>
          </div>
        </div>
        <table class="tbl">
          <thead>
            <tr>
              <th>标签名</th>
              <th>目标 commit</th>
              <th>标题/备注</th>
              <th>创建人</th>
              <th>创建时间</th>
              <th style="text-align: right;">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="t in tags" :key="t.id">
              <td class="tbl-b-name">🏷️ <code>{{ t.name }}</code></td>
              <td class="tbl-monospace">{{ t.targetCommitSha.slice(0, 8) }}</td>
              <td>{{ t.title }}</td>
              <td>{{ t.creatorName }}</td>
              <td>{{ new Date(t.createdAt).toLocaleString() }}</td>
              <td style="text-align: right;">
                <button class="btn btn-sm danger" @click="doDeleteTag(t)">删除</button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- ============= COMPARE TAB ============= -->
      <div v-else-if="tab === 'compare'" class="tab-section">
        <div class="compare-tool neu-card" style="padding: 14px 16px;">
          <div class="compare-headers">
            <span class="cmp-label">Base:</span>
            <BranchSelector
              v-model="compareBase"
              :branches="branches"
              :tags="tags"
              placeholder="选择基础分支/标签"
            />
            <span class="cmp-arrow">← 对比 ←</span>
            <span class="cmp-label">Head:</span>
            <BranchSelector
              v-model="compareHead"
              :branches="branches"
              :tags="tags"
              placeholder="选择要对比的分支/标签"
            />
          </div>
          <div class="compare-actions" v-if="compareResult">
            <div class="cmp-summary">
              <span>📁 {{ compareResult.files.length }} 个文件变更</span>
              <span style="color: var(--success)">+{{ compareResult.additions }}</span>
              <span style="color: var(--danger)">-{{ compareResult.deletions }}</span>
              <span>📦 {{ compareResult.commitsBehind }} 落后 / {{ compareResult.commitsAhead }} 领先</span>
            </div>
            <div class="cmp-btn-row">
              <label>合并策略:</label>
              <select v-model="mergeStrategy" style="padding: 4px 8px;">
                <option value="FAST_FORWARD_ONLY">仅快进 FF only</option>
                <option value="THREE_WAY">三方合并 THREE_WAY</option>
                <option value="SQUASH">压缩 SQUASH</option>
                <option value="REBASE">变基 REBASE</option>
                <option value="OURS">OURS</option>
                <option value="THEIRS">THEIRS</option>
              </select>
              <button class="btn btn-primary" :disabled="!compareResult.mergeable" @click="doMerge(mergeStrategy)">
                合并 {{ compareHead }} → {{ compareBase }}
              </button>
              <button class="btn" @click="openCreatePR()">→ 发起 PR</button>
            </div>
            <div v-if="!compareResult.mergeable && compareResult.conflictFiles.length" class="cmp-conflicts">
              ⚠️ 存在冲突文件（{{ compareResult.conflictFiles.length }}）：
              <ul>
                <li v-for="f in compareResult.conflictFiles" :key="f">{{ f }}</li>
              </ul>
              <span class="cmp-hint">请先在本地解决冲突或使用 OURS/THEIRS 策略</span>
            </div>
          </div>
        </div>
        <div v-if="compareResult">
          <div class="diff-view-mode">
            <span :class="{ active: viewMode === 'split' }" @click="viewMode = 'split'">Split</span>
            <span :class="{ active: viewMode === 'unified' }" @click="viewMode = 'unified'">Unified</span>
          </div>
          <DiffFileViewer
            v-for="f in compareResult.files"
            :key="f.oldPath + f.newPath"
            :file="f"
            :view-mode="viewMode"
          />
        </div>
        <div v-else class="mini-loading">请选择 Base 和 Head 以对比</div>
      </div>

      <!-- ============= PRs TAB ============= -->
      <div v-else-if="tab === 'prs'" class="tab-section">
        <div class="pr-toolbar neu-card" style="padding: 12px 14px;">
          <div class="pr-status-filter">
            <span
              v-for="s in ['all', 'OPEN', 'REVIEW', 'APPROVED', 'CHANGES_REQUESTED', 'MERGED', 'CLOSED', 'DRAFT'] as const"
              :key="s"
              class="pr-status-chip"
              :class="{ active: prStatus === s }"
              @click="prStatus = s; loadPRs()"
            >
              {{ {
                all: '全部', OPEN: '🟢 待审', REVIEW: '🔍 审核中',
                APPROVED: '✅ 已批准', CHANGES_REQUESTED: '🟡 待改',
                MERGED: '🟣 已合并', CLOSED: '⚫ 已关闭', DRAFT: '📝 草稿',
              }[s] }}
            </span>
          </div>
          <button class="btn btn-primary" @click="openCreatePR">+ 新建合并请求</button>
        </div>
        <div v-if="loadingPR" class="mini-loading">加载中...</div>
        <div v-else class="pr-list">
          <PullRequestCard
            v-for="pr in prList"
            :key="pr.id"
            :pr="pr"
            :repo-default-branch="defaultBranchName"
            @open="openPRDetail(pr)"
            @merge="openPRDetail(pr); mergeThisPR()"
            @close="openPRDetail(pr); closeThisPR()"
          />
          <div v-if="prList.length === 0" class="pr-empty">暂无合并请求</div>
        </div>
      </div>

      <!-- ============= REFLOG TAB ============= -->
      <div v-else-if="tab === 'reflog'" class="tab-section neu-card" style="padding: 14px 16px;">
        <h3>🧾 Reflog —— 操作历史（可随时回退到任意历史点）</h3>
        <div class="ref-tip">
          这里是分支指针的每一次移动记录。即使是 reset/delete 等危险操作，在 reflog 过期之前（默认 30 天）
          都可以把分支恢复到任意一次变更之前的状态。
        </div>
        <div v-if="loadingReflog" class="mini-loading">加载中...</div>
        <div v-else class="reflog-list">
          <div v-for="e in reflog" :key="e.id" class="reflog-item">
            <div class="reflog-left">
              <div class="reflog-ref">
                <span class="reflog-branch">{{ e.branchName }}@{{ e.indexInBranch }}</span>
                <span class="reflog-op" :title="e.details">{{ e.operation }}</span>
              </div>
              <div class="reflog-shas">
                <code class="old-sha">{{ e.oldCommitSha?.slice(0, 8) ?? '----' }}</code>
                →
                <code class="new-sha">{{ e.newCommitSha?.slice(0, 8) ?? '----' }}</code>
              </div>
              <div class="reflog-desc">
                <span class="reflog-actor">👤 {{ e.actorName }}</span>
                · <span>{{ new Date(e.createdAt).toLocaleString() }}</span>
                <span v-if="e.details" class="reflog-details">{{ e.details }}</span>
              </div>
            </div>
            <div class="reflog-right">
              <button
                class="btn btn-sm btn-danger"
                :disabled="!e.newCommitSha"
                @click="checkoutViaReflog(e)"
              >🎯 重置分支到此状态（HARD）</button>
            </div>
          </div>
        </div>
      </div>

      <!-- ============= INSIGHTS TAB ============= -->
      <div v-else-if="tab === 'insights'" class="tab-section neu-card" style="padding: 14px 16px;">
        <h3>📈 贡献洞察</h3>
        <div class="insight-summary">
          <div class="ins-box">
            <div class="ins-num">{{ commits.length }}</div>
            <div class="ins-label">总提交（最近 {{ commitLimit }} 条）</div>
          </div>
          <div class="ins-box">
            <div class="ins-num">{{ branches.length }}</div>
            <div class="ins-label">活跃分支</div>
          </div>
          <div class="ins-box">
            <div class="ins-num">{{ tags.length }}</div>
            <div class="ins-label">发布标签</div>
          </div>
          <div class="ins-box">
            <div class="ins-num">{{ contributors.length }}</div>
            <div class="ins-label">贡献者</div>
          </div>
        </div>
        <h4 style="margin: 18px 0 8px;">👥 贡献者</h4>
        <div class="contrib-list">
          <div
            v-for="c in contributors"
            :key="c.name"
            class="contrib-row"
          >
            <div
              class="contrib-avatar"
              :style="{ background: `hsl(${(c.name.length * 97) % 360}, 70%, 68%)` }"
            >{{ c.name.charAt(0).toUpperCase() }}</div>
            <div class="contrib-info">
              <div class="contrib-name">{{ c.name }}</div>
              <div class="contrib-meta">
                📦 {{ c.count }} commits
                · <span style="color: var(--success)">+{{ c.additions }}</span>
                · <span style="color: var(--danger)">-{{ c.deletions }}</span>
              </div>
            </div>
            <div class="contrib-bar-wrap">
              <div
                class="contrib-bar"
                :style="{ width: (100 * c.count / Math.max(1, contributors[0].count)) + '%' }"
              ></div>
            </div>
            <div class="contrib-last">最近：{{ new Date(c.lastAt).toLocaleDateString() }}</div>
          </div>
        </div>
      </div>

      <!-- =========== PR 详情抽屉 =========== -->
      <div v-if="openPR" class="pr-drawer-backdrop" @click.self="openPR = null">
        <div class="pr-drawer neu-card" @click.stop>
          <div class="pr-drawer-head">
            <div>
              <div class="pd-title">{{ openPR.title }} <small>#{{ openPR.number }}</small></div>
              <div class="pd-flow">
                🌿 {{ openPR.headBranchName }}
                <span class="pd-arrow">→</span>
                {{ openPR.baseBranchName }}
              </div>
            </div>
            <button class="btn" @click="openPR = null">✕ 关闭</button>
          </div>
          <div class="pr-drawer-body">
            <div v-if="openPR.description" class="pd-desc neu-card" style="padding: 12px 14px;">
              {{ openPR.description }}
            </div>
            <div class="pd-diff-head neu-card" style="padding: 10px 14px;">
              <div>
                📁 {{ prTotalDiff().files }} 个文件 ·
                <span style="color: var(--success)">+{{ prTotalDiff().additions }}</span>
                <span style="color: var(--danger)"> -{{ prTotalDiff().deletions }}</span>
              </div>
              <div class="diff-view-mode small">
                <span :class="{ active: viewMode === 'split' }" @click="viewMode = 'split'">Split</span>
                <span :class="{ active: viewMode === 'unified' }" @click="viewMode = 'unified'">Unified</span>
              </div>
            </div>
            <div class="pd-diff">
              <DiffFileViewer
                v-for="f in openPRDiff?.files ?? []"
                :key="f.oldPath + f.newPath"
                :file="f"
                :view-mode="viewMode"
                @line-click="onLineClickDiff"
              />
            </div>
            <PRCommentThread
              :comments="openPRComments"
              :current-user-id="(repo?.ownerId) || 1"
              :title="pendingCommentLine ? `📍 针对 ${pendingCommentLine.path} L${pendingCommentLine.lineNumber} (${pendingCommentLine.side}) 的讨论` : '💬 讨论'"
              :file-path="pendingCommentLine?.path"
              :line-number="pendingCommentLine?.lineNumber"
              :side="pendingCommentLine?.side"
              @submit="submitComment"
              @resolve="resolveComment"
            />
            <div class="pd-actions neu-card" style="padding: 10px 14px;">
              <div v-if="openPR.mergeBlockedReason" class="pd-blocked">
                ⚠️ {{ openPR.mergeBlockedReason }}
              </div>
              <div class="pd-actions-row">
                <button class="btn" @click="pendingCommentLine = null; submitComment('LGTM 👍'); submitPRReviewSafe({ body: 'LGTM', status: 'APPROVED' })">
                  ✅ 批准
                </button>
                <button class="btn" @click="submitPRReviewSafe({ body: '请做修改', status: 'CHANGES_REQUESTED' })">
                  🟡 请求修改
                </button>
                <div style="flex: 1;"></div>
                <button
                  class="btn btn-warn"
                  v-if="openPR.status !== 'CLOSED' && openPR.status !== 'MERGED'"
                  @click="closeThisPR"
                >关闭</button>
                <button
                  class="btn btn-primary"
                  :disabled="!!openPR.mergeBlockedReason"
                  @click="mergeThisPR"
                >🔀 合并</button>
              </div>
            </div>
            <div class="pd-act-list">
              <div class="pd-act-title">活动日志</div>
              <div v-for="a in openPRActivities" :key="a.id" class="pd-act-item">
                <span class="pd-act-time">{{ new Date(a.createdAt).toLocaleString() }}</span>
                <span class="pd-act-actor">{{ a.actorName }}</span>
                <span class="pd-act-type">{{ a.actionType }}</span>
                <span v-if="a.description" class="pd-act-desc">{{ a.description }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- =========== 创建 PR 弹窗 =========== -->
      <div v-if="creatingPR" class="modal-backdrop" @click.self="creatingPR = false">
        <div class="modal neu-card" @click.stop>
          <div class="modal-head">🔀 新建合并请求</div>
          <div class="modal-body">
            <label>源分支（要合并的）</label>
            <BranchSelector v-model="newPR.headBranchName" :branches="branches" :tags="tags" />
            <label>目标分支</label>
            <BranchSelector v-model="newPR.baseBranchName" :branches="branches" :tags="tags" />
            <label>标题 *</label>
            <input v-model="newPR.title" placeholder="简要描述变更" />
            <label>描述</label>
            <textarea v-model="newPR.description" rows="5" placeholder="变更动机、风险点、测试方式..."></textarea>
          </div>
          <div class="modal-actions">
            <button class="btn" @click="creatingPR = false">取消</button>
            <button class="btn btn-primary" :disabled="!newPR.title" @click="submitNewPR">创建</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 内部临时变量区（配合 newBranch / newTag 创建分支标签） -->
    <div style="display: none;">
      {{ creatingBranch }} {{ newBranchName = (newBranchName || '') }}
    </div>
  </div>
</template>

<script lang="ts">
// 扩展局部组件级变量，保持 reactivity，且避免 template 内未定义变量报错
export default {
  data() {
    return {
      creatingBranch: false,
      newBranchName: '',
      baseBranchName: '',
      creatingTag: false,
      newTag: { name: '', targetSha: '', title: '' } as any,
    }
  },
  methods: {
    async doCreateTag() {
      const tg = this.newTag
      if (!tg.name) return
      if (!tg.targetSha) {
        // default branch head
        const br = (this as any).branches.find((b: any) => b.isDefault) ?? (this as any).branches[0]
        if (br) tg.targetSha = br.headCommitSha
      }
      if (!tg.targetSha) return
      const { createTag } = await import('../api/gitClient')
      await createTag((this as any).repoId, {
        name: tg.name, targetCommitSha: tg.targetSha,
        title: tg.title || undefined, type: 'ANNOTATED',
      })
      await (this as any).reloadBasics()
      ;(this as any).flashMsg('标签已创建')
      ;(this as any).creatingTag = false
      this.newTag = { name: '', targetSha: '', title: '' }
    },
    async doDeleteTag(t: any) {
      if (!confirm(`确认删除标签 ${t.name}？`)) return
      const { deleteTag } = await import('../api/gitClient')
      await deleteTag((this as any).repoId, t.name)
      await (this as any).reloadBasics()
    },
    async submitPRReviewSafe(payload: any) {
      if (!(this as any).openPR) return
      const { submitPRReview } = await import('../api/gitClient')
      await submitPRReview((this as any).repoId, (this as any).openPR.number, payload)
      ;(this as any).flashMsg('审核意见已提交')
      const { getPR } = await import('../api/gitClient')
      const r = await getPR((this as any).repoId, (this as any).openPR.number)
      ;(this as any).openPR = r.data.pr
      await (this as any).loadPRs()
    },
  },
}
</script>

<style scoped>
.repo-page { padding: 14px; position: relative; }
.repo-flash {
  position: fixed; bottom: 24px; right: 24px; z-index: 500;
  padding: 10px 16px; background: #111827; color: white;
  font-size: 13px; border-radius: 8px;
  animation: fade 0.3s;
}
@keyframes fade { from { opacity: 0 } to { opacity: 1 } }
.repo-loading, .mini-loading {
  padding: 40px; text-align: center; color: var(--text-muted);
}
.tab-section { margin-top: 16px; display: flex; flex-direction: column; gap: 14px; }
.tool-row {
  display: flex; justify-content: space-between; align-items: center;
  flex-wrap: wrap; gap: 12px;
}
.tool-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.btn {
  padding: 5px 12px; font-size: 13px; border: 1px solid var(--border-color);
  border-radius: 6px; background: white; cursor: pointer; display: inline-flex; align-items: center; gap: 4px;
}
.btn:hover { background: var(--neutral-soft); }
.btn-primary { background: var(--primary); color: white; border-color: transparent; }
.btn-primary:hover { filter: brightness(1.05); }
.btn-sm { padding: 3px 9px; font-size: 12px; }
.btn-danger, .danger { background: var(--danger-bg); color: var(--danger-fg); border-color: transparent; }
.btn-warn { background: var(--warn-bg); color: var(--warn-fg); border-color: transparent; }
.breadcrumb {
  padding: 6px 10px; background: var(--neutral-soft); border-radius: 6px;
  font-family: ui-monospace, monospace; font-size: 12.5px; color: var(--text-muted);
}
.crumb { cursor: pointer; color: var(--text-color); padding: 2px 4px; border-radius: 4px; }
.crumb:hover { background: white; }
.crumb-sep { opacity: .5; margin: 0 2px; }
.two-col { display: grid; grid-template-columns: 320px 1fr; gap: 14px; }
@media (max-width: 900px) { .two-col { grid-template-columns: 1fr; } }
.col-left, .col-right { min-height: 300px; }
.file-head {
  display: flex; justify-content: space-between; align-items: center;
  padding-bottom: 10px; border-bottom: 1px dashed var(--border-color); margin-bottom: 10px;
}
.file-path { font-family: ui-monospace, monospace; font-weight: 600; font-size: 13px; }
.file-meta { margin-left: 10px; color: var(--text-muted); font-size: 11.5px; }
.file-content {
  background: #0f172a; color: #e5e7eb; padding: 14px;
  border-radius: 8px; overflow: auto; max-height: 500px;
  font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px;
  line-height: 1.5; white-space: pre-wrap;
}
.empty-file { padding: 40px; text-align: center; color: var(--text-muted); }

.quick-ops {}
.qo-title { font-weight: 600; margin-bottom: 10px; }
.qo-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 14px; }
@media (max-width: 800px) { .qo-row { grid-template-columns: 1fr; } }
.qo-block {
  display: flex; flex-direction: column; gap: 6px;
  padding: 10px 12px; background: var(--neutral-soft); border-radius: 8px;
}
.qo-block label { font-size: 12px; color: var(--text-muted); }
.qo-input {
  padding: 5px 10px; border: 1px solid var(--border-color);
  border-radius: 6px; outline: none; font-size: 13px;
}
.qo-tip { font-size: 12px; color: var(--text-muted); line-height: 1.6; }

.commit-detail .cd-head {
  display: flex; justify-content: space-between; gap: 14px; flex-wrap: wrap;
  padding-bottom: 10px; border-bottom: 1px solid var(--border-color);
}
.cd-subject { font-size: 16px; font-weight: 700; line-height: 1.35; }
.cd-meta { font-size: 12.5px; color: var(--text-muted); margin-top: 6px; }
.cd-sha {
  font-family: ui-monospace, monospace; color: var(--primary); font-weight: 600;
}
.cd-actions { display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.cd-stats {
  padding: 8px 0; display: flex; gap: 14px; font-family: ui-monospace, monospace; font-size: 13px;
}
.diff-view-mode {
  display: inline-flex; border-radius: 6px; overflow: hidden;
  border: 1px solid var(--border-color); font-size: 12px; margin-bottom: 10px;
}
.diff-view-mode.small { font-size: 11px; }
.diff-view-mode span {
  padding: 4px 12px; cursor: pointer; color: var(--text-muted);
}
.diff-view-mode span.active { background: var(--primary-bg-soft); color: var(--primary); font-weight: 600; }

/* Tables */
.tbl-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px; margin-bottom: 10px; }
.tbl-head h3 { margin: 0; font-size: 15px; }
.create-branch-bar {
  flex-basis: 100%;
  display: flex; gap: 8px; align-items: center; padding: 8px 12px;
  background: var(--neutral-soft); border-radius: 8px; flex-wrap: wrap;
}
.create-branch-bar input, .create-branch-bar select {
  padding: 5px 10px; border: 1px solid var(--border-color); border-radius: 6px;
  outline: none; font-size: 13px; font-family: ui-monospace, monospace;
}
.tbl { width: 100%; border-collapse: collapse; font-size: 13px; }
.tbl th, .tbl td { padding: 9px 10px; border-bottom: 1px solid var(--border-color); text-align: left; }
.tbl th { background: var(--neutral-soft); font-weight: 600; font-size: 12px; color: var(--text-muted); }
.tbl tr:hover td { background: var(--neutral-soft); }
.tbl-b-name code { background: var(--neutral-soft); padding: 2px 6px; border-radius: 4px; }
.tbl-monospace { font-family: ui-monospace, monospace; }
.badge {
  font-size: 10.5px; padding: 2px 8px; border-radius: 999px;
  background: var(--neutral-soft); color: var(--text-muted);
}
.badge.default { background: var(--primary-bg-soft); color: var(--primary); }
.badge.warn { background: var(--warn-bg); color: var(--warn-fg); }
.badge.danger { background: var(--danger-bg); color: var(--danger-fg); }

/* Compare */
.compare-tool {}
.compare-headers {
  display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
}
.cmp-label { font-size: 12.5px; color: var(--text-muted); font-weight: 600; }
.cmp-arrow { color: var(--text-muted); font-weight: 600; }
.compare-actions {
  margin-top: 12px; padding-top: 12px; border-top: 1px dashed var(--border-color);
  display: flex; justify-content: space-between; gap: 14px; align-items: center; flex-wrap: wrap;
}
.cmp-summary { display: flex; gap: 14px; font-family: ui-monospace, monospace; font-size: 13px; }
.cmp-btn-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.cmp-conflicts {
  margin-top: 10px; padding: 8px 12px; background: var(--danger-bg); color: var(--danger-fg);
  border-radius: 6px; font-size: 12.5px;
}
.cmp-conflicts ul { margin: 4px 0 4px 20px; }
.cmp-hint { font-size: 11px; opacity: .8; }

/* PRs */
.pr-toolbar {
  display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
}
.pr-status-filter { display: flex; gap: 6px; flex-wrap: wrap; }
.pr-status-chip {
  padding: 4px 10px; border-radius: 999px;
  background: var(--neutral-soft); font-size: 12px; cursor: pointer;
}
.pr-status-chip.active { background: var(--primary); color: white; }
.pr-list { display: flex; flex-direction: column; gap: 12px; }
.pr-empty { padding: 30px; text-align: center; color: var(--text-muted); }

/* PR drawer */
.pr-drawer-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 100;
  display: flex; justify-content: center; align-items: flex-start; padding: 20px;
  overflow: auto;
}
.pr-drawer {
  width: min(1100px, 96vw); max-height: 92vh; overflow: auto;
  padding: 16px 18px; position: relative;
}
.pr-drawer-head {
  display: flex; justify-content: space-between; align-items: flex-start; gap: 12px;
  padding-bottom: 10px; border-bottom: 1px solid var(--border-color);
}
.pd-title { font-size: 17px; font-weight: 700; }
.pd-title small { color: var(--text-muted); font-weight: 400; }
.pd-flow { font-size: 12.5px; color: var(--text-muted); margin-top: 4px; font-family: ui-monospace, monospace; }
.pd-arrow { margin: 0 6px; color: var(--primary); font-weight: 700; }
.pr-drawer-body { margin-top: 12px; display: flex; flex-direction: column; gap: 14px; }
.pd-desc { font-size: 13.5px; line-height: 1.6; white-space: pre-wrap; }
.pd-diff-head {
  display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
  font-family: ui-monospace, monospace; font-size: 12.5px;
}
.pd-blocked {
  padding: 6px 10px; background: var(--danger-bg); color: var(--danger-fg);
  border-radius: 6px; font-size: 12.5px; margin-bottom: 10px;
}
.pd-actions-row { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.pd-act-list { font-size: 12px; color: var(--text-muted); font-family: ui-monospace, monospace; }
.pd-act-title { font-weight: 600; color: var(--text-color); margin-bottom: 6px; }
.pd-act-item {
  display: flex; gap: 8px; padding: 3px 0; border-bottom: 1px dashed var(--border-color);
}
.pd-act-time { opacity: .7; }
.pd-act-actor { font-weight: 600; color: var(--text-color); }
.pd-act-type { color: var(--primary); }
.pd-act-desc { opacity: .85; }

/* Modal */
.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 100;
  display: flex; justify-content: center; align-items: center;
}
.modal { width: min(640px, 94vw); max-height: 90vh; overflow: auto; }
.modal-head { padding: 14px 18px; font-weight: 600; border-bottom: 1px solid var(--border-color); }
.modal-body { padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; }
.modal-body label { font-size: 12px; color: var(--text-muted); }
.modal-body input, .modal-body textarea {
  padding: 6px 10px; border: 1px solid var(--border-color); border-radius: 6px;
  outline: none; font-size: 13.5px;
}
.modal-actions {
  padding: 12px 18px; border-top: 1px solid var(--border-color);
  display: flex; justify-content: flex-end; gap: 8px;
}

/* Reflog */
.ref-tip {
  font-size: 12.5px; color: var(--text-muted);
  padding: 8px 12px; background: var(--primary-bg-soft); color: var(--primary);
  border-radius: 6px; margin: 8px 0 14px;
}
.reflog-list { display: flex; flex-direction: column; gap: 8px; }
.reflog-item {
  display: flex; justify-content: space-between; align-items: center; gap: 14px;
  padding: 10px 12px; background: var(--neutral-soft); border-radius: 8px;
  border: 1px solid var(--border-color);
}
.reflog-ref { display: flex; gap: 8px; align-items: center; }
.reflog-branch { font-family: ui-monospace, monospace; font-weight: 700; }
.reflog-op {
  font-size: 10.5px; padding: 2px 8px; border-radius: 999px;
  background: var(--primary-bg-soft); color: var(--primary); text-transform: uppercase;
  letter-spacing: .5px;
}
.reflog-shas { font-family: ui-monospace, monospace; font-size: 12.5px; margin-top: 3px; }
.old-sha { color: var(--danger); }
.new-sha { color: var(--success); }
.reflog-desc { font-size: 12px; color: var(--text-muted); margin-top: 4px; display: flex; gap: 8px; flex-wrap: wrap; }
.reflog-details { font-style: italic; }

/* Insights */
.insight-summary {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px;
}
@media (max-width: 700px) { .insight-summary { grid-template-columns: repeat(2, 1fr); } }
.ins-box {
  background: var(--neutral-soft); padding: 14px; border-radius: 10px;
  text-align: center;
}
.ins-num { font-size: 26px; font-weight: 700; color: var(--primary); }
.ins-label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.contrib-list { display: flex; flex-direction: column; gap: 8px; }
.contrib-row {
  display: grid;
  grid-template-columns: 40px 1fr 1.6fr 160px;
  gap: 12px; align-items: center;
  padding: 8px 10px; border-radius: 8px;
  background: var(--neutral-soft);
}
@media (max-width: 800px) {
  .contrib-row { grid-template-columns: 40px 1fr; row-gap: 6px; }
  .contrib-bar-wrap, .contrib-last { grid-column: span 2; }
}
.contrib-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700;
}
.contrib-name { font-weight: 600; }
.contrib-meta { font-size: 11.5px; color: var(--text-muted); font-family: ui-monospace, monospace; }
.contrib-bar-wrap {
  height: 8px; background: rgba(0,0,0,.05); border-radius: 999px; overflow: hidden;
}
.contrib-bar {
  height: 100%; background: linear-gradient(90deg, var(--primary), var(--info-bg));
  transition: width .25s;
}
.contrib-last { font-size: 11.5px; color: var(--text-muted); text-align: right; }
</style>
