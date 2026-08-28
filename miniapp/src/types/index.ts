// 会员等级
export type Tier = 'FREE' | 'PRO' | 'PLUS' | 'ULTIMATE' | 'TEAM'

// 卡密时长
export type CardDuration = 'PERMANENT' | 'ANNUAL'

// 角色
export type Role = 'USER' | 'ADMIN'
export type MsgRole = 'USER' | 'ASSISTANT'

// 用户信息
export interface UserInfo {
  id: number
  username: string
  role: Role
  tier: Tier
  tierActivatedAt?: string
  tierExpiresAt?: string
  isPermanentTier: boolean
  aiCredits: number
  referralCode?: string
  avatarUrl?: string
  adRewardTier?: Tier | null
  adRewardExpiresAt?: string | null
  cloudSyncEnabled: boolean
  createdAt: string
}

// DeepSeek 配置
export interface DeepseekConfig {
  id: number
  name: string
  deepseekUserId: string
  deepseekEmail?: string
  deepseekMobile?: string
  createdAt: string
  updatedAt: string
  conversationCount?: number
}

// 对话
export interface Conversation {
  id: number
  configId: number
  deepseekConvId: string
  title: string
  insertedAt: string
  updatedAt: string
  turnCount: number
  folderId?: number
  tagIds?: number[]
  summaryTldr?: string
  summaryTags?: string[]
}

// 消息
export interface Message {
  id: number
  conversationId: number
  nodeId: string
  parentId?: string
  role: MsgRole
  model?: string
  content: string
  insertedAt: string
  turnIndex?: number
  versionIndex?: number
  subTurnIndex?: number
}

// AI 摘要
export interface ConvSummary {
  id: number
  conversationId: number
  userId: number
  tldr: string
  summary: string
  tags: string[]
  confidence: number
  model?: string
  createdAt: string
}

// 知识卡片
export interface KnowledgeCard {
  id: number
  conversationId: number
  title: string
  content: string
  category?: string
  tags: string[]
  createdAt: string
}

// 文件夹
export interface Folder {
  id: number
  name: string
  color?: string
  icon?: string
  parentId?: number
  conversationCount?: number
}

// 标签
export interface ConvTag {
  id: number
  name: string
  color?: string
  conversationCount?: number
}

// 应用市场条目
export interface MarketEntry {
  id: number
  name: string
  url: string
  description?: string
  category: string
  iconId?: number
  createdAt: string
}

// 统计数据
export interface StatsData {
  totalConversations: number
  totalMessages: number
  totalTokens: number
  activeDays: number
  trend: DailyStat[]
  hotWords: HotWord[]
  tierDistribution: TierStat[]
}

export interface DailyStat {
  date: string
  conversations: number
  messages: number
}

export interface HotWord {
  word: string
  count: number
}

export interface TierStat {
  tier: Tier
  count: number
}

// 分页结果
export interface PageResponse<T> {
  records: T[]
  total: number
  page: number
  pageSize: number
}

// 云函数通用返回
export interface CloudResponse<T> {
  code: number
  message: string
  data: T
}

// 登录请求
export interface LoginRequest {
  username: string
  password: string
}

// 登录响应
export interface LoginResponse {
  token: string
  user: UserInfo
}

// 兑换卡密请求
export interface RedeemRequest {
  code: string
}

// 兑换结果
export interface RedeemResult {
  success: boolean
  tier: Tier
  duration: CardDuration
  expiresAt?: string
  newCredits?: number
}
