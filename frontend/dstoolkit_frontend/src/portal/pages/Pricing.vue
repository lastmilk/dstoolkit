<script setup lang="ts">
import { ref } from 'vue'
import { Check, CircleClose, ArrowRight } from '@element-plus/icons-vue'
import { toast } from '@/utils/toast'

interface PricingTier {
  name: string
  price: string
  period: string
  highlight: boolean
  highlightLabel?: string
  features: string[]
  buttonLabel: string
  buttonType: 'primary' | 'ghost'
}

const tiers: PricingTier[] = [
  {
    name: 'Free',
    price: '¥0',
    period: '/ 永久免费',
    highlight: false,
    features: [
      '导入最多 5 个 Deepseek 账号',
      '对话全文检索（基础版）',
      '数据可视化面板',
      'Alpaca 格式导出（每次 100 条）',
      '基础主题与背景',
      '社区支持',
    ],
    buttonLabel: '免费使用',
    buttonType: 'ghost',
  },
  {
    name: 'Pro',
    price: '¥29',
    period: '/ 月',
    highlight: true,
    highlightLabel: 'Most Popular',
    features: [
      '导入无限 Deepseek 账号',
      '高级全文检索 + 正则筛选',
      '完整数据可视化 + 导出报表',
      'Alpaca 格式导出（无限量）',
      '全部主题 + 自定义背景',
      'OAuth 授权能力',
      '邀请返利资格',
      '优先邮件支持',
    ],
    buttonLabel: '立即升级',
    buttonType: 'primary',
  },
  {
    name: 'Enterprise',
    price: '¥199',
    period: '/ 月',
    highlight: false,
    features: [
      'Pro 全部功能',
      '团队协作（最多 20 席）',
      'SSO / 私有部署支持',
      '专属 API 配额提升',
      '模型市场优先体验',
      '7×24 小时专属客服',
      '定制化开发咨询',
      'SLA 服务保障',
    ],
    buttonLabel: '联系销售',
    buttonType: 'ghost',
  },
]

interface CompareRow {
  feature: string
  free: string | boolean
  pro: string | boolean
  enterprise: string | boolean
}

const compareRows: CompareRow[] = [
  { feature: '可导入账号数', free: '5 个', pro: '无限', enterprise: '无限' },
  { feature: '全文检索能力', free: '基础', pro: '高级 + 正则', enterprise: '高级 + 正则' },
  { feature: 'Alpaca 导出上限', free: '100 条 / 次', pro: '无限', enterprise: '无限' },
  { feature: 'OAuth 授权', free: false, pro: true, enterprise: true },
  { feature: '邀请返利', free: false, pro: true, enterprise: true },
  { feature: '团队协作', free: false, pro: false, enterprise: '20 席位' },
  { feature: 'SSO / 私有部署', free: false, pro: false, enterprise: true },
  { feature: '客服支持', free: '社区', pro: '优先邮件', enterprise: '7×24 专属' },
]

interface FaqItem {
  title: string
  content: string
}

const faqItems: FaqItem[] = [
  {
    title: 'Free 版和 Pro 版有什么核心区别？',
    content:
      'Free 版适合个人轻度使用，限制 5 个账号导入、每次 Alpaca 导出 100 条；Pro 版解锁所有高级功能，包括无限账号、无限导出、正则检索、OAuth 授权和邀请返利等。',
  },
  {
    title: '可以随时升级或降级套餐吗？',
    content:
      '是的，你可以随时在个人中心升级套餐，升级后立即生效。降级则会在当前计费周期结束后生效，期间你仍可享受已付费套餐的全部权益。',
  },
  {
    title: '数据安全如何保障？',
    content:
      '我们采用业界标准的端到端加密存储，对话数据默认仅你本人可见。企业版支持 SSO 和私有部署方案，满足合规与数据主权要求。',
  },
  {
    title: '邀请返利如何结算？',
    content:
      '好友通过你的邀请链接注册并升级 Pro 及以上套餐后，双方均会获得等价积分。积分可用于抵扣订阅费用或兑换模型调用额度，详情见邀请页面。',
  },
  {
    title: '支持哪些支付方式？',
    content:
      '目前支持微信支付、支付宝和主流信用卡。企业版支持对公转账并开具增值税发票。支付通道持续建设中，更多方式即将上线。',
  },
]

const activeNames = ref<string[]>(['1'])

function handleBuy(tierName: string) {
  if (tierName === 'Free') {
    toast.info('免费版无需支付，注册即可使用~')
  } else {
    toast.info('支付通道建设中…')
  }
}
</script>

