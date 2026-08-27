import './styles/global.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { useThemeStore } from '@/stores/theme'

const app = createApp(App)
const pinia = createPinia()
app.use(pinia)
app.use(router)

// 等待 pinia 就绪后，初始化主题（监听系统 + 持久化 + DOM 注入）
useThemeStore().init()

app.mount('#app')
