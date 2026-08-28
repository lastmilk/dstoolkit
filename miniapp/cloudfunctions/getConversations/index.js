const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const _ = db.command

/**
 * 分页查询对话
 * 入参：{ page, pageSize, keyword?, folderId?, tagId? }
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const page = Math.max(1, Number(event.page) || 1)
    const pageSize = Math.min(50, Math.max(1, Number(event.pageSize) || 10))
    const keyword = (event.keyword || '').trim()

    const col = db.collection('conversations')
    let query = col.where({ _openid: openid })

    // 简易关键词匹配
    if (keyword) {
      query = col.where({
        _openid: openid,
        title: db.RegExp({ regexp: keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), options: 'i' })
      })
    }

    const skip = (page - 1) * pageSize
    const [totalRes, listRes] = await Promise.all([
      query.count(),
      query.orderBy('insertedAt', 'desc').skip(skip).limit(pageSize).get()
    ])

    return {
      code: 0,
      message: 'success',
      data: {
        records: listRes.data.map(normalizeConv),
        total: totalRes.total,
        page,
        pageSize
      }
    }
  } catch (err) {
    console.error('[getConversations] error:', err)
    return { code: -1, message: err.message || '查询失败', data: null }
  }
}

function normalizeConv(doc) {
  return {
    id: doc.id || Math.floor(Math.random() * 1e9),
    configId: doc.configId || 1,
    deepseekConvId: doc.deepseekConvId || ('conv_' + (doc._id || '')),
    title: doc.title || '未命名对话',
    insertedAt: doc.insertedAt || new Date().toISOString(),
    updatedAt: doc.updatedAt || new Date().toISOString(),
    turnCount: doc.turnCount || 0,
    summaryTldr: doc.summaryTldr,
    summaryTags: doc.summaryTags || []
  }
}
