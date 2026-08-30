<script setup lang="ts">
/**
 * 统计分析页（Element-Plus 版本）
 *  - 4 张玻璃拟态指标卡（hover 微交互：translateY(-4px) 缩放）
 *  - ECharts：折线平滑 + 渐变面积；饼图改空心甜甜圈（中心显示总数）
 *  - 24h 活跃分布柱状：圆角 + 渐变
 *  - 全量使用 Element-Plus / @element-plus/icons-vue，不再依赖 naive-ui
 */
import { computed, onMounted, ref } from 'vue'
import {
  ElRow, ElCol, ElIcon, ElEmpty, ElStatistic, ElSpace,
} from 'element-plus'
import {
  DataAnalysis, ChatDotRound, ChatLineRound, Brush,
  Timer, TrendCharts,
} from '@element-plus/icons-vue'
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

// ═══════════ 统一色板（玻璃拟态友好浅色 palette）═══════════
const chronosCyan = 'var(--el-color-primary, #4F46E5)'
const chronosPurple = '#0EA5E9'
const chronosGreen = '#10B981'
const chronosAmber = '#F59E0B'
const chronosPink = '#EF4444'
const chronosTeal = '#14B8A6'

const paletteDonut = ['#4F46E5', '#0EA5E9', '#10B981', '#F59E0B', '#EF4444', '#14B8A6', '#8B5CF6', '#EC4899']

// —— 图形公共（玻璃拟态下改用透明分割线与柔和文字颜色）——
const axisText = 'rgba(100, 116, 139, 0.85)'
const axisLine = 'rgba(148, 163, 184, 0.35)'
const splitLine = 'rgba(148, 163, 184, 0.22)'
const tooltipBg = 'rgba(255,255,255,0.85)'
const tooltipBorder = 'rgba(148, 163, 184, 0.45)'
const tooltipText = '#0F172A'
const legendText = 'rgba(100, 116, 139, 0.9)'

const sharedTooltip = {
  trigger: 'axis' as const,
  backgroundColor: tooltipBg,
  borderColor: tooltipBorder,
  borderWidth: 1,
  textStyle: { color: tooltipText, fontSize: 12 },
  extraCssText: 'box-shadow: 0 10px 28px rgba(15, 23, 42, 0.10); backdrop-filter: blur(8px); border-radius: 10px;',
}

const totalModels = computed(() => (stats.value.modelDistribution || []).reduce((s: number, d: any) => s + (d.count ?? 0), 0))

// ————— 每日消息量趋势（双折线 + 都平滑 + 面积叠加）—————
const msgLineOption = computed(() => ({
  tooltip: sharedTooltip,
  legend: {
    data: ['用户提问', 'AI 响应'],
    top: 0,
    right: 4,
    textStyle: { color: legendText, fontSize: 12 },
    icon: 'roundRect',
    itemWidth: 12,
    itemHeight: 4,
  },
  grid: { left: 42, right: 18, top: 44, bottom: 30 },
  xAxis: {
    type: 'category' as const,
    boundaryGap: false,
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
      smoothMonotone: 'x' as const,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: false,
      data: (stats.value.dailyMessages || []).map((d: any) => d.user),
      itemStyle: { color: chronosCyan, borderColor: '#FFFFFF', borderWidth: 1 },
      lineStyle: { width: 2.5, color: chronosCyan, shadowColor: 'rgba(79, 70, 229, 0.22)', shadowBlur: 8 },
      areaStyle: {
        opacity: 0.6,
        color: {
          type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(79, 70, 229, 0.26)' },
            { offset: 1, color: 'rgba(79, 70, 229, 0.02)' },
          ],
        },
      },
    },
    {
      name: 'AI 响应',
      type: 'line' as const,
      smooth: true,
      smoothMonotone: 'x' as const,
      symbol: 'circle',
      symbolSize: 5,
      showSymbol: false,
      areaStyle: {
        opacity: 0.55,
        color: {
          type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(14, 165, 233, 0.26)' },
            { offset: 1, color: 'rgba(14, 165, 233, 0.02)' },
          ],
        },
      },
      data: (stats.value.dailyMessages || []).map((d: any) => d.assistant),
      itemStyle: { color: chronosPurple, borderColor: '#FFFFFF', borderWidth: 1 },
      lineStyle: { width: 2.5, color: chronosPurple, shadowColor: 'rgba(14, 165, 233, 0.22)', shadowBlur: 8 },
    },
  ],
}))

