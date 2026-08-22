<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  NForm,
  NFormItem,
  NInput,
  NButton,
  NSpace,
  NIcon,
} from 'naive-ui'
import {
  SparklesSharp,
  SearchOutline,
  BarChartOutline,
  CloudUploadOutline,
  LogInOutline,
  ArrowForwardOutline,
} from '@vicons/ionicons5'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()
const route = useRoute()

const username = ref('')
const password = ref('')
const loading = ref(false)

async function onSubmit() {
  if (!username.value || !password.value) return
  loading.value = true
  try {
    await auth.login(username.value, password.value)
    const redirect = (route.query.redirect as string) || '/'
    router.push(redirect)
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-shell">
    <!-- 左侧品牌展示区 -->
    <aside class="auth-side">
      <div class="auth-side-bg"></div>
      <div class="auth-side-content">
        <!-- Logo -->
        <div class="side-logo">
          <div class="side-logo-icon">
            <NIcon size="24"><SparklesSharp /></NIcon>
          </div>
          <div class="side-logo-text">
            <div class="side-logo-name">Deepseek Toolkit</div>
            <div class="side-logo-sub">对话管理工作台</div>
          </div>
        </div>

        <!-- 标题 + 标语 -->
        <div class="side-hero">
          <h1 class="side-title">
            让每一次<span class="accent-inline">AI 对话</span><br />
            都值得被记忆与检索
          </h1>
          <p class="side-desc">
            上传 Deepseek 导出数据，快速搜索、继续对话、可视化统计，<br />
            一键转换为 AI 微调训练数据集。
          </p>
        </div>

        <!-- 功能亮点 -->
        <div class="side-features">
          <div class="feat-card">
            <div class="feat-icon feat-icon-1">
              <NIcon size="18"><SearchOutline /></NIcon>
            </div>
            <div class="feat-text">
              <div class="feat-title">极速全文检索</div>
              <div class="feat-sub">支持正则与多维度筛选</div>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon feat-icon-2">
              <NIcon size="18"><BarChartOutline /></NIcon>
            </div>
            <div class="feat-text">
              <div class="feat-title">数据可视化</div>
              <div class="feat-sub">对话量 / 模型 / 时段分析</div>
            </div>
          </div>
          <div class="feat-card">
            <div class="feat-icon feat-icon-3">
              <NIcon size="18"><CloudUploadOutline /></NIcon>
            </div>
            <div class="feat-text">
              <div class="feat-title">Alpaca 导出</div>
              <div class="feat-sub">一键生成微调数据集</div>
            </div>
          </div>
        </div>

        <!-- 底部装饰 -->
        <div class="side-footer">
          © {{ new Date().getFullYear() }} Deepseek Toolkit · 对话即数据
        </div>
      </div>
    </aside>

    <!-- 右侧表单区 -->
    <main class="auth-main">
      <div class="auth-form-wrap page-enter">
        <!-- 移动端显示的小 Logo -->
        <div class="mobile-logo">
          <div class="mobile-logo-icon brand-gradient">
            <NIcon size="20"><SparklesSharp /></NIcon>
          </div>
          <div class="mobile-logo-text">Toolkit</div>
        </div>

        <div class="form-hero">
          <div class="eyebrow">
            <span class="eyebrow-dot"></span>
            欢迎回来
          </div>
          <h2 class="form-title">登录你的账号</h2>
          <p class="form-subtitle">
            继续管理你的 Deepseek 对话数据
          </p>
        </div>

        <NForm @keyup.enter="onSubmit" class="auth-form">
          <NFormItem label="用户名">
            <NInput
              v-model:value="username"
              placeholder="输入用户名或注册时的账号"
              clearable
            >
              <template #prefix>
                <NIcon size="16" style="color: var(--text-muted);">
                  <LogInOutline />
                </NIcon>
              </template>
            </NInput>
          </NFormItem>

          <NFormItem label="密码">
            <NInput
              v-model:value="password"
              type="password"
              show-password-on="click"
              placeholder="输入账号密码"
            />
          </NFormItem>

          <NButton
            type="primary"
            block
            size="large"
            :loading="loading"
            @click="onSubmit"
            class="submit-btn"
          >
            <template #icon v-if="!loading">
              <NIcon size="16"><ArrowForwardOutline /></NIcon>
            </template>
            登录
          </NButton>
        </NForm>

        <div class="auth-divider">
          <span>还没有账号？</span>
        </div>

        <div class="auth-alt">
          <NButton block ghost size="large" @click="router.push('/register')">
            创建新账号
            <template #icon>
              <NIcon size="16"><ArrowForwardOutline /></NIcon>
            </template>
          </NButton>
        </div>

        <p class="auth-tip">
          💡 首个注册的用户将自动成为系统管理员
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

/* ============ 左侧品牌区 ============ */
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
  background:
    radial-gradient(ellipse at 15% 10%, rgba(139, 92, 246, 0.55) 0%, transparent 50%),
    radial-gradient(ellipse at 85% 90%, rgba(79, 70, 229, 0.55) 0%, transparent 55%),
    linear-gradient(160deg, #312E81 0%, #4338CA 45%, #6D28D9 100%);
  z-index: 0;
}
.auth-side-bg::after {
  content: '';
  position: absolute;
  inset: 0;
  background-image:
    radial-gradient(circle at 20% 30%, rgba(255,255,255,0.06) 1px, transparent 1px),
    radial-gradient(circle at 75% 65%, rgba(255,255,255,0.05) 1px, transparent 1px);
  background-size: 24px 24px, 36px 36px;
  opacity: 0.55;
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
  border: 1px solid rgba(255,255,255,0.22);
  border-radius: 12px;
}
.side-logo-name {
  font-size: 17px;
  font-weight: 700;
  letter-spacing: -0.01em;
}
.side-logo-sub {
  font-size: 12px;
  opacity: 0.78;
  margin-top: 1px;
}

/* 主标题区 */
.side-hero {
  margin: auto 0;
  max-width: 520px;
}
.side-title {
  font-size: 44px;
  font-weight: 800;
  line-height: 1.15;
  letter-spacing: -0.02em;
  color: #fff;
  margin: 0 0 20px;
}
.accent-inline {
  background: linear-gradient(135deg, #C4B5FD 0%, #FBCFE8 60%, #FDE68A 100%);
  -webkit-background-clip: text;
  background-clip: text;
  -webkit-text-fill-color: transparent;
}
.side-desc {
  font-size: 15.5px;
  line-height: 1.7;
  color: rgba(255,255,255,0.78);
  margin: 0;
}

/* 功能亮点 */
.side-features {
  margin-top: auto;
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 460px;
}
.feat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: rgba(255,255,255,0.07);
  border: 1px solid rgba(255,255,255,0.10);
  backdrop-filter: blur(8px);
  border-radius: 12px;
  transition: all var(--transition);
}
.feat-card:hover {
  background: rgba(255,255,255,0.10);
  transform: translateX(4px);
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
.feat-icon-1 { background: rgba(14, 165, 233, 0.22); color: #7DD3FC; }
.feat-icon-2 { background: rgba(16, 185, 129, 0.22); color: #6EE7B7; }
.feat-icon-3 { background: rgba(245, 158, 11, 0.22); color: #FCD34D; }

.feat-title {
  font-size: 14px;
  font-weight: 600;
  color: #fff;
}
.feat-sub {
  font-size: 12px;
  color: rgba(255,255,255,0.70);
  margin-top: 2px;
}

.side-footer {
  margin-top: 32px;
  padding-top: 20px;
  border-top: 1px solid rgba(255,255,255,0.12);
  font-size: 12px;
  color: rgba(255,255,255,0.55);
}

/* ============ 右侧表单区 ============ */
.auth-main {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 40px 32px;
  background: var(--bg);
}

.auth-form-wrap {
  width: 100%;
  max-width: 420px;
}

.mobile-logo {
  display: none;
  align-items: center;
  gap: 10px;
  margin-bottom: 32px;
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
  font-weight: 700;
  color: var(--text);
}

.form-hero { margin-bottom: 28px; }
.eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
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
  font-weight: 700;
  line-height: 1.2;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
}
.form-subtitle {
  font-size: 14px;
  color: var(--text-muted);
  margin: 0;
}

.auth-form {
  padding: 24px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-sm);
  margin-bottom: 16px;
}

.submit-btn {
  margin-top: 4px;
  height: 44px;
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

.auth-tip {
  text-align: center;
  font-size: 12px;
  color: var(--text-muted);
  margin: 0;
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
    padding: 20px 16px;
  }
  .form-hero {
    margin-bottom: 20px;
  }
}
</style>
