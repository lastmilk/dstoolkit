/**
 * Git对象服务（Blob + Tree）
 *
 * 核心职责:
 *  - writeBlob: 创建/复用Blob内容（去重存储，同一内容只存一次）
 *  - readBlob: 读取Blob内容
 *  - buildTreeFromEntries: 从条目列表构建Tree（含递归嵌套）
 *  - materializeTree: 展开Tree为扁平的路径列表（workspace状态）
 *  - diffTrees: 对比两个Tree，输出变更文件列表
 */
import { PrismaClient, type GitBlob, type GitTree, type GitTreeEntry, type Message } from '@prisma/client'
import { computeGitHash, sha256 } from '../utils/gitHash.js'
import type { DiffFileResult } from '../utils/gitDiff.js'
import { computeFileDiff, toUnifiedDiff } from '../utils/gitDiff.js'

export class GitObjectService {
  constructor(private readonly prisma: PrismaClient) {}

  // ══════════════════════════════════════════════
  // Blob 操作
  // ══════════════════════════════════════════════

  /**
   * 写Blob（内容去重：相同内容直接返回现有Blob id）
   */
  async writeBlob(params: {
    repoId: number
    content: string
    mimeType?: string
    encoding?: 'utf8' | 'base64'
    associateMessageId?: number
  }): Promise<{ blob: GitBlob; created: boolean; hash: string }> {
    const { repoId, content, mimeType, encoding = 'utf8', associateMessageId } = params
    const sha = computeGitHash('blob', content)
    // 去重查询：repo + sha 全局唯一（同仓库内同一内容blob只存一次）
    const exist = await this.prisma.gitBlob.findFirst({
      where: { repoId, sha256: sha },
    })
    if (exist) {
      // 如果需要关联message但之前没关联，补充
      if (associateMessageId != null) {
        // 找到或创建一个GitTreeEntry关联（通常由buildTreeFromEntries处理关联）
        // 这里只做blob关联，如果有Message记录没关联的话
        const msg = await this.prisma.message.findUnique({ where: { id: associateMessageId } })
        if (msg) {
          // 关联逻辑在Tree层做
        }
      }
      return { blob: exist, created: false, hash: sha }
    }
    const sizeBytes = Buffer.byteLength(content, encoding === 'base64' ? 'base64' : 'utf8')
    const blob = await this.prisma.gitBlob.create({
      data: {
        repoId,
        sha256: sha,
        sizeBytes,
        mimeType: mimeType ?? inferMime(content, encoding),
        encoding,
        content,
      },
    })
    await this.prisma.gitRepo.update({
      where: { id: repoId },
      data: {
        blobCount: { increment: 1 },
        sizeBytes: { increment: BigInt(sizeBytes) },
      },
    })
    return { blob, created: true, hash: sha }
  }

  async readBlob(blobId: number): Promise<GitBlob | null> {
    return this.prisma.gitBlob.findUnique({ where: { id: blobId } })
  }

  async readBlobBySha(repoId: number, sha: string): Promise<GitBlob | null> {
    if (sha.length === 64) {
      return this.prisma.gitBlob.findFirst({ where: { repoId, sha256: sha } })
    }
    // 短sha
    return this.prisma.gitBlob.findFirst({
      where: { repoId, sha256: { startsWith: sha } },
    })
  }

  // ══════════════════════════════════════════════
  // Tree 操作
  // ══════════════════════════════════════════════

  /**
   * Tree 输入条目
   * 路径式: path="turns/001/user.msg" + blobId 或 subtree entries[]
   * 本函数内部会把路径拆分 / 递归构建嵌套Tree
   */
  public interface BuildEntryInput {
    path: string             // 相对路径，用 / 分隔；也允许空
    mode?: string            // 默认 100644
    content?: string         // 如果提供则自动 writeBlob
    blobId?: number          // 或直接指定已有blob
    mimeType?: string
    associateMessage?: Message // 关联对话消息
  }

