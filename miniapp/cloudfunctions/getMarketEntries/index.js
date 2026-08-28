const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 获取应用市场条目（所有人可读）
 */
exports.main = async (event, context) => {
  try {
    const category = event.category
    const query = category && category !== 'all'
      ? { category }
      : {}

    const col = db.collection('market_entries')
    const res = await col
      .where(query)
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get()

    const entries = res.data.map(d => ({
      id: d._id ? String(d._id).length : d.id || Math.floor(Math.random() * 100),
      name: d.name,
      url: d.url,
      description: d.description,
      category: d.category || 'official',
      createdAt: d.createdAt
    }))

    return { code: 0, message: 'success', data: entries }
  } catch (err) {
    console.error('[getMarketEntries] error:', err)
    return { code: -1, message: err.message || '查询失败', data: [] }
  }
}
