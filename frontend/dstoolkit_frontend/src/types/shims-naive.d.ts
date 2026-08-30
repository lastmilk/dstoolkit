/**
 * Naive UI 迁移阶段的临时兼容层声明（shim）：
 *  - 将未迁移页面中实际 import 到的 naive-ui / @vicons 成员
 *    全部声明为 any，避免它们阻塞 type-check / build。
 *  - 对应页面会按 todo list 优先级逐个迁移到 Element-Plus，
 *    迁移完成后删除本文件。
 */

declare module 'naive-ui' {
  // —— 值导出 / 组件 & hooks ——
  export const NButton: any
  export const NEmpty: any
  export const NGrid: any
  export const NGridItem: any
  export const NGi: any
  export const NIcon: any
  export const NSpace: any
  export const NSpin: any
  export const NStatistic: any
  export const NText: any
  export const NTree: any
  export const NTag: any
  export const NUpload: any
  export const NUploadDragger: any
  export const NCard: any
  export const NForm: any
  export const NFormItem: any
  export const NFormItemGi: any
  export const NInput: any
  export const NInputGroup: any
  export const NInputNumber: any
  export const NSelect: any
  export const NDatePicker: any
  export const NSwitch: any
  export const NCheckbox: any
  export const NCheckboxGroup: any
  export const NRadio: any
  export const NRadioGroup: any
  export const NRadioButton: any
  export const NDataTable: any
  export const NTable: any
  export const NPagination: any
  export const NTabs: any
  export const NTabPane: any
  export const NDivider: any
  export const NAvatar: any
  export const NPopover: any
  export const NTooltip: any
  export const NPopconfirm: any
  export const NDropdown: any
  export const NDrawer: any
  export const NDrawerContent: any
  export const NModal: any
  export const NDynamicTags: any
  export const NScrollbar: any
  export const NBadge: any
  export const NAlert: any
  export const NProgress: any
  export const NResult: any
  export const NDescriptions: any
  export const NDescriptionsItem: any
  export const NTimeline: any
  export const NTimelineItem: any
  export const NBreadcrumb: any
  export const NBreadcrumbItem: any
  export const NCode: any
  export const NSkeleton: any
  export const NConfigProvider: any
  export const NMessageProvider: any
  export const NDialogProvider: any
  export const NNotificationProvider: any
  export const NLoadingBarProvider: any
  export const NLayout: any
  export const NLayoutSider: any
  export const NLayoutHeader: any
  export const NLayoutContent: any
  export const NLayoutFooter: any
  export const NMenu: any
  export const NH1: any
  export const NH2: any
  export const NH3: any
  export const NH4: any
  export const NP: any
  export const NUl: any
  export const NOl: any
  export const NLi: any
  export const NA: any
  export const NRate: any
  export const NCascader: any
  export const NMention: any
  export const NColorPicker: any
  export const NImage: any
  export const NAffix: any
  export const NAnchor: any
  export const NAnchorLink: any
  export const NBackTop: any
  export const NPageHeader: any
  export const NCollapse: any
  export const NCollapseItem: any
  export const NEllipsis: any
  export const NCarousel: any
  export const NCarouselItem: any
  export const NUpload__unused: any
  export const NVirtualList: any
  export const NNumberAnimation: any
  export const NSlider: any
  export const NSteps: any
  export const NStep: any
  export const NButtonGroup: any
  export const NAvatarGroup: any
  export const NElement: any
  export const NAutoComplete: any
  export const NWatermark: any
  export const NTreeSelect: any
  export const NCountdown: any

  // —— Hooks & 工具 ——
  export const useMessage: () => any
  export const useDialog: () => any
  export const useNotification: () => any
  export const useLoadingBar: () => any
  export const create: (...args: any[]) => any
  export const version: any
  export const darkTheme: any
  export const lightTheme: any
  export const zhCN: any
  export const dateZhCN: any

  // —— 类型导出 ——
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
  export type GlobalThemeOverrides = any
  export type NFormRules = any
  export type MenuOption = any
  export type UploadFile = any
  export type ButtonProps = any
}

declare module '@vicons/ionicons5' {
  // —— 实际项目中具名导入到的所有图标（value export，类型 any）——
  export const PersonOutline: any
  export const SparklesSharp: any
  export const SparklesOutline: any
  export const CreateOutline: any
  export const CheckmarkOutline: any
  export const CheckmarkCircle: any
  export const CheckmarkCircleOutline: any
  export const CheckmarkDoneOutline: any
  export const CloseOutline: any
  export const CloseCircleOutline: any
  export const SendOutline: any
  export const ChevronDownOutline: any
  export const ChevronBackOutline: any
  export const ChevronForwardOutline: any
  export const CloudOutline: any
  export const CloudOfflineOutline: any
  export const AddOutline: any
  export const FolderOpenOutline: any
  export const EyeOutline: any
  export const RefreshOutline: any
  export const TrashOutline: any
  export const PersonCircleOutline: any
  export const ChatbubbleEllipsesOutline: any
  export const CalendarOutline: any
  export const HardwareChipOutline: any
  export const RocketOutline: any
  export const ServerOutline: any
  export const ShieldCheckmarkOutline: any
  export const ShieldOutline: any
  export const PhonePortraitOutline: any
  export const BarChartOutline: any
  export const ChatbubblesOutline: any
  export const ChatbubbleOutline: any
  export const ColorPaletteOutline: any
  export const TimeOutline: any
  export const TrendingUpOutline: any
  export const WalletOutline: any
  export const CashOutline: any
  export const GiftOutline: any
  export const CardOutline: any
  export const KeyOutline: any
  export const StorefrontOutline: any
  export const OpenOutline: any
  export const PricetagsOutline: any
  export const HammerOutline: any
  export const CodeSlashOutline: any
  export const BookOutline: any
  export const ConstructOutline: any
  export const BriefcaseOutline: any
  export const ExtensionPuzzleOutline: any
  export const SearchOutline: any
  export const SearchCircleOutline: any
  export const FilterOutline: any
  export const ListOutline: any
  export const TrophyOutline: any
  export const ArrowForwardOutline: any
  export const LinkOutline: any
  export const GitPullRequestOutline: any
  export const LockClosedOutline: any
  export const SaveOutline: any
  export const CopyOutline: any
  export const RibbonOutline: any
  export const HourglassOutline: any
  export const FingerPrintOutline: any
  export const LogOutOutline: any
  export const PeopleOutline: any
  export const DownloadOutline: any
  export const GitNetworkOutline: any
  export const ArrowForward__unused: any
  export const CubeOutline: any
  export const HeadsetOutline: any
  export const StarOutline: any
}
