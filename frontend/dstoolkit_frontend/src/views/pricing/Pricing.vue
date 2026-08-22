<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { NSpace, NButton, NTag, NText, NCard, NConfigProvider } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const auth = useAuthStore()

interface Plan {
  tier: 'PRO' | 'PLUS' | 'ULTIMATE'
  name: string
  price: number
  priceNote: string
  duration: string
  features: string[]
  buyUrl: string
  permanentPrice?: number
  highlight?: boolean
}

const plans: Plan[] = [
  {
    tier: 'PRO',
    name: '高级版 Pro',
    price: 9.9,
    priceNote: '永久买断',
    duration: '永久',
    features: [
      'Free 的全部功能',
      '对话云存储 100MB + 1000 轮',
      '自定义分享（网页完整版 + 5 种主题 + 密码）',
      '更丰富的统计图表',
    ],
    buyUrl: 'https://www.kufaka.com/shop/DLJTWXUW',
  },
  {
    tier: 'PLUS',
    name: '顶级版 Plus',
    price: 29,
    priceNote: '年付',
    duration: '年付 / 永久',
    features: [
      'Free 的全部功能',
      '对话云存储 300MB + 无限轮',
      '自定义分享（完整版 + 5 主题 + 密码 + 个人专属短链）',
      '内测功能优先体验',
      'RESTful API 访问（60 次/分钟）',
      '更丰富的统计图表',
    ],
    buyUrl: 'https://www.kufaka.com/shop/DLJTWXUW',
    permanentPrice: 99,
    highlight: true,
  },
  {
    tier: 'ULTIMATE',
    name: '超强版 Ultimate',
    price: 99,
    priceNote: '年付',
    duration: '年付 / 永久',
    features: [
      'Free 的全部功能',
      '对话云存储 300MB + 无限轮',
      '自定义分享（完整版 + 5 主题 + 密码 + 个人专属短链）',
      '内测功能优先体验',
      'RESTful API 访问（300 次/分钟，更高限流）',
      '网站作者专属好友位',
      '开源版 PR 提交权限',
      '更丰富的统计图表',
    ],
    buyUrl: 'https://www.kufaka.com/shop/DLJTWXUW',
    permanentPrice: 299,
  },
]

const currentTier = computed(() => auth.effectiveTier)
function gotoBuy(url: string) {
  window.open(url, '_blank')
}
function gotoRedeem() {
  if (auth.isLoggedIn) router.push('/profile')
  else router.push({ name: 'login', query: { redirect: '/profile' } })
}
function gotoHome() {
  router.push(auth.isLoggedIn ? '/configs' : '/login')
}
</script>

<template>
  <div class="pricing-root">
    <header class="pricing-header">
      <div class="brand" @click="gotoHome">
        <span style="font-weight: 700; font-size: 20px; color: var(--primary);">Deepseek</span>
        <span style="font-size: 13px; color: var(--text-muted);">对话查看工具 · dstoolkit</span>
      </div>
      <NButton size="small" quaternary @click="gotoHome">
        {{ auth.isLoggedIn ? '返回工作台' : '登录 / 注册' }}
      </NButton>
    </header>

    <div class="pricing-hero">
      <h1>选择适合你的方案</h1>
      <p>从免费版起步，随时升级。卡密激活即用，永久买断无续费压力。</p>
    </div>

    <div class="plans">
      <NCard
        v-for="plan in plans"
        :key="plan.tier"
        class="plan-card neu-card"
        :class="{ highlighted: plan.highlight }"
        :bordered="false"
      >
        <div class="plan-head">
          <h2>{{ plan.name }}</h2>
          <NTag v-if="plan.highlight" type="success" size="small">最受欢迎</NTag>
        </div>
        <div class="plan-price">
          <span class="price">¥{{ plan.price }}</span>
          <span class="price-note">{{ plan.priceNote }}</span>
        </div>
        <div v-if="plan.permanentPrice" class="permanent-price">
          或 ¥{{ plan.permanentPrice }} 永久买断
        </div>
        <ul class="plan-features">
          <li v-for="(f, i) in plan.features" :key="i">{{ f }}</li>
        </ul>
        <NSpace vertical :size="8">
          <NButton
            type="primary"
            block
            @click="gotoBuy(plan.buyUrl)"
          >前往购买（卡密）</NButton>
          <NButton quaternary block size="small" @click="gotoRedeem">已有卡密？立即激活</NButton>
        </NSpace>
        <div v-if="currentTier === plan.tier" class="current-badge">
          <NTag type="info" size="small" round>当前等级</NTag>
        </div>
      </NCard>
    </div>

    <footer class="pricing-footer">
      <NText depth="3" style="font-size: 12px;">
        所有功能通过卡密充值实现。购买后前往个人中心 → 卡密激活，输入卡密即自动升级等级。
        Plus / Ultimate 支持年付与永久双档次。
      </NText>
    </footer>
  </div>
</template>

<style scoped>
.pricing-root {
  min-height: 100vh;
  background: var(--bg);
  display: flex;
  flex-direction: column;
}
.pricing-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
}
.brand {
  display: flex;
  flex-direction: column;
  cursor: pointer;
}
.pricing-hero {
  text-align: center;
  padding: 48px 24px 24px;
}
.pricing-hero h1 {
  margin: 0 0 8px;
  font-size: 28px;
}
.pricing-hero p {
  margin: 0;
  color: var(--text-muted);
  font-size: 14px;
}
.plans {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
  padding: 24px;
  max-width: 1100px;
  margin: 0 auto;
  width: 100%;
}
.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
}
.plan-card.highlighted {
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.plan-head h2 {
  margin: 0;
  font-size: 18px;
}
.plan-price {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 4px;
}
.price {
  font-size: 32px;
  font-weight: 700;
  color: var(--primary);
}
.price-note {
  font-size: 13px;
  color: var(--text-muted);
}
.permanent-price {
  font-size: 12px;
  color: var(--text-muted);
  margin-bottom: 16px;
}
.plan-features {
  list-style: none;
  padding: 0;
  margin: 0 0 20px;
  flex: 1;
}
.plan-features li {
  position: relative;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--text);
}
.plan-features li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--primary);
  font-weight: 700;
}
.current-badge {
  position: absolute;
  top: 12px;
  right: 12px;
}
.pricing-footer {
  text-align: center;
  padding: 24px;
  margin-top: auto;
}
</style>
