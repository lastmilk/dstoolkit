<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import {
  NIcon,
  NButton,
  NModal,
  NInput,
  NSpin,
  NSkeleton,
  NTag,
  NTooltip,
} from 'naive-ui'
import {
  SparklesOutline,
  RocketOutline,
  TrophyOutline,
  CheckmarkCircle,
  KeyOutline,
  ArrowForwardOutline,
  CloseOutline,
  TimeOutline,
  CloudOutline,
  ColorPaletteOutline,
  LockClosedOutline,
  LinkOutline,
  BarChartOutline,
  CodeSlashOutline,
  PersonCircleOutline,
  GitPullRequestOutline,
  RefreshOutline,
  CheckmarkCircleOutline,
  OpenOutline,
  GiftOutline,
  CubeOutline,
  HeadsetOutline,
  ShieldCheckmarkOutline,
  StarOutline,
} from '@vicons/ionicons5'
import { request } from '@/utils/request'
import { message } from '@/utils/naive'

// ═══════════ 类型 ═══════════
type Period = 'annual' | 'permanent'
type PaymentMethod = 'wechat' | 'alipay' | 'cardkey'
type ModalState = 'qr' | 'cardkey' | 'success'

interface BillingOption {
  period: Period
  price: number
  label: string
  unit: string
}

interface Feature {
  icon: any
  text: string
  highlight?: boolean
}

interface Tier {
  id: string
  name: string
  badge: string
  tagline: string
  icon: any
  color: string
  gradient: string
  highlight: boolean
  billing: BillingOption[]
  features: Feature[]
}

// ═══════════ 套餐数据 ═══════════
const tiers: Tier[] = [
  {
    id: 'pro',
    name: 'Pro',
    badge: '高级版',
    tagline: '适合个人轻度使用，解锁核心升级体验',
    icon: RocketOutline,
    color: '#0EA5E9',
    gradient: 'linear-gradient(135deg, #0EA5E9 0%, #38BDF8 100%)',
    highlight: false,
    billing: [
      { period: 'permanent', price: 39, label: '永久', unit: '一次买断' },
    ],
    features: [
      { icon: CheckmarkCircle, text: 'Free 版全部功能', highlight: true },
      { icon: CloudOutline, text: '100MB 对话云存储 + 1000 轮对话' },
      { icon: ColorPaletteOutline, text: '网页完整版分享 + 5 种主题' },
      { icon: LockClosedOutline, text: '分享密码保护' },
      { icon: BarChartOutline, text: '更多高级图表' },
      { icon: HeadsetOutline, text: '优先邮件支持' },
    ],
  },
  {
    id: 'plus',
    name: 'Plus',
    badge: '顶级版',
    tagline: '适合重度分享用户，加入专属短链与内测',
    icon: SparklesOutline,
    color: '#8B5CF6',
    gradient: 'linear-gradient(135deg, #8B5CF6 0%, #A78BFA 100%)',
    highlight: false,
    billing: [
      { period: 'annual', price: 29, label: '年费', unit: '/ 年' },
      { period: 'permanent', price: 99, label: '永久', unit: '一次买断' },
    ],
    features: [
      { icon: CheckmarkCircle, text: 'Free 版全部功能', highlight: true },
      { icon: CloudOutline, text: '100MB 对话云存储 + 1000 轮对话' },
      { icon: ColorPaletteOutline, text: '网页完整版分享 + 5 种主题' },
      { icon: LockClosedOutline, text: '分享密码保护' },
      { icon: LinkOutline, text: '个人专属短链（新增）', highlight: true },
      { icon: BarChartOutline, text: '更多高级图表' },
      { icon: CubeOutline, text: '优先功能内测资格' },
      { icon: HeadsetOutline, text: '专属客服通道' },
    ],
  },
  {
    id: 'ultimate',
    name: 'Ultimate',
    badge: '超能版',
    tagline: '适合开发者与重度用户，解锁全部高级权益',
    icon: TrophyOutline,
    color: '#4F46E5',
    gradient: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 50%, #0EA5E9 100%)',
    highlight: true,
    billing: [
      { period: 'annual', price: 59, label: '年费', unit: '/ 年' },
      { period: 'permanent', price: 199, label: '永久', unit: '一次买断' },
    ],
    features: [
      { icon: CheckmarkCircle, text: 'Free 版全部功能', highlight: true },
      { icon: CloudOutline, text: '300MB 对话云存储 + 1000 轮对话（升级）', highlight: true },
      { icon: ColorPaletteOutline, text: '网页完整版分享 + 5 种主题' },
      { icon: LockClosedOutline, text: '分享密码保护' },
      { icon: LinkOutline, text: '个人专属短链' },
      { icon: CodeSlashOutline, text: 'RESTful API 访问权限（新增）', highlight: true },
      { icon: PersonCircleOutline, text: '网站作者专属好友位（新增）', highlight: true },
      { icon: GitPullRequestOutline, text: '开源版 PR 提交权限（新增）', highlight: true },
      { icon: BarChartOutline, text: '更多高级图表' },
      { icon: ShieldCheckmarkOutline, text: '1 对 1 专属支持 + 功能定制建议权' },
    ],
  },
]

