<script setup lang="ts">
import logo from '@/assets/logo.png'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  CloudUploadOutline,
  SearchOutline,
  BarChartOutline,
  SwapHorizontalOutline,
  WalletOutline,
  DiamondOutline,
  AppsOutline,
  PersonOutline,
  SparklesSharp,
  CloudOutline,
  CloudOfflineOutline,
  MenuOutline,
  TimeOutline,
  CloseOutline,
  ChevronBackOutline,
  ChevronForwardOutline,
} from '@vicons/ionicons5'
import type { DropdownOption, MenuValue } from 'tdesign-vue-next'
import AppIcon from '@/components/AppIcon.vue'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { clearLocalData } from '@/utils/db'
import { message } from '@/utils/feedback'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()

// ═══════════ 主题切换下拉 ═══════════
const themeOptions = computed<DropdownOption[]>(() => {
  const themes = themeStore.list.map((t) => ({
    content: `${t.emoji}  ${t.label}`,
    value: t.id,
    active: themeStore.mode === 'manual' && themeStore.selectedId === t.id,
  }))
  return [
    {
      group: '主题 · 手动',
      children: themes,
    },
    { divider: true },
    {
      content: '跟随系统',
      value: 'auto',
      active: themeStore.mode === 'auto',
    },
  ]
})

function handleThemeSelect(item: DropdownOption | string | number | undefined) {
  const val = item !== null && typeof item === 'object' ? item.value : item
  const key = String(val ?? '')
  if (key === 'auto') {
    themeStore.setMode('auto')
    return
  }
  themeStore.setTheme(key as Parameters<typeof themeStore.setTheme>[0])
}

// ═══════════ 响应式：是否移动端 ═══════════
const isMobile = ref(false)
const drawerVisible = ref(false)
const collapsed = ref(false)

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
  }
)

// ═══════════ 菜单配置 ═══════════
const menuItems = [
  { key: 'repos', label: '聊天仓库', icon: CloudUploadOutline },
  { key: 'explore', label: '对话探索', icon: SearchOutline },
  { key: 'stats', label: '数据统计', icon: BarChartOutline },
  { key: 'alpaca', label: 'Alpaca 导出', icon: SwapHorizontalOutline },
  { key: 'balance', label: '余额', icon: WalletOutline },
  { key: 'pricing', label: '升级方案', icon: DiamondOutline },
  { key: 'market', label: '模型市场', icon: AppsOutline },
  { key: 'profile', label: '个人中心', icon: PersonOutline },
]

const activeKey = computed(() => (route.name as string) || 'repos')
function onSelect(key: MenuValue) {
  router.push({ name: String(key) })
}

const MENU_LABELS: Record<string, { title: string; subtitle: string; chrono: string }> = {
  repos:     { title: '聊天仓库',     subtitle: 'Git 版本化管理你的对话记录（DeepSeek / ChatGPT）', chrono: '仓库管理' },
  explore:   { title: '对话探索',     subtitle: '搜索、浏览和继续你的对话', chrono: '对话记录管理' },
  stats:     { title: '数据统计',     subtitle: '对话量、模型分布、活跃时段', chrono: '数据概览' },
  alpaca:    { title: 'Alpaca 导出',  subtitle: '导出为微调训练数据格式', chrono: '数据导出' },
  balance:   { title: '余额',         subtitle: 'API Key 余额与用量信息', chrono: '账户信息' },
  pricing:   { title: '升级方案',     subtitle: 'Pro / Plus / Ultimate 三档权益与支付', chrono: '付费中心' },
  market:    { title: '模型市场',     subtitle: '工具生态与官方资源', chrono: '资源中心' },
  profile:   { title: '个人中心',     subtitle: '账号设置、密钥管理', chrono: '账号管理' },
}
function menuTitle(key: string): string { return MENU_LABELS[key]?.title || '' }
function menuSubtitle(key: string): string { return MENU_LABELS[key]?.subtitle || '' }
function menuChrono(key: string): string { return MENU_LABELS[key]?.chrono || '' }

