import './styles/fonts.css'
import './styles/global.css'
import 'element-plus/dist/index.css'
import 'element-plus/theme-chalk/dark/css-vars.css'
import 'vue-toastification/dist/index.css'
import 'sweetalert2/dist/sweetalert2.min.css'
import 'tdesign-vue-next/es/style/index.css'
import '@tdesign-vue-next/chat/es/style/index.css'

import { createApp } from 'vue'
import { createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import zhCn from 'element-plus/es/locale/lang/zh-cn'
import * as ElementPlusIconsVue from '@element-plus/icons-vue'
import Toast from 'vue-toastification'
import { useToast } from 'vue-toastification'
import TDesign from 'tdesign-vue-next'
import TDesignChat from '@tdesign-vue-next/chat'
import ECharts from 'vue-echarts'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  LineChart, BarChart, PieChart, RadarChart, ScatterChart,
  BoxplotChart, CandlestickChart, EffectScatterChart, FunnelChart, GaugeChart,
  HeatmapChart, PictorialBarChart, SankeyChart, SunburstChart,
} from 'echarts/charts'
import {
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  DataZoomComponent, VisualMapComponent, ToolboxComponent,
} from 'echarts/components'

import App from './App.vue'
import router from './router'
import { useThemeStore } from '@/stores/theme'
import { useBackgroundStore } from '@/stores/background'
import { setGlobalToastInstance } from '@/utils/toast'

// 注册 ECharts 模块
use([
  CanvasRenderer,
  LineChart, BarChart, PieChart, RadarChart, ScatterChart,
  BoxplotChart, CandlestickChart, EffectScatterChart, FunnelChart, GaugeChart,
  HeatmapChart, PictorialBarChart, SankeyChart, SunburstChart,
  GridComponent, TooltipComponent, LegendComponent, TitleComponent,
  DataZoomComponent, VisualMapComponent, ToolboxComponent,
])

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.use(ElementPlus, {
  locale: zhCn,
  size: 'default',
})
// 注册 Element Plus 图标
for (const [key, comp] of Object.entries(ElementPlusIconsVue)) {
  app.component(key, comp as any)
}
// 通知组件
app.use(Toast, {
  transition: 'Vue-Toastification__fade',
  maxToasts: 5,
  newestOnTop: true,
  position: 'top-right',
  timeout: 2600,
  closeOnClick: true,
  pauseOnFocusLoss: true,
  pauseOnHover: true,
  draggable: true,
  draggablePercent: 0.5,
  hideProgressBar: false,
  icon: true,
})
// TDesign + Chat （仅 AI 页面需要，提前注册避免按需引入兼容问题）
app.use(TDesign)
app.use(TDesignChat)
// vue-echarts 全局注册
app.component('VChart', ECharts)

// 等待 pinia 就绪后，初始化主题 & 背景
const themeStore = useThemeStore()
themeStore.init()
const bgStore = useBackgroundStore()
bgStore.init()

// 设置全局 toast 实例，方便 utils 中直接调用
setGlobalToastInstance(useToast())

app.mount('#app')