// ═══════════ 支付方式 ═══════════
const paymentMethods: {
  id: PaymentMethod
  name: string
  desc: string
  badge?: string
  available?: boolean
  brand: 'wechat' | 'alipay' | 'key'
}[] = [
  {
    id: 'wechat',
    name: '微信支付',
    desc: '推荐 · 扫码即付',
    badge: '推荐',
    brand: 'wechat',
  },
  {
    id: 'alipay',
    name: '支付宝',
    desc: '扫码或跳转支付',
    brand: 'alipay',
  },
  {
    id: 'cardkey',
    name: '卡密充值',
    desc: '备用方案 · 永久有效',
    badge: '备用',
    brand: 'key',
  },
]

// ═══════════ 状态 ═══════════
const selectedTier = ref<string>('ultimate')
const selectedBilling = ref<Record<string, Period>>({
  plus: 'annual',
  ultimate: 'annual',
})
const selectedPayment = ref<PaymentMethod>('wechat')

const paymentConfig = ref<{
  methods: { wechat: boolean; alipay: boolean; cardkey: boolean }
  cardKeyShopUrl?: string
  cardKeyDocsUrl?: string
} | null>(null)
const configLoading = ref(true)

const showModal = ref(false)
const modalState = ref<ModalState>('qr')
const cardKeyInput = ref('')
const redeeming = ref(false)
const creatingOrder = ref(false)
const countdown = ref(900)
let timer: number | null = null

// ═══════════ 计算属性 ═══════════
const currentTier = computed<Tier>(
  () => tiers.find((t) => t.id === selectedTier.value) as Tier,
)

const currentBilling = computed<BillingOption>(() => {
  const tier = currentTier.value
  if (tier.billing.length === 1) return tier.billing[0]!
  const period = selectedBilling.value[tier.id] || tier.billing[0]!.period
  return tier.billing.find((b) => b.period === period) as BillingOption
})

const currentPrice = computed(() => currentBilling.value.price)

const methodAvailability = computed(() => {
  const cfg = paymentConfig.value
  if (!cfg) return { wechat: false, alipay: false, cardkey: true }
  return {
    wechat: !!cfg.methods.wechat,
    alipay: !!cfg.methods.alipay,
    cardkey: cfg.methods.cardkey !== false, // 默认开启卡密
  }
})

const cardKeyShopUrl = computed(
  () => paymentConfig.value?.cardKeyShopUrl || 'https://www.kufaka.com/shop/DLJTWXUW',
)

// ═══════════ 方法 ═══════════
async function loadPaymentConfig() {
  configLoading.value = true
  try {
    const res: any = await request.get('/payment/config')
    paymentConfig.value = {
      methods: {
        wechat: !!res.methods?.wechat,
        alipay: !!res.methods?.alipay,
        cardkey: res.methods?.cardkey !== false,
      },
      cardKeyShopUrl: res.cardKeyShopUrl,
      cardKeyDocsUrl: res.cardKeyDocsUrl,
    }
  } catch {
    // 后端未配置，全部回退到卡密
    paymentConfig.value = {
      methods: { wechat: false, alipay: false, cardkey: true },
      cardKeyShopUrl: 'https://www.kufaka.com/shop/DLJTWXUW',
    }
  } finally {
    configLoading.value = false
    // 如果默认选中的微信不可用，自动切换到可用方式
    if (!methodAvailability.value.wechat && methodAvailability.value.alipay) {
      selectedPayment.value = 'alipay'
    } else if (!methodAvailability.value.wechat && !methodAvailability.value.alipay) {
      selectedPayment.value = 'cardkey'
    }
  }
}

function selectTier(tierId: string) {
  selectedTier.value = tierId
}

function selectBilling(tierId: string, period: Period) {
  selectedBilling.value[tierId] = period
}

function selectPayment(method: PaymentMethod) {
  selectedPayment.value = method
}

function getBilling(tier: Tier): BillingOption {
  if (tier.billing.length === 1) return tier.billing[0]!
  const period = selectedBilling.value[tier.id] || tier.billing[0]!.period
  return tier.billing.find((b) => b.period === period) as BillingOption
}

function startCheckout() {
  const method = selectedPayment.value
  const available = methodAvailability.value[method]
  if (!available) {
    message.info('当前支付方式暂未开通，已为你切换到卡密充值')
    selectedPayment.value = 'cardkey'
    modalState.value = 'cardkey'
    showModal.value = true
    return
  }
  if (method === 'cardkey') {
    modalState.value = 'cardkey'
    showModal.value = true
    return
  }
  // 微信 / 支付宝：调起二维码支付
  modalState.value = 'qr'
  showModal.value = true
  countdown.value = 900
  createOrder()
}

async function createOrder() {
  creatingOrder.value = true
  try {
    // 真实实现会调 /payment/order 创建订单并返回二维码 URL
    await request.post('/payment/order', {
      tier: selectedTier.value,
      period: currentBilling.value.period,
      method: selectedPayment.value,
    })
    // 后端预留未实现时静默通过，前端展示占位二维码
    startTimer()
  } catch {
    // 后端未实现下单接口，前端继续展示二维码占位
    startTimer()
  } finally {
    creatingOrder.value = false
  }
}

function startTimer() {
  if (timer) window.clearInterval(timer)
  timer = window.setInterval(() => {
    countdown.value -= 1
    if (countdown.value <= 0) {
      stopTimer()
    }
  }, 1000)
}

function stopTimer() {
  if (timer) {
    window.clearInterval(timer)
    timer = null
  }
}

