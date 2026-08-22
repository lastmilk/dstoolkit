<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  NSpace,
  NInput,
  NSwitch,
  NText,
  NSpin,
  NButton,
  NCheckbox,
  NRadioGroup,
  NRadio,
  NRadioButton,
  NPagination,
  NIcon,
  NTag,
} from 'naive-ui'
import dayjs from 'dayjs'
import {
  SearchOutline,
  CloudOutline,
  CloudOfflineOutline,
  FilterOutline,
  TimeOutline,
  SearchCircleOutline,
  ChevronDownOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { useSearchModelStore, type SearchModel } from '@/stores/searchModel'
import {
  loadAllConversations,
  loadConversationsPage,
  searchConversations,
  flexSearch,
  cloudSearch,
  getLocalConfigs,
  preloadIndex,
  isIndexReady,
  loadConversationDetail,
  type CloudSearchResult,
  type SearchFilters,
} from '@/utils/db'
import { request } from '@/utils/request'
import { message } from '@/utils/naive'
import TurnTree from '@/components/TurnTree.vue'
import ChatViewer from '@/components/ChatViewer.vue'
import type { ParsedConversation } from '@/types'

const auth = useAuthStore()
const searchModelStore = useSearchModelStore()

const loading = ref(false)
const loadProgress = ref('')
const loadTime = ref<number | null>(null)
const conversations = ref<ParsedConversation[]>([])
const query = ref('')
const useRegex = ref(false)
const searchHits = ref<Set<string>>(new Set())
const searchConvIds = ref<Set<string>>(new Set())
const autoExpandPaths = ref<string[]>([])
const mode = ref<'timeline' | 'search'>('timeline')

const activeConv = ref<ParsedConversation | null>(null)
const apiKeys = ref<Array<{ id: number; name: string }>>([])

const searchFilters = ref<SearchFilters>({ user: true, assistant: true, title: true })

const localUserId = ref<string | undefined>(undefined)
const detailLoading = ref(false)

const EXPLORE_PAGE_SIZE = 50
const hasMore = ref(false)
const loadingMore = ref(false)
const totalConvs = ref<number | undefined>(undefined)
const cloudConfigStates = ref<Array<{ id: number; name: string; page: number; hasMore: boolean }>>([])

const treeConversations = computed<ParsedConversation[]>(() => {
  if (mode.value === 'timeline') return conversations.value
  const hits = searchHits.value
  const convIds = searchConvIds.value
  if (hits.size === 0 && convIds.size === 0) return []
  return conversations.value.filter((c) =>
    convIds.has(c.deepseekConvId) || c.messages.some((m) => hits.has(m.nodeId)),
  )
})

const currentPage = ref(1)
const pageSize = ref(20)
const totalCount = computed(() => treeConversations.value.length)
const pageCount = computed(() =>
  Math.max(1, Math.ceil(totalCount.value / pageSize.value)),
)

const pagedTreeConversations = computed<ParsedConversation[]>(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return treeConversations.value.slice(start, start + pageSize.value)
})

watch([treeConversations, pageSize], () => {
  if (currentPage.value > pageCount.value) currentPage.value = 1
  else if (currentPage.value !== 1 && treeConversations.value.length === 0) {
    currentPage.value = 1
  }
})

async function onPageChange(p: number) {
  currentPage.value = p
  if (
    auth.cloudSyncEnabled &&
    hasMore.value &&
    p >= pageCount.value &&
    !loadingMore.value
  ) {
    await loadMore()
  }
}

function buildPaths(
  conv: ParsedConversation,
  turnIndex: number | null | undefined,
  versionIndex: number | null | undefined,
  subTurnIndex: number | null | undefined,
  paths: Set<string>,
) {
  const date = dayjs(conv.insertedAt).format('YYYY-MM-DD')
  paths.add(`d|${date}`)
  paths.add(`c|${conv.deepseekConvId}`)
  if (turnIndex != null) {
    paths.add(`t|${conv.deepseekConvId}|${turnIndex}`)
    if (versionIndex != null) {
      paths.add(`v|${conv.deepseekConvId}|${turnIndex}|${versionIndex}`)
      if (subTurnIndex != null) {
        paths.add(`s|${conv.deepseekConvId}|${turnIndex}|${versionIndex}|${subTurnIndex}`)
      }
    }
  }
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null

function onQueryInput(v: string) {
  query.value = v
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void doSearch()
  }, 300)
}

