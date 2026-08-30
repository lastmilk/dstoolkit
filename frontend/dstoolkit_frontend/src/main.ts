import './styles/global.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import TDesign from 'tdesign-vue-next'
import TDesignChat from '@tdesign-vue-next/chat'
// TDesign 少量全局样式变量 + 组件样式
import 'tdesign-vue-next/es/style/index.css'
import '@tdesign-vue-next/chat/es/style/index.css'
import App from './App.vue'
import router from './router'
import { useThemeStore } from '@/stores/theme'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)
app.use(TDesign)
app.use(TDesignChat)

// 等待 pinia 就绪后，初始化主题（监听系统 + 持久化 + DOM 注入）
useThemeStore().init()

app.mount('#app')
