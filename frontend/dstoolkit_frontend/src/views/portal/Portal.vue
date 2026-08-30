<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@/components/AppIcon.vue'
import {
  SparklesSharp,
  SearchOutline,
  BarChartOutline,
  CodeSlashOutline,
  CloudOutline,
  ChatbubbleEllipsesOutline,
  StorefrontOutline,
  ArrowForwardOutline,
} from '@vicons/ionicons5'

const router = useRouter()
const year = computed(() => new Date().getFullYear())

const features = [
  {
    icon: SearchOutline,
    color: 'pf-1',
    title: '极速全文检索',
    desc: '支持正则、关键词、多条件筛选，几秒定位到历史对话。',
  },
  {
    icon: BarChartOutline,
    color: 'pf-2',
    title: '数据可视化',
    desc: '对话量、模型分布、活跃时段一图掌握，洞察使用趋势。',
  },
  {
    icon: CodeSlashOutline,
    color: 'pf-3',
    title: 'Alpaca 格式导出',
    desc: '一键将对话转换为标准 Alpaca JSON，直接用于模型微调。',
  },
  {
    icon: CloudOutline,
    color: 'pf-4',
    title: '本地 / 云端双模式',
    desc: '支持纯本地存储与云端同步，数据完全可控。',
  },
  {
    icon: ChatbubbleEllipsesOutline,
    color: 'pf-5',
    title: '继续对话',
    desc: '无缝跳转至平台，直接在原有语境下续写对话。',
  },
  {
    icon: StorefrontOutline,
    color: 'pf-6',
    title: '模型市场',
    desc: '丰富的模型与能力扩展资源，一站获取。',
  },
]
</script>

<template>
  <div class="portal-wrap">
    <nav class="portal-nav-top">
      <div class="portal-nav-inner">
        <div class="portal-nav-brand">
          <AppIcon :size="22" class="brand-logo-icon">
            <SparklesSharp />
          </AppIcon>
          <span>Deepseek Toolkit</span>
        </div>
        <div class="portal-nav-links">
          <a class="portal-nav-link" href="#features">功能</a>
          <a class="portal-nav-link" href="#cta">开始使用</a>
          <a
            class="portal-nav-btn login"
            @click.prevent="router.push('/login')"
          >登录</a>
          <a
            class="portal-nav-btn signup"
            @click.prevent="router.push('/register')"
          >注册</a>
        </div>
      </div>
    </nav>

    <section class="portal-hero">
      <div class="portal-eyebrow">
        <AppIcon :size="14"><SparklesSharp /></AppIcon>
        对话即资产
      </div>
      <h1 class="portal-title">
        让每一次 AI 对话都值得被<span class="portal-title-gradient">记忆与复用</span>
      </h1>
      <p class="portal-subtitle">
        Deepseek Toolkit 帮助你轻松导入 Deepseek 导出数据、全文检索历史对话、可视化分析使用情况，一键生成 AI 微调训练数据集，把 AI 对话变成真正属于你的资产。
      </p>
      <div class="portal-cta-row">
        <a
          class="portal-btn primary"
          @click.prevent="router.push('/register')"
        >
          立即开始
          <AppIcon :size="16"><ArrowForwardOutline /></AppIcon>
        </a>
        <a class="portal-btn ghost" href="#features">了解功能</a>
      </div>
    </section>

    <section id="features" class="portal-features">
      <div class="portal-section-head">
        <h2 class="portal-section-title">为什么选择 Deepseek Toolkit</h2>
        <p class="portal-section-sub">六大核心能力，让你的 AI 对话真正可管理、可复用</p>
      </div>
      <div class="portal-feature-grid">
        <div v-for="(f, i) in features" :key="i" class="portal-feature">
          <div :class="['portal-feature-icon', f.color]">
            <AppIcon :size="22"><component :is="f.icon" /></AppIcon>
          </div>
          <h3 class="portal-feature-title">{{ f.title }}</h3>
          <p class="portal-feature-desc">{{ f.desc }}</p>
        </div>
      </div>
    </section>

    <section id="cta" class="portal-cta-section">
      <div class="portal-cta-card">
        <h3>准备好把 AI 对话变成你的资产了吗？</h3>
        <p>免费注册，立即使用所有功能；首个注册用户自动成为管理员。</p>
        <a
          class="portal-btn primary"
          @click.prevent="router.push('/register')"
        >
          立即免费注册
          <AppIcon :size="16"><ArrowForwardOutline /></AppIcon>
        </a>
      </div>
    </section>

    <footer class="portal-footer">
      © {{ year }} Deepseek Toolkit · 对话即数据
    </footer>
  </div>
</template>