async function doSearch() {
  const q = query.value.trim()
  if (!q) {
    searchHits.value = new Set()
    searchConvIds.value = new Set()
    autoExpandPaths.value = []
    mode.value = 'timeline'
    return
  }
  mode.value = 'search'
  loading.value = true
  try {
    if (auth.cloudSyncEnabled) {
      const results = await cloudSearch(q, undefined, 200)
      const hits = new Set<string>()
      const convIds = new Set<string>()
      const paths = new Set<string>()
      for (const r of results as CloudSearchResult[]) {
        if (r.nodeId) hits.add(r.nodeId)
        convIds.add(r.convId)
        const conv = conversations.value.find((c) => c.deepseekConvId === r.convId)
        if (conv) buildPaths(conv, r.turnIndex, r.versionIndex, r.subTurnIndex, paths)
      }
      searchHits.value = hits
      searchConvIds.value = convIds
      autoExpandPaths.value = Array.from(paths)
    } else if (searchModelStore.isLocalV1) {
      searchConvIds.value = new Set()
      if (localUserId.value && !isIndexReady(localUserId.value)) {
        await preloadIndex(localUserId.value, conversations.value)
      }
      const results = useRegex.value
        ? await searchConversations(q, true, 200, searchFilters.value, conversations.value)
        : localUserId.value
          ? await flexSearch(localUserId.value, q, 200, searchFilters.value, conversations.value)
          : await searchConversations(q, false, 200, searchFilters.value, conversations.value)
      const hits = new Set<string>()
      const paths = new Set<string>()
      for (const r of results) {
        if (r.role === 'TITLE') continue
        const msg = r.conversation.messages.find((m) => m.content === r.content)
        if (msg) {
          hits.add(msg.nodeId)
          buildPaths(r.conversation, msg.turnIndex, msg.versionIndex, msg.subTurnIndex, paths)
        }
      }
      searchHits.value = hits
      autoExpandPaths.value = Array.from(paths)
    }
  } finally {
    loading.value = false
  }
}

function onModelChange(val: string | number | null | Array<string | number>) {
  const m = (Array.isArray(val) ? val[0] : val) as SearchModel | undefined
  if (!m || m === 'cloud_v2') return
  if (m === 'cloud_v1' && !auth.cloudSyncEnabled) {
    message.warning('请先在个人中心开启云端存储开关')
    searchModelStore.setModel('local_v1')
    return
  }
  searchModelStore.setModel(m)
}

function onModeChange(m: 'timeline' | 'search') {
  if (m === 'search' && !query.value.trim()) {
    mode.value = 'timeline'
    message.info('请输入搜索词后再切换到搜索模式')
    return
  }
  mode.value = m
}

function onSelectSubturn(payload: {
  conv: ParsedConversation
  turnIndex: number | null
  versionIndex: number | null
  subTurnIndex: number | null
}) {
  const conv = payload.conv
  activeConv.value = conv
  if (conv.configId && conv.messages.length === 0) {
    detailLoading.value = true
    loadConversationDetail(conv.configId, conv.deepseekConvId)
      .then(({ messages, turns }) => {
        conv.messages = messages
        conv.turns = turns
        const idx = conversations.value.findIndex((c) => c.deepseekConvId === conv.deepseekConvId)
        if (idx >= 0) {
          const updated = { ...conv, messages, turns }
          conversations.value = [...conversations.value.slice(0, idx), updated, ...conversations.value.slice(idx + 1)]
          activeConv.value = updated
        }
      })
      .catch((e) => console.warn('Failed to load conversation detail:', e))
      .finally(() => { detailLoading.value = false })
  }
}

