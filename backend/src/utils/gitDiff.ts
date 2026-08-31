/**
 * 文本Diff算法实现
 *  - Myers O(ND) 最长公共子序列(LCS) + 最短编辑脚本(Script)
 *  - 行级Diff + 可选的词级/字符级精细化Diff
 *  - 生成 Unified Diff 格式
 *  - 三路合并（Three-way merge）
 *
 * 算法参考:
 *  Eugene W. Myers, "An O(ND) Difference Algorithm and Its Variations" (1986)
 */

// ══════════════════════════════════════════════════
// 基础类型
// ══════════════════════════════════════════════════

export type DiffOp = 'EQUAL' | 'INSERT' | 'DELETE' | 'REPLACE'

export interface DiffLine {
  op: DiffOp
  content: string
  // 旧文件中的行号（从1开始，DELETE/REPLACE/EQUAL有值）
  oldLineNo?: number
  // 新文件中的行号（从1开始，INSERT/REPLACE/EQUAL有值）
  newLineNo?: number
  // 词级精细化diff（可选）
  tokens?: DiffToken[]
}

export interface DiffToken {
  op: DiffOp
  text: string
}

export interface DiffHunk {
  oldStart: number
  oldCount: number
  newStart: number
  newCount: number
  sectionHeader?: string
  lines: DiffLine[]
}

export interface DiffFileResult {
  oldPath?: string
  newPath?: string
  oldSha?: string
  newSha?: string
  status: 'added' | 'deleted' | 'modified' | 'renamed' | 'copied' | 'unchanged'
  similarity?: number // 0-100（rename/copy时的相似度）
  binary?: boolean
  hunks: DiffHunk[]
  // 快速统计
  additions: number
  deletions: number
  oldLineCount: number
  newLineCount: number
}

// ══════════════════════════════════════════════════
// Myers Diff: 最短编辑脚本算法
// ══════════════════════════════════════════════════

interface ScriptStep {
  op: DiffOp
  // 从a中取的数量（DELETE/EQUAL/REPLACE）
  aCount: number
  // 从b中取的数量（INSERT/EQUAL/REPLACE）
  bCount: number
}

/**
 * Myers O(ND) 最短编辑距离 + 脚本生成
 * 返回将 a[] 变为 b[] 所需的步骤序列
 *
 * 注意: 为了大文件性能，超过 5000 行/边 时回退到 O(N*M) 的启发式贪心合并
 */
export function myersDiff<T>(
  a: T[],
  b: T[],
  eq: (x: T, y: T) => boolean = Object.is,
): ScriptStep[] {
  const n = a.length
  const m = b.length

  // 超大数组用启发式近似
  if (n + m > 10000) {
    return greedyDiff(a, b, eq)
  }

  const MAX = n + m
  const size = 2 * MAX + 1
  const v = new Int32Array(size) // k -> 最远的x坐标
  const trace: Int32Array[] = []
  const off = MAX // offset, 让 k ∈ [-MAX, MAX] 映射到 [0, 2*MAX]

  for (let d = 0; d <= MAX; d++) {
    const snap = new Int32Array(v)
    trace.push(snap)
    for (let k = -d; k <= d; k += 2) {
      let x: number
      if (k === -d || (k !== d && v[off + k - 1] < v[off + k + 1])) {
        x = v[off + k + 1]
      } else {
        x = v[off + k - 1] + 1
      }
      let y = x - k
      while (x < n && y < m && eq(a[x], b[y])) {
        x++
        y++
      }
      v[off + k] = x
      if (x >= n && y >= m) {
        return backtrackMyers(trace, a, b, eq)
      }
    }
  }
  // 理论上不会到这里（d=MAX一定能找到解）
  return greedyDiff(a, b, eq)
}

