<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NSpace, NEmpty, NSpin, NText, NIcon, NButton } from 'naive-ui'
import {
  StorefrontOutline,
  OpenOutline,
  PricetagsOutline,
  SparklesOutline,
  RocketOutline,
  HammerOutline,
  CodeSlashOutline,
  BookOutline,
  ColorPaletteOutline,
  ConstructOutline,
  BriefcaseOutline,
  ExtensionPuzzleOutline,
} from '@vicons/ionicons5'
import { request } from '@/utils/request'
import type { MarketEntry } from '@/types'

const entries = ref<MarketEntry[]>([])
const loading = ref(false)

async function load() {
  loading.value = true
  try {
    const res: any = await request.get('/market')
    entries.value = res.entries
  } finally {
    loading.value = false
  }
}

// 根据分类获取图标和配色
const DEFAULT_STYLE = { icon: SparklesOutline, color: '#6366F1', bg: 'rgba(99,102,241,0.10)' } as const
function getCategoryStyle(category: string): { icon: any; color: string; bg: string } {
  const map: Record<string, { icon: any; color: string; bg: string }> = {
    '开发工具': { icon: CodeSlashOutline, color: '#4F46E5', bg: 'rgba(79,70,229,0.10)' },
    '学习资源': { icon: BookOutline, color: '#8B5CF6', bg: 'rgba(139,92,246,0.10)' },
    '创意设计': { icon: ColorPaletteOutline, color: '#EC4899', bg: 'rgba(236,72,153,0.10)' },
    '效率工具': { icon: RocketOutline, color: '#10B981', bg: 'rgba(16,185,129,0.10)' },
    '社区交流': { icon: BriefcaseOutline, color: '#0EA5E9', bg: 'rgba(14,165,233,0.10)' },
    '基础设施': { icon: ConstructOutline, color: '#F59E0B', bg: 'rgba(245,158,11,0.10)' },
    '模型插件': { icon: ExtensionPuzzleOutline, color: '#14B8A6', bg: 'rgba(20,184,166,0.10)' },
    '其他': DEFAULT_STYLE,
  }
  return map[category] ?? DEFAULT_STYLE
}
function categoryBg(category: string) { return getCategoryStyle(category).bg }
function categoryColor(category: string) { return getCategoryStyle(category).color }
function categoryIcon(category: string) { return getCategoryStyle(category).icon }

onMounted(load)
</script>

<template>
  <div class="page-enter">
    <!-- 页面头部 -->
    <div class="page-header" style="margin-bottom: 24px;">
      <NSpace align="center" :size="14" wrap>
        <div class="page-header-icon">
          <NIcon size="22"><StorefrontOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <h2 style="margin: 0 0 4px;">应用市场</h2>
          <p class="page-header-sub">
            发现优质的 Deepseek 生态工具、学习资源和社区推荐应用
          </p>
        </div>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <NEmpty
        v-if="!loading && entries.length === 0"
        description="暂无收录"
        style="padding: 60px 0;"
      />
      <div
        v-else
        style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px;"
      >
        <a
          v-for="(e, idx) in entries"
          :key="e.id"
          :href="e.url"
          target="_blank"
          rel="noopener noreferrer"
          class="surface surface-hover market-card page-enter"
          :style="{ padding: '20px', textDecoration: 'none', display: 'block', animationDelay: `${40 * Math.min(idx, 8)}ms` }"
        >
          <div style="display: flex; align-items: flex-start; gap: 14px; margin-bottom: 14px;">
            <div
              class="market-icon"
              :style="{
                width: '48px', height: '48px', borderRadius: '12px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
                background: categoryBg(e.category),
                color: categoryColor(e.category),
              }"
            >
              <NIcon size="24"><component :is="categoryIcon(e.category)" /></NIcon>
            </div>
            <div style="flex: 1; min-width: 0;">
              <h3 style="margin: 0 0 6px; font-size: 16px; color: var(--text); display: flex; align-items: center; gap: 6px;">
                {{ e.name }}
                <NIcon size="14" style="color: var(--text-muted);"><OpenOutline /></NIcon>
              </h3>
              <span
                class="pill"
                :style="{
                  fontSize: '11px',
                  background: categoryBg(e.category),
                  color: categoryColor(e.category),
                }"
              >
                <NIcon size="10" style="margin-right: 3px;"><PricetagsOutline /></NIcon>
                {{ e.category }}
              </span>
            </div>
          </div>

          <NText depth="3" style="display: block; font-size: 13px; line-height: 1.6; color: var(--text-secondary); min-height: 44px; margin-bottom: 16px;">
            {{ e.description || '暂无描述' }}
          </NText>

          <div
            style="display: flex; align-items: center; justify-content: space-between; padding-top: 14px; border-top: 1px solid var(--border-subtle);"
          >
            <div style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-muted);">
              <SparklesOutline style="font-size: 14px;" />
              精选推荐
            </div>
            <NButton size="small" type="primary" round>
              <template #icon><NIcon size="13"><OpenOutline /></NIcon></template>
              前往
            </NButton>
          </div>
        </a>
      </div>
    </NSpin>
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
.market-card {
  position: relative;
  overflow: hidden;
}
.market-card::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  width: 100px;
  height: 100px;
  background: radial-gradient(circle at top right, var(--primary-soft) 0%, transparent 70%);
  pointer-events: none;
  opacity: 0.6;
}
.market-icon {
  transition: transform var(--transition);
}
.market-card:hover .market-icon {
  transform: scale(1.08) rotate(-3deg);
}
</style>
