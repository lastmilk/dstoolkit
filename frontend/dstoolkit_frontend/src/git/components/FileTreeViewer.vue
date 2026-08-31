<script setup lang="ts">
/**
 * FileTreeViewer — 仓库文件树浏览
 * Props:
 *   files: 扁平文件数组（来自 ListTreeResponse.files）
 *   treeId?: number
 *   onFileClick: (path) => void
 * Features:
 *   - 自动按 / 分组文件夹
 *   - 点击目录展开/收起
 *   - 按图标区分文件类型
 */
import { computed } from 'vue'
import { reactive } from 'vue'

export interface TreeFile {
  path: string
  mode?: string
  blobId: number
  sha: string
  sizeBytes: number
  mimeType?: string
  messageId?: number
}

const props = defineProps<{
  files: TreeFile[]
  emptyText?: string
}>()

const emit = defineEmits<{
  'file-click': [path: string, file: TreeFile]
}>()

interface FNode {
  name: string
  isDir: boolean
  path: string
  file?: TreeFile
  children: Map<string, FNode>
  size?: number
}

const expanded = reactive(new Set<string>())
function toggleDir(path: string) {
  if (expanded.has(path)) expanded.delete(path)
  else expanded.add(path)
}

const root = computed<FNode>(() => {
  const root: FNode = { name: '', isDir: true, path: '', children: new Map() }
  for (const f of props.files) {
    const parts = f.path.split('/').filter(Boolean)
    let cur = root
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]
      const isLast = i === parts.length - 1
      const curPath = parts.slice(0, i + 1).join('/')
      if (isLast) {
        if (!cur.children.has(p)) {
          cur.children.set(p, {
            name: p, isDir: false, path: curPath, file: f, children: new Map(), size: f.sizeBytes,
          })
        }
      } else {
        if (!cur.children.has(p)) {
          cur.children.set(p, {
            name: p, isDir: true, path: curPath, children: new Map(),
          })
        }
        cur = cur.children.get(p)!
      }
    }
  }
  return root
})

function fileIcon(file?: TreeFile) {
  if (!file) return '📁'
  const p = file.path.toLowerCase()
  if (p.endsWith('.msg')) return '💬'
  if (p.endsWith('.json')) return '📋'
  if (p.endsWith('.md')) return '📝'
  if (p.endsWith('.png') || p.endsWith('.jpg') || p.endsWith('.gif')) return '🖼️'
  if (p.endsWith('.zip')) return '🗜️'
  return '📄'
}

function formatSize(n: number) {
  if (n < 1024) return `${n}B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`
  return `${(n / 1024 / 1024).toFixed(2)}MB`
}

// 扁平渲染（递归），便于 Vue 循环
type FlatRow =
  | { kind: 'dir'; node: FNode; depth: number }
  | { kind: 'file'; node: FNode; depth: number }

const flatRows = computed<FlatRow[]>(() => {
  const rows: FlatRow[] = []
  const walk = (node: FNode, depth: number) => {
    const entries = [...node.children.values()].sort((a, b) => {
      if (a.isDir !== b.isDir) return a.isDir ? -1 : 1
      return a.name.localeCompare(b.name)
    })
    for (const c of entries) {
      if (c.isDir) {
        rows.push({ kind: 'dir', node: c, depth })
        if (expanded.has(c.path) || depth === 0) {
          walk(c, depth + 1)
        }
      } else {
        rows.push({ kind: 'file', node: c, depth })
      }
    }
  }
  walk(root.value, 0)
  return rows
})
</script>

<template>
  <div class="file-tree neu-card" style="padding: 6px 0;">
    <div v-if="flatRows.length === 0" class="ft-empty">{{ emptyText ?? '空目录' }}</div>
    <div v-else>
      <div
        v-for="(r, i) in flatRows"
        :key="i"
        class="ft-row"
        :style="{ paddingLeft: (8 + r.depth * 18) + 'px' }"
      >
        <div
          v-if="r.kind === 'dir'"
          class="ft-item ft-dir"
          @click="toggleDir(r.node.path)"
        >
          <span class="ft-caret">{{ expanded.has(r.node.path) || r.depth === 0 ? '▼' : '▶' }}</span>
          <span class="ft-icon">📁</span>
          <span class="ft-name">{{ r.node.name }}</span>
        </div>
        <div
          v-else
          class="ft-item ft-file"
          @click="emit('file-click', r.node.path, r.node.file!)"
        >
          <span class="ft-caret"></span>
          <span class="ft-icon">{{ fileIcon(r.node.file) }}</span>
          <span class="ft-name">{{ r.node.name }}</span>
          <span class="ft-size">{{ formatSize(r.node.size ?? 0) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.file-tree { border-radius: 10px; overflow: hidden; }
.ft-empty { padding: 20px; text-align: center; color: var(--text-muted); }
.ft-row { user-select: none; }
.ft-item {
  display: flex; align-items: center; gap: 6px;
  padding: 5px 10px; border-radius: 6px; margin: 1px 4px;
  font-size: 13px; cursor: pointer;
}
.ft-item:hover { background: var(--neutral-soft); }
.ft-caret { width: 14px; display: inline-block; font-size: 10px; color: var(--text-muted); }
.ft-icon { font-size: 14px; }
.ft-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-family: ui-monospace, monospace; }
.ft-size { font-size: 11.5px; color: var(--text-muted); margin-left: auto; font-family: ui-monospace, monospace; }
.ft-dir .ft-name { font-weight: 600; }
</style>
