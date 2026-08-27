<script setup lang="ts">
import logo from '@/assets/logo.png'
import { computed, h, onMounted, onUnmounted, ref, watch, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NLayoutFooter,
  NMenu,
  NSwitch,
  NSpace,
  NIcon,
  NText,
  NTag,
  NAvatar,
  NBadge,
  NDrawer,
  NDrawerContent,
  NDropdown,
  type MenuOption,
  type DropdownOption,
} from 'naive-ui'
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
  HomeOutline,
  GridOutline,
  CloseOutline,
  ColorPaletteOutline,
  CheckmarkOutline,
  DesktopOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { useThemeStore } from '@/stores/theme'
import { clearLocalData } from '@/utils/db'
import { message } from '@/utils/naive'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()

// ═══════════ 主题切换下拉 ═══════════
const themeDropdownOptions = computed<DropdownOption[]>(() => {
  const themes = themeStore.list.map((t) => ({
    label: `${t.emoji}  ${t.label}`,
    key: t.id,
    type: 'option' as const,
    props: { style: 'font-weight: 500;' },
  }))
  return [
    {
      key: 'group-manual',
      type: 'group',
      label: '主题 · 手动',
      children: themes,
    },
    {
      key: 'divider',
      type: 'divider',
    },
    {
      key: 'auto',
      label: themeStore.mode === 'auto' ? '✓  跟随系统' : '   跟随系统',
      type: 'option',
      props: { style: 'font-weight: 500;' },
    },
  ] as DropdownOption[]
})
function handleThemeSelect(key: string | number) {
  if (key === 'auto') {
    themeStore.setMode('auto')
    return
  }
  themeStore.setTheme(key as any)
}

// ═══════════ 响应式：是否移动端 ═══════════
const isMobile = ref(false)
const drawerVisible = ref(false)

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

function icon(Comp: Component, size = 18) {
  return () => h(NIcon, { size }, { default: () => h(Comp) })
}

// ═══════════ 菜单配置 ═══════════
const menuOptions = computed<MenuOption[]>(() => [
  { label: '账号配置', key: 'configs', icon: icon(CloudUploadOutline) },
  { label: '对话探索', key: 'explore', icon: icon(SearchOutline) },
  { label: '数据统计', key: 'stats', icon: icon(BarChartOutline) },
  { label: 'Alpaca 导出', key: 'alpaca', icon: icon(SwapHorizontalOutline) },
  { label: '余额', key: 'balance', icon: icon(WalletOutline) },
  { label: '升级方案', key: 'pricing', icon: icon(DiamondOutline) },
  { label: '模型市场', key: 'market', icon: icon(AppsOutline) },
  { label: '个人中心', key: 'profile', icon: icon(PersonOutline) },
])

const activeKey = computed(() => (route.name as string) || 'configs')
function onSelect(key: string) {
  router.push({ name: key })
}

const MENU_LABELS: Record<string, { title: string; subtitle: string; chrono: string }> = {
  configs:   { title: '账号配置',     subtitle: '上传与管理你的 Deepseek 数据', chrono: '数据配置中心' },
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
  { key: 'configs', label: '配置', icon: CloudUploadOutline, badge: 0 },
  { key: 'explore', label: '探索', icon: SearchOutline, badge: 0 },
  { key: 'stats', label: '统计', icon: BarChartOutline, badge: 0 },
  { key: 'market', label: '市场', icon: AppsOutline, badge: 0 },
  { key: 'profile', label: '我的', icon: PersonOutline, badge: 0 },
])