  /**
   * 构建不可变的Tree对象
   * 相同的entries集合 → 相同的sha256 → 复用，不会重复创建
   */
  async buildTree(repoId: number, entries: BuildEntryInput[]): Promise<{ tree: GitTree; hash: string }> {
    // Step 1: 写所有需要的 Blob，并且组织成"目录→条目列表"的结构
    const dirMap = new Map<string, Array<BuildEntryInput & { blobId?: number; sortKey: string }>>()

    for (const e of entries) {
      if (!e.path || e.path.length === 0) {
        throw new Error('entry path不能为空')
      }
      let blobId = e.blobId
      if (blobId == null && e.content != null) {
        const { blob } = await this.writeBlob({
          repoId,
          content: e.content,
          mimeType: e.mimeType,
        })
        blobId = blob.id
      }
      const parts = e.path.split('/').filter(Boolean)
      const name = parts.pop()!
      const dir = parts.join('/')
      const list = dirMap.get(dir) ?? []
      list.push({
        ...e,
        blobId,
        sortKey: `${dir}/${name}`,
      })
      dirMap.set(dir, list)
    }

    // Step 2: 按目录深度倒序创建Tree（先叶子后根）
    const createdTrees = new Map<string, { treeId: number; sha: string }>()
    const allDirs = [...dirMap.keys()].sort((a, b) => b.length - a.length) // 深路径先

    const createTreeForDir = async (dir: string): Promise<{ treeId: number; sha: string }> => {
      if (createdTrees.has(dir)) return createdTrees.get(dir)!

      const items = dirMap.get(dir) ?? []
      // 如果目录为空，返回空tree
      if (items.length === 0) {
        return this._createEmptyTree(repoId)
      }
      // 处理嵌套目录：检查是否有条目的路径是子目录
      // 这里我们按 sortKey 排序后构建 entries 字符串来算sha
      // 首先需要确保嵌套子目录作为 subtree
      const dbEntries: Array<{
        mode: string
        name: string
        type: 'BLOB' | 'TREE'
        blobId?: number
        subtreeId?: number
        sortKey: string
        messageId?: number
      }> = []

      // 按路径分桶：当前dir的直接子
      const directChildren = new Map<
        string,
        { type: 'BLOB' | 'DIR'; blobId?: number; subtreeId?: number; mode: string; msgId?: number }
      >()

      for (const item of items) {
        const parts = item.path.split('/').filter(Boolean)
        // parts 最后是文件名
        // 但如果 item.path 是 dir + '/' + name 应该刚好是直接子
        // 为了安全起见我们重新计算
        const dirParts = dir ? dir.split('/') : []
        const relative = parts.slice(dirParts.length)
        const childName = relative[0]
        if (relative.length === 1) {
          // 直接子
          directChildren.set(childName, {
            type: 'BLOB',
            blobId: item.blobId,
            mode: item.mode ?? '100644',
            msgId: item.associateMessage?.id,
          })
        } else {
          // 嵌套子：递归创建子目录
          const subDir = [...dirParts, childName].join('/')
          // 确保子目录被创建
          if (!createdTrees.has(subDir)) {
            const result = await createTreeForDir(subDir)
            createdTrees.set(subDir, result)
          }
          const sub = createdTrees.get(subDir)!
          if (!directChildren.has(childName)) {
            directChildren.set(childName, {
              type: 'DIR',
              subtreeId: sub.treeId,
              mode: '040000',
            })
          }
        }
      }

      // 处理当前dir下的所有子目录（items里面没有直接覆盖到，但是是dirMap中存在的嵌套）
      for (const d of allDirs) {
        if (d === dir) continue
        const dParts = d ? d.split('/') : []
        const dirParts = dir ? dir.split('/') : []
        if (dParts.length === dirParts.length + 1) {
          let parent = true
          for (let i = 0; i < dirParts.length; i++) {
            if (dParts[i] !== dirParts[i]) {
              parent = false
              break
            }
          }
          if (parent) {
            const childName = dParts[dirParts.length]
            if (!directChildren.has(childName)) {
              if (!createdTrees.has(d)) {
                const r = await createTreeForDir(d)
                createdTrees.set(d, r)
              }
              const sub = createdTrees.get(d)!
              directChildren.set(childName, {
                type: 'DIR',
                subtreeId: sub.treeId,
                mode: '040000',
              })
            }
          }
        }
      }

      // 排序（按sortKey即规范化的路径）
      const sortedNames = [...directChildren.keys()].sort()
      let canonicalContent = ''
      for (const n of sortedNames) {
        const c = directChildren.get(n)!
        const sha = c.type === 'BLOB'
          ? (c.blobId ? (await this.readBlob(c.blobId))?.sha256 ?? sha256('') : sha256(''))
          : (c.subtreeId ? (await this.prisma.gitTree.findUnique({ where: { id: c.subtreeId } }))?.sha256 ?? sha256('') : sha256(''))
        canonicalContent += `${c.mode} ${c.type} ${sha} ${n}\n`
        dbEntries.push({
          mode: c.mode,
          name: n,
          type: c.type,
          blobId: c.blobId,
          subtreeId: c.subtreeId,
          sortKey: n,
          messageId: c.msgId,
        })
      }

      const treeSha = computeGitHash('tree', canonicalContent)
      // 去重：如果该sha已存在则直接返回
      let exist = await this.prisma.gitTree.findFirst({ where: { repoId, sha256: treeSha } })
      if (exist) {
        createdTrees.set(dir, { treeId: exist.id, sha: treeSha })
        return { treeId: exist.id, sha: treeSha }
      }
      const tree = await this.prisma.$transaction(async (tx) => {
        const t = await tx.gitTree.create({
          data: {
            repoId,
            sha256: treeSha,
            entryCount: dbEntries.length,
            entries: {
              create: dbEntries.map((e) => ({
                mode: e.mode,
                name: e.name,
                type: e.type,
                sortKey: e.sortKey,
                ...(e.blobId ? { blob: { connect: { id: e.blobId } } } : {}),
                ...(e.subtreeId ? { subtree: { connect: { id: e.subtreeId } } } : {}),
                ...(e.messageId ? { message: { connect: { id: e.messageId } } } : {}),
              })),
            },
          },
        })
        return t
      })
      createdTrees.set(dir, { treeId: tree.id, sha: treeSha })
      return { treeId: tree.id, sha: treeSha }
    }

    const { treeId, sha } = await createTreeForDir('')
    const tree = await this.prisma.gitTree.findUnique({ where: { id: treeId } })
    if (!tree) throw new Error('Tree创建失败')
    return { tree, hash: sha }
  }

