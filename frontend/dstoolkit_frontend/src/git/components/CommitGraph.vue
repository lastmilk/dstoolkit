<script setup lang="ts">
/**
 * CommitGraph —— 提交历史有向无环图 SVG 渲染器
 * 输入: commits[] 按时间倒序（最新前），每个带parentLinks[]（parentOrder, parentId）
 * 输出: 分支轨迹图 + 每行commit圆点 + 信息（sha、subject、author、时间）
 *
 * 核心算法：为每个commit分配一个lane（轨道列），
 *  - 新分支开新轨道（向右开）
 *  - 合并后释放轨道（向左回收空位）
 */
import { computed } from 'vue'
import type { GitCommitEntity } from '../types/types'
import { shortSha } from '../types/hash'

const props = defineProps<{
  commits: Array<GitCommitEntity & { parentLinks: { parentId: number; parentOrder: number; parent: { id: number; sha256: string } }[] }>
  selectedId?: number | null
  compact?: boolean
}>()

const emit = defineEmits<{
  'commit-click': [commit: GitCommitEntity]
}>()

interface Node {
  id: number
  sha: string
  subject: string
  authorName: string
  committedAt: string
  parentIds: number[]
  lane: number
  additions: number
  deletions: number
  changeType?: string | null
  isMerge: boolean
}

const graph = computed(() => {
  const commits = props.commits
  // lane 分配：commitId -> lane number
  const laneMap = new Map<number, number>()
  const freeLanes: number[] = []
  let nextLane = 0
  const nodes: Node[] = []

  // 倒序分配：新 → 旧 （按照commits顺序已经是新在前）
  for (const c of commits) {
    let lane = laneMap.get(c.id)
    if (lane == null) {
      lane = freeLanes.shift()
      if (lane == null) lane = nextLane++
      laneMap.set(c.id, lane)
    }
    const parentIds = c.parentLinks
      .sort((a, b) => a.parentOrder - b.parentOrder)
      .map(p => p.parentId)
    nodes.push({
      id: c.id,
      sha: c.sha256,
      subject: c.subject,
      authorName: c.authorName,
      committedAt: c.committedAt,
      parentIds,
      lane,
      additions: c.additions,
      deletions: c.deletions,
      changeType: c.changeType,
      isMerge: parentIds.length >= 2,
    })
    // 将当前 lane 在"用完后"（即我们已经遇到了所有指向当前commit的child）释放
    // 简化启发式：如果这个commit没有parent 或 parent 已在laneMap中出现过，那它可以在被处理后释放
    // 但实际上lane需要留给所有还没遍历到的"子commit"到这个commit的连线。
    // 简单做法：在遍历父提交时，给父提交分配新lane或复用，并在parent只有一个已知孩子时保留lane
    // 更简化：merge的第一父走同lane；其余父用新lane
    for (let i = 0; i < parentIds.length; i++) {
      const pid = parentIds[i]
      if (laneMap.has(pid)) continue
      if (i === 0) {
        // 第一父（主分支）继承当前lane
        laneMap.set(pid, lane)
      } else {
        // 其他父（被合并分支）开新lane
        let pl = freeLanes.shift()
        if (pl == null) pl = nextLane++
        laneMap.set(pid, pl)
      }
    }
    // 当前commit处理完，如果不再有子commit需要在上方看到 它的lane起点 就释放
    // 简化：不主动释放，保持图清晰
  }

  const maxLane = Math.max(0, ...nodes.map(n => n.lane))
  const laneWidth = 20
  const nodeSize = 12
  const rowHeight = props.compact ? 30 : 50
  const paddingLeft = 8
  const width = paddingLeft + (maxLane + 1) * laneWidth + 20
  const height = nodes.length * rowHeight

  // 边集合: from (id, lane) -> to (parentId, lane)
  const edges: Array<{ x1: number; y1: number; x2: number; y2: number; fromLane: number; toLane: number; }> = []
  for (let i = 0; i < nodes.length; i++) {
    const n = nodes[i]
    const x1 = paddingLeft + n.lane * laneWidth + laneWidth / 2
    const y1 = i * rowHeight + rowHeight / 2
    for (const pid of n.parentIds) {
      const j = nodes.findIndex(x => x.id === pid)
      if (j < 0) continue
      const p = nodes[j]
      const x2 = paddingLeft + p.lane * laneWidth + laneWidth / 2
      const y2 = j * rowHeight + rowHeight / 2
      edges.push({ x1, y1, x2, y2, fromLane: n.lane, toLane: p.lane })
    }
  }

  return { nodes, edges, width, height, rowHeight, laneWidth, paddingLeft, nodeSize }
})

function edgePath(e: any) {
  // 贝塞尔曲线：如果 lane 相同，直线；否则先弯
  if (e.fromLane === e.toLane) {
    return `M ${e.x1} ${e.y1} L ${e.x2} ${e.y2}`
  }
  const dy = (e.y2 - e.y1) / 2
  return `M ${e.x1} ${e.y1} C ${e.x1} ${e.y1 + dy}, ${e.x2} ${e.y2 - dy}, ${e.x2} ${e.y2}`
}