// ═══════════ 云端同步控制 ═══════════
async function onCloudSync(value: boolean) {
  try {
    await auth.setCloudSync(value)
    if (!value) {
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
const timelineNo = '#' + Math.floor(Math.random() * 900 + 100)
const timelineShift = ['正常','运行中','已连接','轻微延迟','同步完成'][Math.floor(Math.random() * 5)]
</script>

<template>
  <NLayout :has-sider="!isMobile" position="absolute" style="height: 100vh" class="chronos-layout">

    <!-- ════════════════════════════════════
         桌面端：常驻侧边栏
         ════════════════════════════════════ -->
    <NLayoutSider
      v-if="!isMobile"
      :width="272"
      :collapsed-width="84"
      content-style="display: flex; flex-direction: column; background: linear-gradient(180deg, #ffffffff 0%, #ffffffff 100%); border-right: 1px solid rgba(255, 255, 255, 0.14); position: relative; overflow: hidden;"
      show-trigger="bar"
      trigger-style="color: rgba(255, 255, 255, 0.4); background: #ffffffff;"
    >
      <!-- 侧边栏装饰：流光网格 -->
      <div class="sider-bg-deco" aria-hidden="true"></div>

      <!-- 品牌卡片：时间管理局徽章 -->
      <div class="brand-wrap">
            <img :src="logo" alt="Logo">
      </div>

      <!-- 导航菜单 -->
      <div class="nav-wrap">
        <div class="nav-label">
          <NIcon size="12"><TimeOutline /></NIcon>
          <span>工作台导航</span>
        </div>
        <NMenu
          :value="activeKey"
          :options="menuOptions"
          :indent="12"
          @update:value="onSelect"
          style="padding: 4px; background: transparent; border: none;"
        />
      </div>

      <!-- 底部：云端同步 + 用户信息 -->
      <div class="sider-footer">
        <div class="cloud-card">
          <div class="cloud-header">
            <NIcon size="16" :component="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
            <span>{{ auth.cloudSyncEnabled ? '云端同步' : '离线模式' }}</span>
            <span class="cloud-status" :class="auth.cloudSyncEnabled ? 'on' : 'off'"></span>
          </div>
          <div class="cloud-control">
            <NSwitch
              :value="auth.cloudSyncEnabled"
              @update:value="onCloudSync"
              size="small"
            >
              <template #checked><NIcon size="12"><CloudOutline /></NIcon></template>
              <template #unchecked><NIcon size="12"><CloudOfflineOutline /></NIcon></template>
            </NSwitch>
          </div>
        </div>

        <!-- 用户小卡 -->
        <div class="sider-user-card" @click="router.push('/profile')">
          <NAvatar round :size="34" class="sider-avatar">
            {{ (auth.user?.username || 'U').charAt(0).toUpperCase() }}
          </NAvatar>
          <div class="sider-user-info">
            <div class="sider-user-name">{{ auth.user?.username || '用户' }}</div>
            <div class="sider-user-role">
              {{ auth.isAdmin ? '管理员' : '用户' }}
            </div>
          </div>
        </div>
      </div>
    </NLayoutSider>

    <!-- ════════════════════════════════════
         移动端：抽屉式侧边栏
         ════════════════════════════════════ -->
    <NDrawer
      v-if="isMobile"
      v-model:show="drawerVisible"
      :placement="'left'"
      :mask-closable="true"
      :scrollable="false"
      show-icon
    >
      <NDrawerContent
        title="Deepseek Toolkit 导航"
        :style="{ background: 'linear-gradient(180deg, #ffffffff 0%, #ffffffff 100%)', color: '#E8F7FF' }"
      >
        <template #header>
          <div class="drawer-header">
            <div class="drawer-brand">
              <NIcon size="20" class="brand-logo-icon"><SparklesSharp /></NIcon>
              <div>
                <div class="drawer-title">Deepseek Toolkit</div>
                <div class="drawer-subtitle">对话管理工作台</div>
              </div>
            </div>
            <NIcon size="22" class="drawer-close" @click="drawerVisible = false"><CloseOutline /></NIcon>
          </div>
        </template>

        <!-- 抽屉里的菜单 -->
        <div class="mobile-menu-wrap">
          <NMenu
            :value="activeKey"
            :options="menuOptions"
            :indent="8"
            @update:value="onSelect"
            style="padding: 4px; background: transparent; border: none;"
          />
        </div>

        <!-- 抽屉底部：云端同步 -->
        <div class="drawer-footer">
          <div class="cloud-card" style="margin-bottom: 12px;">
            <div class="cloud-header">
              <NIcon size="16" :component="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
              <span>{{ auth.cloudSyncEnabled ? '云端同步中' : '离线模式' }}</span>
            </div>
            <div class="cloud-control">
              <NSwitch
                :value="auth.cloudSyncEnabled"
                @update:value="onCloudSync"
                size="small"
              />
            </div>
          </div>

          <div class="sider-user-card" @click="onSelect('profile'); drawerVisible = false">
            <NAvatar round :size="36" class="sider-avatar">
              {{ (auth.user?.username || 'U').charAt(0).toUpperCase() }}
            </NAvatar>
            <div class="sider-user-info">
              <div class="sider-user-name">{{ auth.user?.username || '用户' }}</div>
              <div class="sider-user-role">
                {{ auth.isAdmin ? '管理员' : '用户' }}
              </div>
            </div>
          </div>
        </div>
      </NDrawerContent>
    </NDrawer>

    <!-- ════════════════════════════════════
         主内容区（移动端 & 桌面端共用容器）
         ════════════════════════════════════ -->
    <NLayout style="background: transparent;">

      <!-- ======== 顶部栏 ======== -->
      <NLayoutHeader
        :bordered="false"
        :style="isMobile
          ? 'height: 58px; display: flex; align-items: center; justify-content: space-between; padding: 0 14px; background: rgba(255, 255, 255, 0.92); backdrop-filter: blur(14px); -webkit-backdrop-filter: blur(14px); border-bottom: 1px solid rgba(0, 0, 0, 0.06); box-shadow: 0 1px 8px rgba(0, 0, 0, 0.04); position: sticky; top: 0; z-index: 10;'
          : 'height: 68px; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; background: transparent; border-bottom: 1px solid rgba(0, 212, 255, 0.08); z-index: 10;'"
      >
        <!-- 移动端左侧：汉堡按钮 + 品牌迷你Logo -->
        <div v-if="isMobile" class="mobile-topbar-left">
          <button class="chronos-hamburger" aria-label="打开菜单" @click="drawerVisible = true">
            <NIcon size="22"><MenuOutline /></NIcon>
          </button>
          <div class="mobile-mini-brand">
            <NIcon size="16" class="brand-logo-icon mini"><SparklesSharp /></NIcon>
            <span>Deepseek Toolkit</span>
          </div>
        </div>
        <!-- 右侧：状态 + 用户 -->
        <NSpace align="center" :size="isMobile ? 10 : 20">
          <!-- 主题切换（桌面+移动都显示） -->
          <NDropdown
            :options="themeDropdownOptions"
            trigger="click"
            placement="bottom-end"
            @select="handleThemeSelect"
          >
            <button
              class="chronos-hamburger"
              type="button"
              aria-label="切换主题"
              :title="`主题：${themeStore.current.label}${themeStore.mode === 'auto' ? '（跟随系统）' : ''}`"
              style="width: 38px; height: 38px;"
            >
              <span style="font-size: 16px;">{{ themeStore.current.emoji }}</span>
            </button>
          </NDropdown>

          <!-- 状态标签组（桌面端完整 / 移动端精简） -->
          <NSpace v-if="!isMobile" align="center" :size="10">
            <NTag v-if="auth.isAdmin" size="small" type="warning" round>
              <template #icon><NIcon size="12"><SparklesSharp /></NIcon></template>
              管理员
            </NTag>
            <NTag
              size="small"
              round
              :type="auth.cloudSyncEnabled ? 'success' : 'default'"
            >
              <template #icon>
                <NIcon size="12">
                  <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
                </NIcon>
              </template>
              {{ auth.cloudSyncEnabled ? '云端同步' : '离线' }}
            </NTag>
          </NSpace>

          <!-- 移动端：云端状态小图标 -->
          <NTag
            v-if="isMobile"
            size="small"
            round
            :type="auth.cloudSyncEnabled ? 'success' : 'default'"
            style="padding: 2px 8px;"
          >
            <template #icon>
              <NIcon size="11">
                <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
              </NIcon>
            </template>
          </NTag>
        </NSpace>
      </NLayoutHeader>

      <!-- ======== 内容主体 ======== -->
      <NLayoutContent
        :content-style="isMobile
          ? 'padding: 14px 14px 100px;'
          : 'padding: 24px 32px 36px;'"
        :native-scrollbar="false"
        style="background: transparent; position: relative; z-index: 1;"
        class="chronos-content"
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
              共 1 个账号 · {{ menuTitle(activeKey) }} 功能可用 · 最近同步：刚刚
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
      </NLayoutContent>

      <!-- ======== 移动端：底部 Tab 栏 ======== -->
      <NLayoutFooter
        v-if="isMobile"
        :style="'position: fixed; bottom: 0; left: 0; right: 0; z-index: 20; background: rgba(255, 255, 255, 0.96); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border-top: 1px solid rgba(0, 0, 0, 0.06); box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.05); height: 66px; padding: 0;'"
        class="chronos-tabbar"
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
              <NBadge v-if="tab.badge > 0" :value="tab.badge" :max="99" type="error">
                <NIcon size="22" class="tabbar-icon"><component :is="tab.icon" /></NIcon>
              </NBadge>
              <NIcon v-else size="22" class="tabbar-icon"><component :is="tab.icon" /></NIcon>
              <div v-if="activeKey === tab.key" class="tabbar-active-dot"></div>
            </div>
            <div class="tabbar-label">{{ tab.label }}</div>
          </button>
        </div>
        <!-- iPhone 底部安全区 -->
        <div class="tabbar-safearea"></div>
      </NLayoutFooter>

    </NLayout>
  </NLayout>
</template>

<style scoped>
/* ============================================================
   Chronos 布局：侧栏+顶栏装饰
   ============================================================ */

.chronos-layout :deep(.n-layout-scroll-container) {
  position: relative;
}

/* 侧边栏背景装饰 */
.sider-bg-deco {
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 0% 0%, rgba(255, 255, 255, 0.07) 0%, transparent 50%),
    radial-gradient(circle at 100% 100%, rgba(255, 255, 255, 0.08) 0%, transparent 50%),
    linear-gradient(rgba(0, 212, 255, 0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 212, 255, 0.025) 1px, transparent 1px);
  background-size: auto, auto, 36px 36px, 36px 36px;
  pointer-events: none;
  opacity: 0.9;
}

/* ========== 品牌卡片 ========== */
.brand-wrap {
  padding: 18px 16px 10px;
  position: relative;
  z-index: 2;
}
.brand-card::after {
  content: '';
  position: absolute;
  top: -60%;
  right: -25%;
  width: 140px;
  height: 140px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.25) 0%, transparent 70%);
  pointer-events: none;
  animation: chronos-slow-spin 30s linear infinite;
}
@keyframes chronos-slow-spin {
  to { transform: rotate(360deg); }
}
.brand-logo {
  width: 42px;
  height: 42px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(255, 255, 255, 0.22), rgba(168, 85, 247, 0.22));
  border-radius: 11px;
  flex-shrink: 0;
  border: 1px solid rgba(0, 212, 255, 0.3);
  position: relative;
}