  private async _createEmptyTree(repoId: number): Promise<{ treeId: number; sha: string }> {
    const sha = computeGitHash('tree', '')
    const exist = await this.prisma.gitTree.findFirst({ where: { repoId, sha256: sha } })
    if (exist) return { treeId: exist.id, sha }
    const t = await this.prisma.gitTree.create({
      data: { repoId, sha256: sha, entryCount: 0 },
    })
    return { treeId: t.id, sha }
  }

  /**
   * 展开Tree为扁平文件列表（像 ls -R 一样）
   */
  async materializeTree(
    treeId: number,
    basePath = '',
  ): Promise<Array<{ path: string; mode: string; blobId: number; sha: string; sizeBytes: number; mimeType?: string; messageId?: number }>> {
    const entries = await this.prisma.gitTreeEntry.findMany({
      where: { treeId },
      orderBy: { sortKey: 'asc' },
      include: { blob: true, subtree: true, message: true },
    })
    const result: any[] = []
    for (const e of entries) {
      const fullPath = basePath ? `${basePath}/${e.name}` : e.name
      if (e.type === 'BLOB' && e.blob) {
        result.push({
          path: fullPath,
          mode: e.mode,
          blobId: e.blobId,
          sha: e.blob.sha256,
          sizeBytes: e.blob.sizeBytes,
          mimeType: e.blob.mimeType,
          messageId: e.messageId,
        })
      } else if (e.type === 'TREE' && e.subtreeId) {
        const nested = await this.materializeTree(e.subtreeId, fullPath)
        result.push(...nested)
      }
    }
    return result
  }

