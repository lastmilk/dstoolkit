import { env } from '../config/env.js'

/**
 * AI Provider 抽象：OpenAI + DeepSeek 双支持。
 * 两者均为 OpenAI 兼容 chat/completions 协议，仅端点/密钥/默认模型不同。
 * 选择优先级：调用方显式指定 > env.AI_PROVIDER > 按密钥存在自动降级。
 */

export type ProviderId = 'deepseek' | 'openai'

export interface AiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface CallAiOptions {
  /** 指定 provider（缺省用全局配置） */
  provider?: string
  /** 指定模型（缺省用 provider 默认模型） */
  model?: string
  /** JSON 模式（response_format=json_object） */
  json?: boolean
  temperature?: number
  maxTokens?: number
}

export interface CallAiResult {
  content: string
  provider: ProviderId
  model: string
}

const PROVIDERS: ProviderId[] = ['deepseek', 'openai']

export function isProviderId(v: string): v is ProviderId {
  return (PROVIDERS as string[]).includes(v)
}

/** 当前可用的 provider（配置了服务端密钥的） */
export function availableProviders(): ProviderId[] {
  const list: ProviderId[] = []
  if (env.deepseekServerKey) list.push('deepseek')
  if (env.openaiServerKey) list.push('openai')
  return list
}

/** 解析实际使用的 provider */
export function resolveProvider(preferred?: string): ProviderId {
  if (preferred && isProviderId(preferred)) return preferred
  if (preferred && !isProviderId(preferred)) {
    throw new Error(`未知 AI provider: ${preferred}（支持 ${PROVIDERS.join(' / ')}）`)
  }
  const available = availableProviders()
  if (available.length === 0) {
    throw new Error('服务端未配置任何 AI 密钥（DEEPSEEK_SERVER_API_KEY / OPENAI_SERVER_API_KEY）')
  }
  if (available.includes(env.aiProvider)) return env.aiProvider
  return available[0]!
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>
  error?: { message?: string }
}

/** 调用指定 provider 的 Chat Completions API（OpenAI 兼容协议） */
export async function callAI(messages: AiMessage[], opts?: CallAiOptions): Promise<CallAiResult> {
  const provider = resolveProvider(opts?.provider)
  const apiBase = provider === 'openai' ? env.openaiApiBase : env.deepseekApiBase
  const key = provider === 'openai' ? env.openaiServerKey : env.deepseekServerKey
  const defaultModel = provider === 'openai' ? env.openaiModel : 'deepseek-chat'
  const model = opts?.model || defaultModel

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts?.temperature ?? 0.3,
    max_tokens: opts?.maxTokens ?? 4096,
  }
  if (opts?.json) {
    body.response_format = { type: 'json_object' }
  }

  const res = await fetch(`${apiBase.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`${provider} API 错误 (${res.status}): ${text || res.statusText}`)
  }
  const data = (await res.json()) as ChatCompletionResponse
  const content = data.choices?.[0]?.message?.content || ''
  return { content, provider, model }
}
