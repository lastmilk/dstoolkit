/**
 * vue-toastification 全局工具
 * 封装成 message API，与原 naive 的 message.success/warning/error 类似
 * 便于代码迁移时快速替换
 */
import { useToast, TYPE, POSITION } from 'vue-toastification'
import type { ToastOptions, ToastID } from 'vue-toastification/dist/types/types'

let _toast: ReturnType<typeof useToast> | null = null

function getToast(): ReturnType<typeof useToast> {
  if (!_toast) {
    _toast = useToast()
  }
  return _toast
}

/** 允许外部在组件挂载前注入 toast 实例（用于 main.ts 注入） */
export function setGlobalToastInstance(inst: ReturnType<typeof useToast>) {
  _toast = inst
}

const DEFAULT_OPTIONS: ToastOptions = {
  position: POSITION.TOP_RIGHT,
  timeout: 2600,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.5,
  showCloseButtonOnHover: false,
  hideProgressBar: false,
  closeButton: 'button',
  icon: true,
  rtl: false,
  // 注：transition / maxToasts / newestOnTop 属于 PluginOptions，
  // 在 main.ts 中统一通过 app.use(Toast, ...) 配置
}

const MERGE_OPTS = <T extends ToastOptions>(overrides: T | undefined): any => ({
  ...(DEFAULT_OPTIONS as ToastOptions),
  ...(overrides ?? ({} as T)),
})

export const toast = {
  success(msg: string, opts?: ToastOptions) {
    return getToast().success(msg, MERGE_OPTS(opts))
  },
  error(msg: string, opts?: ToastOptions) {
    return getToast().error(msg, MERGE_OPTS({ ...opts, timeout: (opts as any)?.timeout ?? 4500 }))
  },
  warning(msg: string, opts?: ToastOptions) {
    return getToast().warning(msg, MERGE_OPTS(opts))
  },
  info(msg: string, opts?: ToastOptions) {
    return getToast().info(msg, MERGE_OPTS(opts))
  },
  loading(msg: string, opts?: ToastOptions) {
    return getToast()(msg, MERGE_OPTS({
      type: TYPE.DEFAULT,
      timeout: false,
      closeButton: false,
      closeOnClick: false,
      draggable: false,
      icon: { iconClass: 'el-icon-loading', iconChildren: '' },
      ...opts,
    } as ToastOptions)) as ToastID
  },
  dismiss(id?: ToastID) {
    if (id != null) getToast().dismiss(id)
    else getToast().clear()
  },
  clear() {
    getToast().clear()
  },
}
