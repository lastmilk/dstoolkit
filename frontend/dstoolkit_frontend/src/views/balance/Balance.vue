<script setup lang="ts">
import { onMounted, ref } from 'vue'
import {
  ElSpace,
  ElSelect,
  ElOption,
  ElButton,
  ElStatistic,
  ElEmpty,
  ElIcon,
} from 'element-plus'
import {
  Wallet,
  Refresh,
  CircleCheck,
  CircleClose,
  Coin,
  Present,
  CreditCard,
  Key,
  Lightning,
  MagicStick,
} from '@element-plus/icons-vue'
import { request } from '@/utils/request'
import type { ApiKeyItem } from '@/types'

const apiKeys = ref<ApiKeyItem[]>([])
const keyId = ref<number | null>(null)
const loading = ref(false)
const result = ref<any>(null)

async function loadKeys(): Promise<void> {
  const res: any = await request.get('/apikeys')
  apiKeys.value = res.apiKeys
}

async function query(): Promise<void> {
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
  <div class="page-enter" style="display: flex; flex-direction: column; gap: 18px;">
      <div class="banner-glow-1"></div>
      <div class="banner-glow-2"></div>
      <div class="banner-inner">
        <div class="banner-title-block">
          <h1 class="chronos-page-title">
            余额
            <span class="title-accent">· 费用信息</span>
          </h1>
          <p class="chronos-page-sub">
            查看当前余额、消费记录与用量信息
          </p>
      </div>
    </div>

    <div class="chronos-panel query-toolbar">
      <div class="panel-corner tl"></div>
      <div class="panel-corner tr"></div>
      <div class="panel-corner bl"></div>
      <div class="panel-corner br"></div>
      <el-space align="center" :size="12" wrap class="query-wrap">
        <div class="key-picker-label">
          <el-icon :size="16" style="color: var(--primary);"><Key /></el-icon>
          <span>密钥选择</span>
        </div>
        <el-select
          v-model="keyId"
          placeholder="选择 API Key"
          class="key-select"
          clearable
        >
          <el-option
            v-for="k in apiKeys"
            :key="k.id"
            :label="`${k.name} (${k.masked})`"
            :value="k.id"
          />
        </el-select>
        <el-button type="primary" :loading="loading" :disabled="!keyId" @click="query">
          <template #icon><el-icon :size="15"><Refresh /></el-icon></template>
          查询余额
        </el-button>
      </el-space>
    </div>

    <el-empty
      v-if="apiKeys.length === 0"
      description="暂无密钥，请到个人中心添加 API Key"
      style="padding: 60px 0;"
    />

    <div v-loading="loading">
      <template v-if="result">
        <div
          class="chronos-panel status-card page-enter"
          :class="result.isAvailable ? 'available' : 'unavailable'"
        >
          <div class="panel-corner tl"></div>
          <div class="panel-corner tr"></div>
          <div class="panel-corner bl"></div>
          <div class="panel-corner br"></div>
          <el-space align="center" :size="12">
            <div :class="['status-icon', result.isAvailable ? 'icon-success' : 'icon-danger']">
              <el-icon :size="24">
                <CircleCheck v-if="result.isAvailable" />
                <CircleClose v-else />
              </el-icon>
            </div>
            <div class="status-text">
              <div class="status-title">
                密钥 {{ result.isAvailable ? '正常' : '余额不足' }}
                <span :class="['hud-tag', result.isAvailable ? 'ok' : 'bad']">
                  {{ result.isAvailable ? 'NORMAL' : 'LOW' }}
                </span>
              </div>
              <span style="font-size: 13px; color: var(--text-muted);">
                更新时间：{{ new Date().toLocaleString() }} · 数据正常
              </span>
            </div>
          </el-space>
        </div>

        <div class="balance-grid">
          <div
            v-for="(b, i) in result.balanceInfos || []"
            :key="i"
            class="chronos-panel balance-card page-enter glass-card"
            :style="{ animationDelay: `${50 * (Number(i) + 1)}ms` }"
          >
            <div class="panel-corner tl"></div>
            <div class="panel-corner tr"></div>
            <div class="panel-corner bl"></div>
            <div class="panel-corner br"></div>
            <div class="balance-glow"></div>

            <div class="balance-head">
              <div>
                <div class="balance-eyebrow">
                  <el-icon :size="12" style="color: var(--primary);"><Lightning /></el-icon>
                  CURRENT BALANCE
                </div>
                <div class="balance-label">当前余额</div>
                <div class="balance-amount">
                  <span class="amount-num">
                    <el-statistic :value="b.totalBalance" :precision="2" />
                  </span>
                  <span class="amount-unit">{{ b.currency || 'CNY' }}</span>
                </div>
              </div>
              <div class="balance-icon">
                <el-icon :size="20"><Coin /></el-icon>
              </div>
            </div>

            <div class="balance-divider">
              <span class="divider-dot"></span>
              <span class="divider-line"></span>
              <span class="divider-dot accent"></span>
            </div>

            <div class="balance-rows">
              <div class="balance-row">
                <div class="row-left">
                  <el-icon :size="14" style="color: var(--success);"><Present /></el-icon>
                  <span>赠款余额</span>
                </div>
                <span class="row-val success">{{ b.grantedBalance }}</span>
              </div>
              <div class="balance-row">
                <div class="row-left">
                  <el-icon :size="14" style="color: var(--primary);"><CreditCard /></el-icon>
                  <span>充值余额</span>
                </div>
                <span class="row-val primary">{{ b.toppedUpBalance }}</span>
              </div>
            </div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.chronos-page-banner {
  position: relative;
  padding: 22px 24px;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, rgba(0, 212, 255, 0.08) 0%, rgba(255, 90, 140, 0.07) 50%, rgba(168, 85, 247, 0.08) 100%),
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
  background: radial-gradient(circle, #EC4899 0%, transparent 70%);
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
  color: #EC4899;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 4px 10px;
  background: rgba(255, 90, 140, 0.08);
  border-radius: 4px;
  border: 1px solid rgba(255, 90, 140, 0.18);
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
  color: var(--accent);
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

.banner-visual {
  width: 110px; height: 110px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.energy-orbit {
  position: relative;
  width: 100%; height: 100%;
}
.orbit-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px dashed;
}
.orbit-ring.r1 {
  border-color: rgba(0, 212, 255, 0.3);
  animation: orbit-spin 12s linear infinite;
}
.orbit-ring.r2 {
  inset: 15px;
  border-color: rgba(168, 85, 247, 0.35);
  animation: orbit-spin 8s linear infinite reverse;
}
.orbit-core {
  position: absolute;
  inset: 30px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.18), rgba(168, 85, 247, 0.18));
  border: 1px solid rgba(0, 212, 255, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 30px rgba(0, 212, 255, 0.2), inset 0 0 20px rgba(168, 85, 247, 0.1);
}
@keyframes orbit-spin { to { transform: rotate(360deg); } }

.query-toolbar { padding: 18px 20px; }
.query-wrap { width: 100%; }
.key-picker-label {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: rgba(0, 212, 255, 0.08);
  border: 1px solid rgba(0, 212, 255, 0.18);
  border-radius: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--primary);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.03em;
}
.key-select { width: 360px; min-width: 240px; flex: 1; }

