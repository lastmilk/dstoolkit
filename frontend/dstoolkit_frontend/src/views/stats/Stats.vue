<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NSpace, NSpin, NEmpty, NStatistic, NGrid, NGridItem, NIcon } from 'naive-ui'
import {
  BarChartOutline,
  ChatbubblesOutline,
  ChatbubbleOutline,
  ColorPaletteOutline,
  TimeOutline,
  TrendingUpOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { request } from '@/utils/request'
import { loadAllConversations } from '@/utils/db'
import VChart from '@/utils/echarts'

const auth = useAuthStore()
const loading = ref(false)
const stats = ref<any>({})

function cnDate(d: string | Date) {
  const t = new Date(d)
  return new Date(t.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}
function cnHour(d: string | Date) {
  const t = new Date(d)
  return new Date(t.getTime() + 8 * 3600 * 1000).getUTCHours()
}

function localStats(convs: any[]) {
  const dailyConv = new Map<string, number>()
  const dailyMsg = new Map<string, { date: string; user: number; assistant: number }>()
  const modelDist = new Map<string, number>()
  const hours = new Array(24).fill(0)
  let totalMsgs = 0
  for (const c of convs) {
    const dk = cnDate(c.insertedAt)
    dailyConv.set(dk, (dailyConv.get(dk) || 0) + 1)
    for (const m of c.messages) {
      totalMsgs++
      const d = cnDate(m.insertedAt)
      const cur = dailyMsg.get(d) || { date: d, user: 0, assistant: 0 }
      if (m.role === 'USER') cur.user++
      else cur.assistant++
      dailyMsg.set(d, cur)
      if (m.model) modelDist.set(m.model, (modelDist.get(m.model) || 0) + 1)
      hours[cnHour(m.insertedAt)]++
    }
  }
  return {
    totalConversations: convs.length,
    totalMessages: totalMsgs,
    dailyConversations: Array.from(dailyConv.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    dailyMessages: Array.from(dailyMsg.values()).sort((a, b) => a.date.localeCompare(b.date)),
    modelDistribution: Array.from(modelDist.entries()).map(([model, count]) => ({ model, count })),
    activeHours: hours.map((count, hour) => ({ hour, count })),
  }
}

async function load() {
  loading.value = true
  try {
    if (auth.cloudSyncEnabled) {
      stats.value = await request.get('/stats')
    } else {
      const convs = await loadAllConversations(false)
      stats.value = localStats(convs)
    }
  } finally {
    loading.value = false
  }
}

// ═══════════ 浅色办公风色板 ═══════════
const chronosCyan = '#4F46E5'
const chronosPurple = '#0EA5E9'
const chronosGreen = '#10B981'
const chronosAmber = '#F59E0B'
const chronosPink = '#EF4444'
const chronosTeal = '#14B8A6'

const axisText = '#94A3B8'
const axisLine = '#E2E8F0'
const splitLine = '#E2E8F0'
const tooltipBg = '#FFFFFF'
const tooltipBorder = '#E2E8F0'
const tooltipText = '#0F172A'
const legendText = '#64748B'

const sharedTooltip = {
  trigger: 'axis' as const,
  backgroundColor: tooltipBg,
  borderColor: tooltipBorder,
  borderWidth: 1,
  textStyle: { color: tooltipText, fontSize: 12 },
  extraCssText: 'box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0;',
}

const msgLineOption = computed(() => ({
  tooltip: sharedTooltip,
  legend: {
    data: ['用户提问', 'AI 响应'],
    top: 0,
    right: 4,
    textStyle: { color: legendText, fontSize: 12 },
    icon: 'roundRect',
    itemWidth: 10,
    itemHeight: 3,
  },
  grid: { left: 40, right: 16, top: 40, bottom: 28 },
  xAxis: {
    type: 'category' as const,
    data: (stats.value.dailyMessages || []).map((d: any) => d.date.slice(5)),
    axisLine: { lineStyle: { color: axisLine } },
    axisLabel: { color: axisText, fontSize: 10, hideOverlap: true },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value' as const,
    splitLine: { lineStyle: { color: splitLine, type: 'dashed' } },
    axisLabel: { color: axisText, fontSize: 10 },
    axisLine: { show: false },
    axisTick: { show: false },
  },
  series: [
    {
      name: '用户提问',
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: (stats.value.dailyMessages || []).map((d: any) => d.user),
      itemStyle: { color: chronosCyan, borderColor: '#FFFFFF', borderWidth: 1 },
      lineStyle: { width: 2.5, color: chronosCyan, shadowColor: 'rgba(79, 70, 229, 0.18)', shadowBlur: 6 },
    },
    {
      name: 'AI 响应',
      type: 'line' as const,
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      areaStyle: {
        color: {
          type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(14, 165, 233, 0.28)' },
            { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
          ],
        },
      },
      data: (stats.value.dailyMessages || []).map((d: any) => d.assistant),
      itemStyle: { color: chronosPurple, borderColor: '#FFFFFF', borderWidth: 1 },
      lineStyle: { width: 2.5, color: chronosPurple, shadowColor: 'rgba(14, 165, 233, 0.18)', shadowBlur: 6 },
    },
  ],
}))

const convLineOption = computed(() => ({
  tooltip: sharedTooltip,
  grid: { left: 40, right: 16, top: 20, bottom: 28 },
  xAxis: {
    type: 'category' as const,
    data: (stats.value.dailyConversations || []).map((d: any) => d.date.slice(5)),
    axisLine: { lineStyle: { color: axisLine } },
    axisLabel: { color: axisText, fontSize: 10, hideOverlap: true },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value' as const,
    splitLine: { lineStyle: { color: splitLine, type: 'dashed' } },
    axisLabel: { color: axisText, fontSize: 10 },
    axisLine: { show: false },
    axisTick: { show: false },
  },
  series: [{
    name: '对话数',
    type: 'line' as const,
    smooth: true,
    symbol: 'circle',
    symbolSize: 5,
    areaStyle: {
      color: {
        type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(79, 70, 229, 0.28)' },
          { offset: 1, color: 'rgba(79, 70, 229, 0.02)' },
        ],
      },
    },
    data: (stats.value.dailyConversations || []).map((d: any) => d.count),
    itemStyle: { color: chronosCyan, borderColor: '#FFFFFF', borderWidth: 1 },
    lineStyle: { width: 2.5, color: chronosCyan, shadowColor: 'rgba(79, 70, 229, 0.2)', shadowBlur: 8 },
  }],
}))

const pieOption = computed(() => {
  const palette = [chronosCyan, chronosPurple, chronosGreen, chronosAmber, chronosPink, chronosTeal]
  return {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      textStyle: { color: tooltipText, fontSize: 12 },
      extraCssText: 'box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08); border: 1px solid #E2E8F0;',
    },
    legend: {
      bottom: 0,
      textStyle: { color: legendText, fontSize: 11 },
      itemWidth: 8,
      itemHeight: 8,
      type: 'scroll',
      pageIconColor: chronosCyan,
      pageTextStyle: { color: axisText },
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['45%', '72%'],
        avoidLabelOverlap: true,
        itemStyle: {
          borderRadius: 6,
          borderColor: '#FFFFFF',
          borderWidth: 2,
          shadowColor: 'rgba(15, 23, 42, 0.06)',
          shadowBlur: 12,
        },
        label: { show: false },
        emphasis: {
          label: { show: true, fontSize: 12, fontWeight: 700, color: '#0F172A' },
          itemStyle: { shadowBlur: 16, shadowColor: 'rgba(15, 23, 42, 0.12)' },
        },
        data: (stats.value.modelDistribution || []).map((d: any, i: number) => ({
          name: d.model,
          value: d.count,
          itemStyle: { color: palette[i % palette.length] },
        })),
      },
    ],
  }
})

