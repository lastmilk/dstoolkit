import React, { useState, useEffect, useCallback } from 'react'
import {
  View,
  Text,
  ScrollView,
  Swiper,
  SwiperItem,
  Image
} from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import styles from './index.module.scss'
import { useAuth } from '@/store/auth'
import { callFunction } from '@/services/cloud'
import { storage } from '@/services/storage'
import TierBadge from '@/components/TierBadge'
import NeuInput from '@/components/NeuInput'
import ConvItem from '@/components/ConvItem'
import { NeuIconButton } from '@/components/NeuButton'
import EmptyState from '@/components/EmptyState'
import type { Conversation, MarketEntry, PageResponse } from '@/types'

interface QuickItem {
  key: string
  icon: string
  tone: 'blue' | 'orange' | 'purple' | 'green' | 'red' | 'gold'
  label: string
  path?: string
  action?: () => void
}

export default function ExplorePage() {
  const { user, isLoggedIn } = useAuth()
  const [keyword, setKeyword] = useState('')
  const [history, setHistory] = useState<string[]>(storage.getSearchHistory())
  const [latest, setLatest] = useState<Conversation[]>([])
  const [market, setMarket] = useState<MarketEntry[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [convRes, marketRes] = await Promise.all([
        callFunction<PageResponse<Conversation>>('getConversations', {
          page: 1,
          pageSize: 6
        }),
        callFunction<MarketEntry[]>('getMarketEntries', { category: 'all' })
      ])
      setLatest(convRes.records)
      setMarket(marketRes.slice(0, 4))
    } catch (err) {
      console.error('[Explore] load failed:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadData()
  }, [loadData])

  usePullDownRefresh(() => {
    loadData().finally(() => Taro.stopPullDownRefresh())
  })

  const quickItems: QuickItem[] = [
    { key: 'config', icon: '⚙', tone: 'blue', label: '配置管理', path: '/pages/configs/index' },
    { key: 'stats', icon: '📊', tone: 'purple', label: '数据统计', path: '/pages/stats/index' },
    { key: 'redeem', icon: '🎫', tone: 'orange', label: '卡密兑换', path: '/pages/redeem/index' },
    { key: 'pricing', icon: '💎', tone: 'gold', label: '会员中心', path: '/pages/pricing/index' },
    { key: 'market', icon: '🧩', tone: 'green', label: '应用市场', path: '/pages/market/index' },
    { key: 'reward', icon: '🎬', tone: 'red', label: '看广告', action: () => Taro.showToast({ title: '激励视频接入中', icon: 'none' }) }
  ]

  const handleQuickClick = (item: QuickItem) => {
    if (item.action) {
      item.action()
      return
    }
    if (!isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (item.path) {
      // tabBar 页面用 switchTab
      if (item.path.includes('/stats/') || item.path.includes('/conversations/') || item.path.includes('/profile/') || item.path.includes('/explore/')) {
        Taro.switchTab({ url: item.path })
      } else {
        Taro.navigateTo({ url: item.path })
      }
    }
  }

  const handleSearchConfirm = (val: string) => {
    const k = val.trim()
    if (!k) return
    storage.addSearchHistory(k)
    setHistory(storage.getSearchHistory())
    Taro.setStorageSync('pending_search', k)
    Taro.switchTab({ url: '/pages/conversations/index' })
  }

  const handleMarketClick = (entry: MarketEntry) => {
    Taro.navigateTo({ url: `/pages/market/index?id=${entry.id}` })
  }

  const helloName = user?.username || '访客'
  const avatarInitial = (user?.username || 'D').slice(0, 1).toUpperCase()
  const displayTier = user?.tier || 'FREE'

  return (
    <ScrollView className={styles.page} scrollY enhanced showScrollbar={false}>
      {/* 欢迎区 */}
      <View className={styles.hero}>
        <View className={styles.heroTop}>
          <View className={styles.userInfo}>
            <View className={styles.avatar}>
              {user?.avatarUrl ? (
                <Image src={user.avatarUrl} mode="aspectFill" />
              ) : (
                <Text>{avatarInitial}</Text>
              )}
            </View>
            <View className={styles.userText}>
              <Text className={styles.hello}>你好，{helloName} 👋</Text>
              <View className={styles.subRow}>
                <TierBadge tier={displayTier} size="sm" />
                {isLoggedIn && (
                  <View className={styles.creditsChip}>
                    <Text>⭐</Text>
                    <Text>{user?.aiCredits ?? 0} 积分</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* 搜索框 */}
      <View className={styles.searchBox}>
        <NeuInput
          placeholder="搜索对话标题、内容、标签…"
          value={keyword}
          onInput={setKeyword}
          onConfirm={handleSearchConfirm}
          prefix={<Text>🔍</Text>}
          size="md"
        />
      </View>

      {/* 快捷功能 Bento */}
      <View className={styles.quickSection}>
        <View className={styles.bento}>
          {quickItems.map((item) => (
            <View
              key={item.key}
              className={styles.bentoItem}
              onClick={() => handleQuickClick(item)}
            >
              <View className={`${styles.bentoIcon} ${styles[item.tone]}`}>
                <Text>{item.icon}</Text>
              </View>
              <Text className={styles.bentoLabel}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>

      {/* 最新对话 */}
      <View className={styles.section}>
        <View className={styles.sectionHead}>
          <Text className={styles.sectionTitle}>最新对话</Text>
          <View
            className={styles.sectionMore}
            onClick={() => Taro.switchTab({ url: '/pages/conversations/index' })}
          >
            <Text>查看全部</Text>
            <Text>›</Text>
          </View>
        </View>

        {!loading && latest.length === 0 ? (
          <EmptyState icon="💬" title="还没有对话" desc="去同步你的 DeepSeek 账号吧～" />
        ) : (
          <ScrollView
            className={styles.convScroll}
            scrollX
            enhanced
            showScrollbar={false}
          >
            {latest.map((c) => (
              <View key={c.id} className={styles.convCard}>
                <ConvItem conv={c} />
              </View>
            ))}
          </ScrollView>
        )}
      </View>

      {/* 应用推荐 */}
      <View className={styles.section}>
        <View className={styles.sectionHead}>
          <Text className={styles.sectionTitle}>推荐应用</Text>
          <View
            className={styles.sectionMore}
            onClick={() => Taro.navigateTo({ url: '/pages/market/index' })}
          >
            <Text>全部应用</Text>
            <Text>›</Text>
          </View>
        </View>
        <View className={styles.marketGrid}>
          {market.map((m) => (
            <View
              key={m.id}
              className={styles.marketCard}
              onClick={() => handleMarketClick(m)}
            >
              <View
                className={
                  m.category === 'tool'
                    ? `${styles.marketIcon} ${styles.catTool}`
                    : m.category === 'community'
                      ? `${styles.marketIcon} ${styles.catCommunity}`
                      : styles.marketIcon
                }
              >
                <Text>{m.name.slice(0, 1)}</Text>
              </View>
              <Text className={styles.marketName}>{m.name}</Text>
              <Text className={styles.marketDesc}>{m.description || ''}</Text>
            </View>
          ))}
        </View>
      </View>

      <View style={{ height: 48 }} />
    </ScrollView>
  )
}