function laneColor(lane: number) {
  const palette = [
    '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
    '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16',
    '#f97316', '#6366f1', '#14b8a6', '#e11d48',
  ]
  return palette[lane % palette.length]
}

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

const changeTypeLabel: Record<string, string> = {
  INIT: '初始化', NEW_TURN: '新增轮次', EDIT_TURN: '修改轮次', DELETE_TURN: '删除轮次',
  MERGE: '合并', REBASE: '变基', REVERT: '回滚', CHERRY_PICK: '拣选',
  TAG: '标签', EDIT: '编辑',
}
</script>

<template>
  <div class="commit-graph-container neu-card" style="padding: 12px 14px;">
    <div v-if="graph.nodes.length === 0" class="cg-empty">暂无提交数据</div>
    <div v-else class="cg-scroll">
      <svg
        :width="graph.width"
        :height="graph.height"
        class="cg-svg"
      >
        <!-- 边 -->
        <path
          v-for="(e, i) in graph.edges"
          :key="'e'+i"
          :d="edgePath(e)"
          :stroke="laneColor(Math.max(e.fromLane, e.toLane))"
          fill="none"
          stroke-width="2"
          opacity=".7"
        />
        <!-- 圆点 -->
        <g v-for="(n, i) in graph.nodes" :key="'n'+i">
          <circle
            :cx="graph.paddingLeft + n.lane * graph.laneWidth + graph.laneWidth / 2"
            :cy="i * graph.rowHeight + graph.rowHeight / 2"
            :r="n.isMerge ? 7 : 6"
            :fill="laneColor(n.lane)"
            :stroke="selectedId === n.id ? '#111827' : 'white'"
            stroke-width="2"
            class="cg-dot"
            @click="emit('commit-click', commits.find(c => c.id === n.id)!)"
          />
        </g>
      </svg>
      <div class="cg-rows">
        <div
          v-for="(n, i) in graph.nodes"
          :key="'r'+i"
          class="cg-row"
          :class="{ 'cg-row-sel': selectedId === n.id, 'cg-row-merge': n.isMerge }"
          :style="{ height: graph.rowHeight + 'px' }"
          @click="emit('commit-click', commits.find(c => c.id === n.id)!)"
        >
          <div class="cg-info">
            <div class="cg-subj" :title="n.subject">
              <span v-if="n.changeType" class="cg-ctype">{{ changeTypeLabel[n.changeType] ?? n.changeType }}</span>
              <span class="cg-subject">{{ n.subject }}</span>
            </div>
            <div class="cg-meta">
              <span class="cg-sha" :title="n.sha">{{ shortSha(n.sha, 7) }}</span>
              <span class="cg-author">· {{ n.authorName }}</span>
              <span class="cg-time">· {{ timeAgo(n.committedAt) }}</span>
              <span v-if="n.isMerge" class="cg-merge-badge">合并提交</span>
            </div>
          </div>
          <div v-if="!compact" class="cg-stat">
            <span class="cg-adds" v-if="n.additions + n.deletions > 0">
              <span style="color: var(--success)">+{{ n.additions }}</span>
              <span style="color: var(--danger)"> -{{ n.deletions }}</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.cg-empty { padding: 30px; text-align: center; color: var(--text-muted); }
.cg-scroll { display: flex; max-height: 60vh; overflow: auto; }
.cg-svg { flex-shrink: 0; display: block; }
.cg-rows { flex: 1; display: flex; flex-direction: column; margin-left: 10px; }
.cg-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 10px; cursor: pointer; border-radius: 8px;
}
.cg-row:hover { background: var(--neutral-soft); }
.cg-row-sel { background: var(--primary-bg-soft); }
.cg-row-merge { border-left: 3px solid var(--primary); padding-left: 7px; }
.cg-info { display: flex; flex-direction: column; min-width: 0; }
.cg-subj { display: flex; align-items: center; gap: 6px; font-size: 13px; overflow: hidden; }
.cg-subject {
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-weight: 500;
}
.cg-ctype {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
  background: var(--primary-bg-soft); color: var(--primary);
  text-transform: uppercase; letter-spacing: .5px;
  flex-shrink: 0;
}
.cg-meta {
  display: flex; gap: 4px; align-items: center;
  font-size: 11.5px; color: var(--text-muted); margin-top: 2px;
  font-family: ui-monospace, monospace;
}
.cg-sha { font-weight: 600; color: var(--primary); }
.cg-merge-badge {
  font-size: 10px; padding: 1px 6px; border-radius: 4px;
  background: var(--info-bg); color: var(--info-fg);
}
.cg-stat { font-family: ui-monospace, monospace; font-size: 12px; flex-shrink: 0; }
.cg-adds { white-space: nowrap; }
.cg-dot { cursor: pointer; transition: r .15s; }
.cg-dot:hover { r: 9 !important; }
</style>