// ————— 每日对话数（平滑 + 单折线）—————
const convLineOption = computed(() => ({
  tooltip: sharedTooltip,
  grid: { left: 42, right: 18, top: 20, bottom: 30 },
  xAxis: {
    type: 'category' as const,
    boundaryGap: false,
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
    smoothMonotone: 'x' as const,
    symbol: 'circle',
    symbolSize: 5,
    showSymbol: false,
    areaStyle: {
      opacity: 0.7,
      color: {
        type: 'linear' as const, x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: 'rgba(16, 185, 129, 0.28)' },
          { offset: 1, color: 'rgba(16, 185, 129, 0.02)' },
        ],
      },
    },
    data: (stats.value.dailyConversations || []).map((d: any) => d.count),
    itemStyle: { color: chronosGreen, borderColor: '#FFFFFF', borderWidth: 1 },
    lineStyle: { width: 2.6, color: chronosGreen, shadowColor: 'rgba(16, 185, 129, 0.24)', shadowBlur: 10 },
  }],
}))

// ————— 模型使用分布（空心甜甜圈 + 中心总数）—————
const pieOption = computed(() => {
  const data = (stats.value.modelDistribution || []).map((d: any, i: number) => ({
    name: d.model,
    value: d.count,
    itemStyle: { color: paletteDonut[i % paletteDonut.length] },
  }))
  return {
    tooltip: {
      trigger: 'item' as const,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      borderWidth: 1,
      textStyle: { color: tooltipText, fontSize: 12 },
      extraCssText: 'box-shadow: 0 10px 28px rgba(15, 23, 42, 0.10); backdrop-filter: blur(8px); border-radius: 10px;',
      formatter: '{b}<br/>次数：{c} ({d}%)',
    },
    legend: {
      bottom: 0,
      textStyle: { color: legendText, fontSize: 11 },
      itemWidth: 8,
      itemHeight: 8,
      type: 'scroll' as const,
      pageIconColor: chronosCyan,
      pageTextStyle: { color: axisText },
    },
    title: {
      text: `${totalModels.value}`,
      subtext: '总调用次数',
      left: 'center',
      top: '38%',
      textStyle: {
        fontSize: 24,
        fontWeight: 700,
        color: 'var(--text, #0F172A)',
        fontFamily: 'var(--font-family-harmony)',
      },
      subtextStyle: {
        fontSize: 11,
        color: 'var(--text-muted, #64748B)',
      },
    },
    series: [
      {
        type: 'pie' as const,
        radius: ['55%', '78%'],   // 甜甜圈：内径大 -> 更"空"
        center: ['50%', '45%'],
        avoidLabelOverlap: true,
        padAngle: 1.2,
        itemStyle: {
          borderRadius: 8,
          borderColor: 'var(--surface, #FFFFFF)',
          borderWidth: 2.5,
          shadowColor: 'rgba(15, 23, 42, 0.08)',
          shadowBlur: 18,
        },
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 6,
          label: { show: true, position: 'outside', fontSize: 12, fontWeight: 700, color: '#0F172A' },
          itemStyle: { shadowBlur: 22, shadowColor: 'rgba(15, 23, 42, 0.16)' },
        },
        data,
      },
    ],
  }
})

// ————— 24 小时活跃分布（圆角渐变柱）—————
const barOption = computed(() => ({
  tooltip: {
    ...sharedTooltip,
    formatter: (params: any[]) => {
      const p = Array.isArray(params) ? params[0] : params
      return `${p.axisValue}<br/>消息数：<b>${p.value}</b>`
    },
  },
  grid: { left: 42, right: 18, top: 20, bottom: 30 },
  xAxis: {
    type: 'category' as const,
    data: (stats.value.activeHours || []).map((d: any) => `${String(d.hour).padStart(2, '0')}`),
    axisLine: { lineStyle: { color: axisLine } },
    axisLabel: { color: axisText, fontSize: 9, interval: 2, formatter: (v: string) => `${v}h` },
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
    barWidth: '58%',
    data: (stats.value.activeHours || []).map((d: any) => d.count),
    itemStyle: {
      borderRadius: [6, 6, 0, 0],
      color: {
        type: 'linear' as const,
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: '#4F46E5' },
          { offset: 0.5, color: '#0EA5E9' },
          { offset: 1, color: '#14B8A6' },
        ],
      },
      shadowColor: 'rgba(79, 70, 229, 0.22)',
      shadowBlur: 10,
    },
  }],
}))

