<script setup lang="ts">
import { computed, type Component } from 'vue'

// 替代 NaiveUI NIcon 的轻量图标包装：
// 内部渲染 @vicons/ionicons5 的 SVG 组件，通过 font-size 控制大小
const props = withDefaults(
  defineProps<{
    /** 图标尺寸（px 或任意 CSS 长度） */
    size?: number | string
    /** 直接传组件（等价于默认插槽） */
    component?: Component
    /** 图标颜色 */
    color?: string
  }>(),
  { size: 18 },
)

const style = computed(() => ({
  fontSize: typeof props.size === 'number' ? `${props.size}px` : props.size,
  color: props.color,
}))
</script>

<template>
  <span class="app-icon" :style="style">
    <component :is="component" v-if="component" />
    <slot v-else />
  </span>
</template>

<style scoped>
.app-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 0;
  flex-shrink: 0;
}
.app-icon :deep(svg) {
  width: 1em;
  height: 1em;
}
</style>
