import React, { useState, useEffect, useCallback } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { usePullDownRefresh, useReachBottom } from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import NeuInput from '@/components/NeuInput'
import { NeuIconButton } from '@/components/NeuButton'
import ConvItem from '@/components/ConvItem'
import EmptyState from '@/components/EmptyState'
import { callFunction } from '@/services/cloud'
import { storage } from '@/services/storage'
import type { Conversation, PageResponse } from '@/types'

interface TimeFilter {
  key: string
  label: string
}

const TIME_FILTERS: TimeFilter[] = [
  { key: 'all', label: '全部' },
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
  { key: 'folder', label: '文件夹' },
  { key: 'tag', label: '标签' }
]

export default function ConversationsPage() {
  const [keyword, setKeyword] = useState('')
  const [activeFilter, setActiveFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [list, setList] = useState<Conversation[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [noMore, setNoMore] = useState(false)
  const PAGE_SIZE = 15

  const loadList = useCallback(
    async (reset = false) => {
      const nextPage = reset ? 1 : page
      setLoading(true)
      try {
        const res = await callFunction<PageResponse<Conversation>>(
          'getConversations',
          {
            page: nextPage,
            pageSize: PAGE_SIZE,
            keyword: keyword || undefined
          }
        )
        setTotal(res.total)
        setNoMore(res.records.length < PAGE_SIZE)
        setList((prev) => (reset ? res.records : [...prev, ...res.records]))
        if (reset) setPage(2)
        else setPage(nextPage + 1)
      } catch (err) {
        console.error('[Conversations] load failed:', err)
      } finally {
        setLoading(false)
      }
    },
    [page, keyword]
  )

  // 首次加载 & 读取 pending_search
  useEffect(() => {
    const pending = Taro.getStorageSync('pending_search') as string
    if (pending) {
      setKeyword(pending)
      Taro.removeStorageSync('pending_search')
    }
    loadList(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 搜索变更防抖
  useEffect(() => {
    const t = setTimeout(() => loadList(true), 250)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keyword])

  usePullDownRefresh(() => {
    loadList(true).finally(() => Taro.stopPullDownRefresh())
  })

  useReachBottom(() => {
    if (!loading && !noMore) {
      loadList(false)
    }
  })

  return (
    <ScrollView
      className={styles.page}
      scrollY
      enhanced
      showScrollbar={false}
    >
      <View className={styles.header}>
        <View className={styles.searchRow}>
          <View className={styles.searchFlex}>
            <NeuInput
              placeholder="搜索对话标题、标签、内容…"
              value={keyword}
              onInput={setKeyword}
              prefix={<Text>🔍</Text>}
              size="sm"
            />
          </View>
          <View
            className={styles.filterButton}
            onClick={() => Taro.showToast({ title: '高级筛选开发中', icon: 'none' })}
          >
            <Text>⚙</Text>
          </View>
        </View>

        <ScrollView
          className={styles.chipScroll}
          scrollX
          enhanced
          showScrollbar={false}
        >
          {TIME_FILTERS.map((f) => (
            <View
              key={f.key}
              className={classnames(styles.chip, activeFilter === f.key && styles.active)}
              onClick={() => {
                setActiveFilter(f.key)
                Taro.showToast({ title: `${f.label} 筛选`, icon: 'none' })
              }}
            >
              <Text>{f.label}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      <View className={styles.listMeta}>
        <Text>
          {keyword ? `「${keyword}」的` : ''} 共 {total} 条对话
        </Text>
        <Text>{loading ? '加载中…' : noMore && list.length > 0 ? '没有更多了' : ''}</Text>
      </View>

      {!loading && list.length === 0 ? (
        <EmptyState
          icon="💬"
          title={keyword ? '没有匹配的对话' : '还没有对话'}
          desc={keyword ? '试试换个关键词吧' : '先去「我的 - 配置管理」同步账号吧'}
        />
      ) : (
        <View className={styles.list}>
          {list.map((c) => (
            <ConvItem key={c.id} conv={c} />
          ))}
        </View>
      )}

      {list.length > 0 && (loading || !noMore) && (
        <View className={styles.loadMore}>
          <Text>{loading ? '加载中…' : '上拉加载更多'}</Text>
        </View>
      )}
    </ScrollView>
  )
}
