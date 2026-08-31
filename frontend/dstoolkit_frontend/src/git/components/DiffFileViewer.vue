<script setup lang="ts">
/**
 * DiffFileViewer 单文件Diff查看器
 *  - 左右分栏（Split View）或统一行（Unified View）
 *  - 词级精细化高亮（tokens refine）
 *  - 点击行号触发行内评论回调
 *  - 支持展开/收起大文件
 * Props:
 *   file: DiffFileResult
 *   viewMode: 'split' | 'unified'
 *   oldPathLabel?: string, newPathLabel?: string
 *   onLineClick?: (side: 'LEFT'|'RIGHT', lineNo:number, path:string) => void
 */
import { computed, ref } from 'vue'
import type { DiffFileResult, DiffLine } from '../types/types'

const props = withDefaults(defineProps<{
  file: DiffFileResult
  viewMode?: 'split' | 'unified'
  oldPathLabel?: string
  newPathLabel?: string
  maxLinesBeforeCollapse?: number
}>(), {
  viewMode: 'split',
  maxLinesBeforeCollapse: 300,
})

const emit = defineEmits<{
  'line-click': [side: 'LEFT' | 'RIGHT', lineNo: number, path: string, blobSha?: string]
}>()

const collapsed = ref(false)
function toggle() { collapsed.value = !collapsed.value }

function clsFor(op: string) {
  switch (op) {
    case 'INSERT': return 'diff-insert'
    case 'DELETE': return 'diff-delete'
    case 'EQUAL': return ''
    default: return ''
  }
}

