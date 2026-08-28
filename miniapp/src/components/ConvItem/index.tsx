import React from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import styles from './index.module.scss'
import type { Conversation } from '@/types'
import { formatRelative } from '@/utils/date'

interface ConvItemProps {
  conv: Conversation
  onClick?: (id: number) => void
}

export default function ConvItem({ conv, onClick }: ConvItemProps) {
  const handleClick = () => {
    if (onClick) {
      onClick(conv.id)
    } else {
      Taro.navigateTo({
        url: `/pages/conversation-detail/index?id=${conv.id}`
      })
    }
  }
  return (
    <View className={styles.item} onClick={handleClick}>
      <View className={styles.head}>
        <Text className={styles.title}>{conv.title}</Text>
        <View className={styles.turnCount}>
          <Text>{conv.turnCount} 轮</Text>
        </View>
      </View>

      {conv.summaryTldr && (
        <Text className={styles.tldr}>{conv.summaryTldr}</Text>
      )}

      {conv.summaryTags && conv.summaryTags.length > 0 && (
        <View className={styles.tags}>
          {conv.summaryTags.map((t) => (
            <View key={t} className={styles.tag}>
              <Text>#{t}</Text>
            </View>
          ))}
        </View>
      )}

      <View className={styles.foot}>
        <Text className={styles.date}>{formatRelative(conv.insertedAt)}</Text>
        <Text className={styles.iconArrow}>›</Text>
      </View>
    </View>
  )
}
