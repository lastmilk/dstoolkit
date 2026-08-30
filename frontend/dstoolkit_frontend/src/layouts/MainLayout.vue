<script setup lang="ts">
/**
 * MainLayout.vue（Element Plus 版本）
 *  - 桌面端：固定侧边栏 + 顶栏 + 内容区 + Banner
 *  - 移动端：抽屉侧边栏 + 顶栏汉堡 + 底部 Tabbar
 *  - 集成 BackgroundManager：顶栏背景按钮弹出面板
 */
import logo from '@/assets/logo.png'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Upload, Search, DataAnalysis, Switch, Wallet, Medal, Grid, User,
  MagicStick, Cloudy, Close, Menu, Timer, HomeFilled, Picture, Check,
  Monitor, Sunny, PictureFilled, UploadFilled, RefreshRight, Delete,
  CircleClose,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { clearLocalData } from '@/utils/db'
import { toast } from '@/utils/toast'
import BackgroundManager from '@/components/BackgroundManager.vue'
import { confirmDanger } from '@/utils/sweetalert'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()

// ═══════════ 主题切换下拉 ═══════════
const themeDropdownOptions = computed(() => {
  const themes = themeStore.list.map((t) => ({
    label: `${t.emoji}  ${t.label}`,
    value: t.id,
  }))
  return [
    {
      label: '主题 · 手动',
      type: 'group',
      children: themes,
    },
    { type: 'divider' },
    {
      label: themeStore.mode === 'auto' ? '✓  跟随系统' : '   跟随系统',
      value: 'auto',
    },
  ]
})
function handleThemeSelect(command: string | number) {
  if (command === 'auto') {
    themeStore.setMode('auto')
    return
  }
  themeStore.setTheme(command as any)
}

// ═══════════ 响应式：是否移动端 ═══════════
const isMobile = ref(false)
const drawerVisible = ref(false)
const bgPanelVisible = ref(false)

function checkViewport() {
  isMobile.value = window.innerWidth < 1024
}
onMounted(() => {
  checkViewport()
  window.addEventListener('resize', checkViewport)
})
onUnmounted(() => {
  window.removeEventListener('resize', checkViewport)
})

// 路由切换时移动端自动关抽屉
watch(
  () => route.fullPath,
  () => {
    if (drawerVisible.value) drawerVisible.value = false
  },
)

// ═══════════ 菜单配置（图标用 Element Plus） ═══════════
const menuIconMap: Record<string, any> = {
  configs: Upload,
  explore: Search,
  stats: DataAnalysis,
  alpaca: Switch,
  balance: Wallet,
  pricing: Medal,
  market: Grid,
  profile: User,
}

interface MenuItem {
  label: string
  key: string
  icon: any
}
const menuOptions = computed<MenuItem[]>(() => [
  { label: '账号配置', key: 'configs', icon: Upload },
  { label: '对话探索', key: 'explore', icon: Search },
  { label: '数据统计', key: 'stats', icon: DataAnalysis },
  { label: 'Alpaca 导出', key: 'alpaca', icon: Switch },
  { label: '余额', key: 'balance', icon: Wallet },
  { label: '升级方案', key: 'pricing', icon: Medal },
  { label: '模型市场', key: 'market', icon: Grid },
  { label: '个人中心', key: 'profile', icon: User },
])

const activeKey = computed(() => (route.name as string) || 'configs')
function onSelect(key: string) {
  router.push({ name: key })
}

const MENU_LABELS: Record<string, { title: string; subtitle: string; chrono: string }> = {
  configs: { title: '账号配置', subtitle: '上传与管理你的 Deepseek 数据', chrono: '数据配置中心' },
  explore: { title: '对话探索', subtitle: '搜索、浏览和继续你的对话', chrono: '对话记录管理' },
  stats: { title: '数据统计', subtitle: '对话量、模型分布、活跃时段', chrono: '数据概览' },
  alpaca: { title: 'Alpaca 导出', subtitle: '导出为微调训练数据格式', chrono: '数据导出' },
  balance: { title: '余额', subtitle: 'API Key 余额与用量信息', chrono: '账户信息' },
  pricing: { title: '升级方案', subtitle: 'Pro / Plus / Ultimate 三档权益与支付', chrono: '付费中心' },
  market: { title: '模型市场', subtitle: '工具生态与官方资源', chrono: '资源中心' },
  profile: { title: '个人中心', subtitle: '账号设置、密钥管理', chrono: '账号管理' },
}
function menuTitle(key: string): string { return MENU_LABELS[key]?.title || '' }
function menuSubtitle(key: string): string { return MENU_LABELS[key]?.subtitle || '' }
function menuChrono(key: string): string { return MENU_LABELS[key]?.chrono || '' }

