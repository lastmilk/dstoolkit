<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
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
  RocketOutline,
  SparklesOutline,
  ChevronBackOutline,
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

// 响应式：是否移动端（用于精简分页等组件）
const isMobile = ref(false)
function checkViewport() {
  isMobile.value = window.innerWidth < 820
}

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

// 移动端：是否进入对话详情视图（列表/详情二选一）
const showDetail = ref(false)

watch(isMobile, (mobile) => {
  if (!mobile) showDetail.value = false
})

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
  if (isMobile.value) showDetail.value = true
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
  checkViewport()
  window.addEventListener('resize', checkViewport)
  searchModelStore.syncFromAuth()
  void init()
})

onUnmounted(() => {
  window.removeEventListener('resize', checkViewport)
})
</script>

<template>
  <div class="explore-root page-enter">
    <!-- ========== 头部横幅 ========== -->
    <div class="chronos-page-banner">
      <div class="banner-glow-1"></div>
      <div class="banner-glow-2"></div>
      <div class="banner-inner">
        <div class="banner-title-block">
          <div class="chronos-eyebrow">
            <NIcon size="12"><RocketOutline /></NIcon>
            <span>EXPLORER // 对话浏览</span>
          </div>
          <h1 class="chronos-page-title">
            对话探索
            <span class="title-accent">· 智能搜索</span>
          </h1>
          <p class="chronos-page-sub">
            支持全文搜索、多条件筛选、快速定位历史对话并继续与模型交流
          </p>
        </div>
        <div class="banner-stats">
          <div class="stat-chip">
            <div class="stat-dot"></div>
            <div class="stat-text">
              <div class="stat-num">{{ conversations.length }}</div>
              <div class="stat-label">已索引对话</div>
            </div>
          </div>
          <div class="stat-chip accent">
            <div class="stat-dot accent"></div>
            <div class="stat-text">
              <div class="stat-num">{{ mode === 'search' ? totalCount : '—' }}</div>
              <div class="stat-label">{{ mode === 'search' ? '搜索结果' : auth.cloudSyncEnabled ? '云端模式' : '本地模式' }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ========== 顶部：加载/统计状态 ========== -->
    <div class="explore-status-bar">
      <div v-if="loading" class="status-chip status-chip-loading">
        <NSpin :size="14" />
        <span>{{ loadProgress || '加载中…' }}</span>
      </div>
      <div v-else-if="loadTime !== null" class="status-chip status-chip-ok">
        <NIcon size="14" style="color: var(--success);"><SparklesOutline /></NIcon>
        <span>就绪 · 加载耗时 {{ (loadTime / 1000).toFixed(2) }}s</span>
      </div>
      <div class="flex-spacer"></div>
      <NTag
        v-if="totalConvs != null || conversations.length > 0"
        class="chronos-tag"
        round
        size="small"
      >
        <NIcon size="11" style="margin-right: 4px;"><TimeOutline /></NIcon>
        {{ conversations.length }}<span v-if="totalConvs != null"> / {{ totalConvs }}</span> 个对话 · 搜索服务就绪
      </NTag>
    </div>

    <!-- ========== 搜索控制栏 ========== -->
    <div v-show="!isMobile || !showDetail" class="chronos-panel search-panel">
      <div class="panel-corner tl"></div>
      <div class="panel-corner tr"></div>
      <div class="panel-corner bl"></div>
      <div class="panel-corner br"></div>

      <div class="search-row">
        <div class="search-input-wrap">
          <div class="search-input-icon">
            <NIcon size="18"><SearchOutline /></NIcon>
          </div>
          <NInput
            :value="query"
            placeholder="输入关键词，搜索历史对话内容…（支持正则表达式）"
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
        <NButton type="tertiary" size="medium" :loading="loading" @click="doSearch">
          <template #icon><NIcon size="16"><SearchOutline /></NIcon></template>
          搜索
        </NButton>
      </div>

      <div class="search-options">
        <div class="opt-group">
          <label class="opt-label">搜索模式</label>
          <NRadioGroup
            :value="searchModelStore.model"
            size="small"
            @update:value="onModelChange"
          >
            <NRadio value="local_v1" size="small">本地 v1</NRadio>
            <NRadio value="cloud_v1" size="small">云端 v1</NRadio>
            <NRadio :value="'cloud_v2'" :disabled="true" size="small">云端 v2 ⏳</NRadio>
          </NRadioGroup>
        </div>

        <div class="opt-group opt-mode">
          <NRadioGroup
            :value="mode"
            size="small"
            @update:value="(v: string | number) => onModeChange(v as 'timeline' | 'search')"
          >
            <NRadioButton value="timeline">
              <NIcon size="14" style="margin-right: 4px;"><TimeOutline /></NIcon>
              全部对话
            </NRadioButton>
            <NRadioButton value="search">
              <NIcon size="14" style="margin-right: 4px;"><SearchCircleOutline /></NIcon>
              搜索结果
            </NRadioButton>
          </NRadioGroup>
        </div>

        <div class="opt-group opt-datasource">
          <span
            :class="['source-pill', auth.cloudSyncEnabled ? 'source-cloud' : 'source-local']"
          >
            <NIcon size="12">
              <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
            </NIcon>
            {{ auth.cloudSyncEnabled ? '云端模式' : '本地模式' }}
          </span>
        </div>
      </div>

      <div class="filter-row">
        <div class="filter-label">
          <NIcon size="14"><FilterOutline /></NIcon>
          <span>筛选范围</span>
        </div>
        <NSpace align="center" :size="12" wrap>
          <label class="filter-chip chronos-filter">
            <NCheckbox v-model:checked="searchFilters.title" />
            <span>会话标题</span>
          </label>
          <label class="filter-chip chronos-filter">
            <NCheckbox v-model:checked="searchFilters.user" />
            <span>用户消息</span>
          </label>
          <label class="filter-chip chronos-filter">
            <NCheckbox v-model:checked="searchFilters.assistant" />
            <span>模型回复</span>
          </label>
        </NSpace>
      </div>
    </div>

    <!-- ========== 主分栏：树 + 对话 ========== -->
    <div class="explore-split">
      <!-- 左侧：树面板 -->
      <div v-show="!isMobile || !showDetail" class="chronos-panel explore-tree">
        <div class="panel-corner tl"></div>
        <div class="panel-corner tr"></div>
        <div class="panel-corner bl"></div>
        <div class="panel-corner br"></div>
        <div class="tree-header">
          <div class="tree-header-title">
            <span class="hud-pulse"></span>
            {{ mode === 'timeline' ? '全部对话' : `搜索结果 (${totalCount})` }}
          </div>
          <NText depth="3" style="font-size: 12px;">
            {{ conversations.length }}<span v-if="totalConvs != null"> / 云端 {{ totalConvs }}</span> 条
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
            <NIcon size="12" style="color: var(--primary);"><TimeOutline /></NIcon>
            第 {{ currentPage }} / {{ pageCount }} 页
          </div>
          <NPagination
            :page="currentPage"
            :page-size="pageSize"
            :item-count="totalCount"
            :page-count="pageCount"
            :page-sizes="[20, 50, 100, 200]"
            :show-size-picker="!isMobile"
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
          >
            <template #icon v-if="!loadingMore">
              <NIcon size="13"><ChevronDownOutline /></NIcon>
            </template>
            加载更多
          </NButton>
        </div>
      </div>

      <!-- 右侧：ChatViewer -->
      <div
        v-show="!isMobile || showDetail"
        class="explore-chat"
        :class="{ 'mobile-detail-chat': isMobile && showDetail }"
      >
        <!-- 移动端详情返回栏 -->
        <div v-if="isMobile && showDetail" class="mobile-detail-bar">
          <button class="detail-back-btn" type="button" @click="showDetail = false">
            <NIcon size="18"><ChevronBackOutline /></NIcon>
            <span>返回列表</span>
          </button>
          <div class="detail-bar-title">{{ activeConv?.title || '对话详情' }}</div>
        </div>
        <div v-if="detailLoading" class="chronos-panel detail-loading">
          <div class="panel-corner tl"></div>
          <div class="panel-corner tr"></div>
          <div class="panel-corner bl"></div>
          <div class="panel-corner br"></div>
          <div class="chronos-loader">
            <div class="loader-ring"></div>
            <div class="loader-ring delay"></div>
          </div>
          <NText depth="3" style="margin-top: 20px; font-size: 13px; color: var(--text-secondary);">
            正在加载对话详情…
          </NText>
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
  gap: 18px;
  min-height: 100%;
}

