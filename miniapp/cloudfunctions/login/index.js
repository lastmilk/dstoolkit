const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 登录云函数：
 * 1. 获取微信用户 openid（免鉴权）
 * 2. 如传入 username/password，则尝试创建/关联本地账号
 * 返回 { openid, user }
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const username = (event.username || '').trim() || 'wx_' + openid.slice(-6)

    // 查找或创建 users 文档
    const usersCol = db.collection('users')
    const exist = await usersCol.where({ _openid: openid }).limit(1).get()

    let user
    if (exist.data.length > 0) {
      user = exist.data[0]
    } else {
      const doc = {
        _openid: openid,
        username,
        tier: 'FREE',
        role: 'USER',
        aiCredits: 0,
        isPermanentTier: false,
        cloudSyncEnabled: true,
        referralCode: 'D' + Math.random().toString(36).slice(2, 8).toUpperCase(),
        createdAt: db.serverDate(),
        updatedAt: db.serverDate()
      }
      await usersCol.add({ data: doc })
      user = doc
    }

    return {
      code: 0,
      message: 'success',
      data: {
        openid,
        token: 'wx_' + openid + '_' + Date.now(),
        user: {
          ...user,
          id: user._id ? user._id.length : 1,
          avatarUrl: undefined
        }
      }
    }
  } catch (err) {
    console.error('[login] error:', err)
    return { code: -1, message: err.message || '登录失败', data: null }
  }
}
