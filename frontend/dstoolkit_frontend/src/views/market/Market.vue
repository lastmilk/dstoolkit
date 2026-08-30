<script setup lang="ts">
import { onMounted, ref } from 'vue'
import AppIcon from '@/components/AppIcon.vue'
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

const DEFAULT_STYLE = { icon: SparklesOutline, color: '#6366F1', bg: 'rgba(99,102,241,0.10)' } as const
function getCategoryStyle(category: string): { icon: any; color: string; bg: string } {
  const map: Record<string, { icon: any; color: string; bg: string }> = {
    '开发工具': { icon: CodeSlashOutline, color: '#00D4FF', bg: 'rgba(0,212,255,0.12)' },
    '学习资源': { icon: BookOutline, color: '#A855F7', bg: 'rgba(168,85,247,0.12)' },
    '创意设计': { icon: ColorPaletteOutline, color: '#FF5A8C', bg: 'rgba(255,90,140,0.12)' },
    '效率工具': { icon: RocketOutline, color: '#10B981', bg: 'rgba(16,185,129,0.12)' },
    '社区交流': { icon: BriefcaseOutline, color: '#38BDF8', bg: 'rgba(56,189,248,0.12)' },
    '基础设施': { icon: ConstructOutline, color: '#F59E0B', bg: 'rgba(245,158,11,0.12)' },
    '模型插件': { icon: ExtensionPuzzleOutline, color: '#14B8A6', bg: 'rgba(20,184,166,0.12)' },
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
  <div class="page-enter" style="display: flex; flex-direction: column; gap: 18px;">
      <div class="banner-glow-1"></div>
      <div class="banner-glow-2"></div>
      <div class="banner-inner">
        <div class="banner-title-block">
          <div class="chronos-eyebrow">
            <AppIcon :size="12"><RocketOutline /></AppIcon>
            <span>MODEL MARKET // 模型市场</span>
          </div>
          <h1 class="chronos-page-title">
            模型市场
            <span class="title-accent">· 应用资源</span>
          </h1>
          <p class="chronos-page-sub">
            浏览并使用各类模型资源，扩展对话能力
          </p>
        </div>
        <div class="banner-badge">
          <div class="badge-ring"></div>
          <div class="badge-text">
            <div class="badge-num">{{ entries.length }}</div>
            <div class="badge-label">资源可用</div>
          </div>
        </div>
    </div>

    <t-loading :loading="loading">
      <t-empty
        v-if="!loading && entries.length === 0"
        description="暂无收录资源"
        style="padding: 60px 0;"
      />
      <div
        v-else
        class="market-grid"
      >
        <a
          v-for="(e, idx) in entries"
          :key="e.id"
          :href="e.url"
          target="_blank"
          rel="noopener noreferrer"
          class="chronos-panel market-card page-enter"
          :style="{ animationDelay: `${40 * Math.min(idx, 10)}ms` }"
        >
          <div class="panel-corner tl"></div>
          <div class="panel-corner tr"></div>
          <div class="panel-corner bl"></div>
          <div class="panel-corner br"></div>
          <div class="card-glow"></div>

          <div class="card-head">
            <div
              class="market-icon"
              :style="{ background: categoryBg(e.category), color: categoryColor(e.category) }"
            >
              <AppIcon :size="24"><component :is="categoryIcon(e.category)" /></AppIcon>
            </div>
            <div class="card-head-text">
              <h3>
                {{ e.name }}
                <AppIcon :size="14" style="color: var(--text-muted);"><OpenOutline /></AppIcon>
              </h3>
              <span
                class="category-tag"
                :style="{ background: categoryBg(e.category), color: categoryColor(e.category) }"
              >
                <AppIcon :size="10" style="margin-right: 3px;"><PricetagsOutline /></AppIcon>
                {{ e.category }}
              </span>
            </div>
          </div>

          <span class="card-desc">
            {{ e.description || '暂无描述，点击查看更多' }}
          </span>

          <div class="card-foot">
            <div class="foot-tag">
              <SparklesOutline style="font-size: 14px;" />
              <span>推荐</span>
            </div>
            <t-button size="small" theme="primary" shape="round">
              <template #icon><AppIcon :size="13"><OpenOutline /></AppIcon></template>
              使用
            </t-button>
          </div>
        </a>
      </div>
    </t-loading>
  </div>
</template>

<style scoped>
.chronos-page-banner {
  position: relative;
  padding: 22px 24px;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(0, 212, 255, 0.08) 50%, rgba(255, 90, 140, 0.06) 100%),
    linear-gradient(180deg, rgba(17, 26, 53, 0.95) 0%, rgba(11, 18, 38, 0.98) 100%);
  border: 1px solid var(--border);
  overflow: hidden;
}
.banner-glow-1, .banner-glow-2 {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(60px);
  opacity: 0.4;
}
.banner-glow-1 {
  width: 260px; height: 260px;
  top: -120px; right: -80px;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
}
.banner-glow-2 {
  width: 200px; height: 200px;
  bottom: -100px; left: 20%;
  background: radial-gradient(circle, var(--primary) 0%, transparent 70%);
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
  color: var(--accent);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 4px 10px;
  background: rgba(168, 85, 247, 0.08);
  border-radius: 4px;
  border: 1px solid rgba(168, 85, 247, 0.18);
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
  color: var(--primary);
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
.banner-badge {
  position: relative;
  width: 96px; height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.badge-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: conic-gradient(from 0deg, var(--primary), var(--accent), #EC4899, var(--primary));
  padding: 2px;
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  animation: spin 6s linear infinite;
  opacity: 0.7;
}
@keyframes spin { to { transform: rotate(360deg); } }
.badge-text {
  text-align: center;
  position: relative;
  z-index: 1;
}
.badge-num {
  font-size: 28px;
  font-weight: 800;
  line-height: 1;
  background: linear-gradient(135deg, var(--primary), var(--accent));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}
.badge-label {
  font-size: 10px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-top: 4px;
  font-weight: 600;
}

.market-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}
.market-card {
  padding: 20px;
  text-decoration: none;
  display: block;
  position: relative;
  overflow: hidden;
  transition: all var(--transition);
  cursor: pointer;
}
.market-card:hover {
  transform: translateY(-3px);
  border-color: rgba(0, 212, 255, 0.35);
  box-shadow: 0 10px 40px rgba(0, 212, 255, 0.08), 0 4px 12px rgba(0,0,0,0.2);
}
.card-glow {
  position: absolute;
  top: 0; right: 0;
  width: 140px; height: 140px;
  background: radial-gradient(circle at top right, rgba(0, 212, 255, 0.15) 0%, transparent 65%);
  pointer-events: none;
  transition: all var(--transition);
}
.market-card:hover .card-glow {
  opacity: 0.9;
  transform: scale(1.2);
}

.card-head {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  margin-bottom: 14px;
  position: relative;
  z-index: 1;
}
.market-icon {
  width: 48px; height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: transform var(--transition);
  position: relative;
}
.market-icon::after {
  content: '';
  position: absolute;
  inset: -1px;
  border-radius: 13px;
  padding: 1px;
  background: inherit;
  filter: brightness(1.5);
  -webkit-mask: linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  opacity: 0.4;
}
.market-card:hover .market-icon {
  transform: scale(1.1) rotate(-4deg);
}
.card-head-text { flex: 1; min-width: 0; }
.card-head-text h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 700;
}
.category-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.03em;
}

.card-desc {
  display: block;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-secondary);
  min-height: 44px;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}

.card-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 14px;
  border-top: 1px solid var(--border-subtle);
  position: relative;
  z-index: 1;
}
.foot-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--accent);
  font-weight: 500;
}

@media (max-width: 720px) {
  .chronos-page-banner { padding: 18px 16px; }
  .chronos-page-title { font-size: 20px; }
  .banner-badge { width: 80px; height: 80px; order: -1; }
  .badge-num { font-size: 24px; }
  .market-grid {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 480px) {
  .chronos-page-banner { padding: 16px 14px; }
  .chronos-page-title { font-size: 18px; }
  .chronos-page-sub { font-size: 12.5px; }
  .market-card { padding: 16px; }
}
</style>
