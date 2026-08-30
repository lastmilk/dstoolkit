<script setup lang="ts">
import { onMounted, ref, h } from 'vue'
import {
  PersonCircleOutline,
  KeyOutline,
  ShieldOutline,
  CloudOutline,
  CloudOfflineOutline,
  SaveOutline,
  LockClosedOutline,
  AddOutline,
  TrashOutline,
  CopyOutline,
  RibbonOutline,
  CalendarOutline,
  TimeOutline,
  HourglassOutline,
  CreateOutline,
  CheckmarkCircleOutline,
  CloseCircleOutline,
  RocketOutline,
  FingerPrintOutline,
  LogOutOutline,
  GiftOutline,
  PeopleOutline,
  CashOutline,
  LinkOutline,
} from '@vicons/ionicons5'
import { Button as TButton, Popconfirm as TPopconfirm, Tag as TTag } from 'tdesign-vue-next'
import type { PrimaryTableCol, SelectOption } from 'tdesign-vue-next'
import AppIcon from '@/components/AppIcon.vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { request } from '@/utils/request'
import { message } from '@/utils/feedback'
import type { ApiKeyItem, ApiTokenItem, CreatedApiToken } from '@/types'

const auth = useAuthStore()
const router = useRouter()

function handleLogout() {
  auth.logout()
  message.success('已退出登录')
  router.push('/login')
}

const newUsername = ref(auth.user?.username || '')
async function saveUsername() {
  if (!newUsername.value) return
  await auth.updateProfile(newUsername.value)
  message.success('用户信息已更新')
}

const oldPwd = ref('')
const newPwd = ref('')
const confirmPwd = ref('')
async function savePassword() {
  if (newPwd.value !== confirmPwd.value) {
    message.error('两次新密码不一致')
    return
  }
  await auth.changePassword(oldPwd.value, newPwd.value)
  message.success('登录密码已更新')
  oldPwd.value = ''
  newPwd.value = ''
  confirmPwd.value = ''
}

const apiKeys = ref<ApiKeyItem[]>([])
const keyName = ref('')
const keyValue = ref('')
async function loadApiKeys() {
  const res: any = await request.get('/apikeys')
  apiKeys.value = res.apiKeys
}
async function addKey() {
  if (!keyName.value || !keyValue.value) {
    message.error('请填写名称和 Key')
    return
  }
  await request.post('/apikeys', { name: keyName.value, key: keyValue.value })
  keyName.value = ''
  keyValue.value = ''
  await loadApiKeys()
  message.success('密钥已添加')
}
async function deleteKey(id: number) {
  await request.delete(`/apikeys/${id}`)
  await loadApiKeys()
  message.success('密钥已删除')
}

const columns: PrimaryTableCol[] = [
  { title: '名称', colKey: 'name' },
  { title: '密钥（掩码）', colKey: 'masked', cell: (_h, { row }) => row.masked },
  { title: '创建时间', colKey: 'createdAt', cell: (_h, { row }) => new Date(row.createdAt).toLocaleString() },
  {
    title: '操作',
    colKey: 'actions',
    cell: (_h, { row }) =>
      h(TPopconfirm, { content: '确认删除此密钥？', onConfirm: () => deleteKey(row.id) }, { default: () => h(TButton, { size: 'small', theme: 'danger', variant: 'outline' }, { default: () => '删除' }) }),
  },
]

const apiTokens = ref<ApiTokenItem[]>([])
const tokenName = ref('')
const tokenExpiry = ref<number>(30)
const tokenCreating = ref(false)
const newlyCreated = ref<CreatedApiToken | null>(null)
const showTokenModal = ref(false)

const expiryOptions: SelectOption[] = [
  { label: '7 天', value: 7 },
  { label: '30 天', value: 30 },
  { label: '90 天', value: 90 },
  { label: '365 天', value: 365 },
  { label: '永久有效', value: 0 },
]

async function loadApiTokens() {
  const res: any = await request.get('/tokens')
  apiTokens.value = res.tokens
}

