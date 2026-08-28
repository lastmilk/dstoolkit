import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'
import NeuInput from '@/components/NeuInput'
import NeuButton from '@/components/NeuButton'
import TierBadge from '@/components/TierBadge'
import { callFunction } from '@/services/cloud'
import { useAuth } from '@/store/auth'
import type { RedeemResult, RedeemRequest, Tier, CardDuration } from '@/types'

const SAMPLES: { tier: Tier; duration: CardDuration; code: string }[] = [
  { tier: 'PRO', duration: 'ANNUAL', code: 'PRO-YEAR-XXXX' },
  { tier: 'PLUS', duration: 'ANNUAL', code: 'PLUS-XXXX' },
  { tier: 'ULTIMATE', duration: 'PERMANENT', code: 'ULT-XXXX' }
]

export default function RedeemPage() {
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<RedeemResult | null>(null)
  const [error, setError] = useState<string>('')
  const { updateCredits } = useAuth()

  const handleRedeem = async () => {
    if (!code.trim()) {
      setError('请输入卡密')
      return
    }
    setLoading(true)
    setError('')
    try {
      const r = await callFunction<RedeemResult>('redeemCard', {
        code: code.trim().toUpperCase()
      } as RedeemRequest)
      if (r?.success) {
        setResult(r)
        if (r.newCredits) updateCredits(r.newCredits)
        Taro.vibrateShort({}).catch(() => {})
      } else {
        setError('卡密无效或已被使用，请检查后重试')
      }
    } catch (err: any) {
      console.error('[Redeem] failed:', err)
      setError(err?.message || '兑换失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const reset = () => {
    setCode('')
    setResult(null)
    setError('')
  }

  return (
    <View className={styles.page}>
      {/* 头部 Banner */}
      <View className={styles.banner}>
        <View className={styles.bannerIcon}>
          <Text>🎫</Text>
        </View>
        <View className={styles.bannerText}>
          <Text className={styles.bannerTitle}>卡密兑换中心</Text>
          <Text className={styles.bannerDesc}>
            输入激活码即可升级会员等级并获得 AI 积分，支持 PRO / PLUS / ULTIMATE 多档会员。
          </Text>
        </View>
      </View>

      {result ? (
        <View className={styles.resultCard}>
          <View className={styles.resultIcon}>
            <Text>✓</Text>
          </View>
          <Text className={styles.resultTitle}>兑换成功 🎉</Text>
          <View style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
            <TierBadge tier={result.tier} size="lg" solid />
            <View
              style={{
                padding: '8rpx 24rpx',
                borderRadius: 16,
                background: 'rgba(247, 186, 30, 0.1)',
                color: '#f7ba1e',
                fontWeight: 600,
                fontSize: 24
              }}
            >
              时长：{result.duration === 'PERMANENT' ? '永久' : '年费'}
            </View>
          </View>
          <Text className={styles.resultDesc}>
            {result.newCredits
              ? `会员已激活，同时获得 ${result.newCredits} AI 积分奖励！`
              : '会员权益已生效，快去享受吧～'}
          </Text>
          <View style={{ width: '100%', display: 'flex', gap: 16 }}>
            <NeuButton type="default" full onClick={reset}>
              再兑一张
            </NeuButton>
            <NeuButton
              type="primary"
              full
              onClick={() => Taro.switchTab({ url: '/pages/profile/index' })}
            >
              回到我的
            </NeuButton>
          </View>
        </View>
      ) : (
        <>
          {/* 表单卡 */}
          <View className={styles.formCard}>
            <NeuInput
              label="输入卡密"
              placeholder="请粘贴或输入激活码（大小写忽略）"
              value={code}
              onInput={(v) => {
                setCode(v)
                if (error) setError('')
              }}
              prefix={<Text>🔑</Text>}
              error={error}
              maxLength={64}
            />
            <NeuButton
              type="primary"
              size="lg"
              full
              loading={loading}
              onClick={handleRedeem}
            >
              立即兑换
            </NeuButton>

            {/* 示例 */}
            <View className={styles.sampleRow}>
              <Text>
                🎁 演示环境，以下前缀卡密可直接兑换成功：{'\n'}
                {SAMPLES.map((s) => (
                  <Text key={s.code} className={styles.sampleCode}>
                    {s.code}
                  </Text>
                ))}
              </Text>
            </View>
          </View>

          {/* 常见问题 */}
          <View className={styles.hintList}>
            <View className={styles.hint}>
              <Text className={styles.hintIcon}>💡</Text>
              <Text>卡密通常在购买完成后的订单详情或邮件中获取，请妥善保管，一个激活码只能使用一次。</Text>
            </View>
            <View className={styles.hint}>
              <Text className={styles.hintIcon}>⏰</Text>
              <Text>年费卡密从兑换日起生效 365 天；永久卡密一旦激活终身有效，不会随年费卡密过期。</Text>
            </View>
            <View className={styles.hint}>
              <Text className={styles.hintIcon}>🎁</Text>
              <Text>兑换同时会赠送相应档位的 AI 积分，可用于 AI 摘要、知识卡片、导出等增值功能。</Text>
            </View>
            <View className={styles.hint}>
              <Text className={styles.hintIcon}>🧑‍💻</Text>
              <Text>如有任何问题，请在管理后台联系客服并提供订单信息，我们会 24 小时内为你处理。</Text>
            </View>
          </View>
        </>
      )}
    </View>
  )
}
