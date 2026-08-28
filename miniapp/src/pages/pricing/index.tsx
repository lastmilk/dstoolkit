import React, { useState } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import NeuButton from '@/components/NeuButton'
import TierBadge from '@/components/TierBadge'
import { useAuth } from '@/store/auth'
import type { Tier } from '@/types'

interface TierInfo {
  tier: Tier
  name: string
  price: number
  period: string
  originalPrice?: number
  credits: number
  isRecommend?: boolean
  feats: { text: string; enabled: boolean }[]
}

const TIERS: TierInfo[] = [
  {
    tier: 'FREE',
    name: '免费版',
    price: 0,
    period: '永久免费',
    credits: 0,
    feats: [
      { text: '绑定 1 个 DeepSeek 账号', enabled: true },
      { text: '基础对话搜索与浏览', enabled: true },
      { text: '基础对话列表（100条/次）', enabled: true },
      { text: 'AI 摘要（每日 5 次）', enabled: true },
      { text: '卡密升级会员', enabled: true },
      { text: '知识卡片生成', enabled: false },
      { text: '对话公开分享', enabled: false },
      { text: '高级导出（Alpaca/MD）', enabled: false }
    ]
  },
  {
    tier: 'PRO',
    name: 'PRO 专业版',
    price: 29,
    period: '每月',
    originalPrice: 49,
    credits: 500,
    isRecommend: false,
    feats: [
      { text: '绑定 3 个 DeepSeek 账号', enabled: true },
      { text: '全文搜索（跨账号）', enabled: true },
      { text: '无限对话列表浏览', enabled: true },
      { text: 'AI 摘要（每日 50 次）', enabled: true },
      { text: '知识卡片（每日 30 个）', enabled: true },
      { text: '文件夹与标签整理', enabled: true },
      { text: '对话公开分享', enabled: false },
      { text: '广告权益加成', enabled: true }
    ]
  },
  {
    tier: 'PLUS',
    name: 'PLUS 进阶版',
    price: 199,
    period: '每年',
    originalPrice: 358,
    credits: 5000,
    isRecommend: true,
    feats: [
      { text: '绑定 10 个 DeepSeek 账号', enabled: true },
      { text: '全文搜索 + Meilisearch 高级检索', enabled: true },
      { text: 'AI 摘要（无限次）', enabled: true },
      { text: '知识卡片（无限）', enabled: true },
      { text: '文件夹与标签（嵌套）', enabled: true },
      { text: '自定义短链分享 + 密码', enabled: true },
      { text: 'Alpaca / Markdown / PDF 导出', enabled: true },
      { text: '时间线视图 & 统计', enabled: true }
    ]
  },
  {
    tier: 'ULTIMATE',
    name: 'ULTIMATE 旗舰版',
    price: 999,
    period: '永久授权',
    originalPrice: 1999,
    credits: 99999,
    isRecommend: false,
    feats: [
      { text: '绑定 DeepSeek 账号数无上限', enabled: true },
      { text: '所有 PLUS 功能', enabled: true },
      { text: '优先体验新功能', enabled: true },
      { text: '大模型 AI 摘要模型切换', enabled: true },
      { text: '团队空间与协同（即将）', enabled: true },
      { text: '专属客服通道', enabled: true },
      { text: '邀请返佣比例提升至 50%', enabled: true },
      { text: '终身免费更新', enabled: true }
    ]
  }
]

