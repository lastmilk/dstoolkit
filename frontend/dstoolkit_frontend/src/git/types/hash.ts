/**
 * SHA-256 和 Git 风格的对象哈希（跨端：Node + 浏览器通用）
 *
 * - Node: 优先 crypto.createHash（高性能）
 * - 浏览器: 使用 crypto.subtle.digest + 十六进制编码
 * - 回退: WebCrypto 不可用时，走纯 JS 参考实现（性能差但可靠）
 */

export type GitObjectKind = 'blob' | 'tree' | 'commit' | 'tag'

// 探测环境
const isNode =
  typeof process !== 'undefined' &&
  process.versions != null &&
  process.versions.node != null

/** 计算字节数组的SHA-256 → hex 字符串 */
export async function sha256Bytes(buf: Uint8Array): Promise<string> {
  if (isNode) {
    // 动态 import 避免打包到浏览器
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = (await import('node:crypto')).default ?? require('node:crypto')
    return crypto.createHash('sha256').update(Buffer.from(buf)).digest('hex')
  }
  if (typeof crypto !== 'undefined' && crypto.subtle && crypto.subtle.digest) {
    const digest = await crypto.subtle.digest('SHA-256', buf)
    return bytesToHex(new Uint8Array(digest))
  }
  // 回退纯JS
  return sha256PureJs(buf)
}

/** 字符串/Buffer 转字节 */
function toBytes(input: string | Uint8Array): Uint8Array {
  if (typeof input === 'string') {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(input)
    // 兼容：简单 utf8 编码
    const arr: number[] = []
    for (let i = 0; i < input.length; i++) {
      let c = input.charCodeAt(i)
      if (c < 0x80) arr.push(c)
      else if (c < 0x800) {
        arr.push(0xc0 | (c >> 6))
        arr.push(0x80 | (c & 0x3f))
      } else if (c < 0xd800 || c >= 0xe000) {
        arr.push(0xe0 | (c >> 12))
        arr.push(0x80 | ((c >> 6) & 0x3f))
        arr.push(0x80 | (c & 0x3f))
      } else {
        i++
        const c2 = input.charCodeAt(i)
        const cp = 0x10000 + (((c & 0x3ff) << 10) | (c2 & 0x3ff))
        arr.push(0xf0 | (cp >> 18))
        arr.push(0x80 | ((cp >> 12) & 0x3f))
        arr.push(0x80 | ((cp >> 6) & 0x3f))
        arr.push(0x80 | (cp & 0x3f))
      }
    }
    return Uint8Array.from(arr)
  }
  return input
}

/** bytes → hex */
export function bytesToHex(buf: Uint8Array): string {
  let s = ''
  for (let i = 0; i < buf.length; i++) {
    s += buf[i].toString(16).padStart(2, '0')
  }
  return s
}

/** hex → bytes */
export function hexToBytes(hex: string): Uint8Array {
  const out = new Uint8Array(hex.length / 2)
  for (let i = 0; i < hex.length; i += 2) {
    out[i / 2] = parseInt(hex.slice(i, i + 2), 16)
  }
  return out
}

/**
 * 同步 SHA-256（Node下可保证同步，浏览器下回退到 Promise 里也能调用，但需要用户await）
 * 推荐始终使用 async 版本。这里提供 sync 版本给 Node-only 场景。
 */
export function sha256Sync(input: string | Uint8Array): string {
  const buf = toBytes(input)
  if (isNode) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const crypto = require('node:crypto')
    return crypto.createHash('sha256').update(Buffer.from(buf)).digest('hex')
  }
  throw new Error('sha256Sync 仅 Node 环境可用，浏览器端请用 sha256()')
}

/** 简单内容 SHA-256（非git格式） */
export async function sha256(input: string | Uint8Array): Promise<string> {
  return sha256Bytes(toBytes(input))
}

/**
 * Git对象哈希：
 *   sha256( "<type> <size>\0<content>" )
 */
export async function computeGitHash(kind: GitObjectKind, content: string | Uint8Array): Promise<string> {
  const contentBuf = toBytes(content)
  const header = `${kind} ${contentBuf.length}\0`
  const headerBuf = toBytes(header)
  const combined = new Uint8Array(headerBuf.length + contentBuf.length)
  combined.set(headerBuf, 0)
  combined.set(contentBuf, headerBuf.length)
  return sha256Bytes(combined)
}

