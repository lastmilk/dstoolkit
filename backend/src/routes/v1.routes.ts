import { Router } from 'express'
import { prisma } from '../utils/prisma.js'
import { asyncHandler } from '../utils/async.js'
import { verifyApiToken, type AuthedRequest } from '../middleware/auth.js'
import { parsePaging, pageResponse } from '../utils/paging.js'
import { aggregateTurnsFromMessages } from '../services/turns.js'
import { resolveEffectiveTierWithAdBoost } from '../services/ads.js'
import * as gitRepo from '../services/gitRepo.js'

const router = Router()
router.use(verifyApiToken)

function publicConfig(c: any) {
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    conversationCount: c._count?.conversations ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

/** 仓库详情（含 Git 元信息，供 /v1/repos 使用） */
async function publicRepo(c: any, userId: number) {
  const disk = await gitRepo.repoDiskInfo(userId, c.id)
  return {
    id: c.id,
    name: c.name,
    description: c.description ?? null,
    defaultBranch: c.defaultBranch || 'main',
    lastCommitSha: c.lastCommitSha ?? null,
    lastCommitAt: c.lastCommitAt ?? null,
    commitCount: disk.commitCount ?? c.commitCount ?? 0,
    snapshotBytes: disk.snapshotBytes ?? null,
    conversationCount: c._count?.conversations ?? 0,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }
}

// GET /api/v1/me  当前令牌所属用户
router.get('/me', asyncHandler(async (req: AuthedRequest, res) => {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { id: true, username: true, role: true, cloudSyncEnabled: true, createdAt: true, tier: true, tierExpiresAt: true, isPermanentTier: true, adRewardTier: true, adRewardExpiresAt: true },
  })
  // tier 字段返回有效等级（含广告 boost，绝不降级付费等级）
  const effectiveTier = resolveEffectiveTierWithAdBoost(user)
  return res.json({
    user: {
      ...user,
      tier: effectiveTier,
      adRewardTier: user.adRewardTier,
      adRewardExpiresAt: user.adRewardExpiresAt,
    },
  })
}))

// GET /api/v1/configs  列出当前用户的聊天记录仓库
router.get('/configs', asyncHandler(async (req: AuthedRequest, res) => {
  const configs = await prisma.chatRepo.findMany({
    where: { userId: req.user!.id },
    include: { _count: { select: { conversations: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  return res.json({ configs: configs.map(publicConfig) })
}))

// GET /api/v1/configs/:id/conversations  分页返回会话元数据（lite，无 messages）
router.get('/configs/:id/conversations', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const config = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!config) return res.status(404).json({ error: '仓库不存在' })
  const { page, pageSize, paged } = parsePaging(req)
  const where = { configId: id }
  const [convs, total] = await Promise.all([
    prisma.conversation.findMany({
      where,
      select: {
        id: true,
        deepseekConvId: true,
        title: true,
        insertedAt: true,
        updatedAt: true,
        turnCount: true,
      },
      orderBy: { insertedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.conversation.count({ where }),
  ])
  if (paged) {
    return res.json(pageResponse(convs, { page, pageSize, total }))
  }
  return res.json(pageResponse(convs, { page, pageSize, total }))
}))

// GET /api/v1/configs/:id/conversations/:convId  单个会话完整 messages + 聚合 turns
router.get('/configs/:id/conversations/:convId', asyncHandler(async (req: AuthedRequest, res) => {
  const configId = Number(req.params.id)
  const deepseekConvId = req.params.convId
  const config = await prisma.chatRepo.findFirst({ where: { id: configId, userId: req.user!.id } })
  if (!config) return res.status(404).json({ error: '仓库不存在' })
  const conv = await prisma.conversation.findFirst({
    where: { configId, deepseekConvId },
    include: { messages: { orderBy: { insertedAt: 'asc' } } },
  })
  if (!conv) return res.status(404).json({ error: '会话不存在' })
  const turns = aggregateTurnsFromMessages(conv.messages)
  return res.json({ ...conv, turns })
}))

// GET /api/v1/search?q=&configId=&limit=  搜索消息内容（SQL LIKE，无 Meilisearch 依赖）
router.get('/search', asyncHandler(async (req: AuthedRequest, res) => {
  const q = String(req.query.q || '').trim()
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500)
  if (!q) return res.json({ results: [] })
  const configId = req.query.configId ? Number(req.query.configId) : undefined
  const convWhere: any = { repo: { userId: req.user!.id } }
  if (configId) convWhere.configId = configId

  const messages = await prisma.message.findMany({
    where: { content: { contains: q }, conversation: convWhere },
    include: { conversation: { select: { deepseekConvId: true, title: true, configId: true } } },
    orderBy: { insertedAt: 'desc' },
    take: limit,
  })

  const titleConvs = await prisma.conversation.findMany({
    where: { title: { contains: q }, ...convWhere },
    select: {
      deepseekConvId: true,
      title: true,
      configId: true,
      messages: { select: { nodeId: true, turnIndex: true, versionIndex: true, subTurnIndex: true }, take: 1 },
    },
    take: limit,
  })

  const results = [
    ...messages.map((m) => ({
      configId: m.conversation.configId,
      convId: m.conversation.deepseekConvId,
      nodeId: m.nodeId,
      title: m.conversation.title,
      content: m.content,
      role: m.role,
      turnIndex: m.turnIndex,
      versionIndex: m.versionIndex,
      subTurnIndex: m.subTurnIndex,
    })),
    ...titleConvs.map((c) => ({
      configId: c.configId,
      convId: c.deepseekConvId,
      nodeId: `title:${c.deepseekConvId}`,
      title: c.title,
      content: c.title,
      role: 'TITLE',
      turnIndex: c.messages[0]?.turnIndex ?? null,
      versionIndex: c.messages[0]?.versionIndex ?? null,
      subTurnIndex: c.messages[0]?.subTurnIndex ?? null,
    })),
  ]
  return res.json({ results: results.slice(0, limit) })
}))

// GET /api/v1/stats  当前用户的数据统计
router.get('/stats', asyncHandler(async (req: AuthedRequest, res) => {
  const userId = req.user!.id
  const [configs, conversations, messages, tokens] = await Promise.all([
    prisma.chatRepo.count({ where: { userId } }),
    prisma.conversation.count({ where: { repo: { userId } } }),
    prisma.message.count({ where: { conversation: { repo: { userId } } } }),
    prisma.apiToken.count({ where: { userId } }),
  ])
  return res.json({ configs, conversations, messages, apiTokens: tokens })
}))

// ═══════════ 仓库管理（Git 版本化，供移动端 / API Token 客户端使用） ═══════════

// GET /api/v1/repos  列出仓库（含 Git 元信息）
router.get('/repos', asyncHandler(async (req: AuthedRequest, res) => {
  const userId = req.user!.id
  const repos = await prisma.chatRepo.findMany({
    where: { userId },
    include: { _count: { select: { conversations: true } } },
    orderBy: { updatedAt: 'desc' },
  })
  const result = await Promise.all(repos.map((r) => publicRepo(r, userId)))
  return res.json({ repos: result, configs: result })
}))

// GET /api/v1/repos/:id/history  提交历史（首次访问自动回填）
router.get('/repos/:id/history', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })

  // 首次访问回填初始提交
  const disk = await gitRepo.repoDiskInfo(req.user!.id, id)
  if (disk.initialized && disk.commitCount === 0) {
    const { loadRepoConversationRows } = await import('../services/conversationStore.js')
    const { serializeSnapshot, snapshotConversationFromDb } = await import('../services/unifiedParser.js')
    const rows = await loadRepoConversationRows(id)
    const snapshotJson = serializeSnapshot(rows.map(snapshotConversationFromDb))
    const commit = await gitRepo.commitSnapshot(req.user!.id, id, snapshotJson, '初始提交（回填当前数据快照）')
    await prisma.chatRepo.update({
      where: { id },
      data: { lastCommitSha: commit.sha, lastCommitAt: new Date(), commitCount: { increment: 1 } },
    })
  }

  const commits = await gitRepo.listHistory(req.user!.id, id)
  const freshDisk = await gitRepo.repoDiskInfo(req.user!.id, id)
  return res.json({
    defaultBranch: repo.defaultBranch,
    commits: commits.map((c) => ({
      sha: c.sha,
      shortSha: c.sha.slice(0, 7),
      message: c.message.trim(),
      author: c.author,
      date: new Date(c.timestamp * 1000).toISOString(),
    })),
    commitCount: commits.length,
    snapshotBytes: freshDisk.snapshotBytes,
  })
}))

