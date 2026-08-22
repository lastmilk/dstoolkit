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

const primaryColor = '#4F46E5'
const accentColor = '#8B5CF6'
const successColor = '#10B981'

const msgLineOption = computed(() => ({
  tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#E2E8F0', borderWidth: 1, textStyle: { color: '#0F172A', fontSize: 12 } },
  legend: { data: ['用户', 'AI'], top: 0, right: 16, textStyle: { color: '#475569', fontSize: 12 } },
  grid: { left: 48, right: 24, top: 44, bottom: 36 },
  xAxis: {
    type: 'category',
    data: (stats.value.dailyMessages || []).map((d: any) => d.date),
    axisLine: { lineStyle: { color: '#E2E8F0' } },
    axisLabel: { color: '#94A3B8', fontSize: 11 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#F1F5F9' } },
    axisLabel: { color: '#94A3B8', fontSize: 11 },
  },
  series: [
    {
      name: '用户',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      data: (stats.value.dailyMessages || []).map((d: any) => d.user),
      itemStyle: { color: primaryColor },
      lineStyle: { width: 2.5, color: primaryColor },
    },
    {
      name: 'AI',
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 5,
      areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(139,92,246,0.25)' }, { offset: 1, color: 'rgba(139,92,246,0.02)' }] } },
      data: (stats.value.dailyMessages || []).map((d: any) => d.assistant),
      itemStyle: { color: accentColor },
      lineStyle: { width: 2.5, color: accentColor },
    },
  ],
}))

const convLineOption = computed(() => ({
  tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#E2E8F0', borderWidth: 1, textStyle: { color: '#0F172A', fontSize: 12 } },
  grid: { left: 48, right: 24, top: 24, bottom: 36 },
  xAxis: {
    type: 'category',
    data: (stats.value.dailyConversations || []).map((d: any) => d.date),
    axisLine: { lineStyle: { color: '#E2E8F0' } },
    axisLabel: { color: '#94A3B8', fontSize: 11 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#F1F5F9' } },
    axisLabel: { color: '#94A3B8', fontSize: 11 },
  },
  series: [{
    name: '对话数',
    type: 'line',
    smooth: true,
    symbol: 'circle',
    symbolSize: 5,
    areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: 'rgba(79,70,229,0.22)' }, { offset: 1, color: 'rgba(79,70,229,0.02)' }] } },
    data: (stats.value.dailyConversations || []).map((d: any) => d.count),
    itemStyle: { color: primaryColor },
    lineStyle: { width: 2.5, color: primaryColor },
  }],
}))