/* ========== 横幅 ========== */
.chronos-page-banner {
  position: relative;
  padding: 22px 24px;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 50%, rgba(255, 90, 140, 0.04) 100%),
    linear-gradient(180deg, var(--surface) 0%, var(--surface-2) 100%);
  border: 1px solid var(--border);
  overflow: hidden;
  box-shadow: var(--shadow-xs);
}
.banner-glow-1, .banner-glow-2 {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(60px);
  opacity: 0.35;
}
.banner-glow-1 {
  width: 260px; height: 260px;
  top: -120px; right: -80px;
  background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
}
.banner-glow-2 {
  width: 200px; height: 200px;
  bottom: -100px; left: 20%;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
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
  color: var(--primary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  padding: 4px 10px;
  background: var(--primary-soft);
  border-radius: 4px;
  border: 1px solid var(--border-glow);
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
  color: var(--accent);
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
.banner-stats {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
.stat-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 16px;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}
.stat-chip.accent {
  border-color: var(--border-glow);
  background: linear-gradient(135deg, var(--primary-soft), var(--accent-soft));
}
.stat-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 8px rgba(79, 70, 229, 0.4);
}
.stat-dot.accent {
  background: var(--accent);
  box-shadow: 0 0 8px rgba(14, 165, 233, 0.4);
}
.stat-num {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  line-height: 1;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.stat-label {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 3px;
}

/* ========== 状态栏 ========== */
.explore-status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}
.flex-spacer { flex: 1; }
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
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.chronos-tag {
  background: var(--primary-soft) !important;
  border: 1px solid var(--border-glow) !important;
  color: var(--primary) !important;
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
  flex-wrap: wrap;
}
.search-input-wrap {
  flex: 1;
  min-width: 240px;
  position: relative;
  display: flex;
  align-items: center;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 0 12px 0 0;
  transition: all var(--transition);
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
  color: var(--text) !important;
}
.search-input :deep(.n-input__border),
.search-input :deep(.n-input__state-border) {
  display: none;
}
.search-input :deep(.n-input__placeholder) {
  color: var(--text-muted) !important;
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

.search-options {
  display: flex;
  align-items: center;
  gap: 18px;
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
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  letter-spacing: 0.03em;
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
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.source-local {
  background: var(--surface-2);
  border: 1px solid var(--border);
  color: var(--text-secondary);
}

.filter-row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 10px 14px;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  flex-wrap: wrap;
}
.filter-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-secondary);
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
  letter-spacing: 0.03em;
}
.chronos-filter {
  padding: 4px 10px;
  border-radius: 6px;
  transition: all var(--transition-fast);
  border: 1px solid transparent;
}
.chronos-filter:hover {
  background: var(--primary-soft);
  border-color: var(--border-glow);
  color: var(--text);
}

