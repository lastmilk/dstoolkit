import fs from 'node:fs'
import path from 'node:path'
import * as git from 'isomorphic-git'
import { env } from '../config/env.js'

/**
 * Git 聊天记录仓库服务（isomorphic-git，纯 JS、跨平台、无系统 git 依赖）。
 *
 * 每个聊天记录仓库对应磁盘上一个独立 Git 仓库：
 *   <REPOS_DIR>/<userId>/repo-<repoId>/conversations.json   ← 工作文件（统一规范快照）
 *   <REPOS_DIR>/<userId>/repo-<repoId>/.git/                ← Git 对象库
 *
 * 语义：
 *  - 上传导入 = 用全量快照覆盖 conversations.json 并 commit（快照式版本管理）
 *  - 回滚 = 读取历史版本内容重新入库，并追加一条回滚 commit（不改写历史，安全）
 *  - 仓库内只管 conversations.json 一份文件，其余数据一律不入库
 */

const REPOS_ROOT = path.resolve(env.gitReposDir)

const GIT_AUTHOR = { name: 'dstoolkit', email: 'repo@dstoolkit.local' }

/** 每仓库串行化写操作，避免并发 commit 竞争 index/refs */
const repoLocks = new Map<string, Promise<unknown>>()

function repoDir(userId: number, repoId: number): string {
  return path.join(REPOS_ROOT, String(userId), `repo-${repoId}`)
}

function snapshotPath(userId: number, repoId: number): string {
  return path.join(repoDir(userId, repoId), 'conversations.json')
}

/** 以每仓库互斥方式执行 fn（前一个操作完成后再开始下一个） */
function withRepoLock<T>(userId: number, repoId: number, fn: () => Promise<T>): Promise<T> {
  const key = `${userId}:${repoId}`
  const prev = repoLocks.get(key) ?? Promise.resolve()
  const next = prev.then(fn, fn)
  repoLocks.set(
    key,
    next.catch(() => { /* 锁链不因单次失败而断裂 */ }),
  )
  return next
}

/** 初始化（幂等）：目录不存在则 git init */
export async function ensureRepoInit(userId: number, repoId: number): Promise<void> {
  const dir = repoDir(userId, repoId)
  if (!fs.existsSync(path.join(dir, '.git'))) {
    await fs.promises.mkdir(dir, { recursive: true })
    await git.init({ fs, dir, defaultBranch: 'main' })
  }
}

export interface CommitResult {
  sha: string
  message: string
  timestamp: number
}

/**
 * 提交一份新的全量快照：覆盖工作文件 → add → commit。
 * message 建议携带变更摘要（如「导入数据包: +3 新增 / 共 25 会话」）。
 */
export async function commitSnapshot(
  userId: number,
  repoId: number,
  snapshotJson: string,
  message: string,
): Promise<CommitResult> {
  return withRepoLock(userId, repoId, async () => {
    await ensureRepoInit(userId, repoId)
    const dir = repoDir(userId, repoId)
    await fs.promises.writeFile(snapshotPath(userId, repoId), snapshotJson, 'utf8')
    await git.add({ fs, dir, filepath: 'conversations.json' })
    const sha = await git.commit({
      fs,
      dir,
      message,
      author: GIT_AUTHOR,
    })
    return { sha, message, timestamp: Math.floor(Date.now() / 1000) }
  })
}

export interface RepoCommit {
  sha: string
  message: string
  author: string
  timestamp: number
}

/** 列出 conversations.json 的提交历史（新→旧） */
export async function listHistory(userId: number, repoId: number): Promise<RepoCommit[]> {
  const dir = repoDir(userId, repoId)
  if (!fs.existsSync(path.join(dir, '.git'))) return []
  try {
    const commits = await git.log({ fs, dir, filepath: 'conversations.json' })
    return commits.map((c: any) => ({
      sha: c.oid,
      message: c.commit.message,
      author: c.commit.author.name,
      timestamp: c.commit.author.timestamp,
    }))
  } catch {
    // 无任何提交（HEAD 未引用）等情况
    return []
  }
}

/** 读取指定提交时刻的 conversations.json 内容 */
export async function readSnapshotAt(
  userId: number,
  repoId: number,
  sha: string,
): Promise<string | null> {
  const dir = repoDir(userId, repoId)
  if (!fs.existsSync(path.join(dir, '.git'))) return null
  try {
    const blob = await git.readBlob({ fs, dir, oid: sha, filepath: 'conversations.json' })
    return Buffer.from(blob.blob).toString('utf8')
  } catch {
    return null
  }
}

/** 删除磁盘仓库（连带 DB 删除仓库时调用） */
export function deleteRepoDisk(userId: number, repoId: number): void {
  const dir = repoDir(userId, repoId)
  fs.rmSync(dir, { recursive: true, force: true })
  repoLocks.delete(`${userId}:${repoId}`)
}

/** 仓库统计信息（前端展示用） */
export async function repoDiskInfo(userId: number, repoId: number): Promise<{
  initialized: boolean
  commitCount: number
  snapshotBytes: number
}> {
  const dir = repoDir(userId, repoId)
  const initialized = fs.existsSync(path.join(dir, '.git'))
  if (!initialized) return { initialized, commitCount: 0, snapshotBytes: 0 }
  const commits = await listHistory(userId, repoId)
  let snapshotBytes = 0
  try {
    snapshotBytes = (await fs.promises.stat(snapshotPath(userId, repoId))).size
  } catch { /* 工作文件尚不存在 */ }
  return { initialized, commitCount: commits.length, snapshotBytes }
}
