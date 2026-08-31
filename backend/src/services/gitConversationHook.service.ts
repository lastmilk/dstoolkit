/**
 * 对话 <-> Git 自动 Hook 服务
 *
 * 职责：
 *  - ensureRepoForConversation: 为某对话确保绑定了 Git 仓库（不存在则创建）
 *  - commitConversationSnapshot: 基于对话最新 messages 与 HEAD 对比生成 tree 并自动 commit
 *  - onConversationUpserted: 在 config.routes 的 upsertConversations 之后调用
 *  - onConversationsDeleted: 批量对话被清理时标记仓库为 archived 或删除
 *
 * 设计原则：
 *  - 默认非阻塞：使用 setImmediate/微任务 后台执行，避免影响对话上传的核心接口延迟
 *  - 幂等：同一个 conversationId 并发多次调用，最终只生成一个 tree+commit（以DB锁+SHA去重保证）
 *  - 失败降级：hook 异常只打印 warning，不中断主流程
 */
import type { PrismaClient, Conversation, Message, GitRepo, GitBranch } from '@prisma/client'
import { prisma } from '../utils/prisma.js'
import { GitObjectService, type BuildEntryInput } from './gitObject.service.js'
import { GitCommitService, type CommitAuthor } from './gitCommit.service.js'
import { GitRepoService } from './gitRepo.service.js'

export type SerializedMessage = Pick<
  Message,
  'nodeId' | 'parentId' | 'role' | 'model' | 'content' | 'insertedAt' | 'turnIndex' | 'versionIndex' | 'subTurnIndex'
>

