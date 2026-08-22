import type { GlobalThemeOverrides } from 'naive-ui'

// Deepseek Toolkit — NaiveUI 浅色主题对齐
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#4F46E5',
    primaryColorHover: '#6366F1',
    primaryColorPressed: '#4338CA',
    primaryColorSuppl: '#0EA5E9',
    infoColor: '#3B82F6',
    successColor: '#10B981',
    warningColor: '#F59E0B',
    errorColor: '#EF4444',

    borderRadius: '10px',
    borderRadiusSmall: '6px',

    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Arial, sans-serif",
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
    dividerColor: '#F1F5F9',
  },

  Card: {
    color: '#FFFFFF',
    colorModal: '#FFFFFF',
    colorPopover: '#FFFFFF',
    borderRadius: '14px',
    borderColor: '#E2E8F0',
    boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04), 0 0 0 1px rgba(15, 23, 42, 0.03)',
  },

  Menu: {
    itemColorActive: 'rgba(79, 70, 229, 0.08)',
    itemColorActiveHover: 'rgba(79, 70, 229, 0.12)',
    itemTextColorActive: '#4F46E5',
    itemTextColorActiveHover: '#6366F1',
    itemIconColorActive: '#4F46E5',
    itemBorderRadius: '10px',
    itemHeightMedium: '42px',
    borderRadius: '12px',
    color: 'transparent',
    textColor: '#64748B',
    textColorHover: '#0F172A',
  },

  Button: {
    textColorPrimary: '#FFFFFF',
    colorPrimary: 'linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%)',
    colorHoverPrimary: 'linear-gradient(135deg, #6366F1 0%, #38BDF8 100%)',
    colorPressedPrimary: '#4338CA',
    colorFocusPrimary: '#4F46E5',
    borderPrimary: 'none',
    borderHoverPrimary: 'none',
    borderPressedPrimary: 'none',
    borderFocusPrimary: 'none',
    shadowPrimary: '0 4px 12px rgba(79, 70, 229, 0.25)',
    shadowHoverPrimary: '0 6px 18px rgba(79, 70, 229, 0.30)',
    shadowPressedPrimary: '0 1px 2px rgba(79, 70, 229, 0.25)',

    textColorDefault: '#475569',
    colorDefault: '#FFFFFF',
    colorHoverDefault: '#F8FAFC',
    borderDefault: '1px solid #E2E8F0',
    borderHoverDefault: '1px solid #CBD5E1',

    borderRadius: '10px',
    fontWeight: '600',
    paddingSmall: '0 14px',
    paddingMedium: '0 18px',
    paddingLarge: '0 22px',
  },

  Input: {
    border: '1px solid #E2E8F0',
    borderHover: '1px solid #CBD5E1',
    borderFocus: '1px solid #4F46E5',
    boxShadowFocus: '0 0 0 3px rgba(79, 70, 229, 0.15)',
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
    boxShadowActive: '0 0 0 3px rgba(79, 70, 229, 0.15)',
    borderRadius: '10px',
    color: '#FFFFFF',
    heightMedium: '40px',
    textColor: '#0F172A',
    placeholderColor: '#94A3B8',
  },

  Switch: {
    railColorActive: '#4F46E5',
    boxShadowFocus: '0 0 0 3px rgba(79, 70, 229, 0.15)',
  },

  DataTable: {
    borderColor: '#E2E8F0',
    borderRadius: '12px',
    tdColor: '#FFFFFF',
    thColor: '#F8FAFC',
    thTextColor: '#4F46E5',
    thFontWeight: '700',
    borderColorHorizontal: '#F1F5F9',
    textColor: '#0F172A',
  },

  Tag: {
    borderRadius: '999px',
  },

  Modal: {
    borderRadius: '18px',
    boxShadow: '0 16px 48px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(15, 23, 42, 0.04)',
    color: '#FFFFFF',
    textColor: '#0F172A',
    headerBorder: '1px solid #F1F5F9',
    footerBorder: '1px solid #F1F5F9',
  },

  Drawer: {
    borderRadius: '16px 0 0 16px',
    boxShadow: '-8px 0 24px rgba(15, 23, 42, 0.08)',
    color: '#FFFFFF',
    textColor: '#0F172A',
  },

  Avatar: {
    borderRadius: '10px',
  },

  Form: {
    labelTextColor: '#475569',
    labelFontWeight: '600',
    labelFontSize: '13px',
    showRequireMark: true,
    asteriskColor: '#EF4444',
  },

  Pagination: {
    itemBorderRadius: '8px',
    color: '#FFFFFF',
    itemTextColor: '#64748B',
    buttonColor: '#FFFFFF',
    border: '1px solid #E2E8F0',
    itemColorActive: 'linear-gradient(135deg, #4F46E5 0%, #0EA5E9 100%)',
    itemTextColorActive: '#FFFFFF',
  },

  Statistic: {
    labelTextColor: '#94A3B8',
    valueFontWeight: '800',
    valueTextColor: '#0F172A',
    valueFontSize: '26px',
  },

  Upload: {
    borderRadius: '12px',
  },

  Badge: {
    color: '#EF4444',
  },

  Checkbox: {
    color: '#4F46E5',
    colorFocus: '#4F46E5',
    checkMarkColor: '#FFFFFF',
    boxShadowFocus: '0 0 0 3px rgba(79, 70, 229, 0.15)',
  },

  Radio: {
    buttonColorActive: '#4F46E5',
    buttonBoxShadowFocus: '0 0 0 3px rgba(79, 70, 229, 0.15)',
  },

  Scrollbar: {
    color: '#CBD5E1',
    colorHover: '#94A3B8',
  },

  Dropdown: {
    color: '#FFFFFF',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08), 0 0 0 1px rgba(15, 23, 42, 0.04)',
    borderColor: '#E2E8F0',
    textColor: '#0F172A',
    textColorHover: '#4F46E5',
    colorHover: 'rgba(79, 70, 229, 0.06)',
    prefixColor: '#4F46E5',
    dividerColor: '#F1F5F9',
  },

  Tabs: {
    tabColor: '#64748B',
    tabTextColor: '#64748B',
    tabTextColorActive: '#4F46E5',
    tabTextColorHover: '#0F172A',
    barColor: 'linear-gradient(90deg, #4F46E5 0%, #0EA5E9 100%)',
  },

  Tooltip: {
    color: '#0F172A',
    textColor: '#FFFFFF',
    boxShadow: '0 4px 16px rgba(15, 23, 42, 0.12)',
    borderRadius: '10px',
  },

  Message: {
    color: '#FFFFFF',
    textColor: '#0F172A',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(15, 23, 42, 0.10)',
  },

  Dialog: {
    color: '#FFFFFF',
    textColor: '#0F172A',
    borderRadius: '16px',
    boxShadow: '0 16px 48px rgba(15, 23, 42, 0.14), 0 0 0 1px rgba(15, 23, 42, 0.04)',
  },

  DatePicker: {
    panelColor: '#FFFFFF',
    textColor: '#0F172A',
    borderRadius: '14px',
    boxShadow: '0 10px 30px rgba(15, 23, 42, 0.10)',
  },

  LoadingBar: {
    colorLoading: 'linear-gradient(90deg, #4F46E5 0%, #0EA5E9 50%, #10B981 100%)',
    height: '3px',
  },
}