function backtrackMyers<T>(
  trace: Int32Array[],
  a: T[],
  b: T[],
  eq: (x: T, y: T) => boolean,
): ScriptStep[] {
  let x = a.length
  let y = b.length
  const steps: ScriptStep[] = []
  for (let d = trace.length - 1; d > 0; d--) {
    const v = trace[d]
    const off = a.length + b.length
    const k = x - y
    const prevK =
      k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? k + 1 : k - 1
    const prevX = v[off + prevK]
    const prevY = prevX - prevK

    // 沿着对角线走的等号
    const diag = Math.min(x - prevX, y - prevY)
    if (diag > 0) {
      steps.unshift({ op: 'EQUAL', aCount: diag, bCount: diag })
      x -= diag
      y -= diag
    }

    const stepDx = x - prevX - diag
    const stepDy = y - prevY - diag
    if (stepDx > 0 && stepDy > 0) {
      steps.unshift({ op: 'REPLACE', aCount: stepDx, bCount: stepDy })
    } else if (stepDx > 0) {
      steps.unshift({ op: 'DELETE', aCount: stepDx, bCount: 0 })
    } else if (stepDy > 0) {
      steps.unshift({ op: 'INSERT', aCount: 0, bCount: stepDy })
    }
    x = prevX
    y = prevY
  }
  // 收尾：d=0 步里的对角线相等
  if (x > 0) {
    steps.unshift({ op: 'EQUAL', aCount: x, bCount: y })
  }
  return steps
}

/**
 * 启发式贪心Diff：近似但很快
 * 匹配连续EQUAL片段，其余按 DELETE+INSERT 处理
 */
export function greedyDiff<T>(
  a: T[],
  b: T[],
  eq: (x: T, y: T) => boolean = Object.is,
): ScriptStep[] {
  const steps: ScriptStep[] = []
  let i = 0
  let j = 0
  while (i < a.length && j < b.length) {
    if (eq(a[i], b[j])) {
      // 收集连续相等
      let cnt = 0
      while (i + cnt < a.length && j + cnt < b.length && eq(a[i + cnt], b[j + cnt])) cnt++
      steps.push({ op: 'EQUAL', aCount: cnt, bCount: cnt })
      i += cnt
      j += cnt
      continue
    }
    // 找下一个等号
    let foundA = -1
    let foundB = -1
    let foundLen = 0
    // 搜索窗口（限制范围避免 O(N*M)）
    const WINDOW = 200
    for (let di = 0; di < WINDOW && i + di < a.length; di++) {
      for (let dj = 0; dj < WINDOW && j + dj < b.length; dj++) {
        if (eq(a[i + di], b[j + dj])) {
          let len = 1
          while (
            i + di + len < a.length &&
            j + dj + len < b.length &&
            eq(a[i + di + len], b[j + dj + len]) &&
            len < 8
          )
            len++
          if (len > foundLen) {
            foundA = di
            foundB = dj
            foundLen = len
          }
          if (foundLen >= 8) break
        }
      }
      if (foundLen >= 8) break
    }
    if (foundA > 0 || foundB > 0) {
      const del = foundA
      const ins = foundB
      if (del > 0 && ins > 0) steps.push({ op: 'REPLACE', aCount: del, bCount: ins })
      else if (del > 0) steps.push({ op: 'DELETE', aCount: del, bCount: 0 })
      else steps.push({ op: 'INSERT', aCount: 0, bCount: ins })
      i += del
      j += ins
    } else {
      // 后续没有匹配，全量删除+插入剩余
      const del = a.length - i
      const ins = b.length - j
      if (del > 0) steps.push({ op: 'DELETE', aCount: del, bCount: 0 })
      if (ins > 0) steps.push({ op: 'INSERT', aCount: 0, bCount: ins })
      i = a.length
      j = b.length
    }
  }
  if (i < a.length) steps.push({ op: 'DELETE', aCount: a.length - i, bCount: 0 })
  if (j < b.length) steps.push({ op: 'INSERT', aCount: 0, bCount: b.length - j })
  return steps
}

// ══════════════════════════════════════════════════
// 行级 Diff
// ══════════════════════════════════════════════════

function splitLines(s: string): string[] {
  if (s.length === 0) return []
  // 保留行尾换行，便于之后重建
  const parts = s.split(/(\r?\n)/)
  const out: string[] = []
  for (let i = 0; i < parts.length - 1; i += 2) {
    out.push(parts[i] + (parts[i + 1] ?? ''))
  }
  // 最后一段可能没有换行符
  if (parts.length % 2 === 1 && parts[parts.length - 1] !== '') {
    out.push(parts[parts.length - 1])
  }
  return out
}

/**
 * 对比两份文本，生成 DiffLine 列表（含行号）
 */
