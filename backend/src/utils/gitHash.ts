/**
 * Git风格的对象哈希计算工具
 * 使用 SHA-256 算法（区别于传统Git的SHA-1，更安全）
 *
 * Git对象格式:
 *   <type> <size>\0<content>
 * 然后对整个字节流进行SHA-256哈希
 */
import { createHash } from 'node:crypto'

export type GitObjectKind = 'blob' | 'tree' | 'commit' | 'tag'

/**
 * 计算Git对象的SHA-256哈希
 * 格式: "<type> <contentByteLength>\0<content>"
 */
export function computeGitHash(kind: GitObjectKind, content: string | Buffer): string {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content
  const header = `${kind} ${buf.length}\0`
  const headerBuf = Buffer.from(header, 'utf8')
  const combined = Buffer.concat([headerBuf, buf])
  return createHash('sha256').update(combined).digest('hex')
}

/**
 * 计算原始字符串/Buffer的SHA-256（不添加Git头，用于内容去重等场景）
 */
export function sha256(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return createHash('sha256').update(buf).digest('hex')
}

/**
 * 计算短哈希（前12位，类似git的短引用）
 */
export function shortSha(fullSha: string, length = 12): string {
  return fullSha.slice(0, length)
}

/**
 * 判断字符串是否看起来像有效的SHA-256（64位hex）
 */
export function isValidSha256(s: string): boolean {
  return /^[0-9a-f]{64}$/i.test(s)
}

/**
 * 判断是否是短哈希（4-63位hex）
 */
export function isShortSha(s: string): boolean {
  return /^[0-9a-f]{4,63}$/i.test(s)
}

/**
 * 规范化分支名：
 * - 去掉首尾空格和斜杠
 * - 连续斜杠变一个
 * - 非法字符替换
 */
export function normalizeRefName(name: string): string {
  return name
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/\/+/g, '/')
    .replace(/[^\w\-./]/g, '_')
}

/**
 * 从分支名构建完整的ref路径
 * refs/heads/<branch>
 */
export function branchRef(branch: string): string {
  return `refs/heads/${normalizeRefName(branch)}`
}

/**
 * refs/tags/<tag>
 */
export function tagRef(tag: string): string {
  return `refs/tags/${normalizeRefName(tag)}`
}
