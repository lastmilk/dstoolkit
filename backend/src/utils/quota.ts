import { prisma } from './prisma.js'
import type { Tier } from '@prisma/client'

export interface QuotaLimits {
  maxMb: number          // 存储软上限（字节）；-1 表示无限
  maxTurns: number       // 轮次硬上限；-1 表示无限
  apiRatePerMin: number  // RESTful API 每分钟请求数；0 表示无 API 权限
  canShare: boolean      // 是否可创建公开分享
  canCustomSlug: boolean // 是否可自定义短链
}

export const TIER_LIMITS: Record<Tier, QuotaLimits> = {
  FREE: {
    maxMb: 50 * 1024 * 1024,
    maxTurns: 200,
    apiRatePerMin: 0,
    canShare: false,
    canCustomSlug: false,
  },
  PRO: {
    maxMb: 100 * 1024 * 1024,
    maxTurns: 1000,
    apiRatePerMin: 0,
    canShare: true,
    canCustomSlug: false,
  },
  PLUS: {
    maxMb: 300 * 1024 * 1024,
    maxTurns: -1,
    apiRatePerMin: 60,
    canShare: true,
    canCustomSlug: true,
  },
  ULTIMATE: {
    maxMb: 300 * 1024 * 1024,
    maxTurns: -1,
    apiRatePerMin: 300,
    canShare: true,
    canCustomSlug: true,
  },
}

/** 等级权重，用于判断升级方向 */
export const TIER_RANK: Record<Tier, number> = {
  FREE: 0,
  PRO: 1,
  PLUS: 2,
  ULTIMATE: 3,
}

export interface UserUsage {
  usedBytes: number   // 已用字节（rawMapping + message content）
  usedTurns: number    // 已用轮次
}

/**
 * 统计用户已用存储与轮次。
 * rawMapping 是 Conversation 的 JSON 字段；content 是 Message 的 LongText。
 * 用 MySQL LENGTH() 求字节，避免全量回传到 Node。
 */
export async function getUserUsage(userId: number): Promise<UserUsage> {
  // 用 raw SQL 走聚合，性能远优于 findMany + JSON 处理
  const [convRow] = (await prisma.$queryRaw<Array<{ bytes: bigint | null; turns: bigint | null }>>`
    SELECT COALESCE(SUM(LENGTH(c.rawMapping)), 0) AS bytes,
           COALESCE(SUM(c.turnCount), 0) AS turns
    FROM Conversation c
    JOIN DeepseekConfig dc ON dc.id = c.configId
    WHERE dc.userId = ${userId}
  `)
  const [msgRow] = (await prisma.$queryRaw<Array<{ bytes: bigint | null }>>`
    SELECT COALESCE(SUM(LENGTH(m.content)), 0) AS bytes
    FROM Message m
    JOIN Conversation c ON c.id = m.conversationId
    JOIN DeepseekConfig dc ON dc.id = c.configId
    WHERE dc.userId = ${userId}
  `)
  const convBytes = Number(convRow?.bytes ?? 0n)
  const msgBytes = Number(msgRow?.bytes ?? 0n)
  const turns = Number(convRow?.turns ?? 0n)
  return {
    usedBytes: convBytes + msgBytes,
    usedTurns: turns,
  }
}

/** 校验上传是否符合配额（轮次硬限 + MB 软限）。返回 ok 或拒绝原因。 */
export async function checkUploadQuota(
  userId: number,
  tier: Tier,
  incomingTurns: number,
  incomingBytes: number,
): Promise<{ ok: true } | { ok: false; reason: string; upgradeHint: boolean }> {
  const limits = TIER_LIMITS[tier]
  const usage = await getUserUsage(userId)

  // 轮次硬限
  if (limits.maxTurns >= 0 && usage.usedTurns + incomingTurns > limits.maxTurns) {
    return {
      ok: false,
      reason: `已达轮次上限（${usage.usedTurns}/${limits.maxTurns}），本次需 +${incomingTurns} 轮`,
      upgradeHint: true,
    }
  }
  // MB 软限（超限拒绝，提示升级）
  if (limits.maxMb >= 0 && usage.usedBytes + incomingBytes > limits.maxMb) {
    const usedMb = (usage.usedBytes / 1024 / 1024).toFixed(1)
    const limitMb = (limits.maxMb / 1024 / 1024).toFixed(0)
    return {
      ok: false,
      reason: `已达存储上限（${usedMb}MB/${limitMb}MB），本次需 +${(incomingBytes / 1024 / 1024).toFixed(1)}MB`,
      upgradeHint: true,
    }
  }
  return { ok: true }
}