export function diffLines(
  oldText: string,
  newText: string,
  options: { refineTokens?: boolean } = {},
): DiffLine[] {
  const a = splitLines(oldText)
  const b = splitLines(newText)
  const steps = myersDiff(a, b)
  const result: DiffLine[] = []
  let oldLine = 1
  let newLine = 1
  let aIdx = 0
  let bIdx = 0
  for (const step of steps) {
    const aEnd = aIdx + step.aCount
    const bEnd = bIdx + step.bCount
    if (step.op === 'EQUAL') {
      for (let i = 0; i < step.aCount; i++) {
        result.push({ op: 'EQUAL', content: a[aIdx + i], oldLineNo: oldLine + i, newLineNo: newLine + i })
      }
      aIdx = aEnd
      bIdx = bEnd
      oldLine += step.aCount
      newLine += step.bCount
    } else if (step.op === 'DELETE') {
      for (let i = 0; i < step.aCount; i++) {
        result.push({ op: 'DELETE', content: a[aIdx + i], oldLineNo: oldLine + i })
      }
      aIdx = aEnd
      oldLine += step.aCount
    } else if (step.op === 'INSERT') {
      for (let j = 0; j < step.bCount; j++) {
        result.push({ op: 'INSERT', content: b[bIdx + j], newLineNo: newLine + j })
      }
      bIdx = bEnd
      newLine += step.bCount
    } else if (step.op === 'REPLACE') {
      // 逐对输出，删除再插入
      for (let i = 0; i < step.aCount; i++) {
        result.push({ op: 'DELETE', content: a[aIdx + i], oldLineNo: oldLine + i })
      }
      for (let j = 0; j < step.bCount; j++) {
        result.push({ op: 'INSERT', content: b[bIdx + j], newLineNo: newLine + j })
      }
      if (options.refineTokens && step.aCount > 0 && step.bCount > 0) {
        // 最后把 DELETE+INSERT 组合做一次词级细化
        const deleted = a.slice(aIdx, aEnd).join('')
        const inserted = b.slice(bIdx, bEnd).join('')
        const tokens = refineDiff(deleted, inserted)
        // 将tokens分配给最后一批条目的tokens字段（给UI做内联高亮）
        const lastInserts: DiffLine[] = []
        for (let ri = result.length - step.bCount; ri < result.length; ri++) {
          lastInserts.push(result[ri])
        }
        // 简化：只把第一个INSERT行加上整体tokens
        if (lastInserts.length > 0) {
          lastInserts[0].tokens = tokens
        }
      }
      aIdx = aEnd
      bIdx = bEnd
      oldLine += step.aCount
      newLine += step.bCount
    }
  }
  return result
}

// ══════════════════════════════════════════════════
// 字符/词级精细化Diff（用于内联高亮）
// ══════════════════════════════════════════════════