// 将 tokens 渲染为 <span> HTML（插入/删除的内联变化）
function renderInline(line: DiffLine): string {
  if (!line.tokens || line.tokens.length === 0) return escapeHtml(line.content)
  const out: string[] = []
  for (const t of line.tokens) {
    const text = escapeHtml(t.text)
    if (t.op === 'EQUAL') out.push(text)
    else if (t.op === 'INSERT') out.push(`<span class="diff-inline-ins">${text}</span>`)
    else if (t.op === 'DELETE') out.push(`<span class="diff-inline-del">${text}</span>`)
    else out.push(text)
  }
  return out.join('')
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

const title = computed(() => {
  const p = props.file
  if (p.status === 'added') return `+ 新增文件：${p.newPath}`
  if (p.status === 'deleted') return `- 删除文件：${p.oldPath}`
  if (p.status === 'renamed') return `重命名：${p.oldPath} → ${p.newPath}（相似度 ${p.similarity}%）`
  return `修改：${p.oldPath ?? p.newPath}`
})

const tooLarge = computed(() => {
  let total = 0
  for (const h of props.file.hunks) total += h.lines.length
  return total > props.maxLinesBeforeCollapse
})

const leftHeader = computed(() => props.oldPathLabel ?? props.file.oldPath ?? '（旧）')
const rightHeader = computed(() => props.newPathLabel ?? props.file.newPath ?? '（新）')

// 为 split view 把 EQUAL/DELETE/INSERT 对齐成并排 "行"
type SplitRow =
  | { kind: 'EQUAL'; left: DiffLine; right: DiffLine }
  | { kind: 'DEL'; left: DiffLine; right: DiffLine | null }
  | { kind: 'INS'; left: DiffLine | null; right: DiffLine }

const splitRows = computed<SplitRow[]>(() => {
  const rows: SplitRow[] = []
  const delBuf: DiffLine[] = []
  const insBuf: DiffLine[] = []
  const flush = () => {
    while (delBuf.length || insBuf.length) {
      const d = delBuf.shift() ?? null
      const i = insBuf.shift() ?? null
      if (d && !i) rows.push({ kind: 'DEL', left: d, right: null })
      else if (!d && i) rows.push({ kind: 'INS', left: null, right: i })
      else rows.push({ kind: 'DEL', left: d!, right: i }) // 冲突并排显示
    }
  }
  for (const hunk of props.file.hunks) {
    for (const ln of hunk.lines) {
      if (ln.op === 'EQUAL') {
        flush()
        rows.push({ kind: 'EQUAL', left: ln, right: ln })
      } else if (ln.op === 'DELETE') {
        delBuf.push(ln)
      } else if (ln.op === 'INSERT') {
        insBuf.push(ln)
      }
    }
  }
  flush()
  return rows
})

function onLineClickInner(side: 'LEFT' | 'RIGHT', lineNo: number | undefined) {
  if (lineNo == null) return
  const path = side === 'LEFT' ? props.file.oldPath : props.file.newPath
  const sha = side === 'LEFT' ? props.file.oldSha : props.file.newSha
  emit('line-click', side, lineNo, path ?? '', sha)
}
</script>

<template>
  <div class="diff-file-card neu-card" style="margin-bottom: 16px;">
    <div class="diff-file-header" @click="tooLarge && toggle()" :class="{ clickable: tooLarge }">
      <div class="diff-title">
        <span class="diff-status-badge" :class="file.status">{{ file.status }}</span>
        <span class="diff-path" v-html="title"></span>
      </div>
      <div class="diff-stats">
        <span class="diff-adds">+{{ file.additions }}</span>
        <span class="diff-dels">-{{ file.deletions }}</span>
        <span v-if="tooLarge" class="diff-collapse-btn">{{ collapsed ? '展开' : '收起' }}</span>
      </div>
    </div>

    <div v-if="tooLarge && collapsed" class="diff-collapsed-tip">
      文件过大（超过 {{ maxLinesBeforeCollapse }} 行变更），点击标题展开查看
    </div>

    <div v-else class="diff-body">
      <!-- Split view -->
      <table v-if="viewMode === 'split'" class="diff-table split">
        <thead>
          <tr>
            <th class="diff-num-col">{{ leftHeader }}</th>
            <th class="diff-code-col"></th>
            <th class="diff-num-col">{{ rightHeader }}</th>
            <th class="diff-code-col"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(row, idx) in splitRows" :key="idx">
            <tr v-if="row.kind === 'EQUAL'">
              <td class="diff-num" @click="onLineClickInner('LEFT', row.left.oldLineNo)">{{ row.left.oldLineNo }}</td>
              <td class="diff-code"><pre v-html="renderInline(row.left)"></pre></td>
              <td class="diff-num" @click="onLineClickInner('RIGHT', row.right.newLineNo)">{{ row.right.newLineNo }}</td>
              <td class="diff-code"><pre v-html="renderInline(row.right)"></pre></td>
            </tr>
            <tr v-else-if="row.kind === 'DEL'">
              <td
                class="diff-num diff-num-del"
                @click="onLineClickInner('LEFT', row.left?.oldLineNo)"
              >{{ row.left?.oldLineNo ?? '' }}</td>
              <td class="diff-code diff-delete">
                <pre v-if="row.left" v-html="renderInline(row.left)"></pre>
              </td>
              <td class="diff-num">{{ row.right ? (row.right as any).newLineNo ?? '' : '' }}</td>
              <td class="diff-code" :class="row.right ? 'diff-insert' : ''">
                <pre v-if="row.right" v-html="renderInline(row.right)"></pre>
                <span v-else class="diff-empty-block"></span>
              </td>
            </tr>
            <tr v-else-if="row.kind === 'INS'">
              <td class="diff-num">{{ row.left?.oldLineNo ?? '' }}</td>
              <td class="diff-code" :class="row.left ? 'diff-delete' : ''">
                <pre v-if="row.left" v-html="renderInline(row.left)"></pre>
                <span v-else class="diff-empty-block"></span>
              </td>
              <td
                class="diff-num diff-num-ins"
                @click="onLineClickInner('RIGHT', row.right?.newLineNo)"
              >{{ row.right?.newLineNo ?? '' }}</td>
              <td class="diff-code diff-insert">
                <pre v-if="row.right" v-html="renderInline(row.right)"></pre>
              </td>
            </tr>
          </template>
        </tbody>
      </table>

      <!-- Unified view -->
      <table v-else class="diff-table unified">
        <thead>
          <tr>
            <th class="diff-num-col">旧</th>
            <th class="diff-num-col">新</th>
            <th class="diff-code-col"></th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(hunk, i) in file.hunks" :key="'h'+i">
            <tr class="diff-hunk-head">
              <td colspan="3">
                @@ -{{ hunk.oldStart }},{{ hunk.oldCount }} +{{ hunk.newStart }},{{ hunk.newCount }} @@
                <span v-if="hunk.sectionHeader" class="diff-section">{{ hunk.sectionHeader }}</span>
              </td>
            </tr>
            <tr v-for="(ln, j) in hunk.lines" :key="'l'+i+'-'+j" :class="clsFor(ln.op)">
              <td class="diff-num">{{ ln.oldLineNo ?? '' }}</td>
              <td class="diff-num">{{ ln.newLineNo ?? '' }}</td>
              <td class="diff-code">
                <span class="diff-prefix">{{ ln.op === 'INSERT' ? '+' : ln.op === 'DELETE' ? '-' : ' ' }}</span>
                <pre v-html="renderInline(ln)"></pre>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>
  </div>
</template>

<style scoped>
.diff-file-card { border-radius: 12px; overflow: hidden; }
.diff-file-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 10px 14px; background: var(--diff-header-bg, #f6f8fa);
  border-bottom: 1px solid var(--border-color, #e5e7eb);
}
.diff-file-header.clickable { cursor: pointer; }
.diff-title { display: flex; align-items: center; gap: 10px; flex: 1; overflow: hidden; }
.diff-status-badge {
  font-size: 11px; padding: 2px 8px; border-radius: 999px;
  background: var(--neutral-soft); text-transform: uppercase; letter-spacing: .5px;
}
.diff-status-badge.added { background: var(--success-bg); color: var(--success-fg); }
.diff-status-badge.deleted { background: var(--danger-bg); color: var(--danger-fg); }
.diff-status-badge.modified { background: var(--warn-bg); color: var(--warn-fg); }
.diff-status-badge.renamed { background: var(--info-bg); color: var(--info-fg); }
.diff-path { font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.diff-stats { display: flex; gap: 10px; align-items: center; font-size: 13px; font-family: ui-monospace, monospace; }
.diff-adds { color: var(--success); font-weight: 600; }
.diff-dels { color: var(--danger); font-weight: 600; }
.diff-collapse-btn {
  margin-left: 10px; font-size: 12px; color: var(--primary); cursor: pointer;
  border: 1px solid var(--primary-soft); padding: 2px 8px; border-radius: 6px;
}
.diff-collapsed-tip { padding: 10px 14px; color: var(--text-muted); font-size: 12px; text-align: center; }

.diff-table {
  width: 100%; border-collapse: collapse; table-layout: fixed;
  font-family: ui-monospace, Menlo, Consolas, monospace; font-size: 12.5px;
}
.diff-table th {
  padding: 6px 10px; text-align: left; font-weight: 500; font-size: 11px;
  color: var(--text-muted); background: var(--diff-header-bg, #f6f8fa);
  border-bottom: 1px solid var(--border-color);
}
.diff-table .diff-num-col { width: 50px; text-align: right; }
.diff-table.split .diff-code-col { width: calc(50% - 50px); }
.diff-table .diff-num {
  user-select: none; cursor: pointer;
  padding: 0 8px; width: 50px; text-align: right;
  color: var(--text-muted); background: var(--diff-num-bg, #f6f8fa);
  border-right: 1px solid var(--border-color);
  vertical-align: top;
}
.diff-table .diff-num-del { background: var(--danger-bg); color: var(--danger); }
.diff-table .diff-num-ins { background: var(--success-bg); color: var(--success); }
.diff-table .diff-code { padding: 0 10px; vertical-align: top; }
.diff-table .diff-code pre {
  margin: 0; white-space: pre-wrap; word-break: break-word; line-height: 1.5;
  padding: 1px 2px;
}
.diff-delete { background: var(--diff-delete-bg, #ffebe9); }
.diff-insert { background: var(--diff-insert-bg, #dafbe1); }
.diff-inline-del { background: rgba(255,150,150,.5); padding: 1px 2px; border-radius: 3px; }
.diff-inline-ins { background: rgba(120,220,140,.5); padding: 1px 2px; border-radius: 3px; }
.diff-hunk-head td {
  padding: 5px 10px; background: var(--primary-bg-soft);
  color: var(--primary); font-weight: 600;
  border-top: 1px solid var(--border-color);
}
.diff-section { color: var(--text-muted); font-weight: 400; margin-left: 10px; }
.diff-empty-block { display: block; }
.diff-prefix { font-weight: 700; margin-right: 6px; opacity: .6; user-select: none; }
</style>
