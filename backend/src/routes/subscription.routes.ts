import { Router } from 'express'
import { z } from 'zod'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/async.js'
import { verifyJwt, type AuthedRequest } from '../middleware/auth.js'
import { activateTierWithCard, getTierStatus } from '../services/subscription.js'
import { validateKufakaCard, parseKufakaTier } from '../services/kufaka.js'
import { TIER_LIMITS } from '../utils/quota.js'
import type { Tier } from '@prisma/client'

const router = Router()
router.use(verifyJwt)

// GET /api/subscription/status  当前会员状态 + 用量 + 配额
router.get('/status', asyncHandler(async (req: AuthedRequest, res) => {
  const status = await getTierStatus(req.user!.id)
  res.json({
    tier: status.tier,
    effectiveTier: status.effectiveTier,
    isPermanent: status.isPermanent,
    activatedAt: status.activatedAt,
    expiresAt: status.expiresAt,
    expired: status.expired,
    usage: {
      usedMb: Number((status.usage.usedBytes / 1024 / 1024).toFixed(2)),
      usedTurns: status.usage.usedTurns,
    },
    limits: {
      maxMb: status.limits.maxMb < 0 ? null : Number((status.limits.maxMb / 1024 / 1024).toFixed(0)),
      maxTurns: status.limits.maxTurns < 0 ? null : status.limits.maxTurns,
      apiRatePerMin: status.limits.apiRatePerMin,
      canShare: status.limits.canShare,
      canCustomSlug: status.limits.canCustomSlug,
    },
  })
}))

// GET /api/subscription/plans  公开定价方案（无需登录亦可，但此处复用 auth 简化）
router.get('/plans', asyncHandler(async (_req, res) => {
  res.json({ plans: TIER_PLANS_PUBLIC })
}))

const redeemSchema = z.object({ code: z.string().min(8).max(64) })

// POST /api/subscription/redeem  兑换卡密（混合模式：本地优先 + kufaka 校验）
router.post('/redeem', asyncHandler(async (req: AuthedRequest, res) => {
  const parsed = redeemSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ error: '卡密格式不正确' })
  const code = parsed.data.code.trim()

  // 1) 先查本地卡密池
  let card = await prisma.redeemCard.findUnique({ where: { code } })
  if (card) {
    if (card.status === 'USED') return res.status(409).json({ error: '该卡密已被使用' })
    if (card.status === 'REVOKED') return res.status(403).json({ error: '该卡密已作废' })
    if (card.expiresAt && card.expiresAt < new Date()) {
      return res.status(403).json({ error: '该卡密已过期' })
    }
  } else {
    // 2) 本地未找到，尝试 kufaka 校验
    const kf = await validateKufakaCard(code)
    if (kf && kf.valid) {
      const tier = parseKufakaTier(kf.tier as string | undefined)
      const duration = (kf.duration as 'PERMANENT' | 'ANNUAL' | undefined) ?? 'PERMANENT'
      if (!tier) return res.status(400).json({ error: '卡密等级信息异常' })
      // kufaka 校验通过：本地落库一张 USED 卡（source=KUFAKA）
      card = await prisma.redeemCard.create({
        data: {
          code,
          tier,
          duration,
          source: 'KUFAKA',
          status: 'USED',
          usedById: req.user!.id,
          redeemedAt: new Date(),
        },
      })
    } else if (kf && !kf.valid) {
      return res.status(403).json({ error: 'kufaka 校验未通过：卡密无效或已作废' })
    } else {
      return res.status(404).json({ error: '卡密无效' })
    }
  }

  const result = await activateTierWithCard(req.user!.id, card!)
  return res.json({
    ok: true,
    tier: result.tier,
    isPermanent: result.isPermanent,
    expiresAt: result.expiresAt,
    message: `兑换成功，当前等级：${tierLabel(result.tier)}${result.isPermanent ? '（永久）' : ''}`,
  })
}))

function tierLabel(t: Tier): string {
  return { FREE: '免费版', PRO: '高级版 Pro', PLUS: '顶级版 Plus', ULTIMATE: '超强版 Ultimate' }[t]
}

export const TIER_PLANS_PUBLIC = [
  {
    tier: 'PRO' as const,
    name: '高级版 Pro',
    price: 9.9,
    priceNote: '永久买断',
    duration: 'PERMANENT' as const,
    features: [
      'Free 的所有功能',
      '对话云存储 100MB + 1000 轮',
      '自定义分享（网页完整版 + 5 种主题 + 密码）',
      '更丰富的统计图表',
    ],
    buyUrl: 'https://www.kufaka.com/shop/DLJTWXUW',
  },
  {
    tier: 'PLUS' as const,
    name: '顶级版 Plus',
    price: 29,
    priceNote: '年付',
    duration: 'ANNUAL' as const,
    features: [
      'Free 的所有功能',
      '对话云存储 300MB + 无限轮',
      '自定义分享（完整版 + 5 主题 + 密码 + 个人专属短链）',
      '内测功能优先体验',
      'RESTful API 访问',
      '更丰富的统计图表',
    ],
    buyUrl: 'https://www.kufaka.com/shop/DLJTWXUW',
    permanentPrice: 99,
  },
  {
    tier: 'ULTIMATE' as const,
    name: '超强版 Ultimate',
    price: 99,
    priceNote: '年付',
    duration: 'ANNUAL' as const,
    features: [
      'Free 的所有功能',
      '对话云存储 300MB + 无限轮',
      '自定义分享（完整版 + 5 主题 + 密码 + 个人专属短链）',
      '内测功能优先体验',
      'RESTful API 访问（更高限流 300/min）',
      '网站作者专属好友位',
      '开源版 PR 提交权限',
      '更丰富的统计图表',
    ],
    buyUrl: 'https://www.kufaka.com/shop/DLJTWXUW',
    permanentPrice: 299,
  },
]

export default router