function formatCountdown(s: number): string {
  const m = Math.max(0, Math.floor(s / 60))
  const sec = Math.max(0, s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function closePayment() {
  showModal.value = false
  stopTimer()
  cardKeyInput.value = ''
}

async function redeemCardKey() {
  const key = cardKeyInput.value.trim()
  if (!key) {
    message.warning('请输入卡密')
    return
  }
  redeeming.value = true
  try {
    const res: any = await request.post('/payment/redeem', {
      cardKey: key,
      tier: selectedTier.value,
      period: currentBilling.value.period,
    })
    message.success(res?.message || '卡密兑换成功，权益已到账')
    modalState.value = 'success'
  } catch {
    // 后端未实现 redeem 接口时给出友好提示
    message.error(
      '卡密兑换接口尚未启用，请联系管理员手动绑定，或前往卡密购买页确认商品',
    )
  } finally {
    redeeming.value = false
  }
}

function confirmPaid() {
  message.success('支付完成，权益将在几分钟内到账')
  closePayment()
}

function switchPaymentInModal() {
  closePayment()
}

function openCardKeyShop() {
  window.open(cardKeyShopUrl.value, '_blank')
}

function openCardKeyDocs() {
  const url = paymentConfig.value?.cardKeyDocsUrl
  if (url) window.open(url, '_blank')
}

onMounted(loadPaymentConfig)
onUnmounted(stopTimer)
</script>

<template>
  <div class="pricing-page page-enter">
    <!-- ═══════════ 页头 Banner ═══════════ -->
    <div class="chronos-page-banner pricing-banner">
      <div class="banner-glow-1"></div>
      <div class="banner-glow-2"></div>
      <div class="banner-inner">
        <div class="banner-title-block">
          <div class="chronos-eyebrow">
            <NIcon size="12"><SparklesOutline /></NIcon>
            <span>PRICING // 升级方案</span>
          </div>
          <h1 class="chronos-page-title">
            升级你的 <span class="title-accent">DSTOOLKIT</span> 体验
          </h1>
          <p class="chronos-page-sub">
            选择适合你的方案，解锁更多对话云存储、自定义分享服务与高级功能。
            Pro 仅提供永久买断；Plus 与 Ultimate 支持年费订阅与永久买断两档。
          </p>
        </div>
        <div class="banner-visual">
          <div class="pricing-emblem">
            <div class="emblem-ring r1"></div>
            <div class="emblem-ring r2"></div>
            <div class="emblem-core">
              <NIcon size="28" style="color: var(--primary);"><GiftOutline /></NIcon>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ═══════════ 套餐卡片 ═══════════ -->
    <section class="tier-grid">
      <article
        v-for="tier in tiers"
        :key="tier.id"
        :class="[
          'tier-card',
          { highlighted: tier.highlight, selected: selectedTier === tier.id },
        ]"
        :style="{
          '--tier-color': tier.color,
          '--tier-gradient': tier.gradient,
        }"
        @click="selectTier(tier.id)"
      >
        <!-- 顶部装饰条 -->
        <div class="tier-accent-bar"></div>

        <!-- 推荐 / 选中标记 -->
        <div class="tier-badges">
          <NTag
            v-if="tier.highlight"
            size="small"
            round
            :bordered="false"
            class="tier-tag-recommend"
          >
            <template #icon>
              <NIcon size="12"><StarOutline /></NIcon>
            </template>
            推荐
          </NTag>
          <NTag
            v-if="selectedTier === tier.id"
            size="small"
            round
            :bordered="false"
            class="tier-tag-selected"
          >
            <template #icon>
              <NIcon size="12"><CheckmarkCircleOutline /></NIcon>
            </template>
            已选择
          </NTag>
        </div>

        <!-- 套餐头 -->
        <header class="tier-head">
          <div class="tier-icon" :style="{ background: tier.gradient }">
            <NIcon size="22"><component :is="tier.icon" /></NIcon>
          </div>
          <div class="tier-name-block">
            <div class="tier-name">{{ tier.name }}</div>
            <div class="tier-badge-text">{{ tier.badge }}</div>
          </div>
        </header>

        <p class="tier-tagline">{{ tier.tagline }}</p>

        <!-- 计费切换 -->
        <div v-if="tier.billing.length > 1" class="billing-toggle">
          <button
            v-for="b in tier.billing"
            :key="b.period"
            :class="[
              'billing-tab',
              { active: getBilling(tier).period === b.period },
            ]"
            @click.stop="selectBilling(tier.id, b.period)"
          >
            {{ b.label }}
          </button>
        </div>

        <!-- 价格 -->
        <div class="tier-price">
          <span class="currency">¥</span>
          <span class="price-num">{{ getBilling(tier).price }}</span>
          <span class="price-unit">{{ getBilling(tier).unit }}</span>
        </div>

        <!-- 特权列表 -->
        <ul class="tier-features">
          <li
            v-for="(f, i) in tier.features"
            :key="i"
            :class="{ highlight: f.highlight }"
          >
            <NIcon size="14" class="feature-icon"><component :is="f.icon" /></NIcon>
            <span>{{ f.text }}</span>
          </li>
        </ul>

        <!-- CTA -->
        <button
          :class="['tier-cta', { primary: tier.highlight }]"
          @click.stop="selectTier(tier.id)"
        >
          升级到 {{ tier.name }}
          <NIcon size="14"><ArrowForwardOutline /></NIcon>
        </button>
      </article>
    </section>

    <!-- ═══════════ 支付方式 ═══════════ -->
    <section class="payment-section">
      <div class="section-head">
        <h2 class="section-title">选择支付方式</h2>
        <p class="section-sub">
          当前已选：
          <strong>{{ currentTier.name }} · {{ currentBilling.label }}</strong>
          · 应付 <span class="amount-due">¥{{ currentPrice }}</span>
        </p>
      </div>

      <div class="payment-methods">
        <NSpin v-if="configLoading" size="small">
          <div style="height: 96px;"></div>
        </NSpin>
        <template v-else>
          <label
            v-for="m in paymentMethods"
            :key="m.id"
            :class="[
              'payment-card',
              {
                selected: selectedPayment === m.id,
                disabled: !methodAvailability[m.id],
              },
            ]"
          >
            <input
              type="radio"
              name="payment"
              :value="m.id"
              :checked="selectedPayment === m.id"
              :disabled="!methodAvailability[m.id]"
              @change="selectPayment(m.id)"
            />

            <div :class="['payment-brand-icon', `brand-${m.brand}`]">
              <!-- 微信 -->
              <svg v-if="m.brand === 'wechat'" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="currentColor" d="M8.69 4C4.99 4 2 6.47 2 9.5c0 1.74.96 3.3 2.46 4.32-.13.43-.4 1.36-.46 1.55-.08.27.1.27.21.16.09-.07 1.43-1.05 1.93-1.42.78.22 1.62.34 2.5.34h.27a4.94 4.94 0 0 1-.18-2.3c-.18-.01-.36-.02-.54-.05-2.06-.3-3.62-1.66-3.62-3.27 0-1.81 1.96-3.27 4.38-3.27 2.06 0 3.8 1.06 4.24 2.49a6.5 6.5 0 0 1 2.49-.49h.27C16.34 5.85 12.81 4 8.69 4m9.79 5.27c-3.3 0-5.97 2.06-5.97 4.6 0 1.42.79 2.69 2.04 3.55-.1.35-.32 1.12-.36 1.27-.06.22.08.22.18.13.07-.06 1.18-.87 1.6-1.18.65.18 1.34.29 2.06.29 3.3 0 5.97-2.06 5.97-4.6 0-2.54-2.67-4.6-5.97-4.6m-9.69.81a.88.88 0 0 0 0 1.76.88.88 0 0 0 0-1.76m5.5 1.32a.73.73 0 1 0 0 1.46.73.73 0 0 0 0-1.46m4.27 0a.73.73 0 1 0 0 1.46.73.73 0 0 0 0-1.46Z"/>
              </svg>
              <!-- 支付宝 -->
              <svg v-else-if="m.brand === 'alipay'" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                <path fill="currentColor" d="M20.5 14.5c-.86-1.93-2.06-3.92-3.34-5.86C16.84 8.05 17 7.42 17 6.7c0-2.45-1.55-4.55-4.85-4.55-3.32 0-4.85 2.1-4.85 4.55 0 1.65.83 3.07 2.34 3.81.27 1.34.96 2.84 1.79 4.27-.34.08-.71.13-1.1.13-2.16 0-3.69-.69-3.69-1.7 0-.55.39-.99 1.06-1.32v-.62c-1.36.51-2.2 1.4-2.2 2.51 0 1.61 2.04 2.62 5.06 2.62.64 0 1.24-.07 1.79-.2.45.7.92 1.37 1.36 1.99H4.5C3.67 17.4 3 16.73 3 15.9V8.1C3 7.27 3.67 6.6 4.5 6.6h15c.83 0 1.5.67 1.5 1.5v6.4h-1.07c.36.66.7 1.34 1 2.04.21.51.34 1 .41 1.45l-.84-1.49Zm-7.7-10.5c1.6 0 2.65 1.06 2.65 2.5 0 1.45-1.05 2.5-2.65 2.5S10.15 7.95 10.15 6.5c0-1.44 1.05-2.5 2.65-2.5Z"/>
              </svg>
              <!-- 卡密 -->
              <NIcon v-else size="22"><KeyOutline /></NIcon>
            </div>

            <div class="payment-info">
              <div class="payment-name">
                {{ m.name }}
                <NTag
                  v-if="m.badge"
                  size="tiny"
                  round
                  :bordered="false"
                  class="payment-badge"
                >{{ m.badge }}</NTag>
              </div>
              <div class="payment-desc">
                <template v-if="!methodAvailability[m.id]">未开通 · 自动切换到卡密</template>
                <template v-else>{{ m.desc }}</template>
              </div>
            </div>

            <div class="payment-radio">
              <span class="radio-dot"></span>
            </div>
          </label>
        </template>
      </div>

      <!-- 卡密说明（仅当卡密选中时显示） -->
      <transition name="fade-slide">
        <div v-if="!configLoading && selectedPayment === 'cardkey'" class="cardkey-hint">
          <NIcon size="16" class="hint-icon"><KeyOutline /></NIcon>
          <div class="hint-text">
            <div class="hint-title">卡密充值说明</div>
            <div class="hint-desc">
              卡密为你提供免支付的兜底方案，永久有效，适合无法使用微信/支付宝的用户。
              卡密购买地址：<a :href="cardKeyShopUrl" target="_blank" rel="noopener" class="hint-link">
                {{ cardKeyShopUrl }}
                <NIcon size="11"><OpenOutline /></NIcon>
              </a>
            </div>
          </div>
        </div>
      </transition>

      <!-- 结算按钮 -->
      <div class="checkout-bar">
        <div class="checkout-summary">
          <span class="summary-label">应付金额</span>
          <div class="summary-price">
            <span class="cur">¥</span>
            <span class="num">{{ currentPrice }}</span>
            <span class="unit">/ {{ currentBilling.label }}</span>
          </div>
        </div>
        <NButton
          type="primary"
          size="large"
          :loading="creatingOrder"
          :disabled="configLoading"
          class="checkout-btn"
          @click="startCheckout"
        >
          <template #icon><NIcon size="16"><ArrowForwardOutline /></NIcon></template>
          立即升级 {{ currentTier.name }}
        </NButton>
      </div>
    </section>

    <!-- ═══════════ 底部说明 ═══════════ -->
    <section class="pricing-footer">
      <div class="footer-item">
        <NIcon size="18"><ShieldCheckmarkOutline /></NIcon>
        <span>所有方案均享受 Free 版全部功能，权益即时生效</span>
      </div>
      <div class="footer-item">
        <NIcon size="18"><RefreshOutline /></NIcon>
        <span>年费方案到期前 7 天将通过站内消息提醒续费</span>
      </div>
      <div class="footer-item">
        <NIcon size="18"><HeadsetOutline /></NIcon>
        <span>购买与权益问题请通过个人中心反馈，管理员会尽快处理</span>
      </div>
    </section>

    <!-- ═══════════ 支付模态框 ═══════════ -->
    <NModal
      :show="showModal"
      :mask-closable="false"
      :close-on-esc="true"
      @update:show="(v) => !v && closePayment()"
    >
      <div class="pay-modal">
        <!-- 头部 -->
        <div class="pay-modal-head">
          <div class="pay-modal-title">
            <NIcon v-if="modalState === 'qr'" size="18" class="head-icon">
              <component :is="selectedPayment === 'wechat' ? null : null" />
            </NIcon>
            <span v-if="modalState === 'qr'">
              {{ selectedPayment === 'wechat' ? '微信支付' : '支付宝' }}
            </span>
            <span v-else-if="modalState === 'cardkey'">卡密充值</span>
            <span v-else>支付完成</span>
          </div>
          <button class="pay-modal-close" @click="closePayment" aria-label="关闭">
            <NIcon size="18"><CloseOutline /></NIcon>
          </button>
        </div>

        <!-- 订单摘要 -->
        <div class="pay-summary">
          <div class="pay-summary-left">
            <div class="pay-tier-icon" :style="{ background: currentTier.gradient }">
              <NIcon size="18"><component :is="currentTier.icon" /></NIcon>
            </div>
            <div>
              <div class="pay-tier-name">
                {{ currentTier.name }} · {{ currentTier.badge }}
              </div>
              <div class="pay-tier-period">{{ currentBilling.label }} · {{ currentBilling.unit }}</div>
            </div>
          </div>
          <div class="pay-summary-price">
            <span class="cur">¥</span>
            <span class="num">{{ currentPrice }}</span>
          </div>
        </div>

        <!-- 状态：二维码 -->
        <div v-if="modalState === 'qr'" class="pay-body">
          <div class="qr-block">
            <div class="qr-frame">
              <div class="qr-placeholder">
                <!-- 占位二维码图案 -->
                <svg viewBox="0 0 100 100" width="180" height="180" aria-hidden="true">
                  <defs>
                    <pattern id="qrpat" x="0" y="0" width="10" height="10" patternUnits="userSpaceOnUse">
                      <rect width="10" height="10" fill="#0F172A"/>
                      <rect x="2" y="2" width="6" height="6" fill="#FFFFFF"/>
                      <rect x="2" y="2" width="3" height="3" fill="#0F172A"/>
                      <rect x="6" y="6" width="2" height="2" fill="#0F172A"/>
                    </pattern>
                  </defs>
                  <rect x="0" y="0" width="100" height="100" fill="url(#qrpat)"/>
                  <!-- 三个定位角 -->
                  <rect x="4" y="4" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
                  <rect x="10" y="10" width="10" height="10" fill="#0F172A"/>
                  <rect x="74" y="4" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
                  <rect x="80" y="10" width="10" height="10" fill="#0F172A"/>
                  <rect x="4" y="74" width="22" height="22" fill="#FFFFFF" stroke="#0F172A" stroke-width="3"/>
                  <rect x="10" y="80" width="10" height="10" fill="#0F172A"/>
                  <!-- 中央 logo -->
                  <rect x="40" y="40" width="20" height="20" rx="4" fill="#FFFFFF"/>
                  <rect x="44" y="44" width="12" height="12" rx="2" :fill="currentTier.color"/>
                </svg>
              </div>
              <NSpin v-if="creatingOrder" class="qr-loading" size="medium" />
            </div>
            <div class="qr-hint">
              请使用
              <strong>{{ selectedPayment === 'wechat' ? '微信' : '支付宝' }}</strong>
              扫描二维码完成支付
            </div>
            <div class="qr-timer">
              <NIcon size="13"><TimeOutline /></NIcon>
              <span class="timer-text" :class="{ urgent: countdown < 60 }">
                {{ countdown > 0 ? `${formatCountdown(countdown)} 后过期` : '已过期，请重新发起' }}
              </span>
              <button
                v-if="countdown <= 0"
                class="qr-refresh"
                @click="startCheckout"
              >
                <NIcon size="12"><RefreshOutline /></NIcon> 重新生成
              </button>
            </div>
          </div>
        </div>

        <!-- 状态：卡密 -->
        <div v-else-if="modalState === 'cardkey'" class="pay-body">
          <div class="cardkey-block">
            <div class="cardkey-icon">
              <NIcon size="32"><KeyOutline /></NIcon>
            </div>
            <div class="cardkey-title">输入卡密</div>
            <p class="cardkey-desc">
              请输入与所选套餐匹配的卡密（{{ currentTier.name }} · {{ currentBilling.label }}），
              提交后系统将自动校验并为你开通对应权益。
            </p>
            <NInput
              v-model:value="cardKeyInput"
              type="textarea"
              placeholder="粘贴你购买后获得的卡密（形如 DSTK-XXXX-XXXX-XXXX）"
              :rows="3"
              :autofocus="true"
              class="cardkey-input"
            />
            <div class="cardkey-actions">
              <NButton
                quaternary
                size="small"
                @click="openCardKeyDocs"
              >
                <NIcon size="14"><OpenOutline /></NIcon>
                查看卡密说明
              </NButton>
              <NButton
                size="small"
                type="primary"
                @click="openCardKeyShop"
              >
                前往购买卡密
                <NIcon size="12"><ArrowForwardOutline /></NIcon>
              </NButton>
            </div>
          </div>
        </div>

        <!-- 状态：成功 -->
        <div v-else class="pay-body">
          <div class="pay-success">
            <div class="success-icon">
              <NIcon size="48"><CheckmarkCircleOutline /></NIcon>
            </div>
            <div class="success-title">兑换成功</div>
            <p class="success-desc">
              你已成功开通 <strong>{{ currentTier.name }} · {{ currentBilling.label }}</strong>，
              相关权益将在几分钟内生效。如未即时到账，请刷新页面或联系管理员。
            </p>
          </div>
        </div>

        <!-- 底部操作 -->
        <div class="pay-modal-foot">
          <template v-if="modalState === 'qr'">
            <NButton quaternary @click="switchPaymentInModal">
              <NIcon size="14"><RefreshOutline /></NIcon>
              切换支付方式
            </NButton>
            <NButton type="primary" @click="confirmPaid">
              我已完成支付
            </NButton>
          </template>
          <template v-else-if="modalState === 'cardkey'">
            <NButton quaternary @click="closePayment">取消</NButton>
            <NButton
              type="primary"
              :loading="redeeming"
              :disabled="!cardKeyInput.trim()"
              @click="redeemCardKey"
            >
              <NIcon size="14"><CheckmarkCircle /></NIcon>
              提交兑换
            </NButton>
          </template>
          <template v-else>
            <NButton type="primary" @click="closePayment">完成</NButton>
          </template>
        </div>
      </div>
    </NModal>
  </div>
