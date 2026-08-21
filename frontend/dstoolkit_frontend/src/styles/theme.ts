import type { GlobalThemeOverrides } from 'naive-ui'

// 与 global.css 的 Neu-morphism 主题对齐
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#4d6bfe',
    primaryColorHover: '#6b85fe',
    primaryColorPressed: '#3a56e0',
    primaryColorSuppl: '#4d6bfe',
    borderRadius: '12px',
    borderRadiusSmall: '8px',
    bodyColor: 'transparent',
    cardColor: '#eef1f6',
    modalColor: '#eef1f6',
    popoverColor: '#eef1f6',
    textColorBase: '#2c3e50',
  },
  Card: {
    color: '#eef1f6',
    colorModal: '#eef1f6',
    colorPopover: '#eef1f6',
  },
  Menu: {
    itemColorActive: 'rgba(77,107,254,0.12)',
    itemColorActiveHover: 'rgba(77,107,254,0.16)',
    itemTextColorActive: '#4d6bfe',
    itemTextColorActiveHover: '#4d6bfe',
  },
  Button: {
    textColorPrimary: '#ffffff',
  },
}
