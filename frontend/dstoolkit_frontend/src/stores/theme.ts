/**
 * 主题 Store（适配 Element-Plus 新版 tokens）
 *  - 5 套主题：light / dark / ocean / forest / mono
 *  - 持久化：localStorage
 *  - 支持跟随系统：mode = 'auto' 时根据 prefers-color-scheme 在 light/dark 中自动选择
 *  - 暗色主题通过 html.dark class 激活 Element Plus 深色 CSS 变量
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
    selectedId: (localStorage.getItem(STORAGE_KEY) as ThemeId | null) || 'light',
    mode: (localStorage.getItem(MODE_KEY) as ThemeMode) || 'auto',
    systemDark: false,
  }),

  getters: {
    effectiveId(state): ThemeId {
      if (state.mode === 'auto') return state.systemDark ? 'dark' : 'light'
      return state.selectedId
    },
    current(state) {
      const id: ThemeId = state.mode === 'auto'
        ? (state.systemDark ? 'dark' : 'light')
        : state.selectedId
      return THEMES[id]
    },
    list() { return THEME_LIST },
  },

  actions: {
    init() {
      if (typeof window !== 'undefined' && window.matchMedia) {
        const mql = window.matchMedia('(prefers-color-scheme: dark)')
        this.systemDark = mql.matches
        const listener = (e: MediaQueryListEvent) => { this.systemDark = e.matches }
        if (typeof mql.addEventListener === 'function') mql.addEventListener('change', listener)
        else if (typeof (mql as any).addListener === 'function') (mql as any).addListener(listener)
      }
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
    setTheme(id: ThemeId) {
      this.mode = 'manual'
      this.selectedId = id
    },
    setMode(mode: ThemeMode) { this.mode = mode },
    cycleTheme() {
      const ids: ThemeId[] = THEME_LIST.map((t) => t.id)
      const cur = ids.indexOf(this.selectedId)
      const next: ThemeId | undefined = ids[(cur + 1) % ids.length]
      if (next) this.setTheme(next)
    },
    applyToDom() {
      if (typeof document === 'undefined') return
      const theme = this.current
      const html = document.documentElement

      // 1) data-theme：global.css 中按 [data-theme=…] 做额外覆盖
      html.setAttribute('data-theme', theme.id)

      // 2) 暗色主题通过 html.dark 激活 Element Plus 深色变量
      if (theme.isDark) html.classList.add('dark')
      else html.classList.remove('dark')

      // 3) 内联样式：覆盖 :root 的 CSS 变量（含 Element Plus tokens）
      const style = Object.entries(theme.vars)
        .map(([k, v]) => `${k}:${v}`)
        .join(';')
      html.setAttribute('style', style)
    },
  },
})

export function useCurrentThemeMeta() {
  const store = useThemeStore()
  return computed(() => store.current)
}