</template>

<style scoped>
/* ============================================================
   Pricing 页面
   设计系统：纯净白底 × 靛青品牌蓝 × 柔和分层
   ============================================================ */

.pricing-page {
  display: flex;
  flex-direction: column;
  gap: 24px;
}

/* ═══════════ 页头 Banner ═══════════ */
.pricing-banner .banner-visual {
  width: 120px; height: 120px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
.pricing-emblem {
  position: relative;
  width: 100%; height: 100%;
}
.emblem-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 1.5px dashed;
}
.emblem-ring.r1 {
  border-color: rgba(79, 70, 229, 0.3);
  animation: emblem-spin 14s linear infinite;
}
.emblem-ring.r2 {
  inset: 18px;
  border-color: rgba(14, 165, 233, 0.35);
  animation: emblem-spin 9s linear infinite reverse;
}
.emblem-core {
  position: absolute;
  inset: 34px;
  border-radius: 50%;
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.10), rgba(14, 165, 233, 0.10));
  border: 1px solid rgba(79, 70, 229, 0.25);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 24px rgba(79, 70, 229, 0.15), inset 0 0 16px rgba(14, 165, 233, 0.08);
}
@keyframes emblem-spin { to { transform: rotate(360deg); } }

/* ═══════════ 套餐卡片网格 ═══════════ */
.tier-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.tier-card {
  position: relative;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px 22px 22px;
  cursor: pointer;
  transition: all var(--transition);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.tier-card:hover {
  transform: translateY(-3px);
  box-shadow: var(--shadow-md);
  border-color: var(--border-strong);
}
.tier-card.selected {
  border-color: var(--tier-color);
  box-shadow: 0 0 0 2px var(--tier-color), var(--shadow-md);
}
.tier-card.highlighted {
  background: linear-gradient(180deg, #FFFFFF 0%, rgba(79, 70, 229, 0.02) 100%);
  border-color: rgba(79, 70, 229, 0.3);
  box-shadow: 0 8px 28px rgba(79, 70, 229, 0.12), 0 0 0 1px rgba(79, 70, 229, 0.08);
}
.tier-card.highlighted.selected {
  box-shadow: 0 0 0 2px var(--tier-color), 0 12px 32px rgba(79, 70, 229, 0.18);
}

.tier-accent-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 4px;
  background: var(--tier-gradient);
  opacity: 0.85;
}
.tier-card:not(.highlighted) .tier-accent-bar {
  opacity: 0.5;
}

.tier-badges {
  position: absolute;
  top: 14px; right: 14px;
  display: flex;
  gap: 6px;
}
.tier-tag-recommend {
  background: var(--tier-color) !important;
  color: #fff !important;
  font-weight: 700;
  box-shadow: 0 4px 10px rgba(79, 70, 229, 0.25);
}
.tier-tag-selected {
  background: var(--success-soft) !important;
  color: var(--success) !important;
}

.tier-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}
.tier-icon {
  width: 44px; height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 6px 14px rgba(0,0,0,0.10);
}
.tier-name-block { flex: 1; min-width: 0; }
.tier-name {
  font-size: 20px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.01em;
  line-height: 1.2;
}
.tier-badge-text {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
  font-weight: 500;
}
.tier-tagline {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.55;
  margin: 0 0 18px;
  min-height: 40px;
}