/* ========== 分栏主体 ========== */
.explore-split {
  display: flex;
  gap: 18px;
  min-height: 0;
  flex: 1;
}

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
  display: flex;
  align-items: center;
  gap: 8px;
}
.hud-pulse {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 8px rgba(79, 70, 229, 0.4);
  animation: pulse 2s ease-in-out infinite;
}
@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.85); }
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
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
}
.tree-footer :deep(.n-pagination) {
  flex: 1;
  justify-content: center;
}

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
  min-height: 300px;
}
.chronos-loader {
  position: relative;
  width: 56px;
  height: 56px;
}
.loader-ring {
  position: absolute;
  inset: 0;
  border: 2px solid transparent;
  border-top-color: var(--primary);
  border-right-color: var(--primary);
  border-radius: 50%;
  animation: spin 1s linear infinite;
}
.loader-ring.delay {
  inset: 10px;
  border-top-color: var(--accent);
  border-right-color: var(--accent);
  animation-duration: 1.5s;
  animation-direction: reverse;
}
@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ========== 响应式 ========== */
@media (max-width: 1080px) {
  .explore-tree { flex: 0 0 45%; }
}

/* 中等屏：分栏改纵向，平衡树与对话高度 */
@media (max-width: 820px) {
  /* —— 横幅精简 —— */
  .chronos-page-banner {
    padding: 16px 14px;
  }
  .chronos-page-title {
    font-size: 19px;
  }
  .banner-inner {
    flex-direction: column;
    align-items: flex-start;
    gap: 14px;
  }
  .banner-stats {
    width: 100%;
  }
  .stat-chip {
    flex: 1;
    justify-content: center;
    padding: 8px 12px;
  }
  .stat-num { font-size: 17px; }

  /* —— 状态栏换行 —— */
  .explore-status-bar {
    flex-wrap: wrap;
    gap: 8px;
  }
  .explore-status-bar .flex-spacer { display: none; }
  .explore-status-bar .chronos-tag {
    width: 100%;
  }

  /* —— 搜索面板 —— */
  .search-panel {
    padding: 14px;
    gap: 12px;
  }
  .search-row {
    gap: 8px;
    flex-wrap: nowrap;
  }
  .search-input-wrap {
    min-width: 0;
    flex: 1;
  }
  .search-regex-toggle {
    padding-left: 8px;
    margin-left: 4px;
  }

  /* 搜索选项：垂直堆叠，避免横向拥挤 */
  .search-options {
    flex-direction: column;
    align-items: flex-start;
    gap: 10px;
  }
  .opt-mode,
  .opt-datasource {
    margin-left: 0;
  }
  .opt-group {
    flex-wrap: wrap;
    gap: 8px;
  }

  /* 筛选行：标签与筹码纵向排列 */
  .filter-row {
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
    padding: 10px 12px;
  }

  /* —— 分栏改纵向，移动端列表/详情二选一填充 —— */
  .explore-split {
    flex-direction: column;
  }
  .explore-tree {
    flex: 1 1 auto;
    max-height: none;
    min-height: 260px;
  }
  .explore-chat {
    flex: 1 1 auto;
    min-height: 0;
  }

  /* —— 移动端详情返回栏 —— */
  .mobile-detail-chat {
    flex-direction: column;
  }
  .mobile-detail-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 12px;
    background: var(--surface);
    border: 1px solid var(--border-subtle);
    border-bottom: none;
    border-radius: var(--radius) var(--radius) 0 0;
    flex-shrink: 0;
  }
  .detail-back-btn {
    display: inline-flex;
    align-items: center;
    gap: 2px;
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: var(--radius-full);
    padding: 5px 14px 5px 9px;
    color: var(--text);
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    transition: all var(--transition-fast);
    flex-shrink: 0;
  }
  .detail-back-btn:hover {
    border-color: var(--primary);
    color: var(--primary);
    background: var(--primary-soft);
  }
  .detail-back-btn:active { transform: scale(0.97); }
  .detail-bar-title {
    font-size: 13px;
    color: var(--text-secondary);
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  /* —— 树底栏：信息+加载更多一行，分页独占一行 —— */
  .tree-footer {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 12px;
  }
  .tree-footer .pager-info { order: 0; }
  .tree-footer :deep(.n-button) { order: 1; }
  .tree-footer :deep(.n-pagination) {
    order: 2;
    flex: 1 1 100%;
    width: 100%;
    justify-content: center;
  }
}

/* 手机：进一步收紧 */
@media (max-width: 480px) {
  .explore-root { gap: 14px; }
  .chronos-page-banner {
    padding: 14px 12px;
  }
  .chronos-page-title {
    font-size: 17px;
  }
  .title-accent { font-size: 13px; }
  .chronos-page-sub {
    font-size: 12px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .chronos-eyebrow {
    margin-bottom: 6px;
    font-size: 9.5px;
    padding: 3px 8px;
  }
  .banner-stats { gap: 8px; }
  .stat-chip { padding: 8px 10px; gap: 8px; }
  .stat-num { font-size: 16px; }

  .search-panel { padding: 12px 10px; }
  /* 极窄屏：搜索框整行，按钮整行 */
  .search-row {
    flex-wrap: wrap;
  }
  .search-input-wrap {
    flex: 1 1 100%;
  }
  .search-row :deep(.n-button) {
    flex: 1 1 100%;
    width: 100%;
  }

  .tree-header { padding: 12px; }
  .tree-body { padding: 6px 4px; }
}

/* 超窄屏：统计卡片纵向 */
@media (max-width: 360px) {
  .banner-stats { flex-direction: column; }
  .stat-chip { flex: none; }
}
</style>
