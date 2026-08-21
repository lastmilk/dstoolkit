<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { NSpace, NCard, NEmpty, NTag, NText, NSpin, NButton } from 'naive-ui'
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

onMounted(load)
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px;">应用市场</h2>
    <NSpin :show="loading">
      <NEmpty v-if="!loading && entries.length === 0" description="暂无收录" style="padding: 40px 0;" />
      <NSpace :size="16" wrap>
        <NCard
          v-for="e in entries"
          :key="e.id"
          class="neu-card"
          style="width: 320px;"
          :bordered="false"
          hoverable
        >
          <h3 style="margin: 0 0 8px;">{{ e.name }}</h3>
          <NTag size="small" style="margin-bottom: 8px;">{{ e.category }}</NTag>
          <NText depth="3" style="display: block; font-size: 13px; margin-bottom: 12px; min-height: 40px;">
            {{ e.description || '—' }}
          </NText>
          <NButton type="primary" ghost tag="a" :href="e.url" target="_blank">前往</NButton>
        </NCard>
      </NSpace>
    </NSpin>
  </div>
</template>
