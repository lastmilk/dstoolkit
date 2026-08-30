<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { TreeOptionData, TreeNodeModel, TreeNodeValue } from 'tdesign-vue-next'
import dayjs from 'dayjs'
import type { ParsedConversation, ParsedMessage, Turn, Version, SubTurn } from '@/types'

interface SelectPayload {
  conv: ParsedConversation
  turnIndex: number | null
  versionIndex: number | null
  subTurnIndex: number | null
}

const props = defineProps<{
  conversations: ParsedConversation[]
  searchHits: Set<string>
  autoExpandPaths: string[]
}>()

const emit = defineEmits<{
  'select-subturn': [payload: SelectPayload]
}>()

interface NodeMeta {
  conv?: ParsedConversation
  turnIndex?: number
  versionIndex?: number
  subTurnIndex?: number
  nodeIds: string[]
}

const nodeMeta = new Map<string, NodeMeta>()

const internalExpanded = ref<TreeNodeValue[]>([])

watch(
  () => props.autoExpandPaths,
  (paths) => {
    if (paths.length > 0) internalExpanded.value = paths
  },
)

function snippet(s: string, len = 40): string {
  const t = s.trim().replace(/\s+/g, ' ')
  return t.length > len ? t.slice(0, len) + '…' : t
}

// ===== Derive turns from messages (spec: group by turnIndex, skip null) =====
function deriveTurns(conv: ParsedConversation): Turn[] {
  if (conv.turns && conv.turns.length > 0) return conv.turns
  const hasTurnIndex = conv.messages.some((m) => m.turnIndex != null)
  if (hasTurnIndex) return deriveFromIndices(conv.messages)
  return deriveFromOrder(conv.messages)
}

function deriveFromIndices(msgs: ParsedMessage[]): Turn[] {
  const byTurn = new Map<number, ParsedMessage[]>()
  for (const m of msgs) {
    if (m.turnIndex == null) continue
    const arr = byTurn.get(m.turnIndex) ?? []
    arr.push(m)
    byTurn.set(m.turnIndex, arr)
  }
  const turns: Turn[] = []
  for (const [turnIndex, tMsgs] of byTurn) {
    const turnUser = tMsgs.find(
      (m) => m.role === 'USER' && m.versionIndex == null && m.subTurnIndex == null,
    )
    const turn: Turn = { turnIndex, userNodeId: turnUser?.nodeId ?? '', versions: [] }
    const byVersion = new Map<number, ParsedMessage[]>()
    for (const m of tMsgs) {
      if (m.versionIndex == null) continue
      const arr = byVersion.get(m.versionIndex) ?? []
      arr.push(m)
      byVersion.set(m.versionIndex, arr)
    }
    for (const [versionIndex, vMsgs] of byVersion) {
      const verAssistant = vMsgs.find((m) => m.role === 'ASSISTANT' && m.subTurnIndex == null)
      const version: Version = {
        versionIndex,
        assistantNodeId: verAssistant?.nodeId ?? '',
        subTurns: [],
      }
      const bySub = new Map<number, ParsedMessage[]>()
      for (const m of vMsgs) {
        if (m.subTurnIndex == null) continue
        const arr = bySub.get(m.subTurnIndex) ?? []
        arr.push(m)
        bySub.set(m.subTurnIndex, arr)
      }
      for (const [subTurnIndex, sMsgs] of bySub) {
        const subUser = sMsgs.find((m) => m.role === 'USER')
        const subAssistant = sMsgs.find((m) => m.role === 'ASSISTANT')
        version.subTurns.push({
          subTurnIndex,
          userNodeId: subUser?.nodeId ?? '',
          assistantNodeId: subAssistant?.nodeId ?? null,
        })
      }
      version.subTurns.sort((a, b) => a.subTurnIndex - b.subTurnIndex)
      turn.versions.push(version)
    }
    turn.versions.sort((a, b) => a.versionIndex - b.versionIndex)
    turns.push(turn)
  }
  turns.sort((a, b) => a.turnIndex - b.turnIndex)
  return turns
}

// Fallback: build linear turns from message order when no turnIndex data exists.
function deriveFromOrder(msgs: ParsedMessage[]): Turn[] {
  const turns: Turn[] = []
  let currentTurn: Turn | null = null
  let verIdx = 0
  for (const m of msgs) {
    if (m.role === 'USER') {
      if (currentTurn && currentTurn.versions.length > 0) {
        verIdx = 0
        currentTurn = { turnIndex: turns.length + 1, userNodeId: m.nodeId, versions: [] }
        turns.push(currentTurn)
      } else if (!currentTurn) {
        currentTurn = { turnIndex: 1, userNodeId: m.nodeId, versions: [] }
        turns.push(currentTurn)
      }
    } else if (m.role === 'ASSISTANT' && currentTurn) {
      verIdx++
      currentTurn.versions.push({ versionIndex: verIdx, assistantNodeId: m.nodeId, subTurns: [] })
    }
  }
  return turns
}

function collectVersionNodeIds(v: Version): string[] {
  const ids = [v.assistantNodeId]
  for (const s of v.subTurns) {
    ids.push(s.userNodeId)
    if (s.assistantNodeId) ids.push(s.assistantNodeId)
  }
  return ids
}

function buildTree(convs: ParsedConversation[]): TreeOptionData[] {
  nodeMeta.clear()
  const byDate = new Map<string, ParsedConversation[]>()
  for (const c of convs) {
    const date = dayjs(c.insertedAt).format('YYYY-MM-DD')
    const arr = byDate.get(date) ?? []
    arr.push(c)
    byDate.set(date, arr)
  }
  const dates = Array.from(byDate.keys()).sort((a, b) => b.localeCompare(a))
  return dates.map((date) => {
    const dateConvs = byDate.get(date) ?? []
    const key = `d|${date}`
    nodeMeta.set(key, { nodeIds: [] })
    return {
      key,
      label: `${date}（${dateConvs.length} 个对话）`,
      children: dateConvs.map((c) => buildConvNode(c)),
    }
  })
}