<template>
  <div class="portal-pricing">
    <section class="pricing-hero">
      <div class="pricing-hero-inner">
        <h1 class="pricing-title page-enter">
          灵活方案，<span class="brand-gradient-text">按需选择</span>
        </h1>
        <p class="pricing-subtitle page-enter delay-1">
          从个人免费版到团队企业版，总有一款适合你。所有套餐均支持 7 天无理由退款。
        </p>
      </div>
    </section>

    <section class="pricing-cards-section">
      <div class="pricing-cards-inner">
        <div class="pricing-cards">
          <div
            v-for="(tier, idx) in tiers"
            :key="idx"
            class="pricing-card glass-card"
            :class="{ 'is-highlight': tier.highlight }"
          >
            <div v-if="tier.highlight" class="highlight-stripe">
              <el-icon :size="12"><Check /></el-icon>
              <span>{{ tier.highlightLabel }}</span>
            </div>

            <div class="tier-name">{{ tier.name }}</div>
            <div class="tier-price-row">
              <span class="tier-price">{{ tier.price }}</span>
              <span class="tier-period">{{ tier.period }}</span>
            </div>

            <ul class="tier-features">
              <li v-for="(feat, fi) in tier.features" :key="fi" class="tier-feat">
                <el-icon :size="16" class="feat-check"><Check /></el-icon>
                <span>{{ feat }}</span>
              </li>
            </ul>

            <el-button
              :type="tier.buttonType"
              size="large"
              class="tier-btn"
              :class="{ 'btn-primary': tier.buttonType === 'primary' }"
              @click="handleBuy(tier.name)"
            >
              {{ tier.buttonLabel }}
              <el-icon v-if="tier.buttonType === 'primary'" class="btn-arrow">
                <ArrowRight />
              </el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </section>

    <section class="compare-section">
      <div class="compare-inner">
        <h2 class="section-title">功能对比</h2>
        <div class="compare-table-wrap glass">
          <el-table :data="compareRows" class="compare-table" border :show-header="true">
            <el-table-column prop="feature" label="功能" min-width="200">
              <template #default="{ row }">
                <span class="compare-feat-name">{{ row.feature }}</span>
              </template>
            </el-table-column>
            <el-table-column label="Free" align="center" min-width="120">
              <template #default="{ row }">
                <template v-if="typeof row.free === 'boolean'">
                  <el-icon v-if="row.free" :size="18" class="check-yes"><Check /></el-icon>
                  <el-icon v-else :size="18" class="check-no"><CircleClose /></el-icon>
                </template>
                <span v-else class="compare-text">{{ row.free }}</span>
              </template>
            </el-table-column>
            <el-table-column label="Pro" align="center" min-width="120" class-name="col-pro">
              <template #default="{ row }">
                <template v-if="typeof row.pro === 'boolean'">
                  <el-icon v-if="row.pro" :size="18" class="check-yes"><Check /></el-icon>
                  <el-icon v-else :size="18" class="check-no"><CircleClose /></el-icon>
                </template>
                <span v-else class="compare-text">{{ row.pro }}</span>
              </template>
            </el-table-column>
            <el-table-column label="Enterprise" align="center" min-width="140">
              <template #default="{ row }">
                <template v-if="typeof row.enterprise === 'boolean'">
                  <el-icon v-if="row.enterprise" :size="18" class="check-yes"><Check /></el-icon>
                  <el-icon v-else :size="18" class="check-no"><CircleClose /></el-icon>
                </template>
                <span v-else class="compare-text">{{ row.enterprise }}</span>
              </template>
            </el-table-column>
          </el-table>
        </div>
      </div>
    </section>

    <section class="faq-section">
      <div class="faq-inner">
        <h2 class="section-title">常见问题</h2>
        <el-collapse v-model="activeNames" class="faq-collapse glass">
          <el-collapse-item
            v-for="(faq, idx) in faqItems"
            :key="idx + 1"
            :name="String(idx + 1)"
            :title="faq.title"
          >
            <div class="faq-content">{{ faq.content }}</div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </section>
  </div>
</template>

<style scoped>
.portal-pricing {
  width: 100%;
}

.pricing-hero {
  padding: 72px 28px 48px;
  display: flex;
  justify-content: center;
}

.pricing-hero-inner {
  max-width: 720px;
  text-align: center;
}

.pricing-title {
  font-size: 44px;
  font-weight: var(--font-weight-black);
  color: var(--text);
  line-height: 1.2;
  margin: 0 0 18px;
  letter-spacing: -0.02em;
}

.pricing-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
}

.pricing-cards-section {
  padding: 8px 28px 48px;
  display: flex;
  justify-content: center;
}

.pricing-cards-inner {
  max-width: 1200px;
  width: 100%;
}

.pricing-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
  align-items: stretch;
}

.pricing-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 32px 28px 28px;
}

.pricing-card.is-highlight {
  border-color: var(--primary);
  box-shadow: 0 16px 44px var(--primary-soft);
  transform: scale(1.02);
  z-index: 2;
}

