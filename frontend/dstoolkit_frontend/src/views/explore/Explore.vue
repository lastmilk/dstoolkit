<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import {
  NSpace,
  NInput,
  NSwitch,
  NText,
  NTag,
  NSpin,
  NButton,
  NCheckbox,
  NRadioGroup,
  NRadio,
  NRadioButton,
  NPagination,
} from 'naive-ui'
import dayjs from 'dayjs'
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
  type SearchResult,
} from '@/utils/db'
import { request } from '@/utils/request'
import { message } from '@/utils/naive'
import TurnTree from '@/components/TurnTree.vue'
import ChatViewer from '@/components/ChatViewer.vue'
import type { ParsedConversation } from '@/types'

const auth = useAuthStore()
const searchModelStore = useSearchModelStore()

const loading = ref(false)
const loadProgress = ref('')  // 当前加载步骤描述
const loadTime = ref<number | null>(null)  // 上次加载耗时（毫秒）
const conversations = ref<ParsedConversation[]>([])
const query = ref('')
const useRegex = ref(false)
const searchHits = ref<Set<string>>(new Set())
const searchConvIds = ref<Set<string>>(new Set())  // 云端搜索命中的会话 ID
const autoExpandPaths = ref<string[]>([])
const mode = ref<'timeline' | 'search'>('timeline')

const activeConv = ref<ParsedConversation | null>(null)
const apiKeys = ref<Array<{ id: number; name: string }>>([])

// 搜索范围筛选
const searchFilters = ref<SearchFilters>({ user: true, assistant: true, title: true })

const localUserId = ref<string | undefined>(undefined)
const detailLoading = ref(false)  // 按需加载会话详情时的 loading 状态

// 分页加载状态（云端模式按配置分页；本地模式全量加载以保留 FlexSearch 全文检索）
const EXPLORE_PAGE_SIZE = 50
const hasMore = ref(false)
const loadingMore = ref(false)
const totalConvs = ref<number | undefined>(undefined)
const cloudConfigStates = ref<Array<{ id: number; name: string; page: number; hasMore: boolean }>>([])

// In search mode, only show conversations that contain hits.
const treeConversations = computed<ParsedConversation[]>(() => {
  if (mode.value === 'timeline') return conversations.value
  const hits = searchHits.value
  const convIds = searchConvIds.value
  if (hits.size === 0 && convIds.size === 0) return []
  // 云端 lite 模式下 messages 为空，用 convIds 过滤；本地模式用 nodeId 匹配
  return conversations.value.filter((c) =>
    convIds.has(c.deepseekConvId) || c.messages.some((m) => hits.has(m.nodeId)),
  )
})

// 真正的分页：1 2 3 4 5 ... 页码导航
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

// 列表变化（搜索/筛选/加载更多）时回到第一页，避免越界空页
watch([treeConversations, pageSize], () => {
  if (currentPage.value > pageCount.value) currentPage.value = 1
  else if (currentPage.value !== 1 && treeConversations.value.length === 0) {
    currentPage.value = 1
  }
})

