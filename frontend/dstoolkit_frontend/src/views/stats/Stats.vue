<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { NSpace, NSpin, NEmpty, NStatistic, NGrid, NGridItem } from 'naive-ui'
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

const msgLineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['用户', 'AI'] },
  grid: { left: 40, right: 20, top: 40, bottom: 30 },
  xAxis: { type: 'category', data: (stats.value.dailyMessages || []).map((d: any) => d.date) },
  yAxis: { type: 'value' },
  series: [
    { name: '用户', type: 'line', smooth: true, data: (stats.value.dailyMessages || []).map((d: any) => d.user) },
    { name: 'AI', type: 'line', smooth: true, areaStyle: {}, data: (stats.value.dailyMessages || []).map((d: any) => d.assistant) },
  ],
}))

const convLineOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 20, top: 20, bottom: 30 },
  xAxis: { type: 'category', data: (stats.value.dailyConversations || []).map((d: any) => d.date) },
  yAxis: { type: 'value' },
  series: [{ name: '对话数', type: 'line', smooth: true, areaStyle: {}, data: (stats.value.dailyConversations || []).map((d: any) => d.count) }],
}))

const pieOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [
    {
      type: 'pie',
      radius: ['40%', '70%'],
      data: (stats.value.modelDistribution || []).map((d: any) => ({ name: d.model, value: d.count })),
    },
  ],
}))

const barOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 40, right: 20, top: 20, bottom: 30 },
  xAxis: { type: 'category', data: (stats.value.activeHours || []).map((d: any) => `${d.hour}:00`) },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: (stats.value.activeHours || []).map((d: any) => d.count), itemStyle: { color: '#4d6bfe' } }],
}))

onMounted(load)
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px;">统计图</h2>
    <NSpin :show="loading">
      <NEmpty v-if="!loading && !stats.totalConversations" description="暂无数据" style="padding: 40px 0;" />
      <template v-else>
        <NGrid :cols="4" :x-gap="16" :y-gap="16" style="margin-bottom: 16px;" responsive="screen">
          <NGridItem><div class="neu-card"><NStatistic label="对话总数" :value="stats.totalConversations || 0" /></div></NGridItem>
          <NGridItem><div class="neu-card"><NStatistic label="消息总数" :value="stats.totalMessages || 0" /></div></NGridItem>
          <NGridItem><div class="neu-card"><NStatistic label="模型种类" :value="(stats.modelDistribution || []).length" /></div></NGridItem>
          <NGridItem><div class="neu-card"><NStatistic label="活跃时段峰值" :value="Math.max(0, ...(stats.activeHours || []).map((d:any)=>d.count))" /></div></NGridItem>
        </NGrid>
        <NSpace vertical :size="16">
          <div class="neu-card"><VChart :option="msgLineOption" autoresize style="height: 280px;" /></div>
          <NSpace :size="16" wrap>
            <div class="neu-card" style="flex: 1; min-width: 320px;"><VChart :option="convLineOption" autoresize style="height: 280px;" /></div>
            <div class="neu-card" style="width: 360px;"><VChart :option="pieOption" autoresize style="height: 280px;" /></div>
          </NSpace>
          <div class="neu-card"><VChart :option="barOption" autoresize style="height: 280px;" /></div>
        </NSpace>
      </template>
    </NSpin>
  </div>
</template>
