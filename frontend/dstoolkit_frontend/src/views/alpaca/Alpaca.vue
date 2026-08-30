<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import {
  ElSpace,
  ElCheckboxGroup,
  ElCheckbox,
  ElButton,
  ElSwitch,
  ElEmpty,
  ElIcon,
} from 'element-plus'
import {
  Edit,
  CircleCheck,
  CircleClose,
  Download,
  ArrowDown,
  View,
  Menu,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { loadConversationsPage } from '@/utils/db'
import { request } from '@/utils/request'
import { toAlpacaSingle, toAlpacaMulti, downloadJSON } from '@/utils/alpaca'
import type { ParsedConversation } from '@/types'

const auth = useAuthStore()
const loading = ref<boolean>(false)
const convs = ref<ParsedConversation[]>([])
const selected = ref<string[]>([])
const multiTurn = ref<boolean>(false)

const ALPACA_PAGE_SIZE = 20
const hasMore = ref<boolean>(false)
const loadingMore = ref<boolean>(false)
const totalConvs = ref<number | undefined>(undefined)
const cloudConfigStates = ref<Array<{ id: number; page: number; hasMore: boolean }>>([])
const localPage = ref<number>(1)

async function load(): Promise<void> {
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

async function loadMore(): Promise<void> {
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

const selectedConvs = computed<ParsedConversation[]>(() =>
  convs.value.filter((c) => selected.value.includes(c.deepseekConvId)),
)
const convertedAll = computed<any[]>(() => {
  const c = selectedConvs.value
  return multiTurn.value ? toAlpacaMulti(c) : toAlpacaSingle(c)
})
const preview = computed<any[]>(() => convertedAll.value.slice(0, 2))
const total = computed<number>(() => convertedAll.value.length)

function selectAll(): void {
  selected.value = convs.value.map((c) => c.deepseekConvId)
}
function clearAll(): void {
  selected.value = []
}
function download(): void {
  if (total.value === 0) return
  downloadJSON(convertedAll.value, `alpaca-${Date.now()}.json`)
}

onMounted(load)
</script>

<template>
  <div class="page-enter">
    <div class="page-header" style="margin-bottom: 24px;">
      <el-space align="center" :size="14" wrap>
        <div class="page-header-icon">
          <el-icon :size="22"><Edit /></el-icon>
        </div>
        <div style="flex: 1;">
          <h2 style="margin: 0 0 4px;">Alpaca 数据格式转换</h2>
          <p class="page-header-sub">
            将你的对话数据导出为业界标准的 Alpaca 格式，可直接用于模型微调训练
          </p>
        </div>
      </el-space>
    </div>

    <div v-loading="loading">
      <div class="surface toolbar-surface glass-card" style="padding: 14px 18px; margin-bottom: 16px;">
        <el-space align="center" :size="12" wrap>
          <div class="mode-toggle" style="display: flex; align-items: center; gap: 10px; padding: 6px 14px; background: var(--surface-2); border-radius: var(--radius-full); border: 1px solid var(--border-subtle);">
            <el-icon :size="14" :style="{ color: multiTurn ? 'var(--primary)' : 'var(--text-muted)' }">
              <Menu />
            </el-icon>
            <span style="font-size: 13px; color: var(--text-muted);">{{ multiTurn ? '多轮对话' : '单轮问答' }}</span>
            <el-switch v-model="multiTurn" size="small" />
          </div>
          <el-button size="small" plain @click="selectAll">
            <template #icon><el-icon :size="14"><CircleCheck /></el-icon></template>
            全选
          </el-button>
          <el-button size="small" plain @click="clearAll">
            <template #icon><el-icon :size="14"><CircleClose /></el-icon></template>
            清空
          </el-button>
          <div style="flex: 1;"></div>
          <span class="pill pill-info" style="font-size: 12px;">
            已选 {{ selected.length }} / {{ convs.length }} 个会话
            <span v-if="totalConvs != null" style="opacity: 0.7;">（共 {{ totalConvs }}）</span>
          </span>
          <span :class="['pill', total ? 'pill-success' : 'pill-default']" style="font-size: 12px;">
            将生成 {{ total }} 条
          </span>
          <el-button type="primary" :disabled="!total" @click="download">
            <template #icon><el-icon :size="15"><Download /></el-icon></template>
            下载 JSON
          </el-button>
        </el-space>
      </div>

      <el-empty
        v-if="!loading && convs.length === 0"
        description="暂无会话，请先在配置页上传"
        style="padding: 60px 0;"
      />
      <template v-else>
        <div style="display: grid; grid-template-columns: 340px minmax(0, 1fr); gap: 16px; align-items: start;">
          <div class="surface page-enter glass-card" style="padding: 4px; max-height: 68vh; display: flex; flex-direction: column;">
            <div
              style="padding: 12px 16px 8px; font-size: 12px; font-weight: 600; color: var(--text-secondary); display: flex; align-items: center; gap: 6px;"
            >
              <el-icon :size="13" style="color: var(--primary);"><Menu /></el-icon>
              会话列表
            </div>
            <div style="flex: 1; overflow-y: auto; max-height: calc(68vh - 60px);">
              <div style="padding: 4px 10px 12px;">
                <el-checkbox-group v-model="selected">
                  <el-space vertical :size="2">
                    <div
                      v-for="c in convs"
                      :key="c.deepseekConvId"
                      class="conv-item"
                      style="padding: 8px 10px; border-radius: 8px; transition: all var(--transition-fast);"
                    >
                      <el-checkbox
                        :value="c.deepseekConvId"
                        :label="c.title"
                      />
                    </div>
                  </el-space>
                </el-checkbox-group>
                <div v-if="hasMore" class="load-more" style="display: flex; justify-content: center; padding: 14px 0 6px;">
                  <el-button
                    size="small"
                    type="primary"
                    plain
                    :loading="loadingMore"
                    @click="loadMore"
                  >
                    <template #icon v-if="!loadingMore">
                      <el-icon :size="13"><ArrowDown /></el-icon>
                    </template>
                    加载更多（已加载 {{ convs.length }}
                    <span v-if="totalConvs != null"> / {{ totalConvs }}</span>）
                  </el-button>
                </div>
              </div>
            </div>
          </div>

          <div class="surface page-enter delay-1 glass-card" style="padding: 20px; min-height: 400px;">
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px;">
              <el-icon :size="16" style="color: var(--accent);"><View /></el-icon>
              <h4 style="margin: 0; font-size: 14px;">数据预览</h4>
              <span class="pill pill-default" style="font-size: 11px; margin-left: 4px;">前 {{ preview.length }} 条</span>
              <div style="flex: 1;"></div>
              <span v-if="total" class="pill pill-primary" style="font-size: 11px;">
                共 {{ total }} 条数据待导出
              </span>
            </div>
            <div style="max-height: 62vh; overflow-y: auto;">
              <el-empty v-if="preview.length === 0" description="选择会话后预览转换结果" />
              <el-space vertical :size="12" v-else style="padding-right: 4px; width: 100%;">
                <div class="preview-card">
                  <div class="preview-label" style="font-size: 11px; color: var(--text-muted); font-weight: 500; margin-bottom: 6px;">
                    第 1 条
                  </div>
                  <pre class="preview-pre"><code>{{ JSON.stringify(preview[0], null, 2) }}</code></pre>
                </div>
                <div v-if="preview[1]" class="preview-card">
                  <div class="preview-label" style="font-size: 11px; color: var(--text-muted); font-weight: 500; margin-bottom: 6px;">
                    第 2 条
                  </div>
                  <pre class="preview-pre"><code>{{ JSON.stringify(preview[1], null, 2) }}</code></pre>
                </div>
              </el-space>
            </div>
          </div>
        </div>
      </template>
    </div>
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
  background: #0F172A;
  color: #E2E8F0;
  font-size: 12.5px;
  line-height: 1.6;
  padding: 14px 16px;
  overflow-x: auto;
}
.preview-pre code {
  background: transparent;
  color: inherit;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 0;
  font-size: inherit;
  line-height: inherit;
  white-space: pre;
}
</style>