/* 计费切换 */
.billing-toggle {
  display: inline-flex;
  background: var(--bg-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-full);
  padding: 3px;
  margin-bottom: 14px;
  align-self: flex-start;
}
.billing-tab {
  padding: 5px 14px;
  font-size: 12.5px;
  font-weight: 600;
  color: var(--text-muted);
  background: transparent;
  border: none;
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.billing-tab.active {
  background: #fff;
  color: var(--text);
  box-shadow: var(--shadow-xs);
}

/* 价格 */
.tier-price {
  display: flex;
  align-items: baseline;
  gap: 4px;
  margin-bottom: 18px;
}
.currency {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}
.price-num {
  font-size: 42px;
  font-weight: 800;
  letter-spacing: -0.02em;
  line-height: 1;
  color: var(--text);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}
.tier-card.highlighted .price-num {
  background: var(--tier-gradient);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.price-unit {
  font-size: 13px;
  color: var(--text-muted);
  margin-left: 4px;
}

/* 特权列表 */
.tier-features {
  list-style: none;
  margin: 0 0 22px;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  flex: 1;
}
.tier-features li {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  line-height: 1.55;
  color: var(--text-secondary);
}
.tier-features li.highlight {
  color: var(--text);
  font-weight: 600;
}
.tier-features li.highlight .feature-icon {
  color: var(--tier-color);
}
.feature-icon {
  color: var(--success);
  flex-shrink: 0;
  margin-top: 2px;
}

/* CTA */
.tier-cta {
  width: 100%;
  height: 42px;
  border: 1px solid var(--border-strong);
  background: #fff;
  color: var(--text);
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.tier-cta:hover {
  border-color: var(--tier-color);
  color: var(--tier-color);
  box-shadow: var(--shadow-sm);
}
.tier-cta.primary {
  background: var(--tier-gradient);
  color: #fff;
  border-color: transparent;
  box-shadow: 0 4px 14px rgba(79, 70, 229, 0.25);
}
.tier-cta.primary:hover {
  color: #fff;
  box-shadow: 0 6px 18px rgba(79, 70, 229, 0.32);
  transform: translateY(-1px);
}

/* ═══════════ 支付方式 ═══════════ */
.payment-section {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 24px 22px;
  box-shadow: var(--shadow-xs);
}
.section-head {
  margin-bottom: 18px;
}
.section-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
  margin: 0 0 6px;
}
.section-sub {
  font-size: 13px;
  color: var(--text-secondary);
  margin: 0;
}
.section-sub strong {
  color: var(--primary);
  font-weight: 600;
}
.amount-due {
  color: var(--primary);
  font-weight: 700;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}

.payment-methods {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}
.payment-card {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: #fff;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.payment-card:hover:not(.disabled) {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-sm);
}
.payment-card.selected {
  border-color: var(--primary);
  box-shadow: 0 0 0 2px rgba(79, 70, 229, 0.12), var(--shadow-sm);
  background: linear-gradient(135deg, rgba(79, 70, 229, 0.03) 0%, rgba(14, 165, 233, 0.02) 100%);
}
.payment-card.disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: var(--bg-2);
}
.payment-card input[type='radio'] {
  position: absolute;
  opacity: 0;
  pointer-events: none;
}

.payment-brand-icon {
  width: 42px; height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background: #fff;
}
.brand-wechat { color: #07C160; background: rgba(7, 193, 96, 0.06); border-color: rgba(7, 193, 96, 0.18); }
.brand-alipay { color: #1677FF; background: rgba(22, 119, 255, 0.06); border-color: rgba(22, 119, 255, 0.18); }
.brand-key { color: var(--text-secondary); background: var(--bg-2); }

.payment-info { flex: 1; min-width: 0; }
.payment-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}
.payment-badge {
  background: var(--primary-soft) !important;
  color: var(--primary) !important;
  font-size: 10px !important;
  font-weight: 700 !important;
}
.payment-desc {
  font-size: 12px;
  color: var(--text-muted);
  margin-top: 2px;
}

.payment-radio {
  width: 18px; height: 18px;
  border: 1.5px solid var(--border-strong);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all var(--transition-fast);
}
.payment-card.selected .payment-radio {
  border-color: var(--primary);
  background: var(--primary);
}
.radio-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: transparent;
  transition: all var(--transition-fast);
}
.payment-card.selected .radio-dot {
  background: #fff;
}

/* 卡密说明 */
.cardkey-hint {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 12px 14px;
  background: linear-gradient(135deg, var(--warning-soft), rgba(245, 158, 11, 0.04));
  border: 1px solid rgba(245, 158, 11, 0.18);
  border-radius: var(--radius);
  margin-bottom: 16px;
}
.hint-icon {
  color: var(--warning);
  flex-shrink: 0;
  margin-top: 1px;
}
.hint-text { flex: 1; min-width: 0; }
.hint-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  margin-bottom: 3px;
}
.hint-desc {
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.6;
}
.hint-link {
  color: var(--primary);
  text-decoration: none;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  word-break: break-all;
}
.hint-link:hover { text-decoration: underline; }

