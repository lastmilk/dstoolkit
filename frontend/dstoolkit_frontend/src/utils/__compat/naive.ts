/**
 * 运行时 Naive UI 兼容层（迁移过渡期使用）
 *
 * 未迁移到 Element-Plus 的页面仍然 import 了 naive-ui 组件。
 * 为了不让 vite 打包报 "cannot resolve module 'naive-ui'"，
 * 在 vite.config.ts 中把 naive-ui alias 到本文件。
 *
 * 本模块使用 Proxy 构造一个"任何属性都是渲染成空 div 的 Vue 组件"对象：
 *  - 这样即使页面还没迁移，也不会在 build / dev 阶段崩溃。
 *  - 一旦全部视图迁移完成，删除本文件 + alias + types/shims-naive.d.ts 即可。
 */
import { defineComponent, h } from 'vue'

const NoopComp = defineComponent({
  name: 'NaiveNoopComp',
  inheritAttrs: true,
  props: {} as any,
  setup(_props, { slots, attrs }) {
    return () => h('div', { 'data-naive-noop': '1', ...attrs }, slots.default?.())
  },
})

function makeHook<T>(fallback?: T): T {
  return (() => fallback ?? {}) as unknown as T
}

// 构造一个 Proxy：任何未知成员都返回同一个 Noop 组件
// （已知 hook 名 → 返回空函数）
const HOOK_NAMES = new Set([
  'useMessage',
  'useDialog',
  'useNotification',
  'useLoadingBar',
  'create',
])

const naiveCompat: any = new Proxy(
  {
    version: '0.0.0-shim',
    create: (() => undefined) as any,
    darkTheme: undefined,
    lightTheme: undefined,
    zhCN: undefined,
    dateZhCN: undefined,
    enUS: undefined,
    dateEnUS: undefined,
    useMessage: makeHook<any>(() => ({
      info: () => 0,
      success: () => 0,
      warning: () => 0,
      error: () => 0,
      loading: () => 0,
    })),
    useDialog: makeHook<any>(() => ({})),
    useNotification: makeHook<any>(() => ({})),
    useLoadingBar: makeHook<any>(() => ({
      start: () => {},
      finish: () => {},
      error: () => {},
    })),
  },
  {
    get(target, prop, _receiver) {
      if (prop in target) return (target as any)[prop]
      const keyStr = String(prop)
      // hooks
      if (HOOK_NAMES.has(keyStr)) return makeHook()
      // 类型导出 & 默认导出 — 没在类型层用到
      if (keyStr === 'default') return naiveCompat
      // 其他一律当作组件（命名组件、方便调试）
      const comp = defineComponent({
        name: `NCompat::${keyStr}`,
        inheritAttrs: true,
        setup(_p, { slots, attrs }) {
          return () => h('div', { 'data-naive-noop': keyStr, ...attrs }, slots.default?.())
        },
      })
      // 缓存到 target，避免每次 get 新组件
      ;(target as any)[prop] = comp
      return comp
    },
  }
)

export default naiveCompat
export const {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NNotificationProvider,
  NLoadingBarProvider,
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NLayoutFooter,
  NMenu,
  NButton,
  NButtonGroup,
  NIcon,
  NSpace,
  NCard,
  NGrid,
  NGridItem,
  NGi,
  NStatistic,
  NSkeleton,
  NSpin,
  NCode,
  NForm,
  NFormItem,
  NFormItemGi,
  NInput,
  NInputGroup,
  NInputNumber,
  NSelect,
  NOption,
  NCascader,
  NDatePicker,
  NTimePicker,
  NSwitch,
  NCheckbox,
  NCheckboxGroup,
  NRadio,
  NRadioGroup,
  NRadioButton,
  NSlider,
  NUpload,
  NUploadDragger,
  NDataTable,
  NTable,
  NTh,
  NTr,
  NTd,
  NThead,
  NTbody,
  NPagination,
  NTabs,
  NTabPane,
  NTag,
  NDivider,
  NAvatar,
  NAvatarGroup,
  NPopover,
  NTooltip,
  NPopconfirm,
  NDropdown,
  NDrawer,
  NDrawerContent,
  NModal,
  NDynamicTags,
  NInputTags,
  NScrollbar,
  NText,
  NH1,
  NH2,
  NH3,
  NH4,
  NP,
  NUl,
  NOl,
  NLi,
  NA,
  NBadge,
  NAlert,
  NProgress,
  NResult,
  NEmpty,
  NDescriptions,
  NDescriptionsItem,
  NTimeline,
  NTimelineItem,
  NSteps,
  NStep,
  NBreadcrumb,
  NBreadcrumbItem,
  NRate,
  NColorPicker,
  NMention,
  NTree,
  NImage,
  useMessage,
  useDialog,
  useNotification,
  useLoadingBar,
  create,
  version,
  darkTheme,
  lightTheme,
  zhCN,
  dateZhCN,
} = naiveCompat

// 类型导出（值层面仅需可引用，运行时从未访问这些类型）
export type GlobalThemeOverrides = any
export type TreeOption<T = any> = any
export type UploadFileInfo = any
export type DataTableColumns<T = any> = any[]
export type SelectOption = any
export type UploadCustomRequestOptions = any
export type FormRules = any
export type FormValidationError = any
export type FormValidateCallback = any
export type InputInst = any
export type DialogReactive = any
export type NFormRules = any
export type MenuOption = any
export type UploadFile = any
export type ButtonProps = any

export const __naive_compat__ = true
