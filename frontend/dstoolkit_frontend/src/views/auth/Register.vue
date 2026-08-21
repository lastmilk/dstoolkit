<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { NForm, NFormItem, NInput, NButton, NSpace, NText } from 'naive-ui'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const username = ref('')
const password = ref('')
const confirm = ref('')
const loading = ref(false)

async function onSubmit() {
  if (!username.value || !password.value) return
  if (password.value !== confirm.value) {
    const { message } = await import('@/utils/naive')
    message.error('两次输入的密码不一致')
    return
  }
  loading.value = true
  try {
    await auth.register(username.value, password.value)
    router.push('/')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="neu-card auth-card">
      <h2 style="margin: 0 0 8px; color: var(--primary);">注册新账号</h2>
      <p style="margin: 0 0 20px; color: var(--text-muted); font-size: 13px;">
        首个注册的用户将自动成为管理员
      </p>
      <NForm @keyup.enter="onSubmit">
        <NFormItem label="用户名">
          <NInput v-model:value="username" placeholder="至少 2 位" />
        </NFormItem>
        <NFormItem label="密码">
          <NInput
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="至少 6 位"
          />
        </NFormItem>
        <NFormItem label="确认密码">
          <NInput
            v-model:value="confirm"
            type="password"
            show-password-on="click"
            placeholder="再次输入密码"
          />
        </NFormItem>
        <NButton type="primary" block :loading="loading" @click="onSubmit">注册</NButton>
      </NForm>
      <NSpace justify="space-between" style="margin-top: 16px;">
        <NText depth="3" style="font-size: 13px;">已有账号？</NText>
        <NButton text type="primary" @click="router.push('/login')">去登录</NButton>
      </NSpace>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--bg);
}
.auth-card {
  width: 380px;
  max-width: 92vw;
}
</style>