function buildConvNode(c: ParsedConversation): TreeOptionData {
  const turns = deriveTurns(c)
  const key = `c|${c.deepseekConvId}`
  const ids = turns.flatMap((t) => [
    t.userNodeId,
    ...t.versions.flatMap((v) => collectVersionNodeIds(v)),
  ])
  nodeMeta.set(key, { conv: c, nodeIds: ids })
  // lite 模式下 turns 为空但 turnCount 有值时，显示 DB 中的轮次数
  const turnDisplay = turns.length > 0 ? turns.length : (c.turnCount ?? 0)
  return {
    key,
    label: `${c.title}（${turnDisplay} 轮）`,
    children: turns.map((t) => buildTurnNode(c, t)),
    isLeaf: turns.length === 0 && (c.turnCount ?? 0) === 0,
  }
}

function buildTurnNode(c: ParsedConversation, t: Turn): TreeOptionData {
  const key = `t|${c.deepseekConvId}|${t.turnIndex}`
  const userMsg = c.messages.find((m) => m.nodeId === t.userNodeId)
  const snip = userMsg ? snippet(userMsg.content) : ''
  const ids = [t.userNodeId, ...t.versions.flatMap((v) => collectVersionNodeIds(v))]
  nodeMeta.set(key, { conv: c, turnIndex: t.turnIndex, nodeIds: ids })
  return {
    key,
    label: `第 ${t.turnIndex} 轮${snip ? ' · ' + snip : ''}`,
    children: t.versions.map((v) => buildVersionNode(c, t, v)),
    isLeaf: t.versions.length === 0,
  }
}

function buildVersionNode(c: ParsedConversation, t: Turn, v: Version): TreeOptionData {
  const key = `v|${c.deepseekConvId}|${t.turnIndex}|${v.versionIndex}`
  const asstMsg = c.messages.find((m) => m.nodeId === v.assistantNodeId)
  const model = asstMsg?.model ? ` · ${asstMsg.model}` : ''
  const snip = asstMsg ? snippet(asstMsg.content) : ''
  const ids = collectVersionNodeIds(v)
  nodeMeta.set(key, { conv: c, turnIndex: t.turnIndex, versionIndex: v.versionIndex, nodeIds: ids })
  return {
    key,
    label: `版本 ${v.versionIndex}${model}${snip ? ' · ' + snip : ''}`,
    children: v.subTurns.map((s) => buildSubTurnNode(c, t, v, s)),
    isLeaf: v.subTurns.length === 0,
  }
}

function buildSubTurnNode(
  c: ParsedConversation,
  t: Turn,
  v: Version,
  s: SubTurn,
): TreeOptionData {
  const key = `s|${c.deepseekConvId}|${t.turnIndex}|${v.versionIndex}|${s.subTurnIndex}`
  const userMsg = c.messages.find((m) => m.nodeId === s.userNodeId)
  const snip = userMsg ? snippet(userMsg.content) : ''
  const ids = [s.userNodeId, s.assistantNodeId].filter(Boolean) as string[]
  nodeMeta.set(key, {
    conv: c,
    turnIndex: t.turnIndex,
    versionIndex: v.versionIndex,
    subTurnIndex: s.subTurnIndex,
    nodeIds: ids,
  })
  return {
    key,
    label: `子轮 ${s.subTurnIndex}${snip ? ' · ' + snip : ''}`,
    isLeaf: true,
  }
}

const treeData = computed<TreeOptionData[]>(() => buildTree(props.conversations))

// 时间线模式下自动展开所有日期节点，让用户直接看到对话列表；搜索模式用 autoExpandPaths
watch(
  treeData,
  (data) => {
    if (props.autoExpandPaths.length > 0) {
      internalExpanded.value = props.autoExpandPaths
    } else {
      internalExpanded.value = data.map((d) => String(d.key))
    }
  },
  { immediate: true },
)

function isHit(key: string): boolean {
  const meta = nodeMeta.get(key)
  if (!meta) return false
  return meta.nodeIds.some((id) => props.searchHits.has(id))
}

// 直接通过 click 事件处理点击，确保所有层级（包括叶子节点的子轮）都能触发
function handleNodeClick(context: { node: TreeNodeModel }) {
  const key = String(context.node.value)
  const meta = nodeMeta.get(key)
  if (!meta || !meta.conv) return
  emit('select-subturn', {
    conv: meta.conv,
    turnIndex: meta.turnIndex ?? null,
    versionIndex: meta.versionIndex ?? null,
    subTurnIndex: meta.subTurnIndex ?? null,
  })
}
</script>

<template>
  <div class="turn-tree neu-card" style="max-height: 72vh; overflow: auto;">
    <t-empty
      v-if="conversations.length === 0"
      description="暂无会话数据，请先在配置页上传"
      style="padding: 40px 0;"
    />
    <t-tree
      v-else
      :data="treeData"
      :keys="{ value: 'key', label: 'label', children: 'children' }"
      :expanded="internalExpanded"
      activable
      hover
      @click="handleNodeClick"
      @expand="internalExpanded = $event"
    >
      <template #label="{ node }">
        <span v-if="isHit(String(node.value))" class="search-hit">{{ node.label }}</span>
        <template v-else>{{ node.label }}</template>
      </template>
    </t-tree>
  </div>
</template>
