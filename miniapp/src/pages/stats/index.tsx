import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import NeuStatCard from '@/components/NeuStatCard'
import NeuCard from '@/components/NeuCard'
import { callFunction } from '@/services/cloud'
import type { StatsData, Tier } from '@/types'

type Range = '7d' | '30d' | 'all'
const RANGE_OPTIONS: { key: Range; label: string }[] = [
  { key: '7d', label: '7 天' },
  { key: '30d', label: '30 天' },
  { key: 'all', label: '全部' }
]

export default function StatsPage() {
  const [range, setRange] = useState<Range>('30d')
  const [data, setData] = useState<StatsData | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const d = await callFunction<StatsData>('getStats', { range })
      setData(d)
    } catch (err) {
      console.error('[Stats] load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [range])

  useEffect(() => {
    load()
  }, [load])

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  // 条形图高度计算
  const trendBars = useMemo(() => {
    if (!data) return []
    const trend = data.trend || []
    // 最多显示 14 条，否则太密
    const step = Math.max(1, Math.ceil(trend.length / 14))
    const sampled = trend.filter((_, i) => i % step === 0)
    const max = Math.max(1, ...sampled.map((t) => t.messages + t.conversations * 2))
    return sampled.map((t) => ({
      date: t.date.slice(5), // MM-DD
      count: t.messages,
      heightPct: Math.max(6, ((t.messages + t.conversations) / max) * 100)
    }))
  }, [data])

  const hotMax = Math.max(1, ...(data?.hotWords.map((h) => h.count) || [1]))
  const tierSum = Math.max(
    1,
    (data?.tierDistribution || []).reduce((s, t) => s + t.count, 0)
  )

  return (
    <View className={styles.page}>
      <View className={styles.rangeBar}>
        <Text className={styles.summaryTitle}>📈 数据统计</Text>
        <View className={styles.rangeChips}>
          {RANGE_OPTIONS.map((opt) => (
            <View
              key={opt.key}
              className={classnames(
                styles.rangeChip,
                range === opt.key && styles.active
              )}
              onClick={() => setRange(opt.key)}
            >
              <Text>{opt.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 概览 2×2 卡片 */}
      <View className={styles.statGrid}>
        <NeuStatCard
          icon="💬"
          iconTone="primary"
          label="对话总数"
          value={data?.totalConversations.toLocaleString() ?? '--'}
          sub={loading ? '加载中' : '累计同步会话'}
        />
        <NeuStatCard
          icon="✉️"
          iconTone="success"
          label="消息条数"
          value={data?.totalMessages.toLocaleString() ?? '--'}
          sub={loading ? '加载中' : '所有回合消息'}
        />
        <NeuStatCard
          icon="🧠"
          iconTone="purple"
          label="消耗 Token"
          value={
            data
              ? data.totalTokens >= 1_000_000
                ? (data.totalTokens / 1_000_000).toFixed(2) + 'M'
                : (data.totalTokens / 1000).toFixed(1) + 'K'
              : '--'
          }
          sub={loading ? '加载中' : '对话处理总量'}
        />
        <NeuStatCard
          icon="🔥"
          iconTone="warning"
          label="活跃天数"
          value={data?.activeDays ?? '--'}
          sub={loading ? '加载中' : `区间内使用天数`}
        />
      </View>

      {/* 消息趋势图 */}
      <View className={styles.chartCard}>
        <View className={styles.chartTitle}>
          <Text>📊 消息趋势</Text>
          <Text className={styles.chartHint}>每日消息量</Text>
        </View>
        <View className={styles.trendChart}>
          {trendBars.map((b, i) => (
            <View
              key={i}
              className={styles.trendBar}
              style={{ height: `${b.heightPct}%` }}
            />
          ))}
        </View>
        <View className={styles.trendLabels}>
          <Text>{trendBars[0]?.date || ''}</Text>
          <Text>{trendBars[Math.floor(trendBars.length / 2)]?.date || ''}</Text>
          <Text>{trendBars[trendBars.length - 1]?.date || ''}</Text>
        </View>
      </View>

      {/* 搜索热词 */}
      <View className={styles.chartCard}>
        <View className={styles.chartTitle}>
          <Text>🔥 搜索热词 TOP 8</Text>
          <Text className={styles.chartHint}>你最常搜索的关键词</Text>
        </View>
        <View className={styles.hotList}>
          {(data?.hotWords || []).slice(0, 8).map((w, i) => (
            <View key={w.word} className={styles.hotRow}>
              <View
                className={classnames(
                  styles.hotRank,
                  i === 0 && styles.rank1,
                  i === 1 && styles.rank2,
                  i === 2 && styles.rank3
                )}
              >
                <Text>{i + 1}</Text>
              </View>
              <Text className={styles.hotWord}>{w.word}</Text>
              <View className={styles.hotBarWrap}>
                <View
                  className={styles.hotBarFill}
                  style={{ width: `${(w.count / hotMax) * 100}%` }}
                />
              </View>
              <Text className={styles.hotCount}>{w.count}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 会员分布 */}
      <View className={styles.chartCard}>
        <View className={styles.chartTitle}>
          <Text>💎 会员等级分布</Text>
          <Text className={styles.chartHint}>全平台数据</Text>
        </View>
        <View className={styles.tierList}>
          {(data?.tierDistribution || []).map((t) => (
            <View key={t.tier} className={styles.tierRow}>
              <View
                className={styles.tierBadge}
                style={{
                  color:
                    t.tier === 'FREE'
                      ? '#86909c'
                      : t.tier === 'PRO'
                        ? '#165dff'
                        : t.tier === 'PLUS'
                          ? '#f77234'
                          : t.tier === 'ULTIMATE'
                            ? '#722ed1'
                            : '#00b42a',
                  fontWeight: 600
                }}
              >
                <Text>{t.tier}</Text>
              </View>
              <View className={styles.tierBarWrap}>
                <View
                  className={classnames(styles.tierBarFill, styles[t.tier as Tier])}
                  style={{ width: `${(t.count / tierSum) * 100}%` }}
                />
              </View>
              <Text className={styles.tierCount}>{t.count}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  )
}