async function init() {
  loading.value = true
  loadTime.value = null
  const t0 = performance.now()
  try {
    if (auth.cloudSyncEnabled) {
      loadProgress.value = '正在获取配置列表…'
      const { configs } = (await request.get('/configs')) as any
      cloudConfigStates.value = configs.map((c: any) => ({
        id: c.id, name: c.name, page: 0, hasMore: true,
      }))
      const all: ParsedConversation[] = []
      for (let i = 0; i < configs.length; i++) {
        const cfg = configs[i]
        loadProgress.value = `正在加载配置 ${i + 1}/${configs.length}: ${cfg.name}…`
        try {
          const page = await loadConversationsPage({
            cloudSync: true, configId: cfg.id, page: 1,
            pageSize: EXPLORE_PAGE_SIZE, withMessages: false,
          })
          all.push(...page.conversations)
          const st = cloudConfigStates.value.find((s) => s.id === cfg.id)
          if (st) { st.page = 1; st.hasMore = page.hasMore }
          conversations.value = [...all]
          if (page.total != null) totalConvs.value = (totalConvs.value ?? 0) + page.total
        } catch (e) {
          console.warn(`Failed to load config ${cfg.name}:`, e)
          loadProgress.value = `配置 ${cfg.name} 加载失败`
        }
      }
      hasMore.value = cloudConfigStates.value.some((s) => s.hasMore)
    } else {
      loadProgress.value = '正在加载本地会话数据…'
      conversations.value = await loadAllConversations(false, (msg) => { loadProgress.value = msg })
      hasMore.value = false
      loadProgress.value = '正在读取本地配置…'
      const configs = await getLocalConfigs()
      if (configs.length > 0 && configs[0]) {
        localUserId.value = configs[0].deepseekUserId
        loadProgress.value = '正在预构建搜索索引…'
        void preloadIndex(localUserId.value, conversations.value).catch(() => {})
      }
    }
    loadProgress.value = '正在加载 API Key 列表…'
    try {
      const { apiKeys: keys } = (await request.get('/apikeys')) as any
      apiKeys.value = keys
    } catch {}
    loadTime.value = Math.round(performance.now() - t0)
  } finally {
    loading.value = false
    loadProgress.value = ''
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  if (!auth.cloudSyncEnabled) return
  loadingMore.value = true
  try {
    const toLoad = cloudConfigStates.value.filter((s) => s.hasMore)
    const more: ParsedConversation[] = []
    for (const s of toLoad) {
      const nextPage = s.page + 1
      const page = await loadConversationsPage({
        cloudSync: true, configId: s.id, page: nextPage,
        pageSize: EXPLORE_PAGE_SIZE, withMessages: false,
      })
      more.push(...page.conversations)
      s.page = nextPage
      s.hasMore = page.hasMore
    }
    if (more.length > 0) conversations.value = [...conversations.value, ...more]
    hasMore.value = cloudConfigStates.value.some((s) => s.hasMore)
  } catch (e) {
    console.warn('Failed to load more conversations:', e)
    message.error('加载更多失败，请重试')
  } finally {
    loadingMore.value = false
  }
}

onMounted(() => {
  searchModelStore.syncFromAuth()
  void init()
})
</script>

<template>
  <div class="explore-root">
    <!-- ========== 顶部：标题 + 加载/统计 ========== -->
    <div class="explore-header">
      <div class="explore-title-block">
        <div class="page-eyebrow">
          <NIcon size="12"><SearchOutline /></NIcon>
          <span>EXPLORER</span>
        </div>
        <div class="explore-title-row">
          <h2 class="explore-title">对话探索</h2>
          <NTag
            v-if="totalConvs != null || conversations.length > 0"
            size="small"
            type="primary"
            round
          >
            {{ conversations.length }}<span v-if="totalConvs != null"> / {{ totalConvs }}</span> 个会话
          </NTag>
        </div>
      </div>

      <div class="explore-stats">
        <div v-if="loading" class="status-chip status-chip-loading">
          <NSpin :size="14" />
          <span>{{ loadProgress || '加载中…' }}</span>
        </div>
        <div v-else-if="loadTime !== null" class="status-chip status-chip-ok">
          <NIcon size="14" style="color: var(--success);"><SearchCircleOutline /></NIcon>
          <span>就绪 · 耗时 {{ (loadTime / 1000).toFixed(2) }}s</span>
        </div>
      </div>
    </div>

    <!-- ========== 搜索控制栏：搜索框 + 模式切换 ========== -->
    <div class="search-panel surface">
      <div class="search-row">
        <div class="search-input-wrap">
          <div class="search-input-icon">
            <NIcon size="18"><SearchOutline /></NIcon>
          </div>
          <NInput
            :value="query"
            placeholder="输入关键词搜索对话内容…（支持正则表达式）"
            clearable
            class="search-input"
            @update:value="onQueryInput"
            @keyup.enter="debounceTimer = null; doSearch()"
          />
          <div class="search-regex-toggle">
            <span class="regex-label">正则</span>
            <NSwitch v-model:value="useRegex" size="small" />
          </div>
        </div>
        <NButton type="primary" size="medium" :loading="loading" @click="doSearch">
          <template #icon><NIcon size="16"><SearchOutline /></NIcon></template>
          搜索
        </NButton>
      </div>

      <div class="search-options">
        <!-- 搜索模型 -->
        <div class="opt-group">
          <label class="opt-label">搜索模型</label>
          <NRadioGroup
            :value="searchModelStore.model"
            size="small"
            @update:value="onModelChange"
          >
            <NRadio value="local_v1" size="small">本地 v1</NRadio>
            <NRadio value="cloud_v1" size="small">云端 v1</NRadio>
            <NRadio :value="'cloud_v2'" :disabled="true" size="small">云端 v2</NRadio>
          </NRadioGroup>
        </div>

        <!-- 模式切换 -->
        <div class="opt-group opt-mode">
          <NRadioGroup
            :value="mode"
            size="small"
            @update:value="(v: string | number) => onModeChange(v as 'timeline' | 'search')"
          >
            <NRadioButton value="timeline">
              <NIcon size="14" style="margin-right: 4px;"><TimeOutline /></NIcon>
              时间线
            </NRadioButton>
            <NRadioButton value="search">
              <NIcon size="14" style="margin-right: 4px;"><SearchCircleOutline /></NIcon>
              搜索结果
            </NRadioButton>
          </NRadioGroup>
        </div>

        <!-- 数据源标签 -->
        <div class="opt-group opt-datasource">
          <span
            :class="['source-pill', auth.cloudSyncEnabled ? 'source-cloud' : 'source-local']"
          >
            <NIcon size="12">
              <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
            </NIcon>
            {{ auth.cloudSyncEnabled ? '云端数据源' : '本地 IndexedDB' }}
          </span>
        </div>
      </div>

      <!-- 搜索范围筛选 -->
      <div class="filter-row">
        <div class="filter-label">
          <NIcon size="14"><FilterOutline /></NIcon>
          <span>搜索范围</span>
        </div>
        <NSpace align="center" :size="16">
          <label class="filter-chip">
            <NCheckbox v-model:checked="searchFilters.title" />
            <span>标题</span>
          </label>
          <label class="filter-chip">
            <NCheckbox v-model:checked="searchFilters.user" />
            <span>用户消息</span>
          </label>
          <label class="filter-chip">
            <NCheckbox v-model:checked="searchFilters.assistant" />
            <span>AI 回复</span>
          </label>
        </NSpace>
      </div>
    </div>

    <!-- ========== 主分栏：树 + 对话 ========== -->
    <div class="explore-split">
      <!-- 左侧：树面板 -->
      <div class="explore-tree surface">
        <div class="tree-header">
          <div class="tree-header-title">
            {{ mode === 'timeline' ? '全部会话' : `命中会话 (${totalCount})` }}
          </div>
          <NText depth="3" style="font-size: 12px;">
            共 {{ conversations.length }}<span v-if="totalConvs != null"> / 云端 {{ totalConvs }}</span> 条
          </NText>
        </div>
        <div class="tree-body">
          <NSpin :show="loading" style="height: 100%;">
            <TurnTree
              :conversations="pagedTreeConversations"
              :search-hits="searchHits"
              :auto-expand-paths="autoExpandPaths"
              @select-subturn="onSelectSubturn"
            />
          </NSpin>
        </div>
        <div class="tree-footer">
          <div class="pager-info">
            第 {{ currentPage }} / {{ pageCount }} 页
          </div>
          <NPagination
            :page="currentPage"
            :page-size="pageSize"
            :item-count="totalCount"
            :page-count="pageCount"
            :page-sizes="[20, 50, 100, 200]"
            show-size-picker
            :disabled="loading"
            size="small"
            @update:page="onPageChange"
            @update:page-size="(s: number) => { pageSize = s; currentPage = 1 }"
          />
          <NButton
            v-if="hasMore"
            size="tiny"
            type="primary"
            ghost
            :loading="loadingMore"
            @click="loadMore"
          >加载更多</NButton>
        </div>
      </div>

      <!-- 右侧：ChatViewer -->
      <div class="explore-chat">
        <div v-if="detailLoading" class="detail-loading surface">
          <NSpin size="large" />
          <NText depth="3" style="margin-top: 16px; font-size: 13px;">正在加载会话详情…</NText>
        </div>
        <ChatViewer v-else :conversation="activeConv" :api-keys="apiKeys" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.explore-root {
  display: flex;
  flex-direction: column;
  gap: 20px;
  min-height: 100%;
}

/* ========== 顶部标题 ========== */
.explore-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px;
}
.explore-title-block {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.page-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--primary);
}
.explore-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.explore-title {
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.01em;
  margin: 0;
}

