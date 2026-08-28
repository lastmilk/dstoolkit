import React from 'react'
import { View, Text } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'
import type { Tier } from '@/types'

interface TierBadgeProps {
  tier: Tier
  size?: 'sm' | 'lg'
  solid?: boolean
  className?: string
}

const LABEL: Record<Tier, string> = {
  FREE: 'FREE 免费',
  PRO: 'PRO 专业',
  PLUS: 'PLUS 进阶',
  ULTIMATE: 'ULTIMATE 旗舰',
  TEAM: 'TEAM 团队'
}

export default function TierBadge({
  tier,
  size = 'sm',
  solid = false,
  className
}: TierBadgeProps) {
  const cls = classnames(
    styles.badge,
    styles[tier],
    size === 'lg' && styles.lg,
    solid && styles.solid,
    className
  )
  return (
    <View className={cls}>
      <Text>{LABEL[tier]}</Text>
    </View>
  )
}
