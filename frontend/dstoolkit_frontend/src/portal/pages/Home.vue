<script setup lang="ts">
import { useRouter } from 'vue-router'
import {
  Search,
  PieChart,
  MagicStick,
  Upload,
  ArrowRight,
  Promotion,
} from '@element-plus/icons-vue'

const router = useRouter()

interface HighlightCard {
  icon: any
  title: string
  desc: string
  accentClass: string
}

const highlights: HighlightCard[] = [
  {
    icon: Search,
    title: '全文检索',
    desc: '支持正则、关键词、多条件筛选，数秒内定位历史对话，灵活的过滤器让查找更精准。',
    accentClass: 'accent-1',
  },
  {
    icon: PieChart,
    title: '数据可视化',
    desc: '基于 ECharts 的对话量、模型分布、活跃时段统计，一图掌握使用趋势与洞察。',
    accentClass: 'accent-2',
  },
  {
    icon: MagicStick,
    title: '模型切换 / 聊天',
    desc: '无缝切换多种模型，在统一的聊天界面中续写对话，保持语境连贯，高效协作。',
    accentClass: 'accent-3',
  },
  {
    icon: Upload,
    title: '导出 Alpaca',
    desc: '一键将对话转换为标准 Alpaca JSON 格式，直接用于模型微调训练，数据即资产。',
    accentClass: 'accent-4',
  },
]
</script>

<template>
  <div class="portal-home">
    <section class="hero-section">
      <div class="hero-inner">
        <div class="hero-tag page-enter">
          <el-icon :size="14" class="tag-icon"><Promotion /></el-icon>
          <span>对话即资产 · 一站式管理</span>
        </div>

        <h1 class="hero-title page-enter delay-1">
          <span class="title-base">AI 对话资产，</span>
          <span class="title-accent brand-gradient-text">一站式管理</span>
        </h1>

        <p class="hero-subtitle page-enter delay-2">
          轻松导入 Deepseek 导出数据，全文检索历史对话，可视化分析使用趋势，
          一键生成 AI 微调训练数据集，把 AI 对话变成真正属于你的资产。
        </p>

        <div class="hero-cta page-enter delay-3">
          <el-button
            type="primary"
            size="large"
            class="cta-btn cta-primary"
            @click="router.push('/register')"
          >
            立即开始
            <el-icon class="cta-arrow"><ArrowRight /></el-icon>
          </el-button>
          <el-button
            size="large"
            class="cta-btn cta-ghost"
            @click="router.push('/portal/features')"
          >
            查看功能
          </el-button>
        </div>
      </div>
    </section>

    <section class="highlights-section">
      <div class="highlights-inner">
        <div class="highlights-grid">
          <div
            v-for="(item, idx) in highlights"
            :key="idx"
            class="highlight-card glass-card"
            :class="`delay-${idx}`"
          >
            <div class="card-icon-wrap" :class="item.accentClass">
              <el-icon :size="24">
                <component :is="item.icon" />
              </el-icon>
            </div>
            <h3 class="card-title">{{ item.title }}</h3>
            <p class="card-desc">{{ item.desc }}</p>
          </div>
        </div>
      </div>
    </section>

    <section class="cta-banner-section">
      <div class="cta-banner-inner">
        <div class="cta-banner glass-strong">
          <div class="banner-text">
            <h3 class="banner-title">准备好把 AI 对话变成你的资产了吗？</h3>
            <p class="banner-sub">
              免费注册，立即使用所有功能；首个注册用户自动成为管理员。
            </p>
          </div>
          <el-button
            type="primary"
            size="large"
            class="banner-btn"
            @click="router.push('/register')"
          >
            立即免费注册
            <el-icon class="cta-arrow"><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.portal-home {
  width: 100%;
}

.hero-section {
  padding: 80px 28px 60px;
  display: flex;
  justify-content: center;
}

.hero-inner {
  max-width: 860px;
  text-align: center;
}

.hero-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: var(--primary-soft);
  border: 1px solid color-mix(in srgb, var(--primary) 20%, transparent);
  border-radius: var(--radius-full);
  font-size: 12.5px;
  font-weight: var(--font-weight-bold);
  color: var(--primary);
  margin-bottom: 24px;
}

