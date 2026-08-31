<script setup lang="ts">
/**
 * GitFloatingPanel —— 对话界面中嵌入的"Git 面板"
 * 放置于 ChatViewer 或 对话视图旁，使用时打开/收起。
 * 功能：
 *  1. 显示当前对话绑定的 repo（或"初始化仓库"按钮）
 *  2. 显示当前分支、最近 5 次提交、分支切换、创建新分支
 *  3. 一键查看 Commit Diff / 回滚到此版本 / Cherry-pick / Revert
 *  4. 快捷按钮 "查看完整仓库" → 跳转 GitRepoPage
 * Props:
 *   convId: number | null
 *   conversation?: 可附带对话标题（用于自动命名）
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import BranchSelector from './BranchSelector.vue'
import {
  createOrGetConvRepo,
  listBranches, listTags, listCommits, createBranch,
  resetBranch, cherryPickCommit, revertCommit,
  getCommitDetail,
} from '../api/gitClient'
import type * as T from '../types/types'
import { shortSha } from '../types/hash'

const props = defineProps<{
  convId: number | null
  conversation?: { id: number; title?: string } | null
}>()

const router = useRouter()
const repo = ref<T.GitRepoEntity | null>(null)
const branches = ref<T.GitBranchEntity[]>([])
const tags = ref<T.GitTagEntity[]>([])
const currentRef = ref('')
const recent = ref<any[]>([])
const activeSha = ref<string | null>(null)
const activeDiff = ref<any>(null)
const loadingRepo = ref(false)
const open = ref(true)

async function bootstrap() {
  if (!props.convId) { repo.value = null; branches.value = []; recent.value = []; return }
  loadingRepo.value = true
  try {
    const r = await createOrGetConvRepo(props.convId)
    repo.value = r.data.repo
    await loadBranchesAndCommits()
  } finally { loadingRepo.value = false }
}

async function loadBranchesAndCommits() {
  if (!repo.value) return
  const [br, tg] = await Promise.all([
    listBranches(repo.value.id),
    listTags(repo.value.id),
  ])
  branches.value = br.data.branches
  tags.value = tg.data.tags
  const def = branches.value.find(b => b.isDefault) ?? branches.value[0]
  if (def) currentRef.value = def.name
  await loadRecent()
}

async function loadRecent() {
  if (!repo.value) return
  const r = await listCommits(repo.value.id, {
    branchName: currentRef.value,
    limit: 20,
  })
  recent.value = r.data.commits
}

async function selectCommit(sha: string) {
  activeSha.value = sha
  if (!repo.value) return
  const r = await getCommitDetail(repo.value.id, sha)
  activeDiff.value = r.data
}

watch(() => [props.convId, currentRef.value], () => {
  if (activeSha.value && repo.value) selectCommit(activeSha.value)
  loadRecent()
}, { deep: false })

onMounted(bootstrap)
watch(() => props.convId, bootstrap)

function onCreateBranch(name: string, base: string) {
  if (!repo.value) return
  createBranch(repo.value.id, { name, fromBranchName: base })
    .then(async () => { await loadBranchesAndCommits() })
}

async function doReset(sha: string, mode: 'HARD' | 'SOFT' | 'MIXED' = 'MIXED') {
  if (!repo.value) return
  if (!confirm(`将 ${currentRef.value} reset --${mode.toLowerCase()} 到 ${shortSha(sha,7)}?`)) return
  await resetBranch(repo.value.id, {
    branchName: currentRef.value, targetSha: sha, mode,
  })
  flash('已重置，对话视图请刷新以加载历史内容')
  await loadRecent()
}
async function doCherry(sha: string) {
  if (!repo.value) return
  await cherryPickCommit(repo.value.id, { sha, ontoBranchName: currentRef.value })
  flash('已 cherry-pick')
  await loadRecent()
}
async function doRevert(sha: string) {
  if (!repo.value) return
  await revertCommit(repo.value.id, { sha, ontoBranchName: currentRef.value })
  flash('已生成 revert commit')
  await loadRecent()
}

function goFullRepo() {
  if (repo.value) router.push(`/git/repos/${repo.value.id}?tab=code`)
}
function goPRs() {
  if (repo.value) router.push(`/git/repos/${repo.value.id}?tab=prs`)
}
function goReflog() {
  if (repo.value) router.push(`/git/repos/${repo.value.id}?tab=reflog`)
}

const flashMsg = ref<string | null>(null)
function flash(s: string) {
  flashMsg.value = s
  setTimeout(() => (flashMsg.value = null), 2000)
}

const timeAgo = (iso: string) => {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const s = Math.floor(diff / 1000); if (s < 60) return `${s}s前`
  const m = Math.floor(s / 60); if (m < 60) return `${m}m前`
  const h = Math.floor(m / 60); if (h < 24) return `${h}h前`
  return `${Math.floor(h/24)}d前`
}

const changeTypeLabel: Record<string, string> = {
  INIT: '初始化', NEW_TURN: '新轮次', EDIT_TURN: '改轮次', DELETE_TURN: '删轮次',
  MERGE: '合并', REBASE: '变基', REVERT: '回滚', CHERRY_PICK: '拣选',
  TAG: '标签', EDIT: '编辑',
}
</script>

<template>
  <div class="git-floating-panel" :class="{ collapsed: !open, expanded: open }">
    <div class="gfp-head" @click="open = !open">
      <span class="gfp-icon">🌿</span>
      <div class="gfp-titles">
        <div class="gfp-title">
          {{ repo ? `Git #${repo.id}` : 'Git 仓库' }}
          <span v-if="repo" class="gfp-type" :class="repo.type">
            {{ repo.type === 'CONVERSATION' ? '对话仓库' : '标准' }}
          </span>
        </div>
        <div v-if="repo" class="gfp-sub">
          {{ repo.name }} · 🌿{{ branches.length }} 📦{{ repo.commitCount }} 🔀{{ repo.pullRequestCount }}
        </div>
        <div v-else class="gfp-sub">
          {{ convId ? '初始化绑定...' : '请选择对话' }}
        </div>
      </div>
      <span class="gfp-chevron">{{ open ? '▼' : '▲' }}</span>
    </div>

    <div v-if="flashMsg" class="gfp-flash">{{ flashMsg }}</div>

    <div v-if="open" class="gfp-body">
      <div v-if="loadingRepo && !repo" class="gfp-loading">绑定中...</div>
      <template v-else-if="repo">
        <!-- 工具条 -->
        <div class="gfp-tools">
          <BranchSelector
            v-model="currentRef"
            :branches="branches"
            :tags="tags"
            allow-create
            @create-branch="onCreateBranch"
          />
          <button class="btn btn-sm" title="完整仓库" @click="goFullRepo">🗂️ 仓库</button>
          <button class="btn btn-sm" title="PRs" @click="goPRs">🔀 PR</button>
          <button class="btn btn-sm" title="Reflog 回滚记录" @click="goReflog">🧾 Reflog</button>
        </div>

        <!-- 最近提交 -->
        <div class="gfp-recent">
          <div class="gfp-recent-title">📦 最近提交 · {{ currentRef }}</div>
          <div class="gfp-recent-list">
            <div
              v-for="c in recent"
              :key="c.id"
              class="gfp-commit"
              :class="{ active: activeSha === c.sha256 }"
              @click="selectCommit(c.sha256)"
            >
              <div class="gfp-commit-head">
                <span v-if="c.changeType" class="gfp-ctype">{{ changeTypeLabel[c.changeType] ?? c.changeType }}</span>
                <span class="gfp-msg" :title="c.subject">{{ c.subject }}</span>
              </div>
              <div class="gfp-commit-meta">
                <code class="gfp-sha">{{ shortSha(c.sha256, 7) }}</code>
                <span>{{ c.authorName }}</span>
                <span>{{ timeAgo(c.committedAt) }}</span>
                <span class="gfp-stat">
                  <span style="color: var(--success)">+{{ c.additions }}</span>
                  <span style="color: var(--danger)"> -{{ c.deletions }}</span>
                </span>
              </div>
              <div v-if="activeSha === c.sha256 && activeDiff" class="gfp-commit-detail">
                <div class="gfp-diff-stats">
                  📁 {{ activeDiff.diff.files.length }} files
                </div>
                <div class="gfp-ops">
                  <button class="btn btn-xs" @click.stop="doReset(c.sha256,'MIXED')">↶ MIXED</button>
                  <button class="btn btn-xs danger" @click.stop="doReset(c.sha256,'HARD')">💥 HARD</button>
                  <button class="btn btn-xs" @click.stop="doCherry(c.sha256)">🍒 Cherry</button>
                  <button class="btn btn-xs" @click.stop="doRevert(c.sha256)">↩️ Revert</button>
                </div>
              </div>
            </div>
            <div v-if="recent.length === 0" class="gfp-empty">
              🚀 还没有提交。发送一条对话消息即可生成首个 commit。
            </div>
          </div>
        </div>
      </template>
      <div v-else-if="!loadingRepo && !repo" class="gfp-empty">
        此对话还没有绑定 Git 仓库。
        <button class="btn btn-primary btn-sm" style="margin-top: 10px;" @click="bootstrap">
          🔗 现在初始化
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.git-floating-panel {
  border: 1px solid var(--border-color);
  border-radius: 12px;
  background: white;
  overflow: hidden;
  max-height: 70vh;
  display: flex; flex-direction: column;
  box-shadow: 0 4px 14px -8px rgba(0,0,0,.1);
  position: relative;
}
.gfp-head {
  display: flex; align-items: center; gap: 10px;
  padding: 10px 14px; background: linear-gradient(135deg, var(--primary-bg-soft), white);
  cursor: pointer;
}
.gfp-icon { font-size: 18px; }
.gfp-titles { flex: 1; min-width: 0; }
.gfp-title {
  font-weight: 600; display: flex; align-items: center; gap: 8px;
}
.gfp-type {
  font-size: 10px; padding: 1px 7px; border-radius: 999px;
  background: var(--success-bg); color: var(--success-fg);
}
.gfp-type.STANDARD { background: var(--info-bg); color: var(--info-fg); }
.gfp-sub { font-size: 11.5px; color: var(--text-muted); margin-top: 2px; }
.gfp-chevron { font-size: 10px; color: var(--text-muted); }

.gfp-flash {
  position: absolute; top: 8px; right: 8px;
  padding: 4px 10px; background: #111827; color: white;
  border-radius: 6px; font-size: 12px; z-index: 10;
}
.gfp-loading, .gfp-empty {
  padding: 20px; text-align: center; color: var(--text-muted); font-size: 12.5px;
}
.gfp-body { overflow: auto; padding: 10px 12px; display: flex; flex-direction: column; gap: 10px; }
.gfp-tools { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
.btn {
  padding: 5px 10px; font-size: 12px;
  border: 1px solid var(--border-color);
  border-radius: 6px; background: white; cursor: pointer;
}
.btn:hover { background: var(--neutral-soft); }
.btn-sm { padding: 4px 8px; font-size: 11.5px; }
.btn-xs { padding: 3px 7px; font-size: 10.5px; }
.btn-primary { background: var(--primary); color: white; border-color: transparent; }
.btn-primary:hover { filter: brightness(1.05); }
.danger { background: var(--danger-bg); color: var(--danger-fg); border-color: transparent; }

.gfp-recent {
  background: var(--neutral-soft); border-radius: 10px;
  padding: 8px 10px;
}
.gfp-recent-title {
  font-size: 11.5px; color: var(--text-muted);
  font-weight: 600; padding: 2px 4px 6px;
  text-transform: uppercase; letter-spacing: .5px;
}
.gfp-recent-list { display: flex; flex-direction: column; gap: 4px; max-height: 48vh; overflow: auto; }
.gfp-commit {
  background: white; border-radius: 8px; padding: 8px 10px;
  border: 1px solid transparent; cursor: pointer;
}
.gfp-commit:hover { border-color: var(--primary-soft); }
.gfp-commit.active { border-color: var(--primary); box-shadow: 0 0 0 2px var(--primary-bg-soft); }
.gfp-commit-head { display: flex; align-items: center; gap: 6px; }
.gfp-ctype {
  font-size: 9.5px; padding: 1px 6px; border-radius: 4px;
  background: var(--primary-bg-soft); color: var(--primary);
  text-transform: uppercase; letter-spacing: .3px; flex-shrink: 0;
}
.gfp-msg {
  font-size: 12.5px; font-weight: 500;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  flex: 1; min-width: 0;
}
.gfp-commit-meta {
  display: flex; flex-wrap: wrap; gap: 6px 10px;
  font-size: 10.5px; color: var(--text-muted);
  font-family: ui-monospace, monospace;
  margin-top: 4px;
}
.gfp-sha { color: var(--primary); font-weight: 600; }
.gfp-stat { margin-left: auto; font-weight: 600; }

.gfp-commit-detail {
  margin-top: 8px; padding: 8px 10px;
  border-radius: 7px; background: var(--neutral-soft);
  display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
}
.gfp-diff-stats { font-size: 11.5px; color: var(--text-muted); font-family: ui-monospace, monospace; }
.gfp-ops { display: flex; gap: 5px; flex-wrap: wrap; }
</style>
