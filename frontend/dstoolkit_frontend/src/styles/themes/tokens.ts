/**
 * Design Tokens — 适配 Element-Plus 的多主题系统
 * 5 套主题：light / dark / ocean / forest / mono
 *
 * 每份主题 token 同时产出：
 *  1) CSS 变量片段（给 global.css / :root[data-theme=…] 使用）
 *  2) ElementPlus ConfigProvider 的基础主题色（兜底；主要实际覆盖走 CSS 变量）
 */

export type ThemeId = 'light' | 'dark' | 'ocean' | 'forest' | 'mono'

/** Element Plus 主题配置（本地声明，避免 import 版本差异） */
export interface ElementPlusThemeConfig {
  token?: {
    colorPrimary?: string
    colorSuccess?: string
    colorWarning?: string
    colorDanger?: string
    colorInfo?: string
    borderRadius?: number | string
    fontFamily?: string
    boxShadow?: string
    [k: string]: unknown
  }
  [k: string]: unknown
}

export interface ThemeMeta {
  id: ThemeId
  label: string
  emoji: string
  /** 是否属于暗色（用于覆盖 ElementPlus 暗色 CSS 变量） */
  isDark: boolean
  /** CSS 变量体（注入到 <html style=…>） */
  vars: Record<string, string>
  /** Element Plus 顶层色板映射（同步到 CSS var 以及通过注入覆盖 ElToken） */
  ep: ElementPlusThemeConfig
}

/* =========================================================
 *  工具：色值处理
 * ========================================================= */