function splitTokens(s: string): string[] {
  // 以词/标点/空白边界切分
  return s.split(/(\s+|[{}()\[\]<>.,;:!?'"`~@#$%^&*\-_=+|\\/])/).filter(Boolean)
}

export function refineDiff(oldStr: string, newStr: string): DiffToken[] {
  const a = splitTokens(oldStr)
  const b = splitTokens(newStr)
  const steps = myersDiff(a, b)
  const tokens: DiffToken[] = []
  let ai = 0
  let bi = 0
  for (const step of steps) {
    if (step.op === 'EQUAL') {
      for (let i = 0; i < step.aCount; i++) tokens.push({ op: 'EQUAL', text: a[ai + i] })
      ai += step.aCount
      bi += step.bCount
    } else if (step.op === 'DELETE') {
      for (let i = 0; i < step.aCount; i++) tokens.push({ op: 'DELETE', text: a[ai + i] })
      ai += step.aCount
    } else if (step.op === 'INSERT') {
      for (let j = 0; j < step.bCount; j++) tokens.push({ op: 'INSERT', text: b[bi + j] })
      bi += step.bCount
    } else {
      for (let i = 0; i < step.aCount; i++) tokens.push({ op: 'DELETE', text: a[ai + i] })
      ai += step.aCount
      for (let j = 0; j < step.bCount; j++) tokens.push({ op: 'INSERT', text: b[bi + j] })
      bi += step.bCount
    }
  }
  return tokens
}

// ══════════════════════════════════════════════════
// Hunk切分 + Unified Diff 格式
// ══════════════════════════════════════════════════

const CONTEXT_LINES = 3

/**
 * 把 DiffLine[] 切分成 Hunk（上下文块）
 */
export function buildHunks(lines: DiffLine[], context = CONTEXT_LINES): DiffHunk[] {
  const hunks: DiffHunk[] = []
  let i = 0
  while (i < lines.length) {
    // 跳过开头连续 EQUAL，直到遇到非EQUAL
    while (i < lines.length && lines[i].op === 'EQUAL') i++
    if (i >= lines.length) break

    // 起点：向前回溯CONTEXT行
    const start = Math.max(0, i - context)
    // 收集直到连续EQUAL > 2*CONTEXT为止
    let j = i
    let runEqual = 0
    while (j < lines.length) {
      if (lines[j].op === 'EQUAL') {
        runEqual++
        if (runEqual > 2 * context) {
          j -= runEqual - context // 保留后context
          break
        }
      } else {
        runEqual = 0
      }
      j++
    }

    const slice = lines.slice(start, j)
    // 计算统计
    let oldS = 0
    let oldC = 0
    let newS = 0
    let newC = 0
    for (const l of slice) {
      if (l.oldLineNo != null) {
        if (oldS === 0) oldS = l.oldLineNo
        oldC = l.oldLineNo - oldS + 1
      }
      if (l.newLineNo != null) {
        if (newS === 0) newS = l.newLineNo
        newC = l.newLineNo - newS + 1
      }
    }
    hunks.push({
      oldStart: oldS,
      oldCount: oldC,
      newStart: newS,
      newCount: newC,
      lines: slice,
    })
    i = j
  }
  return hunks
}

/**
 * 生成完整的单文件Diff结果
 */
export function computeFileDiff(
  oldPath: string | undefined,
  newPath: string | undefined,
  oldText: string | undefined | null,
  newText: string | undefined | null,
  options: { oldSha?: string; newSha?: string; refineTokens?: boolean } = {},
): DiffFileResult {
  const oldExists = oldText != null
  const newExists = newText != null
  const oldT = oldText ?? ''
  const newT = newText ?? ''

  let status: DiffFileResult['status']
  if (oldExists && !newExists) status = 'deleted'
  else if (!oldExists && newExists) status = 'added'
  else if (oldT === newT) status = 'unchanged'
  else status = 'modified'

  const lines = diffLines(oldT, newT, { refineTokens: options.refineTokens })
  const hunks = buildHunks(lines)

  let adds = 0
  let dels = 0
  for (const l of lines) {
    if (l.op === 'INSERT') adds++
    else if (l.op === 'DELETE') dels++
  }

  return {
    oldPath,
    newPath,
    oldSha: options.oldSha,
    newSha: options.newSha,
    status,
    hunks,
    additions: adds,
    deletions: dels,
    oldLineCount: oldT === '' ? 0 : oldT.split(/\r?\n/).length,
    newLineCount: newT === '' ? 0 : newT.split(/\r?\n/).length,
  }
}

/**
 * 渲染 Unified Diff 格式文本字符串
 */
export function toUnifiedDiff(file: DiffFileResult): string {
  if (file.binary) {
    return `Binary files ${file.oldPath ?? '/dev/null'} and ${file.newPath ?? '/dev/null'} differ\n`
  }
  if (file.status === 'unchanged' && file.hunks.length === 0) return ''

  const header: string[] = []
  const a = file.oldPath ? `a/${file.oldPath}` : '/dev/null'
  const b = file.newPath ? `b/${file.newPath}` : '/dev/null'
  header.push(`diff --git ${a} ${b}`)
  if (file.status === 'renamed') {
    header.push(`rename from ${file.oldPath}`)
    header.push(`rename to ${file.newPath}`)
    header.push(`similarity index ${file.similarity ?? 0}%`)
  } else if (file.status === 'copied') {
    header.push(`copy from ${file.oldPath}`)
    header.push(`copy to ${file.newPath}`)
  }
  if (file.oldSha && file.newSha) {
    header.push(`index ${file.oldSha.slice(0, 7)}..${file.newSha.slice(0, 7)}`)
  }
  header.push(`--- ${a}`)
  header.push(`+++ ${b}`)

  const body = file.hunks.map((h) => {
    const head = `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@${h.sectionHeader ? ' ' + h.sectionHeader : ''}`
    const ln = h.lines
      .map((l) => {
        if (l.op === 'EQUAL') return ' ' + stripTrailingNewline(l.content)
        if (l.op === 'INSERT') return '+' + stripTrailingNewline(l.content)
        if (l.op === 'DELETE') return '-' + stripTrailingNewline(l.content)
        return ' ' + stripTrailingNewline(l.content)
      })
      .join('\n')
    return head + '\n' + ln
  })

  return [...header, ...body].join('\n') + '\n'
}

function stripTrailingNewline(s: string): string {
  if (s.endsWith('\r\n')) return s.slice(0, -2)
  if (s.endsWith('\n')) return s.slice(0, -1)
  return s
}

// ══════════════════════════════════════════════════
// 三路合并（Three-Way Merge）
//   ancestor = 共同祖先
//   ours = 我们分支（当前分支）
//   theirs = 他们分支（被合并的）
// ══════════════════════════════════════════════════

export type MergeLine =
  | { kind: 'context'; content: string }
  | { kind: 'ours'; content: string }
  | { kind: 'theirs'; content: string }
  | { kind: 'conflict'; ours: string[]; theirs: string[]; ancestor?: string[] }

export interface MergeResult {
  lines: MergeLine[]
  hasConflicts: boolean
  conflictCount: number
  // 合并后的文本（有冲突则含冲突标记 <<<<<<< ======= >>>>>>>）
  merged: string
  oursLabel?: string
  theirsLabel?: string
  ancestorLabel?: string
}

export function threeWayMerge(
  ancestor: string,
  ours: string,
  theirs: string,
  options: { oursLabel?: string; theirsLabel?: string; ancestorLabel?: string; conflictStyle?: 'merge' | 'diff3' } = {},
): MergeResult {
  const { oursLabel = 'HEAD', theirsLabel = 'MERGE_HEAD', ancestorLabel = 'ancestor', conflictStyle = 'merge' } = options
  const A = splitLines(ancestor)
  const O = splitLines(ours)
  const T = splitLines(theirs)

  // 分别做两份Diff: A->O, A->T
  const aoDiff = diffLineRanges(A, O) // 返回 (startA, endA) -> 对应的 O 范围
  const atDiff = diffLineRanges(A, T)

  // 扫描 A 的每个位置，看被谁改了
  // 为了O(N)扫描，用标记: 在A[i]上打 O 改了没 / T 改了没
  const N = A.length
  const aModByO: Array<{ kind: 'EQUAL' | 'CHANGED'; oStart: number; oEnd: number } | null> = new Array(N).fill(null)
  for (const d of aoDiff) {
    if (d.kind === 'EQUAL') {
      for (let i = 0; i < d.aCount; i++) {
        aModByO[d.aStart + i] = { kind: 'EQUAL', oStart: d.oStart + i, oEnd: d.oStart + i + 1 }
      }
    } else {
      // 标记 aStart..aEnd 这个区间被O改变
      const span = d.aCount === 0 ? 1 : d.aCount
      for (let i = 0; i < span; i++) {
        const idx = Math.min(d.aStart + i, N - 1)
        if (idx >= 0) aModByO[idx] = { kind: 'CHANGED', oStart: d.oStart, oEnd: d.oEnd }
      }
    }
  }

  const aModByT: Array<{ kind: 'EQUAL' | 'CHANGED'; tStart: number; tEnd: number } | null> = new Array(N).fill(null)
  for (const d of atDiff) {
    if (d.kind === 'EQUAL') {
      for (let i = 0; i < d.aCount; i++) {
        aModByT[d.aStart + i] = { kind: 'EQUAL', tStart: d.tStart + i, tEnd: d.tStart + i + 1 }
      }
    } else {
      const span = d.aCount === 0 ? 1 : d.aCount
      for (let i = 0; i < span; i++) {
        const idx = Math.min(d.aStart + i, N - 1)
        if (idx >= 0) aModByT[idx] = { kind: 'CHANGED', tStart: d.tStart, tEnd: d.tEnd }
      }
    }
  }

  // 走一遍，组合输出
  const result: MergeLine[] = []
  let conflictCount = 0
  let hasConflicts = false

  // A前后插入的（Insert from A' perspective）需要额外处理
  // 简化实现：按 aoDiff 和 atDiff 依次走
  // 这里采用更可靠的办法：按照A的位置 + O/T的insertions
  // 实际工业级实现会构建事件队列，但为了代码可控性，我们采用"按修改块扫描"

  // 先把 A->O 和 A->T 的 change ranges 转成事件（按A坐标排序）
  type Event = { pos: number; side: 'O' | 'T'; kind: 'MOD' | 'INS'; data: any }
  const events: Event[] = []
  for (const d of aoDiff) {
    if (d.kind !== 'EQUAL') {
      events.push({ pos: d.aStart, side: 'O', kind: d.aCount === 0 ? 'INS' : 'MOD', data: d })
    }
  }
  for (const d of atDiff) {
    if (d.kind !== 'EQUAL') {
      events.push({ pos: d.aStart, side: 'T', kind: d.aCount === 0 ? 'INS' : 'MOD', data: d })
    }
  }
  events.sort((a, b) => a.pos - b.pos || (a.kind === 'MOD' ? -1 : 1))

  // 逐个位置扫描A
  let ai = 0
  // 已经处理过的O/T段缓存（去重）
  const processedO = new Set<number>()
  const processedT = new Set<number>()

  while (ai < N) {
    // 找在此之前未处理的事件
    const nextEvents = events.filter((e) => e.pos <= ai && !isEventProcessed(e, processedO, processedT))
    const eventsHere = nextEvents.filter((e) => e.pos === ai)
    const modEvents = eventsHere.filter((e) => e.kind === 'MOD')

    if (modEvents.length === 2) {
      // O和T都在 ai 位置改了 → 可能冲突
      const oEv = modEvents.find((e) => e.side === 'O')!
      const tEv = modEvents.find((e) => e.side === 'T')!
      const oData = oEv.data
      const tData = tEv.data
      // 取最大范围
      const aLen = Math.max(oData.aCount, tData.aCount)
      const oSlice = O.slice(oData.oStart, oData.oEnd)
      const tSlice = T.slice(tData.tStart, tData.tEnd)
      const aSlice = A.slice(ai, ai + aLen)
      // 如果内容相同不算冲突
      if (linesEqual(oSlice, tSlice)) {
        for (const l of oSlice) result.push({ kind: 'context', content: l })
      } else {
        hasConflicts = true
        conflictCount++
        result.push({ kind: 'conflict', ours: oSlice, theirs: tSlice, ancestor: aSlice })
      }
      processedO.add(oData.aStart * 10000 + oData.oEnd)
      processedT.add(tData.aStart * 10000 + tData.tEnd)
      ai += Math.max(1, aLen)
      continue
    } else if (modEvents.length === 1) {
      const ev = modEvents[0]
      if (ev.side === 'O') {
        const d = ev.data
        const oSlice = O.slice(d.oStart, d.oEnd)
        for (const l of oSlice) result.push({ kind: 'ours', content: l })
        processedO.add(d.aStart * 10000 + d.oEnd)
        ai += Math.max(1, d.aCount)
        continue
      } else {
        const d = ev.data
        const tSlice = T.slice(d.tStart, d.tEnd)
        for (const l of tSlice) result.push({ kind: 'theirs', content: l })
        processedT.add(d.aStart * 10000 + d.tEnd)
        ai += Math.max(1, d.aCount)
        continue
      }
    }

    // INS events（A位置的插入，不消耗A坐标）
    const insEvents = eventsHere.filter((e) => e.kind === 'INS')
    if (insEvents.length > 0) {
      const oIns = insEvents.find((e) => e.side === 'O')
      const tIns = insEvents.find((e) => e.side === 'T')
      if (oIns && tIns) {
        const oSlice = O.slice(oIns.data.oStart, oIns.data.oEnd)
        const tSlice = T.slice(tIns.data.tStart, tIns.data.tEnd)
        if (linesEqual(oSlice, tSlice)) {
          for (const l of oSlice) result.push({ kind: 'context', content: l })
        } else {
          hasConflicts = true
          conflictCount++
          result.push({ kind: 'conflict', ours: oSlice, theirs: tSlice })
        }
        processedO.add(oIns.data.aStart * 10000 + oIns.data.oEnd)
        processedT.add(tIns.data.aStart * 10000 + tIns.data.tEnd)
      } else if (oIns) {
        const oSlice = O.slice(oIns.data.oStart, oIns.data.oEnd)
        for (const l of oSlice) result.push({ kind: 'ours', content: l })
        processedO.add(oIns.data.aStart * 10000 + oIns.data.oEnd)
      } else if (tIns) {
        const tSlice = T.slice(tIns.data.tStart, tIns.data.tEnd)
        for (const l of tSlice) result.push({ kind: 'theirs', content: l })
        processedT.add(tIns.data.aStart * 10000 + tIns.data.tEnd)
      }
      // continue 同一位置可能还有MOD处理，不消耗ai
      // 但为防止死循环，如果事件都处理完了就前进
      if (eventsHere.length === insEvents.length) {
        result.push({ kind: 'context', content: A[ai] })
        ai++
      }
      continue
    }

    // 无事件 → 普通上下文
    result.push({ kind: 'context', content: A[ai] })
    ai++
  }

  // 处理 A 末尾之后的插入（例如在文件尾加内容）
  const tailInsO = aoDiff.filter((d) => d.aCount === 0 && d.aStart === A.length)
  const tailInsT = atDiff.filter((d) => d.aCount === 0 && d.aStart === A.length)
  if (tailInsO.length > 0 || tailInsT.length > 0) {
    const oSlice = tailInsO.flatMap((d) => O.slice(d.oStart, d.oEnd))
    const tSlice = tailInsT.flatMap((d) => T.slice(d.tStart, d.tEnd))
    if (oSlice.length && tSlice.length) {
      if (linesEqual(oSlice, tSlice)) {
        for (const l of oSlice) result.push({ kind: 'context', content: l })
      } else {
        hasConflicts = true
        conflictCount++
        result.push({ kind: 'conflict', ours: oSlice, theirs: tSlice })
      }
    } else if (oSlice.length) {
      for (const l of oSlice) result.push({ kind: 'ours', content: l })
    } else if (tSlice.length) {
      for (const l of tSlice) result.push({ kind: 'theirs', content: l })
    }
  }

  // 渲染 merged 文本
  const merged: string[] = []
  for (const ln of result) {
    if (ln.kind === 'context' || ln.kind === 'ours' || ln.kind === 'theirs') {
      merged.push(ln.content)
    } else {
      merged.push(`<<<<<<< ${oursLabel}\n`)
      for (const l of ln.ours) merged.push(l)
      if (conflictStyle === 'diff3' && ln.ancestor) {
        merged.push(`||||||| ${ancestorLabel}\n`)
        for (const l of ln.ancestor) merged.push(l)
      }
      merged.push('=======\n')
      for (const l of ln.theirs) merged.push(l)
      merged.push(`>>>>>>> ${theirsLabel}\n`)
    }
  }

  return {
    lines: result,
    hasConflicts,
    conflictCount,
    merged: merged.join(''),
    oursLabel,
    theirsLabel,
    ancestorLabel,
  }
}

function isEventProcessed(e: Event, processedO: Set<number>, processedT: Set<number>): boolean {
  const key = e.data.aStart * 10000 + (e.side === 'O' ? e.data.oEnd : e.data.tEnd)
  return e.side === 'O' ? processedO.has(key) : processedT.has(key)
}

function linesEqual(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

// 辅助：把 Myers 脚本转换成 A坐标 -> range 映射
type RangeMap =
  | { kind: 'EQUAL'; aStart: number; aCount: number; oStart: number; oEnd: number }
  | { kind: 'CHANGED'; aStart: number; aCount: number; oStart: number; oEnd: number }

function diffLineRanges(A: string[], B: string[]): RangeMap[] {
  const steps = myersDiff(A, B)
  const out: RangeMap[] = []
  let ai = 0
  let bi = 0
  for (const step of steps) {
    if (step.op === 'EQUAL') {
      out.push({ kind: 'EQUAL', aStart: ai, aCount: step.aCount, oStart: bi, oEnd: bi + step.bCount })
    } else {
      out.push({
        kind: 'CHANGED',
        aStart: ai,
        aCount: step.aCount,
        oStart: bi,
        oEnd: bi + step.bCount,
      })
    }
    ai += step.aCount
    bi += step.bCount
  }
  return out
}

// ══════════════════════════════════════════════════
// 辅助：简单Patch应用（应用Unified Diff -> 新文本）
// ══════════════════════════════════════════════════

export function applyPatch(oldText: string, diff: DiffFileResult): string {
  if (diff.status === 'added') return reconstruct(diff)
  if (diff.status === 'deleted') return ''
  if (diff.status === 'unchanged') return oldText
  // 逐行应用
  const lines: string[] = []
  for (const hunk of diff.hunks) {
    for (const l of hunk.lines) {
      if (l.op === 'EQUAL' || l.op === 'INSERT') lines.push(l.content)
    }
  }
  return lines.join('')
}

function reconstruct(diff: DiffFileResult): string {
  const out: string[] = []
  for (const h of diff.hunks) {
    for (const l of h.lines) {
      if (l.op !== 'DELETE') out.push(l.content)
    }
  }
  return out.join('')
}
