<script setup lang="ts">
import { computed, h, type Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NLayout,
  NLayoutSider,
  NLayoutHeader,
  NLayoutContent,
  NMenu,
  NSwitch,
  NDropdown,
  NSpace,
  NIcon,
  NText,
  NTag,
  NAvatar,
  NBadge,
  type MenuOption,
} from 'naive-ui'
import {
  CloudUploadOutline,
  SearchOutline,
  BarChartOutline,
  SwapHorizontalOutline,
  WalletOutline,
  AppsOutline,
  PersonOutline,
  LogOutOutline,
  ChevronDownOutline,
  SparklesSharp,
  CloudOutline,
  CloudOfflineOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { clearLocalData } from '@/utils/db'
import { message } from '@/utils/naive'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

function icon(Comp: Component) {
  return () => h(NIcon, { size: 18 }, { default: () => h(Comp) })
}

const menuOptions = computed<MenuOption[]>(() => [
  { label: '配置管理', key: 'configs', icon: icon(CloudUploadOutline) },
  { label: '对话探索', key: 'explore', icon: icon(SearchOutline) },
  { label: '数据统计', key: 'stats', icon: icon(BarChartOutline) },
  { label: 'Alpaca 格式', key: 'alpaca', icon: icon(SwapHorizontalOutline) },
  { label: '余额查询', key: 'balance', icon: icon(WalletOutline) },
  { label: '应用市场', key: 'market', icon: icon(AppsOutline) },
  { label: '个人中心', key: 'profile', icon: icon(PersonOutline) },
])

const activeKey = computed(() => (route.name as string) || 'configs')
function onSelect(key: string) {
  router.push({ name: key })
}

const MENU_LABELS: Record<string, { title: string; subtitle: string }> = {
  configs:   { title: '配置管理',     subtitle: '上传与管理你的 Deepseek 数据' },
  explore:   { title: '对话探索',     subtitle: '搜索、浏览和继续你的对话' },
  stats:     { title: '数据统计',     subtitle: '对话量、模型分布、活跃时段' },
  alpaca:    { title: 'Alpaca 转换',  subtitle: '导出为微调训练数据格式' },
  balance:   { title: '余额查询',     subtitle: 'API Key 余额与用量信息' },
  market:    { title: '应用市场',     subtitle: '工具生态与官方资源' },
  profile:   { title: '个人中心',     subtitle: '账号设置、密钥管理' },
}
function menuTitle(key: string): string { return MENU_LABELS[key]?.title || '' }
function menuSubtitle(key: string): string { return MENU_LABELS[key]?.subtitle || '' }

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

const userOptions = [
  { label: '个人中心', key: 'profile', icon: icon(PersonOutline) },
  { label: '退出登录', key: 'logout', icon: icon(LogOutOutline) },
]
function onUserSelect(key: string) {
  if (key === 'profile') router.push('/profile')
  else if (key === 'logout') onLogout()
}

async function onLogout() {
  await clearLocalData()
  auth.logout()
  router.push('/login')
}
</script>

<template>
  <NLayout has-sider position="absolute" style="height: 100vh">
    <!-- ============ 侧边栏 ============ -->
    <NLayoutSider
      :width="264"
      :collapsed-width="80"
      content-style="display: flex; flex-direction: column; background: var(--surface); border-right: 1px solid var(--border);"
      show-trigger="bar"
      trigger-style="color: var(--text-muted); background: var(--bg);"
    >
      <!-- 品牌卡片：渐变质感 -->
      <div class="brand-wrap">
        <div class="brand-card brand-gradient">
          <div class="brand-logo">
            <NIcon size="20"><SparklesSharp /></NIcon>
          </div>
          <div class="brand-text">
            <div class="brand-name">Deepseek Toolkit</div>
            <div class="brand-tag">对话管理工作台</div>
          </div>
        </div>
      </div>

      <!-- 导航菜单 -->
      <div class="nav-wrap">
        <div class="nav-label">功能导航</div>
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
            <span>云端同步</span>
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
      </div>
    </NLayoutSider>

    <!-- ============ 主内容区 ============ -->
    <NLayout style="background: var(--bg);">
      <!-- 顶部栏 -->
      <NLayoutHeader
        :bordered="false"
        style="height: 68px; display: flex; align-items: center; justify-content: space-between; padding: 0 32px; background: var(--bg); border-bottom: 1px solid var(--border-subtle);"
      >
        <!-- 页面标题 + 副标题 -->
        <div class="page-identity">
          <div class="page-title">{{ menuTitle(activeKey) }}</div>
          <div class="page-subtitle">{{ menuSubtitle(activeKey) }}</div>
        </div>

        <!-- 右侧：状态 + 用户 -->
        <NSpace align="center" :size="20">
          <!-- 状态标签组 -->
          <NSpace align="center" :size="10">
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
              {{ auth.cloudSyncEnabled ? '云端' : '本地' }}
            </NTag>
          </NSpace>

          <!-- 用户下拉 -->
          <NDropdown :options="userOptions" trigger="click" @select="onUserSelect">
            <div class="user-chip">
              <div class="user-avatar-wrap">
                <NAvatar round :size="36" class="user-avatar">
                  {{ (auth.user?.username || 'U').charAt(0).toUpperCase() }}
                </NAvatar>
              </div>
              <div class="user-info">
                <div class="user-name">{{ auth.user?.username }}</div>
                <div class="user-role">{{ auth.isAdmin ? '管理员' : '普通用户' }}</div>
              </div>
              <NIcon size="16" class="chevron"><ChevronDownOutline /></NIcon>
            </div>
          </NDropdown>
        </NSpace>
      </NLayoutHeader>

      <!-- 内容主体 -->
      <NLayoutContent
        content-style="padding: 28px 32px 32px;"
        :native-scrollbar="false"
        style="background: var(--bg);"
      >
        <div class="page-enter">
          <RouterView />
        </div>
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>

<style scoped>
/* ============ 侧边栏 ============ */
.brand-wrap {
  padding: 18px 16px 8px;
}
.brand-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 14px;
  border-radius: 14px;
  box-shadow: 0 6px 16px rgba(79, 70, 229, 0.28),
    0 2px 6px rgba(124, 58, 237, 0.18);
  position: relative;
  overflow: hidden;
}
.brand-card::after {
  content: '';
  position: absolute;
  top: -50%;
  right: -20%;
  width: 120px;
  height: 120px;
  background: radial-gradient(circle, rgba(255,255,255,0.18) 0%, transparent 70%);
  pointer-events: none;
}
.brand-logo {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(4px);
  border-radius: 10px;
  flex-shrink: 0;
  border: 1px solid rgba(255,255,255,0.25);
}
.brand-text { min-width: 0; }
.brand-name {
  font-size: 14.5px;
  font-weight: 700;
  line-height: 1.25;
  letter-spacing: -0.01em;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.brand-tag {
  font-size: 11.5px;
  opacity: 0.85;
  margin-top: 2px;
}

/* 导航 */
.nav-wrap {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px 12px;
}
.nav-label {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  padding: 10px 10px 8px;
}

/* 底部 footer */
.sider-footer {
  padding: 8px 16px 18px;
  border-top: 1px solid var(--border-subtle);
  margin-top: 4px;
}
.cloud-card {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
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
  font-weight: 500;
  color: var(--text-secondary);
}
.cloud-control { flex-shrink: 0; }

/* ============ 顶部栏 ============ */
.page-identity {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.page-title {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.2;
  color: var(--text);
  letter-spacing: -0.01em;
}
.page-subtitle {
  font-size: 12.5px;
  color: var(--text-muted);
}

.user-chip {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 5px 8px 5px 5px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-full);
  cursor: pointer;
  transition: all var(--transition-fast);
}
.user-chip:hover {
  background: var(--surface-hover);
  border-color: var(--border-strong);
  box-shadow: var(--shadow-xs);
}
.user-avatar-wrap { line-height: 0; }
.user-avatar {
  background: linear-gradient(135deg, #4F46E5 0%, #8B5CF6 100%) !important;
  color: #fff !important;
  font-weight: 600 !important;
  font-size: 14px !important;
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
}
.user-info {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}
.user-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.user-role {
  font-size: 11.5px;
  color: var(--text-muted);
}
.chevron {
  color: var(--text-muted);
  margin-right: 4px;
}
</style>
