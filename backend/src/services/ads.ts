import crypto from 'crypto'
import { prisma } from '../utils/prisma.js'
import { env } from '../config/env.js'
import { TIER_RANK } from '../utils/quota.js'
import { resolveEffectiveTier } from './subscription.js'
import type { Tier, PrismaClient } from '@prisma/client'

/** 事务或普通客户端共有的子集（adDailyLog/user/adWatch 三表）。 */
type AdTx = Pick<PrismaClient, 'adDailyLog' | 'user' | 'adWatch'>

// ═══════════ 日期工具（服务器本地 Asia/Shanghai） ═══════════

/** 格式化本地日期为 "YYYY-MM-DD" */
function fmtDate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** 本地当日 23:59:59.999（广告 boost 到期时间） */
function endOfToday(now: Date = new Date()): Date {
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999)
}

/** 前 N 天的同一时刻（用于回溯连击） */
function daysAgo(now: Date, n: number): Date {
  const d = new Date(now)
  d.setDate(d.getDate() - n)
  return d
}

// ═══════════ 穿山甲服务端回调验签 ═══════════

/**
 * 穿山甲激励视频服务端回调签名校验。
 * 规则：sign = sha256(`${SecurityKey}:${trans_id}`)
 */
export function verifyCsjSign(transId: unknown, sign: unknown, securityKey: string): boolean {
  if (!securityKey || !transId || !sign) return false
  const raw = `${securityKey}:${String(transId)}`
  const expected = crypto.createHash('sha256').update(raw).digest('hex')
  return expected === String(sign).toLowerCase()
}

// ═══════════ 连击计算 ═══════════

/**
 * 自 endDate（含）向前数连续"当日达标"（count>=target）的天数。
 * endDate 当日未达标则返回 0（连击在 endDate 断裂）。
 */
async function computeStreak(
  userId: number,
  endDate: Date,
  client: AdTx = prisma,
): Promise<number> {
  const endStr = fmtDate(endDate)
  const start = daysAgo(endDate, 31)
  const target = env.csjRewardDailyTarget
  const logs = await client.adDailyLog.findMany({
    where: { userId, date: { gte: fmtDate(start), lte: endStr } },
    select: { date: true, count: true },
  })
  const qualify = new Set(logs.filter((l) => l.count >= target).map((l) => l.date))
  let streak = 0
  const cur = new Date(endDate)
  cur.setHours(0, 0, 0, 0)
  while (streak < 60) {
    const s = fmtDate(cur)
    if (!qualify.has(s)) break
    streak++
    cur.setDate(cur.getDate() - 1)
  }
  return streak
}

// ═══════════ 权益发放 ═══════════

/**
 * 当日第 target 次到达时调用：根据"昨日及之前连续达标天数 + 今日"决定当日 boost 等级。
 * newStreak >= streakForPlus → PLUS，否则 PRO。
 * 仅当本次恰好将 count 推到 target 时调用，避免重复发放。
 */
async function grantDailyAdReward(
  userId: number,
  tx: AdTx,
): Promise<{ tier: Tier; expiresAt: Date; streak: number }> {
  const yesterday = daysAgo(new Date(), 1)
  yesterday.setHours(0, 0, 0, 0)
  const yesterdayStreak = await computeStreak(userId, yesterday, tx)
  const newStreak = yesterdayStreak + 1
  const tier: Tier = newStreak >= env.csjRewardStreakForPlus ? 'PLUS' : 'PRO'
  const expiresAt = endOfToday()
  await tx.user.update({
    where: { id: userId },
    data: { adRewardTier: tier, adRewardExpiresAt: expiresAt },
  })
  return { tier, expiresAt, streak: newStreak }
}

// ═══════════ webhook 主入口 ═══════════

export interface CsjCallbackPayload {
  user_id: unknown
  trans_id: unknown
  reward_name?: unknown
  reward_amount?: unknown
  extra?: unknown
  sign: unknown
}

export interface RecordResult {
  isValid: boolean
  reason?: string
  granted?: { tier: Tier; expiresAt: Date; streak: number }
}

/**
 * 处理穿山甲服务端激励回调：
 * 1. 验签（Security Key 未配置→严格拒绝）
 * 2. 校验 user_id 存在
 * 3. 幂等写入 AdWatch（transId 唯一，skipDuplicates）
 * 4. AdDailyLog 计数 +1；恰好达 target → 发放当日 boost
 */
