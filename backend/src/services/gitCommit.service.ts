/**
 * Git Commit 服务
 *
 * 职责：
 *  - createCommit: 创建commit（含父关联、author/committer信息、changeType等语义标签）
 *  - getCommit: 读commit详情（含parents、tree、统计）
 *  - getCommitHistory: 从某分支/某commit遍历历史（log --graph）
 *  - cherryPick / revert: 应用提交
 */
import type { PrismaClient, User, GitCommit, GitTree } from '@prisma/client'
import { computeGitHash } from '../utils/gitHash.js'
import { GitObjectService } from './gitObject.service.js'

export interface CommitAuthor {
  name: string
  email: string
  userId?: number
}

export interface CreateCommitInput {
  repoId: number
  treeId: number
  parentIds?: number[]       // 父提交id数组；空数组 = 初始提交
  author: CommitAuthor
  committer?: CommitAuthor   // 不传默认=author
  subject: string            // 第一行标题
  body?: string              // 正文
  authoredAt?: Date
  committedAt?: Date
  changeType?: 'INIT' | 'NEW_TURN' | 'EDIT_TURN' | 'DELETE_TURN' | 'MERGE' | 'REBASE' | 'REVERT' | 'CHERRY_PICK' | 'TAG' | 'EDIT'
  turnIndex?: number
  nodeId?: string
  branchName?: string        // 提交后更新哪个分支的HEAD（可选）
  branchId?: number          // 与branchName二选一
}

