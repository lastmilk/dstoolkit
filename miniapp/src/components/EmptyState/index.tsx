import React from 'react'
import { View, Text } from '@tarojs/components'
import styles from './index.module.scss'

interface EmptyStateProps {
  icon?: string
  title?: string
  desc?: string
}

export default function EmptyState({
  icon = '📭',
  title = '暂无数据',
  desc = '这里什么都没有，稍后再来看看吧～'
}: EmptyStateProps) {
  return (
    <View className={styles.wrap}>
      <View className={styles.icon}>
        <Text>{icon}</Text>
      </View>
      <Text className={styles.title}>{title}</Text>
      <Text className={styles.desc}>{desc}</Text>
    </View>
  )
}
