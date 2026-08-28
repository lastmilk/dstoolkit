/**
 * 本地存储封装（统一 Key 管理，避免硬编码）
 */
import Taro from '@tarojs/taro'
import type { UserInfo } from '@/types'

const KEYS = {
  TOKEN: 'dstk_token',
  USER: 'dstk_user',
  SEARCH_HISTORY: 'dstk_search_history'
} as const

export const storage = {
  // === Token ===
  getToken(): string {
    try {
      return Taro.getStorageSync(KEYS.TOKEN) || ''
    } catch {
      return ''
    }
  },
  setToken(token: string) {
    try {
      Taro.setStorageSync(KEYS.TOKEN, token)
    } catch (err) {
      console.error('[Storage] setToken failed:', err)
    }
  },
  clearToken() {
    try {
      Taro.removeStorageSync(KEYS.TOKEN)
    } catch (_) {}
  },

  // === 用户信息 ===
  getUser(): UserInfo | null {
    try {
      const raw = Taro.getStorageSync(KEYS.USER)
      return raw ? (JSON.parse(raw) as UserInfo) : null
    } catch {
      return null
    }
  },
  setUser(user: UserInfo) {
    try {
      Taro.setStorageSync(KEYS.USER, JSON.stringify(user))
    } catch (err) {
      console.error('[Storage] setUser failed:', err)
    }
  },
  clearUser() {
    try {
      Taro.removeStorageSync(KEYS.USER)
    } catch (_) {}
  },

  // === 搜索历史 ===
  getSearchHistory(): string[] {
    try {
      const raw = Taro.getStorageSync(KEYS.SEARCH_HISTORY)
      return raw ? (JSON.parse(raw) as string[]) : []
    } catch {
      return []
    }
  },
  addSearchHistory(keyword: string, max = 10) {
    try {
      const list = storage.getSearchHistory().filter(
        (k) => k !== keyword
      )
      list.unshift(keyword)
      const trimmed = list.slice(0, max)
      Taro.setStorageSync(KEYS.SEARCH_HISTORY, JSON.stringify(trimmed))
    } catch (_) {}
  },
  clearSearchHistory() {
    try {
      Taro.removeStorageSync(KEYS.SEARCH_HISTORY)
    } catch (_) {}
  },

  // === 清空全部（登出）===
  clearAll() {
    storage.clearToken()
    storage.clearUser()
  }
}
