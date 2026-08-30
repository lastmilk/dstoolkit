/**
 * 兼容层：旧代码中从 @/utils/naive 导入了 message
 * 现在重定向到新的 toast 工具，以便渐进式迁移
 */
import { toast } from './toast'

export const message = toast

/**
 * 旧的 dialog 占位（原 naive 的 $dialog 现在使用 sweetalert2）
 * 迁移过程中先导出一个简单 wrapper，后续各页面逐个替换为 sweetalert.ts 中 API
 */
export const dialog = {
  warning: (_title: string, _content?: string) => Promise.resolve(false),
  error: (_title: string, _content?: string) => Promise.resolve(false),
  success: (_title: string, _content?: string) => Promise.resolve(false),
}