// ═══════════ 移动端底部Tab（取前5个高频功能） ═══════════
const tabbarItems = computed(() => [
  { key: 'configs', label: '配置', icon: Upload, badge: 0 },
  { key: 'explore', label: '探索', icon: Search, badge: 0 },
  { key: 'stats', label: '统计', icon: DataAnalysis, badge: 0 },
  { key: 'market', label: '市场', icon: Grid, badge: 0 },
  { key: 'profile', label: '我的', icon: User, badge: 0 },
])

// ═══════════ 云端同步控制 ═══════════
async function onCloudSync(value: boolean) {
  try {
    await auth.setCloudSync(value)
    if (!value) {
      await clearLocalData()
      toast.success('已切换为仅本地存储，本地索引已清空')
    } else {
      toast.success('已开启云端存储，上传的对话将同步到云端')
    }
  } catch {
    /* 错误已由拦截器提示 */
  }
}

// ═══════════ Chronos Banner 动态数据 ═══════════
const todayStr = computed(() => {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  const wd = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'][d.getUTCDay()]
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${String(d.getUTCDate()).padStart(2, '0')} · ${wd}`
})
const greetText = computed(() => {
  const h = new Date(Date.now() + 8 * 3600 * 1000).getUTCHours()
  if (h < 5) return '夜深了，注意休息'
  if (h < 11) return '早上好'
  if (h < 14) return '中午好'
  if (h < 18) return '下午好'
  if (h < 22) return '晚上好'
  return '夜深了'
})

// ═══════════ 用户下拉菜单 ═══════════
const userDropdownVisible = ref(false)
async function handleLogout() {
  const ok = await confirmDanger('确认退出登录？', '退出后需要重新登录才能访问工作台。')
  if (!ok) return
  auth.logout()
  router.push({ name: 'login' })
  toast.success('已退出登录')
}
const userDropdownItems = [
  { label: '个人中心', value: 'profile', icon: User },
  { type: 'divider' },
  { label: '退出登录', value: 'logout', icon: Close, divided: true },
]
function handleUserCommand(cmd: string) {
  if (cmd === 'logout') handleLogout()
  else if (cmd === 'profile') router.push({ name: 'profile' })
}
</script>

<template>
  <el-container class="chronos-layout">

    <!-- ════════════════════════════════════
         桌面端：常驻侧边栏
         ════════════════════════════════════ -->
    <el-aside
      v-if="!isMobile"
      :width="272"
      class="chronos-sider glass-sider"
    >
      <!-- 侧边栏装饰：流光网格 -->
      <div class="sider-bg-deco" aria-hidden="true"></div>

      <!-- 品牌卡片 -->
      <div class="brand-wrap">
        <img :src="logo" alt="Logo" class="brand-logo-img">
        <div class="brand-text">
          <div class="brand-name">Deepseek Toolkit</div>
          <div class="brand-tag">对话管理工作台</div>
        </div>
      </div>

      <!-- 导航菜单 -->
      <div class="nav-wrap">
        <div class="nav-label">
          <el-icon :size="12"><Timer /></el-icon>
          <span>工作台导航</span>
        </div>
        <el-menu
          :default-active="activeKey"
          class="chronos-menu"
          router
          background-color="transparent"
          :text-color="'var(--text-muted)'"
          :active-text-color="'var(--primary)'"
          @select="onSelect"
        >
          <el-menu-item
            v-for="item in menuOptions"
            :key="item.key"
            :index="item.key"
            class="chronos-menu-item"
          >
            <el-icon class="menu-item-icon">
              <component :is="menuIconMap[item.key]" />
            </el-icon>
            <template #title>{{ item.label }}</template>
          </el-menu-item>
        </el-menu>
      </div>

      <!-- 底部：云端同步 + 用户信息 -->
      <div class="sider-footer">
        <div class="cloud-card glass">
          <div class="cloud-header">
            <el-icon :size="16">
              <component :is="auth.cloudSyncEnabled ? Cloudy : CircleClose" />
            </el-icon>
            <span>{{ auth.cloudSyncEnabled ? '云端同步' : '离线模式' }}</span>
            <span
              class="cloud-status"
              :class="auth.cloudSyncEnabled ? 'on' : 'off'"
            ></span>
          </div>
          <div class="cloud-control">
            <el-switch
              :model-value="auth.cloudSyncEnabled"
              size="small"
              inline-prompt
              @update:model-value="onCloudSync"
            />
          </div>
        </div>

        <!-- 用户小卡 -->
        <div class="sider-user-card" @click="router.push('/profile')">
          <el-avatar :size="34" class="sider-avatar">
            {{ (auth.user?.username || 'U').charAt(0).toUpperCase() }}
          </el-avatar>
          <div class="sider-user-info">
            <div class="sider-user-name">{{ auth.user?.username || '用户' }}</div>
            <div class="sider-user-role">
              {{ auth.isAdmin ? '管理员' : '用户' }}
            </div>
          </div>
        </div>
      </div>
    </el-aside>

    <!-- ════════════════════════════════════
         移动端：抽屉式侧边栏
         ════════════════════════════════════ -->
    <el-drawer
      v-if="isMobile"
      v-model="drawerVisible"
      direction="ltr"
      :with-header="false"
      size="280px"
      class="mobile-drawer"
    >
      <div class="drawer-inner">
        <div class="drawer-header">
          <div class="drawer-brand">
            <el-icon :size="20" class="brand-logo-icon"><MagicStick /></el-icon>
            <div>
              <div class="drawer-title">Deepseek Toolkit</div>
              <div class="drawer-subtitle">对话管理工作台</div>
            </div>
          </div>
          <el-button
            text
            :icon="Close"
            @click="drawerVisible = false"
            class="drawer-close-btn"
          />
        </div>

        <!-- 抽屉里的菜单 -->
        <div class="mobile-menu-wrap">
          <el-menu
            :default-active="activeKey"
            class="chronos-menu"
            router
            background-color="transparent"
            :text-color="'var(--text-muted)'"
            :active-text-color="'var(--primary)'"
            @select="(k: string) => { onSelect(k); drawerVisible = false }"
          >
            <el-menu-item
              v-for="item in menuOptions"
              :key="item.key"
              :index="item.key"
              class="chronos-menu-item"
            >
              <el-icon class="menu-item-icon">
                <component :is="menuIconMap[item.key]" />
              </el-icon>
              <template #title>{{ item.label }}</template>
            </el-menu-item>
          </el-menu>
        </div>

        <!-- 抽屉底部：云端同步 + 用户 -->
        <div class="drawer-footer">
          <div class="cloud-card glass" style="margin-bottom: 12px;">
            <div class="cloud-header">
              <el-icon :size="16">
                <component :is="auth.cloudSyncEnabled ? Cloudy : CircleClose" />
              </el-icon>
              <span>{{ auth.cloudSyncEnabled ? '云端同步中' : '离线模式' }}</span>
            </div>
            <div class="cloud-control">
              <el-switch
                :model-value="auth.cloudSyncEnabled"
                size="small"
                inline-prompt
                @update:model-value="onCloudSync"
              />
            </div>
          </div>

          <div
            class="sider-user-card"
            @click="onSelect('profile'); drawerVisible = false"
          >
            <el-avatar :size="36" class="sider-avatar">
              {{ (auth.user?.username || 'U').charAt(0).toUpperCase() }}
            </el-avatar>
            <div class="sider-user-info">
              <div class="sider-user-name">{{ auth.user?.username || '用户' }}</div>
              <div class="sider-user-role">
                {{ auth.isAdmin ? '管理员' : '用户' }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </el-drawer>

    <!-- ════════════════════════════════════
         主内容区（移动端 & 桌面端共用容器）
         ════════════════════════════════════ -->
    <el-container class="chronos-main-container">

      <!-- ======== 顶部栏 ======== -->
      <el-header
        class="chronos-topbar"
        :class="{ 'is-mobile': isMobile }"
      >
        <!-- 移动端左侧：汉堡按钮 + 品牌迷你Logo -->
        <div v-if="isMobile" class="mobile-topbar-left">
          <el-button
            text
            :icon="Menu"
            class="chronos-hamburger"
            aria-label="打开菜单"
            @click="drawerVisible = true"
          />
          <div class="mobile-mini-brand">
            <el-icon :size="16" class="brand-logo-icon mini"><MagicStick /></el-icon>
            <span>Deepseek Toolkit</span>
          </div>
        </div>

        <!-- 桌面端：页面标题 -->
        <div v-if="!isMobile" class="page-identity">
          <div class="page-title-row">
            <h1 class="page-title">{{ menuTitle(activeKey) }}</h1>
            <span class="chrono-stamp">{{ menuChrono(activeKey) }}</span>
          </div>
          <div class="page-subtitle">{{ menuSubtitle(activeKey) }}</div>
        </div>

        <!-- 右侧：状态 + 用户 -->
        <div class="topbar-right">
          <!-- 背景管理按钮 + 弹出面板 -->
          <el-popover
            v-model:visible="bgPanelVisible"
            placement="bottom-end"
            :width="isMobile ? 340 : 420"
            trigger="click"
            popper-class="bg-panel-popover"
            :teleported="true"
          >
            <template #reference>
              <el-button
                text
                class="topbar-icon-btn"
                aria-label="背景设置"
                title="背景设置"
              >
                <el-icon :size="18"><Picture /></el-icon>
              </el-button>
            </template>
            <div class="bg-panel-header">
              <span class="bg-panel-title">背景设置</span>
              <el-button
                text
                size="small"
                :icon="Close"
                @click="bgPanelVisible = false"
                class="bg-panel-close"
              />
            </div>
            <BackgroundManager />
          </el-popover>

          <!-- 主题切换（桌面+移动都显示） -->
          <el-dropdown
            @command="handleThemeSelect"
            trigger="click"
            placement="bottom-end"
          >
            <el-button
              text
              class="topbar-icon-btn theme-btn"
              aria-label="切换主题"
              :title="`主题：${themeStore.current.label}${themeStore.mode === 'auto' ? '（跟随系统）' : ''}`"
            >
              <span style="font-size: 16px;">{{ themeStore.current.emoji }}</span>
            </el-button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item
                  v-for="opt in themeDropdownOptions"
                  :key="opt.type === 'divider' ? 'd' : (opt.type === 'group' ? 'g' : opt.value)"
                  :divided="opt.type === 'divider'"
                  :label="opt.label"
                  :value="opt.value"
                  :type="opt.type"
                >
                  <span v-if="opt.type === 'group'" style="font-size:11px;opacity:.6;letter-spacing:.1em;text-transform:uppercase;">
                    {{ opt.label }}
                  </span>
                  <template v-else-if="opt.type === 'divider'"></template>
                  <template v-else>{{ opt.label }}</template>
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>

          <!-- 状态标签组（桌面端完整） -->
          <div v-if="!isMobile" class="topbar-tags">
            <el-tag
              v-if="auth.isAdmin"
              size="small"
              type="warning"
              effect="light"
              round
            >
              <el-icon :size="11" style="margin-right: 3px;"><MagicStick /></el-icon>
              管理员
            </el-tag>
            <el-tag
              size="small"
              round
              :type="auth.cloudSyncEnabled ? 'success' : 'info'"
              effect="light"
            >
              <el-icon :size="11" style="margin-right: 3px;">
                <component :is="auth.cloudSyncEnabled ? Cloudy : CircleClose" />
              </el-icon>
              {{ auth.cloudSyncEnabled ? '云端同步' : '离线' }}
            </el-tag>
          </div>

          <!-- 移动端：云端状态小图标 -->
          <el-tag
            v-if="isMobile"
            size="small"
            round
            :type="auth.cloudSyncEnabled ? 'success' : 'info'"
            effect="light"
            style="padding: 2px 8px;"
          >
            <el-icon :size="11">
              <component :is="auth.cloudSyncEnabled ? Cloudy : CircleClose" />
            </el-icon>
          </el-tag>

          <!-- 用户头像下拉 -->
          <el-dropdown
            trigger="click"
            placement="bottom-end"
            @command="handleUserCommand"
            @visible-change="(v: boolean) => (userDropdownVisible = v)"
          >
            <div class="user-avatar-wrap" :class="{ active: userDropdownVisible }">
              <el-avatar :size="32" class="topbar-avatar">
                {{ (auth.user?.username || 'U').charAt(0).toUpperCase() }}
              </el-avatar>
            </div>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item :value="'profile'">
                  <el-icon style="margin-right: 6px;"><User /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item divided :value="'logout'" style="color: var(--el-color-danger);">
                  <el-icon style="margin-right: 6px;"><Close /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- ======== 内容主体 ======== -->
      <el-main
        class="chronos-content"
        :class="{ 'is-mobile': isMobile }"
      >
        <!-- Chronos 每日日程报 Banner -->
        <div class="chronos-banner glass page-enter">
          <div class="chronos-banner-content">
            <div class="chronos-banner-tag">
              <span class="pulse"></span>
              <span>工作台就绪</span>
            </div>
            <div class="chronos-banner-title">
              <span>{{ greetText }}，{{ auth.user?.username || '用户' }}，开始管理你的对话数据吧。</span>
            </div>
            <div class="chronos-banner-subtitle">
              共 1 个账号 · {{ menuTitle(activeKey) }} 功能可用 · 最近同步：刚刚
            </div>
            <div class="chronos-banner-meta">
              <div class="chronos-meta-item">
                <span class="dot"></span>
                <span>{{ todayStr }}</span>
              </div>
              <div class="chronos-meta-item">
                <span class="dot" style="background: var(--primary); box-shadow: 0 0 6px var(--primary);"></span>
                <span>{{ menuTitle(activeKey) }}</span>
              </div>
              <div class="chronos-meta-item">
                <span class="dot" style="background: var(--chrono-green); box-shadow: 0 0 6px var(--chrono-green);"></span>
                <span>{{ auth.cloudSyncEnabled ? '云端已同步' : '本地存储' }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 移动端页面标题（在Banner之后单独显示） -->
        <div v-if="isMobile" class="mobile-page-title-wrap page-enter delay-1">
          <div class="mobile-page-title-row">
            <h2 style="margin: 0;">{{ menuTitle(activeKey) }}</h2>
            <span class="chrono-stamp">{{ menuChrono(activeKey) }}</span>
          </div>
          <div class="mobile-page-subtitle">{{ menuSubtitle(activeKey) }}</div>
        </div>

        <!-- 页面内容 -->
        <div class="page-enter" :class="{ 'delay-2': isMobile }">
          <RouterView />
        </div>
      </el-main>

      <!-- ======== 移动端：底部 Tab 栏 ======== -->
      <el-footer
        v-if="isMobile"
        class="chronos-tabbar glass"
      >
        <div class="tabbar-inner">
          <button
            v-for="tab in tabbarItems"
            :key="tab.key"
            class="tabbar-item"
            :class="{ active: activeKey === tab.key }"
            @click="onSelect(tab.key)"
          >
            <div class="tabbar-icon-wrap">
              <el-badge v-if="tab.badge > 0" :value="tab.badge" :max="99" type="danger">
                <el-icon :size="22" class="tabbar-icon">
                  <component :is="tab.icon" />
                </el-icon>
              </el-badge>
              <el-icon v-else :size="22" class="tabbar-icon">
                <component :is="tab.icon" />
              </el-icon>
              <div v-if="activeKey === tab.key" class="tabbar-active-dot"></div>
            </div>
            <div class="tabbar-label">{{ tab.label }}</div>
          </button>
        </div>
        <!-- iPhone 底部安全区 -->
        <div class="tabbar-safearea"></div>
      </el-footer>

    </el-container>
  </el-container>
</template>

<style scoped>
/* ============================================================
   Chronos 布局（Element Plus 版本）
   ============================================================ */
.chronos-layout {
  height: 100vh;
  width: 100%;
  overflow: hidden;
}
.chronos-main-container {
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ========== 侧边栏（桌面端） ========== */
.chronos-sider {
  display: flex;
  flex-direction: column;
  border-right: 1px solid var(--border);
  position: relative;
  overflow: hidden;
  z-index: 5;
}
.glass-sider {
  background: var(--surface);
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
}
.sider-bg-deco {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 0% 0%, rgba(0, 212, 255, 0.06) 0%, transparent 50%),
    radial-gradient(circle at 100% 100%, rgba(168, 85, 247, 0.06) 0%, transparent 50%);
  background-size: auto, auto;
  pointer-events: none;
  opacity: 0.9;
  z-index: 0;
}
.brand-wrap {
  padding: 20px 18px 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  position: relative;
  z-index: 2;
}
.brand-logo-img {
  width: 42px;
  height: 42px;
  border-radius: 11px;
  object-fit: contain;
  flex-shrink: 0;
  border: 1px solid var(--border);
  background: var(--bg-2);
}
.brand-text { min-width: 0; flex: 1; }
.brand-name {
  font-size: 15px;
  font-weight: var(--font-weight-black);
  line-height: 1.2;
  color: var(--text);
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-tag {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 3px;
  letter-spacing: 0.02em;
}

/* 导航菜单 */
.nav-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 10px 12px;
  position: relative;
  z-index: 2;
}
.nav-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-muted);
  padding: 12px 10px 10px;
}
.nav-label :deep(.el-icon) {
  color: var(--primary);
}

/* Element Plus 菜单样式覆盖 */
.chronos-menu {
  border-right: none !important;
}
.chronos-menu :deep(.el-menu-item),
.chronos-menu :deep(.el-menu-item.is-active) {
  height: 42px;
  line-height: 42px;
  border-radius: 10px;
  margin: 2px 0;
  padding: 0 14px !important;
  transition: all 0.22s var(--ease-out);
  border: 1px solid transparent;
}
.chronos-menu :deep(.el-menu-item:hover) {
  background: var(--bg-2) !important;
  border-color: var(--border);
  transform: translateX(2px);
}
.chronos-menu :deep(.el-menu-item.is-active) {
  background: var(--primary-soft) !important;
  border-color: var(--primary);
  box-shadow: 0 2px 8px var(--primary-soft);
  color: var(--primary) !important;
  font-weight: var(--font-weight-bold);
}
.menu-item-icon {
  margin-right: 10px;
  font-size: 18px;
}

/* 侧边栏底部 */
.sider-footer {
  padding: 12px 14px 16px;
  border-top: 1px solid var(--border);
  margin-top: 4px;
  position: relative;
  z-index: 2;
}
.cloud-card {
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-radius: 12px;
  border: 1px solid var(--border);
}
.cloud-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: var(--font-weight-medium);
  color: var(--text-muted);
}
.cloud-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  margin-left: auto;
  display: inline-block;
}
.cloud-status.on {
  background: var(--chrono-green);
  box-shadow: 0 0 8px var(--chrono-green);
  animation: chronos-pulse-glow 2.4s ease-in-out infinite;
}
.cloud-status.off {
  background: var(--chrono-amber);
  box-shadow: 0 0 6px var(--chrono-amber);
}
.cloud-control { flex-shrink: 0; }

/* 侧边栏用户小卡 */
.sider-user-card {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 10px 11px;
  border-radius: 12px;
  cursor: pointer;
  background: var(--bg-2);
  border: 1px solid var(--border);
  transition: all 0.22s var(--ease-out);
}
.sider-user-card:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  transform: translateX(2px);
}
.sider-avatar {
  background: linear-gradient(135deg, var(--primary) 0%, #A855F7 100%) !important;
  color: white !important;
  font-weight: var(--font-weight-bold);
  font-size: 14px;
  box-shadow: 0 0 16px var(--primary-soft);
  flex-shrink: 0;
}
.sider-user-info {
  display: flex;
  flex-direction: column;
  line-height: 1.25;
  min-width: 0;
  flex: 1;
}
.sider-user-name {
  font-size: 13.5px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sider-user-role {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 2px;
}

/* ========== 顶栏 ========== */
.chronos-topbar {
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  z-index: 10;
  flex-shrink: 0;
  backdrop-filter: blur(16px) saturate(140%);
  -webkit-backdrop-filter: blur(16px) saturate(140%);
}
.chronos-topbar.is-mobile {
  height: 58px;
  padding: 0 14px;
  background: rgba(255, 255, 255, 0.92);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  box-shadow: 0 1px 8px rgba(0, 0, 0, 0.04);
  position: sticky;
  top: 0;
}
:global(html.dark) .chronos-topbar.is-mobile {
  background: rgba(20, 24, 36, 0.92);
}

/* 顶栏：页面身份 */
.page-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.page-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.page-title {
  font-size: 19px;
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  color: var(--text);
  letter-spacing: -0.01em;
  margin: 0;
}
.chrono-stamp {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 10.5px;
  font-weight: var(--font-weight-bold);
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid var(--primary-soft);
  border-radius: 6px;
  letter-spacing: 0.05em;
}
.page-subtitle {
  font-size: 12.5px;
  color: var(--text-muted);
}

/* 顶栏右侧按钮组 */
.topbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}
.topbar-tags {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-right: 6px;
}
.topbar-icon-btn {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text);
  background: var(--bg-2);
  border: 1px solid var(--border);
  transition: all 0.2s var(--ease-out);
  padding: 0;
  font-size: 16px;
}
.topbar-icon-btn:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-1px);
}
.theme-btn {
  font-size: 16px;
}
.user-avatar-wrap {
  cursor: pointer;
  padding: 2px;
  border-radius: 50%;
  border: 2px solid transparent;
  transition: all 0.2s var(--ease-out);
}
.user-avatar-wrap:hover,
.user-avatar-wrap.active {
  border-color: var(--primary);
  transform: scale(1.05);
}
.topbar-avatar {
  background: linear-gradient(135deg, var(--primary) 0%, #A855F7 100%) !important;
  color: white !important;
  font-weight: var(--font-weight-bold);
  font-size: 13px;
}

/* 背景面板 Popover 样式 */
:global(.bg-panel-popover) {
  padding: 0 !important;
  border-radius: 14px !important;
  overflow: hidden;
  border: 1px solid var(--border) !important;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.15) !important;
  background: var(--surface) !important;
  backdrop-filter: blur(20px) saturate(160%);
  -webkit-backdrop-filter: blur(20px) saturate(160%);
}
.bg-panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 12px;
}
.bg-panel-title {
  font-size: 14px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
}
.bg-panel-close {
  color: var(--text-muted);
  padding: 4px;
}
.bg-panel-close:hover {
  color: var(--primary);
}

/* ============================================================
   移动端专项样式
   ============================================================ */
/* 汉堡按钮 */
.chronos-hamburger {
  width: 38px !important;
  height: 38px !important;
  padding: 0 !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  background: var(--bg-2) !important;
  border: 1px solid var(--border) !important;
  border-radius: 10px !important;
  color: var(--text) !important;
  transition: all 0.2s var(--ease-out) !important;
}
.chronos-hamburger:hover {
  background: var(--primary-soft) !important;
  border-color: var(--primary) !important;
  color: var(--primary) !important;
}
.chronos-hamburger:active {
  transform: scale(0.96);
}

/* 迷你品牌 */
.mobile-mini-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14.5px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
  letter-spacing: -0.01em;
}
.mobile-mini-brand .brand-logo-icon.mini {
  color: var(--primary);
}
.mobile-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 抽屉 */
:global(.mobile-drawer) :deep(.el-drawer__body) {
  padding: 0;
  background: var(--surface);
}
.drawer-inner {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 18px 16px 14px;
  border-bottom: 1px solid var(--border);
}
.drawer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.brand-logo-icon {
  color: var(--primary);
}
.drawer-title {
  font-size: 15px;
  font-weight: var(--font-weight-black);
  color: var(--text);
}
.drawer-subtitle {
  font-size: 11.5px;
  color: var(--text-muted);
  margin-top: 3px;
}
.drawer-close-btn {
  color: var(--text-muted);
  padding: 4px;
}
.mobile-menu-wrap {
  margin: 8px 0;
  flex: 1;
  overflow-y: auto;
  padding: 0 10px;
}
.drawer-footer {
  padding: 14px 14px 18px;
  border-top: 1px solid var(--border);
}

/* 移动端页面标题 */
.mobile-page-title-wrap {
  margin-bottom: 14px;
}
.mobile-page-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}
.mobile-page-title-row h2 {
  font-size: 18px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
}
.mobile-page-subtitle {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.5;
}

/* ============================================================
   内容区 Banner
   ============================================================ */
.chronos-content {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px 36px;
  background: transparent;
  position: relative;
  z-index: 1;
}
.chronos-content.is-mobile {
  padding: 14px 14px 100px;
}
.chronos-banner {
  border-radius: 18px;
  padding: 20px 24px;
  border: 1px solid var(--border);
  margin-bottom: 24px;
  overflow: hidden;
  position: relative;
}
.chronos-banner::before {
  content: '';
  position: absolute;
  inset: 0;
  background:
    radial-gradient(circle at 100% 0%, var(--primary-soft) 0%, transparent 50%),
    radial-gradient(circle at 0% 100%, rgba(168, 85, 247, 0.08) 0%, transparent 50%);
  pointer-events: none;
}
.chronos-banner-content {
  position: relative;
  z-index: 1;
}
.chronos-banner-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  background: var(--chrono-green-soft, rgba(34, 197, 94, 0.1));
  color: var(--chrono-green, #22c55e);
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: var(--font-weight-bold);
  letter-spacing: 0.04em;
  margin-bottom: 10px;
}
.chronos-banner-tag .pulse {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--chrono-green, #22c55e);
  box-shadow: 0 0 8px var(--chrono-green, #22c55e);
  animation: chronos-pulse-glow 2s ease-in-out infinite;
}
.chronos-banner-title {
  font-size: 18px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
  line-height: 1.3;
  margin-bottom: 4px;
}
.chronos-banner-subtitle {
  font-size: 12.5px;
  color: var(--text-muted);
  margin-bottom: 14px;
}
.chronos-banner-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 14px;
}
.chronos-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--text-muted);
  font-weight: var(--font-weight-medium);
}
.chronos-meta-item .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--text-muted);
}

/* ============================================================
   移动端底部 Tab Bar
   ============================================================ */
.chronos-tabbar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 20;
  background: rgba(255, 255, 255, 0.96) !important;
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--border);
  height: 66px;
  padding: 0 !important;
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.05);
}
:global(html.dark) .chronos-tabbar {
  background: rgba(20, 24, 36, 0.96) !important;
}
.tabbar-inner {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: 66px;
  align-items: stretch;
}
.tabbar-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: transparent;
  border: none;
  cursor: pointer;
  position: relative;
  color: var(--text-muted);
  transition: all 0.25s var(--ease-out);
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}
.tabbar-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s var(--ease-bounce, cubic-bezier(.2,.8,.2,1));
}
.tabbar-icon {
  transition: all 0.25s;
}
.tabbar-label {
  font-size: 10.5px;
  font-weight: var(--font-weight-medium);
  letter-spacing: 0.02em;
  transition: all 0.25s;
}
.tabbar-item.active {
  color: var(--primary);
}
.tabbar-item.active .tabbar-icon {
  filter: drop-shadow(0 2px 6px var(--primary-soft));
  transform: translateY(-2px) scale(1.08);
}
.tabbar-item.active .tabbar-label {
  font-weight: var(--font-weight-bold);
  color: var(--primary);
}
.tabbar-active-dot {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--primary), #A855F7);
  box-shadow: 0 0 6px var(--primary-soft);
}
.tabbar-safearea {
  height: env(safe-area-inset-bottom, 0);
  background: inherit;
}

/* 页面入场动画 */
.page-enter {
  animation: pageIn 0.5s var(--ease-out, cubic-bezier(.2,.8,.2,1)) both;
}
.page-enter.delay-1 { animation-delay: 80ms; }
.page-enter.delay-2 { animation-delay: 160ms; }
@keyframes pageIn {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes chronos-pulse-glow {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.7; transform: scale(1.15); }
}

/* 小屏幕微调 */
@media (max-width: 640px) {
  .chronos-banner {
    padding: 16px 16px;
    margin-bottom: 16px;
  }
  .chronos-banner-title {
    font-size: 16px;
  }
  .chronos-banner-subtitle {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .chronos-banner-meta {
    gap: 10px;
  }
  .chronos-content.is-mobile {
    padding: 12px 12px 100px;
  }
}
</style>
