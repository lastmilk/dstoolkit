<script setup lang="ts">
/**
 * PullRequestCard —— PR卡片组件
 * Props:
 *   pr: PullRequestEntity
 *   repoDefaultBranch?: string
 * Emits:
 *   open, merge, close, reopen, review
 */
import { computed } from 'vue'
import type { PullRequestEntity } from '../types/types'

const props = defineProps<{
  pr: PullRequestEntity
  repoDefaultBranch?: string
}>()

const emit = defineEmits<{
  'open': []
  'merge': []
  'close': []
  'reopen': []
  'review': []
}>()

const statusColors = {
  OPEN: { bg: 'var(--success-bg)', fg: 'var(--success-fg)', text: '待审核', icon: '🟢' },
  DRAFT: { bg: 'var(--neutral-soft)', fg: 'var(--text-muted)', text: '草稿', icon: '📝' },
  REVIEW: { bg: 'var(--info-bg)', fg: 'var(--info-fg)', text: '审核中', icon: '🔍' },
  APPROVED: { bg: 'var(--success-bg)', fg: 'var(--success-fg)', text: '已批准', icon: '✅' },
  CHANGES_REQUESTED: { bg: 'var(--warn-bg)', fg: 'var(--warn-fg)', text: '要求修改', icon: '🟡' },
  MERGED: { bg: '#ede9fe', fg: '#6d28d9', text: '已合并', icon: '🟣' },
  CLOSED: { bg: 'var(--danger-bg)', fg: 'var(--danger-fg)', text: '已关闭', icon: '⚫' },
}

const sc = computed(() => (statusColors as any)[props.pr.status] ?? statusColors.OPEN))

function timeAgo(iso: string) {
  const d = new Date(iso).getTime()
  const diff = Date.now() - d
  const s = Math.floor(diff / 1000)
  if (s < 60) return `${s}秒前`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}分钟前`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}小时前`
  const dy = Math.floor(h / 24)
  if (dy < 30) return `${dy}天前`
  return new Date(iso).toLocaleDateString()
}

function canMerge() {
  return (props.pr.status === 'OPEN' || props.pr.status === 'REVIEW' || props.pr.status === 'APPROVED')
    && !props.pr.mergeBlockedReason
}
</script>

<template>
  <div class="pr-card neu-card" @click="emit('open')">
    <div class="pr-top">
      <div class="pr-title-row">
        <span class="pr-status" :style="{ background: sc.bg, color: sc.fg }">
          <span style="margin-right: 4px;">{{ sc.icon }}</span>{{ sc.text }}
        </span>
        <span class="pr-num">#{{ pr.number }}</span>
        <span class="pr-title" :title="pr.title">{{ pr.title }}</span>
      </div>
      <div class="pr-flow">
        <span class="pr-branch from">{{ pr.headBranchName }}</span>
        <span class="pr-arrow">→</span>
        <span class="pr-branch to">{{ pr.baseBranchName }}</span>
      </div>
    </div>
    <div class="pr-body">
      <div v-if="pr.description" class="pr-desc">{{ pr.description }}</div>
      <div class="pr-meta">
        <span class="pr-author">🗣️ {{ pr.authorName }}</span>
        <span class="pr-time">⏱️ {{ timeAgo(pr.createdAt) }}</span>
        <span class="pr-comments" v-if="pr.commentCount">💬 {{ pr.commentCount }}</span>
        <span class="pr-stat" v-if="pr.commitsAhead != null">📦 {{ pr.commitsAhead }} commits</span>
        <span class="pr-adds" v-if="pr.additions != null">+{{ pr.additions }}</span>
        <span class="pr-dels" v-if="pr.deletions != null">-{{ pr.deletions }}</span>
        <span class="pr-changed" v-if="pr.changedFiles != null">📁 {{ pr.changedFiles }} 个文件</span>
      </div>
      <div v-if="pr.mergeBlockedReason" class="pr-blocked">
        ⚠️ 无法合并：{{ pr.mergeBlockedReason }}
      </div>
    </div>
    <div class="pr-actions" @click.stop>
      <button class="btn btn-ghost" @click="emit('review')">💬 查看讨论</button>
      <template v-if="pr.status === 'OPEN' || pr.status === 'REVIEW' || pr.status === 'CHANGES_REQUESTED' || pr.status === 'APPROVED'">
        <button class="btn btn-warn" @click="emit('close')">关闭</button>
        <button
          class="btn btn-primary"
          :disabled="!canMerge()"
          :title="canMerge() ? '合并此PR' : (pr.mergeBlockedReason ?? '当前状态不可合并')"
          @click="emit('merge')"
        >合并</button>
      </template>
      <template v-else-if="pr.status === 'CLOSED' || pr.status === 'DRAFT'">
        <button class="btn btn-info" v-if="pr.status === 'CLOSED'" @click="emit('reopen')">重新打开</button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.pr-card { padding: 14px 16px; cursor: pointer; transition: transform .15s; }
.pr-card:hover { transform: translateY(-1px); }
.pr-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; flex-wrap: wrap; }
.pr-title-row { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 260px; }
.pr-status {
  display: inline-flex; align-items: center;
  font-size: 11.5px; padding: 2px 10px; border-radius: 999px;
  font-weight: 600; letter-spacing: .3px;
}
.pr-num {
  font-family: ui-monospace, monospace; font-size: 13px;
  color: var(--text-muted); font-weight: 600;
}
.pr-title {
  font-size: 15px; font-weight: 600; overflow: hidden;
  text-overflow: ellipsis; white-space: nowrap;
}
.pr-flow { display: flex; align-items: center; gap: 8px; }
.pr-branch {
  background: var(--neutral-soft); padding: 3px 10px; border-radius: 6px;
  font-family: ui-monospace, monospace; font-size: 12px;
  border: 1px solid var(--border-color);
}
.pr-branch.from { background: var(--success-bg); color: var(--success-fg); border-color: transparent; }
.pr-branch.to { background: var(--info-bg); color: var(--info-fg); border-color: transparent; }
.pr-arrow { color: var(--text-muted); }
.pr-body { margin-top: 10px; }
.pr-desc {
  font-size: 13px; color: var(--text-color);
  max-height: 3.6em; overflow: hidden; line-height: 1.5;
  margin-bottom: 8px;
}
.pr-meta {
  display: flex; flex-wrap: wrap; gap: 10px 14px;
  font-size: 12px; color: var(--text-muted);
  font-family: ui-monospace, monospace;
}
.pr-meta span { display: inline-flex; align-items: center; gap: 3px; }
.pr-comments { color: var(--primary); }
.pr-adds { color: var(--success); font-weight: 600; }
.pr-dels { color: var(--danger); font-weight: 600; }
.pr-blocked {
  margin-top: 8px; font-size: 12px;
  padding: 6px 10px; background: var(--danger-bg); color: var(--danger-fg);
  border-radius: 6px;
}
.pr-actions {
  margin-top: 12px; display: flex; gap: 8px; justify-content: flex-end;
  padding-top: 10px; border-top: 1px dashed var(--border-color);
}
.btn {
  padding: 5px 14px; border-radius: 6px; font-size: 12.5px; cursor: pointer;
  border: 1px solid var(--border-color); background: white;
}
.btn:disabled { opacity: .45; cursor: not-allowed; }
.btn-ghost:hover { background: var(--neutral-soft); }
.btn-primary { background: var(--primary); color: white; border-color: transparent; }
.btn-warn { background: var(--danger-bg); color: var(--danger-fg); border-color: transparent; }
.btn-info { background: var(--info-bg); color: var(--info-fg); border-color: transparent; }
</style>