/* 状态 chip */
.explore-stats { display: flex; align-items: center; gap: 8px; }
.status-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: var(--radius-full);
  font-size: 12.5px;
  font-weight: 500;
}
.status-chip-loading {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}
.status-chip-ok {
  background: var(--success-soft);
  color: var(--success);
}

/* ========== 搜索面板 ========== */
.search-panel {
  padding: 18px 20px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.search-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.search-input-wrap {
  flex: 1;
  position: relative;
  display: flex;
  align-items: center;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 0 12px 0 0;
  transition: all var(--transition-fast);
}
.search-input-wrap:focus-within {
  border-color: var(--primary);
  background: var(--surface);
  box-shadow: var(--shadow-focus);
}
.search-input-icon {
  padding: 0 12px;
  color: var(--text-muted);
  display: flex;
  align-items: center;
}
.search-input {
  flex: 1;
  background: transparent !important;
}
.search-input :deep(.n-input__input-el) {
  background: transparent !important;
  height: 42px;
}
.search-input :deep(.n-input__border),
.search-input :deep(.n-input__state-border) {
  display: none;
}
.search-regex-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  padding-left: 12px;
  margin-left: 8px;
  border-left: 1px solid var(--border);
  height: 24px;
}
.regex-label {
  font-size: 12px;
  color: var(--text-secondary);
  font-weight: 500;
}

