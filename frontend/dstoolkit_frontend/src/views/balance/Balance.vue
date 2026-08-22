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
  NIcon,
} from 'naive-ui'
import {
  WalletOutline,
  RefreshOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  CashOutline,
  GiftOutline,
  CardOutline,
  KeyOutline,
} from '@vicons/ionicons5'
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
  <div class="page-enter">
    <!-- 页面头部 -->
    <div class="page-header" style="margin-bottom: 24px;">
      <NSpace align="center" :size="14" wrap>
        <div class="page-header-icon">
          <NIcon size="22"><WalletOutline /></NIcon>
        </div>
        <div style="flex: 1;">
          <h2 style="margin: 0 0 4px;">余额查询</h2>
          <p class="page-header-sub">
            实时查询你的 Deepseek API Key 余额、赠款及充值明细
          </p>
        </div>
      </NSpace>
    </div>

    <!-- 查询工具栏 -->
    <div class="surface query-toolbar" style="padding: 18px 20px; margin-bottom: 20px;">
      <NSpace align="center" :size="12" wrap>
        <div style="display: flex; align-items: center; gap: 10px; padding: 8px 14px; background: var(--primary-soft); border-radius: 10px;">
          <NIcon size="16" style="color: var(--primary);"><KeyOutline /></NIcon>
          <span style="font-size: 13px; font-weight: 500; color: var(--primary);">选择 API Key</span>
        </div>
        <NSelect
          v-model:value="keyId"
          :options="apiKeys.map((k) => ({ label: `${k.name} (${k.masked})`, value: k.id }))"
          placeholder="选择已保存的 API Key"
          style="width: 360px; min-width: 260px;"
          clearable
        />
        <NButton type="primary" :loading="loading" :disabled="!keyId" @click="query">
          <template #icon><NIcon size="15"><RefreshOutline /></NIcon></template>
          查询余额
        </NButton>
      </NSpace>
    </div>

    <NEmpty
      v-if="apiKeys.length === 0"
      description="还没有保存 API Key，请到个人中心添加"
      style="padding: 60px 0;"
    />

    <NSpin :show="loading">
      <template v-if="result">
        <!-- 状态卡片 -->
        <div
          class="surface status-card page-enter"
          :style="{
            padding: '22px 24px',
            marginBottom: '16px',
            background: result.isAvailable
              ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)'
              : 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(79, 70, 229, 0.04) 100%)',
          }"
        >
          <NSpace align="center" :size="12">
            <div
              :class="['status-icon', result.isAvailable ? 'icon-success' : 'icon-danger']"
              style="width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center;"
            >
              <NIcon size="24">
                <CheckmarkCircleOutline v-if="result.isAvailable" />
                <CloseCircleOutline v-else />
              </NIcon>
            </div>
            <div>
              <div style="font-size: 16px; font-weight: 600; color: var(--text); margin-bottom: 2px;">
                Key {{ result.isAvailable ? '可用' : '不可用' }}
              </div>
              <NText depth="3" style="font-size: 13px;">
                查询时间：{{ new Date().toLocaleString() }}
              </NText>
            </div>
          </NSpace>
        </div>

        <!-- 余额卡片网格 -->
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px;">
          <div
            v-for="(b, i) in result.balanceInfos || []"
            :key="i"
            class="surface balance-card page-enter"
            :style="{ padding: '22px 22px', animationDelay: `${40 * (Number(i) + 1)}ms` }"
          >
            <div style="display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 16px;">
              <div>
                <div style="font-size: 12px; color: var(--text-muted); font-weight: 500; margin-bottom: 6px;">
                  当前余额
                </div>
                <div class="balance-amount" style="font-size: 30px; font-weight: 700; letter-spacing: -0.02em; line-height: 1.2; background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;">
                  <NStatistic :value="b.totalBalance" :precision="2" />
                  <span style="font-size: 14px; font-weight: 500; color: var(--text-muted); -webkit-text-fill-color: var(--text-muted); margin-left: 4px;">
                    {{ b.currency || 'CNY' }}
                  </span>
                </div>
              </div>
              <div class="balance-icon" style="width: 42px; height: 42px; border-radius: 10px; display: flex; align-items: center; justify-content: center; background: var(--primary-soft); color: var(--primary);">
                <NIcon size="20"><CashOutline /></NIcon>
              </div>
            </div>

            <div style="border-top: 1px solid var(--border-subtle); padding-top: 14px;">
              <div class="balance-row" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary);">
                  <NIcon size="14" style="color: var(--success);"><GiftOutline /></NIcon>
                  赠款余额
                </div>
                <span style="font-weight: 600; color: var(--success); font-size: 14px;">
                  {{ b.grantedBalance }}
                </span>
              </div>
              <div class="balance-row" style="display: flex; align-items: center; justify-content: space-between; padding: 6px 0;">
                <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: var(--text-secondary);">
                  <NIcon size="14" style="color: var(--primary);"><CardOutline /></NIcon>
                  充值余额
                </div>
                <span style="font-weight: 600; color: var(--primary); font-size: 14px;">
                  {{ b.toppedUpBalance }}
                </span>
              </div>
            </div>
          </div>
        </div>
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
.query-toolbar {
  transition: box-shadow var(--transition);
}
.query-toolbar:hover {
  box-shadow: var(--shadow-sm);
}
.status-card {
  border-left: 4px solid;
  border-left-color: v-bind('result.isAvailable ? "var(--success)" : "var(--danger)"');
}
.icon-success {
  background: var(--success-soft);
  color: var(--success);
}
.icon-danger {
  background: var(--danger-soft);
  color: var(--danger);
}
.balance-card {
  transition: box-shadow var(--transition), transform var(--transition);
}
.balance-card:hover {
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
</style>
