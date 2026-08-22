import type { GlobalThemeOverrides } from 'naive-ui'

// Clarity Design System — NaiveUI 主题对齐
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#4F46E5',
    primaryColorHover: '#6366F1',
    primaryColorPressed: '#4338CA',
    primaryColorSuppl: '#6366F1',
    infoColor: '#0EA5E9',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',

    borderRadius: '12px',
    borderRadiusSmall: '8px',

    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: '14px',

    bodyColor: 'transparent',
    cardColor: '#FFFFFF',
    modalColor: '#FFFFFF',
    popoverColor: '#FFFFFF',

    textColorBase: '#0F172A',
    textColor1: '#0F172A',
    textColor2: '#475569',
    textColor3: '#94A3B8',

    borderColor: '#E2E8F0',
    dividerColor: '#E2E8F0',
  },

  Card: {
    color: '#FFFFFF',
    colorModal: '#FFFFFF',
    colorPopover: '#FFFFFF',
    borderRadius: '16px',
    borderColor: '#E2E8F0',
  },

  Menu: {
    itemColorActive: 'rgba(79, 70, 229, 0.08)',
    itemColorActiveHover: 'rgba(79, 70, 229, 0.12)',
    itemTextColorActive: '#4F46E5',
    itemTextColorActiveHover: '#4F46E5',
    itemIconColorActive: '#4F46E5',
    itemBorderRadius: '10px',
    itemHeightMedium: '40px',
    borderRadius: '12px',
  },

  Button: {
    textColorPrimary: '#ffffff',
    colorPrimary: 'linear-gradient(135deg, #4F46E5 0%, #6366F1 100%)',
    colorHoverPrimary: 'linear-gradient(135deg, #6366F1 0%, #7C3AED 100%)',
    colorPressedPrimary: '#4338CA',
    colorFocusPrimary: '#4F46E5',
    borderPrimary: 'none',
    borderHoverPrimary: 'none',
    borderPressedPrimary: 'none',
    borderFocusPrimary: 'none',
    shadowPrimary: '0 1px 3px rgba(79, 70, 229, 0.25), 0 1px 2px rgba(79, 70, 229, 0.15)',
    shadowHoverPrimary: '0 4px 12px rgba(79, 70, 229, 0.30), 0 2px 4px rgba(79, 70, 229, 0.18)',
    shadowPressedPrimary: '0 1px 2px rgba(79, 70, 229, 0.25)',
    borderRadius: '12px',
    fontWeight: '500',
    paddingSmall: '0 14px',
    paddingMedium: '0 18px',
    paddingLarge: '0 22px',
  },

  Input: {
    border: '1px solid #E2E8F0',
    borderHover: '1px solid #CBD5E1',
    borderFocus: '1px solid #4F46E5',
    boxShadowFocus: '0 0 0 3px rgba(79, 70, 229, 0.12)',
    borderRadius: '10px',
    color: '#FFFFFF',
    colorFocus: '#FFFFFF',
    textColor: '#0F172A',
    placeholderColor: '#94A3B8',
    heightMedium: '40px',
    paddingMedium: '0 14px',
  },

  Select: {
    border: '1px solid #E2E8F0',
    borderHover: '1px solid #CBD5E1',
    borderActive: '1px solid #4F46E5',
    boxShadowActive: '0 0 0 3px rgba(79, 70, 229, 0.12)',
    borderRadius: '10px',
    color: '#FFFFFF',
    heightMedium: '40px',
  },

  Switch: {
    railColorActive: '#4F46E5',
  },

  DataTable: {
    borderColor: '#E2E8F0',
    borderRadius: '12px',
    tdColor: '#FFFFFF',
    thColor: '#F8FAFC',
    thTextColor: '#475569',
    thFontWeight: '600',
    borderColorHorizontal: '#E2E8F0',
  },

  Tag: {
    borderRadius: '999px',
  },

  Modal: {
    borderRadius: '16px',
    boxShadow: '0 16px 48px rgba(15, 23, 42, 0.18), 0 4px 12px rgba(15, 23, 42, 0.08)',
  },

  Drawer: {
    borderRadius: '16px 0 0 16px',
    boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.08)',
  },

  Avatar: {
    borderRadius: '10px',
  },

  Form: {
    labelTextColor: '#475569',
    labelFontWeight: '500',
    labelFontSize: '13px',
    showRequireMark: true,
  },

  Pagination: {
    itemBorderRadius: '8px',
  },

  Statistic: {
    labelTextColor: '#94A3B8',
    valueFontWeight: '700',
  },

  Upload: {
    borderRadius: '12px',
  },
}