const barOption = computed(() => ({
  tooltip: sharedTooltip,
  grid: { left: 40, right: 16, top: 20, bottom: 28 },
  xAxis: {
    type: 'category' as const,
    data: (stats.value.activeHours || []).map((d: any) => `${d.hour}:00`),
    axisLine: { lineStyle: { color: axisLine } },
    axisLabel: { color: axisText, fontSize: 9, interval: 2 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value' as const,
    splitLine: { lineStyle: { color: splitLine, type: 'dashed' } },
    axisLabel: { color: axisText, fontSize: 10 },
    axisLine: { show: false },
    axisTick: { show: false },
  },
  series: [{
    type: 'bar' as const,
    barWidth: '62%',
    data: (stats.value.activeHours || []).map((d: any) => d.count),
    itemStyle: {
      borderRadius: [5, 5, 0, 0],
      color: {
        type: 'linear' as const,
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: chronosCyan },
          { offset: 0.6, color: chronosPurple },
          { offset: 1, color: chronosTeal },
        ],
      },
      shadowColor: 'rgba(79, 70, 229, 0.18)',
      shadowBlur: 8,
    },
  }],
}))

onMounted(load)
</script>

<template>
  <div>
    <!-- 页面头部（桌面端由Layout显示，但页面也独立显示一个趣味小标签） -->
    <div class="stats-header" style="margin-bottom: 20px;">
      <NSpace align="center" :size="14" wrap>
        <div class="stats-header-icon">
          <NIcon size="22"><BarChartOutline /></NIcon>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px; flex-wrap: wrap;">
            <span class="chrono-stamp">ANALYTICS // 数据分析</span>
          </div>
          <h2 style="margin: 0 0 4px 0;">数据统计 · 使用分析</h2>
          <p class="stats-header-sub">
            全景掌握对话数据、模型使用情况与活跃时段趋势
          </p>
        </div>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <NEmpty
        v-if="!loading && !stats.totalConversations"
        description="时间线无记录 · 等待首次对话"
        style="padding: 60px 0;"
      />
      <template v-else>
        <!-- 统计卡片：桌面端4列/平板2列/手机1列 -->
        <NGrid
          :cols="4"
          :x-gap="14"
          :y-gap="14"
          style="margin-bottom: 18px;"
          responsive="screen"
        >
          <NGridItem class="page-enter" :span="24" xs-style="{ span: 24 }" m-style="{ span: 12 }">
            <div class="surface stat-card surface-hover" style="padding: 16px 16px 18px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div style="min-width: 0;">
                  <div class="stat-label">对话总数</div>
                  <NStatistic :value="stats.totalConversations || 0" style="--n-value-font-size: 28px;" />
                  <div class="stat-foot">共导入对话数</div>
                </div>
                <div class="stat-icon stat-1">
                  <NIcon size="18"><ChatbubblesOutline /></NIcon>
                </div>
              </div>
              <div class="chronos-progress" style="margin-top: 14px;">
                <div class="chronos-progress-bar" :style="{ width: Math.min(100, stats.totalConversations * 2) + '%' }"></div>
              </div>
            </div>
          </NGridItem>

          <NGridItem class="page-enter delay-1" :span="24" xs-style="{ span: 24 }" m-style="{ span: 12 }">
            <div class="surface stat-card surface-hover" style="padding: 16px 16px 18px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div style="min-width: 0;">
                  <div class="stat-label">消息总数</div>
                  <NStatistic :value="stats.totalMessages || 0" style="--n-value-font-size: 28px;" />
                  <div class="stat-foot">全部对话消息数</div>
                </div>
                <div class="stat-icon stat-2">
                  <NIcon size="18"><ChatbubbleOutline /></NIcon>
                </div>
              </div>
              <div class="chronos-progress" style="margin-top: 14px;">
                <div class="chronos-progress-bar" :style="{ width: Math.min(100, stats.totalMessages * 0.4) + '%' }"></div>
              </div>
            </div>
          </NGridItem>

          <NGridItem class="page-enter delay-2" :span="24" xs-style="{ span: 24 }" m-style="{ span: 12 }">
            <div class="surface stat-card surface-hover" style="padding: 16px 16px 18px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div style="min-width: 0;">
                  <div class="stat-label">模型种类</div>
                  <NStatistic :value="(stats.modelDistribution || []).length" style="--n-value-font-size: 28px;" />
                  <div class="stat-foot">已使用的模型数</div>
                </div>
                <div class="stat-icon stat-3">
                  <NIcon size="18"><ColorPaletteOutline /></NIcon>
                </div>
              </div>
              <div class="chronos-progress" style="margin-top: 14px;">
                <div class="chronos-progress-bar" :style="{ width: Math.min(100, (stats.modelDistribution || []).length * 14) + '%' }"></div>
              </div>
            </div>
          </NGridItem>

          <NGridItem class="page-enter delay-3" :span="24" xs-style="{ span: 24 }" m-style="{ span: 12 }">
            <div class="surface stat-card surface-hover" style="padding: 16px 16px 18px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between; gap: 12px;">
                <div style="min-width: 0;">
                  <div class="stat-label">对话总天数</div>
                  <NStatistic :value="(stats.dailyConversations || []).length" style="--n-value-font-size: 28px;" />
                  <div class="stat-foot">有对话的天数</div>
                </div>
                <div class="stat-icon stat-4">
                  <NIcon size="18"><TrendingUpOutline /></NIcon>
                </div>
              </div>
              <div class="chronos-progress" style="margin-top: 14px;">
                <div class="chronos-progress-bar" :style="{ width: Math.min(100, (stats.dailyConversations || []).length * 3) + '%' }"></div>
              </div>
            </div>
          </NGridItem>
        </NGrid>

        <!-- 图表区：响应式grid -->
        <NSpace vertical :size="14">
          <div class="surface chart-card page-enter surface-hover" style="padding: 16px 16px 8px;">
            <div class="chart-header">
              <NIcon size="16" :style="{ color: chronosCyan }"><TrendingUpOutline /></NIcon>
              <div class="chart-title">每日消息量趋势</div>
              <span class="chrono-stamp">MSG-STREAM</span>
            </div>
            <VChart :option="msgLineOption" autoresize style="height: 280px;" />
          </div>

          <!-- 2列图表：桌面2列/移动1列 -->
          <div class="stats-grid-2">
            <div class="surface chart-card page-enter delay-1 surface-hover" style="padding: 16px 16px 8px;">
              <div class="chart-header">
                <NIcon size="16" :style="{ color: chronosPurple }"><ChatbubblesOutline /></NIcon>
                <div class="chart-title">每日对话数</div>
                <span class="chrono-stamp">CONV-LINE</span>
              </div>
              <VChart :option="convLineOption" autoresize style="height: 280px;" />
            </div>
            <div class="surface chart-card page-enter delay-2 surface-hover" style="padding: 16px 16px 8px;">
              <div class="chart-header">
                <NIcon size="16" :style="{ color: chronosGreen }"><ColorPaletteOutline /></NIcon>
                <div class="chart-title">模型使用分布</div>
                <span class="chrono-stamp">MODEL-DIST</span>
              </div>
              <VChart :option="pieOption" autoresize style="height: 280px;" />
            </div>
          </div>

          <div class="surface chart-card page-enter delay-3 surface-hover" style="padding: 16px 16px 8px;">
            <div class="chart-header">
              <NIcon size="16" :style="{ color: chronosAmber }"><TimeOutline /></NIcon>
              <div class="chart-title">24 小时活跃分布</div>
              <span class="chrono-stamp warn">HOUR-HEAT</span>
            </div>
            <VChart :option="barOption" autoresize style="height: 280px;" />
          </div>
        </NSpace>
      </template>
    </NSpin>
  </div>
