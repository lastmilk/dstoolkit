import React, { useState } from 'react'
import { View, Input } from '@tarojs/components'
import classnames from 'classnames'
import styles from './index.module.scss'

interface NeuInputProps {
  className?: string
  label?: string
  placeholder?: string
  value?: string
  defaultValue?: string
  type?: 'text' | 'password' | 'number' | 'idcard'
  size?: 'sm' | 'md'
  prefix?: React.ReactNode
  suffix?: React.ReactNode
  error?: string
  maxLength?: number
  onInput?: (value: string) => void
  onBlur?: () => void
  onFocus?: () => void
  onConfirm?: (value: string) => void
}

export default function NeuInput({
  className,
  label,
  placeholder,
  value,
  defaultValue,
  type = 'text',
  size = 'md',
  prefix,
  suffix,
  error,
  maxLength = 100,
  onInput,
  onBlur,
  onFocus,
  onConfirm
}: NeuInputProps) {
  const [focused, setFocused] = useState(false)
  const boxCls = classnames(
    styles.inputBox,
    size === 'sm' && styles.sm,
    focused && styles.focused,
    !!error && styles.error,
    className
  )
  return (
    <View className={styles.wrap}>
      {label && <View className={styles.label}>{label}</View>}
      <View className={boxCls}>
        {prefix && <View className={styles.prefix}>{prefix}</View>}
        <Input
          className={styles.input}
          type={type}
          password={type === 'password'}
          value={value}
          defaultValue={defaultValue}
          placeholder={placeholder}
          maxlength={maxLength}
          onInput={(e) => onInput?.(e.detail.value)}
          onFocus={() => {
            setFocused(true)
            onFocus?.()
          }}
          onBlur={() => {
            setFocused(false)
            onBlur?.()
          }}
          onConfirm={(e) => onConfirm?.(e.detail.value)}
          confirmType="done"
        />
        {suffix && <View className={styles.suffix}>{suffix}</View>}
      </View>
      {error && <View className={styles.errorMsg}>{error}</View>}
    </View>
  )
}