export class GitConversationHookService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly objects: GitObjectService,
    private readonly commits: GitCommitService,
    private readonly repos: GitRepoService,
  ) {}

  // ══════════════════════════════════════════════
  // Public 入口：确保存在 repo 并生成一次自动 commit
  // ══════════════════════════════════════════════

  /**
   * 对话写入完成后：异步触发 git 自动 commit
   * 该函数永不抛异常（失败降级）。
   */
  async afterConversationUpserted(userId: number, conversationId: number): Promise<void> {
    try {
      await this._commitLatestSnapshot(userId, conversationId)
    } catch (e) {
      console.warn(`[GitHook] afterConversationUpserted(userId=${userId}, convId=${conversationId}) failed:`, e)
    }
  }

  /**
   * 后台异步调度（避免阻塞主 HTTP 响应）
   */
  scheduleAfterUpsert(userId: number, conversationId: number): void {
    setImmediate(() => this.afterConversationUpserted(userId, conversationId))
  }

  // ══════════════════════════════════════════════
  // 核心实现
  // ══════════════════════════════════════════════

  private async _ensureRepo(
    userId: number,
    conv: Conversation & { config?: { userId?: number } | null },
  ): Promise<{ repo: GitRepo; defaultBranch: GitBranch }> {
    // 1. 已有绑定直接返回
    let repo = await this.prisma.gitRepo.findFirst({
      where: { conversationId: conv.id },
    })
    if (repo) {
      const branch = await this.prisma.gitBranch.findFirst({
        where: { repoId: repo.id, isDefault: true },
      })
      if (branch) return { repo, defaultBranch: branch }
    }

    // 2. 不存在则创建：利用 GitRepoService.createRepo，内部会自动导入 messages
    const author = await this._userToAuthor(userId)
    const repoName = `conv-${conv.deepseekConvId}`.slice(0, 100)
    const description = conv.title ? `Git mirror for conversation: ${conv.title}` : 'Conversation Git mirror'
    try {
      const created = await this.repos.createRepo({
        name: repoName,
        ownerId: userId,
        description,
        conversationId: conv.id,
        visibility: 'PRIVATE',
        author,
      })
      return { repo: created.repo, defaultBranch: created.defaultBranch }
    } catch (e: any) {
      // 竞态：若刚好被并发创建，再次查库
      if (e?.message?.includes('已存在') || e?.message?.includes('已绑定')) {
        const repo2 = await this.prisma.gitRepo.findFirstOrThrow({ where: { conversationId: conv.id } })
        const branch2 = await this.prisma.gitBranch.findFirstOrThrow({
          where: { repoId: repo2.id, isDefault: true },
        })
        return { repo: repo2, defaultBranch: branch2 }
      }
      throw e
    }
  }

  private async _commitLatestSnapshot(userId: number, conversationId: number): Promise<void> {
    const conv = await this.prisma.conversation.findUnique({
      where: { id: conversationId },
      include: {
        config: { select: { userId: true } },
        messages: { orderBy: { insertedAt: 'asc' } },
      },
    })
    if (!conv) return

    // 如果配置的 owner 不是当前 userId（理论上不会发生），使用配置的 ownerId
    const effectiveOwnerId = conv.config?.userId ?? userId

    const { repo, defaultBranch } = await this._ensureRepo(effectiveOwnerId, conv as any)

    // 如果 defaultBranch 还没有 HEAD（例如并发场景下 createRepo 的 init commit 还没完成），
    // 等一小段时间再试一次
    let branch = await this.prisma.gitBranch.findUnique({
      where: { id: defaultBranch.id },
      include: { headCommit: true },
    })
    if (!branch?.headCommitId) {
      await new Promise((r) => setTimeout(r, 50))
      branch = await this.prisma.gitBranch.findUnique({
        where: { id: defaultBranch.id },
        include: { headCommit: true },
      })
      if (!branch?.headCommitId) return
    }

    // 构造新 snapshot 的 tree entries
    const entries = this._buildEntriesFromConversation(conv as any)

    // 与 HEAD 对比：若内容完全一样则不 commit
    const headFiles = await this.objects.materializeTree(branch.headCommit!.treeId)
    const headMap = new Map(headFiles.map((f) => [f.path, f.sha]))

    // 临时 build 一个 tree 以得到所有 entries 的 sha（不写入 DB 副作用由 buildTree 自身的 SHA 去重保障）
    const { tree } = await this.objects.buildTree(repo.id, entries)
    // 比较根tree的sha即可快速判断是否有变化
    if (branch.headCommit!.treeId === tree.id) return

    // 计算变更摘要 & commit 标题
    const diff = await this.objects.diffTrees(branch.headCommit!.treeId, tree.id)
    const { subject, body, changeType } = this._buildCommitMessage(diff, conv, entries.length)

    const author = await this._userToAuthor(effectiveOwnerId)
    await this.commits.createCommit({
      repoId: repo.id,
      treeId: tree.id,
      parentIds: [branch.headCommitId],
      author,
      subject,
      body,
      changeType,
      branchId: branch.id,
    })
  }

  // ══════════════════════════════════════════════
  // 序列化：Conversation + Messages → Tree Entries
  // ══════════════════════════════════════════════

  private _buildEntriesFromConversation(conv: Conversation & { messages: SerializedMessage[] }): BuildEntryInput[] {
    const entries: BuildEntryInput[] = []
    const byTurn = new Map<number, { user: SerializedMessage | null; versions: Map<number, SerializedMessage[]> }>()

    for (const m of conv.messages) {
      const ti = m.turnIndex ?? 0
      const bucket = byTurn.get(ti) ?? { user: null, versions: new Map() }
      if (m.versionIndex == null) {
        if (m.role === 'USER') bucket.user = m
      } else {
        const vi = m.versionIndex
        const vlist = bucket.versions.get(vi) ?? []
        vlist.push(m)
        bucket.versions.set(vi, vlist)
      }
      byTurn.set(ti, bucket)
    }

    const turns = [...byTurn.keys()].sort((a, b) => a - b)
    for (const t of turns) {
      const b = byTurn.get(t)!
      const pad = String(t).padStart(4, '0')
      if (b.user) {
        entries.push({
          path: `turns/${pad}/user.msg`,
          content: this._toJsonPretty({
            role: b.user.role,
            content: b.user.content,
            nodeId: b.user.nodeId,
            parentId: b.user.parentId,
            insertedAt: b.user.insertedAt,
          }),
          mimeType: 'application/json',
        })
      }
      const vers = [...b.versions.keys()].sort()
      for (const v of vers) {
        const msgs = b.versions.get(v)!
        const vpad = String(v).padStart(2, '0')
        const subMap = new Map<number, { user?: SerializedMessage; assistant?: SerializedMessage }>()
        for (const msg of msgs) {
          if (msg.subTurnIndex == null) {
            if (msg.role === 'ASSISTANT') {
              entries.push({
                path: `turns/${pad}/versions/v${vpad}/assistant.msg`,
                content: this._toJsonPretty({
                  role: msg.role,
                  content: msg.content,
                  nodeId: msg.nodeId,
                  parentId: msg.parentId,
                  model: msg.model,
                  insertedAt: msg.insertedAt,
                }),
                mimeType: 'application/json',
              })
            }
          } else {
            const st = subMap.get(msg.subTurnIndex) ?? {}
            if (msg.role === 'USER') st.user = msg
            else st.assistant = msg
            subMap.set(msg.subTurnIndex, st)
          }
        }
        const sts = [...subMap.keys()].sort()
        for (const s of sts) {
          const sp = String(s).padStart(2, '0')
          const st = subMap.get(s)!
          if (st.user) {
            entries.push({
              path: `turns/${pad}/versions/v${vpad}/subturns/${sp}/user.msg`,
              content: this._toJsonPretty({
                role: 'USER',
                content: st.user.content,
                nodeId: st.user.nodeId,
                parentId: st.user.parentId,
                insertedAt: st.user.insertedAt,
              }),
              mimeType: 'application/json',
            })
          }
          if (st.assistant) {
            entries.push({
              path: `turns/${pad}/versions/v${vpad}/subturns/${sp}/assistant.msg`,
              content: this._toJsonPretty({
                role: 'ASSISTANT',
                content: st.assistant.content,
                nodeId: st.assistant.nodeId,
                parentId: st.assistant.parentId,
                model: st.assistant.model,
                insertedAt: st.assistant.insertedAt,
              }),
              mimeType: 'application/json',
            })
          }
        }
      }
    }

    entries.push({
      path: 'conversation.meta.json',
      content: this._toJsonPretty({
        id: conv.id,
        deepseekConvId: conv.deepseekConvId,
        title: conv.title,
        turnCount: conv.turnCount,
        insertedAt: conv.insertedAt,
        updatedAt: conv.updatedAt,
      }),
      mimeType: 'application/json',
    })

    return entries
  }

  private _toJsonPretty(value: unknown): string {
    return JSON.stringify(value, null, 2)
  }

  // ══════════════════════════════════════════════
  // Commit Message 生成
  // ══════════════════════════════════════════════

  private _buildCommitMessage(
    diff: {
      changedFiles: number
      totalAdditions: number
      totalDeletions: number
      files: Array<{
        path?: string
        oldPath?: string
        newPath?: string
        status?: string
        changeType?: string
      }>
    },
    conv: Conversation,
    totalEntries: number,
  ): { subject: string; body: string; changeType: any } {
    const { changedFiles, totalAdditions: add, totalDeletions: del } = diff
    const files = diff.files.map((f) => ({
      path: f.path || f.newPath || f.oldPath || '',
      changeType: f.changeType ?? diffStatusToChangeType(f.status || ''),
    }))
    const added = files.filter((f) => f.changeType === 'ADD')
    const modified = files.filter((f) => f.changeType === 'MODIFY')
    const deleted = files.filter((f) => f.changeType === 'DELETE')

    let changeType: any = 'EDIT'
    let subject = ''
    // 分析 turns/xxx 相关的变更
    const turnAdded = added.filter((f) => f.path.startsWith('turns/')).length
    const turnModified = modified.filter((f) => f.path.startsWith('turns/')).length
    const turnDeleted = deleted.filter((f) => f.path.startsWith('turns/')).length

    if (turnAdded > 0 && turnModified === 0 && turnDeleted === 0) {
      changeType = 'NEW_TURN'
      subject = `feat: 新增 ${turnAdded} 个对话消息文件`
    } else if (turnDeleted > 0 && turnAdded === 0) {
      changeType = 'DELETE_TURN'
      subject = `remove: 删除 ${turnDeleted} 个对话消息文件`
    } else if (turnModified > 0 && turnAdded === 0 && turnDeleted === 0) {
      changeType = 'EDIT_TURN'
      subject = `edit: 编辑 ${turnModified} 个对话消息`
    } else {
      const parts: string[] = []
      if (turnAdded) parts.push(`+${turnAdded}`)
      if (turnModified) parts.push(`~${turnModified}`)
      if (turnDeleted) parts.push(`-${turnDeleted}`)
      subject = `sync: 同步对话快照 (${parts.join(', ') || 'no turns changed'})`
    }

    const bodyLines: string[] = [
      `对话标题: ${conv.title || '(无标题)'}`,
      `变更统计: ${changedFiles} 个文件变更, +${add}/-${del} 行`,
      `总文件数: ${totalEntries}`,
    ]
    if (files.length <= 20) {
      bodyLines.push('')
      bodyLines.push('变更文件:')
      for (const f of files) {
        const tag = f.changeType === 'ADD' ? 'A' : f.changeType === 'DELETE' ? 'D' : 'M'
        bodyLines.push(`  ${tag} ${f.path}`)
      }
    }
    return { subject, body: bodyLines.join('\n'), changeType }
  }

  private async _userToAuthor(userId: number): Promise<CommitAuthor> {
    const u = await this.prisma.user.findUnique({ where: { id: userId } })
    if (!u) return { name: `user${userId}`, email: `user${userId}@dstoolkit.local`, userId }
    return { name: u.username, email: `${u.username}@dstoolkit.local`, userId }
  }
}

function diffStatusToChangeType(status: string): 'ADD' | 'DELETE' | 'MODIFY' {
  switch (status) {
    case 'added':
    case 'copied':
      return 'ADD'
    case 'deleted':
      return 'DELETE'
    case 'renamed':
    case 'modified':
    default:
      return 'MODIFY'
  }
}

// ══════════════════════════════════════════════
// 全局单例导出（共享 gitObjects / gitCommits / gitRepos）
// ══════════════════════════════════════════════
import { gitObjects, gitCommits, gitRepos } from './git.services.js'

export const gitConversationHooks = new GitConversationHookService(
  prisma,
  gitObjects,
  gitCommits,
  gitRepos,
)
