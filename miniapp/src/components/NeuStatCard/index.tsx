import React from 'react'
import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

export type IconTone = 'primary' | 'success' | 'warning' | 'purple' | 'credits'

interface NeuStatCardProps {
  className?: string
  icon: string
  iconTone?: IconTone
  label: string
  value: string | number
  sub?: string
  subTone?: 'up' | 'down' | 'normal'
}

export default function NeuStatCard({
  className,
  icon,
  iconTone = 'primary',
  label,
  value,
  sub,
  subTone = 'normal'
}: NeuStatCardProps) {
  return (
    <View className={classnames(styles.card, className)}>
      <View className={classnames(styles.icon, styles[iconTone])}>
        <Text>{icon}</Text>
      </View>
      <View className={styles.label}>{label}</View>
      <View className={styles.value}>{value}</View>
      {sub && (
        <View className={styles.sub}>
          {subTone === 'up' && <Text className={styles.up}>{sub}</Text>}
          {subTone === 'down' && <Text className={styles.down}>{sub}</Text>}
          {subTone === 'normal' && <Text>{sub}</Text>}
        </View>
      )}
    </View>
  )
}