</template>

<style scoped>
.stats-header-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(14, 165, 233, 0.1) 100%);
  color: var(--primary);
  flex-shrink: 0;
  border: 1px solid rgba(79, 70, 229, 0.15);
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.08);
}
.stats-header-sub {
  margin: 0;
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.55;
}
.chrono-stamp {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 3px 10px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 10.5px;
  font-weight: 600;
  color: #4F46E5;
  background: rgba(79, 70, 229, 0.08);
  border: 1px solid rgba(79, 70, 229, 0.15);
  border-radius: 6px;
  letter-spacing: 0.06em;
}
.chrono-stamp.warn {
  color: #F59E0B;
  background: rgba(245, 158, 11, 0.08);
  border-color: rgba(245, 158, 11, 0.2);
}
.chrono-stamp.good {
  color: #10B981;
  background: rgba(16, 185, 129, 0.08);
  border-color: rgba(16, 185, 129, 0.2);
}

.stat-card {
  position: relative;
  overflow: hidden;
}
.stat-card::after {
  content: '';
  position: absolute;
  top: -40%;
  right: -20%;
  width: 160px;
  height: 160px;
  border-radius: 50%;
  opacity: 0.15;
  pointer-events: none;
  filter: blur(24px);
}
.stat-card:nth-child(4n+1)::after { background: var(--module-1); }
.stat-card:nth-child(4n+2)::after { background: var(--module-2); }
.stat-card:nth-child(4n+3)::after { background: var(--module-3); }
.stat-card:nth-child(4n)::after   { background: var(--module-4); }

