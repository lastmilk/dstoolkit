import AdmZip from 'adm-zip'
import { Readable } from 'node:stream'
import { pipeline } from 'node:stream/promises'
import { streamArray } from 'stream-json/streamers/stream-array.js'
import {
  processConversation,
  extractTurnsGeneric,
  buildNodeIndexMap,
  type ParsedConversation,
  type ParsedMessage,
  type ParsedRole,
} from './deepseekParser.js'

export type ConvSource = 'deepseek' | 'openai'

export const SNAPSHOT_FORMAT = 'dstoolkit-conversations'
export const SNAPSHOT_VERSION = 1

// ═══════════ 来源识别 ═══════════

/**
 * 识别单个会话对象的导出来源：
 *  - DeepSeek 导出：message.fragments[]，type 为 REQUEST/RESPONSE
 *  - OpenAI（ChatGPT）导出：message.author.role + message.content.parts
 */
export function detectSource(c: any): ConvSource {
  const mapping: Record<string, any> = c?.mapping || {}
  for (const node of Object.values<any>(mapping)) {
    const msg = node?.message
    if (!msg) continue
    if (Array.isArray(msg.fragments)) return 'deepseek'
    if (msg.author || msg.content) return 'openai'
  }
  // 无消息节点的空会话：按顶层时间字段风格猜（ChatGPT 用 create_time 秒级时间戳）
  return typeof c?.create_time === 'number' ? 'openai' : 'deepseek'
}

// ═══════════ OpenAI（ChatGPT 导出）格式处理 ═══════════

/**
 * ChatGPT 角色 → 内部角色。system/tool 等辅助节点返回 null（跳过，不进入消息流）。
 */
function openaiRoleToParsed(role: unknown): ParsedRole | null {
  if (role === 'user') return 'USER'
  if (role === 'assistant') return 'ASSISTANT'
  return null
}

/**
 * ChatGPT content → 纯文本。
 *  - content_type=text: parts[]（字符串为主，多模态时可能混入对象）
 *  - content_type=code: text 字段
 *  - 其它（audio_transcription / multimodal_text 等）：尽力拼接 parts / text，兜底 JSON 序列化
 */
function openaiContentToText(content: any): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content.parts)) {
    return content.parts
      .map((p: any) => (typeof p === 'string' ? p : JSON.stringify(p ?? '')))
      .join('\n')
  }
  if (typeof content.text === 'string') return content.text
  return JSON.stringify(content)
}

function openaiNodeRole(mapping: Record<string, any>, nodeId: string): ParsedRole | null {
  const node = mapping[nodeId]
  if (!node || !node.message) return null
  return openaiRoleToParsed(node.message.author?.role)
}

/**
 * 处理单个 OpenAI（ChatGPT 导出）会话对象 → 内部统一 ParsedConversation。
 * mapping 同为 parent/children 树（root 节点 message 为 null），复用泛化 turns 算法。
 */
function processOpenaiConversation(c: any): ParsedConversation {
  const mapping: Record<string, any> = c.mapping || {}

  const turns = extractTurnsGeneric(
    mapping,
    (id) => openaiNodeRole(mapping, id) === 'USER',
    (id) => openaiNodeRole(mapping, id) === 'ASSISTANT',
  )
  const indexMap = buildNodeIndexMap(turns)

  // 时间：ChatGPT 用 unix 秒（浮点）
  const convInserted = typeof c.create_time === 'number'
    ? new Date(c.create_time * 1000)
    : c.create_time ? new Date(c.create_time) : new Date()
  const convUpdated = typeof c.update_time === 'number'
    ? new Date(c.update_time * 1000)
    : c.update_time ? new Date(c.update_time) : convInserted

  const messages: ParsedMessage[] = []
  const rootNode = Object.values<any>(mapping).find((n) => n && n.parent === null)
  const visit = (nodeId: any) => {
    const node = mapping[nodeId]
    if (!node) return
    const msg = node.message
    if (msg) {
      const role = openaiRoleToParsed(msg.author?.role)
      if (role) {
        const ts: Date = typeof msg.create_time === 'number'
          ? new Date(msg.create_time * 1000)
          : msg.create_time ? new Date(msg.create_time) : convInserted
        const canonicalId = String(node.id ?? nodeId ?? '')
        const idx = indexMap.get(canonicalId)
        messages.push({
          nodeId: canonicalId,
          parentId: node.parent ? String(node.parent) : null,
          role,
          model: msg.metadata?.model_slug || null,
          content: openaiContentToText(msg.content),
          insertedAt: ts,
          turnIndex: idx?.turnIndex,
          versionIndex: idx?.versionIndex,
          subTurnIndex: idx?.subTurnIndex,
        })
      }
    }
    for (const childId of (node.children || [])) {
      visit(childId)
    }
  }
  if (rootNode) visit(rootNode.id)

  return {
    deepseekConvId: String(c.id),
    title: c.title || '(无标题)',
    insertedAt: convInserted,
    updatedAt: convUpdated,
    mapping,
    messages,
    turns,
  }
}

/** 按来源分发处理单个会话对象 */
export function processConversationUnified(c: any, source: ConvSource): ParsedConversation {
  return source === 'openai' ? processOpenaiConversation(c) : processConversation(c)
}

// ═══════════ zip 提取（只取 conversations.json，其余全部丢弃） ═══════════

function findEntryName(zip: AdmZip, filename: string): string | null {
  const entries = zip.getEntries()
  const hit = entries.find((e) => e.entryName.toLowerCase().endsWith(filename))
  return hit ? hit.entryName : null
}

