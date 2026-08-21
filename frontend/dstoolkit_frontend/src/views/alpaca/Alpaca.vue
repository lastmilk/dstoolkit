<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  NSpace,
  NCheckboxGroup,
  NCheckbox,
  NButton,
  NSwitch,
  NText,
  NCode,
  NEmpty,
  NSpin,
  NScrollbar,
  NTag,
} from 'naive-ui'
import { useAuthStore } from '@/stores/auth'
import { loadConversationsPage } from '@/utils/db'
import { request } from '@/utils/request'
import { toAlpacaSingle, toAlpacaMulti, downloadJSON } from '@/utils/alpaca'
import type { ParsedConversation } from '@/types'

const auth = useAuthStore()
const loading = ref(false)
const convs = ref<ParsedConversation[]>([])
const selected = ref<string[]>([])
const multiTurn = ref(false)

// 分页加载（云端用 conversations-batch 带 messages；本地游标分页，已含 messages）
const ALPACA_PAGE_SIZE = 20
const hasMore = ref(false)
const loadingMore = ref(false)
const totalConvs = ref<number | undefined>(undefined)
const cloudConfigStates = ref<Array<{ id: number; page: number; hasMore: boolean }>>([])
const localPage = ref(1)

async function load() {
  loading.value = true
  try {
    selected.value = []
    totalConvs.value = undefined
    if (auth.cloudSyncEnabled) {
      const { configs } = (await request.get('/configs')) as any
      cloudConfigStates.value = configs.map((c: any) => ({ id: c.id, page: 0, hasMore: true }))
      const all: ParsedConversation[] = []
      for (const cfg of configs) {
        const page = await loadConversationsPage({
          cloudSync: true,
          configId: cfg.id,
          page: 1,
          pageSize: ALPACA_PAGE_SIZE,
          withMessages: true, // 转换需要 messages 内容
        })
        all.push(...page.conversations)
        const st = cloudConfigStates.value.find((s) => s.id === cfg.id)
        if (st) { st.page = 1; st.hasMore = page.hasMore }
        if (page.total != null) totalConvs.value = (totalConvs.value ?? 0) + page.total
      }
      convs.value = all
      hasMore.value = cloudConfigStates.value.some((s) => s.hasMore)
    } else {
      localPage.value = 1
      const page = await loadConversationsPage({
        cloudSync: false,
        page: 1,
        pageSize: ALPACA_PAGE_SIZE,
        withMessages: true,
      })
      convs.value = page.conversations
      hasMore.value = page.hasMore
      totalConvs.value = page.total
    }
  } finally {
    loading.value = false
  }
}

async function loadMore() {
  if (loadingMore.value || !hasMore.value) return
  loadingMore.value = true
  try {
    if (auth.cloudSyncEnabled) {
      const toLoad = cloudConfigStates.value.filter((s) => s.hasMore)
      const more: ParsedConversation[] = []
      for (const s of toLoad) {
        const nextPage = s.page + 1
        const page = await loadConversationsPage({
          cloudSync: true,
          configId: s.id,
          page: nextPage,
          pageSize: ALPACA_PAGE_SIZE,
          withMessages: true,
        })
        more.push(...page.conversations)
        s.page = nextPage
        s.hasMore = page.hasMore
      }
      if (more.length > 0) convs.value = [...convs.value, ...more]
      hasMore.value = cloudConfigStates.value.some((s) => s.hasMore)
    } else {
      const nextPage = localPage.value + 1
      const page = await loadConversationsPage({
        cloudSync: false,
        page: nextPage,
        pageSize: ALPACA_PAGE_SIZE,
        withMessages: true,
      })
      if (page.conversations.length > 0) {
        convs.value = [...convs.value, ...page.conversations]
      }
      localPage.value = nextPage
      hasMore.value = page.hasMore
    }
  } finally {
    loadingMore.value = false
  }
}

const selectedConvs = computed(() =>
  convs.value.filter((c) => selected.value.includes(c.deepseekConvId)),
)
const convertedAll = computed(() => {
  const c = selectedConvs.value
  return multiTurn.value ? toAlpacaMulti(c) : toAlpacaSingle(c)
})
const preview = computed(() => convertedAll.value.slice(0, 2))
const total = computed(() => convertedAll.value.length)

function selectAll() {
  selected.value = convs.value.map((c) => c.deepseekConvId)
}
function clearAll() {
  selected.value = []
}
function download() {
  if (total.value === 0) return
  downloadJSON(convertedAll.value, `alpaca-${Date.now()}.json`)
}

onMounted(load)
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px;">Alpaca 数据格式转换</h2>
    <NSpin :show="loading">
      <NSpace align="center" :size="12" style="margin-bottom: 16px;">
        <NSpace align="center" :size="6">
          <NText depth="3" style="font-size: 13px;">多轮</NText>
          <NSwitch v-model:value="multiTurn" size="small" />
        </NSpace>
        <NButton size="small" @click="selectAll">全选</NButton>
        <NButton size="small" @click="clearAll">清空</NButton>
        <NTag size="small" type="info">已选 {{ selected.length }} / {{ convs.length }} 个会话<span v-if="totalConvs != null">（共 {{ totalConvs }}）</span></NTag>
        <NTag size="small" :type="total ? 'success' : 'default'">将生成 {{ total }} 条</NTag>
        <NButton type="primary" :disabled="!total" @click="download">下载 JSON</NButton>
      </NSpace>

      <NEmpty v-if="!loading && convs.length === 0" description="暂无会话，请先在配置页上传" style="padding: 40px 0;" />
      <template v-else>
        <NSpace :size="16" align="start">
          <div class="neu-card" style="width: 320px; max-height: 60vh; overflow: auto;">
            <NCheckboxGroup v-model:value="selected">
              <NSpace vertical :size="8">
                <NCheckbox v-for="c in convs" :key="c.deepseekConvId" :value="c.deepseekConvId" :label="c.title" />
              </NSpace>
            </NCheckboxGroup>
            <div v-if="hasMore" class="load-more">
              <NButton
                size="small"
                type="primary"
                ghost
                :loading="loadingMore"
                @click="loadMore"
              >加载更多（已加载 {{ convs.length }}<span v-if="totalConvs != null"> / {{ totalConvs }}</span>）</NButton>
            </div>
          </div>
          <div class="neu-card" style="flex: 1; min-width: 320px;">
            <NText strong style="display: block; margin-bottom: 12px;">预览（前 {{ preview.length }} 条）</NText>
            <NScrollbar style="max-height: 56vh;">
              <NEmpty v-if="preview.length === 0" description="选择会话后预览" />
              <NSpace vertical :size="12" v-else>
                <pre class="preview-pre"><NCode :code="JSON.stringify(preview[0], null, 2)" language="json" word-wrap /></pre>
                <pre v-if="preview[1]" class="preview-pre"><NCode :code="JSON.stringify(preview[1], null, 2)" language="json" word-wrap /></pre>
              </NSpace>
            </NScrollbar>
          </div>
        </NSpace>
      </template>
    </NSpin>
  </div>
</template>

<style scoped>
.preview-pre {
  margin: 0;
  background: rgba(0, 0, 0, 0.03);
  border-radius: 10px;
  padding: 12px;
}
.load-more {
  display: flex;
  justify-content: center;
  padding: 12px 0;
}
</style>