function hexWithAlpha(hex: string, alpha: number): string {
  const clean = hex.replace('#', '').trim()
  let r = 0, g = 0, b = 0
  if (clean.length === 3) {
    const parts = clean.split('')
    r = parseInt((parts[0] ?? '0') + (parts[0] ?? '0'), 16)
    g = parseInt((parts[1] ?? '0') + (parts[1] ?? '0'), 16)
    b = parseInt((parts[2] ?? '0') + (parts[2] ?? '0'), 16)
  } else if (clean.length >= 6) {
    r = parseInt(clean.slice(0, 2) || '00', 16)
    g = parseInt(clean.slice(2, 4) || '00', 16)
    b = parseInt(clean.slice(4, 6) || '00', 16)
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

/* =========================================================
 *  生成 CSS vars
 * ========================================================= */
function buildVars(params: {
  primary: string; primaryHover: string; primaryPressed: string
  primarySoft: string; primarySoftHover: string; primaryGlow: string
  accent: string; accentHover: string; accentSoft: string; accentGlow: string
  success: string; successSoft: string
  warning: string; warningSoft: string
  danger: string; dangerSoft: string
  info: string; infoSoft: string
  bg: string; bg2: string; bg3: string
  surface: string; surfaceHover: string; surface2: string
  border: string; borderStrong: string; borderSubtle: string; borderGlow: string
  text: string; textSecondary: string; textMuted: string; textDisabled: string
  shadowXs: string; shadowSm: string; shadowMd: string; shadowLg: string; shadowFocus: string
  chronoGreen: string; chronoAmber: string
  module1: string; module2: string; module3: string; module4: string; module5: string
  colorScheme: 'light' | 'dark'
}): Record<string, string> {
  return {
    '--primary': params.primary,
    '--primary-hover': params.primaryHover,
    '--primary-pressed': params.primaryPressed,
    '--primary-soft': params.primarySoft,
    '--primary-soft-hover': params.primarySoftHover,
    '--primary-glow': params.primaryGlow,
    '--accent': params.accent,
    '--accent-hover': params.accentHover,
    '--accent-soft': params.accentSoft,
    '--accent-glow': params.accentGlow,
    '--success': params.success,
    '--success-soft': params.successSoft,
    '--warning': params.warning,
    '--warning-soft': params.warningSoft,
    '--danger': params.danger,
    '--danger-soft': params.dangerSoft,
    '--info': params.info,
    '--info-soft': params.infoSoft,
    '--bg': params.bg,
    '--bg-2': params.bg2,
    '--bg-3': params.bg3,
    '--surface': params.surface,
    '--surface-hover': params.surfaceHover,
    '--surface-2': params.surface2,
    '--border': params.border,
    '--border-strong': params.borderStrong,
    '--border-subtle': params.borderSubtle,
    '--border-glow': params.borderGlow,
    '--text': params.text,
    '--text-secondary': params.textSecondary,
    '--text-muted': params.textMuted,
    '--text-disabled': params.textDisabled,
    '--shadow-xs': params.shadowXs,
    '--shadow-sm': params.shadowSm,
    '--shadow-md': params.shadowMd,
    '--shadow-lg': params.shadowLg,
    '--shadow-focus': params.shadowFocus,
    '--radius-sm': '6px',
    '--radius': '10px',
    '--radius-lg': '14px',
    '--radius-xl': '18px',
    '--radius-full': '999px',
    '--space-1': '4px',
    '--space-2': '8px',
    '--space-3': '12px',
    '--space-4': '16px',
    '--space-5': '20px',
    '--space-6': '24px',
    '--space-8': '32px',
    '--space-10': '40px',
    '--space-12': '48px',
    '--ease-out': 'cubic-bezier(0.16, 1, 0.3, 1)',
    '--ease-bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
    '--ease-in-out': 'cubic-bezier(0.65, 0, 0.35, 1)',
    '--transition-fast': '140ms var(--ease-out)',
    '--transition': '220ms var(--ease-out)',
    '--transition-slow': '380ms var(--ease-in-out)',
    '--chrono-green': params.chronoGreen,
    '--chrono-amber': params.chronoAmber,
    '--module-1': params.module1,
    '--module-2': params.module2,
    '--module-3': params.module3,
    '--module-4': params.module4,
    '--module-5': params.module5,

    /* Element Plus 设计令牌覆盖（通过 CSS var 同步） */
    '--el-color-primary': params.primary,
    '--el-color-primary-light-3': params.primaryHover,
    '--el-color-primary-light-5': params.primarySoftHover,
    '--el-color-primary-light-7': params.primarySoft,
    '--el-color-primary-light-8': hexWithAlpha(params.primary, 0.05),
    '--el-color-primary-light-9': hexWithAlpha(params.primary, 0.03),
    '--el-color-primary-dark-2': params.primaryPressed,

    '--el-color-success': params.success,
    '--el-color-success-light-3': '#42D392',
    '--el-color-success-light-5': '#6EE0AA',
    '--el-color-success-light-7': '#9AEDC1',
    '--el-color-success-light-8': '#B8F3D1',
    '--el-color-success-light-9': '#D5F9E4',
    '--el-color-success-dark-2': '#0F9B6D',

    '--el-color-warning': params.warning,
    '--el-color-warning-light-3': '#F7B758',
    '--el-color-warning-light-5': '#F9CB83',
    '--el-color-warning-light-7': '#FBDFAE',
    '--el-color-warning-light-8': '#FCE9C4',
    '--el-color-warning-light-9': '#FDF3DA',
    '--el-color-warning-dark-2': '#C77D09',

    '--el-color-danger': params.danger,
    '--el-color-danger-light-3': '#F57E7E',
    '--el-color-danger-light-5': '#F8A6A6',
    '--el-color-danger-light-7': '#FBCFCF',
    '--el-color-danger-light-8': '#FCE2E2',
    '--el-color-danger-light-9': '#FDF5F5',
    '--el-color-danger-dark-2': '#BF3535',

    '--el-color-info': params.info,
    '--el-color-info-light-3': '#67A4F8',
    '--el-color-info-light-5': '#93BFF9',
    '--el-color-info-light-7': '#BEDAFA',
    '--el-color-info-light-8': '#D4E8FB',
    '--el-color-info-light-9': '#EAF5FD',
    '--el-color-info-dark-2': '#1F4FBF',

    '--el-bg-color': params.surface,
    '--el-bg-color-page': params.bg,
    '--el-bg-color-overlay': params.surface,

    '--el-text-color-primary': params.text,
    '--el-text-color-regular': params.textSecondary,
    '--el-text-color-secondary': params.textMuted,
    '--el-text-color-placeholder': params.textMuted,
    '--el-text-color-disabled': params.textDisabled,

    '--el-border-color': params.border,
    '--el-border-color-light': params.borderSubtle,
    '--el-border-color-lighter': params.borderSubtle,
    '--el-border-color-strong': params.borderStrong,
    '--el-border-color-hover': params.primary,

    '--el-fill-color': params.surface2,
    '--el-fill-color-light': params.bg,
    '--el-fill-color-lighter': params.bg2,
    '--el-fill-color-blank': params.surface,

    '--el-border-radius-base': '10px',
    '--el-border-radius-small': '8px',
    '--el-border-radius-round': '999px',

    '--el-box-shadow-light': params.shadowSm,
    '--el-box-shadow': params.shadowMd,
    '--el-box-shadow-dark': params.shadowLg,

    '--el-font-family': 'var(--font-family-harmony)',
    '--el-font-size-base': '14px',

    colorScheme: params.colorScheme,
  }
}

/* =========================================================
 *  生成 Element Plus ThemeConfig（供 ElConfigProvider 使用）
 *  实际覆盖主要走 CSS 变量，这里只提供基础色值兜底
 * ========================================================= */
function buildEpConfig(params: {
  primary: string; success: string; warning: string; danger: string; info: string
}): ElementPlusThemeConfig {
  return {
    token: {
      colorPrimary: params.primary,
      colorSuccess: params.success,
      colorWarning: params.warning,
      colorDanger: params.danger,
      colorInfo: params.info,
      borderRadius: 10,
      fontFamily: 'var(--font-family-harmony)',
      boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)',
    },
  }
}

/* =========================================================
 *  Theme #1 — Light · 纯净白日（默认）
 * ========================================================= */
const lightTheme: ThemeMeta = {
  id: 'light',
  label: '白日',
  emoji: '☀️',
  isDark: false,
  vars: buildVars({
    primary: '#4F46E5', primaryHover: '#6366F1', primaryPressed: '#4338CA',
    primarySoft: 'rgba(79, 70, 229, 0.08)',
    primarySoftHover: 'rgba(79, 70, 229, 0.14)',
    primaryGlow: '0 0 0 1px rgba(79, 70, 229, 0.18), 0 4px 12px rgba(79, 70, 229, 0.15)',
    accent: '#0EA5E9', accentHover: '#38BDF8',
    accentSoft: 'rgba(14, 165, 233, 0.08)',
    accentGlow: '0 4px 14px rgba(14, 165, 233, 0.18)',
    success: '#10B981', successSoft: 'rgba(16, 185, 129, 0.08)',
    warning: '#F59E0B', warningSoft: 'rgba(245, 158, 11, 0.08)',
    danger: '#EF4444', dangerSoft: 'rgba(239, 68, 68, 0.08)',
    info: '#3B82F6', infoSoft: 'rgba(59, 130, 246, 0.08)',
    bg: '#F8FAFC', bg2: '#F1F5F9', bg3: '#E2E8F0',
    surface: '#FFFFFF', surfaceHover: '#F8FAFC', surface2: '#F8FAFC',
    border: '#E2E8F0', borderStrong: '#CBD5E1', borderSubtle: '#F1F5F9',
    borderGlow: 'rgba(79, 70, 229, 0.35)',
    text: '#0F172A', textSecondary: '#475569', textMuted: '#94A3B8', textDisabled: '#CBD5E1',
    shadowXs: '0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.03)',
    shadowSm: '0 2px 6px rgba(15, 23, 42, 0.06), 0 0 0 1px rgba(15, 23, 42, 0.03)',
    shadowMd: '0 6px 18px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)',
    shadowLg: '0 14px 40px rgba(15, 23, 42, 0.10), 0 0 0 1px rgba(15, 23, 42, 0.04)',
    shadowFocus: '0 0 0 3px rgba(79, 70, 229, 0.15)',
    chronoGreen: '#10B981', chronoAmber: '#F59E0B',
    module1: '#4F46E5', module2: '#0EA5E9', module3: '#10B981', module4: '#F59E0B', module5: '#EF4444',
    colorScheme: 'light',
  }),
  ep: buildEpConfig({ primary: '#4F46E5', success: '#10B981', warning: '#F59E0B', danger: '#EF4444', info: '#3B82F6' }),
}

/* =========================================================
 *  Theme #2 — Dark · 深夜水墨（暗色）
 * ========================================================= */
const darkTheme: ThemeMeta = {
  id: 'dark',
  label: '深夜',
  emoji: '🌙',
  isDark: true,
  vars: buildVars({
    primary: '#818CF8', primaryHover: '#A5B4FC', primaryPressed: '#6366F1',
    primarySoft: 'rgba(129, 140, 248, 0.14)',
    primarySoftHover: 'rgba(129, 140, 248, 0.22)',
    primaryGlow: '0 0 0 1px rgba(129, 140, 248, 0.28), 0 4px 14px rgba(129, 140, 248, 0.22)',
    accent: '#22D3EE', accentHover: '#67E8F9',
    accentSoft: 'rgba(34, 211, 238, 0.14)',
    accentGlow: '0 4px 14px rgba(34, 211, 238, 0.22)',
    success: '#34D399', successSoft: 'rgba(52, 211, 153, 0.14)',
    warning: '#FBBF24', warningSoft: 'rgba(251, 191, 36, 0.14)',
    danger: '#F87171', dangerSoft: 'rgba(248, 113, 113, 0.14)',
    info: '#60A5FA', infoSoft: 'rgba(96, 165, 250, 0.14)',
    bg: '#0B1020', bg2: '#111831', bg3: '#1E293B',
    surface: '#111827', surfaceHover: '#162038', surface2: '#0F172A',
    border: '#1F2A44', borderStrong: '#334155', borderSubtle: '#172033',
    borderGlow: 'rgba(129, 140, 248, 0.45)',
    text: '#E2E8F0', textSecondary: '#94A3B8', textMuted: '#64748B', textDisabled: '#334155',
    shadowXs: '0 1px 2px rgba(0, 0, 0, 0.35), 0 0 0 1px rgba(255, 255, 255, 0.03)',
    shadowSm: '0 2px 6px rgba(0, 0, 0, 0.40), 0 0 0 1px rgba(255, 255, 255, 0.04)',
    shadowMd: '0 6px 18px rgba(0, 0, 0, 0.50), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    shadowLg: '0 14px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.05)',
    shadowFocus: '0 0 0 3px rgba(129, 140, 248, 0.22)',
    chronoGreen: '#34D399', chronoAmber: '#FBBF24',
    module1: '#818CF8', module2: '#22D3EE', module3: '#34D399', module4: '#FBBF24', module5: '#F87171',
    colorScheme: 'dark',
  }),
  ep: buildEpConfig({ primary: '#818CF8', success: '#34D399', warning: '#FBBF24', danger: '#F87171', info: '#60A5FA' }),
}

