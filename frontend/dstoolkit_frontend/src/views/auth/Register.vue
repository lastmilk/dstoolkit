<script setup lang="ts">
/**
 * 注册页（Element Plus 版本）
 *  - 左侧渐变品牌区 + 注册优势
 *  - 右侧玻璃拟态表单 + 管理员提示条
 *  - 密码一致性校验走 toast + SweetAlert2 失败提示
 */
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import {
  MagicStick, User, Lock, ArrowRight,
  Promotion, PieChart,
} from '@element-plus/icons-vue'
import { useAuthStore } from '@/stores/auth'
import { toast } from '@/utils/toast'
import { error as sweetError } from '@/utils/sweetalert'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const confirmPwd = ref('')
const loading = ref(false)

async function onSubmit() {
  if (!username.value.trim() || username.value.trim().length < 2) {
    toast.warning('用户名至少需要 2 个字符')
    return
  }
  if (!password.value || password.value.length < 6) {
    toast.warning('密码至少需要 6 位')
    return
  }
  if (password.value !== confirmPwd.value) {
    toast.error('两次输入的密码不一致')
    return
  }
  loading.value = true
  try {
    await auth.register(username.value.trim(), password.value)
    toast.success('注册成功，欢迎加入！')
    router.push('/')
  } catch (e: any) {
    const msg = e?.response?.data?.message || '注册失败，请稍后重试'
    if (!e?.handled) {
      await sweetError('注册失败', msg)
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-shell">
    <!-- 左侧品牌区（注册版：更明亮的渐变 + 激励文案） -->
    <aside class="auth-side">
      <div class="auth-side-bg auth-side-bg-register"></div>
      <div class="auth-side-content">
        <div class="side-logo">
          <div class="side-logo-icon">
            <el-icon :size="24"><MagicStick /></el-icon>
          </div>
          <div class="side-logo-text">
            <div class="side-logo-name">Deepseek Toolkit</div>
            <div class="side-logo-sub">对话管理工作台</div>
          </div>
        </div>

        <div class="side-hero">
          <h1 class="side-title">
            开启你的<span class="accent-inline">对话资产</span><br />
            管理之旅
          </h1>
          <p class="side-desc">
            首个注册用户自动成为管理员，<br />
            立即体验完整功能，无需等待。
          </p>
        </div>

        <!-- 注册优势卡片 -->
        <div class="side-features">
          <div class="feat-card glass">
            <div class="feat-icon feat-icon-1">
              <el-icon :size="18"><Lock /></el-icon>
            </div>
            <div class="feat-text">
              <div class="feat-title">隐私安全</div>
              <div class="feat-sub">本地 / 云端双模式，数据全程加密</div>
            </div>
          </div>
          <div class="feat-card glass">
            <div class="feat-icon feat-icon-2">
              <el-icon :size="18"><Promotion /></el-icon>
            </div>
            <div class="feat-text">
              <div class="feat-title">开箱即用</div>
              <div class="feat-sub">上传 zip 即可检索，零配置</div>
            </div>
          </div>
          <div class="feat-card glass">
            <div class="feat-icon feat-icon-3">
              <el-icon :size="18"><PieChart /></el-icon>
            </div>
            <div class="feat-text">
              <div class="feat-title">洞察可视化</div>
              <div class="feat-sub">一眼掌握对话分布与趋势</div>
            </div>
          </div>
        </div>

        <div class="side-footer">
          © {{ new Date().getFullYear() }} Deepseek Toolkit · 把 AI 对话变成你的资产
        </div>
      </div>
    </aside>

    <!-- 右侧表单 -->
    <main class="auth-main">
      <div class="auth-form-wrap page-enter">
        <div class="mobile-logo">
          <div class="mobile-logo-icon brand-gradient">
            <el-icon :size="20"><MagicStick /></el-icon>
          </div>
          <div class="mobile-logo-text">Toolkit</div>
        </div>

        <div class="form-hero">
          <div class="eyebrow">
            <span class="eyebrow-dot"></span>
            创建账号
          </div>
          <h2 class="form-title">开启你的工作台</h2>
          <p class="form-subtitle">
            几秒即可完成注册，免费使用全部功能
          </p>
        </div>

        <!-- 管理员提示 -->
        <el-alert
          type="info"
          :closable="false"
          show-icon
          class="admin-banner"
        >
          <template #title>
            <div class="admin-banner-row">
              <div class="admin-banner-icon brand-gradient">
                <el-icon :size="14"><Lock /></el-icon>
              </div>
              <div class="admin-banner-text">
                <strong>你是首个注册用户？</strong>
                <span>将自动拥有系统管理员权限。</span>
              </div>
            </div>
          </template>
        </el-alert>

        <div class="auth-form glass-strong" @keyup.enter="onSubmit">
          <el-form label-position="top" size="large">
            <el-form-item label="用户名">
              <el-input
                v-model="username"
                placeholder="至少 2 个字符"
                clearable
                maxlength="32"
                show-word-limit
              >
                <template #prefix>
                  <el-icon><User /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="登录密码">
              <el-input
                v-model="password"
                type="password"
                show-password
                placeholder="至少 6 位，建议包含字母数字"
              >
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-form-item label="确认密码">
              <el-input
                v-model="confirmPwd"
                type="password"
                show-password
                placeholder="请再次输入密码"
                @keyup.enter="onSubmit"
              >
                <template #prefix>
                  <el-icon><Lock /></el-icon>
                </template>
              </el-input>
            </el-form-item>

            <el-button
              type="primary"
              size="large"
              :loading="loading"
              @click="onSubmit"
              class="submit-btn"
            >
              <template v-if="!loading" #icon>
                <el-icon><ArrowRight /></el-icon>
              </template>
              创建账号并登录
            </el-button>
          </el-form>
        </div>

        <div class="auth-divider">
          <span>已有账号？</span>
        </div>

        <div class="auth-alt">
          <el-button size="large" @click="router.push('/login')" class="alt-btn">
            返回登录
            <template #icon>
              <el-icon><ArrowRight /></el-icon>
            </template>
          </el-button>
        </div>

        <p class="auth-tip">
          注册即表示同意服务条款，你的对话数据不会被上传给任何第三方
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.auth-shell {
  display: grid;
  grid-template-columns: 1.1fr 1fr;
  min-height: 100vh;
  background: var(--bg);
}

.auth-side {
  position: relative;
  overflow: hidden;
  color: #fff;
  padding: 48px;
  display: flex;
  flex-direction: column;
}
.auth-side-bg {
  position: absolute;
  inset: 0;
  z-index: 0;
}
.auth-side-bg-register {
  background:
    radial-gradient(ellipse at 20% 85%, rgba(56, 189, 248, 0.45) 0%, transparent 55%),
    radial-gradient(ellipse at 80% 15%, rgba(217, 70, 239, 0.45) 0%, transparent 50%),
    linear-gradient(160deg, #4C1D95 0%, #7C3AED 45%, #2563EB 100%);
}
.auth-side-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 30% 25%, rgba(255,255,255,0.06) 1px, transparent 1px),
    radial-gradient(circle at 70% 75%, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 28px 28px, 40px 40px;
  opacity: 0.6;
}
.auth-side-content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  height: 100%;
  flex: 1;
}

.side-logo {
  display: flex;
  align-items: center;
  gap: 12px;
}
.side-logo-icon {
  width: 46px;
  height: 46px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255,255,255,0.14);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 12px;
}
.side-logo-name {
  font-size: 17px;
  font-weight: var(--font-weight-bold);
  letter-spacing: -0.01em;
  color: #fff;
}
.side-logo-sub {
  font-size: 12px;
  opacity: 0.78;
  margin-top: 1px;
  color: rgba(255,255,255,0.78);
}

.side-hero {
  margin: auto 0;
  max-width: 520px;
}
.side-title {
  font-size: 44px;
  font-weight: var(--font-weight-black);
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #fff;
  margin: 0 0 20px;
  font-family: var(--font-family-harmony);
}
.accent-inline {
  background: linear-gradient(135deg, #BAE6FD 0%, #F0ABFC 50%, #FDE68A 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.side-desc {
  font-size: 15.5px;
  line-height: 1.7;
  color: rgba(255,255,255,0.80);
  margin: 0;
}

.side-features {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 480px;
}
.feat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.07) !important;
  border: 1px solid rgba(255,255,255,0.10) !important;
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  border-radius: 12px !important;
  transition: all var(--transition) !important;
  box-shadow: none !important;
  color: #fff;
}
.feat-card:hover {
  background: rgba(255,255,255,0.10) !important;
  transform: translateX(4px);
  border-color: rgba(255,255,255,0.20) !important;
}
.feat-icon {
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  flex-shrink: 0;
}
.feat-icon-1 { background: rgba(16, 185, 129, 0.22); color: #6EE7B7; }
.feat-icon-2 { background: rgba(251, 146, 60, 0.22);  color: #FDBA74; }
.feat-icon-3 { background: rgba(139, 92, 246, 0.25); color: #C4B5FD; }

.feat-title {
  font-size: 14px;
  font-weight: var(--font-weight-bold);
  color: #fff;
}
.feat-sub {
  font-size: 12px;
  color: rgba(255,255,255,0.72);
  margin-top: 2px;
}

.side-footer {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.12);
  font-size: 12px;
  color: rgba(255,255,255,0.55);
}

/* ============ 表单区 ============ */
.auth-main {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 32px;
  background: var(--bg);
}

.auth-form-wrap {
  width: 100%;
  max-width: 460px;
}

.mobile-logo {
  display: none;
  align-items: center;
  gap: 10px;
  margin-bottom: 28px;
}
.mobile-logo-icon {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
}
.mobile-logo-text {
  font-size: 16px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
}

.form-hero { margin-bottom: 20px; }
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: var(--font-weight-bold);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--primary);
  background: var(--primary-soft);
  padding: 4px 12px;
  border-radius: var(--radius-full);
  margin-bottom: 14px;
}
.eyebrow-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--primary);
  box-shadow: 0 0 0 3px var(--primary-soft);
}
.form-title {
  font-size: 28px;
  font-weight: var(--font-weight-bold);
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
  color: var(--text);
  font-family: var(--font-family-harmony);
}
.form-subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}

