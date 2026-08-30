<script setup lang="ts">
import {
  Search,
  DataAnalysis,
  MagicStick,
  Upload,
  Lock,
  Sunny,
  Promotion,
  Grid,
} from '@element-plus/icons-vue'

interface FeatureBlock {
  icon: any
  title: string
  description: string
  accentClass: string
}

const features: FeatureBlock[] = [
  {
    icon: Search,
    title: '全文检索',
    description: '基于 FlexSearch 的高性能全文检索引擎，支持正则、关键词、多条件组合筛选，数秒内从海量对话中精准定位目标内容。',
    accentClass: 'feat-1',
  },
  {
    icon: DataAnalysis,
    title: '对话可视化',
    description: '基于 ECharts 的数据统计面板，覆盖对话量、模型分布、活跃时段、Token 消耗等多维度指标，一眼洞察使用趋势。',
    accentClass: 'feat-2',
  },
  {
    icon: MagicStick,
    title: '多模型集成',
    description: '无缝接入主流大语言模型，在统一聊天界面中自由切换，保持对话语境连贯，支持一键续写历史对话。',
    accentClass: 'feat-3',
  },
  {
    icon: Upload,
    title: 'Alpaca 格式导出',
    description: '一键将精选对话转换为标准 Alpaca JSON 训练集，自动处理数据清洗与格式校验，直接用于模型微调。',
    accentClass: 'feat-4',
  },
  {
    icon: Lock,
    title: 'OAuth 授权',
    description: '支持标准 OAuth2.0 授权流程，第三方应用可通过授权码模式安全访问你的对话数据，权限可控、审计可查。',
    accentClass: 'feat-5',
  },
  {
    icon: Sunny,
    title: '自定义主题 / 背景',
    description: '内置多套精美主题（Light / Dark / Ocean / Forest / Mono），支持 ACG / Bing / 自定义图片背景，打造个性化工作台。',
    accentClass: 'feat-6',
  },
  {
    icon: Promotion,
    title: '邀请返利',
    description: '生成专属邀请链接，好友注册后双方都能获得奖励积分，积分可用于升级套餐或兑换模型调用额度。',
    accentClass: 'feat-7',
  },
  {
    icon: Grid,
    title: '模型市场',
    description: '丰富的模型与能力扩展资源市场，官方精选 + 社区贡献，一站获取最新模型、插件与提示词模板。',
    accentClass: 'feat-8',
  },
]
</script>

<template>
  <div class="portal-features">
    <section class="features-hero">
      <div class="features-hero-inner">
        <h1 class="features-title page-enter">
          强大功能，<span class="brand-gradient-text">尽在掌握</span>
        </h1>
        <p class="features-subtitle page-enter delay-1">
          从数据管理到可视化分析，从模型切换到训练集导出，八大核心能力让你的 AI 对话资产真正可管理、可复用、可增值。
        </p>
      </div>
    </section>

    <section class="features-grid-section">
      <div class="features-grid-inner">
        <div class="features-grid">
          <div
            v-for="(feat, idx) in features"
            :key="idx"
            class="feature-cell glass-card"
          >
            <div class="feat-icon" :class="feat.accentClass">
              <el-icon :size="22">
                <component :is="feat.icon" />
              </el-icon>
            </div>
            <h3 class="feat-title">{{ feat.title }}</h3>
            <p class="feat-desc">{{ feat.description }}</p>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.portal-features {
  width: 100%;
}

.features-hero {
  padding: 72px 28px 48px;
  display: flex;
  justify-content: center;
}

.features-hero-inner {
  max-width: 760px;
  text-align: center;
}

.features-title {
  font-size: 44px;
  font-weight: var(--font-weight-black);
  color: var(--text);
  line-height: 1.2;
  margin: 0 0 18px;
  letter-spacing: -0.02em;
}

.features-subtitle {
  font-size: 16px;
  color: var(--text-secondary);
  line-height: 1.7;
  margin: 0;
}

.features-grid-section {
  padding: 12px 28px 80px;
  display: flex;
  justify-content: center;
}

.features-grid-inner {
  max-width: 1200px;
  width: 100%;
}

.features-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 22px;
}

.feature-cell {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 28px 24px;
}

.feat-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  flex-shrink: 0;
}

.feat-1 {
  background: var(--primary-soft);
  color: var(--primary);
}
.feat-2 {
  background: var(--accent-soft);
  color: var(--accent);
}
.feat-3 {
  background: var(--success-soft);
  color: var(--success);
}
.feat-4 {
  background: var(--warning-soft);
  color: var(--warning);
}
.feat-5 {
  background: rgba(239, 68, 68, 0.08);
  color: var(--danger);
}
.feat-6 {
  background: var(--primary-soft);
  color: var(--primary);
}
.feat-7 {
  background: var(--accent-soft);
  color: var(--accent);
}
.feat-8 {
  background: var(--success-soft);
  color: var(--success);
}

.feat-title {
  font-size: 17px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
  margin: 0 0 10px;
  line-height: 1.3;
}

.feat-desc {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.65;
  margin: 0;
}

@media (max-width: 960px) {
  .features-hero {
    padding: 52px 18px 32px;
  }

  .features-title {
    font-size: 32px;
  }

  .features-subtitle {
    font-size: 14.5px;
  }

  .features-grid {
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .features-grid-section {
    padding: 8px 18px 60px;
  }
}

@media (max-width: 560px) {
  .features-grid {
    grid-template-columns: 1fr;
  }

  .features-title {
    font-size: 26px;
  }
}
</style>