.status-card {
  padding: 22px 24px;
  margin-bottom: 16px;
  border-left: 4px solid var(--success);
  overflow: hidden;
  position: relative;
}
.status-card.unavailable { border-left-color: var(--danger); }
.status-card::before {
  content: '';
  position: absolute;
  right: 0; top: 0; bottom: 0;
  width: 200px;
  background: radial-gradient(circle at right center, rgba(16, 185, 129, 0.1) 0%, transparent 70%);
  pointer-events: none;
}
.status-card.unavailable::before {
  background: radial-gradient(circle at right center, rgba(239, 68, 68, 0.1) 0%, transparent 70%);
}
.status-icon {
  width: 46px; height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.status-icon::after {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: 12px;
  filter: blur(8px);
  opacity: 0.4;
}
.icon-success {
  background: var(--success-soft);
  color: var(--success);
}
.icon-success::after { background: var(--success); }
.icon-danger {
  background: var(--danger-soft);
  color: var(--danger);
}
.icon-danger::after { background: var(--danger); }
.status-title {
  font-size: 17px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 2px;
  display: flex;
  align-items: center;
  gap: 10px;
}
.hud-tag {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 2px 8px;
  border-radius: 4px;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}
.hud-tag.ok {
  background: rgba(16, 185, 129, 0.15);
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.3);
}
.hud-tag.bad {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.balance-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
.balance-card {
  padding: 22px;
  position: relative;
  overflow: hidden;
  transition: all var(--transition);
}
.balance-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 10px 30px rgba(0,0,0,0.25), 0 0 25px rgba(0, 212, 255, 0.08);
  border-color: rgba(0, 212, 255, 0.3);
}
.balance-glow {
  position: absolute;
  top: -40px; right: -40px;
  width: 160px; height: 160px;
  background: radial-gradient(circle, rgba(0, 212, 255, 0.2) 0%, transparent 65%);
  pointer-events: none;
}

.balance-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  margin-bottom: 16px;
  position: relative;
  z-index: 1;
}
.balance-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: var(--primary);
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  margin-bottom: 6px;
  opacity: 0.9;
}
.balance-label {
  font-size: 12px;
  color: var(--text-muted);
  font-weight: 500;
  margin-bottom: 6px;
}
.balance-amount {
  display: flex;
  align-items: baseline;
  gap: 6px;
}
.amount-num {
  font-size: 32px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  background: linear-gradient(135deg, var(--primary) 0%, var(--accent) 60%, #EC4899 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}
.amount-unit {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-muted);
}
.balance-icon {
  width: 42px; height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.15), rgba(168, 85, 247, 0.15));
  color: var(--primary);
  border: 1px solid rgba(0, 212, 255, 0.2);
}

.balance-divider {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 14px;
}
.divider-dot {
  width: 4px; height: 4px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 4px var(--primary);
}
.divider-dot.accent { background: var(--accent); box-shadow: 0 0 4px var(--accent); }
.divider-line {
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, var(--primary) 0%, var(--border-subtle) 50%, var(--accent) 100%);
  opacity: 0.4;
}

.balance-rows { display: flex; flex-direction: column; gap: 8px; position: relative; z-index: 1; }
.balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  background: var(--surface-2);
  border-radius: var(--radius-sm);
  border: 1px solid var(--border-subtle);
}
.row-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}
.row-val { font-weight: 700; font-size: 14px; font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace; }
.row-val.success { color: var(--success); }
.row-val.primary { color: var(--primary); }

@media (max-width: 720px) {
  .chronos-page-banner { padding: 18px 16px; }
  .chronos-page-title { font-size: 20px; }
  .banner-visual { order: -1; width: 88px; height: 88px; }
  .query-toolbar { padding: 16px; }
  .status-card { padding: 18px 16px; }
  .balance-grid { grid-template-columns: 1fr; }
}
@media (max-width: 480px) {
  .chronos-page-banner { padding: 16px 14px; }
  .chronos-page-title { font-size: 18px; }
  .chronos-page-sub { font-size: 12.5px; }
  .query-toolbar { padding: 14px 12px; }
  .amount-num { font-size: 28px; }
}
</style>
