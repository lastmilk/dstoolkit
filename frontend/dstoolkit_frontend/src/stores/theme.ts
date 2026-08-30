/**
 * 主题 Store
 *  - 5 套主题：light / dark / ocean / forest / mono
 *  - 持久化：localStorage
 *  - 支持跟随系统：mode = 'auto' 时根据 prefers-color-scheme 在 light/dark 中自动选择
 */
import { defineStore } from 'pinia'
import { computed, watch } from 'vue'
import type { ThemeId } from '@/styles/themes/tokens'
import { THEMES, THEME_LIST } from '@/styles/themes/tokens'

const STORAGE_KEY = 'dstoolkit_theme'
const MODE_KEY = 'dstoolkit_theme_mode'

export type ThemeMode = 'auto' | 'manual'

export const useThemeStore = defineStore('theme', {
  state: () => ({
    /** 手动选择的主题 */
    selectedId: (localStorage.getItem(STORAGE_KEY) as ThemeId | null) || 'light',
    /** 模式：auto 会根据系统偏好，在 light / dark 二选；manual 使用 selectedId */
    mode: (localStorage.getItem(MODE_KEY) as ThemeMode) || 'auto',
    /** 系统是否偏好暗色 */
    systemDark: false,
  }),

  getters: {
    /** 当前生效的主题 id（考虑 auto 模式） */
    effectiveId(state): ThemeId {
      if (state.mode === 'auto') {
        return state.systemDark ? 'dark' : 'light'
      }
      return state.selectedId
    },

    /** 当前生效主题的完整 meta */
    current(state) {
      // 用 state 直接取，避免 getter 之间互相访问导致 TS 推导出「函数类型」
      const id: ThemeId = state.mode === 'auto'
        ? (state.systemDark ? 'dark' : 'light')
        : state.selectedId
      return THEMES[id]
    },

    /** 所有主题清单（UI 切换使用） */
    list() {
      return THEME_LIST
    },
  },

  actions: {
    /** 初始化：注入系统暗色监听；同步应用到 DOM */
    init() {
      // 初始化系统暗色状态
      if (typeof window !== 'undefined' && window.matchMedia) {
        const mql = window.matchMedia('(prefers-color-scheme: dark)')
        this.systemDark = mql.matches

        const listener = (e: MediaQueryListEvent) => {
          this.systemDark = e.matches
        }
        if (typeof mql.addEventListener === 'function') {
          mql.addEventListener('change', listener)
        } else if (typeof (mql as any).addListener === 'function') {
          // Safari < 14 兼容
          ;(mql as any).addListener(listener)
        }
      }

      // 任何时候状态变化 → 同步到 DOM + 持久化
      watch(
        () => [this.mode, this.selectedId, this.systemDark] as const,
        () => {
          this.applyToDom()
          if (this.selectedId) localStorage.setItem(STORAGE_KEY, this.selectedId)
          if (this.mode) localStorage.setItem(MODE_KEY, this.mode)
        },
        { immediate: true }
      )
    },

    /** 切换主题（mode 自动变为 manual） */
    setTheme(id: ThemeId) {
      this.mode = 'manual'
      this.selectedId = id
    },

    /** 切换模式 */
    setMode(mode: ThemeMode) {
      this.mode = mode
    },

    /** 循环切换（移动端一键切换用） */
    cycleTheme() {
      const ids: ThemeId[] = THEME_LIST.map((t) => t.id)
      const cur = ids.indexOf(this.selectedId)
      const next: ThemeId | undefined = ids[(cur + 1) % ids.length]
      if (next) this.setTheme(next)
    },

    /** 将当前主题应用到 <html data-theme=… theme-mode=… style=…> */
    applyToDom() {
      if (typeof document === 'undefined') return
      const theme = this.current
      const html = document.documentElement

      // 1) data-theme：global.css 中按 [data-theme=…] 做额外覆盖
      html.setAttribute('data-theme', theme.id)

      // 2) theme-mode：启用 TDesign 内置暗色模式（仅暗色主题设置）
      if (theme.dark) {
        html.setAttribute('theme-mode', 'dark')
      } else {
        html.removeAttribute('theme-mode')
      }

      // 3) 内联样式：覆盖 :root 的 CSS 变量（应用侧 + TDesign）
      const style = Object.entries(theme.vars)
        .map(([k, v]) => `${k}:${v}`)
        .join(';')
      html.setAttribute('style', style)
    },
  },
})

/** 导出以便外部在 store 之外立刻拿到 computed 响应式的 ThemeMeta */
export function useCurrentThemeMeta() {
  const store = useThemeStore()
  return computed(() => store.current)
}
