<script setup lang="ts">
/**
 * BranchSelector — 分支/标签选择器（下拉）
 * Props:
 *   branches: GitBranchEntity[]
 *   tags: GitTagEntity[]
 *   modelValue: string (当前ref名)
 *   currentBranchId?: number | null
 * Events:
 *   'update:modelValue'
 *   'create-branch' (输入新分支名，回车时触发)
 *   'compare' （切换到对比模式，选中两个分支）
 */
import { computed, ref, watch } from 'vue'
import type { GitBranchEntity, GitTagEntity } from '../types/types'

const props = defineProps<{
  branches: GitBranchEntity[]
  tags: GitTagEntity[]
  modelValue: string
  mode?: 'single' | 'compare-from' | 'compare-to'
  placeholder?: string
  allowCreate?: boolean
  defaultBranchName?: string | null
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'create-branch': [newBranchName: string, baseRef: string]
}>()

const open = ref(false)
const tab = ref<'branches' | 'tags' | 'all'>('all')
const q = ref('')
const newName = ref('')

watch(() => props.modelValue, () => { open.value = false })

const branchesSorted = computed(() => {
  const base = [...props.branches]
  return base.sort((a, b) => {
    // default first
    if (a.isDefault !== b.isDefault) return a.isDefault ? -1 : 1
    return a.name.localeCompare(b.name)
  })
})

function filter<T extends { name: string }>(arr: T[]) {
  if (!q.value) return arr
  const t = q.value.toLowerCase()
  return arr.filter(x => x.name.toLowerCase().includes(t))
}

function select(v: string) { emit('update:modelValue', v) }
function onKeydownNew(e: KeyboardEvent) {
  if (e.key === 'Enter' && newName.value.trim()) {
    emit('create-branch', newName.value.trim(), props.modelValue)
    newName.value = ''
    open.value = false
  }
}
</script>

<template>
  <div class="branch-sel" :class="{ open }">
    <div class="bs-trigger" @click="open = !open">
      <span class="bs-icon">🌿</span>
      <span class="bs-value" :title="modelValue">{{ modelValue || (placeholder ?? '选择分支/标签') }}</span>
      <span class="bs-chevron">{{ open ? '▲' : '▼' }}</span>
    </div>
    <div v-if="open" class="bs-panel neu-card" @click.stop>
      <div class="bs-tabs">
        <span :class="{active: tab === 'all'}" @click="tab = 'all'">全部</span>
        <span :class="{active: tab === 'branches'}" @click="tab = 'branches'">
          🌿 分支 ({{ branches.length }})
        </span>
        <span :class="{active: tab === 'tags'}" @click="tab = 'tags'">
          🏷️ 标签 ({{ tags.length }})
        </span>
      </div>
      <input v-model="q" class="bs-search" placeholder="🔍 搜索..." />
      <div class="bs-list">
        <template v-if="tab !== 'tags'">
          <div class="bs-group-label">分支</div>
          <div
            v-for="b in filter(branchesSorted)"
            :key="b.id"
            class="bs-item"
            :class="{ active: b.name === modelValue, 'is-default': b.isDefault, 'is-protected': b.protectionLevel !== 'NONE' }"
            @click="select(b.name)"
          >
            <span class="bs-bullet">🌿</span>
            <span class="bs-name">{{ b.name }}</span>
            <span v-if="b.isDefault" class="bs-badge default">默认</span>
            <span v-if="b.protectionLevel === 'PROTECTED'" class="bs-badge protected">受保护</span>
            <span v-else-if="b.protectionLevel === 'LOCKED'" class="bs-badge locked">锁定</span>
            <span class="bs-meta" :title="b.headCommitSha">{{ b.headCommitSha?.slice(0, 7) }}</span>
          </div>
          <div v-if="filter(branchesSorted).length === 0" class="bs-empty">无匹配分支</div>
        </template>
        <template v-if="tab !== 'branches'">
          <div class="bs-group-label">标签</div>
          <div
            v-for="t in filter(tags)"
            :key="t.id"
            class="bs-item"
            :class="{ active: t.name === modelValue }"
            @click="select(t.name)"
          >
            <span class="bs-bullet">🏷️</span>
            <span class="bs-name">{{ t.name }}</span>
            <span class="bs-meta" :title="t.targetCommitSha">{{ t.targetCommitSha.slice(0, 7) }}</span>
          </div>
          <div v-if="filter(tags).length === 0" class="bs-empty">无匹配标签</div>
        </template>
      </div>
      <div v-if="allowCreate" class="bs-create">
        <span class="bs-create-label">从当前 ({{ modelValue || defaultBranchName || '默认' }}) 创建新分支：</span>
        <div class="bs-create-row">
          <input
            v-model="newName"
            class="bs-new-input"
            placeholder="新分支名，如 feature/x"
            @keydown="onKeydownNew"
          />
          <button
            class="btn btn-primary"
            :disabled="!newName.trim()"
            @click="newName.trim() && emit('create-branch', newName.trim(), modelValue)"
          >创建</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.branch-sel { position: relative; display: inline-block; }
