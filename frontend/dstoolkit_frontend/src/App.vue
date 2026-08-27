<script setup lang="ts">
import {
  NConfigProvider,
  NMessageProvider,
  NDialogProvider,
  NLoadingBarProvider,
  zhCN,
  dateZhCN,
  darkTheme,
} from 'naive-ui'
import { computed } from 'vue'
import { useThemeStore } from '@/stores/theme'

const themeStore = useThemeStore()

/**
 * NaiveUI 支持两种叠加：
 *  1) theme: darkTheme / undefined  →  提供「暗色/浅色」底层主题
 *  2) theme-overrides               →  覆盖具体 token
 */
const naiveTheme = computed(() =>
  themeStore.current.naiveDark ? darkTheme : undefined
)

const themeOverrides = computed(() => themeStore.current.overrides)
</script>

<template>
  <NConfigProvider
    :locale="zhCN"
    :date-locale="dateZhCN"
    :theme="naiveTheme"
    :theme-overrides="themeOverrides"
  >
    <NLoadingBarProvider>
      <NMessageProvider>
        <NDialogProvider>
          <RouterView />
        </NDialogProvider>
      </NMessageProvider>
    </NLoadingBarProvider>
  </NConfigProvider>
</template>