// ═══════════ 移动端底部Tab（取前5个高频功能） ═══════════
const tabbarItems = computed(() => [
  { key: 'repos', label: '仓库', icon: CloudUploadOutline, badge: 0 },
  { key: 'explore', label: '探索', icon: SearchOutline, badge: 0 },
  { key: 'stats', label: '统计', icon: BarChartOutline, badge: 0 },
  { key: 'market', label: '市场', icon: AppsOutline, badge: 0 },
  { key: 'profile', label: '我的', icon: PersonOutline, badge: 0 },
])

// ═══════════ 云端同步控制 ═══════════
async function onCloudSync(value: unknown) {
  const next = value === true
  try {
    await auth.setCloudSync(next)
    if (!next) {
      await clearLocalData()
      message.success('已切换为仅本地存储，本地索引已清空')
    } else {
      message.success('已开启云端存储，上传的对话将同步到云端')
    }
  } catch {
    /* 错误已由拦截器提示 */
  }
}

// ═══════════ Chronos Banner 动态数据 ═══════════
const todayStr = computed(() => {
  const d = new Date(Date.now() + 8 * 3600 * 1000)
  const wd = ['星期日','星期一','星期二','星期三','星期四','星期五','星期六'][d.getUTCDay()]
  return `${d.getUTCFullYear()}.${String(d.getUTCMonth()+1).padStart(2,'0')}.${String(d.getUTCDate()).padStart(2,'0')} · ${wd}`
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
</script>

<template>
  <t-layout class="chronos-layout">
    <!-- ════════════════════════════════════
         桌面端：常驻侧边栏
         ════════════════════════════════════ -->
    <t-aside
      v-if="!isMobile"
      :width="collapsed ? '84px' : '272px'"
      class="app-aside"
    >
      <div class="sider-inner">
        <!-- 侧边栏装饰：轻量光晕 -->
        <div class="sider-bg-deco" aria-hidden="true"></div>

        <!-- 品牌区 -->
        <div class="brand-wrap">
          <img :src="logo" alt="Logo">
        </div>

        <!-- 导航菜单 -->
        <div class="nav-wrap">
          <div class="nav-label">
            <AppIcon :size="12"><TimeOutline /></AppIcon>
            <span>工作台导航</span>
          </div>
          <t-menu
            :value="activeKey"
            :collapsed="collapsed"
            :width="['238px', '56px']"
            @change="onSelect"
          >
            <t-menu-item v-for="m in menuItems" :key="m.key" :value="m.key">
              <template #icon>
                <AppIcon :size="18"><component :is="m.icon" /></AppIcon>
              </template>
              {{ m.label }}
            </t-menu-item>
          </t-menu>
        </div>

        <!-- 底部：云端同步 + 用户信息 -->
        <div class="sider-footer">
          <div class="cloud-card">
            <div class="cloud-header">
              <AppIcon :size="16">
                <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
              </AppIcon>
              <span class="cloud-title-text">{{ auth.cloudSyncEnabled ? '云端同步' : '离线模式' }}</span>
              <span class="cloud-status" :class="auth.cloudSyncEnabled ? 'on' : 'off'"></span>
            </div>
            <div class="cloud-control">
              <t-switch
                :value="auth.cloudSyncEnabled"
                size="small"
                @change="onCloudSync"
              />
            </div>
          </div>

          <!-- 用户小卡 -->
          <div class="sider-user-card" @click="router.push('/profile')">
            <t-avatar size="34px" class="sider-avatar">
              {{ (auth.user?.username || 'U').charAt(0).toUpperCase() }}
            </t-avatar>
            <div class="sider-user-info">
              <div class="sider-user-name">{{ auth.user?.username || '用户' }}</div>
              <div class="sider-user-role">
                {{ auth.isAdmin ? '管理员' : '用户' }}
              </div>
            </div>
          </div>

          <!-- 折叠按钮 -->
          <button
            class="collapse-btn"
            type="button"
            :title="collapsed ? '展开侧边栏' : '收起侧边栏'"
            @click="collapsed = !collapsed"
          >
            <AppIcon :size="16">
              <component :is="collapsed ? ChevronForwardOutline : ChevronBackOutline" />
            </AppIcon>
          </button>
        </div>
      </div>
    </t-aside>

    <!-- ════════════════════════════════════
         移动端：抽屉式侧边栏
         ════════════════════════════════════ -->
    <t-drawer
      v-if="isMobile"
      v-model:visible="drawerVisible"
      placement="left"
      size="300px"
      :footer="false"
      :close-btn="true"
      header="Deepseek Toolkit 导航"
    >
      <!-- 抽屉里的菜单 -->
      <div class="mobile-menu-wrap">
        <t-menu :value="activeKey" @change="onSelect">
          <t-menu-item v-for="m in menuItems" :key="m.key" :value="m.key">
            <template #icon>
              <AppIcon :size="18"><component :is="m.icon" /></AppIcon>
            </template>
            {{ m.label }}
          </t-menu-item>
        </t-menu>
      </div>

      <!-- 抽屉底部：云端同步 -->
      <div class="drawer-footer">
        <div class="cloud-card" style="margin-bottom: 12px;">
          <div class="cloud-header">
            <AppIcon :size="16">
              <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
            </AppIcon>
            <span class="cloud-title-text">{{ auth.cloudSyncEnabled ? '云端同步中' : '离线模式' }}</span>
          </div>
          <div class="cloud-control">
            <t-switch
              :value="auth.cloudSyncEnabled"
              size="small"
              @change="onCloudSync"
            />
          </div>
        </div>

        <div class="sider-user-card" @click="onSelect('profile')">
          <t-avatar size="36px" class="sider-avatar">
            {{ (auth.user?.username || 'U').charAt(0).toUpperCase() }}
          </t-avatar>
          <div class="sider-user-info">
            <div class="sider-user-name">{{ auth.user?.username || '用户' }}</div>
            <div class="sider-user-role">
              {{ auth.isAdmin ? '管理员' : '用户' }}
            </div>
          </div>
        </div>
      </div>
    </t-drawer>

    <!-- ════════════════════════════════════
         主内容区（移动端 & 桌面端共用容器）
         ════════════════════════════════════ -->
    <t-layout class="main-col">

      <!-- ======== 顶部栏 ======== -->
      <t-header class="app-topbar" :class="{ mobile: isMobile }">
        <!-- 移动端左侧：汉堡按钮 + 品牌迷你Logo -->
        <div v-if="isMobile" class="mobile-topbar-left">
          <button class="chronos-hamburger" aria-label="打开菜单" @click="drawerVisible = true">
            <AppIcon :size="22"><MenuOutline /></AppIcon>
          </button>
          <div class="mobile-mini-brand">
            <AppIcon :size="16" class="brand-logo-icon mini"><SparklesSharp /></AppIcon>
            <span>Deepseek Toolkit</span>
          </div>
        </div>

        <!-- 右侧：状态 + 用户 -->
        <div class="topbar-right">
          <!-- 主题切换（桌面+移动都显示） -->
          <t-dropdown
            :options="themeOptions"
            trigger="click"
            placement="bottom-right"
            @click="handleThemeSelect"
          >
            <button
              class="chronos-hamburger"
              type="button"
              aria-label="切换主题"
              :title="`主题：${themeStore.current.label}${themeStore.mode === 'auto' ? '（跟随系统）' : ''}`"
            >
              <span style="font-size: 16px;">{{ themeStore.current.emoji }}</span>
            </button>
          </t-dropdown>

          <!-- 状态标签组（桌面端完整 / 移动端精简） -->
          <div v-if="!isMobile" class="status-tags">
            <t-tag v-if="auth.isAdmin" theme="warning" size="small" shape="round">
              <template #icon><AppIcon :size="12"><SparklesSharp /></AppIcon></template>
              管理员
            </t-tag>
            <t-tag theme="default" size="small" shape="round" variant="light">
              <template #icon>
                <AppIcon :size="12">
                  <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
                </AppIcon>
              </template>
              {{ auth.cloudSyncEnabled ? '云端同步' : '离线' }}
            </t-tag>
          </div>

          <!-- 移动端：云端状态小图标 -->
          <t-tag
            v-if="isMobile"
            theme="default"
            size="small"
            variant="light"
          >
            <template #icon>
              <AppIcon :size="11">
                <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
              </AppIcon>
            </template>
          </t-tag>
        </div>
      </t-header>

      <!-- ======== 内容主体 ======== -->
      <t-content
        class="chronos-content"
        :class="{ mobile: isMobile }"
      >
        <!-- ========== Chronos 每日日程报 Banner（桌面+移动端都显示） ========== -->
        <div class="chronos-banner page-enter">
          <div class="chronos-banner-content">
            <div class="chronos-banner-tag">
              <span class="pulse"></span>
              <span>工作台就绪</span>
            </div>
            <div class="chronos-banner-title">
              <span>你好，{{ auth.user?.username || '用户' }}，开始管理你的对话数据吧。</span>
            </div>
            <div class="chronos-banner-subtitle">
              Git 版本化仓库管理 · {{ menuTitle(activeKey) }} 功能可用 · 最近同步：刚刚
            </div>
            <div class="chronos-banner-meta">
              <div class="chronos-meta-item">
                <span class="dot"></span>
                <span>{{ todayStr }}</span>
              </div>
              <div class="chronos-meta-item">
                <span class="dot" style="background: var(--accent); box-shadow: 0 0 6px var(--accent);"></span>
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
      </t-content>

      <!-- ======== 移动端：底部 Tab 栏 ======== -->
      <t-footer v-if="isMobile" class="chronos-tabbar">
        <div class="tabbar-inner">
          <button
            v-for="tab in tabbarItems"
            :key="tab.key"
            class="tabbar-item"
            :class="{ active: activeKey === tab.key }"
            @click="onSelect(tab.key)"
          >
            <div class="tabbar-icon-wrap">
              <t-badge v-if="tab.badge > 0" :count="tab.badge" :max="99">
                <AppIcon :size="22" class="tabbar-icon"><component :is="tab.icon" /></AppIcon>
              </t-badge>
              <AppIcon v-else :size="22" class="tabbar-icon"><component :is="tab.icon" /></AppIcon>
            </div>
            <div class="tabbar-label">{{ tab.label }}</div>
          </button>
        </div>
        <!-- iPhone 底部安全区 -->
        <div class="tabbar-safearea"></div>
      </t-footer>

    </t-layout>
  </t-layout>
</template>

<style scoped>
/* ============================================================
   TDesign 布局：侧栏 + 顶栏 + 内容
   ============================================================ */

.chronos-layout {
  min-height: 100vh;
  background: transparent;
}

/* 侧边栏 */
.app-aside {
  position: sticky;
  top: 0;
  height: 100vh;
  z-index: 30;
  background: var(--surface);
  border-right: 1px solid var(--border);
  transition: width 200ms var(--ease-out);
}
.sider-inner {
  position: relative;
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 侧边栏背景装饰 */
.sider-bg-deco {
  position: absolute;
  inset: 0;
  background:
    radial-gradient(ellipse 80% 40% at 50% 0%, var(--primary-soft) 0%, transparent 70%);
  pointer-events: none;
}

/* 品牌区 */
.brand-wrap {
  padding: 18px 16px 10px;
  position: relative;
  z-index: 2;
}
.brand-wrap img {
  max-width: 180px;
  max-height: 42px;
  object-fit: contain;
}

/* 导航 */
.nav-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 8px 12px;
  position: relative;
  z-index: 2;
}
.nav-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--text-muted);
  padding: 12px 10px 10px;
}
.nav-label :deep(.app-icon) {
  color: var(--primary);
}