/* 结算条 */
.checkout-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 18px;
  border-top: 1px solid var(--border-subtle);
  flex-wrap: wrap;
}
.checkout-summary {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.summary-label {
  font-size: 12px;
  color: var(--text-muted);
}
.summary-price {
  display: flex;
  align-items: baseline;
  gap: 2px;
}
.summary-price .cur {
  font-size: 16px;
  font-weight: 700;
  color: var(--primary);
}
.summary-price .num {
  font-size: 30px;
  font-weight: 800;
  color: var(--primary);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: -0.02em;
  line-height: 1;
}
.summary-price .unit {
  font-size: 13px;
  color: var(--text-muted);
  margin-left: 4px;
}
.checkout-btn {
  height: 46px;
  padding: 0 24px;
  font-size: 15px;
  font-weight: 600;
}

/* ═══════════ 底部说明 ═══════════ */
.pricing-footer {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  padding: 16px 20px;
  background: var(--bg-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
}
.footer-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
  line-height: 1.5;
}
.footer-item :deep(.n-icon) {
  color: var(--primary);
  flex-shrink: 0;
}

/* ═══════════ 支付模态框 ═══════════ */
.pay-modal {
  width: 480px;
  max-width: 92vw;
  background: #fff;
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
}
.pay-modal-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}
.pay-modal-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
  display: flex;
  align-items: center;
  gap: 6px;
}
.head-icon { color: var(--primary); }
.pay-modal-close {
  width: 30px; height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-muted);
  border-radius: 8px;
  cursor: pointer;
  transition: all var(--transition-fast);
}
.pay-modal-close:hover {
  background: var(--bg-2);
  color: var(--text);
}

