import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import EmptyState from '@/components/EmptyState'
import { callFunction } from '@/services/cloud'
import type { MarketEntry } from '@/types'

const CATES: { key: string; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'official', label: '官方工具' },
  { key: 'tool', label: '效率工具' },
  { key: 'community', label: '社区精选' }
]

const PIC_IDS: Record<string, number> = {
  official: 1,
  tool: 9,
  community: 160
}

export default function MarketPage() {
  const [cate, setCate] = useState('all')
  const [list, setList] = useState<MarketEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = async () => {
    setLoading(true)
    try {
      const l = await callFunction<MarketEntry[]>('getMarketEntries', {
        category: cate === 'all' ? undefined : cate
      })
      setList(l)
    } catch (err) {
      console.error('[Market] load failed:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [cate])

  const handleOpen = (entry: MarketEntry) => {
    Taro.showModal({
      title: entry.name,
      content: `${entry.description || ''}\n\n即将在浏览器中打开：${entry.url}`,
      confirmText: '打开',
      success: (r) => {
        if (r.confirm) {
          Taro.setClipboardData({
            data: entry.url,
            success: () =>
              Taro.showToast({ title: '链接已复制', icon: 'success' })
          })
        }
      }
    })
  }

  return (
    <ScrollView className={styles.page} scrollY enhanced showScrollbar={false}>
      {/* 分类 */}
      <ScrollView
        className={styles.cateScroll}
        scrollX
        enhanced
        showScrollbar={false}
      >
        {CATES.map((c) => (
          <View
            key={c.key}
            className={classnames(styles.cateChip, cate === c.key && styles.active)}
            onClick={() => setCate(c.key)}
          >
            <Text>{c.label}</Text>
          </View>
        ))}
      </ScrollView>

      {/* 推广 Banner */}
      <View
        className={styles.banner}
        onClick={() => Taro.navigateTo({ url: '/pages/pricing/index' })}
      >
        <View className={styles.bannerText}>
          <Text className={styles.bannerTitle}>✨ 成为 PLUS 会员</Text>
          <Text className={styles.bannerDesc}>
            解锁 Alpaca 导出、对话分享、无限 AI 摘要…
          </Text>
        </View>
        <View className={styles.bannerAction}>
          <Text>去看看 ›</Text>
        </View>
      </View>

      {/* 应用网格 */}
      {!loading && list.length === 0 ? (
        <EmptyState icon="🧩" title="当前分类暂无应用" desc="去其他分类看看吧" />
      ) : (
        <View className={styles.grid}>
          {list.map((m) => (
            <View
              key={m.id}
              className={styles.appCard}
              onClick={() => handleOpen(m)}
            >
              <View className={styles.appHead}>
                <View
                  className={classnames(
                    styles.appIcon,
                    m.category === 'tool'
                      ? styles.tool
                      : m.category === 'community'
                        ? styles.community
                        : styles.official
                  )}
                >
                  <Text>{m.name.slice(0, 1)}</Text>
                </View>
                <View className={styles.appCate}>
                  <Text>
                    {m.category === 'official'
                      ? '官方'
                      : m.category === 'tool'
                        ? '工具'
                        : '社区'}
                  </Text>
                </View>
              </View>
              <Text className={styles.appName}>{m.name}</Text>
              <Text className={styles.appDesc}>{m.description || ''}</Text>
              <View className={styles.appFoot}>
                <Text className={styles.appStatus}>● 可用</Text>
                <Text className={styles.appBtn}>打开 ›</Text>
              </View>
            </View>
          ))}
        </View>
      )}

      <View style={{ height: 48 }} />
    </ScrollView>
  )
}
