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
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'
import { clearLocalData } from '@/utils/db'
import { message } from '@/utils/naive'

const auth = useAuthStore()
const route = useRoute()
const router = useRouter()

function icon(Comp: Component) {
  return () => h(NIcon, null, { default: () => h(Comp) })
}

const menuOptions = computed<MenuOption[]>(() => [
  { label: 'Deepseek 配置', key: 'configs', icon: icon(CloudUploadOutline) },
  { label: '探索', key: 'explore', icon: icon(SearchOutline) },
  { label: '统计图', key: 'stats', icon: icon(BarChartOutline) },
  { label: 'Alpaca 转换', key: 'alpaca', icon: icon(SwapHorizontalOutline) },
  { label: '余额查询', key: 'balance', icon: icon(WalletOutline) },
  { label: '应用市场', key: 'market', icon: icon(AppsOutline) },
  { label: '个人中心', key: 'profile', icon: icon(PersonOutline) },
])

const activeKey = computed(() => (route.name as string) || 'configs')
function onSelect(key: string) {
  router.push({ name: key })
}

const MENU_LABELS: Record<string, string> = {
  configs: 'Deepseek 配置',
  explore: '探索',
  stats: '统计图',
  alpaca: 'Alpaca 数据格式转换',
  balance: '余额查询',
  market: '应用市场',
  profile: '个人中心',
}
function menuLabel(key: string): string {
  return MENU_LABELS[key] || ''
}

async function onCloudSync(value: boolean) {
  try {
    await auth.setCloudSync(value)
    if (!value) {
      await clearLocalData() // 关闭云端：清空本地 IndexedDB 索引/会话
      message.success('已切换为仅本地存储，本地索引已清空')
    } else {
      message.success('已开启云端存储，上传的对话将同步到云端')
    }
  } catch {
    /* 错误已由拦截器提示 */
  }
}

const userOptions = [
  { label: '个人中心', key: 'profile' },
  { label: '退出登录', key: 'logout' },
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
    <NLayoutSider
      bordered
      :width="240"
      content-style="display: flex; flex-direction: column; background: var(--surface);"
    >
      <div class="brand neu-inset" style="margin: 16px; text-align: center;">
        <div style="font-weight: 700; font-size: 18px; color: var(--primary);">Deepseek</div>
        <div style="font-size: 12px; color: var(--text-muted);">对话查看工具</div>
      </div>
      <NMenu
        :value="activeKey"
        :options="menuOptions"
        :indent="18"
        @update:value="onSelect"
        style="padding: 8px; background: transparent;"
      />
    </NLayoutSider>
    <NLayout>
      <NLayoutHeader bordered style="height: 60px; display: flex; align-items: center; justify-content: space-between; padding: 0 20px; background: var(--surface);">
        <NText style="font-weight: 600; font-size: 16px;">{{ menuLabel(activeKey) }}</NText>
        <NSpace align="center" :size="16">
          <NSpace align="center" :size="8">
            <NText depth="3" style="font-size: 13px;">云端存储</NText>
            <NSwitch
              :value="auth.cloudSyncEnabled"
              @update:value="onCloudSync"
              size="small"
            >
              <template #checked>开</template>
              <template #unchecked>关</template>
            </NSwitch>
          </NSpace>
          <NDropdown :options="userOptions" trigger="click" @select="onUserSelect">
            <NSpace align="center" :size="8" style="cursor: pointer;">
              <NAvatar round size="small" style="background: var(--primary); color: #fff;">
                {{ (auth.user?.username || 'U').charAt(0).toUpperCase() }}
              </NAvatar>
              <NText>{{ auth.user?.username }}</NText>
              <NIcon :component="ChevronDownOutline" />
            </NSpace>
          </NDropdown>
        </NSpace>
      </NLayoutHeader>
      <NLayoutContent content-style="padding: 20px;" style="background: var(--bg);">
        <RouterView />
      </NLayoutContent>
    </NLayout>
  </NLayout>
</template>