.bs-trigger {
  display: inline-flex; align-items: center; gap: 8px;
  padding: 6px 12px; background: var(--neutral-soft);
  border-radius: 8px; border: 1px solid var(--border-color);
  cursor: pointer; font-size: 13px; min-width: 200px;
}
.bs-trigger:hover { background: var(--primary-bg-soft); border-color: var(--primary-soft); }
.bs-icon { font-size: 14px; }
.bs-value { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 500; font-family: ui-monospace, monospace; }
.bs-chevron { font-size: 9px; color: var(--text-muted); }
.bs-panel {
  position: absolute; top: calc(100% + 6px); left: 0; min-width: 420px; max-width: 560px;
  z-index: 100; padding: 8px 0;
}
.bs-tabs {
  display: flex; gap: 6px; padding: 6px 12px; border-bottom: 1px solid var(--border-color);
  font-size: 12.5px; color: var(--text-muted);
}
.bs-tabs span { padding: 3px 10px; border-radius: 6px; cursor: pointer; }
.bs-tabs span.active { background: var(--primary-bg-soft); color: var(--primary); font-weight: 600; }
.bs-search {
  margin: 8px 12px; width: calc(100% - 24px);
  padding: 6px 10px; border: 1px solid var(--border-color);
  border-radius: 6px; font-size: 13px;
  outline: none;
}
.bs-search:focus { border-color: var(--primary); }
.bs-list { max-height: 300px; overflow: auto; }
.bs-group-label {
  padding: 8px 12px 4px; font-size: 11px;
  color: var(--text-muted); text-transform: uppercase; letter-spacing: .5px;
}
.bs-item {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 12px; font-size: 13px;
  cursor: pointer; border-radius: 6px; margin: 1px 6px;
}
.bs-item:hover { background: var(--neutral-soft); }
.bs-item.active { background: var(--primary-bg-soft); }
.bs-item.is-default { font-weight: 600; }
.bs-bullet { font-size: 14px; }
.bs-name { flex: 1; font-family: ui-monospace, monospace; }
.bs-badge { font-size: 10px; padding: 1px 6px; border-radius: 4px; text-transform: uppercase; }
.bs-badge.default { background: var(--primary-bg-soft); color: var(--primary); }
.bs-badge.protected { background: var(--warn-bg); color: var(--warn-fg); }
.bs-badge.locked { background: var(--danger-bg); color: var(--danger-fg); }
.bs-meta { font-size: 11px; color: var(--text-muted); font-family: ui-monospace, monospace; }
.bs-empty { padding: 10px 20px; color: var(--text-muted); font-size: 12.5px; }
.bs-create { padding: 10px 12px; border-top: 1px solid var(--border-color); }
.bs-create-label { font-size: 11.5px; color: var(--text-muted); display: block; margin-bottom: 6px; }
.bs-create-row { display: flex; gap: 6px; }
.bs-new-input {
  flex: 1; padding: 6px 10px; border: 1px solid var(--border-color);
  border-radius: 6px; outline: none; font-family: ui-monospace, monospace;
}
.bs-new-input:focus { border-color: var(--primary); }
.btn { padding: 5px 12px; border-radius: 6px; font-size: 12.5px; cursor: pointer; border: 1px solid transparent; }
.btn-primary { background: var(--primary); color: white; }
.btn-primary:disabled { opacity: .5; cursor: not-allowed; }
</style>
