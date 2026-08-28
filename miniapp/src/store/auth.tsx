import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode
} from 'react'
import type { UserInfo, LoginRequest, LoginResponse } from '@/types'
import { callFunction } from '@/services/cloud'
import { storage } from '@/services/storage'

interface AuthContextValue {
  user: UserInfo | null
  token: string
  isLoggedIn: boolean
  isLoading: boolean
  login: (req: LoginRequest) => Promise<LoginResponse>
  logout: () => void
  refreshUser: () => Promise<void>
  updateCredits: (delta: number) => void
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserInfo | null>(storage.getUser())
  const [token, setToken] = useState<string>(storage.getToken())
  const [isLoading, setIsLoading] = useState(false)

  const login = useCallback(async (req: LoginRequest) => {
    setIsLoading(true)
    try {
      const res = await callFunction<LoginResponse>('login', req)
      storage.setToken(res.token)
      storage.setUser(res.user)
      setToken(res.token)
      setUser(res.user)
      return res
    } catch (err) {
      console.error('[Auth] login failed:', err)
      throw err
    } finally {
      setIsLoading(false)
    }
  }, [])

  const logout = useCallback(() => {
    storage.clearAll()
    setToken('')
    setUser(null)
    console.log('[Auth] logged out')
  }, [])

  const refreshUser = useCallback(async () => {
    // 从本地刷新（云环境时可扩展为调用 me 接口）
    const u = storage.getUser()
    setUser(u)
  }, [])

  const updateCredits = useCallback((delta: number) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, aiCredits: Math.max(0, prev.aiCredits + delta) }
      storage.setUser(next)
      return next
    })
  }, [])

  useEffect(() => {
    const t = storage.getToken()
    const u = storage.getUser()
    if (t && !token) setToken(t)
    if (u && !user) setUser(u)
  }, [token, user])

  const value: AuthContextValue = {
    user,
    token,
    isLoggedIn: !!token,
    isLoading,
    login,
    logout,
    refreshUser,
    updateCredits
  }

  return React.createElement(AuthContext.Provider, { value }, children)
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
