<script setup lang="ts">
import { computed } from 'vue'
import { MagicStick } from '@element-plus/icons-vue'

const year = computed(() => new Date().getFullYear())

interface FooterLink {
  label: string
  path: string
}

const quickLinks: FooterLink[] = [
  { label: '首页', path: '/portal' },
  { label: '功能介绍', path: '/portal/features' },
  { label: '价格方案', path: '/portal/pricing' },
  { label: '登录', path: '/login' },
  { label: '注册', path: '/register' },
]

const productLinks: FooterLink[] = [
  { label: '对话探索', path: '/explore' },
  { label: '数据统计', path: '/stats' },
  { label: 'Alpaca 导出', path: '/alpaca' },
  { label: '模型市场', path: '/market' },
  { label: '账号配置', path: '/configs' },
]

const resourceLinks: FooterLink[] = [
  { label: '使用文档', path: '/portal/features' },
  { label: 'API 授权', path: '/oauth/authorize' },
  { label: '用户中心', path: '/profile' },
  { label: '余额充值', path: '/balance' },
  { label: '联系我们', path: '/portal/pricing' },
]
</script>

<template>
  <footer class="portal-footer">
    <div class="footer-inner">
      <div class="footer-columns">
        <div class="footer-brand-col">
          <div class="footer-brand">
            <el-icon :size="22" class="brand-icon">
              <MagicStick />
            </el-icon>
            <span class="brand-text">Deepseek Toolkit</span>
          </div>
          <p class="brand-tagline">
            对话即资产，让每一次 AI 对话都值得被记忆与复用。
          </p>
        </div>

        <div class="footer-links-col">
          <h4 class="col-title">快速链接</h4>
          <ul class="col-list">
            <li v-for="link in quickLinks" :key="link.path">
              <a @click.prevent="$router.push(link.path)" class="col-link">
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>

        <div class="footer-links-col">
          <h4 class="col-title">产品</h4>
          <ul class="col-list">
            <li v-for="link in productLinks" :key="link.path">
              <a @click.prevent="$router.push(link.path)" class="col-link">
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>

        <div class="footer-links-col">
          <h4 class="col-title">资源</h4>
          <ul class="col-list">
            <li v-for="link in resourceLinks" :key="link.path">
              <a @click.prevent="$router.push(link.path)" class="col-link">
                {{ link.label }}
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div class="footer-bottom">
        <div class="copyright">
          © {{ year }} Deepseek Toolkit. All rights reserved.
        </div>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.portal-footer {
  width: 100%;
  border-top: 1px solid var(--border);
  background: color-mix(in srgb, var(--surface) 85%, transparent);
  -webkit-backdrop-filter: saturate(180%) blur(14px);
  backdrop-filter: saturate(180%) blur(14px);
  padding: 48px 0 24px;
  margin-top: auto;
}

.footer-inner {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 28px;
}

.footer-columns {
  display: grid;
  grid-template-columns: 1.5fr 1fr 1fr 1fr;
  gap: 40px;
  margin-bottom: 36px;
}

.footer-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.brand-icon {
  color: var(--primary);
}

.brand-text {
  font-size: 17px;
  font-weight: var(--font-weight-black);
  color: var(--text);
  letter-spacing: -0.01em;
}

.brand-tagline {
  font-size: 13.5px;
  color: var(--text-secondary);
  line-height: 1.6;
  max-width: 280px;
  margin: 0;
}

.footer-links-col {
  min-width: 0;
}

.col-title {
  font-size: 13.5px;
  font-weight: var(--font-weight-bold);
  color: var(--text);
  margin: 0 0 14px;
  letter-spacing: 0.02em;
}

.col-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.col-link {
  font-size: 13px;
  color: var(--text-secondary);
  cursor: pointer;
  transition: color var(--transition-fast);
}

.col-link:hover {
  color: var(--primary);
}

.footer-bottom {
  padding-top: 20px;
  border-top: 1px solid var(--border-subtle);
}

.copyright {
  font-size: 12.5px;
  color: var(--text-muted);
  text-align: center;
}

@media (max-width: 960px) {
  .portal-footer {
    padding: 36px 0 20px;
  }

  .footer-columns {
    grid-template-columns: 1fr 1fr;
    gap: 28px;
  }

  .footer-brand-col {
    grid-column: span 2;
  }

  .footer-inner {
    padding: 0 18px;
  }
}

@media (max-width: 560px) {
  .footer-columns {
    grid-template-columns: 1fr;
    gap: 24px;
  }

  .footer-brand-col {
    grid-column: span 1;
  }
}
</style>
