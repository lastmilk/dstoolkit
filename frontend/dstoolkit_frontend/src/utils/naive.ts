import { createDiscreteApi } from 'naive-ui'

// 命令式调用 message/dialog/notification（在 store / axios 拦截器等非组件上下文使用）
export const { message, dialog, notification } = createDiscreteApi([
  'message',
  'dialog',
  'notification',
])