onMounted(load)
</script>

<template>
  <div class="stats-page">
    <!-- 页面头部 -->
    <div class="stats-header page-enter">
      <div class="stats-header-icon">
        <el-icon :size="22"><DataAnalysis /></el-icon>
      </div>
      <div class="stats-header-main">
        <div class="stats-head-meta">
          <span class="chrono-stamp">ANALYTICS // 数据分析</span>
        </div>
        <h2 class="stats-title">数据统计 · 使用分析</h2>
        <p class="stats-header-sub">
          全景掌握对话数据、模型使用情况与活跃时段趋势
        </p>
      </div>
    </div>

    <!-- Loading 遮罩 -->
    <div v-if="loading" class="stats-loading-wrap glass-card">
      <el-empty description="正在加载统计数据…" :image-size="60" />
    </div>

    <template v-else-if="!stats.totalConversations">
      <div class="glass-card stats-empty">
        <el-empty description="时间线无记录 · 等待首次对话" />
      </div>
    </template>

    <template v-else>
      <!-- 4 张指标卡：玻璃拟态 + hover 上浮 -->
      <el-row :gutter="14" class="page-enter stats-metric-row" justify="start">
        <el-col :xs="24" :sm="12" :lg="6">
          <div class="glass-card stat-card stat-card-accent stat-1">
            <div class="stat-card-inner">
              <div class="stat-info">
                <div class="stat-label">对话总数</div>
                <el-statistic :value="stats.totalConversations || 0">
                  <template #formatter>
                    <span class="stat-value">{{ stats.totalConversations || 0 }}</span>
                  </template>
                </el-statistic>
                <div class="stat-foot">共导入对话数</div>
              </div>
              <div class="stat-icon-wrap">
                <el-icon :size="20"><ChatDotRound /></el-icon>
              </div>
            </div>
            <div class="chronos-progress">
              <div class="chronos-progress-bar" :style="{ width: Math.min(100, stats.totalConversations * 2) + '%' }"></div>
            </div>
          </div>
        </el-col>

        <el-col :xs="24" :sm="12" :lg="6">
          <div class="glass-card stat-card stat-card-accent stat-2">
            <div class="stat-card-inner">
              <div class="stat-info">
                <div class="stat-label">消息总数</div>
                <el-statistic :value="stats.totalMessages || 0">
                  <template #formatter>
                    <span class="stat-value">{{ stats.totalMessages || 0 }}</span>
                  </template>
                </el-statistic>
                <div class="stat-foot">全部对话消息数</div>
              </div>
              <div class="stat-icon-wrap">
                <el-icon :size="20"><ChatLineRound /></el-icon>
              </div>
            </div>
            <div class="chronos-progress">
              <div class="chronos-progress-bar bar-2" :style="{ width: Math.min(100, stats.totalMessages * 0.4) + '%' }"></div>
            </div>
          </div>
        </el-col>

        <el-col :xs="24" :sm="12" :lg="6">
          <div class="glass-card stat-card stat-card-accent stat-3">
            <div class="stat-card-inner">
              <div class="stat-info">
                <div class="stat-label">模型种类</div>
                <el-statistic :value="(stats.modelDistribution || []).length">
                  <template #formatter>
                    <span class="stat-value">{{ (stats.modelDistribution || []).length }}</span>
                  </template>
                </el-statistic>
                <div class="stat-foot">已使用的模型数</div>
              </div>
              <div class="stat-icon-wrap">
                <el-icon :size="20"><Brush /></el-icon>
              </div>
            </div>
            <div class="chronos-progress">
              <div class="chronos-progress-bar bar-3" :style="{ width: Math.min(100, (stats.modelDistribution || []).length * 14) + '%' }"></div>
            </div>
          </div>
        </el-col>

        <el-col :xs="24" :sm="12" :lg="6">
          <div class="glass-card stat-card stat-card-accent stat-4">
            <div class="stat-card-inner">
              <div class="stat-info">
                <div class="stat-label">对话总天数</div>
                <el-statistic :value="(stats.dailyConversations || []).length">
                  <template #formatter>
                    <span class="stat-value">{{ (stats.dailyConversations || []).length }}</span>
                  </template>
                </el-statistic>
                <div class="stat-foot">有对话的天数</div>
              </div>
              <div class="stat-icon-wrap">
                <el-icon :size="20"><TrendCharts /></el-icon>
              </div>
            </div>
            <div class="chronos-progress">
              <div class="chronos-progress-bar bar-4" :style="{ width: Math.min(100, (stats.dailyConversations || []).length * 3) + '%' }"></div>
            </div>
          </div>
        </el-col>
      </el-row>

      <!-- 图表区：玻璃拟态卡片 -->
      <el-space :size="14" direction="vertical" fill style="width: 100%">
        <div class="glass-card chart-card page-enter">
          <div class="chart-header">
            <div class="chart-head-icon" style="color: #4F46E5;">
              <el-icon :size="16"><TrendCharts /></el-icon>
            </div>
            <div class="chart-title">每日消息量趋势</div>
            <span class="chrono-stamp">MSG-STREAM</span>
          </div>
          <VChart :option="msgLineOption" autoresize style="height: 290px; width: 100%;" />
        </div>

        <!-- 2 列图表：桌面2 / 移动1 -->
        <el-row :gutter="14">
          <el-col :xs="24" :lg="12">
            <div class="glass-card chart-card page-enter delay-1">
              <div class="chart-header">
                <div class="chart-head-icon" style="color: #10B981;">
                  <el-icon :size="16"><ChatDotRound /></el-icon>
                </div>
                <div class="chart-title">每日对话数</div>
                <span class="chrono-stamp good">CONV-LINE</span>
              </div>
              <VChart :option="convLineOption" autoresize style="height: 290px; width: 100%;" />
            </div>
          </el-col>
          <el-col :xs="24" :lg="12">
            <div class="glass-card chart-card page-enter delay-2">
              <div class="chart-header">
                <div class="chart-head-icon" style="color: #14B8A6;">
                  <el-icon :size="16"><Brush /></el-icon>
                </div>
                <div class="chart-title">模型使用分布</div>
                <span class="chrono-stamp good">MODEL-DIST</span>
              </div>
              <VChart :option="pieOption" autoresize style="height: 290px; width: 100%;" />
            </div>
          </el-col>
        </el-row>

        <div class="glass-card chart-card page-enter delay-3">
          <div class="chart-header">
            <div class="chart-head-icon" style="color: #F59E0B;">
              <el-icon :size="16"><Timer /></el-icon>
            </div>
            <div class="chart-title">24 小时活跃分布</div>
            <span class="chrono-stamp warn">HOUR-HEAT</span>
          </div>
          <VChart :option="barOption" autoresize style="height: 290px; width: 100%;" />
        </div>
      </el-space>
    </template>
  </div>