async function createToken() {
  if (!tokenName.value.trim()) {
    message.error('请填写令牌名称')
    return
  }
  tokenCreating.value = true
  try {
    const res: any = await request.post('/tokens', {
      name: tokenName.value.trim(),
      expiresInDays: tokenExpiry.value || undefined,
    })
    newlyCreated.value = res as CreatedApiToken
    showTokenModal.value = true
    tokenName.value = ''
    await loadApiTokens()
    message.success('API 令牌已生成，请立即保存')
  } finally {
    tokenCreating.value = false
  }
}

async function deleteToken(id: number) {
  await request.delete(`/tokens/${id}`)
  await loadApiTokens()
  message.success('令牌已撤销')
}

async function copyNewToken() {
  if (!newlyCreated.value) return
  try {
    await navigator.clipboard.writeText(newlyCreated.value.token)
    message.success('已复制到剪贴板')
  } catch {
    message.error('复制失败，请手动选择文本复制')
  }
}

const tokenColumns: PrimaryTableCol[] = [
  { title: '名称', colKey: 'name', width: 160 },
  { title: '令牌前缀', colKey: 'masked', cell: (_h, { row }) => row.masked },
  {
    title: '状态',
    colKey: 'status',
    width: 100,
    cell: (_h, { row }) => {
      if (row.expiresAt && new Date(row.expiresAt) < new Date()) {
        return h(TTag, { theme: 'danger', size: 'small' }, { default: () => '已过期' })
      }
      return h(TTag, { theme: 'success', size: 'small' }, { default: () => '有效' })
    },
  },
  { title: '创建时间', colKey: 'createdAt', width: 170, cell: (_h, { row }) => new Date(row.createdAt).toLocaleString() },
  { title: '最后使用', colKey: 'lastUsedAt', width: 170, cell: (_h, { row }) => (row.lastUsedAt ? new Date(row.lastUsedAt).toLocaleString() : '—') },
  { title: '过期时间', colKey: 'expiresAt', width: 170, cell: (_h, { row }) => (row.expiresAt ? new Date(row.expiresAt).toLocaleString() : '永久') },
  {
    title: '操作',
    colKey: 'actions',
    width: 90,
    cell: (_h, { row }) =>
      h(TPopconfirm, { content: '确认撤销该令牌？撤销后立即失效。', onConfirm: () => deleteToken(row.id) }, { default: () => h(TButton, { size: 'small', theme: 'danger', variant: 'outline' }, { default: () => '撤销' }) }),
  },
]

const referralLoading = ref(true)
const referralInfo = ref<{
  referralCode: string
  referralLink: string
  links: Array<{ id: number; code: string; clicks: number; signupCount: number; totalCommissionEarned: number; createdAt: string }>
  rewards: Array<{ id: number; type: string; credits: number; detail: string | null; createdAt: string }>
  stats: { referredCount: number; totalEarned: number; rewardCount: number }
} | null>(null)

const bindCode = ref('')
const binding = ref(false)
const generatingLink = ref(false)
const copiedField = ref<string | null>(null)

async function loadReferral() {
  referralLoading.value = true
  try {
    const res: any = await request.get('/referral/info')
    referralInfo.value = res
  } catch {
    referralInfo.value = null
  } finally {
    referralLoading.value = false
  }
}

async function bindReferral() {
  const code = bindCode.value.trim()
  if (!code) {
    message.error('请输入邀请码')
    return
  }
  binding.value = true
  try {
    const res: any = await request.post('/referral/bind', { code })
    message.success(res.message || '邀请绑定成功')
    bindCode.value = ''
    await loadReferral()
  } catch (e: any) {
    const msg = e?.response?.data?.error || '绑定失败'
    message.error(msg)
  } finally {
    binding.value = false
  }
}

async function generateLink() {
  generatingLink.value = true
  try {
    await request.post('/referral/links')
    message.success('新邀请链接已生成')
    await loadReferral()
  } catch (e: any) {
    message.error('生成失败，请稍后重试')
  } finally {
    generatingLink.value = false
  }
}