/* 搜索选项 */
.search-options {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-wrap: wrap;
}
.opt-group {
  display: flex;
  align-items: center;
  gap: 10px;
}
.opt-label {
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}
.opt-mode { margin-left: auto; }
.opt-datasource { margin-left: auto; }

.source-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 12px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
}
.source-cloud {
  background: var(--success-soft);
  color: var(--success);
}
.source-local {
  background: var(--bg-2);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

/* 搜索范围 */
.filter-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}
.filter-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
}
.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 6px;
  transition: all var(--transition-fast);
}
.filter-chip:hover {
  background: var(--bg-2);
  color: var(--text);
}

/* ========== 分栏主体 ========== */
.explore-split {
  display: flex;
  gap: 20px;
  min-height: 0;
  flex: 1;
}

/* 左侧树面板 */
.explore-tree {
  flex: 0 0 38%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 0;
}
.tree-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid var(--border-subtle);
}
.tree-header-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.tree-body {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 10px;
}
.tree-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  border-top: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}
.pager-info {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
}
.tree-footer :deep(.n-pagination) {
  flex: 1;
  justify-content: center;
}

/* 右侧 ChatViewer 直接嵌入 */
.explore-chat {
  flex: 1;
  min-width: 0;
  display: flex;
}
.detail-loading {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

@media (max-width: 1080px) {
  .explore-tree { flex: 0 0 45%; }
}
@media (max-width: 820px) {
  .explore-split {
    flex-direction: column;
  }
  .explore-tree {
    flex: none;
    max-height: 52vh;
  }
  .explore-chat {
    min-height: 60vh;
  }
  .opt-mode, .opt-datasource { margin-left: 0; }
}
</style>
