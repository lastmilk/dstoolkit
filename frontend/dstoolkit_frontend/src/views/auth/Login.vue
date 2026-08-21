<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { NForm, NFormItem, NInput, NButton, NSpace, NText } from 'naive-ui'
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
  <div class="auth-page">
    <div class="neu-card auth-card">
      <h2 style="margin: 0 0 8px; color: var(--primary);">登录 dstoolkit</h2>
      <p style="margin: 0 0 20px; color: var(--text-muted); font-size: 13px;">
        登录你的账号以使用 Deepseek 对话查看工具
      </p>
      <NForm @keyup.enter="onSubmit">
        <NFormItem label="用户名">
          <NInput v-model:value="username" placeholder="请输入用户名" />
        </NFormItem>
        <NFormItem label="密码">
          <NInput
            v-model:value="password"
            type="password"
            show-password-on="click"
            placeholder="请输入密码"
          />
        </NFormItem>
        <NButton type="primary" block :loading="loading" @click="onSubmit">登录</NButton>
      </NForm>
      <NSpace justify="space-between" style="margin-top: 16px;">
        <NText depth="3" style="font-size: 13px;">还没有账号？</NText>
        <NButton text type="primary" @click="router.push('/register')">去注册</NButton>
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