/* =========================================================
 *  Theme #3 — Ocean · 海盐薄荷
 * ========================================================= */
const oceanTheme: ThemeMeta = {
  id: 'ocean',
  label: '海盐',
  emoji: '🌊',
  isDark: false,
  vars: buildVars({
    primary: '#0891B2', primaryHover: '#06B6D4', primaryPressed: '#0E7490',
    primarySoft: 'rgba(8, 145, 178, 0.08)',
    primarySoftHover: 'rgba(8, 145, 178, 0.14)',
    primaryGlow: '0 0 0 1px rgba(8, 145, 178, 0.20), 0 4px 12px rgba(8, 145, 178, 0.16)',
    accent: '#14B8A6', accentHover: '#2DD4BF',
    accentSoft: 'rgba(20, 184, 166, 0.08)',
    accentGlow: '0 4px 14px rgba(20, 184, 166, 0.18)',
    success: '#10B981', successSoft: 'rgba(16, 185, 129, 0.08)',
    warning: '#F59E0B', warningSoft: 'rgba(245, 158, 11, 0.08)',
    danger: '#F43F5E', dangerSoft: 'rgba(244, 63, 94, 0.08)',
    info: '#0EA5E9', infoSoft: 'rgba(14, 165, 233, 0.08)',
    bg: '#F0F9FB', bg2: '#E0F2F7', bg3: '#C4E5EE',
    surface: '#FFFFFF', surfaceHover: '#F4FBFC', surface2: '#F0F9FB',
    border: '#C5E1E9', borderStrong: '#9ECAD8', borderSubtle: '#DFF1F6',
    borderGlow: 'rgba(8, 145, 178, 0.35)',
    text: '#0C2733', textSecondary: '#3E5C6B', textMuted: '#7A95A2', textDisabled: '#B4CBD4',
    shadowXs: '0 1px 2px rgba(12, 39, 51, 0.04), 0 0 0 1px rgba(12, 39, 51, 0.03)',
    shadowSm: '0 2px 6px rgba(12, 39, 51, 0.06), 0 0 0 1px rgba(12, 39, 51, 0.03)',
    shadowMd: '0 6px 18px rgba(12, 39, 51, 0.08), 0 0 0 1px rgba(12, 39, 51, 0.04)',
    shadowLg: '0 14px 40px rgba(12, 39, 51, 0.10), 0 0 0 1px rgba(12, 39, 51, 0.04)',
    shadowFocus: '0 0 0 3px rgba(8, 145, 178, 0.16)',
    chronoGreen: '#10B981', chronoAmber: '#F59E0B',
    module1: '#0891B2', module2: '#14B8A6', module3: '#0EA5E9', module4: '#8B5CF6', module5: '#F43F5E',
    colorScheme: 'light',
  }),
  ep: buildEpConfig({ primary: '#0891B2', success: '#10B981', warning: '#F59E0B', danger: '#F43F5E', info: '#0EA5E9' }),
}

