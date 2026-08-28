import React, { useCallback } from 'react'
import { View, Text, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import styles from './index.module.scss'
import { useAuth } from '@/store/auth'
import TierBadge from '@/components/TierBadge'
import NeuButton from '@/components/NeuButton'
import classnames from 'classnames'

interface MenuEntry {
  key: string
  icon: string
  tone?: string
  title: string
  sub?: string
  badge?: string
  path?: string
  needLogin?: boolean
  action?: () => void
}

export default function ProfilePage() {
  const { user, isLoggedIn, logout, refreshUser } = useAuth()

  usePullDownRefresh(async () => {
    try {
      await refreshUser()
    } finally {
      Taro.stopPullDownRefresh()
    }
  })

  const goLogin = () => {
    Taro.navigateTo({ url: '/pages/login/index' })
  }

  const handleLogout = () => {
    Taro.showModal({
      title: '确认退出登录？',
      content: '退出后需要重新登录才能查看你的数据',
      confirmColor: '#f53f3f',
      success: (r) => {
        if (r.confirm) {
          logout()
          Taro.showToast({ title: '已退出登录', icon: 'success' })
        }
      }
    })
  }

  const handleMenuItem = (e: MenuEntry) => {
    if (e.action) {
      e.action()
      return
    }
    if (e.needLogin && !isLoggedIn) {
      Taro.showToast({ title: '请先登录', icon: 'none' })
      return
    }
    if (e.path) Taro.navigateTo({ url: e.path })
  }

  const menuEntries: MenuEntry[] = [
    {
      key: 'configs',
      icon: '⚙',
      title: '配置管理',
      sub: user ? `已绑定 ${1} 个 DeepSeek 账号` : '绑定你的 DeepSeek 账号',
      tone: 'blue',
      needLogin: true,
      path: '/pages/configs/index'
    },
    {
      key: 'redeem',
      icon: '🎫',
      tone: 'orange',
      title: '卡密兑换',
      sub: '输入激活码升级会员',
      path: '/pages/redeem/index'
    },
    {
      key: 'pricing',
      icon: '💎',
      tone: 'purple',
      title: '会员中心',
      sub: '查看四档会员权益，立即开通',
      path: '/pages/pricing/index'
    },
    {
      key: 'market',
      icon: '🧩',
      tone: 'green',
      title: '应用市场',
      sub: 'Alpaca 导出、时间线等工具',
      path: '/pages/market/index'
    },
    {
      key: 'reward',
      icon: '🎬',
      tone: 'gold',
      title: '看广告领权益',
      sub: '免费领取临时 PRO 体验',
      action: () => Taro.showToast({ title: '激励视频接入中', icon: 'none' })
    },
    {
      key: 'share',
      icon: '🔗',
      tone: 'blue',
      title: '邀请好友',
      sub: '邀请注册返 AI 积分奖励',
      needLogin: true,
      action: () => Taro.showToast({ title: '分享卡片生成中', icon: 'none' })
    },
    {
      key: 'about',
      icon: 'ℹ️',
      title: '关于 dstoolkit',
      sub: 'v1.0.0 · 对话数据管理专家',
      action: () => Taro.showToast({ title: 'dstoolkit.cn', icon: 'none' })
    }
  ]

  const avatarInitial = (user?.username || 'D').slice(0, 1).toUpperCase()

  return (
    <View className={styles.page}>
      {!isLoggedIn ? (
        <View className={styles.loginCard}>
          <View className={styles.loginIcon}>
            <Text>🔒</Text>
          </View>
          <Text className={styles.loginTitle}>欢迎使用 dstoolkit</Text>
          <Text className={styles.loginDesc}>
            登录后可同步你的 DeepSeek 对话记录、查看 AI 摘要、使用会员功能。
            你的数据全部由自己掌控。
          </Text>
          <NeuButton type="primary" size="lg" full onClick={goLogin}>
            立即登录 / 注册
          </NeuButton>
        </View>
      ) : (
        <View className={styles.userCard}>
          <View className={styles.userRow}>
            <View className={styles.avatar}>
              {user?.avatarUrl ? (
                <Image src={user.avatarUrl} mode="aspectFill" />
              ) : (
                <Text>{avatarInitial}</Text>
              )}
            </View>
            <View className={styles.userMeta}>
              <Text className={styles.username}>{user?.username}</Text>
              <View className={styles.userSub}>
                <TierBadge tier={user?.tier || 'FREE'} solid size="sm" />
                {user?.adRewardTier && (
                  <TierBadge tier={user.adRewardTier} size="sm" />
                )}
              </View>
              <Text className={styles.userExtra}>
                加入于 {new Date(user?.createdAt || Date.now()).toLocaleDateString()}
              </Text>
            </View>
          </View>

          <View className={styles.infoRow}>
            <View className={styles.infoItem}>
              <Text className={classnames(styles.infoValue, styles.credits)}>
                {user?.aiCredits ?? 0}
              </Text>
              <Text className={styles.infoLabel}>AI 积分</Text>
            </View>
            <View className={styles.infoItem}>
              <Text className={styles.infoValue}>--</Text>
              <Text className={styles.infoLabel}>对话总数</Text>
            </View>
            <View className={styles.infoItem}>
              <Text className={styles.infoValue}>
                {user?.referralCode ? user.referralCode : '未开通'}
              </Text>
              <Text className={styles.infoLabel}>邀请码</Text>
            </View>
          </View>
        </View>
      )}

      {/* 功能列表 */}
      <View className={styles.menuGroup}>
        {menuEntries.map((e) => (
          <View
            key={e.key}
            className={styles.menuItem}
            onClick={() => handleMenuItem(e)}
          >
            <View
              className={classnames(
                styles.menuIcon,
                e.tone &&
                  ({
                    blue: '',
                    orange: styles.orange,
                    purple: styles.purple,
                    green: styles.green,
                    red: styles.red,
                    gold: styles.gold
                  } as Record<string, string>)[e.tone]
              )}
            >
              <Text>{e.icon}</Text>
            </View>
            <View className={styles.menuText}>
              <Text className={styles.menuTitle}>{e.title}</Text>
              {e.sub && <Text className={styles.menuSub}>{e.sub}</Text>}
            </View>
            {e.badge && <View className={styles.menuBadge}>{e.badge}</View>}
            <Text className={styles.menuArrow}>›</Text>
          </View>
        ))}
      </View>

      {/* 退出登录 */}
      {isLoggedIn && (
        <View style={{ marginTop: 48 }}>
          <NeuButton type="danger" full onClick={handleLogout}>
            退出登录
          </NeuButton>
        </View>
      )}
    </View>
  )
}