.pay-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 20px;
  background: var(--bg-2);
  border-bottom: 1px solid var(--border-subtle);
}
.pay-summary-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.pay-tier-icon {
  width: 36px; height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 10px rgba(0,0,0,0.10);
}
.pay-tier-name {
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text);
}
.pay-tier-period {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
}
.pay-summary-price {
  display: flex;
  align-items: baseline;
  gap: 1px;
}
.pay-summary-price .cur {
  font-size: 13px;
  font-weight: 700;
  color: var(--primary);
}
.pay-summary-price .num {
  font-size: 26px;
  font-weight: 800;
  color: var(--primary);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: -0.02em;
  line-height: 1;
}

.pay-body {
  padding: 24px 20px;
  min-height: 280px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* QR 码 */
.qr-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  width: 100%;
}
.qr-frame {
  position: relative;
  width: 200px; height: 200px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 10px;
  background: #fff;
  box-shadow: var(--shadow-sm);
}
.qr-placeholder {
  width: 100%; height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.qr-loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.8);
  border-radius: var(--radius);
}
.qr-hint {
  font-size: 13px;
  color: var(--text-secondary);
  text-align: center;
}
.qr-hint strong {
  color: var(--text);
  font-weight: 700;
}
.qr-timer {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--text-muted);
}
.timer-text {
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  font-weight: 600;
}
.timer-text.urgent {
  color: var(--danger);
}
.qr-refresh {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 3px 8px;
  border: 1px solid var(--primary);
  background: var(--primary-soft);
  color: var(--primary);
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  margin-left: 6px;
  transition: all var(--transition-fast);
}
.qr-refresh:hover {
  background: var(--primary);
  color: #fff;
}

