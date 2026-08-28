import type { DeepseekConfig } from '@/types'

export default async function getConfigs(): Promise<DeepseekConfig[]> {
  return [
    {
      id: 1,
      name: '主账号 - 工作用',
      deepseekUserId: 'ds_user_8888',
      deepseekEmail: 'work@example.com',
      deepseekMobile: '138****8888',
      createdAt: '2025-11-20T10:00:00Z',
      updatedAt: '2026-08-20T10:00:00Z',
      conversationCount: 268
    },
    {
      id: 2,
      name: '副账号 - 学习用',
      deepseekUserId: 'ds_user_9999',
      deepseekEmail: 'learn@example.com',
      createdAt: '2026-03-15T09:00:00Z',
      updatedAt: '2026-08-18T09:00:00Z',
      conversationCount: 60
    }
  ]
}
