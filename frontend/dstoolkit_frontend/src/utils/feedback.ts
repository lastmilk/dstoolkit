import {
  DialogPlugin,
  MessagePlugin,
  NotifyPlugin,
} from 'tdesign-vue-next'

// 命令式调用 message/dialog/notification（在 store / axios 拦截器等非组件上下文使用）
export const message = MessagePlugin
export const dialog = DialogPlugin
export const notification = NotifyPlugin