/* =========================================================
 *  Theme #4 — Forest · 森系抹茶
 * ========================================================= */
const forestTheme: ThemeMeta = {
  id: 'forest',
  label: '抹茶',
  emoji: '🌿',
  isDark: false,
  vars: buildVars({
    primary: '#059669', primaryHover: '#10B981', primaryPressed: '#047857',
    primarySoft: 'rgba(5, 150, 105, 0.08)',
    primarySoftHover: 'rgba(5, 150, 105, 0.14)',
    primaryGlow: '0 0 0 1px rgba(5, 150, 105, 0.20), 0 4px 12px rgba(5, 150, 105, 0.16)',
    accent: '#84CC16', accentHover: '#A3E635',
    accentSoft: 'rgba(132, 204, 22, 0.08)',
    accentGlow: '0 4px 14px rgba(132, 204, 22, 0.18)',
    success: '#059669', successSoft: 'rgba(5, 150, 105, 0.08)',
    warning: '#D97706', warningSoft: 'rgba(217, 119, 6, 0.08)',
    danger: '#DC2626', dangerSoft: 'rgba(220, 38, 38, 0.08)',
    info: '#0284C7', infoSoft: 'rgba(2, 132, 199, 0.08)',
    bg: '#F4F8F0', bg2: '#E8F1DD', bg3: '#D0E3BD',
    surface: '#FFFFFF', surfaceHover: '#F7FAF1', surface2: '#F4F8F0',
    border: '#CBDFC0', borderStrong: '#A6C794', borderSubtle: '#E6F0D8',
    borderGlow: 'rgba(5, 150, 105, 0.35)',
    text: '#1A2E10', textSecondary: '#3F5A33', textMuted: '#7D8F71', textDisabled: '#B8C6AC',
    shadowXs: '0 1px 2px rgba(26, 46, 16, 0.04), 0 0 0 1px rgba(26, 46, 16, 0.03)',
    shadowSm: '0 2px 6px rgba(26, 46, 16, 0.06), 0 0 0 1px rgba(26, 46, 16, 0.03)',
    shadowMd: '0 6px 18px rgba(26, 46, 16, 0.08), 0 0 0 1px rgba(26, 46, 16, 0.04)',
    shadowLg: '0 14px 40px rgba(26, 46, 16, 0.10), 0 0 0 1px rgba(26, 46, 16, 0.04)',
    shadowFocus: '0 0 0 3px rgba(5, 150, 105, 0.16)',
    chronoGreen: '#10B981', chronoAmber: '#D97706',
    module1: '#059669', module2: '#84CC16', module3: '#0284C7', module4: '#D97706', module5: '#DC2626',
    colorScheme: 'light',
  }),
  ep: buildEpConfig({ primary: '#059669', success: '#059669', warning: '#D97706', danger: '#DC2626', info: '#0284C7' }),
}

