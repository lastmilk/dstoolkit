<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  NSpace,
  NSelect,
  NButton,
  NText,
  NStatistic,
  NEmpty,
  NSpin,
  NCard,
  NTag,
} from 'naive-ui'
import { request } from '@/utils/request'
import type { ApiKeyItem } from '@/types'

const apiKeys = ref<ApiKeyItem[]>([])
const keyId = ref<number | null>(null)
const loading = ref(false)
const result = ref<any>(null)

async function loadKeys() {
  const res: any = await request.get('/apikeys')
  apiKeys.value = res.apiKeys
}

async function query() {
  if (!keyId.value) return
  loading.value = true
  result.value = null
  try {
    const res: any = await request.get(`/balance/${keyId.value}`)
    result.value = res.balance
  } finally {
    loading.value = false
  }
}

onMounted(loadKeys)
</script>

<template>
  <div>
    <h2 style="margin: 0 0 16px;">余额查询</h2>
    <NSpace align="center" :size="12" style="margin-bottom: 16px;">
      <NSelect
        v-model:value="keyId"
        :options="apiKeys.map((k) => ({ label: `${k.name} (${k.masked})`, value: k.id }))"
        placeholder="选择已保存的 API Key"
        style="width: 320px;"
      />
      <NButton type="primary" :loading="loading" :disabled="!keyId" @click="query">查询余额</NButton>
    </NSpace>

    <NEmpty v-if="apiKeys.length === 0" description="还没有保存 API Key，请到个人中心添加" style="padding: 40px 0;" />

    <NSpin :show="loading">
      <NCard v-if="result" class="neu-card" :bordered="false">
        <NSpace align="center" :size="12" style="margin-bottom: 16px;">
          <NTag :type="result.isAvailable ? 'success' : 'error'" size="small">
            {{ result.isAvailable ? '可用' : '不可用' }}
          </NTag>
        </NSpace>
        <NSpace :size="24" wrap>
          <div v-for="(b, i) in result.balanceInfos || []" :key="i">
            <NStatistic :label="`余额 (${b.currency || 'CNY'})`" :value="b.totalBalance" />
            <NText depth="3" style="font-size: 12px;">赠款：{{ b.grantedBalance }} / 充值：{{ b.toppedUpBalance }}</NText>
          </div>
        </NSpace>
      </NCard>
    </NSpin>
  </div>
</template>
