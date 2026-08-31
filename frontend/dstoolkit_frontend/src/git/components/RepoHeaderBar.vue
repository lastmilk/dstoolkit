<script setup lang="ts">
/**
 * RepoHeaderBar —— 仓库顶部导航条（页签切换：代码/提交/分支/标签/PR/历史）
 */
import { computed } from 'vue'
import type { GitRepoEntity, GitBranchEntity, GitTagEntity } from '../types/types'

const props = defineProps<{
  repo: GitRepoEntity
  branches: GitBranchEntity[]
  tags: GitTagEntity[]
  tab:
    | 'code' | 'commits' | 'branches' | 'tags'
    | 'compare' | 'prs' | 'insights' | 'reflog'
}>()

const emit = defineEmits<{
  'update:tab': [typeof props.tab]
}>()

const tabs = [
  { key: 'code', label: '📁 代码', hint: '文件与快照' },
  { key: 'commits', label: '📦 提交', hint: props.branches.length ? `${props.branches[0]?.commitCount ?? 0} commits` : '' },
  { key: 'branches', label: '🌿 分支', hint: `${props.branches.length} branches` },
  { key: 'tags', label: '🏷️ 标签', hint: `${props.tags.length} tags` },
  { key: 'compare', label: '🆚 比较', hint: '分支/标签对比' },
  { key: 'prs', label: '🔀 合并请求', hint: `${props.repo.pullRequestCount ?? 0} PR` },
  { key: 'reflog', label: '🧾 Reflog', hint: '操作历史 / 回滚' },
  { key: 'insights', label: '📈 洞察', hint: '贡献统计' },
] as const

const meta = computed(() => {
  return tabs.find(t => t.key === props.tab)
})
</script>

<template>
  <div class="repo-header">
    <div class="rh-top">
      <div class="rh-title-block">
        <div class="rh-owner">
          <span class="rh-repo-icon">🗂️</span>
          <span class="rh-repo-name">{{ repo.name }}</span>
          <span
            class="rh-vis"
            :title="repo.visibility"
          >{{ repo.visibility === 'PRIVATE' ? '🔒 私有' : repo.visibility === 'UNLISTED' ? '🔗 未列出' : '🌍 公开' }}</span>
        </div>
        <div class="rh-desc" v-if="repo.description">{{ repo.description }}</div>
        <div class="rh-stats">
          <span>🌿 {{ branches.length }} 分支</span>
          <span>🏷️ {{ tags.length }} 标签</span>
          <span>⭐ {{ repo.starCount ?? 0 }}</span>
          <span>🔀 {{ repo.pullRequestCount ?? 0 }} PR</span>
        </div>
      </div>
    </div>
    <div class="rh-tabs">
      <div
        v-for="t in tabs"
        :key="t.key"
        class="rh-tab"
        :class="{ active: tab === t.key }"
        @click="emit('update:tab', t.key as any)"
      >
        <span class="rh-tab-label">{{ t.label }}</span>
        <span v-if="t.hint" class="rh-tab-hint">{{ t.hint }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.repo-header {
  background: var(--neutral-soft);
  border-radius: 12px;
  padding: 14px 18px 0;
  border: 1px solid var(--border-color);
}
.rh-top { display: flex; justify-content: space-between; gap: 16px; flex-wrap: wrap; }
.rh-title-block { flex: 1; min-width: 300px; }
.rh-owner {
  display: flex; align-items: center; gap: 10px;
  font-size: 17px; font-weight: 600;
}
.rh-repo-icon { font-size: 22px; }
.rh-repo-name { font-family: ui-monospace, monospace; }
.rh-vis {
  font-size: 11px; padding: 2px 10px; border-radius: 999px;
  background: white; color: var(--text-muted);
  border: 1px solid var(--border-color); font-weight: 500;
  margin-left: 4px;
}
.rh-desc {
  font-size: 13px; color: var(--text-secondary); margin-top: 6px;
  line-height: 1.5;
}
.rh-stats {
  display: flex; gap: 14px; font-size: 12px; color: var(--text-muted);
  margin-top: 8px; font-family: ui-monospace, monospace;
}
.rh-tabs {
  display: flex; gap: 2px; margin-top: 16px;
  overflow-x: auto; border-bottom: 2px solid transparent;
}
.rh-tab {
  display: inline-flex; align-items: center; gap: 6px;
  padding: 10px 14px; cursor: pointer;
  border-bottom: 2px solid transparent;
  font-size: 13px; white-space: nowrap;
  color: var(--text-muted);
  transition: all .15s;
}
.rh-tab:hover { color: var(--text-color); background: rgba(255,255,255,.4); }
.rh-tab.active {
  color: var(--primary); font-weight: 600;
  border-bottom-color: var(--primary);
}
.rh-tab-label {}
.rh-tab-hint {
  font-size: 10.5px; color: inherit;
  background: rgba(0,0,0,.04); padding: 1px 7px; border-radius: 999px;
  opacity: .8;
}
</style>