  /**
   * 从Tree读取单个path的Blob内容（类似 `git show HEAD:path`）
   */
  async readFileFromTree(treeId: number, path: string): Promise<{ blob: GitBlob; messageId?: number } | null> {
    const parts = path.split('/').filter(Boolean)
    let currentTreeId = treeId
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const entry = await this.prisma.gitTreeEntry.findFirst({
        where: { treeId: currentTreeId, name: part },
        include: { blob: true, subtree: true },
      })
      if (!entry) return null
      if (isLast) {
        if (entry.type === 'BLOB' && entry.blob) {
          return { blob: entry.blob, messageId: entry.messageId ?? undefined }
        }
        return null
      } else {
        if (entry.type !== 'TREE' || !entry.subtreeId) return null
        currentTreeId = entry.subtreeId
      }
    }
    return null
  }

  // ══════════════════════════════════════════════
  // Tree 对比（git diff treeA treeB）
  // ══════════════════════════════════════════════

  public interface TreeDiffSummary {
    files: DiffFileResult[]
    totalAdditions: number
    totalDeletions: number
    changedFiles: number
  }

  async diffTrees(oldTreeId: number | null, newTreeId: number): Promise<TreeDiffSummary> {
    const [oldFiles, newFiles] = await Promise.all([
      oldTreeId != null ? this.materializeTree(oldTreeId) : Promise.resolve([]),
      this.materializeTree(newTreeId),
    ])
    const oldByPath = new Map(oldFiles.map((f) => [f.path, f]))
    const newByPath = new Map(newFiles.map((f) => [f.path, f]))
    const changedPaths = new Set<string>()
    for (const f of oldFiles) changedPaths.add(f.path)
    for (const f of newFiles) changedPaths.add(f.path)

    const results: DiffFileResult[] = []
    let totalA = 0
    let totalD = 0
    for (const p of [...changedPaths].sort()) {
      const o = oldByPath.get(p)
      const n = newByPath.get(p)
      const oldBlob = o ? await this.readBlob(o.blobId) : null
      const newBlob = n ? await this.readBlob(n.blobId) : null
      const oldText = oldBlob?.content
      const newText = newBlob?.content
      const df = computeFileDiff(p, p, oldText, newText, {
        oldSha: oldBlob?.sha256,
        newSha: newBlob?.sha256,
      })
      if (df.status !== 'unchanged') {
        results.push(df)
        totalA += df.additions
        totalD += df.deletions
      }
    }
    return {
      files: results,
      totalAdditions: totalA,
      totalDeletions: totalD,
      changedFiles: results.length,
    }
  }

  /**
   * 生成统一diff文本（git show style）
   */
  diffSummaryToUnified(summary: TreeDiffSummary): string {
    return summary.files.map(toUnifiedDiff).join('')
  }
}

function inferMime(content: string, encoding: string): string {
  if (encoding === 'base64') return 'application/octet-stream'
  if (/^\s*\{[\s\S]*\}\s*$/.test(content) && looksLikeJson(content)) return 'application/json'
  if (content.startsWith('<!DOCTYPE html') || /<html[\s>]/i.test(content.slice(0, 200))) return 'text/html'
  if (/^(# |## |### |\* |- |\d\. )/m.test(content.slice(0, 200)) && content.includes('\n')) return 'text/markdown'
  return 'text/plain'
}

function looksLikeJson(s: string): boolean {
  try {
    JSON.parse(s)
    return true
  } catch {
    return false
  }
}
