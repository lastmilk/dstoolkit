/**
 * dstoolkit 后端 HTTP API 封装（可选，与云调用互补）
 * 如果后端已上线，可直接使用；否则使用 cloud.ts 走 mock/云函数
 */
import Taro from '@tarojs/taro'
import type {
  LoginRequest,
  LoginResponse,
  UserInfo,
  Conversation,
  PageResponse,
  DeepseekConfig,
  StatsData,
  RedeemRequest,
  RedeemResult,
  MarketEntry
} from '@/types'

const BASE_URL = 'https://api.dstoolkit.cn/api'

/** 通用请求 */
async function request<T>(
  path: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  opts: { auth?: boolean } = { auth: true }
): Promise<T> {
  const token = Taro.getStorageSync('token')
  const header: Record<string, string> = {
    'Content-Type': 'application/json'
  }
  if (opts.auth && token) {
    header['Authorization'] = `Bearer ${token}`
  }

  console.log(`[API] ${method} ${path}`, data || '')
  try {
    const res = await Taro.request({
      url: `${BASE_URL}${path}`,
      method,
      data,
      header,
      timeout: 15000
    })
    if (res.statusCode >= 200 && res.statusCode < 300) {
      return res.data as T
    }
    throw new Error(`HTTP ${res.statusCode}`)
  } catch (err: any) {
    console.error(`[API] ${method} ${path} error:`, err)
    throw err
  }
}

export const api = {
  // === 认证 ===
  login: (body: LoginRequest) =>
    request<LoginResponse>('/auth/login', 'POST', body, { auth: false }),

  register: (body: LoginRequest) =>
    request<LoginResponse>('/auth/register', 'POST', body, { auth: false }),

  me: () => request<UserInfo>('/auth/me'),

  // === 配置 ===
  listConfigs: () => request<DeepseekConfig[]>('/configs'),

  // === 对话 ===
  listConversations: (params: {
    page?: number
    pageSize?: number
    keyword?: string
  }) =>
    request<PageResponse<Conversation>>(
      `/conversations?${new URLSearchParams(
        params as any
      ).toString()}`
    ),

  // === 统计 ===
  getStats: (range: '7d' | '30d' | 'all' = '30d') =>
    request<StatsData>(`/stats?range=${range}`),

  // === 卡密 ===
  redeem: (body: RedeemRequest) =>
    request<RedeemResult>('/subscription/redeem', 'POST', body),

  // === 应用市场 ===
  listMarket: (category?: string) =>
    request<MarketEntry[]>(
      `/market${category ? `?category=${category}` : ''}`,
      'GET',
      undefined,
      { auth: false }
    )
}