/** 同步版（仅Node） */
export function computeGitHashSync(kind: GitObjectKind, content: string | Uint8Array): string {
  const contentBuf = toBytes(content)
  const header = `${kind} ${contentBuf.length}\0`
  const headerBuf = toBytes(header)
  const combined = new Uint8Array(headerBuf.length + contentBuf.length)
  combined.set(headerBuf, 0)
  combined.set(contentBuf, headerBuf.length)
  return sha256Sync(combined)
}

/** 短哈希（前12位） */
export function shortSha(fullSha: string, length = 12): string {
  return fullSha.slice(0, length)
}

/** 64 hex chars 校验 */
export function isValidSha256(s: string): boolean {
  return /^[0-9a-f]{64}$/i.test(s)
}

/** 短 hash */
export function isShortSha(s: string): boolean {
  return /^[0-9a-f]{4,63}$/i.test(s)
}

/** 规范化分支名（跨端一致） */
export function normalizeRefName(name: string): string {
  return name
    .trim()
    .replace(/^\/+|\/+$/g, '')
    .replace(/\/\/+/g, '/')
    .replace(/[^\w\-./]/g, '_')
}

export function branchRef(branch: string): string {
  return `refs/heads/${normalizeRefName(branch)}`
}

export function tagRef(tag: string): string {
  return `refs/tags/${normalizeRefName(tag)}`
}

// ══════════════════════════════════════════════
// 纯 JS SHA-256 参考实现（WebCrypto不可用回退）
// 注意：性能不佳，仅应急使用
// ══════════════════════════════════════════════

function sha256PureJs(msg: Uint8Array): string {
  // 参考实现：RFC 6234
  const K = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]
  const H0 = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]
  const H = H0.slice()
  // 填充
  const bitLen = msg.length * 8
  const paddingLen = ((64 - ((msg.length + 1 + 8) % 64)) + 64) % 64
  const total = msg.length + 1 + paddingLen + 8
  const buf = new Uint8Array(total)
  buf.set(msg, 0)
  buf[msg.length] = 0x80
  // 64位长度
  let len = BigInt(bitLen)
  for (let i = 0; i < 8; i++) {
    buf[buf.length - 1 - i] = Number(len & 0xffn)
    len >>= 8n
  }
  const rotr = (x: number, n: number) => (x >>> n) | (x << (32 - n))
  const ch = (x: number, y: number, z: number) => (x & y) ^ (~x & z)
  const maj = (x: number, y: number, z: number) => (x & y) ^ (x & z) ^ (y & z)
  const sig0 = (x: number) => rotr(x, 2) ^ rotr(x, 13) ^ rotr(x, 22)
  const sig1 = (x: number) => rotr(x, 6) ^ rotr(x, 11) ^ rotr(x, 25)
  const gam0 = (x: number) => rotr(x, 7) ^ rotr(x, 18) ^ (x >>> 3)
  const gam1 = (x: number) => rotr(x, 17) ^ rotr(x, 19) ^ (x >>> 10)

  for (let off = 0; off < buf.length; off += 64) {
    const W = new Uint32Array(64)
    for (let i = 0; i < 16; i++) {
      W[i] = (buf[off + 4 * i] << 24) | (buf[off + 4 * i + 1] << 16) | (buf[off + 4 * i + 2] << 8) | buf[off + 4 * i + 3]
    }
    for (let i = 16; i < 64; i++) {
      W[i] = (gam1(W[i - 2]) + W[i - 7] + gam0(W[i - 15]) + W[i - 16]) | 0
    }
    let [a, b, c, d, e, f, g, h] = H
    for (let i = 0; i < 64; i++) {
      const T1 = (h + sig1(e) + ch(e, f, g) + K[i] + W[i]) | 0
      const T2 = (sig0(a) + maj(a, b, c)) | 0
      h = g
      g = f
      f = e
      e = (d + T1) | 0
      d = c
      c = b
      b = a
      a = (T1 + T2) | 0
    }
    H[0] = (H[0] + a) | 0
    H[1] = (H[1] + b) | 0
    H[2] = (H[2] + c) | 0
    H[3] = (H[3] + d) | 0
    H[4] = (H[4] + e) | 0
    H[5] = (H[5] + f) | 0
    H[6] = (H[6] + g) | 0
    H[7] = (H[7] + h) | 0
  }
  let out = ''
  for (let i = 0; i < 8; i++) {
    out += (H[i] >>> 0).toString(16).padStart(8, '0')
  }
  return out
}