export async function recordAdWatch(p: CsjCallbackPayload): Promise<RecordResult> {
  const securityKey = env.csjRewardSecurityKey
  if (!securityKey) {
    console.error('[ads/webhook] CSJ_REWARD_SECURITY_KEY 未配置，拒绝回调')
    return { isValid: false, reason: 'security_key_unset' }
  }
  if (!verifyCsjSign(p.trans_id, p.sign, securityKey)) {
    return { isValid: false, reason: 'bad_sign' }
  }
  const userId = Number(p.user_id)
  if (!Number.isInteger(userId) || userId <= 0) {
    return { isValid: false, reason: 'bad_user' }
  }
  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })
  if (!exists) return { isValid: false, reason: 'no_user' }

  const todayStr = fmtDate(new Date())
  const transId = String(p.trans_id)
  const rewardAmount = Number(p.reward_amount) || 0

  const res = await prisma.$transaction(async (tx) => {
    const r = await tx.adWatch.createMany({
      data: { userId, transId, rewardAmount },
      skipDuplicates: true,
    })
    if (r.count === 0) return { dup: true as const, granted: undefined }
    const log = await tx.adDailyLog.upsert({
      where: { userId_date: { userId, date: todayStr } },
      create: { userId, date: todayStr, count: 1 },
      update: { count: { increment: 1 } },
      select: { count: true },
    })
    if (log.count === env.csjRewardDailyTarget) {
      const granted = await grantDailyAdReward(userId, tx)
      return { dup: false as const, granted }
    }
    return { dup: false as const, granted: undefined }
  })

  return { isValid: true, granted: res.granted }
}

// ═══════════ 有效等级（含广告 boost，绝不降级） ═══════════

/**
 * 有效等级 = max(付费有效等级, 广告 boost)。
 * 广告 boost 仅当 adRewardTier 非空且未过期时生效。
 * 调用方须 select adRewardTier/adRewardExpiresAt；未 select 时视为无 boost。
 */
export function resolveEffectiveTierWithAdBoost(user: {
  tier: Tier
  tierExpiresAt: Date | null
  isPermanentTier: boolean
  adRewardTier?: Tier | null
  adRewardExpiresAt?: Date | null
}): Tier {
  const paid = resolveEffectiveTier(user)
  const now = new Date()
  const boost =
    user.adRewardTier && user.adRewardExpiresAt && user.adRewardExpiresAt > now
      ? user.adRewardTier
      : null
  if (boost && (TIER_RANK[boost] ?? 0) > (TIER_RANK[paid] ?? 0)) return boost
  return paid
}

// ═══════════ /api/ads/status 数据 ═══════════

export interface AdStatusDTO {
  watchedToday: number
  requiredDaily: number
  streakDays: number
  todayComplete: boolean
  rewardTier: Tier | null
  rewardExpiresAt: Date | null
  nextRewardTier: Tier
  streakForPlus: number
}

export async function getAdStatus(userId: number): Promise<AdStatusDTO> {
  const now = new Date()
  const todayStr = fmtDate(now)
  const yesterday = daysAgo(now, 1)
  yesterday.setHours(0, 0, 0, 0)
  const target = env.csjRewardDailyTarget

  const [todayLog, user, yesterdayStreak] = await Promise.all([
    prisma.adDailyLog.findUnique({
      where: { userId_date: { userId, date: todayStr } },
      select: { count: true },
    }),
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { adRewardTier: true, adRewardExpiresAt: true },
    }),
    computeStreak(userId, yesterday),
  ])

  const watchedToday = todayLog?.count ?? 0
  const todayComplete = watchedToday >= target
  const streakDays = todayComplete ? yesterdayStreak + 1 : yesterdayStreak
  const boostActive = !!(
    user.adRewardTier &&
    user.adRewardExpiresAt &&
    user.adRewardExpiresAt > now
  )
  const nextStreak = yesterdayStreak + 1
  const nextRewardTier: Tier = nextStreak >= env.csjRewardStreakForPlus ? 'PLUS' : 'PRO'

  return {
    watchedToday: Math.min(watchedToday, target),
    requiredDaily: target,
    streakDays,
    todayComplete,
    rewardTier: boostActive ? user.adRewardTier : null,
    rewardExpiresAt: boostActive ? user.adRewardExpiresAt : null,
    nextRewardTier,
    streakForPlus: env.csjRewardStreakForPlus,
  }
}

// ═══════════ /api/ads/history（连击日历） ═══════════

export async function getAdHistory(userId: number, days = 30) {
  const n = Math.min(Math.max(days, 1), 90)
  const start = daysAgo(new Date(), n - 1)
  const logs = await prisma.adDailyLog.findMany({
    where: { userId, date: { gte: fmtDate(start) } },
    select: { date: true, count: true, updatedAt: true },
    orderBy: { date: 'asc' },
  })
  return logs
}