async function onPageChange(p: number) {
  currentPage.value = p
  // 云端模式：翻到最后一页且云端仍有未加载数据时，自动拉取下一批
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
    // 云端模式：conversations 为 lite 加载（messages 为空），本地搜索无法工作，
    // 必须走后端 /api/search（SQL LIKE fallback 或 Meilisearch）。
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
      // 本地模式：确保索引已就绪（处理与后台预加载的竞态：用户在预加载完成前搜索）
      searchConvIds.value = new Set()
      if (localUserId.value && !isIndexReady(localUserId.value)) {
        await preloadIndex(localUserId.value, conversations.value)
      }
      // 优先使用 FlexSearch 索引（<100ms）；无索引时回退到 includes 扫描
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
  // 云端 lite 模式：messages 为空时按需从服务器加载
  if (conv.configId && conv.messages.length === 0) {
    detailLoading.value = true
    loadConversationDetail(conv.configId, conv.deepseekConvId)
      .then(({ messages, turns }) => {
        conv.messages = messages
        conv.turns = turns
        // 触发响应式更新：替换数组中的对象
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
      // 云端：分片分页加载。先取配置列表，再逐个配置加载第一页（lite，不含 messages），
      // 首屏秒级显示；点击会话时按需 loadConversationDetail 加载 messages。
      loadProgress.value = '正在获取配置列表…'
      const { configs } = (await request.get('/configs')) as any
      cloudConfigStates.value = configs.map((c: any) => ({
        id: c.id,
        name: c.name,
        page: 0,
        hasMore: true,
      }))
      const all: ParsedConversation[] = []
      for (let i = 0; i < configs.length; i++) {
        const cfg = configs[i]
        loadProgress.value = `正在加载配置 ${i + 1}/${configs.length}: ${cfg.name}…`
        try {
          const page = await loadConversationsPage({
            cloudSync: true,
            configId: cfg.id,
            page: 1,
            pageSize: EXPLORE_PAGE_SIZE,
            withMessages: false,
          })
          all.push(...page.conversations)
          const st = cloudConfigStates.value.find((s) => s.id === cfg.id)
          if (st) { st.page = 1; st.hasMore = page.hasMore }
          conversations.value = [...all] // 增量显示：每个配置首页加载完即刷新
          if (page.total != null) {
            totalConvs.value = (totalConvs.value ?? 0) + page.total
          }
        } catch (e) {
          console.warn(`Failed to load config ${cfg.name}:`, e)
          loadProgress.value = `配置 ${cfg.name} 加载失败`
        }
      }
      hasMore.value = cloudConfigStates.value.some((s) => s.hasMore)
    } else {
      // 本地：全量加载（FlexSearch 全文检索需完整语料；本地磁盘读取快）
      loadProgress.value = '正在加载本地会话数据…'
      conversations.value = await loadAllConversations(false, (msg) => { loadProgress.value = msg })
      hasMore.value = false
      loadProgress.value = '正在读取本地配置…'
      const configs = await getLocalConfigs()
      if (configs.length > 0 && configs[0]) {
        localUserId.value = configs[0].deepseekUserId
        loadProgress.value = '正在预构建搜索索引…'
        // 后台预加载 FlexSearch 索引（非阻塞）：首屏只等 loadAllConversations，
        // 索引在后台加载/构建，用户实际搜索时通常已就绪
        void preloadIndex(localUserId.value, conversations.value).catch(() => {
          /* 索引预加载失败不阻断；搜索时会重试 */
        })
      }
    }
    // 加载用户 API Key 列表（供 ChatViewer 续聊使用）
    loadProgress.value = '正在加载 API Key 列表…'
    try {
      const { apiKeys: keys } = (await request.get('/apikeys')) as any
      apiKeys.value = keys
    } catch {
      /* API Key 加载失败不阻断 */
    }
    loadTime.value = Math.round(performance.now() - t0)
  } finally {
    loading.value = false
    loadProgress.value = ''
  }
}

/** 云端分页：为每个仍有未加载页的配置加载下一页，追加到树。 */
async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  if (!auth.cloudSyncEnabled) return // 本地已全量加载
  loadingMore.value = true
  try {
    const toLoad = cloudConfigStates.value.filter((s) => s.hasMore)
    const more: ParsedConversation[] = []
    for (const s of toLoad) {
      const nextPage = s.page + 1
      const page = await loadConversationsPage({
        cloudSync: true,
        configId: s.id,
        page: nextPage,
        pageSize: EXPLORE_PAGE_SIZE,
        withMessages: false,
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
    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
      <h2 style="margin: 0;">探索</h2>
      <NSpace v-if="loading" align="center" :size="8">
        <NSpin :size="16" />
        <NText depth="3" style="font-size: 13px;">{{ loadProgress || '加载中…' }}</NText>
      </NSpace>
      <NText v-else-if="loadTime !== null" depth="3" style="font-size: 13px;">
        加载完成，耗时 {{ (loadTime / 1000).toFixed(2) }}s · 已加载 {{ conversations.length }} 个会话<span v-if="totalConvs != null"> / 共 {{ totalConvs }}</span>
      </NText>
    </div>

    <div
      class="neu-inset"
      style="margin-bottom: 12px; display: flex; gap: 12px; align-items: center; flex-wrap: wrap;"
    >
      <NInput
        :value="query"
        placeholder="搜索对话内容…（开启正则后按正则表达式匹配）"
        clearable
        style="flex: 1; min-width: 260px;"
        @update:value="onQueryInput"
        @keyup.enter="debounceTimer = null; doSearch()"
      />
      <NSpace align="center" :size="6">
        <NText depth="3" style="font-size: 13px;">正则</NText>
        <NSwitch v-model:value="useRegex" size="small" />
      </NSpace>
      <NButton type="primary" @click="doSearch">搜索</NButton>
    </div>

    <NSpace align="center" :size="16" style="margin-bottom: 12px; flex-wrap: wrap;">
      <NSpace align="center" :size="8">
        <NText depth="3" style="font-size: 13px;">搜索模型</NText>
        <NRadioGroup
          :value="searchModelStore.model"
          size="small"
          @update:value="onModelChange"
        >
          <NRadio value="local_v1" size="small">local v1（免费 · 不上传数据）</NRadio>
          <NRadio value="cloud_v1" size="small">cloud v1（Meilisearch 混合 · 有限流）</NRadio>
          <NRadio :value="'cloud_v2'" :disabled="true" size="small">
            cloud v2（即将推出 · Elasticsearch）
          </NRadio>
        </NRadioGroup>
      </NSpace>
      <NSpace align="center" :size="8">
        <NText depth="3" style="font-size: 13px;">模式</NText>
        <NRadioGroup
          :value="mode"
          size="small"
          @update:value="(v: string | number) => onModeChange(v as 'timeline' | 'search')"
        >
          <NRadioButton value="timeline">时间线</NRadioButton>
          <NRadioButton value="search">搜索</NRadioButton>
        </NRadioGroup>
      </NSpace>
      <NTag size="small" :type="auth.cloudSyncEnabled ? 'success' : 'default'">
        {{ auth.cloudSyncEnabled ? '数据源：云端' : '数据源：本地 IndexedDB' }}
      </NTag>
    </NSpace>

    <!-- 搜索范围筛选 -->
    <NSpace align="center" :size="16" style="margin-bottom: 12px;">
      <NText depth="3" style="font-size: 13px;">搜索范围</NText>
      <NCheckbox v-model:checked="searchFilters.user">用户消息</NCheckbox>
      <NCheckbox v-model:checked="searchFilters.assistant">AI 回复</NCheckbox>
      <NCheckbox v-model:checked="searchFilters.title">标题</NCheckbox>
    </NSpace>

    <!-- 左右分栏：树 + 对话查看器 -->
    <div class="explore-split">
      <div class="explore-tree">
        <NSpin :show="loading">
          <TurnTree
            :conversations="pagedTreeConversations"
            :search-hits="searchHits"
            :auto-expand-paths="autoExpandPaths"
            @select-subturn="onSelectSubturn"
          />
        </NSpin>
        <div class="pager-bar">
          <NPagination
            :page="currentPage"
            :page-size="pageSize"
            :item-count="totalCount"
            :page-count="pageCount"
            :page-sizes="[20, 50, 100, 200]"
            show-size-picker
            show-quick-jumper
            :disabled="loading"
            @update:page="onPageChange"
            @update:page-size="(s: number) => { pageSize = s; currentPage = 1 }"
          />
          <NText depth="3" style="font-size: 12px; white-space: nowrap;">
            已加载 {{ conversations.length }}<span v-if="totalConvs != null"> / 云端共 {{ totalConvs }}</span> 个会话
          </NText>
          <NButton
            v-if="hasMore"
            size="tiny"
            type="primary"
            ghost
            :loading="loadingMore"
            @click="loadMore"
          >从云端加载更多</NButton>
        </div>
      </div>
      <div class="explore-chat">
        <div v-if="detailLoading" class="detail-loading">
          <NSpin size="medium" />
          <NText depth="3" style="margin-top: 8px;">正在加载会话消息…</NText>
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
  height: 100%;
}
.detail-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
}
.explore-split {
  display: flex;
  gap: 16px;
  flex: 1;
  min-height: 0;
}
.explore-tree {
  flex: 0 0 40%;
  overflow: auto;
}
.pager-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 8px 4px;
  flex-wrap: wrap;
}
.pager-bar :deep(.n-pagination) {
  flex: 1;
}
.explore-chat {
  flex: 1;
  min-width: 0;
}
@media (max-width: 768px) {
  .explore-split {
    flex-direction: column;
  }
  .explore-tree,
  .explore-chat {
    flex: 1;
  }
}
</style>