export class GitCommitService {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly objects: GitObjectService,
  ) {}

  // ══════════════════════════════════════════════
  // 创建 Commit
  // ══════════════════════════════════════════════

  async createCommit(input: CreateCommitInput): Promise<{ commit: GitCommit; hash: string }> {
    const { repoId, treeId, parentIds = [] } = input
    const now = new Date()
    const authoredAt = input.authoredAt ?? now
    const committedAt = input.committedAt ?? now
    const author = input.author
    const committer = input.committer ?? author

    // 加载 tree 与 父提交 sha 来构建 commit canonical 内容
    const tree = await this.prisma.gitTree.findUnique({ where: { id: treeId } })
    if (!tree) throw new Error(`Tree id=${treeId} 不存在`)

    const parentCommits: GitCommit[] = []
    for (const pid of parentIds) {
      const pc = await this.prisma.gitCommit.findUnique({ where: { id: pid } })
      if (!pc) throw new Error(`父提交 id=${pid} 不存在`)
      parentCommits.push(pc)
    }

    // 计算变更统计（与第一个父的diff，或空init + 所有文件 = 新增）
    let additions = 0
    let deletions = 0
    let changedFiles = 0
    if (parentCommits.length > 0) {
      const diff = await this.objects.diffTrees(parentCommits[0].treeId, treeId)
      additions = diff.totalAdditions
      deletions = diff.totalDeletions
      changedFiles = diff.changedFiles
    } else {
      // INIT 提交：所有文件都算新增（按行数估算）
      const files = await this.objects.materializeTree(treeId)
      for (const f of files) {
        const blob = await this.objects.readBlob(f.blobId)
        if (blob) {
          const lines = blob.content.split(/\r?\n/).length
          additions += lines
          changedFiles++
        }
      }
    }

    // Commit对象的"内容"用于算hash：格式类似git commit object
    const commitContent = this._buildCommitCanonicalContent({
      treeSha: tree.sha256,
      parentShas: parentCommits.map((p) => p.sha256),
      author,
      committer,
      authoredAt,
      committedAt,
      subject: input.subject,
      body: input.body,
    })
    const sha = computeGitHash('commit', commitContent)

    // 如果同样sha的commit已存在（理论上可能，如重复写入），直接返回
    const exist = await this.prisma.gitCommit.findFirst({ where: { repoId, sha256: sha } })
    if (exist) {
      return { commit: exist, hash: sha }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      // 1. 创建 commit
      const commit = await tx.gitCommit.create({
        data: {
          repoId,
          sha256: sha,
          treeId,
          parentCount: parentCommits.length,
          authorName: author.name,
          authorEmail: author.email,
          authorUserId: author.userId,
          authoredAt,
          committerName: committer.name,
          committerEmail: committer.email,
          committerUserId: committer.userId,
          committedAt,
          subject: input.subject,
          body: input.body ?? null,
          additions,
          deletions,
          changedFiles,
          changeType: input.changeType,
          turnIndex: input.turnIndex,
          nodeId: input.nodeId,
          // 写父关联
          parentLinks: {
            create: parentCommits.map((pc, idx) => ({
              parentId: pc.id,
              parentOrder: idx + 1,
            })),
          },
        },
        include: { parentLinks: true },
      })

      // 2. 处理分支HEAD移动
      let branchToUpdate: { id: number; name: string } | null = null
      if (input.branchId) {
        const b = await tx.gitBranch.findUnique({ where: { id: input.branchId } })
        if (b && b.repoId === repoId) branchToUpdate = { id: b.id, name: b.name }
      } else if (input.branchName) {
        const b = await tx.gitBranch.findFirst({ where: { repoId, name: input.branchName } })
        if (b) branchToUpdate = { id: b.id, name: b.name }
      }
      if (branchToUpdate) {
        await tx.gitBranch.update({
          where: { id: branchToUpdate.id },
          data: {
            headCommitId: commit.id,
            lastCommitAt: committedAt,
          },
        })

        // 3. 更新 CommitOnRef 表（建立所有祖先commit到该分支的索引，或至少新commit）
        await tx.gitCommitRef.create({
          data: {
            repoId,
            commitId: commit.id,
            branchId: branchToUpdate.id,
            branchName: branchToUpdate.name,
            refType: 'BRANCH',
            depth: 0, // HEAD是depth=0，父depth=1，等
          },
        })
        // 将父提交的depth依次+1写入（前向传播：只处理最近500个commit，避免O(N²)）
        let scanIdx = 0
        let parentIdCursor: number[] = [...parentCommits.map((p) => p.id)]
        const depthMap = new Map<number, number>()
        for (const pid of parentIdCursor) depthMap.set(pid, 1)
        while (parentIdCursor.length > 0 && scanIdx < 500) {
          const batch = parentIdCursor.splice(0, 100)
          const parents = await tx.gitCommitParent.findMany({
            where: { commitId: { in: batch } },
            select: { commitId: true, parentId: true },
          })
          const upserts: any[] = []
          const next: number[] = []
          for (const p of parents) {
            const d = (depthMap.get(p.commitId) ?? 1) + 1
            if (!depthMap.has(p.parentId)) {
              depthMap.set(p.parentId, d)
              next.push(p.parentId)
            }
            upserts.push(
              tx.gitCommitRef.upsert({
                where: { commitId_branchId: { commitId: p.parentId, branchId: branchToUpdate!.id } },
                create: {
                  repoId,
                  commitId: p.parentId,
                  branchId: branchToUpdate!.id,
                  branchName: branchToUpdate!.name,
                  refType: 'BRANCH',
                  depth: d,
                },
                update: { depth: Math.min(d, depthMap.get(p.parentId) ?? d) },
              }),
            )
          }
          if (upserts.length) await Promise.all(upserts)
          parentIdCursor.push(...next)
          scanIdx += batch.length
        }

        // 4. 写入 Reflog
        const head = parentCommits[0]
        const userName = committer.name
        const userEmail = committer.email
        await tx.gitReflog.create({
          data: {
            repoId,
            refName: `refs/heads/${branchToUpdate.name}`,
            oldSha: head?.sha256 ?? null,
            newSha: sha,
            action: input.changeType === 'MERGE' ? 'merge' : input.changeType === 'REBASE' ? 'rebase' : 'commit',
            actorName: userName,
            actorEmail: userEmail,
            actorUserId: committer.userId,
            reason: input.subject.slice(0, 200),
          },
        })
      }

      // 5. 仓库计数 & 活跃度
      await tx.gitRepo.update({
        where: { id: repoId },
        data: {
          commitCount: { increment: 1 },
          lastActivityAt: committedAt,
        },
      })

      return commit
    })

    return { commit: result, hash: sha }
  }

  private _buildCommitCanonicalContent(params: {
    treeSha: string
    parentShas: string[]
    author: CommitAuthor
    committer: CommitAuthor
    authoredAt: Date
    committedAt: Date
    subject: string
    body?: string
  }): string {
    const lines: string[] = []
    lines.push(`tree ${params.treeSha}`)
    for (const p of params.parentShas) lines.push(`parent ${p}`)
    lines.push(`author ${params.author.name} <${params.author.email}> ${Math.floor(params.authoredAt.getTime() / 1000)} +0000`)
    lines.push(`committer ${params.committer.name} <${params.committer.email}> ${Math.floor(params.committedAt.getTime() / 1000)} +0000`)
    lines.push('')
    lines.push(params.subject)
    if (params.body) {
      lines.push('')
      lines.push(params.body)
    }
    return lines.join('\n')
  }

  // ══════════════════════════════════════════════
  // 查询 Commit
  // ══════════════════════════════════════════════

  async getCommit(repoId: number, sha: string) {
    const where =
      sha.length === 64
        ? { repoId, sha256: sha }
        : { repoId, sha256: { startsWith: sha } }
    const commit = await this.prisma.gitCommit.findFirst({
      where,
      include: {
        tree: { include: { entries: { include: { blob: true, subtree: true } } } },
        parentLinks: { include: { parent: true } },
      },
    })
    if (!commit) return null
    // 额外统计：本commit的diff摘要
    const firstParent = commit.parentLinks[0]?.parent
    const diff = firstParent
      ? await this.objects.diffTrees(firstParent.treeId, commit.treeId)
      : await this.objects.diffTrees(null, commit.treeId)
    return { commit, diff }
  }

  async getCommitById(id: number) {
    return this.prisma.gitCommit.findUnique({ where: { id } })
  }

  /**
   * 获取提交历史（类似 git log --oneline -n N）
   * 支持分页、按分支过滤、作者过滤、grep搜索
   */
  async getCommitHistory(params: {
    repoId: number
    branchId?: number
    branchName?: string
    fromCommitId?: number
    limit?: number
    offset?: number
    authorUserId?: number
    grep?: string
    changeType?: string
  }) {
    const { repoId, limit = 50, offset = 0 } = params
    const where: any = { repoId }

    if (params.authorUserId) where.authorUserId = params.authorUserId
    if (params.grep) {
      where.OR = [
        { subject: { contains: params.grep } },
        { body: { contains: params.grep } },
      ]
    }
    if (params.changeType) where.changeType = params.changeType

    // 如果指定分支，走 commitRef 表按 depth 排序
    if (params.branchId || params.branchName) {
      let branchId = params.branchId
      if (!branchId && params.branchName) {
        const b = await this.prisma.gitBranch.findFirst({
          where: { repoId, name: params.branchName },
        })
        if (!b) return { commits: [], total: 0 }
        branchId = b.id
      }
      const refs = await this.prisma.gitCommitRef.findMany({
        where: { repoId, branchId },
        orderBy: { depth: 'asc' },
        skip: offset,
        take: limit,
        include: {
          commit: {
            include: { parentLinks: { include: { parent: true } } },
          },
        },
      })
      const total = await this.prisma.gitCommitRef.count({ where: { repoId, branchId } })
      return { commits: refs.map((r) => r.commit), total }
    }

    // 不指定分支：按时间倒序 + 可选 fromCommitId 游标
    const commits = await this.prisma.gitCommit.findMany({
      where,
      orderBy: { committedAt: 'desc' },
      skip: offset,
      take: limit,
      include: { parentLinks: { include: { parent: true } } },
      cursor: params.fromCommitId ? { id: params.fromCommitId } : undefined,
    })
    const total = await this.prisma.gitCommit.count({ where })
    return { commits, total }
  }

  // ══════════════════════════════════════════════
  // Cherry-pick / Revert
  // ══════════════════════════════════════════════

  /**
   * Cherry-pick: 把某个commit的patch应用到当前branch HEAD
   * 简单实现：计算 targetCommit 相对其父的diff，和当前HEAD的tree做三路合并
   */
  async cherryPick(input: {
    repoId: number
    targetCommitSha: string
    branchId: number
    author: CommitAuthor
    message?: string
  }): Promise<{ commit?: GitCommit; conflicts?: any[] }> {
    const { repoId, branchId, author } = input
    const branch = await this.prisma.gitBranch.findUnique({ where: { id: branchId }, include: { headCommit: true } })
    if (!branch || !branch.headCommit) throw new Error('分支不存在或无HEAD提交')

    const target = await this.prisma.gitCommit.findFirst({
      where: {
        repoId,
        sha256: input.targetCommitSha.length === 64 ? input.targetCommitSha : { startsWith: input.targetCommitSha },
      },
      include: { parentLinks: { include: { parent: true } } },
    })
    if (!target) throw new Error('目标commit不存在')
    if (target.parentLinks.length === 0) {
      // 没有父 = init commit，没法cherry-pick
      throw new Error('初始提交无法cherry-pick')
    }
    const parent = target.parentLinks[0].parent

    // 取三个tree的内容快照，对每个变化的文件三路合并
    const patchFiles = await this.objects.diffTrees(parent.treeId, target.treeId)
    const headFilesList = await this.objects.materializeTree(branch.headCommit.treeId)
    const headByPath = new Map(headFilesList.map((f) => [f.path, f]))

    // 重新构建 branch HEAD tree + patch 应用
    const newEntries: GitObjectService['BuildEntryInput'][] = []
    const conflicts: any[] = []

    for (const f of patchFiles.files) {
      const path = f.newPath ?? f.oldPath
      if (!path) continue
      const patchStr = f
      // 拿到target中的blob内容（apply patch后的"theirs"）
      const theirsBlob = f.newPath
        ? await this.objects.readFileFromTree(target.treeId, f.newPath)
        : null
      const oursBlob = path ? await this.objects.readFileFromTree(branch.headCommit.treeId, path) : null
      const ancestorBlob = f.oldPath
        ? await this.objects.readFileFromTree(parent.treeId, f.oldPath)
        : null

      if (patchStr.status === 'deleted') {
        // 文件删除：如果HEAD中文件变了就冲突
        if (oursBlob) {
          // 检查 ours == ancestor? 是 → 删除，否 → 冲突
          if (!ancestorBlob || oursBlob.blob.content !== ancestorBlob.blob.content) {
            conflicts.push({ path, reason: 'DELETE_MODIFY' })
            newEntries.push({ path, content: oursBlob.blob.content })
            continue
          }
          // 真正删除：不加入 newEntries
          continue
        }
        continue
      }

      if (patchStr.status === 'added') {
        if (oursBlob) {
          // 两边都新增，看内容是否一致
          if (theirsBlob && oursBlob.blob.content !== theirsBlob.blob.content) {
            conflicts.push({ path, reason: 'BOTH_ADDED' })
            newEntries.push({ path, content: oursBlob.blob.content })
          } else if (theirsBlob) {
            newEntries.push({ path, content: theirsBlob.blob.content })
          }
          continue
        }
        if (theirsBlob) newEntries.push({ path, content: theirsBlob.blob.content })
        continue
      }

      // modified
      if (!theirsBlob || !ancestorBlob) {
        // fallback: 直接加 theirs
        if (theirsBlob) newEntries.push({ path, content: theirsBlob.blob.content })
        continue
      }
      // 没有ours（被删了）→ 冲突
      if (!oursBlob) {
        conflicts.push({ path, reason: 'MODIFY_DELETE' })
        continue
      }
      // 内容相同就跳过
      if (oursBlob.blob.content === theirsBlob.blob.content) {
        newEntries.push({ path, content: oursBlob.blob.content })
        continue
      }
      // 3-way merge文本
      const { threeWayMerge } = await import('../utils/gitDiff.js')
      const merged = threeWayMerge(ancestorBlob.blob.content, oursBlob.blob.content, theirsBlob.blob.content, {
        oursLabel: 'HEAD',
        theirsLabel: `cherry-pick ${target.sha256.slice(0, 7)}`,
      })
      newEntries.push({ path, content: merged.merged })
      if (merged.hasConflicts) {
        conflicts.push({ path, conflictCount: merged.conflictCount })
      }
    }

    // 还需要把 unchanged 的现有文件都加回来
    const existingHeadList = await this.objects.materializeTree(branch.headCommit.treeId)
    const touchedPaths = new Set<string>(patchFiles.files.map((f) => f.newPath ?? f.oldPath ?? '').filter(Boolean))
    for (const e of existingHeadList) {
      if (touchedPaths.has(e.path)) continue
      const blob = await this.objects.readBlob(e.blobId)
      if (blob) newEntries.push({ path: e.path, content: blob.content, blobId: e.blobId })
    }

    const { tree } = await this.objects.buildTree(repoId, newEntries)
    const subject = input.message ?? `cherry-pick: ${target.subject}`
    const body = `(cherry picked from commit ${target.sha256})`
    const { commit } = await this.createCommit({
      repoId,
      treeId: tree.id,
      parentIds: [branch.headCommit.id],
      author,
      subject,
      body,
      changeType: 'CHERRY_PICK',
      branchId,
    })
    return { commit, conflicts }
  }

  /**
   * Revert: 反向应用一个commit
   */
  async revert(input: {
    repoId: number
    targetCommitSha: string
    branchId: number
    author: CommitAuthor
    message?: string
  }): Promise<{ commit?: GitCommit; conflicts?: any[] }> {
    // revert = 交换 diff 的左右边
    // 先得到 target vs parent 的diff，再按"反向patch"应用
    const { repoId, branchId, author, targetCommitSha } = input
    const branch = await this.prisma.gitBranch.findUnique({ where: { id: branchId }, include: { headCommit: true } })
    if (!branch || !branch.headCommit) throw new Error('分支不存在或无HEAD提交')
    const target = await this.prisma.gitCommit.findFirst({
      where: { repoId, sha256: targetCommitSha.length === 64 ? targetCommitSha : { startsWith: targetCommitSha } },
      include: { parentLinks: { include: { parent: true } } },
    })
    if (!target || target.parentLinks.length === 0) throw new Error('目标commit不存在或为初始提交')
    const parent = target.parentLinks[0].parent

    // 反向 diff: old = target.tree, new = parent.tree
    const reverseDiff = await this.objects.diffTrees(target.treeId, parent.treeId)
    const headList = await this.objects.materializeTree(branch.headCommit.treeId)
    const headByPath = new Map(headList.map((f) => [f.path, f]))

    const newEntries: GitObjectService['BuildEntryInput'][] = []
    const conflicts: any[] = []
    const touchedPaths = new Set<string>()

    for (const f of reverseDiff.files) {
      const path = f.newPath ?? f.oldPath
      if (!path) continue
      touchedPaths.add(path)
      const oursBlob = await this.objects.readFileFromTree(branch.headCommit.treeId, path)
      // 反转：patch的"new"就是被还原后的样子，我们直接读 parent.tree 的内容作为 patch result
      const afterRevertBlob = f.newPath ? await this.objects.readFileFromTree(parent.treeId, f.newPath) : null
      const beforeBlob = f.oldPath ? await this.objects.readFileFromTree(target.treeId, f.oldPath) : null

      if (f.status === 'deleted') {
        // revert反向：文件本来是删掉的状态 → 恢复
        if (!afterRevertBlob) continue
        if (oursBlob && oursBlob.blob.content !== afterRevertBlob.blob.content) {
          conflicts.push({ path, reason: 'MODIFY_DELETE' })
          newEntries.push({ path, content: oursBlob.blob.content })
          continue
        }
        newEntries.push({ path, content: afterRevertBlob.blob.content })
        continue
      }
      if (f.status === 'added') {
        // revert反向：原本added的要删掉
        if (oursBlob && beforeBlob && oursBlob.blob.content !== beforeBlob.blob.content) {
          conflicts.push({ path, reason: 'DELETE_MODIFY' })
          newEntries.push({ path, content: oursBlob.blob.content })
          continue
        }
        // 删除：不加入
        continue
      }
      // modified reverse
      if (!afterRevertBlob || !beforeBlob) continue
      if (!oursBlob) {
        conflicts.push({ path, reason: 'MODIFY_DELETE' })
        continue
      }
      if (oursBlob.blob.content === afterRevertBlob.blob.content) {
        // 已经是还原后状态，跳过即可
        newEntries.push({ path, content: oursBlob.blob.content })
        continue
      }
      const { threeWayMerge } = await import('../utils/gitDiff.js')
      const merged = threeWayMerge(
        beforeBlob.blob.content, // ancestor = revert前状态
        oursBlob.blob.content,   // ours = HEAD当前
        afterRevertBlob.blob.content, // theirs = revert应用后
        { oursLabel: 'HEAD', theirsLabel: `revert ${target.sha256.slice(0, 7)}` },
      )
      newEntries.push({ path, content: merged.merged })
      if (merged.hasConflicts) conflicts.push({ path, conflictCount: merged.conflictCount })
    }

    for (const e of headList) {
      if (touchedPaths.has(e.path)) continue
      const blob = await this.objects.readBlob(e.blobId)
      if (blob) newEntries.push({ path: e.path, content: blob.content, blobId: e.blobId })
    }
    const { tree } = await this.objects.buildTree(repoId, newEntries)
    const subject = input.message ?? `revert: ${target.subject}`
    const body = `(reverted from commit ${target.sha256})\n\nThis reverts commit ${target.sha256}.`
    const { commit } = await this.createCommit({
      repoId,
      treeId: tree.id,
      parentIds: [branch.headCommit.id],
      author,
      subject,
      body,
      changeType: 'REVERT',
      branchId,
    })
    return { commit, conflicts }
  }
}