.brand-logo.mini { font-size: 16px; }
.brand-logo-ring {
  position: absolute;
  inset: -3px;
  border: 1px dashed rgba(0, 212, 255, 0.35);
  border-radius: 13px;
  animation: chronos-slow-spin 20s linear infinite reverse;
  opacity: 0.7;
}
.brand-text { min-width: 0; }
.brand-name {
  font-size: 14px;
  font-weight: 800;
  line-height: 1.2;
  letter-spacing: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: linear-gradient(135deg, #000000ff 0%, #000000ff 60%, #000000ff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.brand-tag {
  font-size: 11px;
  color: #7DBCD8;
  margin-top: 3px;
  letter-spacing: 0.02em;
}

/* ========== 导航 ========== */
.nav-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px 12px;
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
  color: #5A7DA3;
  padding: 12px 10px 10px;
}
.nav-label n-icon {
  color: var(--primary);
}

/* ========== 底部 footer ========== */
.sider-footer {
  padding: 10px 16px 16px;
  border-top: 1px solid rgba(0, 212, 255, 0.08);
  margin-top: 4px;
  position: relative;
  z-index: 2;
}
.cloud-card {
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.04) 0%, rgba(168, 85, 247, 0.03) 100%);
  border: 1px solid rgba(0, 212, 255, 0.12);
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
  color: #8DB3D4;
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
  background: rgba(0, 212, 255, 0.03);
  border: 1px solid rgba(0, 212, 255, 0.08);
  transition: all 0.22s var(--ease-out);
}
.sider-user-card:hover {
  background: rgba(0, 212, 255, 0.08);
  border-color: rgba(0, 212, 255, 0.18);
  transform: translateX(2px);
}
.sider-avatar {
  background: linear-gradient(135deg, #00D4FF 0%, #A855F7 100%) !important;
  color: #04101F !important;
  font-weight: 800 !important;
  font-size: 14px !important;
  box-shadow: 0 0 16px rgba(0, 212, 255, 0.3);
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
  font-weight: 700;
  color: #5A7DA3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.sider-user-role {
  font-size: 11.5px;
  color: #5A7DA3;
  margin-top: 2px;
}

/* ========== 顶栏：页面身份 ========== */
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
  font-weight: 700;
  line-height: 1.2;
  color: #E8F7FF;
  letter-spacing: -0.01em;
}
.chrono-stamp {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  font-family: 'JetBrains Mono', 'SF Mono', monospace;
  font-size: 10.5px;
  font-weight: 600;
  color: var(--primary);
  background: var(--primary-soft);
  border: 1px solid rgba(0, 212, 255, 0.18);
  border-radius: 6px;
  letter-spacing: 0.05em;
  text-shadow: 0 0 8px rgba(0, 212, 255, 0.35);
}
.page-subtitle {
  font-size: 12.5px;
  color: #5A7DA3;
}