.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 600;
  letter-spacing: 0.02em;
  margin-bottom: 6px;
}
.stat-foot {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 4px;
  opacity: 0.85;
}
.stat-icon {
  width: 40px;
  height: 40px;
  border-radius: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  transition: transform 0.3s var(--ease-bounce);
}
.stat-card:hover .stat-icon {
  transform: rotate(-6deg) scale(1.08);
}
.stat-icon::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  opacity: 0.5;
  filter: blur(14px);
}
.stat-1 { background: rgba(79, 70, 229, 0.08); color: #4F46E5; }
.stat-1::after { background: #4F46E5; }
.stat-2 { background: rgba(14, 165, 233, 0.08); color: #0EA5E9; }
.stat-2::after { background: #0EA5E9; }
.stat-3 { background: rgba(16, 185, 129, 0.08); color: #10B981; }
.stat-3::after { background: #10B981; }
.stat-4 { background: rgba(245, 158, 11, 0.08); color: #F59E0B; }
.stat-4::after { background: #F59E0B; opacity: 0.3; }

.chart-card {
  transition: box-shadow var(--transition), border-color var(--transition);
  position: relative;
}
.chart-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 4px;
  padding-bottom: 10px;
  border-bottom: 1px solid #F1F5F9;
}
.chart-title {
  font-size: 14px;
  font-weight: 700;
  color: #0F172A;
  flex: 1;
  letter-spacing: 0.01em;
}

.stats-grid-2 {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 14px;
}

/* ═══════════ 响应式 ═══════════ */
@media (max-width: 900px) {
  .stats-grid-2 {
    grid-template-columns: 1fr !important;
  }
}
@media (max-width: 640px) {
  .stats-header-icon {
    width: 42px;
    height: 42px;
  }
  .chart-card, .stat-card {
    border-radius: 12px;
  }
  .chart-header {
    padding-bottom: 8px;
  }
}
</style>