.tag-icon {
  color: var(--primary);
}

.hero-title {
  font-size: 52px;
  line-height: 1.15;
  margin: 0 0 20px;
  letter-spacing: -0.02em;
}

.title-base {
  color: var(--text);
  font-weight: var(--font-weight-black);
}

.title-accent {
  font-size: inherit;
}

.hero-subtitle {
  font-size: 16.5px;
  color: var(--text-secondary);
  line-height: 1.7;
  max-width: 640px;
  margin: 0 auto 36px;
}

.hero-cta {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 14px;
  flex-wrap: wrap;
}

.cta-btn {
  border-radius: var(--radius-full);
  padding: 14px 30px;
  font-size: 15px;
  font-weight: var(--font-weight-bold);
}

.cta-primary {
  box-shadow: 0 8px 22px var(--primary-soft);
}

.cta-primary .cta-arrow {
  margin-left: 4px;
}

.cta-ghost {
  background: var(--surface);
  border: 1px solid var(--border);
  color: var(--text);
}

.cta-ghost:hover {
  border-color: var(--primary);
  color: var(--primary);
  background: var(--primary-soft);
}

.highlights-section {
  padding: 20px 28px 40px;
  display: flex;
  justify-content: center;
}

.highlights-inner {
  max-width: 1200px;
  width: 100%;
}

.highlights-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 22px;
}

.highlight-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  padding: 28px 24px;
}

.card-icon-wrap {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 18px;
  flex-shrink: 0;
}

.accent-1 {
  background: var(--primary-soft);
  color: var(--primary);
}
.accent-2 {
  background: var(--accent-soft);
  color: var(--accent);
}
.accent-3 {
  background: var(--success-soft);
  color: var(--success);
}
.accent-4 {
  background: var(--warning-soft);
  color: var(--warning);
}

.card-title {
  font-size: 17px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
  margin: 0 0 10px;
  line-height: 1.3;
}

.card-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.65;
  margin: 0;
}

.cta-banner-section {
  padding: 40px 28px 80px;
  display: flex;
  justify-content: center;
}

.cta-banner-inner {
  max-width: 1200px;
  width: 100%;
}

.cta-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 30px;
  padding: 36px 40px;
  border-radius: var(--radius-xl);
  background: var(--brand-gradient) !important;
  color: #fff;
  position: relative;
  overflow: hidden;
  box-shadow: 0 12px 40px var(--primary-soft);
}

.cta-banner::after {
  content: '';
  position: absolute;
  top: -80px;
  right: -60px;
  width: 280px;
  height: 280px;
  background: radial-gradient(circle, rgba(255, 255, 255, 0.16) 0%, transparent 65%);
  pointer-events: none;
}

.banner-text {
  flex: 1;
  min-width: 0;
  position: relative;
  z-index: 1;
}

.banner-title {
  font-size: 22px;
  font-weight: var(--font-weight-black);
  color: #fff;
  margin: 0 0 8px;
  line-height: 1.3;
}

.banner-sub {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.86);
  margin: 0;
  line-height: 1.6;
}

.banner-btn {
  background: #fff !important;
  color: var(--primary) !important;
  border: none;
  border-radius: var(--radius-full);
  padding: 14px 28px;
  font-size: 15px;
  font-weight: var(--font-weight-bold);
  flex-shrink: 0;
  position: relative;
  z-index: 1;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.12);
}

.banner-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.16);
}

.banner-btn .cta-arrow {
  margin-left: 4px;
}

@media (max-width: 960px) {
  .hero-section {
    padding: 56px 18px 40px;
  }

  .hero-title {
    font-size: 38px;
  }

  .hero-subtitle {
    font-size: 15px;
  }

  .highlights-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .highlights-section {
    padding: 10px 18px 28px;
  }

  .cta-banner-section {
    padding: 28px 18px 60px;
  }

  .cta-banner {
    flex-direction: column;
    align-items: flex-start;
    padding: 28px 24px;
  }

  .banner-title {
    font-size: 18px;
  }
}

@media (max-width: 560px) {
  .hero-title {
    font-size: 30px;
  }

  .highlights-grid {
    grid-template-columns: 1fr;
  }

  .cta-btn {
    width: 100%;
    justify-content: center;
  }

  .banner-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>
