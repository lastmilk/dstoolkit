<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  CodeSlashOutline,
  CheckmarkDoneOutline,
  CloseCircleOutline,
  DownloadOutline,
  ChevronDownOutline,
  EyeOutline,
  ListOutline,
} from '@vicons/ionicons5'
import AppIcon from '@/components/AppIcon.vue'
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
          withMessages: true,
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
  <div class="page-enter">
    <!-- 页面头部 -->
    <div class="page-header" style="margin-bottom: 24px;">
      <t-space align="center" :size="14" break-line>
        <div class="page-header-icon">
          <AppIcon :size="22"><CodeSlashOutline /></AppIcon>
        </div>
        <div style="flex: 1;">
          <h2 style="margin: 0 0 4px;">Alpaca 数据格式转换</h2>
          <p class="page-header-sub">
            将你的对话数据导出为业界标准的 Alpaca 格式，可直接用于模型微调训练
          </p>
        </div>
      </t-space>
    </div>

    <t-loading :loading="loading">
      <!-- 操作工具栏 -->
      <div class="surface toolbar-surface" style="padding: 14px 18px; margin-bottom: 16px;">
        <t-space align="center" :size="12" break-line>
          <div class="mode-toggle" style="display: flex; align-items: center; gap: 8px;">
            <t-radio-group
              v-model="multiTurn"
              variant="default-filled"
              size="small"
            >
              <t-radio-button :value="true">多轮对话</t-radio-button>
              <t-radio-button :value="false">单轮问答</t-radio-button>
            </t-radio-group>
          </div>
          <t-button size="small" variant="outline" @click="selectAll">
            <template #icon><AppIcon :size="14"><CheckmarkDoneOutline /></AppIcon></template>
            全选
          </t-button>
          <t-button size="small" variant="outline" @click="clearAll">
            <template #icon><AppIcon :size="14"><CloseCircleOutline /></AppIcon></template>
            清空
          </t-button>
          <div style="flex: 1;"></div>
          <span class="pill pill-info" style="font-size: 12px;">
            已选 {{ selected.length }} / {{ convs.length }} 个会话
            <span v-if="totalConvs != null" style="opacity: 0.7;">（共 {{ totalConvs }}）</span>
          </span>
          <span :class="['pill', total ? 'pill-success' : 'pill-default']" style="font-size: 12px;">
            将生成 {{ total }} 条
          </span>
          <t-button theme="primary" :disabled="!total" @click="download">
            <template #icon><AppIcon :size="15"><DownloadOutline /></AppIcon></template>
            下载 JSON
          </t-button>
        </t-space>
      </div>

      <t-empty
        v-if="!loading && convs.length === 0"
        description="暂无会话，请先在配置页上传"
        style="padding: 60px 0;"
      />
      <template v-else>
        <div style="display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 16px; align-items: start;">
          <!-- 左侧：会话选择列表 -->
          <div class="surface page-enter" style="padding: 4px; max-height: 68vh; display: flex; flex-direction: column;">
            <div
              style="padding: 12px 16px 8px; font-size: 12px; font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;"
            >
              <AppIcon :size="13" style="color: var(--primary);"><ListOutline /></AppIcon>
              会话列表
            </div>
            <div style="flex: 1; overflow: hidden;">
              <div class="scroll-area" style="max-height: calc(68vh - 60px); overflow-y: auto;">
                <div style="padding: 4px 10px 12px;">
                  <t-checkbox-group v-model="selected">
                    <t-space vertical :size="2">
                      <div
                        v-for="c in convs"
                        :key="c.deepseekConvId"
                        class="conv-item"
                        style="padding: 8px 10px; border-radius: 8px; transition: all var(--transition-fast);"
                      >
                        <t-checkbox
                          :value="c.deepseekConvId"
                          :label="c.title"
                        />
                      </div>
                    </t-space>
                  </t-checkbox-group>
                  <div v-if="hasMore" class="load-more" style="display: flex; justify-content: center; padding: 14px 0 6px;">
                    <t-button
                      size="small"
                      theme="primary"
                      variant="outline"
                      :loading="loadingMore"
                      @click="loadMore"
                    >
                      <template #icon v-if="!loadingMore">
                        <AppIcon :size="13"><ChevronDownOutline /></AppIcon>
                      </template>
                      加载更多（已加载 {{ convs.length }}
                      <span v-if="totalConvs != null"> / {{ totalConvs }}</span>）
                    </t-button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 右侧：预览区 -->
          <div class="surface page-enter delay-1" style="padding: 20px; min-height: 400px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
              <AppIcon :size="16" style="color: var(--accent);"><EyeOutline /></AppIcon>
              <h4 style="margin: 0; font-size: 14px;">数据预览</h4>
              <span class="pill pill-default" style="font-size: 11px; margin-left: 4px;">前 {{ preview.length }} 条</span>
              <div style="flex: 1;"></div>
              <span v-if="total" class="pill pill-primary" style="font-size: 11px;">
                共 {{ total }} 条数据待导出
              </span>
            </div>
            <div class="scroll-area" style="max-height: 62vh; overflow-y: auto;">
              <t-empty v-if="preview.length === 0" description="选择会话后预览转换结果" />
              <t-space vertical :size="12" v-else style="padding-right: 4px;">
                <div class="preview-card">
                  <div class="preview-label" style="font-size: 11px; color: var(--text-muted); font-weight: 500; margin-bottom: 6px;">
                    第 1 条
                  </div>
                  <pre class="preview-pre">{{ JSON.stringify(preview[0], null, 2) }}</pre>
                </div>
                <div v-if="preview[1]" class="preview-card">
                  <div class="preview-label" style="font-size: 11px; color: var(--text-muted); font-weight: 500; margin-bottom: 6px;">
                    第 2 条
                  </div>
                  <pre class="preview-pre">{{ JSON.stringify(preview[1], null, 2) }}</pre>
                </div>
              </t-space>
            </div>
          </div>
        </div>
      </template>
    </t-loading>
  </div>
</template>

<style scoped>
.page-header-icon {
  width: 44px;
  height: 44px;
  border-radius: var(--radius);
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--primary-soft) 0%, var(--accent-soft) 100%);
  color: var(--primary);
  flex-shrink: 0;
}
.page-header-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}
.toolbar-surface {
  transition: box-shadow var(--transition);
}
.toolbar-surface:hover {
  box-shadow: var(--shadow-sm);
}
.conv-item:hover {
  background: var(--bg-2);
}
.preview-card {
  padding: 12px;
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}
.preview-pre {
  margin: 0;
  border-radius: var(--radius-sm);
  background: #0F172A !important;
  color: #E2E8F0;
  font-size: 12.5px;
  line-height: 1.6;
  padding: 14px 16px;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