const pieOption = computed(() => {
  const palette = [primaryColor, accentColor, successColor, '#0EA5E9', '#F59E0B', '#EF4444', '#EC4899', '#14B8A6']
  return {
    tooltip: { trigger: 'item', backgroundColor: '#fff', borderColor: '#E2E8F0', borderWidth: 1, textStyle: { color: '#0F172A', fontSize: 12 } },
    legend: { bottom: 0, textStyle: { color: '#475569', fontSize: 12 }, itemWidth: 10, itemHeight: 10 },
    series: [
      {
        type: 'pie',
        radius: ['45%', '72%'],
        avoidLabelOverlap: true,
        itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
        label: { show: false },
        emphasis: { label: { show: true, fontSize: 13, fontWeight: 600 } },
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
  tooltip: { trigger: 'axis', backgroundColor: '#fff', borderColor: '#E2E8F0', borderWidth: 1, textStyle: { color: '#0F172A', fontSize: 12 } },
  grid: { left: 48, right: 24, top: 24, bottom: 36 },
  xAxis: {
    type: 'category',
    data: (stats.value.activeHours || []).map((d: any) => `${d.hour}:00`),
    axisLine: { lineStyle: { color: '#E2E8F0' } },
    axisLabel: { color: '#94A3B8', fontSize: 11 },
    axisTick: { show: false },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#F1F5F9' } },
    axisLabel: { color: '#94A3B8', fontSize: 11 },
  },
  series: [{
    type: 'bar',
    barWidth: '55%',
    data: (stats.value.activeHours || []).map((d: any) => d.count),
    itemStyle: {
      borderRadius: [4, 4, 0, 0],
      color: {
        type: 'linear',
        x: 0, y: 0, x2: 0, y2: 1,
        colorStops: [
          { offset: 0, color: primaryColor },
          { offset: 1, color: accentColor },
        ],
      },
    },
  }],
}))

onMounted(load)
</script>

<template>
  <div class="page-enter">
    <!-- 页面头部 -->
    <div class="page-header" style="margin-bottom: 24px;">
      <NSpace align="center" :size="14" wrap>
        <div class="page-header-icon">
          <NIcon size="22"><BarChartOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <h2 style="margin: 0 0 4px;">统计数据</h2>
          <p class="page-header-sub">
            全方位了解你的对话使用习惯，包括消息趋势、模型分布和活跃时段
          </p>
        </div>
      </NSpace>
    </div>

    <NSpin :show="loading">
      <NEmpty
        v-if="!loading && !stats.totalConversations"
        description="暂无数据"
        style="padding: 60px 0;"
      />
      <template v-else>
        <!-- 统计卡片 -->
        <NGrid :cols="4" :x-gap="16" :y-gap="16" style="margin-bottom: 20px;" responsive="screen">
          <NGridItem class="page-enter">
            <div class="surface stat-card" style="padding: 18px 20px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                <div>
                  <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 8px;">对话总数</div>
                  <NStatistic :value="stats.totalConversations || 0" style="--n-value-font-size: 26px;" />
                </div>
                <div class="stat-icon" style="background: var(--primary-soft); color: var(--primary);">
                  <NIcon size="18"><ChatbubblesOutline /></NIcon>
                </div>
              </div>
            </div>
          </NGridItem>
          <NGridItem class="page-enter delay-1">
            <div class="surface stat-card" style="padding: 18px 20px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                <div>
                  <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 8px;">消息总数</div>
                  <NStatistic :value="stats.totalMessages || 0" style="--n-value-font-size: 26px;" />
                </div>
                <div class="stat-icon" style="background: var(--accent-soft); color: var(--accent);">
                  <NIcon size="18"><ChatbubbleOutline /></NIcon>
                </div>
              </div>
            </div>
          </NGridItem>
          <NGridItem class="page-enter delay-2">
            <div class="surface stat-card" style="padding: 18px 20px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                <div>
                  <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 8px;">模型种类</div>
                  <NStatistic :value="(stats.modelDistribution || []).length" style="--n-value-font-size: 26px;" />
                </div>
                <div class="stat-icon" style="background: var(--success-soft); color: var(--success);">
                  <NIcon size="18"><ColorPaletteOutline /></NIcon>
                </div>
              </div>
            </div>
          </NGridItem>
          <NGridItem class="page-enter delay-3">
            <div class="surface stat-card" style="padding: 18px 20px;">
              <div style="display: flex; align-items: flex-start; justify-content: space-between;">
                <div>
                  <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 8px;">活跃时段峰值</div>
                  <NStatistic :value="Math.max(0, ...(stats.activeHours || []).map((d:any)=>d.count))" style="--n-value-font-size: 26px;" />
                </div>
                <div class="stat-icon" style="background: var(--info-soft); color: var(--info);">
                  <NIcon size="18"><TrendingUpOutline /></NIcon>
                </div>
              </div>
            </div>
          </NGridItem>
        </NGrid>

        <!-- 图表区 -->
        <NSpace vertical :size="16">
          <div class="surface chart-card page-enter" style="padding: 20px 20px 10px;">
            <div class="chart-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <NIcon size="16" style="color: var(--primary);"><TrendingUpOutline /></NIcon>
              <h4 style="margin: 0; font-size: 14px;">每日消息量趋势</h4>
            </div>
            <VChart :option="msgLineOption" autoresize style="height: 280px;" />
          </div>

          <div class="stats-grid-2" style="display: grid; grid-template-columns: minmax(0, 1fr) 380px; gap: 16px;">
            <div class="surface chart-card page-enter delay-1" style="padding: 20px 20px 10px;">
              <div class="chart-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <NIcon size="16" style="color: var(--accent);"><ChatbubblesOutline /></NIcon>
                <h4 style="margin: 0; font-size: 14px;">每日对话数</h4>
              </div>
              <VChart :option="convLineOption" autoresize style="height: 280px;" />
            </div>
            <div class="surface chart-card page-enter delay-2" style="padding: 20px 20px 10px;">
              <div class="chart-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                <NIcon size="16" style="color: var(--success);"><ColorPaletteOutline /></NIcon>
                <h4 style="margin: 0; font-size: 14px;">模型使用分布</h4>
              </div>
              <VChart :option="pieOption" autoresize style="height: 280px;" />
            </div>
          </div>

          <div class="surface chart-card page-enter delay-3" style="padding: 20px 20px 10px;">
            <div class="chart-header" style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
              <NIcon size="16" style="color: var(--info);"><TimeOutline /></NIcon>
              <h4 style="margin: 0; font-size: 14px;">24 小时活跃分布</h4>
            </div>
            <VChart :option="barOption" autoresize style="height: 280px;" />
          </div>
        </NSpace>
      </template>
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
.stat-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.stat-card {
  transition: box-shadow var(--transition), transform var(--transition);
}
.stat-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
.chart-card {
  transition: box-shadow var(--transition);
}
.chart-card:hover {
  box-shadow: var(--shadow-sm);
}
@media (max-width: 900px) {
  .stats-grid-2 {
    grid-template-columns: 1fr !important;
  }
}
</style>
