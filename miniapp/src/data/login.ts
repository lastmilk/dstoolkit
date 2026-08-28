import type { UserInfo, LoginRequest, LoginResponse } from '@/types'

const MOCK_USER: UserInfo = {
  id: 1,
  username: 'demo_user',
  role: 'USER',
  tier: 'PRO',
  tierActivatedAt: '2026-01-15T08:00:00Z',
  tierExpiresAt: '2027-01-15T08:00:00Z',
  isPermanentTier: false,
  aiCredits: 1280,
  referralCode: 'DSTK888',
  avatarUrl: 'https://picsum.photos/id/64/200/200',
  adRewardTier: null,
  adRewardExpiresAt: null,
  cloudSyncEnabled: true,
  createdAt: '2025-11-20T10:00:00Z'
}

export default async function login(
  params: LoginRequest
): Promise<LoginResponse> {
  // 模拟简单鉴权：任意用户名/密码均可登录
  await new Promise((r) => setTimeout(r, 500))
  const username = params?.username?.trim() || 'demo_user'
  return {
    token: 'mock_token_' + Math.random().toString(36).slice(2, 10),
    user: {
      ...MOCK_USER,
      username
    }
  }
}