/* ============================================================
   移动端专项样式
   ============================================================ */

/* 汉堡按钮 */
.chronos-hamburger {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 10px;
  color: #1F3A5F;
  cursor: pointer;
  transition: all 0.2s var(--ease-out);
}
.chronos-hamburger:active {
  background: rgba(0, 212, 255, 0.12);
  border-color: rgba(0, 212, 255, 0.3);
  color: #00A8D4;
  transform: scale(0.96);
}

/* 迷你品牌 */
.mobile-mini-brand {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 14.5px;
  font-weight: 800;
  color: #1F3A5F;
  letter-spacing: -0.01em;
}
.mobile-mini-brand :deep(.n-icon) {
  color: #00A8D4;
}
.mobile-topbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

/* 抽屉头部 */
.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding-bottom: 16px;
  border-bottom: 1px solid rgba(0, 212, 255, 0.1);
}
.drawer-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.drawer-title {
  font-size: 15px;
  font-weight: 800;
  background: linear-gradient(135deg, #FFFFFF 0%, #00D4FF 60%, #A855F7 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.drawer-subtitle {
  font-size: 11.5px;
  color: #7DBCD8;
  margin-top: 3px;
}
.drawer-close {
  color: #8DB3D4;
  padding: 4px;
  cursor: pointer;
  border-radius: 8px;
  transition: all 0.2s;
}
.drawer-close:active {
  background: rgba(0, 212, 255, 0.08);
  color: #00D4FF;
}
.mobile-menu-wrap {
  margin: 8px 0;
}
.drawer-footer {
  margin-top: auto;
  padding-top: 16px;
  border-top: 1px solid rgba(0, 212, 255, 0.08);
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
.mobile-page-subtitle {
  font-size: 12.5px;
  color: #5A7DA3;
  line-height: 1.5;
}

/* ============================================================
   移动端底部 Tab Bar
   ============================================================ */

.chronos-tabbar {
  box-shadow: 0 -2px 12px rgba(0, 0, 0, 0.05);
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
  color: #8A9BA8;
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
.tabbar-icon {
  transition: all 0.25s;
}
.tabbar-label {
  font-size: 10.5px;
  font-weight: 600;
  letter-spacing: 0.02em;
  transition: all 0.25s;
}
.tabbar-item.active {
  color: #00A8D4;
}
.tabbar-item.active .tabbar-icon {
  filter: drop-shadow(0 2px 6px rgba(0, 212, 255, 0.35));
  transform: translateY(-2px) scale(1.08);
}
.tabbar-item.active .tabbar-label {
  font-weight: 700;
  color: #00A8D4;
}
.tabbar-active-dot {
  position: absolute;
  bottom: -5px;
  left: 50%;
  transform: translateX(-50%);
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: linear-gradient(135deg, #00D4FF, #A855F7);
  box-shadow: 0 0 6px rgba(0, 212, 255, 0.55);
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
