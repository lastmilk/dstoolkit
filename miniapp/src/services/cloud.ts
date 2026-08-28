import Taro from '@tarojs/taro'

/**
 * 统一调用云函数
 * - 微信小程序(weapp): 走 Taro.cloud.callFunction
 * - 其他平台(H5预览/抖音/支付宝): 走本地 mock 数据
 */
export async function callFunction<T = any>(
  name: string,
  data: Record<string, any> = {}
): Promise<T> {
  console.log(`[Cloud] callFunction: ${name}`, data)

  if (process.env.TARO_ENV === 'weapp') {
    try {
      const res = await Taro.cloud.callFunction({ name, data })
      const result = (res as any).result as { code: number; message: string; data: T }
      if (result.code !== 0) {
        console.error(`[Cloud] ${name} failed:`, result.message)
        throw new Error(result.message || '服务异常')
      }
      return result.data
    } catch (err: any) {
      console.error(`[Cloud] ${name} error:`, err)
      throw err
    }
  }

  // 非微信环境：加载 mock 数据
  return loadMockData<T>(name, data)
}

/**
 * 加载对应云函数的 mock 文件
 * mock 文件约定位置：@/data/<functionName>.ts
 * 默认导出：(data) => Promise<T> 或 T
 */
async function loadMockData<T>(
  functionName: string,
  params: Record<string, any>
): Promise<T> {
  try {
    // 动态 import mock 文件
    const mockMap: Record<string, any> = {
      login: await import('@/data/login'),
      getConversations: await import('@/data/getConversations'),
      getConversationDetail: await import('@/data/getConversationDetail'),
      getStats: await import('@/data/getStats'),
      getConfigs: await import('@/data/getConfigs'),
      redeemCard: await import('@/data/redeemCard'),
      getMarketEntries: await import('@/data/getMarketEntries')
    }

    const mod = mockMap[functionName]
    if (!mod) {
      console.warn(`[Cloud] Mock file not found for: ${functionName}, returning empty`)
      return {} as T
    }

    const handler = mod.default || mod
    if (typeof handler === 'function') {
      const result = await handler(params)
      console.log(`[Cloud] Mock ${functionName} =>`, result)
      return result as T
    }
    return handler as T
  } catch (err: any) {
    console.error(`[Cloud] Load mock failed for ${functionName}:`, err)
    throw err
  }
}
