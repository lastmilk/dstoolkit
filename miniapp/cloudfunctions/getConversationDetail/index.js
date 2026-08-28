const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

/**
 * 获取对话详情：对话元数据 + 消息列表 + AI 摘要 + 知识卡片
 */
exports.main = async (event, context) => {
  try {
    const wxContext = cloud.getWXContext()
    const openid = wxContext.OPENID
    const convId = event.conversationId

    // 占位：真实环境应从 db 中查询，此处直接返回结构
    return {
      code: 0,
      message: 'success',
      data: {
        conversation: {
          id: convId || 1,
          configId: 1,
          deepseekConvId: 'conv_' + convId,
          title: '对话详情',
          insertedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
          updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
          turnCount: 24
        },
        messages: [],
        summary: null,
        knowledgeCards: []
      }
    }
  } catch (err) {
    console.error('[getConversationDetail] error:', err)
    return { code: -1, message: err.message || '查询失败', data: null }
  }
}
