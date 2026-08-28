import React from 'react'
import { View } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

interface NeuCardProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  variant?: 'raised' | 'flat' | 'inset'
  clickable?: boolean
  onClick?: () => void
  children: React.ReactNode
}

export default function NeuCard({
  className,
  size = 'md',
  variant = 'raised',
  clickable = false,
  onClick,
  children
}: NeuCardProps) {
  const cls = classnames(
    styles.card,
    size === 'sm' && styles.sm,
    size === 'lg' && styles.lg,
    variant === 'flat' && styles.flat,
    variant === 'inset' && styles.inset,
    clickable && styles.clickable,
    className
  )
  return (
    <View className={cls} onClick={onClick}>
      {children}
    </View>
  )
}
