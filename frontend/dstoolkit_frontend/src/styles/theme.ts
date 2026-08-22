import type { GlobalThemeOverrides } from 'naive-ui'

// Chronos Design System — NaiveUI 主题对齐 · 未来时间管理局
export const themeOverrides: GlobalThemeOverrides = {
  common: {
    primaryColor: '#00D4FF',
    primaryColorHover: '#4DE8FF',
    primaryColorPressed: '#00A8CC',
    primaryColorSuppl: '#A855F7',
    infoColor: '#00D4FF',
    successColor: '#22FF9A',
    warningColor: '#FFB547',
    errorColor: '#FF4D6D',

    borderRadius: '12px',
    borderRadiusSmall: '8px',

    fontFamily: "'Space Grotesk', 'JetBrains Mono', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif",
    fontSize: '14px',

    bodyColor: 'transparent',
    cardColor: '#111A35',
    modalColor: '#111A35',
    popoverColor: '#111A35',

    textColorBase: '#E8F7FF',
    textColor1: '#E8F7FF',
    textColor2: '#8DB3D4',
    textColor3: '#5A7DA3',

    borderColor: 'rgba(0, 212, 255, 0.14)',
    dividerColor: 'rgba(0, 212, 255, 0.12)',
  },

  Card: {
    color: '#111A35',
    colorModal: '#111A35',
    colorPopover: '#111A35',
    borderRadius: '16px',
    borderColor: 'rgba(0, 212, 255, 0.14)',
    boxShadow: '0 2px 6px rgba(0, 0, 0, 0.5), 0 0 24px rgba(0, 212, 255, 0.05)',
  },

  Menu: {
    itemColorActive: 'rgba(0, 212, 255, 0.12)',
    itemColorActiveHover: 'rgba(0, 212, 255, 0.18)',
    itemTextColorActive: '#00D4FF',
    itemTextColorActiveHover: '#4DE8FF',
    itemIconColorActive: '#00D4FF',
    itemBorderRadius: '10px',
    itemHeightMedium: '42px',
    borderRadius: '12px',
    color: 'transparent',
    textColor: '#8DB3D4',
    textColorHover: '#E8F7FF',
  },

  Button: {
    textColorPrimary: '#04101F',
    colorPrimary: 'linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)',
    colorHoverPrimary: 'linear-gradient(135deg, #4DE8FF 0%, #C084FC 100%)',
    colorPressedPrimary: '#00A8CC',
    colorFocusPrimary: '#00D4FF',
    borderPrimary: 'none',
    borderHoverPrimary: 'none',
    borderPressedPrimary: 'none',
    borderFocusPrimary: 'none',
    shadowPrimary:
      '0 0 0 1px rgba(0, 212, 255, 0.35), 0 2px 10px rgba(0, 212, 255, 0.35), 0 1px 3px rgba(168, 85, 247, 0.25)',
    shadowHoverPrimary:
      '0 0 0 1px rgba(0, 212, 255, 0.55), 0 6px 24px rgba(0, 212, 255, 0.45), 0 2px 6px rgba(168, 85, 247, 0.35)',
    shadowPressedPrimary: '0 1px 2px rgba(0, 212, 255, 0.3)',

    textColorDefault: '#8DB3D4',
    colorDefault: 'rgba(0, 212, 255, 0.04)',
    colorHoverDefault: 'rgba(0, 212, 255, 0.1)',
    borderDefault: '1px solid rgba(0, 212, 255, 0.14)',
    borderHoverDefault: '1px solid rgba(0, 212, 255, 0.28)',

    borderRadius: '12px',
    fontWeight: '600',
    paddingSmall: '0 14px',
    paddingMedium: '0 18px',
    paddingLarge: '0 22px',
  },

  Input: {
    border: '1px solid rgba(0, 212, 255, 0.14)',
    borderHover: '1px solid rgba(0, 212, 255, 0.28)',
    borderFocus: '1px solid rgba(0, 212, 255, 0.55)',
    boxShadowFocus: '0 0 0 2px rgba(0, 212, 255, 0.35), 0 0 24px rgba(0, 212, 255, 0.15)',
    borderRadius: '10px',
    color: '#0D162E',
    colorFocus: '#0D162E',
    textColor: '#E8F7FF',
    placeholderColor: '#5A7DA3',
    heightMedium: '40px',
    paddingMedium: '0 14px',
  },

  Select: {
    border: '1px solid rgba(0, 212, 255, 0.14)',
    borderHover: '1px solid rgba(0, 212, 255, 0.28)',
    borderActive: '1px solid rgba(0, 212, 255, 0.55)',
    boxShadowActive: '0 0 0 2px rgba(0, 212, 255, 0.35), 0 0 24px rgba(0, 212, 255, 0.15)',
    borderRadius: '10px',
    color: '#0D162E',
    heightMedium: '40px',
    textColor: '#E8F7FF',
    placeholderColor: '#5A7DA3',
  },

  Switch: {
    railColorActive: '#00D4FF',
    boxShadowFocus: '0 0 0 2px rgba(0, 212, 255, 0.35)',
  },

  DataTable: {
    borderColor: 'rgba(0, 212, 255, 0.14)',
    borderRadius: '12px',
    tdColor: '#111A35',
    thColor: '#0D162E',
    thTextColor: '#00D4FF',
    thFontWeight: '700',
    borderColorHorizontal: 'rgba(0, 212, 255, 0.10)',
    textColor: '#E8F7FF',
  },

  Tag: {
    borderRadius: '999px',
  },

  Modal: {
    borderRadius: '20px',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65), 0 0 60px rgba(0, 212, 255, 0.15)',
    color: '#111A35',
    textColor: '#E8F7FF',
    headerBorder: '1px solid rgba(0, 212, 255, 0.10)',
    footerBorder: '1px solid rgba(0, 212, 255, 0.10)',
  },

  Drawer: {
    borderRadius: '16px 0 0 16px',
    boxShadow: '-8px 0 24px rgba(0, 0, 0, 0.55)',
    color: '#0F1A36',
    textColor: '#E8F7FF',
  },

  Avatar: {
    borderRadius: '10px',
  },

  Form: {
    labelTextColor: '#8DB3D4',
    labelFontWeight: '600',
    labelFontSize: '13px',
    showRequireMark: true,
    asteriskColor: '#FF4D6D',
  },

  Pagination: {
    itemBorderRadius: '8px',
    color: 'rgba(0, 212, 255, 0.04)',
    itemTextColor: '#8DB3D4',
    buttonColor: 'rgba(0, 212, 255, 0.04)',
    border: '1px solid rgba(0, 212, 255, 0.10)',
    itemColorActive: 'linear-gradient(135deg, #00D4FF 0%, #A855F7 100%)',
    itemTextColorActive: '#04101F',
  },

  Statistic: {
    labelTextColor: '#5A7DA3',
    valueFontWeight: '800',
    valueTextColor: '#E8F7FF',
    valueFontSize: '26px',
  },

  Upload: {
    borderRadius: '12px',
  },

  Badge: {
    color: '#FF4D6D',
  },

  Checkbox: {
    color: '#00D4FF',
    colorFocus: '#00D4FF',
    checkMarkColor: '#04101F',
    boxShadowFocus: '0 0 0 2px rgba(0, 212, 255, 0.35)',
  },

  Radio: {
    buttonColorActive: '#00D4FF',
    buttonBoxShadowFocus: '0 0 0 2px rgba(0, 212, 255, 0.35)',
  },

  Scrollbar: {
    color: 'linear-gradient(180deg, rgba(0, 212, 255, 0.35) 0%, rgba(168, 85, 247, 0.35) 100%)',
    colorHover: 'linear-gradient(180deg, rgba(0, 212, 255, 0.6) 0%, rgba(168, 85, 247, 0.6) 100%)',
  },

  Dropdown: {
    color: '#111A35',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 212, 255, 0.08)',
    borderColor: 'rgba(0, 212, 255, 0.14)',
    textColor: '#E8F7FF',
    textColorHover: '#00D4FF',
    colorHover: 'rgba(0, 212, 255, 0.10)',
    prefixColor: '#00D4FF',
    dividerColor: 'rgba(0, 212, 255, 0.10)',
  },

  Tabs: {
    tabColor: '#8DB3D4',
    tabTextColor: '#8DB3D4',
    tabTextColorActive: '#00D4FF',
    tabTextColorHover: '#E8F7FF',
    barColor: 'linear-gradient(90deg, #00D4FF 0%, #A855F7 100%)',
  },

  Tooltip: {
    color: '#0F1A36',
    textColor: '#E8F7FF',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.6)',
    borderRadius: '10px',
  },

  Message: {
    color: '#111A35',
    textColor: '#E8F7FF',
    borderRadius: '12px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.55)',
  },

  Dialog: {
    color: '#111A35',
    textColor: '#E8F7FF',
    borderRadius: '18px',
    boxShadow: '0 16px 48px rgba(0, 0, 0, 0.65), 0 0 60px rgba(0, 212, 255, 0.1)',
  },

  DatePicker: {    panelColor: '#111A35',
    textColor: '#E8F7FF',
    borderRadius: '14px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.6)',
  },

  LoadingBar: {
    colorLoading: 'linear-gradient(90deg, #00D4FF 0%, #A855F7 50%, #FF4D6D 100%)',
    height: '3px',
  },
}
