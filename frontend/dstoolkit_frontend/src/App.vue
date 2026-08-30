<script setup lang="ts">
/**
 * 顶层 App.vue（已移除 NaiveUI 包裹层）
 *  - Element Plus 全局由 main.ts 中 app.use(ElementPlus) 注册
 *  - vue-toastification 由 <VueToastificationContainer /> 挂载（Toast 插件自动注册）
 *  - 背景层通过 <div id="app-bg-layer"> 渲染，覆盖整屏
 */
import { computed, provide } from 'vue'
import { RouterView } from 'vue-router'
import { useThemeStore } from '@/stores/theme'
import { useBackgroundStore } from '@/stores/background'

const themeStore = useThemeStore()
const bgStore = useBackgroundStore()

const appBgClass = computed(() => ({
  'app-bg-layer': true,
  'app-bg-enabled': bgStore.mode !== 'off' && !!bgStore.currentUrl,
  'app-bg-off': bgStore.mode === 'off',
  [`app-bg-${bgStore.mode}`]: true,
}))

// 向下提供全局配置标识
provide('APP_THEME_ID', computed(() => themeStore.effectiveId))
provide('APP_BG_MODE', computed(() => bgStore.mode))
</script>

<template>
  <div id="app-root">
    <!-- 全屏背景层（图片 + 遮罩） -->
    <div :class="appBgClass" aria-hidden="true">
      <div class="app-bg-image" :style="{ backgroundImage: `var(--app-background-image, none)` }"></div>
      <div class="app-bg-mask"></div>
    </div>

    <!-- 主内容（RouterView 渲染路由组件） -->
    <div class="app-content-layer">
      <RouterView />
    </div>
  </div>
</template>

<style scoped>
#app-root {
  position: relative;
  width: 100%;
  min-height: 100vh;
  z-index: 0;
  overflow-x: hidden;
}

/* 背景层：固定覆盖整个视口 */
.app-bg-layer {
  position: fixed;
  inset: 0;
  z-index: -1;
  pointer-events: none;
  transition: opacity 420ms var(--ease-out);
}
.app-bg-image {
  position: absolute;
  inset: 0;
  background-size: cover;
  background-position: center center;
  background-repeat: no-repeat;
  background-attachment: fixed;
  opacity: 0;
  transition: opacity 520ms var(--ease-out);
}
.app-bg-mask {
  position: absolute;
  inset: 0;
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.08) 0%, rgba(0, 0, 0, 0.02) 40%, rgba(0, 0, 0, 0.05) 100%);
}
.app-bg-enabled .app-bg-image {
  opacity: 1;
}
/* 深色主题需要更深的遮罩保证可读性 */
:global(html[data-theme='dark']) .app-bg-mask,
:global(html[data-theme='ocean']) .app-bg-mask {
  background:
    linear-gradient(180deg, rgba(0, 0, 0, 0.55) 0%, rgba(0, 0, 0, 0.35) 40%, rgba(0, 0, 0, 0.55) 100%);
}

/* 内容层：相对定位，保证比背景层级高 */
.app-content-layer {
  position: relative;
  z-index: 1;
  width: 100%;
  min-height: 100vh;
}
</style>
