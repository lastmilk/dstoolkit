import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': srcDir,
      // —— Naive UI → Element-Plus 迁移期间的运行时兼容层 ——
      //    未迁移页面 import naive-ui / @vicons 时会 resolve 到这里，
      //    避免 dev/build 报模块缺失错误。页面逐个迁移后可移除这两条。
      'naive-ui': `${srcDir}/utils/__compat/naive.ts`,
      '@vicons/ionicons5': `${srcDir}/utils/__compat/vicons.ts`,
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
