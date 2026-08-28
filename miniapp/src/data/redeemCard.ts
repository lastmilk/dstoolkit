import type { RedeemRequest, RedeemResult } from '@/types'

export default async function redeemCard(
  params: RedeemRequest
): Promise<RedeemResult> {
  const code = params?.code?.trim().toUpperCase() || ''
  await new Promise((r) => setTimeout(r, 600))
  if (code.startsWith('PRO-')) {
    return {
      success: true,
      tier: 'PRO',
      duration: code.includes('YEAR') ? 'ANNUAL' : 'PERMANENT',
      expiresAt: code.includes('YEAR')
        ? new Date(Date.now() + 365 * 86400000).toISOString()
        : undefined,
      newCredits: 200
    }
  }
  if (code.startsWith('PLUS-')) {
    return {
      success: true,
      tier: 'PLUS',
      duration: 'ANNUAL',
      expiresAt: new Date(Date.now() + 365 * 86400000).toISOString(),
      newCredits: 500
    }
  }
  if (code.startsWith('ULT-')) {
    return {
      success: true,
      tier: 'ULTIMATE',
      duration: 'PERMANENT',
      newCredits: 2000
    }
  }
  return {
    success: false,
    tier: 'FREE',
    duration: 'PERMANENT'
  } as RedeemResult
}
