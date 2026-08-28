const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID

    const res = await db.collection('configs')
      .where({ _openid: openid })
      .orderBy('createdAt', 'desc')
      .get()

    const configs = res.data.map(d => ({
      id: d._id ? String(d._id).length : 1,
      name: d.name || '未命名配置',
      deepseekUserId: d.deepseekUserId || '',
      deepseekEmail: d.deepseekEmail,
      deepseekMobile: d.deepseekMobile,
      createdAt: d.createdAt,
      updatedAt: d.updatedAt,
      conversationCount: d.conversationCount || 0
    }))

    return { code: 0, message: 'success', data: configs }
  } catch (err) {
    console.error('[getConfigs] error:', err)
    return { code: -1, message: err.message || '查询失败', data: [] }
  }
}