/**
 * 从任意来源的导出 zip 中提取 conversations.json。
 * user.json / chat.html / user_avatars 等其它文件一律忽略。
 */
export function extractConversationsJson(buffer: Buffer): Buffer {
  const zip = new AdmZip(buffer)
  const entryName = findEntryName(zip, 'conversations.json')
  if (!entryName) {
    throw new Error('压缩包中未找到 conversations.json（支持 DeepSeek / ChatGPT 官方导出格式）')
  }
  return zip.getEntry(entryName)!.getData()
}

/**
 * 流式解析导出 zip：解压 → 流式读取 conversations.json 顶层数组 →
 * 逐会话识别来源并统一处理（deepseek 片段树 / openai 作者树）。
 * 返回来源统计（来源可能混合，以会话为单位判定）。
 */
export async function parseZipUnified(
  buffer: Buffer,
  onConversation: (conv: ParsedConversation, source: ConvSource) => void | Promise<void>,
  onProgress?: (loaded: number) => void,
): Promise<{ sources: Record<ConvSource, number> }> {
  const conversationsBuffer = extractConversationsJson(buffer)
  const sources: Record<ConvSource, number> = { deepseek: 0, openai: 0 }
  const stream = streamArray.withParserAsStream()
  let loaded = 0
  try {
    await pipeline(
      Readable.from(conversationsBuffer),
      stream,
      async function (source: AsyncIterable<{ key: number; value: unknown }>) {
        for await (const item of source) {
          const raw = item.value
          const src = detectSource(raw)
          const conv = processConversationUnified(raw, src)
          await onConversation(conv, src)
          sources[src]++
          loaded++
          onProgress?.(loaded)
        }
      },
    )
  } catch (e) {
    // 兜底：非数组结构等异常情况下一次性 JSON.parse，保证可用性
    const arr = JSON.parse(conversationsBuffer.toString('utf8')) as any[]
    for (const raw of arr) {
      const src = detectSource(raw)
      await onConversation(processConversationUnified(raw, src), src)
      sources[src]++
      loaded++
      onProgress?.(loaded)
    }
  }
  return { sources }
}

// ═══════════ 规范快照（Git 仓库内 conversations.json 的统一格式） ═══════════

export interface SnapshotConversation {
  id: string
  title: string
  source: ConvSource
  inserted_at: string
  updated_at: string
  turn_count: number
  /** 原始 mapping 树（保留完整分支结构，消息可由 mapping 重导出） */
  mapping: Record<string, unknown>
}

export interface SnapshotFile {
  format: typeof SNAPSHOT_FORMAT
  version: number
  exportedAt: string
  conversationCount: number
  conversations: SnapshotConversation[]
}

/** ParsedConversation → 快照条目 */
export function toSnapshotConversation(conv: ParsedConversation, source: ConvSource): SnapshotConversation {
  return {
    id: conv.deepseekConvId,
    title: conv.title,
    source,
    inserted_at: conv.insertedAt.toISOString(),
    updated_at: conv.updatedAt.toISOString(),
    turn_count: conv.turns.length,
    mapping: conv.mapping,
  }
}

/** 快照条目 → ParsedConversation（按 source 重导出 messages/turns） */
export function fromSnapshotConversation(sc: SnapshotConversation): ParsedConversation {
  const source: ConvSource = sc.source === 'openai' ? 'openai' : 'deepseek'
  return processConversationUnified(
    {
      id: sc.id,
      title: sc.title,
      [source === 'openai' ? 'create_time' : 'inserted_at']: sc.inserted_at,
      [source === 'openai' ? 'update_time' : 'updated_at']: sc.updated_at,
      mapping: sc.mapping,
    },
    source,
  )
}

/** 从 DB 行构建快照条目（回填/提交时使用，避免重复解析树） */
export function snapshotConversationFromDb(row: {
  deepseekConvId: string
  title: string
  insertedAt: Date
  updatedAt: Date
  turnCount: number
  rawMapping: unknown
  source: string
}): SnapshotConversation {
  return {
    id: row.deepseekConvId,
    title: row.title,
    source: row.source === 'openai' ? 'openai' : 'deepseek',
    inserted_at: row.insertedAt.toISOString(),
    updated_at: row.updatedAt.toISOString(),
    turn_count: row.turnCount,
    mapping: (row.rawMapping ?? {}) as Record<string, unknown>,
  }
}

export function serializeSnapshot(conversations: SnapshotConversation[]): string {
  const file: SnapshotFile = {
    format: SNAPSHOT_FORMAT,
    version: SNAPSHOT_VERSION,
    exportedAt: new Date().toISOString(),
    conversationCount: conversations.length,
    conversations,
  }
  return JSON.stringify(file)
}

/**
 * 解析规范快照（Git 仓库中 conversations.json 的统一格式）。
 * 兼容两种顶层结构：dstoolkit 快照对象、或直接由导出 zip 而来的原始数组。
 */
export function parseSnapshot(jsonText: string): { conversations: SnapshotConversation[]; isCanonical: boolean } {
  const data = JSON.parse(jsonText)
  if (Array.isArray(data)) {
    // 原始导出数组（非规范快照）：逐条识别来源并转成规范条目
    const conversations = data.map((raw: any) => {
      const src = detectSource(raw)
      return toSnapshotConversation(processConversationUnified(raw, src), src)
    })
    return { conversations, isCanonical: false }
  }
  if (data?.format !== SNAPSHOT_FORMAT) {
    throw new Error('快照文件格式无法识别（缺少 dstoolkit-conversations 标识）')
  }
  return { conversations: data.conversations ?? [], isCanonical: true }
}
