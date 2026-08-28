import React, { useEffect } from 'react'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { AuthProvider } from '@/store/auth'
// 全局样式
import './app.scss'

function App(props: { children: React.ReactNode }) {
  useEffect(() => {
    // 微信平台初始化云开发（env 在部署阶段填入真实环境 ID）
    if (process.env.TARO_ENV === 'weapp') {
      try {
        Taro.cloud.init({
          env: '',
          traceUser: true
        })
        console.log('[App] Taro cloud inited')
      } catch (err) {
        console.error('[App] cloud init failed:', err)
      }
    }
  }, [])

  useDidShow(() => {
    console.log('[App] didShow')
  })

  useDidHide(() => {
    console.log('[App] didHide')
  })

  return <AuthProvider>{props.children}</AuthProvider>
}

export default App