/* 管理员提示条 */
.admin-banner {
  border: 1px solid var(--primary-soft-hover) !important;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.06), rgba(79, 70, 229, 0.06)) !important;
  border-radius: var(--radius) !important;
  margin-bottom: 16px !important;
  padding: 10px 14px !important;
}
:deep(.admin-banner .el-alert__content) {
  width: 100%;
}
.admin-banner-row {
  display: flex;
  align-items: center;
  gap: 10px;
}
.admin-banner-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  flex-shrink: 0;
  box-shadow: 0 2px 6px rgba(79, 70, 229, 0.25);
}
.admin-banner-text {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.4;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.admin-banner-text strong {
  color: var(--primary-pressed, var(--primary));
  font-weight: var(--font-weight-bold);
}
:deep(.admin-banner .el-alert__icon) {
  display: none;
}

.auth-form {
  padding: 22px 24px;
  border-radius: var(--radius-xl);
  margin-bottom: 16px;
}

.submit-btn {
  margin-top: 4px;
  height: 44px;
  width: 100%;
  border-radius: var(--radius);
  font-size: 15px;
  font-weight: var(--font-weight-bold);
}

.auth-divider {
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 20px 0 14px;
  color: var(--text-muted);
  font-size: 13px;
}

.auth-alt {
  margin-bottom: 16px;
}
.alt-btn {
  width: 100%;
  height: 42px;
  border-radius: var(--radius);
  font-weight: var(--font-weight-medium);
  background: var(--bg-2);
  border: 1px solid var(--border);
  color: var(--text-secondary);
  transition: all var(--transition-fast);
}
.alt-btn:hover {
  background: var(--primary-soft);
  border-color: var(--primary);
  color: var(--primary);
  transform: translateY(-1px);
}

.auth-tip {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
  line-height: 1.6;
}

/* ============ 响应式 ============ */
@media (max-width: 960px) {
  .auth-shell {
    grid-template-columns: 1fr;
  }
  .auth-side {
    display: none;
  }
  .mobile-logo {
    display: flex;
  }
  .auth-main {
    padding: 32px 20px;
    min-height: 100vh;
  }
  .form-title {
    font-size: 24px;
  }
}

@media (max-width: 480px) {
  .auth-form {
    padding: 18px 16px;
  }
  .form-hero {
    margin-bottom: 16px;
  }
}
</style>