async function copyText(text: string, field: string) {
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = field
    message.success('已复制到剪贴板')
    setTimeout(() => { if (copiedField.value === field) copiedField.value = null }, 2000)
  } catch {
    message.error('复制失败，请手动选择文本复制')
  }
}

const rewardTypeMap: Record<string, string> = {
  SIGNUP: '邀请注册',
  WELCOME: '受邀奖励',
  FIRST_SUBSCRIBE: '首次订阅',
  PURCHASE: '购买分成',
}

const referralLinkColumns: PrimaryTableCol[] = [
  { title: '邀请码', colKey: 'code', cell: (_h, { row }) => row.code },
  { title: '点击数', colKey: 'clicks' },
  { title: '注册数', colKey: 'signupCount' },
  { title: '累计积分', colKey: 'totalCommissionEarned' },
  { title: '创建时间', colKey: 'createdAt', cell: (_h, { row }) => new Date(row.createdAt).toLocaleString() },
]

const referralRewardColumns: PrimaryTableCol[] = [
  { title: '类型', colKey: 'type', cell: (_h, { row }) => rewardTypeMap[row.type] || row.type },
  { title: '积分', colKey: 'credits', cell: (_h, { row }) => h('span', { style: 'color: var(--success); font-weight: 700;' }, `+${row.credits}`) },
  { title: '说明', colKey: 'detail', cell: (_h, { row }) => row.detail ?? '—' },
  { title: '时间', colKey: 'createdAt', cell: (_h, { row }) => new Date(row.createdAt).toLocaleString() },
]

onMounted(() => {
  loadApiKeys()
  loadApiTokens()
  loadReferral()
})
</script>

