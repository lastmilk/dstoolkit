<script setup lang="ts">
import zhCN from 'tdesign-vue-next/es/locale/zh_CN'
import type { GlobalConfigProvider } from 'tdesign-vue-next'

// 语言包导出类型为 readonly，与 GlobalConfigProvider 的 mutable 数组不兼容，此处断言
const globalConfig = zhCN as unknown as GlobalConfigProvider
</script>

<template>
  <!-- TDesign 全局配置：中文语言包。主题通过 CSS 变量注入（stores/theme.ts） -->
  <t-config-provider :global-config="globalConfig">
    <RouterView />
  </t-config-provider>
</template>
