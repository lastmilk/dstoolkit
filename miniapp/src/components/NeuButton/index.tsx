import React from 'react'
import { Button, View } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

export type ButtonType = 'default' | 'primary' | 'text' | 'success' | 'warning' | 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

interface NeuButtonProps {
  className?: string
  type?: ButtonType
  size?: ButtonSize
  full?: boolean
  disabled?: boolean
  loading?: boolean
  onClick?: () => void
  children: React.ReactNode
}

export default function NeuButton({
  className,
  type = 'default',
  size = 'md',
  full = false,
  disabled = false,
  loading = false,
  onClick,
  children
}: NeuButtonProps) {
  const cls = classnames(
    styles.button,
    type === 'primary' && styles.primary,
    type === 'text' && styles.text,
    type === 'success' && styles.success,
    type === 'warning' && styles.warning,
    type === 'danger' && styles.danger,
    size === 'sm' && styles.sm,
    size === 'lg' && styles.lg,
    full && styles.full,
    disabled && styles.disabled,
    className
  )
  return (
    <Button
      className={cls}
      disabled={disabled || loading}
      loading={loading}
      onClick={onClick}
    >
      {children}
    </Button>
  )
}

interface NeuIconButtonProps {
  className?: string
  size?: 'sm' | 'md' | 'lg'
  accent?: boolean
  onClick?: () => void
  children: React.ReactNode
}

export function NeuIconButton({
  className,
  size = 'md',
  accent = false,
  onClick,
  children
}: NeuIconButtonProps) {
  const cls = classnames(
    styles.iconButton,
    size === 'sm' && styles.sm,
    size === 'lg' && styles.lg,
    accent && styles.accent,
    className
  )
  return (
    <View className={cls} onClick={onClick}>
      {children}
    </View>
  )
}
