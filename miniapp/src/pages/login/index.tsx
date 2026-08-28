import React, { useState } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import classnames from 'classnames'
import styles from './index.module.scss'
import NeuInput from '@/components/NeuInput'
import NeuButton from '@/components/NeuButton'
import { useAuth } from '@/store/auth'

type Mode = 'login' | 'register'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [password2, setPassword2] = useState('')
  const [agree, setAgree] = useState(true)
  const [errors, setErrors] = useState<{ [k: string]: string }>({})
  const { login, isLoading } = useAuth()

  const validate = (): boolean => {
    const e: { [k: string]: string } = {}
    if (!username.trim()) e.username = '请输入用户名'
    else if (username.length < 3) e.username = '用户名至少 3 位'
    if (!password) e.password = '请输入密码'
    else if (password.length < 6) e.password = '密码至少 6 位'
    if (mode === 'register') {
      if (!password2) e.password2 = '请再次输入密码'
      else if (password !== password2) e.password2 = '两次密码不一致'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const handleSubmit = async () => {
    if (!agree) {
      Taro.showToast({ title: '请先同意服务条款', icon: 'none' })
      return
    }
    if (!validate()) return
    try {
      await login({ username: username.trim(), password })
      Taro.showToast({ title: mode === 'login' ? '登录成功' : '注册成功', icon: 'success' })
      setTimeout(() => {
        Taro.navigateBack({ delta: 1 }).catch(() => {
          Taro.switchTab({ url: '/pages/explore/index' })
        })
      }, 600)
    } catch (err: any) {
      Taro.showToast({
        title: err?.message || (mode === 'login' ? '登录失败' : '注册失败'),
        icon: 'none'
      })
    }
  }

  return (
    <View className={styles.page}>
      {/* 品牌 */}
      <View className={styles.brand}>
        <View className={styles.logo}>
          <Text>DS</Text>
        </View>
        <Text className={styles.brandTitle}>dstoolkit</Text>
        <Text className={styles.brandSlogan}>
          DeepSeek 对话数据管理专家 · 搜索、摘要、整理、分享一站搞定
        </Text>
      </View>

      {/* 表单 */}
      <View className={styles.formCard}>
        <View className={styles.tabs}>
          <View
            className={classnames(styles.tab, mode === 'login' && styles.active)}
            onClick={() => setMode('login')}
          >
            <Text>登录</Text>
          </View>
          <View
            className={classnames(styles.tab, mode === 'register' && styles.active)}
            onClick={() => setMode('register')}
          >
            <Text>注册</Text>
          </View>
        </View>

        <View className={styles.fieldGap}>
          <NeuInput
            label="用户名"
            placeholder="请输入用户名/邮箱"
            value={username}
            onInput={setUsername}
            prefix={<Text>👤</Text>}
            error={errors.username}
            maxLength={32}
          />
          <NeuInput
            label="密码"
            placeholder="请输入密码（至少 6 位）"
            type="password"
            value={password}
            onInput={setPassword}
            prefix={<Text>🔒</Text>}
            error={errors.password}
            maxLength={64}
          />
          {mode === 'register' && (
            <NeuInput
              label="确认密码"
              placeholder="请再次输入密码"
              type="password"
              value={password2}
              onInput={setPassword2}
              prefix={<Text>🔒</Text>}
              error={errors.password2}
              maxLength={64}
            />
          )}
        </View>

        {/* 同意协议 */}
        <View className={styles.agreeRow} onClick={() => setAgree(!agree)}>
          <View className={classnames(styles.checkbox, agree && styles.checked)}>
            <Text>{agree ? '✓' : ''}</Text>
          </View>
          <Text className={styles.agreeText}>
            我已阅读并同意
            <Text className={styles.link}>《服务条款》</Text>
            和
            <Text className={styles.link}>《隐私协议》</Text>
            ，了解数据将加密存储在云端。
          </Text>
        </View>

        <NeuButton
          type="primary"
          size="lg"
          full
          loading={isLoading}
          onClick={handleSubmit}
        >
          {mode === 'login' ? '登录' : '创建账号'}
        </NeuButton>
      </View>

      <View className={styles.footer}>
        <View className={styles.divider}>
          <Text>关于数据安全</Text>
        </View>
        <Text
          style={{
            fontSize: 22,
            color: '#86909c',
            textAlign: 'center',
            lineHeight: 1.8
          }}
        >
          🔐 账号密码本地加密传输，不会被明文保存
          {'\n'}💡 当前为演示环境，任意用户名/密码均可登录
        </Text>
      </View>
    </View>
  )
}
