<script setup lang="ts">
/**
 * GitReposList —— 仓库列表页
 *  特性:
 *  - 我拥有的/我可见的/全部公开
 *  - 按关键词搜索
 *  - 可新建（绑定对话 / 创建空仓库）
 *  - 每个仓库卡片展示 最新commit、分支数、PR数、最近更新
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { createOrGetConvRepo, listRepos, createRepo } from '../api/gitClient'
import type * as T from '../types/types'

const router = useRouter()

const tab = ref<'owner' | 'visible' | 'public'>('owner')
const search = ref('')
const list = ref<T.GitRepoEntity[]>([])
const loading = ref(false)
const hasMore = ref(true)
const offset = ref(0)
const PAGE_SIZE = 25

async function load(append = false) {
  loading.value = true
  try {
    const params: any = { limit: PAGE_SIZE, offset: append ? offset.value : 0 }
    if (tab.value === 'owner') params.visibility = 'PRIVATE'
    else if (tab.value === 'public') params.visibility = 'PUBLIC'
    if (search.value) params.search = search.value
    const r = await listRepos(params)
    const items = r.data.items
    list.value = append ? [...list.value, ...items] : items
    hasMore.value = items.length === PAGE_SIZE
    offset.value = list.value.length
  } finally { loading.value = false }
}

onMounted(() => load())

function changeTab(t: typeof tab.value) { tab.value = t; load() }
function onSearch() { load() }

// 新建仓库
const showNew = ref(false)
const newRepo = ref({
  name: '', description: '',
  visibility: 'PRIVATE' as T.RepoVisibility,
  defaultBranchName: 'main',
  initialize: true,
})
async function submitNew() {
  if (!newRepo.value.name) return
  const r = await createRepo({ ...newRepo.value, type: 'STANDARD' })
  router.push(`/git/repos/${r.data.repo.id}`)
}

// 从对话创建 / 打开
const convLink = ref<{ convId: number | '' }>({ convId: '' })
async function linkConv() {
  if (!convLink.value.convId) return
  const r = await createOrGetConvRepo(Number(convLink.value.convId))
  router.push(`/git/repos/${r.data.repo.id}`)
}

const tabs = [
  { key: 'owner', label: '我的', hint: '我创建的仓库' },
  { key: 'visible', label: '我可见', hint: '协作中 / 加入的仓库' },
  { key: 'public', label: '公开', hint: '所有公开仓库' },
] as const

function totalReposBy(k: keyof Pick<T.GitRepoEntity, 'commitCount' | 'branchCount' | 'pullRequestCount'>, fallback = 0) {
  return list.value.reduce((acc, r) => acc + ((r as any)[k] ?? fallback), 0)
}

function timeAgo(iso: string) {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}秒前`
  const m = Math.floor(s / 60); if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60); if (h < 24) return `${h}小时前`
  const dy = Math.floor(h / 24); if (dy < 30) return `${dy}天前`
  return new Date(iso).toLocaleDateString()
}

function openRepo(id: number) { router.push(`/git/repos/${id}`) }
</script>

<template>
  <div class="repos-page">
    <div class="rp-hero neu-card">
      <div class="rp-title">
        <span style="font-size: 30px;">🗂️</span>
        <div>
          <h1>Git 仓库中心</h1>
          <p class="rp-subtitle">
            对话管理的核心已经被改造成完整的 Git 版本控制体系 ——
            每个对话是一个仓库，每次消息写入是一次 commit，支持分支、回滚、PR、Diff、Reflog 等 GitHub 风格功能。
          </p>
        </div>
      </div>
      <div class="rp-stats">
        <div class="rp-stat">
          <div class="rp-num">{{ list.length }}</div>
          <div class="rp-label">仓库</div>
        </div>
        <div class="rp-stat">
          <div class="rp-num">{{ totalReposBy('commitCount') }}</div>
          <div class="rp-label">总提交</div>
        </div>
        <div class="rp-stat">
          <div class="rp-num">{{ totalReposBy('branchCount') }}</div>
          <div class="rp-label">分支</div>
        </div>
        <div class="rp-stat">
          <div class="rp-num">{{ totalReposBy('pullRequestCount') }}</div>
          <div class="rp-label">合并请求</div>
        </div>
      </div>
    </div>

    <!-- 工具栏 -->
    <div class="rp-toolbar neu-card">
      <div class="rp-tabs">
        <div
          v-for="t in tabs"
          :key="t.key"
          class="rp-tab"
          :class="{ active: tab === t.key }"
          @click="changeTab(t.key)"
        >
          <span class="rp-tab-label">{{ t.label }}</span>
          <span class="rp-tab-hint">{{ t.hint }}</span>
        </div>
      </div>
      <div class="rp-tools">
        <input
          v-model="search"
          class="rp-search"
          placeholder="🔍 搜索仓库名 / 描述 / 对话 ID"
          @keyup.enter="onSearch"
        />
        <button class="btn btn-primary" @click="showNew = true">+ 新建仓库</button>
      </div>
    </div>

    <!-- 对话快速绑定 -->
    <div class="rp-conv-card neu-card" style="margin-top: 12px;">
      <div class="rp-conv-head">
        <span class="rp-conv-icon">💬</span>
        <div>
          <div class="rp-conv-title">对话绑定仓库</div>
          <div class="rp-conv-subtitle">输入对话 ID，直接进入其仓库视图（如不存在会自动创建）</div>
        </div>
        <div class="rp-conv-input">
          <input v-model.number="convLink.convId" type="number" placeholder="Conversation ID（数字）" />
          <button class="btn btn-primary" :disabled="!convLink.convId" @click="linkConv">🚀 打开 / 创建</button>
        </div>
      </div>
    </div>

    <!-- 列表 -->
    <div class="rp-list">
      <div v-if="loading && list.length === 0" class="rp-empty loading">加载中...</div>
      <template v-else>
        <div
          v-for="r in list"
          :key="r.id"
          class="rp-card neu-card"
          @click="openRepo(r.id)"
        >
          <div class="rpc-head">
            <div class="rpc-title">
              <span class="rpc-type" :class="r.type">
                {{ r.type === 'CONVERSATION' ? '💬 对话仓库' : '🗂️ 标准仓库' }}
              </span>
              <span class="rpc-name">{{ r.name }}</span>
              <span
                class="rpc-vis"
                :title="r.visibility"
              >{{ r.visibility === 'PRIVATE' ? '🔒' : r.visibility === 'UNLISTED' ? '🔗' : '🌍' }}</span>
            </div>
            <div class="rpc-meta">
              <span>🌿 {{ r.branchCount ?? 0 }}</span>
              <span>📦 {{ r.commitCount ?? 0 }}</span>
              <span>🔀 {{ r.pullRequestCount ?? 0 }}</span>
              <span>⭐ {{ r.starCount ?? 0 }}</span>
            </div>
          </div>
          <div v-if="r.description" class="rpc-desc">{{ r.description }}</div>
          <div v-else-if="r.conversationId" class="rpc-desc link" @click.stop>
            对话 #{{ r.conversationId }} —
            <span style="color: var(--primary);">在此对话中，每条消息都会自动生成一个 commit</span>
          </div>
          <div class="rpc-foot">
            <span class="rpc-updated">🕐 {{ timeAgo(r.updatedAt) }}</span>
            <span v-if="r.defaultBranchName" class="rpc-default-branch">
              🌿 {{ r.defaultBranchName }}
            </span>
            <span class="rpc-go">打开仓库 →</span>
          </div>
        </div>
        <div v-if="list.length === 0 && !loading" class="rp-empty">
          <div style="font-size: 40px;">🌱</div>
          <div style="margin-top: 10px;">还没有仓库</div>
          <div style="margin-top: 4px; color: var(--text-muted); font-size: 13px;">
            新建一个标准仓库，或输入上方的对话ID绑定到一个对话仓库
          </div>
        </div>
        <div v-if="hasMore && list.length" class="rp-loadmore">
          <button class="btn" :disabled="loading" @click="load(true)">
            {{ loading ? '加载中...' : '加载更多' }}
          </button>
        </div>
      </template>
    </div>

    <!-- Modal 新建 -->
    <div v-if="showNew" class="modal-backdrop" @click.self="showNew = false">
      <div class="modal neu-card" @click.stop>
        <div class="modal-head">+ 新建 Git 仓库</div>
        <div class="modal-body">
          <label>仓库名 *</label>
          <input v-model="newRepo.name" placeholder="如: chat-about-doc-v2" />
          <label>描述</label>
          <textarea v-model="newRepo.description" rows="3" placeholder="简单介绍这个仓库的用途、背景"></textarea>
          <label>可见性</label>
          <select v-model="newRepo.visibility">
            <option value="PRIVATE">🔒 私有（仅自己与协作者）</option>
            <option value="UNLISTED">🔗 未列出（有链接者可访问）</option>
            <option value="PUBLIC">🌍 公开（所有人可浏览）</option>
          </select>
          <label>默认分支名</label>
          <input v-model="newRepo.defaultBranchName" />
          <label class="rp-check">
            <input type="checkbox" v-model="newRepo.initialize" />
            初始化一个空提交（推荐）
          </label>
        </div>
        <div class="modal-actions">
          <button class="btn" @click="showNew = false">取消</button>
          <button class="btn btn-primary" :disabled="!newRepo.name" @click="submitNew">创建仓库</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.repos-page { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
.rp-hero {
  padding: 20px 22px;
  background: linear-gradient(135deg, var(--primary-bg-soft), white);
  display: flex; justify-content: space-between; gap: 20px; flex-wrap: wrap;
}
.rp-title { display: flex; gap: 16px; align-items: center; flex: 1; min-width: 320px; }
.rp-title h1 { margin: 0; font-size: 22px; }
.rp-subtitle { margin: 6px 0 0; color: var(--text-muted); font-size: 13px; line-height: 1.6; max-width: 640px; }
.rp-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
@media (max-width: 700px) { .rp-stats { grid-template-columns: repeat(2, 1fr); width: 100%; } }
.rp-stat {
  background: white; border-radius: 10px; padding: 10px 14px;
  text-align: center; border: 1px solid var(--border-color);
}
.rp-num { font-size: 20px; font-weight: 700; color: var(--primary); }
.rp-label { font-size: 11px; color: var(--text-muted); margin-top: 2px; }

.rp-toolbar {
  padding: 10px 14px; display: flex; justify-content: space-between;
  align-items: center; gap: 14px; flex-wrap: wrap;
}
.rp-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
.rp-tab {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 14px; border-radius: 8px; cursor: pointer;
  border: 1px solid var(--border-color); font-size: 13px;
}
.rp-tab:hover { background: var(--neutral-soft); }
.rp-tab.active { background: var(--primary); color: white; border-color: transparent; }
.rp-tab-hint { font-size: 11px; opacity: .75; }
.rp-tools { display: flex; gap: 8px; flex-wrap: wrap; }
.rp-search {
  padding: 6px 12px; border: 1px solid var(--border-color);
  border-radius: 8px; outline: none; font-size: 13px; min-width: 260px;
}
.rp-search:focus { border-color: var(--primary); }

.btn {
  padding: 6px 14px; font-size: 13px;
  border-radius: 8px; border: 1px solid var(--border-color);
  cursor: pointer; background: white;
}
.btn:hover { background: var(--neutral-soft); }
.btn-primary { background: var(--primary); color: white; border-color: transparent; }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }

.rp-conv-card { padding: 14px 16px; }
.rp-conv-head { display: flex; gap: 14px; align-items: center; flex-wrap: wrap; }
.rp-conv-icon { font-size: 26px; }
.rp-conv-title { font-weight: 600; font-size: 14px; }
.rp-conv-subtitle { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
.rp-conv-input {
  margin-left: auto; display: flex; gap: 8px; align-items: center;
  padding: 6px; background: var(--neutral-soft); border-radius: 10px;
}
.rp-conv-input input {
  padding: 6px 10px; border: 1px solid var(--border-color);
  border-radius: 6px; outline: none; font-family: ui-monospace, monospace;
}

.rp-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 12px; }
.rp-card {
  padding: 14px 16px; cursor: pointer;
  transition: all .18s;
  display: flex; flex-direction: column; gap: 8px;
}
.rp-card:hover { transform: translateY(-2px); box-shadow: 0 10px 28px -12px rgba(0,0,0,.15); }
.rpc-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.rpc-title { display: flex; align-items: center; gap: 8px; min-width: 0; }
.rpc-type {
  font-size: 10.5px; padding: 2px 8px; border-radius: 999px;
  background: var(--info-bg); color: var(--info-fg);
  letter-spacing: .3px; flex-shrink: 0;
}
.rpc-type.CONVERSATION { background: var(--success-bg); color: var(--success-fg); }
.rpc-name {
  font-family: ui-monospace, monospace; font-weight: 700;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
  font-size: 14px;
}
.rpc-vis { flex-shrink: 0; }
.rpc-meta {
  display: flex; gap: 10px; font-family: ui-monospace, monospace;
  font-size: 11.5px; color: var(--text-muted); white-space: nowrap;
}
.rpc-desc {
  font-size: 12.5px; color: var(--text-secondary);
  line-height: 1.55; max-height: 2.8em; overflow: hidden;
}
.rpc-desc.link { color: var(--text-muted); }
.rpc-foot {
  margin-top: auto; display: flex; gap: 12px;
  align-items: center; font-size: 11.5px; color: var(--text-muted);
  padding-top: 8px; border-top: 1px dashed var(--border-color);
}
.rpc-default-branch {
  padding: 2px 8px; border-radius: 999px;
  background: var(--primary-bg-soft); color: var(--primary);
  font-family: ui-monospace, monospace;
}
.rpc-go { margin-left: auto; color: var(--primary); font-weight: 600; }
.rp-empty {
  grid-column: 1 / -1;
  padding: 40px; text-align: center; color: var(--text-muted);
}
.rp-empty.loading { font-size: 14px; }
.rp-loadmore { grid-column: 1 / -1; text-align: center; padding: 14px; }

.modal-backdrop {
  position: fixed; inset: 0; background: rgba(0,0,0,.35); z-index: 100;
  display: flex; justify-content: center; align-items: center;
}
.modal { width: min(580px, 94vw); max-height: 90vh; overflow: auto; }
.modal-head { padding: 14px 18px; font-weight: 600; border-bottom: 1px solid var(--border-color); }
.modal-body { padding: 14px 18px; display: flex; flex-direction: column; gap: 8px; }
.modal-body label { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
.modal-body input, .modal-body textarea, .modal-body select {
  padding: 7px 11px; border: 1px solid var(--border-color); border-radius: 7px;
  outline: none; font-size: 13.5px;
}
.modal-body .rp-check {
  display: flex; align-items: center; gap: 8px; color: var(--text-color); font-size: 13px;
}
.modal-actions {
  padding: 12px 18px; border-top: 1px solid var(--border-color);
  display: flex; justify-content: flex-end; gap: 8px;
}
</style>