// POST /api/v1/repos/:id/rollback  回滚到指定提交
router.post('/repos/:id/rollback', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const sha = String(req.body?.sha || '').trim()
  if (!sha) return res.status(400).json({ error: '缺少 sha 参数' })
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })

  const { parseSnapshot, fromSnapshotConversation } = await import('../services/unifiedParser.js')
  const { upsertConversations, loadRepoConversationRows } = await import('../services/conversationStore.js')
  const { serializeSnapshot, snapshotConversationFromDb } = await import('../services/unifiedParser.js')

  const snapshotText = await gitRepo.readSnapshotAt(req.user!.id, id, sha)
  if (snapshotText == null) return res.status(404).json({ error: '提交不存在或快照不可读' })

  const { conversations: snapConvs } = parseSnapshot(snapshotText)
  const parsed = snapConvs.map((sc) => ({ conv: fromSnapshotConversation(sc), source: sc.source }))

  // 删除快照中不存在的会话
  const keepIds = parsed.map((p) => p.conv.deepseekConvId)
  await prisma.conversation.deleteMany({
    where: { configId: id, deepseekConvId: { notIn: keepIds } },
  })

  // 强制重建快照中的会话
  const stats = await upsertConversations(req.user!.id, id, parsed, { force: true })

  // 追加回滚提交
  const rows = await loadRepoConversationRows(id)
  const snapshotJson = serializeSnapshot(rows.map(snapshotConversationFromDb))
  const commit = await gitRepo.commitSnapshot(req.user!.id, id, snapshotJson, `回滚到 ${sha.slice(0, 7)}: 共 ${keepIds.length} 会话`)
  await prisma.chatRepo.update({
    where: { id },
    data: { lastCommitSha: commit.sha, lastCommitAt: new Date(), commitCount: { increment: 1 } },
  })

  return res.json({ ok: true, restored: keepIds.length, stats, commit })
}))

// GET /api/v1/repos/:id/commits/:sha/download  下载指定提交的快照
router.get('/repos/:id/commits/:sha/download', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })
  const text = await gitRepo.readSnapshotAt(req.user!.id, id, req.params.sha)
  if (text == null) return res.status(404).json({ error: '提交不存在或快照不可读' })
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Content-Disposition', `attachment; filename="conversations-${req.params.sha.slice(0, 7)}.json"`)
  return res.send(Buffer.from(text, 'utf8'))
}))

// DELETE /api/v1/repos/:id  删除仓库
router.delete('/repos/:id', asyncHandler(async (req: AuthedRequest, res) => {
  const id = Number(req.params.id)
  const repo = await prisma.chatRepo.findFirst({ where: { id, userId: req.user!.id } })
  if (!repo) return res.status(404).json({ error: '仓库不存在' })
  await prisma.chatRepo.delete({ where: { id } })
  gitRepo.deleteRepoDisk(req.user!.id, id)
  return res.json({ ok: true })
}))

export default router
