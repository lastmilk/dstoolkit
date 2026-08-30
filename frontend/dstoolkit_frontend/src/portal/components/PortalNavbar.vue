<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { MagicStick, Menu, Close, User, Key } from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

const drawerVisible = ref(false)
const isMobile = ref(false)

interface NavItem {
  label: string
  path: string
  name: string
}

const navItems: NavItem[] = [
  { label: 'Home', path: '/portal', name: 'home' },
  { label: 'Features', path: '/portal/features', name: 'features' },
  { label: 'Pricing', path: '/portal/pricing', name: 'pricing' },
]

const activePath = computed(() => route.path)

function isActive(path: string): boolean {
  if (path === '/portal') {
    return route.path === '/portal'
  }
  return route.path.startsWith(path)
}

function navigate(path: string) {
  router.push(path)
  drawerVisible.value = false
}

function checkViewport() {
  isMobile.value = window.innerWidth < 960
}

onMounted(() => {
  checkViewport()
  window.addEventListener('resize', checkViewport)
})

onUnmounted(() => {
  window.removeEventListener('resize', checkViewport)
})
</script>

<template>
  <div class="portal-navbar">
    <div class="navbar-inner">
      <div class="navbar-brand" @click="navigate('/portal')">
        <el-icon :size="22" class="brand-icon">
          <MagicStick />
        </el-icon>
        <span class="brand-name">Deepseek Toolkit</span>
      </div>

      <nav v-if="!isMobile" class="navbar-links">
        <a
          v-for="item in navItems"
          :key="item.path"
          class="nav-link"
          :class="{ active: isActive(item.path) }"
          @click.prevent="navigate(item.path)"
        >
          {{ item.label }}
        </a>
      </nav>

      <div v-if="!isMobile" class="navbar-actions">
        <el-button
          text
          :icon="User"
          class="nav-btn nav-btn-login"
          @click="router.push('/login')"
        >
          Login
        </el-button>
        <el-button
          type="primary"
          :icon="Key"
          class="nav-btn nav-btn-register"
          @click="router.push('/register')"
        >
          Register
        </el-button>
      </div>

      <el-button
        v-if="isMobile"
        text
        :icon="Menu"
        class="hamburger-btn"
        @click="drawerVisible = true"
      />
    </div>

    <el-drawer
      v-model="drawerVisible"
      direction="rtl"
      :with-header="false"
      size="280px"
      class="portal-drawer"
    >
      <div class="drawer-inner">
        <div class="drawer-header">
          <div class="drawer-brand">
            <el-icon :size="20" class="brand-icon">
              <MagicStick />
            </el-icon>
            <span class="drawer-brand-name">Deepseek Toolkit</span>
          </div>
          <el-button
            text
            :icon="Close"
            @click="drawerVisible = false"
            class="drawer-close"
          />
        </div>

        <nav class="drawer-links">
          <a
            v-for="item in navItems"
            :key="item.path"
            class="drawer-link"
            :class="{ active: isActive(item.path) }"
            @click.prevent="navigate(item.path)"
          >
            {{ item.label }}
          </a>
        </nav>

        <div class="drawer-actions">
          <el-button
            plain
            :icon="User"
            class="drawer-btn"
            @click="router.push('/login')"
          >
            Login
          </el-button>
          <el-button
            type="primary"
            :icon="Key"
            class="drawer-btn"
            @click="router.push('/register')"
          >
            Register
          </el-button>
        </div>
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.portal-navbar {
  width: 100%;
}

.navbar-inner {
  max-width: 1200px;
  margin: 0 auto;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 28px;
}

.navbar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  transition: opacity var(--transition-fast);
}

.navbar-brand:hover {
  opacity: 0.85;
}

.brand-icon {
  color: var(--primary);
  filter: drop-shadow(0 0 8px var(--primary-soft));
}

.brand-name {
  font-size: 16px;
  font-weight: var(--font-weight-black);
  color: var(--text);
  letter-spacing: -0.01em;
}

.navbar-links {
  display: flex;
  align-items: center;
  gap: 6px;
}

.nav-link {
  padding: 8px 16px;
  border-radius: var(--radius-full);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.nav-link:hover {
  color: var(--text);
  background: var(--bg-2);
}

.nav-link.active {
  color: var(--primary);
  background: var(--primary-soft);
  font-weight: var(--font-weight-bold);
}

.navbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nav-btn-login {
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
}

.nav-btn-register {
  border-radius: var(--radius-full);
  padding: 9px 20px;
}

.hamburger-btn {
  width: 40px;
  height: 40px;
  padding: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

.hamburger-btn:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
}

:global(.portal-drawer) :deep(.el-drawer__body) {
  padding: 0;
}

.drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 18px 16px;
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 24px;
}

.drawer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.drawer-brand-name {
  font-size: 15px;
  font-weight: var(--font-weight-black);
  color: var(--text);
}

.drawer-close {
  color: var(--text-muted);
  padding: 4px;
}

.drawer-links {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 24px;
}

.drawer-link {
  padding: 12px 16px;
  border-radius: var(--radius);
  font-size: 14px;
  font-weight: var(--font-weight-medium);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.drawer-link:hover {
  background: var(--bg-2);
  color: var(--text);
}

.drawer-link.active {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: var(--font-weight-bold);
}

.drawer-actions {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
}

.drawer-btn {
  width: 100%;
  border-radius: var(--radius);
}

@media (max-width: 960px) {
  .navbar-inner {
    height: 56px;
    padding: 0 16px;
  }
}
</style>