/* 卡密 */
.cardkey-block {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}
.cardkey-icon {
  width: 56px; height: 56px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.06));
  color: var(--warning);
  border: 1px solid rgba(245, 158, 11, 0.18);
  margin-bottom: 4px;
}
.cardkey-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.cardkey-desc {
  font-size: 12.5px;
  color: var(--text-secondary);
  line-height: 1.55;
  text-align: center;
  margin: 0 0 8px;
  max-width: 380px;
}
.cardkey-input {
  width: 100%;
}
.cardkey-actions {
  display: flex;
  gap: 10px;
  margin-top: 6px;
}

/* 成功 */
.pay-success {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}
.success-icon {
  color: var(--success);
  margin-bottom: 4px;
}
.success-title {
  font-size: 18px;
  font-weight: 700;
  color: var(--text);
}
.success-desc {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin: 0;
  max-width: 360px;
}
.success-desc strong {
  color: var(--primary);
  font-weight: 600;
}

.pay-modal-foot {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding: 14px 20px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-2);
}

/* ═══════════ 动画 ═══════════ */
.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 240ms var(--ease-out);
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
  max-height: 0;
  margin-bottom: 0;
  padding-top: 0;
  padding-bottom: 0;
  overflow: hidden;
}

/* ═══════════ 响应式 ═══════════ */
@media (max-width: 960px) {
  .tier-grid {
    grid-template-columns: 1fr;
    gap: 14px;
  }
  .tier-card { padding: 22px 20px 20px; }
  .pricing-footer {
    grid-template-columns: 1fr;
    gap: 10px;
  }
  .payment-methods {
    grid-template-columns: 1fr;
  }
  .pricing-banner .banner-visual { order: -1; width: 96px; height: 96px; }
}

@media (max-width: 640px) {
  .tier-card { padding: 20px 18px 18px; }
  .tier-name { font-size: 18px; }
  .price-num { font-size: 36px; }
  .checkout-bar { flex-direction: column; align-items: stretch; }
  .checkout-btn { width: 100%; }
  .pay-modal { width: 100%; max-width: 100%; border-radius: 0; }
  .pay-summary { flex-wrap: wrap; }
}
</style>