export default function PricingPage() {
  const { user, isLoggedIn } = useAuth()
  const currentTier: Tier = user?.tier || 'FREE'

  const handleBuy = (tier: Tier) => {
    if (!isLoggedIn) {
      Taro.navigateTo({ url: '/pages/login/index' })
      return
    }
    Taro.showActionSheet({
      itemList: ['使用卡密兑换', '跳转到官网购买', '联系客服'],
      success: (r) => {
        if (r.tapIndex === 0) {
          Taro.navigateTo({ url: '/pages/redeem/index' })
        } else if (r.tapIndex === 1) {
          Taro.showToast({ title: '即将打开 dstoolkit.cn/pricing', icon: 'none' })
        } else {
          Taro.showToast({ title: '客服微信：dstoolkit', icon: 'none' })
        }
      }
    })
  }

  return (
    <ScrollView className={styles.page} scrollY enhanced showScrollbar={false}>
      <View className={styles.userBar}>
        <View className={styles.currentTier}>
          <Text>当前等级：</Text>
          <TierBadge tier={currentTier} solid size="sm" />
        </View>
        <Text
          style={{ fontSize: 24, color: '#86909C' }}
          onClick={() => Taro.navigateTo({ url: '/pages/redeem/index' })}
        >
          🎫 去兑换
        </Text>
      </View>
      <Text className={styles.upgradeTip}>
        选择适合你的方案，解锁强大的对话管理能力
      </Text>

      {/* 横向会员卡 */}
      <ScrollView
        className={styles.tierScroll}
        scrollX
        enhanced
        showScrollbar={false}
      >
        {TIERS.map((t) => {
          const isCurrent = t.tier === currentTier
          return (
            <View
              key={t.tier}
              className={classnames(
                styles.tierCard,
                styles[t.tier],
                isCurrent && styles.current
              )}
            >
              <View className={styles.tierHead}>
                <Text
                  className={classnames(styles.tierName, styles.tierCardColor)}
                >
                  {t.name}
                </Text>
                {isCurrent ? (
                  <View className={styles.currentTag}>当前</View>
                ) : t.isRecommend ? (
                  <View className={styles.recommendTag}>🔥 推荐</View>
                ) : null}
              </View>

              <View className={styles.price}>
                <Text className={styles.currency}>¥</Text>
                <Text className={styles.priceNum}>{t.price}</Text>
                <Text className={styles.period}>/{t.period}</Text>
              </View>
              {t.originalPrice && (
                <Text className={styles.originalPrice}>
                  原价 ¥{t.originalPrice}
                </Text>
              )}

              {t.credits > 0 && (
                <View className={styles.creditsRow}>
                  <Text>⭐</Text>
                  <Text>附赠 {t.credits.toLocaleString()} AI 积分</Text>
                </View>
              )}

              <View className={styles.featList}>
                {t.feats.map((f, i) => (
                  <View key={i} className={styles.feat}>
                    <View
                      className={classnames(
                        styles.check,
                        !f.enabled && styles.disabled
                      )}
                    >
                      <Text>{f.enabled ? '✓' : '—'}</Text>
                    </View>
                    <Text
                      style={{
                        color: f.enabled ? undefined : '#C9CDD4'
                      }}
                    >
                      {f.text}
                    </Text>
                  </View>
                ))}
              </View>

              <NeuButton
                type={isCurrent ? 'default' : 'primary'}
                full
                size="lg"
                disabled={isCurrent}
                onClick={() => handleBuy(t.tier)}
              >
                {isCurrent ? '当前方案' : '立即升级'}
              </NeuButton>
            </View>
          )
        })}
      </ScrollView>

      {/* 常见问题 */}
      <View className={styles.section}>
        <Text className={styles.sectionTitle}>常见问题</Text>
        <View className={styles.faqList}>
          <View className={styles.faq}>
            <Text className={styles.faqQ}>Q：会员时长如何计算？</Text>
            <Text className={styles.faqA}>
              月/年会员从支付/兑换成功日起连续计算 30/365 天；
              永久会员一经激活，终身有效。多个年费会员时长会自动叠加。
            </Text>
          </View>
          <View className={styles.faq}>
            <Text className={styles.faqQ}>Q：AI 积分用完了怎么办？</Text>
            <Text className={styles.faqA}>
              积分用于 AI 摘要、知识卡片、导出等增值功能。
              每月随会员等级自动发放，也可通过看激励视频、邀请好友、直接购买进行补充，积分永不清零。
            </Text>
          </View>
          <View className={styles.faq}>
            <Text className={styles.faqQ}>Q：能否退款？</Text>
            <Text className={styles.faqA}>
              购买后 7 天内且未使用积分或关键功能，可无理由全额退款。
              请联系客服提供订单信息。通过第三方平台购买的订单按平台规则处理。
            </Text>
          </View>
          <View className={styles.faq}>
            <Text className={styles.faqQ}>Q：数据安全如何保障？</Text>
            <Text className={styles.faqA}>
              dstoolkit 只存储必要的配置元数据，所有内容同步均通过官方 HTTPS API。
              敏感凭据采用 AES-256 加密存储，你可以随时在配置中一键撤销并删除所有数据。
            </Text>
          </View>
        </View>
      </View>

      <View className={styles.buyBar}>
        <NeuButton
          type="primary"
          size="lg"
          full
          onClick={() => Taro.navigateTo({ url: '/pages/redeem/index' })}
        >
          🎫 我有卡密，去兑换
        </NeuButton>
      </View>
    </ScrollView>
  )
}