.pricing-card.is-highlight::before {
  content: '';
  position: absolute;
  inset: 0;
  border-radius: inherit;
  padding: 1px;
  background: var(--brand-gradient);
  -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
  -webkit-mask-composite: xor;
  mask-composite: exclude;
  pointer-events: none;
  opacity: 0.6;
}

.highlight-stripe {
  position: absolute;
  top: -1px;
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 14px;
  background: var(--brand-gradient);
  color: #fff;
  font-size: 11.5px;
  font-weight: var(--font-weight-bold);
  border-radius: 0 0 10px 10px;
  letter-spacing: 0.02em;
  box-shadow: 0 4px 12px var(--primary-soft);
}

.tier-name {
  font-size: 14px;
  font-weight: var(--font-weight-bold);
  color: var(--text-muted);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 12px;
}

.is-highlight .tier-name {
  color: var(--primary);
}

.tier-price-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin-bottom: 22px;
}

.tier-price {
  font-size: 42px;
  font-weight: var(--font-weight-black);
  color: var(--text);
  line-height: 1;
  letter-spacing: -0.02em;
}

.tier-period {
  font-size: 14px;
  color: var(--text-muted);
}

.tier-features {
  list-style: none;
  padding: 0;
  margin: 0 0 26px;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.tier-feat {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.5;
}

.feat-check {
  color: var(--success);
  margin-top: 2px;
  flex-shrink: 0;
}

.tier-btn {
  width: 100%;
  border-radius: var(--radius-full);
  padding: 12px 20px;
  font-size: 14.5px;
  font-weight: var(--font-weight-bold);
}

.tier-btn.btn-primary {
  box-shadow: 0 8px 20px var(--primary-soft);
}

.tier-btn.btn-primary .btn-arrow {
  margin-left: 4px;
}

.compare-section {
  padding: 16px 28px 48px;
  display: flex;
  justify-content: center;
}

.compare-inner {
  max-width: 1200px;
  width: 100%;
}

.section-title {
  font-size: 26px;
  font-weight: var(--font-weight-black);
  color: var(--text);
  text-align: center;
  margin: 0 0 24px;
  letter-spacing: -0.01em;
}

.compare-table-wrap {
  padding: 6px;
  overflow: hidden;
}

.compare-table {
  --el-table-border-color: var(--border-subtle);
  --el-table-header-bg-color: transparent;
  --el-table-row-hover-bg-color: var(--primary-soft);
  border-radius: var(--radius);
  overflow: hidden;
}

.compare-table :deep(.el-table__header th) {
  background: var(--bg-2) !important;
  font-weight: var(--font-weight-bold);
  color: var(--text);
  font-size: 13.5px;
}

.compare-table :deep(.col-pro) {
  background: var(--primary-soft);
}

.compare-table :deep(.el-table__body td.col-pro) {
  background: color-mix(in srgb, var(--primary-soft) 40%, transparent);
}

.compare-table :deep(.el-table__body td) {
  background: transparent;
}

.compare-feat-name {
  font-weight: var(--font-weight-medium);
  color: var(--text);
  font-size: 13.5px;
}

.compare-text {
  font-size: 13.5px;
  color: var(--text-secondary);
  font-weight: var(--font-weight-medium);
}

.check-yes {
  color: var(--success);
}

.check-no {
  color: var(--text-disabled);
}

.faq-section {
  padding: 16px 28px 80px;
  display: flex;
  justify-content: center;
}

.faq-inner {
  max-width: 900px;
  width: 100%;
}

.faq-collapse {
  padding: 6px;
  border-radius: var(--radius-lg);
  background: color-mix(in srgb, var(--surface) 80%, transparent);
}

.faq-collapse :deep(.el-collapse-item__header) {
  font-weight: var(--font-weight-bold);
  color: var(--text);
  font-size: 14.5px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--border-subtle);
  transition: color var(--transition-fast);
}

.faq-collapse :deep(.el-collapse-item__header:hover) {
  color: var(--primary);
}

.faq-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: 1px solid var(--border-subtle);
}

.faq-collapse :deep(.el-collapse-item__content) {
  padding: 14px 18px 20px;
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

.faq-content {
  color: var(--text-secondary);
  font-size: 14px;
  line-height: 1.7;
}

@media (max-width: 960px) {
  .pricing-hero {
    padding: 52px 18px 32px;
  }

  .pricing-title {
    font-size: 32px;
  }

  .pricing-cards {
    grid-template-columns: 1fr;
    gap: 18px;
  }

  .pricing-card.is-highlight {
    transform: none;
  }

  .pricing-cards-section,
  .compare-section,
  .faq-section {
    padding-left: 18px;
    padding-right: 18px;
  }

  .faq-section {
    padding-bottom: 60px;
  }
}

@media (max-width: 560px) {
  .pricing-title {
    font-size: 26px;
  }

  .tier-price {
    font-size: 36px;
  }

  .section-title {
    font-size: 22px;
  }
}
</style>