/* 菜单透传透明背景 */
.nav-wrap :deep(.t-menu) {
  background: transparent;
}

/* 底部 footer */
.sider-footer {
  padding: 10px 12px 12px;
  border-top: 1px solid var(--border-subtle);
  margin-top: 4px;
  position: relative;
  z-index: 2;
}
.cloud-card {
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 10px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.cloud-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
}
.cloud-title-text { min-width: 0; }
.cloud-status {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  display: inline-block;
}
.cloud-status.on {
  background: var(--success);
  box-shadow: 0 0 6px var(--success);
  animation: cloud-pulse 2.4s ease-in-out infinite;
}
.cloud-status.off {
  background: var(--warning);
  box-shadow: 0 0 6px var(--warning);
}
@keyframes cloud-pulse {
  0%, 100% { box-shadow: 0 0 4px var(--success); }
  50%      { box-shadow: 0 0 10px var(--success); }
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
  background: var(--surface);
  border: 1px solid var(--border);
  transition: all var(--transition-fast);
}
.sider-user-card:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
}
.sider-avatar {
  background: var(--primary-soft);
  color: var(--primary);
  font-weight: 700;
  font-size: 14px;
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
  font-weight: 600;
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

/* 折叠按钮 */
.collapse-btn {
  margin-top: 10px;
  width: 100%;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border);
  background: var(--surface);
  border-radius: 8px;
  color: var(--text-muted);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.collapse-btn:hover {
  color: var(--primary);
  border-color: var(--primary);
}

/* ========== 顶栏 ========== */
.main-col {
  min-width: 0;
}
.app-topbar {
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: transparent;
  border-bottom: 1px solid var(--border-subtle);
  z-index: 10;
  width: 100%;
}
.app-topbar.mobile {
  height: 58px;
  padding: 0 14px;
  position: sticky;
  top: 0;
  background: color-mix(in srgb, var(--surface) 92%, transparent);
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  border-bottom: 1px solid var(--border);
}
.topbar-right {
  display: flex;
  align-items: center;
  gap: 20px;
}
.app-topbar.mobile .topbar-right { gap: 10px; }
.status-tags {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 汉堡按钮 */
.chronos-hamburger {
  width: 38px;
  height: 38px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 10px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.chronos-hamburger:hover {
  border-color: var(--primary);
  color: var(--primary);
}
.chronos-hamburger:active { transform: scale(0.96); }

/* 迷你品牌 */
.mobile-mini-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14.5px;
  font-weight: 800;
  color: var(--text);
  letter-spacing: -0.01em;
}
.mobile-mini-brand :deep(.app-icon) {
  color: var(--primary);
}
.mobile-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 抽屉底部 */
.mobile-menu-wrap { margin: 8px 0; }
.drawer-footer {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

/* 移动端页面标题 */
.mobile-page-title-wrap { margin-bottom: 14px; }
.mobile-page-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 3px;
}
.mobile-page-subtitle {
  font-size: 12.5px;
  color: var(--text-muted);
  line-height: 1.5;
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
  height: auto;
  padding: 0;
  background: color-mix(in srgb, var(--surface) 96%, transparent);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-top: 1px solid var(--border);
}
.tabbar-inner {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  height: 62px;
  align-items: stretch;
  max-width: 560px;
  margin: 0 auto;
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
}
.tabbar-icon-wrap {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.3s var(--ease-bounce);
}
.tabbar-icon { transition: all 0.25s; }
.tabbar-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: all 0.25s;
}
.tabbar-item.active { color: var(--primary); }
.tabbar-item.active .tabbar-icon {
  filter: drop-shadow(0 2px 6px var(--primary-soft));
  transform: translateY(-2px) scale(1.08);
}
.tabbar-item.active .tabbar-label {
  font-weight: 700;
  color: var(--primary);
}
.tabbar-safearea {
  height: env(safe-area-inset-bottom, 0);
  background: inherit;
}

/* ============================================================
   小屏幕微调
   ============================================================ */

@media (max-width: 640px) {
  .chronos-banner-subtitle {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
}
</style>
