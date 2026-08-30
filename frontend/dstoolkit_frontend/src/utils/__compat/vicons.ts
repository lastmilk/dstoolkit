/**
 * 运行时 @vicons/ionicons5 兼容层（迁移过渡期使用）
 *
 * 未迁移视图仍然 import 了 @vicons/ionicons5 的具名图标。
 * vite.config.ts 中把 @vicons/ionicons5 alias 到本文件。
 *
 * 所有未知具名图标 -> 返回一个 SVG 占位组件。
 */
import { defineComponent, h } from 'vue'

// 用一个极简 SVG 图标占位（一个居中的圆形 + 问号），保证页面不会空白错位
const PlaceholderSvg = defineComponent({
  name: 'ViconsPlaceholder',
  inheritAttrs: true,
  setup(_p, { attrs }) {
    return () =>
      h(
        'svg',
        {
          xmlns: 'http://www.w3.org/2000/svg',
          viewBox: '0 0 512 512',
          width: '1em',
          height: '1em',
          fill: 'currentColor',
          ...attrs,
        },
        [
          h('circle', {
            cx: 256,
            cy: 256,
            r: 200,
            fill: 'none',
            stroke: 'currentColor',
            'stroke-width': 30,
            opacity: 0.25,
          }),
          h('path', {
            d: 'M208 200a48 48 0 1196 0c0 22-14 34-26 48-14 16-18 28-18 52v12h-28v-12c0-46 22-70 40-92 14-18 24-30 24-48a76 76 0 10-152 0h28zm20 124a28 28 0 1156 0 28 28 0 01-56 0z',
            opacity: 0.75,
          }),
        ]
      )
  },
})

const icons: any = new Proxy(
  {} as Record<string, any>,
  {
    get(target, prop) {
      const key = String(prop)
      if (key in target) return target[key]
      const Comp = defineComponent({
        name: `Icon::${key}`,
        inheritAttrs: true,
        setup(_p, { attrs }) {
          return () => h(PlaceholderSvg, attrs)
        },
      })
      target[key] = Comp
      return Comp
    },
  }
)

export default icons

// 预先展开常用具名成员，使 `import { X } from ...` 能在静态分析时也解析正确
export const PersonOutline = icons.PersonOutline
export const SparklesSharp = icons.SparklesSharp
export const SparklesOutline = icons.SparklesOutline
export const CreateOutline = icons.CreateOutline
export const CheckmarkOutline = icons.CheckmarkOutline
export const CheckmarkCircle = icons.CheckmarkCircle
export const CheckmarkCircleOutline = icons.CheckmarkCircleOutline
export const CheckmarkDoneOutline = icons.CheckmarkDoneOutline
export const CloseOutline = icons.CloseOutline
export const CloseCircleOutline = icons.CloseCircleOutline
export const SendOutline = icons.SendOutline
export const ChevronDownOutline = icons.ChevronDownOutline
export const ChevronBackOutline = icons.ChevronBackOutline
export const ChevronForwardOutline = icons.ChevronForwardOutline
export const CloudOutline = icons.CloudOutline
export const CloudOfflineOutline = icons.CloudOfflineOutline
export const AddOutline = icons.AddOutline
export const FolderOpenOutline = icons.FolderOpenOutline
export const EyeOutline = icons.EyeOutline
export const RefreshOutline = icons.RefreshOutline
export const TrashOutline = icons.TrashOutline
export const PersonCircleOutline = icons.PersonCircleOutline
export const ChatbubbleEllipsesOutline = icons.ChatbubbleEllipsesOutline
export const CalendarOutline = icons.CalendarOutline
export const HardwareChipOutline = icons.HardwareChipOutline
export const RocketOutline = icons.RocketOutline
export const ServerOutline = icons.ServerOutline
export const ShieldCheckmarkOutline = icons.ShieldCheckmarkOutline
export const ShieldOutline = icons.ShieldOutline
export const PhonePortraitOutline = icons.PhonePortraitOutline
export const BarChartOutline = icons.BarChartOutline
export const ChatbubblesOutline = icons.ChatbubblesOutline
export const ChatbubbleOutline = icons.ChatbubbleOutline
export const ColorPaletteOutline = icons.ColorPaletteOutline
export const TimeOutline = icons.TimeOutline
export const TrendingUpOutline = icons.TrendingUpOutline
export const WalletOutline = icons.WalletOutline
export const CashOutline = icons.CashOutline
export const GiftOutline = icons.GiftOutline
export const CardOutline = icons.CardOutline
export const KeyOutline = icons.KeyOutline
export const StorefrontOutline = icons.StorefrontOutline
export const OpenOutline = icons.OpenOutline
export const PricetagsOutline = icons.PricetagsOutline
export const HammerOutline = icons.HammerOutline
export const CodeSlashOutline = icons.CodeSlashOutline
export const BookOutline = icons.BookOutline
export const ConstructOutline = icons.ConstructOutline
export const BriefcaseOutline = icons.BriefcaseOutline
export const ExtensionPuzzleOutline = icons.ExtensionPuzzleOutline
export const SearchOutline = icons.SearchOutline
export const SearchCircleOutline = icons.SearchCircleOutline
export const FilterOutline = icons.FilterOutline
export const ListOutline = icons.ListOutline
export const TrophyOutline = icons.TrophyOutline
export const ArrowForwardOutline = icons.ArrowForwardOutline
export const LinkOutline = icons.LinkOutline
export const GitPullRequestOutline = icons.GitPullRequestOutline
export const LockClosedOutline = icons.LockClosedOutline
export const SaveOutline = icons.SaveOutline
export const CopyOutline = icons.CopyOutline
export const RibbonOutline = icons.RibbonOutline
export const HourglassOutline = icons.HourglassOutline
export const FingerPrintOutline = icons.FingerPrintOutline
export const LogOutOutline = icons.LogOutOutline
export const PeopleOutline = icons.PeopleOutline
export const DownloadOutline = icons.DownloadOutline
export const GitNetworkOutline = icons.GitNetworkOutline
export const CubeOutline = icons.CubeOutline
export const HeadsetOutline = icons.HeadsetOutline
export const StarOutline = icons.StarOutline

export const __vicons_compat__ = true