</template>

<style scoped>
.stats-page {
  width: 100%;
  padding: 4px 2px 32px;
}

/* ═══════════ 头部 ═══════════ */
.stats-header {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 18px 4px 20px;
  flex-wrap: wrap;
}
.stats-header-icon {
  width: 48px;
  height: 48px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.14), rgba(14, 165, 233, 0.12));
  color: var(--primary, #4F46E5);
  flex-shrink: 0;
  border: 1px solid rgba(79, 70, 229, 0.2);
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.12);
}
.stats-header-main { flex: 1; min-width: 0; }
.stats-head-meta {
  display: flex; align-items: center; gap: 8px; margin-bottom: 6px; flex-wrap: wrap;
}
.stats-title {
  margin: 0 0 4px;
  font-size: 22px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.01em;
  color: var(--text, #0F172A);
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
  background: rgba(79, 70, 229, 0.09);
  border: 1px solid rgba(79, 70, 229, 0.16);
  border-radius: 6px;
  letter-spacing: 0.06em;
}
.chrono-stamp.warn { color: #B45309; background: rgba(245, 158, 11, 0.10); border-color: rgba(245, 158, 11, 0.22); }
.chrono-stamp.good { color: #047857; background: rgba(16, 185, 129, 0.10); border-color: rgba(16, 185, 129, 0.22); }

.stats-loading-wrap,
.stats-empty {
  padding: 60px 12px;
  border-radius: 16px;
}

/* ═══════════ 指标卡：玻璃拟态 + 浮起微交互 ═══════════ */
.stats-metric-row { margin-bottom: 14px; }
.stat-card {
  position: relative;
  padding: 16px 16px 14px;
  border-radius: 16px;
  overflow: hidden;
  height: 100%;
  transition: transform var(--transition-fast) cubic-bezier(.2,.7,.2,1),
              box-shadow var(--transition-fast),
              border-color var(--transition-fast);
  will-change: transform;
}
.stat-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 30px rgba(15, 23, 42, 0.10), 0 0 0 1px var(--primary-soft);
}
.stat-card:active {
  transform: translateY(-1px) scale(0.995);
}

.stat-card::after {
  content: '';
  position: absolute;
  top: -40%;
  right: -20%;
  width: 170px;
  height: 170px;
  border-radius: 50%;
  opacity: 0.18;
  pointer-events: none;
  filter: blur(28px);
  transition: transform 0.4s var(--ease-bounce);
}
.stat-card:hover::after { transform: translate(-6px, 6px) scale(1.08); }
.stat-1::after { background: #4F46E5; }
.stat-2::after { background: #0EA5E9; }
.stat-3::after { background: #10B981; }
.stat-4::after { background: #F59E0B; opacity: 0.3; }

.stat-card-inner {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  position: relative;
  z-index: 1;
}
.stat-info { min-width: 0; flex: 1; }
.stat-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.02em;
  margin-bottom: 6px;
}
.stat-value {
  font-size: 30px;
  line-height: 1.1;
  font-weight: var(--font-weight-bold);
  color: var(--text, #0F172A);
  letter-spacing: -0.02em;
}
.stat-foot {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 6px;
  opacity: 0.9;
}
.stat-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  position: relative;
  transition: transform 0.3s var(--ease-bounce);
}
.stat-card:hover .stat-icon-wrap {
  transform: rotate(-6deg) scale(1.08);
}
.stat-icon-wrap::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  filter: blur(14px);
  opacity: 0.6;
}
.stat-1 .stat-icon-wrap { background: rgba(79, 70, 229, 0.10); color: #4F46E5; }
.stat-1 .stat-icon-wrap::after { background: #4F46E5; }
.stat-2 .stat-icon-wrap { background: rgba(14, 165, 233, 0.10); color: #0EA5E9; }
.stat-2 .stat-icon-wrap::after { background: #0EA5E9; }
.stat-3 .stat-icon-wrap { background: rgba(16, 185, 129, 0.10); color: #10B981; }
.stat-3 .stat-icon-wrap::after { background: #10B981; }
.stat-4 .stat-icon-wrap { background: rgba(245, 158, 11, 0.10); color: #D97706; }
.stat-4 .stat-icon-wrap::after { background: #F59E0B; opacity: 0.5; }

/* 进度条 */
.chronos-progress {
  height: 6px;
  margin-top: 14px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.18);
  overflow: hidden;
  position: relative;
  z-index: 1;
}
.chronos-progress-bar {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #4F46E5, #0EA5E9);
  box-shadow: 0 0 0 1px rgba(255,255,255,0.25) inset;
  transition: width 0.8s cubic-bezier(.2,.7,.2,1);
}
.bar-2 { background: linear-gradient(90deg, #0EA5E9, #38BDF8); }
.bar-3 { background: linear-gradient(90deg, #10B981, #34D399); }
.bar-4 { background: linear-gradient(90deg, #F59E0B, #FBBF24); }

/* ═══════════ 图表面板 ═══════════ */
.chart-card {
  padding: 16px 16px 10px;
  border-radius: 16px;
  height: 100%;
  transition: transform var(--transition-fast) cubic-bezier(.2,.7,.2,1),
              box-shadow var(--transition-fast),
              border-color var(--transition-fast);
}
.chart-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 18px 32px rgba(15, 23, 42, 0.10);
}
.chart-card:active {
  transform: translateY(-1px) scale(0.997);
}
.chart-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--border);
}
.chart-head-icon {
  width: 28px; height: 28px;
  border-radius: 8px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--primary-soft);
}
.chart-title {
  font-size: 14.5px;
  font-weight: var(--font-weight-bold);
  color: var(--text, #0F172A);
  flex: 1;
  letter-spacing: 0.01em;
}

/* ═══════════ 响应式 ═══════════ */
@media (max-width: 640px) {
  .stats-header { padding: 12px 2px 16px; }
  .stats-title { font-size: 19px; }
  .stat-value { font-size: 26px; }
  .chart-card { border-radius: 14px; padding: 12px 12px 8px; }
  .stat-card { padding: 14px; border-radius: 14px; }
}
</style>
