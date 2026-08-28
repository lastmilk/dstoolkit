import React, { useState, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import styles from './index.module.scss'
import NeuButton from '@/components/NeuButton'
import NeuCard from '@/components/NeuCard'
import EmptyState from '@/components/EmptyState'
import { callFunction } from '@/services/cloud'
import { useAuth } from '@/store/auth'
import { formatRelative } from '@/utils/date'
import type { DeepseekConfig } from '@/types'

export default function ConfigsPage() {
  const { isLoggedIn } = useAuth()
  const [list, setList] = useState<DeepseekConfig[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const d = await callFunction<DeepseekConfig[]>('getConfigs')
      setList(d)
    } catch (err) {
      console.error('[Configs] load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!isLoggedIn) return
    load()
  }, [isLoggedIn])

  usePullDownRefresh(() => {
    load().finally(() => Taro.stopPullDownRefresh())
  })

  const handleAdd = () => {
    Taro.showToast({ title: '添加引导页面开发中', icon: 'none' })
  }

  const handleSync = (c: DeepseekConfig) => {
    Taro.showLoading({ title: '同步中…' })
    setTimeout(() => {
      Taro.hideLoading()
      Taro.showToast({ title: `${c.name} 同步完成`, icon: 'success' })
    }, 1200)
  }

  if (!isLoggedIn) {
    return (
      <View className={styles.page} style={{ paddingTop: 48 }}>
        <EmptyState
          icon="🔒"
          title="请先登录"
          desc="登录后即可管理你的 DeepSeek 账号配置"
        />
        <View style={{ paddingHorizontal: 48, marginTop: 32 }}>
          <NeuButton
            type="primary"
            full
            onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}
          >
            去登录
          </NeuButton>
        </View>
      </View>
    )
  }

  return (
    <View className={styles.page}>
      <View className={styles.tip}>
        <Text style={{ flexShrink: 0 }}>ℹ️</Text>
        <Text>
          dstoolkit 通过密钥授权方式访问你的 DeepSeek 对话数据。
          你的凭据加密存储，随时可以撤销。
        </Text>
      </View>

      {!loading && list.length === 0 ? (
        <>
          <EmptyState
            icon="🔑"
            title="还没有配置"
            desc="点击下方按钮添加你的第一个 DeepSeek 账号"
          />
          <View style={{ paddingHorizontal: 48, marginTop: 32 }}>
            <NeuButton type="primary" full onClick={handleAdd}>
              + 添加 DeepSeek 账号
            </NeuButton>
          </View>
        </>
      ) : (
        <>
          <View className={styles.list}>
            {list.map((c) => (
              <View key={c.id} className={styles.configCard}>
                <View className={styles.configHead}>
                  <View className={styles.configIcon}>
                    <Text>{c.name.slice(0, 2)}</Text>
                  </View>
                  <View className={styles.configMeta}>
                    <Text className={styles.configName}>{c.name}</Text>
                    <Text className={styles.configId}>ID: {c.deepseekUserId}</Text>
                  </View>
                </View>

                <View className={styles.configStats}>
                  <View className={styles.stat}>
                    <Text className={styles.statVal}>{c.conversationCount ?? 0}</Text>
                    <Text className={styles.statLabel}>对话数</Text>
                  </View>
                  <View className={styles.stat}>
                    <Text className={styles.statVal}>✓</Text>
                    <Text className={styles.statLabel}>状态</Text>
                  </View>
                  <View className={styles.stat}>
                    <Text className={styles.statVal} style={{ fontSize: 24 }}>
                      {c.updatedAt ? formatRelative(c.updatedAt) : '--'}
                    </Text>
                    <Text className={styles.statLabel}>最近同步</Text>
                  </View>
                </View>

                <View className={styles.configRow}>
                  <Text className={styles.label}>📮 邮箱</Text>
                  <Text className={styles.value}>{c.deepseekEmail || '未设置'}</Text>
                </View>
                <View className={styles.configRow}>
                  <Text className={styles.label}>📱 手机</Text>
                  <Text className={styles.value}>{c.deepseekMobile || '未绑定'}</Text>
                </View>

                <View className={styles.actions}>
                  <NeuButton type="default" full onClick={() => handleSync(c)}>
                    <Text>🔄 立即同步</Text>
                  </NeuButton>
                  <NeuButton type="text" onClick={handleAdd}>
                    <Text>编辑</Text>
                  </NeuButton>
                </View>
              </View>
            ))}
          </View>

          <NeuButton type="primary" full onClick={handleAdd}>
            + 添加账号
          </NeuButton>
        </>
      )}
    </View>
  )
}
