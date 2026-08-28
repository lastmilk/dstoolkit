import { Router } from 'express'
import { asyncHandler } from '../utils/async.js'
import { verifyApiToken, type AuthedRequest } from '../middleware/auth.js'
import { getAdStatus, getAdHistory } from '../services/ads.js'

const router = Router()
router.use(verifyApiToken)

// GET /api/ads/status  当前用户当日广告进度 + 连击 + boost 等级
router.get('/status', asyncHandler(async (req: AuthedRequest, res) => {
  const status = await getAdStatus(req.user!.id)
  res.json(status)
}))

// GET /api/ads/history?days=30  近 N 日观看记录（连击日历）
router.get('/history', asyncHandler(async (req: AuthedRequest, res) => {
  const days = Number(req.query.days) || 30
  const logs = await getAdHistory(req.user!.id, days)
  res.json({ logs })
}))

export default router
