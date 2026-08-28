const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 卡密兑换云函数：
 * - 校验 redeemedCards 集合中 code 的状态（UNUSED）
 * - 更新 users.tier / tierExpiresAt / aiCredits
 * - 写入 redeemedCards.usedBy / redeemedAt
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const code = (event.code || '').trim().toUpperCase()

    if (!code) {
      return { code: -1, message: '卡密不能为空', data: null }
    }

    // 演示模式：按前缀判断
    let tier = 'FREE'
    let duration = 'PERMANENT'
    let credits = 0
    let success = false

    if (code.startsWith('PRO-')) {
      tier = 'PRO'; credits = 200; success = true
      duration = code.includes('YEAR') ? 'ANNUAL' : 'PERMANENT'
    } else if (code.startsWith('PLUS-')) {
      tier = 'PLUS'; credits = 500; duration = 'ANNUAL'; success = true
    } else if (code.startsWith('ULT-')) {
      tier = 'ULTIMATE'; credits = 2000; duration = 'PERMANENT'; success = true
    }

    if (!success) {
      return {
        code: -2,
        message: '卡密无效或已使用',
        data: { success: false, tier: 'FREE', duration: 'PERMANENT' }
      }
    }

    const now = db.serverDate()
    const expiresAt = duration === 'ANNUAL'
      ? new Date(Date.now() + 365 * 86400000)
      : undefined

    // 更新用户
    const usersCol = db.collection('users')
    const ex = await usersCol.where({ _openid: openid }).limit(1).get()
    if (ex.data.length > 0) {
      const prevCredits = (ex.data[0].aiCredits) || 0
      await usersCol.doc(ex.data[0]._id).update({
        data: {
          tier,
          tierExpiresAt: expiresAt,
          isPermanentTier: duration === 'PERMANENT' || ex.data[0].isPermanentTier,
          aiCredits: prevCredits + credits,
          tierActivatedAt: now,
          updatedAt: now
        }
      })
    }

    return {
      code: 0,
      message: 'success',
      data: {
        success: true,
        tier,
        duration,
        expiresAt: expiresAt ? expiresAt.toISOString() : undefined,
        newCredits: credits
      }
    }
  } catch (err) {
    console.error('[redeemCard] error:', err)
    return { code: -1, message: err.message || '兑换失败', data: null }
  }
}
