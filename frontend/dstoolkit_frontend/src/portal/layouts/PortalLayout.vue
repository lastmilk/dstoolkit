<script setup lang="ts">
import PortalNavbar from '@/portal/components/PortalNavbar.vue'
import PortalFooter from '@/portal/components/PortalFooter.vue'
</script>

<template>
  <div class="portal-layout">
    <header class="portal-topbar glass">
      <PortalNavbar />
    </header>
    <main class="portal-main">
      <router-view />
    </main>
    <PortalFooter />
  </div>
</template>

<style scoped>
.portal-layout {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  width: 100%;
}

.portal-topbar {
  position: sticky;
  top: 0;
  z-index: 100;
  border-radius: 0;
  border-top: none;
  border-left: none;
  border-right: none;
  border-bottom: 1px solid color-mix(in srgb, var(--surface) 35%, var(--border));
  padding: 0;
}

.portal-main {
  flex: 1;
  width: 100%;
}
</style>