<template>
  <div class="page-enter" style="display: flex; flex-direction: column; gap: 18px;">
      <div class="banner-glow-1"></div>
      <div class="banner-glow-2"></div>
      <div class="banner-inner">
        <div class="banner-title-block">
          <div class="chronos-eyebrow">
            <AppIcon :size="12"><FingerPrintOutline /></AppIcon>
            <span>PROFILE // 个人中心</span>
          </div>
          <h1 class="chronos-page-title">
            个人资料
            <span class="title-accent">· 账号设置</span>
          </h1>
          <p class="chronos-page-sub">
            管理你的个人信息、账号安全与令牌密钥
          </p>
        </div>
        <div class="banner-id">
          <div class="id-avatar">
            <AppIcon :size="32" style="color: var(--primary);"><PersonCircleOutline /></AppIcon>
            <div class="id-ring r1"></div>
            <div class="id-ring r2"></div>
          </div>
          <div class="id-info">
            <div class="id-name">{{ auth.user?.username || '未命名用户' }}</div>
            <div class="id-tags">
              <t-tag v-if="auth.isAdmin" size="small" shape="round" class="tag-admin">
                <AppIcon :size="11" style="margin-right: 2px;"><RibbonOutline /></AppIcon>
                管理员
              </t-tag>
              <span :class="['id-mode-tag', auth.cloudSyncEnabled ? 'cloud' : 'local']">
                <AppIcon :size="10" style="margin-right: 3px;">
                  <component :is="auth.cloudSyncEnabled ? CloudOutline : CloudOfflineOutline" />
                </AppIcon>
                云端{{ auth.cloudSyncEnabled ? '已连接' : '离线' }}
              </span>
            </div>
          </div>
        </div>
      </div>
 

    <div class="chronos-panel section-card page-enter">
      <div class="panel-corner tl"></div>
      <div class="panel-corner tr"></div>
      <div class="panel-corner bl"></div>
      <div class="panel-corner br"></div>

      <div class="section-header">
        <div class="section-icon">
          <AppIcon :size="19"><PersonCircleOutline /></AppIcon>
        </div>
        <div style="flex: 1;">
          <h3>用户信息</h3>
          <div class="section-sub">
            维护你的个人信息与登录密码，确保账号安全
          </div>
        </div>
      </div>

      <div class="account-grid">
        <div>
          <div class="sub-section-title">
            <AppIcon :size="14" style="color: var(--primary);"><CreateOutline /></AppIcon>
            更新用户名
          </div>
          <t-form label-align="top">
            <t-form-item label="用户名">
              <t-input v-model="newUsername" placeholder="请输入用户名" />
            </t-form-item>
            <t-button @click="saveUsername">
              <template #icon><AppIcon :size="14"><SaveOutline /></AppIcon></template>
              保存
            </t-button>
          </t-form>
        </div>

        <div>
          <div class="sub-section-title">
            <AppIcon :size="14" style="color: var(--accent);"><LockClosedOutline /></AppIcon>
            修改登录密码
          </div>
          <t-form label-align="top">
            <t-form-item label="原密码"><t-input v-model="oldPwd" type="password" /></t-form-item>
            <t-form-item label="新密码"><t-input v-model="newPwd" type="password" /></t-form-item>
            <t-form-item label="确认新密码"><t-input v-model="confirmPwd" type="password" /></t-form-item>
            <t-button @click="savePassword">
              <template #icon><AppIcon :size="14"><LockClosedOutline /></AppIcon></template>
              更新密码
            </t-button>
          </t-form>
        </div>
      </div>
    </div>

    <div class="chronos-panel section-card page-enter delay-1">
      <div class="panel-corner tl"></div>
      <div class="panel-corner tr"></div>
      <div class="panel-corner bl"></div>
      <div class="panel-corner br"></div>

      <div class="section-header">
        <div class="section-icon accent">
          <AppIcon :size="19"><KeyOutline /></AppIcon>
        </div>
        <div style="flex: 1;">
          <h3>API 密钥管理</h3>
          <div class="section-sub">
            添加 Deepseek API Key 供功能调用，密钥加密存储，列表仅显示掩码
          </div>
        </div>
      </div>

      <div class="add-row">
        <t-space :size="12" align="end" break-line>
          <t-form-item label="名称" style="margin-bottom: 0;">
            <t-input v-model="keyName" placeholder="如：工作密钥" style="width: 200px;" />
          </t-form-item>
          <t-form-item label="密钥内容" style="margin-bottom: 0;">
            <t-input v-model="keyValue" placeholder="sk-..." style="width: 320px;" />
          </t-form-item>
          <t-button @click="addKey">
            <template #icon><AppIcon :size="14"><AddOutline /></AppIcon></template>
            添加
          </t-button>
        </t-space>
      </div>

      <t-table row-key="id" :columns="columns" :data="apiKeys" :bordered="false" size="small" />
    </div>

    <div class="chronos-panel section-card page-enter delay-2">
      <div class="panel-corner tl"></div>
      <div class="panel-corner tr"></div>
      <div class="panel-corner bl"></div>
      <div class="panel-corner br"></div>

      <div class="section-header">
        <div class="section-icon success">
          <AppIcon :size="19"><ShieldOutline /></AppIcon>
        </div>
        <div style="flex: 1;">
          <div class="section-title-row">
            <h3>API 访问令牌</h3>
            <span class="version-tag">v1</span>
          </div>
          <div class="section-sub">
            生成访问令牌后，可通过 RESTful API（/api/v1/*）访问数据。明文仅在创建时显示一次，服务端仅存哈希，请立即保存。
          </div>
        </div>
      </div>

      <div class="add-row">
        <t-space :size="12" align="end" break-line>
          <t-form-item label="名称" style="margin-bottom: 0;">
            <t-input v-model="tokenName" placeholder="如：脚本采集" style="width: 200px;" />
          </t-form-item>
          <t-form-item label="有效期" style="margin-bottom: 0;">
            <t-select v-model="tokenExpiry" :options="expiryOptions" style="width: 160px;" />
          </t-form-item>
          <t-button :loading="tokenCreating" @click="createToken">
            <template #icon><AppIcon :size="14"><RocketOutline /></AppIcon></template>
            生成令牌
          </t-button>
        </t-space>
      </div>

      <t-table row-key="id" :columns="tokenColumns" :data="apiTokens" :bordered="false" size="small" />
    </div>

    <div class="chronos-panel section-card page-enter delay-3">
      <div class="panel-corner tl"></div>
      <div class="panel-corner tr"></div>
      <div class="panel-corner bl"></div>
      <div class="panel-corner br"></div>

      <div class="section-header">
        <div class="section-icon referral">
          <AppIcon :size="19"><GiftOutline /></AppIcon>
        </div>
        <div style="flex: 1;">
          <h3>邀请奖励</h3>
          <div class="section-sub">
            邀请好友注册，双方均可获得 AI 积分奖励
          </div>
        </div>
      </div>

      <div class="referral-stats">
        <div class="referral-stat">
          <AppIcon :size="18" style="color: var(--accent);"><PeopleOutline /></AppIcon>
          <div class="referral-stat-num">{{ referralInfo?.stats?.referredCount ?? 0 }}</div>
          <div class="referral-stat-label">邀请人数</div>
        </div>
        <div class="referral-stat">
          <AppIcon :size="18" style="color: var(--success);"><CashOutline /></AppIcon>
          <div class="referral-stat-num">{{ referralInfo?.stats?.totalEarned ?? 0 }}</div>
          <div class="referral-stat-label">累计积分</div>
        </div>
        <div class="referral-stat">
          <AppIcon :size="18" style="color: var(--warning);"><GiftOutline /></AppIcon>
          <div class="referral-stat-num">{{ referralInfo?.stats?.rewardCount ?? 0 }}</div>
          <div class="referral-stat-label">奖励次数</div>
        </div>
      </div>

      <div class="referral-link-row" v-if="referralInfo">
        <t-input
          :value="referralInfo!.referralLink"
          readonly
          placeholder="暂无邀请链接"
          style="flex: 1;"
        />
        <t-button @click="copyText(referralInfo!.referralLink, 'main')">
          <template #icon><AppIcon :size="14"><CopyOutline /></AppIcon></template>
          复制
        </t-button>
        <t-button :loading="generatingLink" @click="generateLink">
          <template #icon><AppIcon :size="14"><LinkOutline /></AppIcon></template>
          生成新链接
        </t-button>
      </div>

      <div class="referral-bind-row">
        <t-input
          v-model="bindCode"
          placeholder="输入好友的邀请码"
          style="flex: 1;"
        />
        <t-button :loading="binding" @click="bindReferral">
          <template #icon><AppIcon :size="14"><CheckmarkCircleOutline /></AppIcon></template>
          绑定邀请码
        </t-button>
      </div>
      <div style="font-size: 12px; color: var(--text-muted); margin-bottom: 20px;">
        绑定后双方各获 300/500 积分奖励
      </div>

      <div class="sub-section-title" style="margin-top: 4px;">
        <AppIcon :size="14" style="color: var(--primary);"><LinkOutline /></AppIcon>
        邀请链接
      </div>
      <t-table
        row-key="id"
        v-if="referralInfo && referralInfo.links.length"
        :columns="referralLinkColumns"
        :data="referralInfo!.links"
        :bordered="false"
        size="small"
      />
      <div v-else class="referral-empty">暂无邀请链接，点击上方生成</div>

      <div class="sub-section-title" style="margin-top: 20px;">
        <AppIcon :size="14" style="color: var(--warning);"><GiftOutline /></AppIcon>
        奖励记录
      </div>
      <t-table
        row-key="id"
        v-if="referralInfo && referralInfo.rewards.length"
        :columns="referralRewardColumns"
        :data="referralInfo!.rewards"
        :bordered="false"
        size="small"
      />
      <div v-else class="referral-empty">暂无奖励记录</div>
    </div>

    <div class="logout-row">
      <t-button size="large" theme="danger" variant="outline" @click="handleLogout">
        <template #icon><AppIcon :size="16"><LogOutOutline /></AppIcon></template>
        退出登录
      </t-button>
    </div>

    <t-dialog
      v-model:visible="showTokenModal"
      header="令牌已生成（仅此一次显示明文）"
      width="620px"
      style="max-width: 92vw;"
      :close-on-overlay-click="false"
      :footer="false"
      class="chronos-modal"
    >
      <t-space vertical :size="14">
        <div class="token-warning">
          <AppIcon :size="20" style="color: var(--warning); flex-shrink: 0; margin-top: 1px;"><HourglassOutline /></AppIcon>
          <div>
            请立即复制并妥善保存以下令牌。关闭后无法再次查看，如丢失只能重新生成新令牌。
          </div>
        </div>
        <div class="token-display">
          <div class="token-label">
            <TimeOutline style="font-size: 11px; margin-right: 5px;" />
            BEARER TOKEN
          </div>
          <span v-if="newlyCreated" class="token-code" style="word-break: break-all;">{{ newlyCreated.token }}</span>
        </div>
        <t-space style="padding-top: 6px; justify-content: flex-end;">
          <t-button @click="showTokenModal = false">
            <template #icon><AppIcon :size="15"><CheckmarkCircleOutline /></AppIcon></template>
            我已保存
          </t-button>
          <t-button theme="primary" @click="copyNewToken">
            <template #icon><AppIcon :size="15"><CopyOutline /></AppIcon></template>
            复制令牌
          </t-button>
        </t-space>
      </t-space>
    </t-dialog>
  </div>
</template>

<style scoped>
.chronos-page-banner {
  position: relative;
  padding: 22px 24px;
  border-radius: var(--radius-lg);
  background:
    linear-gradient(135deg, rgba(168, 85, 247, 0.08) 0%, rgba(255, 90, 140, 0.07) 50%, rgba(0, 212, 255, 0.08) 100%),
    linear-gradient(180deg, rgba(17, 26, 53, 0.95) 0%, rgba(11, 18, 38, 0.98) 100%);
  border: 1px solid var(--border);
  overflow: hidden;
}
.banner-glow-1, .banner-glow-2 {
  position: absolute;
  border-radius: 50%;
  pointer-events: none;
  filter: blur(60px);
  opacity: 0.4;
}
.banner-glow-1 {
  width: 260px; height: 260px;
  top: -120px; right: -80px;
  background: radial-gradient(circle, #EC4899 0%, transparent 70%);
}
.banner-glow-2 {
  width: 200px; height: 200px;
  bottom: -100px; left: 20%;
  background: radial-gradient(circle, var(--accent) 0%, transparent 70%);
}
.banner-inner {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  flex-wrap: wrap;
}
.chronos-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 10.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--accent);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  padding: 4px 10px;
  background: rgba(168, 85, 247, 0.08);
  border-radius: 4px;
  border: 1px solid rgba(168, 85, 247, 0.18);
  margin-bottom: 10px;
}
.chronos-page-title {
  font-size: 24px;
  font-weight: 800;
  letter-spacing: -0.01em;
  margin: 0;
  color: var(--text);
  line-height: 1.2;
}
.title-accent {
  color: #EC4899;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: 0.02em;
  opacity: 0.85;
}
.chronos-page-sub {
  margin: 6px 0 0;
  font-size: 13.5px;
  color: var(--text-muted);
  line-height: 1.55;
  max-width: 520px;
}

.banner-id {
  display: flex;
  align-items: center;
  gap: 16px;
}
.id-avatar {
  position: relative;
  width: 72px; height: 72px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(0, 212, 255, 0.18), rgba(168, 85, 247, 0.18));
  flex-shrink: 0;
}
.id-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  border: 2px solid transparent;
}
.id-ring.r1 {
  inset: -4px;
  border-top-color: rgba(0, 212, 255, 0.5);
  border-right-color: rgba(0, 212, 255, 0.3);
  animation: spin 4s linear infinite;
}
.id-ring.r2 {
  inset: -10px;
  border-bottom-color: rgba(168, 85, 247, 0.5);
  border-left-color: rgba(168, 85, 247, 0.3);
  animation: spin 6s linear infinite reverse;
}
@keyframes spin { to { transform: rotate(360deg); } }
.id-name {
  font-size: 19px;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 8px;
}
.id-tags { display: flex; gap: 8px; flex-wrap: wrap; }
.tag-admin {
  background: rgba(245, 158, 11, 0.12) !important;
  color: var(--warning) !important;
  border: 1px solid rgba(245, 158, 11, 0.25) !important;
}
.id-mode-tag {
  display: inline-flex;
  align-items: center;
  padding: 3px 10px;
  border-radius: var(--radius-full);
  font-size: 11px;
  font-weight: 600;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.03em;
}
.id-mode-tag.cloud {
  background: var(--success-soft);
  color: var(--success);
  border: 1px solid rgba(16, 185, 129, 0.2);
}
.id-mode-tag.local {
  background: var(--surface-2);
  color: var(--text-secondary);
  border: 1px solid var(--border);
}

.section-card { padding: 24px; position: relative; overflow: hidden; }
.section-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}
.section-icon {
  width: 38px; height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 212, 255, 0.12);
  color: var(--primary);
  flex-shrink: 0;
  position: relative;
}
.section-icon.accent {
  background: rgba(168, 85, 247, 0.12);
  color: var(--accent);
}
.section-icon.success {
  background: rgba(16, 185, 129, 0.12);
  color: var(--success);
}
.section-header h3 {
  margin: 0 0 2px;
  font-size: 16px;
  font-weight: 700;
  color: var(--text);
}
.section-title-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 2px;
}
.section-title-row h3 { margin: 0; }
.version-tag {
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgba(0, 212, 255, 0.1);
  color: var(--primary);
  border: 1px solid rgba(0, 212, 255, 0.2);
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
}
.section-sub {
  font-size: 13px;
  color: var(--text-muted);
  line-height: 1.5;
}

.account-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 32px;
}
.sub-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 14px;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  letter-spacing: 0.03em;
}

.add-row {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 14px 16px;
  margin: 16px 0;
}

.token-warning {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  background: rgba(245, 158, 11, 0.08);
  border: 1px solid rgba(245, 158, 11, 0.2);
  border-radius: var(--radius);
  font-size: 13px;
  color: #92400E;
  line-height: 1.6;
}
.token-display {
  padding: 14px 16px;
  background: #0F172A;
  border-radius: var(--radius);
  border: 1px solid #1E293B;
}
.token-label {
  font-size: 11px;
  color: #94A3B8;
  font-weight: 600;
  margin-bottom: 8px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: inline-flex;
  align-items: center;
}
.token-code {
  color: #E2E8F0;
  font-size: 13px;
  background: transparent;
  padding: 0;
}

.section-icon.referral {
  background: rgba(245, 158, 11, 0.12);
  color: var(--warning);
}
.referral-stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 14px;
  margin-bottom: 20px;
}
.referral-stat {
  background: var(--surface-2);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius);
  padding: 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
}
.referral-stat-num {
  font-size: 24px;
  font-weight: 700;
  font-family: 'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace;
  color: var(--text);
  line-height: 1.1;
}
.referral-stat-label {
  font-size: 12px;
  color: var(--text-muted);
}
.referral-link-row {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
}
.referral-bind-row {
  display: flex;
  gap: 10px;
  align-items: end;
  margin-bottom: 20px;
}
.referral-empty {
  text-align: center;
  padding: 32px 16px;
  color: var(--text-muted);
  font-size: 13px;
}
@media (max-width: 800px) {
  .referral-stats {
    grid-template-columns: 1fr;
  }
  .referral-link-row,
  .referral-bind-row {
    flex-direction: column;
    align-items: stretch;
  }
}

@media (max-width: 800px) {
  .account-grid {
    grid-template-columns: 1fr !important;
    gap: 24px !important;
  }
}
@media (max-width: 720px) {
  .chronos-page-banner { padding: 18px 16px; }
  .chronos-page-title { font-size: 20px; }
  .banner-id { order: -1; }
  .id-avatar { width: 60px; height: 60px; }
  .section-card { padding: 18px 16px; }
}
@media (max-width: 480px) {
  .chronos-page-banner { padding: 16px 14px; }
  .chronos-page-title { font-size: 18px; }
  .chronos-page-sub { font-size: 12.5px; }
  .id-name { font-size: 16px; }
}

.logout-row {
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
}
</style>