/* =========================================================
 *  Theme #5 — Mono · 极简灰白
 * ========================================================= */
const monoTheme: ThemeMeta = {
  id: 'mono',
  label: '极简',
  emoji: '◼️',
  isDark: false,
  vars: buildVars({
    primary: '#18181B', primaryHover: '#3F3F46', primaryPressed: '#09090B',
    primarySoft: 'rgba(24, 24, 27, 0.06)',
    primarySoftHover: 'rgba(24, 24, 27, 0.12)',
    primaryGlow: '0 0 0 1px rgba(24, 24, 27, 0.18), 0 4px 12px rgba(24, 24, 27, 0.12)',
    accent: '#52525B', accentHover: '#71717A',
    accentSoft: 'rgba(82, 82, 91, 0.08)',
    accentGlow: '0 4px 14px rgba(82, 82, 91, 0.16)',
    success: '#16A34A', successSoft: 'rgba(22, 163, 74, 0.08)',
    warning: '#CA8A04', warningSoft: 'rgba(202, 138, 4, 0.08)',
    danger: '#DC2626', dangerSoft: 'rgba(220, 38, 38, 0.08)',
    info: '#2563EB', infoSoft: 'rgba(37, 99, 235, 0.08)',
    bg: '#FAFAFA', bg2: '#F4F4F5', bg3: '#E4E4E7',
    surface: '#FFFFFF', surfaceHover: '#FAFAFA', surface2: '#FAFAFA',
    border: '#E4E4E7', borderStrong: '#D4D4D8', borderSubtle: '#F4F4F5',
    borderGlow: 'rgba(24, 24, 27, 0.30)',
    text: '#18181B', textSecondary: '#52525B', textMuted: '#A1A1AA', textDisabled: '#D4D4D8',
    shadowXs: '0 1px 2px rgba(24, 24, 27, 0.04), 0 0 0 1px rgba(24, 24, 27, 0.03)',
    shadowSm: '0 2px 6px rgba(24, 24, 27, 0.05), 0 0 0 1px rgba(24, 24, 27, 0.03)',
    shadowMd: '0 6px 18px rgba(24, 24, 27, 0.07), 0 0 0 1px rgba(24, 24, 27, 0.04)',
    shadowLg: '0 14px 40px rgba(24, 24, 27, 0.10), 0 0 0 1px rgba(24, 24, 27, 0.04)',
    shadowFocus: '0 0 0 3px rgba(24, 24, 27, 0.12)',
    chronoGreen: '#16A34A', chronoAmber: '#CA8A04',
    module1: '#18181B', module2: '#52525B', module3: '#2563EB', module4: '#CA8A04', module5: '#DC2626',
    colorScheme: 'light',
  }),
  ep: buildEpConfig({ primary: '#18181B', success: '#16A34A', warning: '#CA8A04', danger: '#DC2626', info: '#2563EB' }),
}

export const THEMES: Record<ThemeId, ThemeMeta> = {
  light: lightTheme,
  dark: darkTheme,
  ocean: oceanTheme,
  forest: forestTheme,
  mono: monoTheme,
}

export const THEME_LIST: ThemeMeta[] = [
  lightTheme, darkTheme, oceanTheme, forestTheme, monoTheme,
]

export function themeVarsToCss(vars: Record<string, string>): string {
  return Object.entries(vars)
    .map(([k, v]) => `  ${k}: ${v};`)
    .join('\n')
}
