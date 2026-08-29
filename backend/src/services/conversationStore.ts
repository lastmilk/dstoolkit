import { prisma } from '../utils/prisma.js'
import type { ParsedConversation } from './deepseekParser.js'
import type { ConvSource } from './unifiedParser.js'
import { indexDocuments, deleteDocuments, type MeiliDoc } from './meilisearch.js'

/**
 * 会话入库服务：从上传流程（repo.routes）中抽取，供导入/回滚共用。
 * configId 语义 = 聊天记录仓库 id（ChatRepo，底层表 DeepseekConfig）。
 */

// 由单个 ParsedConversation 构建该会话的 MeiliDoc[]：
//  - 每条 message 一个文档，id = `msg:${convId}:${nodeId}`
//  - 额外一条 title 文档，id = `title:${convId}`，role='TITLE'，便于按会话标题检索
function buildMeiliDocs(userId: number, configId: number, conv: ParsedConversation): MeiliDoc[] {
  const docs: MeiliDoc[] = []
  const convId = conv.deepseekConvId
  docs.push({
    id: `title:${convId}`,
    userId,
    configId,
    convId,
    nodeId: `title:${convId}`,
    title: conv.title,
    content: conv.title,
    role: 'TITLE',
    model: null,
    turnIndex: null,
    versionIndex: null,
    subTurnIndex: null,
    insertedAt: conv.insertedAt.toISOString(),
  })
  for (const msg of conv.messages) {
    docs.push({
      id: `msg:${convId}:${msg.nodeId}`,
      userId,
      configId,
      convId,
      nodeId: msg.nodeId,
      title: conv.title,
      content: msg.content,
      role: msg.role,
      model: msg.model,
      turnIndex: msg.turnIndex ?? null,
      versionIndex: msg.versionIndex ?? null,
      subTurnIndex: msg.subTurnIndex ?? null,
      insertedAt: msg.insertedAt.toISOString(),
    })
  }
  return docs
}

export interface UpsertStats {
  added: number
  updated: number
  unchanged: number
}

/**
 * 增量 upsert 一批会话到指定仓库：
 *  - 新会话 → create
 *  - 已存在且 updatedAt 更新（或 force=true）→ 重建 messages（含 source 标记）
 *  - 已存在且无变化 → 跳过
 *  force 用于回滚场景：DB 状态必须与快照一致，无视时间戳。
 */
export async function upsertConversations(
  userId: number,
  configId: number,
  convs: Array<{ conv: ParsedConversation; source: ConvSource }>,
  opts?: { force?: boolean },
): Promise<UpsertStats> {
  const force = !!opts?.force
  const stats: UpsertStats = { added: 0, updated: 0, unchanged: 0 }
  const allNewDocs: MeiliDoc[] = []
  // 批量查询现有会话（消除 N+1 findUnique）
  const existingConvs = await prisma.conversation.findMany({
    where: { configId, deepseekConvId: { in: convs.map((c) => c.conv.deepseekConvId) } },
    select: { id: true, deepseekConvId: true, updatedAt: true },
  })
  const existingMap = new Map(existingConvs.map((c) => [c.deepseekConvId, c]))

  for (const { conv: c, source } of convs) {
    const existing = existingMap.get(c.deepseekConvId)
    const messageData = c.messages.map((m) => ({
      nodeId: m.nodeId,
      parentId: m.parentId,
      role: m.role,
      model: m.model,
      content: m.content,
      insertedAt: m.insertedAt,
      turnIndex: m.turnIndex ?? null,
      versionIndex: m.versionIndex ?? null,
      subTurnIndex: m.subTurnIndex ?? null,
    }))
    if (existing) {
      // 增量：仅当 updatedAt 更新时刷新 mapping + 重建 messages（force 时无条件重建）
      if (force || c.updatedAt > existing.updatedAt) {
        // 先抓旧 nodeId，用于清理 Meilisearch 中该会话的旧 msg 文档
        const oldMsgs = await prisma.message.findMany({
          where: { conversationId: existing.id },
          select: { nodeId: true },
        })
        const oldDocIds = oldMsgs.map((m) => `msg:${c.deepseekConvId}:${m.nodeId}`)
        await prisma.conversation.update({
          where: { id: existing.id },
          data: {
            title: c.title,
            insertedAt: c.insertedAt,
            updatedAt: c.updatedAt,
            turnCount: c.turns.length,
            rawMapping: c.mapping as any,
            source,
            messages: { deleteMany: {}, create: messageData },
          },
        })
        // 同步 Meilisearch：删旧 msg 文档（title 文档由 addDocuments 覆盖即可）
        try {
          await deleteDocuments(userId, oldDocIds)
        } catch (e) {
          console.warn('[meilisearch] deleteDocuments during upsert failed', e)
        }
        allNewDocs.push(...buildMeiliDocs(userId, configId, c))
        stats.updated++
      } else {
        stats.unchanged++
      }
    } else {
      await prisma.conversation.create({
        data: {
          configId,
          deepseekConvId: c.deepseekConvId,
          title: c.title,
          insertedAt: c.insertedAt,
          updatedAt: c.updatedAt,
          turnCount: c.turns.length,
          rawMapping: c.mapping as any,
          source,
          messages: { create: messageData },
        },
      })
      allNewDocs.push(...buildMeiliDocs(userId, configId, c))
      stats.added++
    }
  }
  if (allNewDocs.length > 0) {
    // 非阻塞：后台异步索引，不等待 Meilisearch 返回即可响应上传完成
    setImmediate(() => {
      indexDocuments(userId, allNewDocs).catch((e) =>
        console.warn('[meilisearch] background indexDocuments failed', e),
      )
    })
  }
  return stats
}

const UPLOAD_CHUNK_SIZE = 50

export interface ImportResult extends UpsertStats {
  total: number
}

/**
 * 流式导入 zip 数据包到仓库：流式解析（双格式）→ 分块 upsert。
 * 返回导入统计（不回传全部会话，前端按需分页加载）。
 */
export async function importZipToRepo(
  userId: number,
  configId: number,
  zipBuffer: Buffer,
  onProgress?: (loaded: number) => void,
): Promise<ImportResult> {
  const { parseZipUnified } = await import('./unifiedParser.js')
  const stats: UpsertStats = { added: 0, updated: 0, unchanged: 0 }
  let total = 0
  let batch: Array<{ conv: ParsedConversation; source: ConvSource }> = []
  const flush = async () => {
    if (batch.length === 0) return
    const chunk = batch
    batch = []
    const r = await upsertConversations(userId, configId, chunk)
    stats.added += r.added
    stats.updated += r.updated
    stats.unchanged += r.unchanged
  }
  await parseZipUnified(
    zipBuffer,
    async (conv, source) => {
      batch.push({ conv, source })
      total++
      if (batch.length >= UPLOAD_CHUNK_SIZE) await flush()
    },
    onProgress,
  )
  await flush()
  return { ...stats, total }
}

/** 从 DB 拉取仓库全部会话行（用于构建规范快照） */
export async function loadRepoConversationRows(configId: number) {
  return prisma.conversation.findMany({
    where: { configId },
    select: {
      deepseekConvId: true,
      title: true,
      insertedAt: true,
      updatedAt: true,
      turnCount: true,
      rawMapping: true,
      source: true,
    },
    orderBy: { insertedAt: 'asc' },
  })
}
