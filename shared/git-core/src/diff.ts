/**
 * 浏览器兼容 Myers Diff 算法实现（无Node依赖）
 *
 * 与后端 gitDiff.ts 保持一致的 API：
 *  - diffLines / buildHunks / computeFileDiff / toUnifiedDiff
 *  - refineDiff (词级细化)
 *  - threeWayMerge
 *
 * 大文件 (>10k 行) 会自动回退到 O(N) 贪心近似
 */

import type { DiffOp, DiffLine, DiffHunk, DiffToken, DiffFileResult, MergeLine, MergeResult } from './types.js'

// Myers O(ND)
function myersSteps<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean = Object.is) {
  const n = a.length
  const m = b.length
  if (n + m > 10000) return greedySteps(a, b, eq)
  const MAX = n + m
  const size = 2 * MAX + 1
  const v = new Int32Array(size)
  const off = MAX
  const trace: Int32Array[] = []
  for (let d = 0; d <= MAX; d++) {
    trace.push(new Int32Array(v))
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
        return backtrack(trace, a, b, eq)
      }
    }
  }
  return greedySteps(a, b, eq)
}

type Step = { op: DiffOp; aCount: number; bCount: number }

function backtrack<T>(trace: Int32Array[], a: T[], b: T[], eq: (x: T, y: T) => boolean): Step[] {
  let x = a.length
  let y = b.length
  const steps: Step[] = []
  for (let d = trace.length - 1; d > 0; d--) {
    const v = trace[d]
    const off = a.length + b.length
    const k = x - y
    const prevK = k === -d || (k !== d && v[off + k - 1] < v[off + k + 1]) ? k + 1 : k - 1
    const prevX = v[off + prevK]
    const prevY = prevX - prevK
    const diag = Math.min(x - prevX, y - prevY)
    if (diag > 0) steps.unshift({ op: 'EQUAL', aCount: diag, bCount: diag })
    const dx = x - prevX - diag
    const dy = y - prevY - diag
    if (dx > 0 && dy > 0) steps.unshift({ op: 'REPLACE', aCount: dx, bCount: dy })
    else if (dx > 0) steps.unshift({ op: 'DELETE', aCount: dx, bCount: 0 })
    else if (dy > 0) steps.unshift({ op: 'INSERT', aCount: 0, bCount: dy })
    x = prevX; y = prevY
  }
  if (x > 0) steps.unshift({ op: 'EQUAL', aCount: x, bCount: y })
  return steps
}

function greedySteps<T>(a: T[], b: T[], eq: (x: T, y: T) => boolean): Step[] {
  const steps: Step[] = []
  let i = 0, j = 0
  while (i < a.length && j < b.length) {
    if (eq(a[i], b[j])) {
      let cnt = 0
      while (i + cnt < a.length && j + cnt < b.length && eq(a[i + cnt], b[j + cnt])) cnt++
      steps.push({ op: 'EQUAL', aCount: cnt, bCount: cnt })
      i += cnt; j += cnt
      continue
    }
    let foundA = -1, foundB = -1, foundLen = 0
    const W = 200
    for (let di = 0; di < W && i + di < a.length; di++) {
      for (let dj = 0; dj < W && j + dj < b.length; dj++) {
        if (eq(a[i + di], b[j + dj])) {
          let len = 1
          while (
            i + di + len < a.length && j + dj + len < b.length &&
            eq(a[i + di + len], b[j + dj + len]) && len < 8
          ) len++
          if (len > foundLen) {
            foundA = di; foundB = dj; foundLen = len
          }
          if (foundLen >= 8) break
        }
      }
      if (foundLen >= 8) break
    }
    if (foundA > 0 || foundB > 0) {
      const del = foundA, ins = foundB
      if (del > 0 && ins > 0) steps.push({ op: 'REPLACE', aCount: del, bCount: ins })
      else if (del > 0) steps.push({ op: 'DELETE', aCount: del, bCount: 0 })
      else steps.push({ op: 'INSERT', aCount: 0, bCount: ins })
      i += del; j += ins
    } else {
      const del = a.length - i
      const ins = b.length - j
      if (del > 0) steps.push({ op: 'DELETE', aCount: del, bCount: 0 })
      if (ins > 0) steps.push({ op: 'INSERT', aCount: 0, bCount: ins })
      i = a.length; j = b.length
    }
  }
  if (i < a.length) steps.push({ op: 'DELETE', aCount: a.length - i, bCount: 0 })
  if (j < b.length) steps.push({ op: 'INSERT', aCount: 0, bCount: b.length - j })
  return steps
}

function splitLines(s: string): string[] {
  if (s.length === 0) return []
  const parts = s.split(/(\r?\n)/)
  const out: string[] = []
  for (let i = 0; i < parts.length - 1; i += 2) out.push(parts[i] + (parts[i + 1] ?? ''))
  const last = parts[parts.length - 1]
  if (last !== '') out.push(last)
  return out
}

export function diffLines(oldText: string, newText: string, opts: { refineTokens?: boolean } = {}): DiffLine[] {
  const a = splitLines(oldText)
  const b = splitLines(newText)
  const steps = myersSteps(a, b)
  const result: DiffLine[] = []
  let oldLine = 1, newLine = 1
  let ai = 0, bi = 0
  for (const step of steps) {
    const aEnd = ai + step.aCount
    const bEnd = bi + step.bCount
    if (step.op === 'EQUAL') {
      for (let i = 0; i < step.aCount; i++) result.push({ op: 'EQUAL', content: a[ai + i], oldLineNo: oldLine + i, newLineNo: newLine + i })
      ai = aEnd; bi = bEnd; oldLine += step.aCount; newLine += step.bCount
    } else if (step.op === 'DELETE') {
      for (let i = 0; i < step.aCount; i++) result.push({ op: 'DELETE', content: a[ai + i], oldLineNo: oldLine + i })
      ai = aEnd; oldLine += step.aCount
    } else if (step.op === 'INSERT') {
      for (let j = 0; j < step.bCount; j++) result.push({ op: 'INSERT', content: b[bi + j], newLineNo: newLine + j })
      bi = bEnd; newLine += step.bCount
    } else {
      for (let i = 0; i < step.aCount; i++) result.push({ op: 'DELETE', content: a[ai + i], oldLineNo: oldLine + i })
      for (let j = 0; j < step.bCount; j++) result.push({ op: 'INSERT', content: b[bi + j], newLineNo: newLine + j })
      if (opts.refineTokens && step.aCount > 0 && step.bCount > 0) {
        const tokens = refineDiff(a.slice(ai, aEnd).join(''), b.slice(bi, bEnd).join(''))
        const firstIns = result.length - step.bCount
        if (firstIns >= 0 && firstIns < result.length) result[firstIns].tokens = tokens
      }
      ai = aEnd; bi = bEnd; oldLine += step.aCount; newLine += step.bCount
    }
  }
  return result
}

function splitTokens(s: string): string[] {
  return s.split(/(\s+|[{}()\[\]<>.,;:!?'"`~@#$%^&*\-_=+|\\/])/).filter(Boolean)
}

export function refineDiff(oldStr: string, newStr: string): DiffToken[] {
  const a = splitTokens(oldStr)
  const b = splitTokens(newStr)
  const steps = myersSteps(a, b)
  const tokens: DiffToken[] = []
  let ai = 0, bi = 0
  for (const step of steps) {
    if (step.op === 'EQUAL') {
      for (let i = 0; i < step.aCount; i++) tokens.push({ op: 'EQUAL', text: a[ai + i] })
      ai += step.aCount; bi += step.bCount
    } else if (step.op === 'DELETE') {
      for (let i = 0; i < step.aCount; i++) tokens.push({ op: 'DELETE', text: a[ai + i] })
      ai += step.aCount
    } else if (step.op === 'INSERT') {
      for (let j = 0; j < step.bCount; j++) tokens.push({ op: 'INSERT', text: b[bi + j] })
      bi += step.bCount
    } else {
      for (let i = 0; i < step.aCount; i++) tokens.push({ op: 'DELETE', text: a[ai + i] })
      for (let j = 0; j < step.bCount; j++) tokens.push({ op: 'INSERT', text: b[bi + j] })
      ai += step.aCount; bi += step.bCount
    }
  }
  return tokens
}

const CONTEXT_LINES = 3

export function buildHunks(lines: DiffLine[], context = CONTEXT_LINES): DiffHunk[] {
  const hunks: DiffHunk[] = []
  let i = 0
  while (i < lines.length) {
    while (i < lines.length && lines[i].op === 'EQUAL') i++
    if (i >= lines.length) break
    const start = Math.max(0, i - context)
    let j = i
    let runEqual = 0
    while (j < lines.length) {
      if (lines[j].op === 'EQUAL') {
        runEqual++
        if (runEqual > 2 * context) {
          j -= runEqual - context
          break
        }
      } else {
        runEqual = 0
      }
      j++
    }
    const slice = lines.slice(start, j)
    let oldS = 0, oldC = 0, newS = 0, newC = 0
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
    hunks.push({ oldStart: oldS, oldCount: oldC, newStart: newS, newCount: newC, lines: slice })
    i = j
  }
  return hunks
}

export function computeFileDiff(
  oldPath: string | undefined,
  newPath: string | undefined,
  oldText: string | undefined | null,
  newText: string | undefined | null,
  opts: { oldSha?: string; newSha?: string; refineTokens?: boolean } = {},
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
  const lines = diffLines(oldT, newT, { refineTokens: opts.refineTokens })
  const hunks = buildHunks(lines)
  let adds = 0, dels = 0
  for (const l of lines) {
    if (l.op === 'INSERT') adds++
    else if (l.op === 'DELETE') dels++
  }
  return {
    oldPath, newPath,
    oldSha: opts.oldSha, newSha: opts.newSha,
    status, hunks,
    additions: adds, deletions: dels,
    oldLineCount: oldT === '' ? 0 : oldT.split(/\r?\n/).length,
    newLineCount: newT === '' ? 0 : newT.split(/\r?\n/).length,
  }
}

export function toUnifiedDiff(file: DiffFileResult): string {
  if (file.binary) return `Binary files ${file.oldPath ?? '/dev/null'} and ${file.newPath ?? '/dev/null'} differ\n`
  if (file.status === 'unchanged' && file.hunks.length === 0) return ''
  const a = file.oldPath ? `a/${file.oldPath}` : '/dev/null'
  const b = file.newPath ? `b/${file.newPath}` : '/dev/null'
  const header = [
    `diff --git ${a} ${b}`,
    ...(file.status === 'renamed' ? [`rename from ${file.oldPath}`, `rename to ${file.newPath}`, `similarity index ${file.similarity ?? 0}%`] : []),
    ...(file.oldSha && file.newSha ? [`index ${file.oldSha.slice(0, 7)}..${file.newSha.slice(0, 7)}`] : []),
    `--- ${a}`,
    `+++ ${b}`,
  ]
  const body = file.hunks.map(h => {
    const head = `@@ -${h.oldStart},${h.oldCount} +${h.newStart},${h.newCount} @@${h.sectionHeader ? ' ' + h.sectionHeader : ''}`
    const ln = h.lines
      .map(l => {
        const c = stripEol(l.content)
        if (l.op === 'EQUAL') return ' ' + c
        if (l.op === 'INSERT') return '+' + c
        if (l.op === 'DELETE') return '-' + c
        return ' ' + c
      }).join('\n')
    return head + '\n' + ln
  })
  return [...header, ...body].join('\n') + '\n'
}

function stripEol(s: string): string {
  if (s.endsWith('\r\n')) return s.slice(0, -2)
  if (s.endsWith('\n')) return s.slice(0, -1)
  return s
}

// Three-Way Merge
export function threeWayMerge(
  ancestor: string, ours: string, theirs: string,
  opts: { oursLabel?: string; theirsLabel?: string; ancestorLabel?: string; conflictStyle?: 'merge' | 'diff3' } = {},
): MergeResult {
  const { oursLabel = 'HEAD', theirsLabel = 'THEIRS', ancestorLabel = 'ancestor', conflictStyle = 'merge' } = opts
  const A = splitLines(ancestor)
  const O = splitLines(ours)
  const T = splitLines(theirs)
  const ao = diffMap(A, O)
  const at = diffMap(A, T)
  const result: MergeLine[] = []
  let hasConflicts = false
  let conflictCount = 0
  // 简化实现：逐段扫描
  const allChangeEvents: Array<{ pos: number; side: 'O' | 'T'; kind: 'MOD' | 'INS'; aCount: number; oStart: number; oEnd: number; tStart?: number; tEnd?: number }> = []
  for (const d of ao) {
    if (d.kind !== 'EQUAL') allChangeEvents.push({ pos: d.aStart, side: 'O', kind: d.aCount === 0 ? 'INS' : 'MOD', aCount: d.aCount, oStart: d.oStart, oEnd: d.oEnd })
  }
  for (const d of at) {
    if (d.kind !== 'EQUAL') allChangeEvents.push({ pos: d.aStart, side: 'T', kind: d.aCount === 0 ? 'INS' : 'MOD', aCount: d.aCount, oStart: d.oStart, oEnd: d.oEnd, tStart: d.oStart, tEnd: d.oEnd })
  }
  allChangeEvents.sort((a, b) => a.pos - b.pos || (a.kind === 'MOD' ? -1 : 1))
  const processedO = new Set<string>()
  const processedT = new Set<string>()
  let ai = 0
  const N = A.length
  while (ai < N) {
    const here = allChangeEvents.filter(e => e.pos === ai)
    const modO = here.find(e => e.side === 'O' && e.kind === 'MOD')
    const modT = here.find(e => e.side === 'T' && e.kind === 'MOD')
    const keyO = (d: any) => `${d.aStart}|${d.oStart}|${d.oEnd}`
    if (modO && modT && !processedO.has(keyO(modO)) && !processedT.has(keyO(modT))) {
      processedO.add(keyO(modO)); processedT.add(keyO(modT))
      const oSlice = O.slice(modO.oStart, modO.oEnd)
      const tSlice = T.slice(modT.tStart ?? modT.oStart, modT.tEnd ?? modT.oEnd)
      const aLen = Math.max(modO.aCount, modT.aCount)
      const aSlice = A.slice(ai, ai + aLen)
      if (linesEq(oSlice, tSlice)) for (const l of oSlice) result.push({ kind: 'context', content: l })
      else { hasConflicts = true; conflictCount++; result.push({ kind: 'conflict', ours: oSlice, theirs: tSlice, ancestor: aSlice }) }
      ai += Math.max(1, aLen); continue
    }
    if (modO && !processedO.has(keyO(modO))) {
      processedO.add(keyO(modO))
      const sl = O.slice(modO.oStart, modO.oEnd)
      for (const l of sl) result.push({ kind: 'ours', content: l })
      ai += Math.max(1, modO.aCount); continue
    }
    if (modT && !processedT.has(keyO(modT))) {
      processedT.add(keyO(modT))
      const sl = T.slice(modT.tStart ?? modT.oStart, modT.tEnd ?? modT.oEnd)
      for (const l of sl) result.push({ kind: 'theirs', content: l })
      ai += Math.max(1, modT.aCount); continue
    }
    const insO = here.find(e => e.side === 'O' && e.kind === 'INS')
    const insT = here.find(e => e.side === 'T' && e.kind === 'INS')
    if (insO || insT) {
      const oSlice = insO ? O.slice(insO.oStart, insO.oEnd) : []
      const tSlice = insT ? T.slice(insT.tStart ?? insT.oStart, insT.tEnd ?? insT.oEnd) : []
      if (insO && insT) {
        if (linesEq(oSlice, tSlice)) for (const l of oSlice) result.push({ kind: 'context', content: l })
        else { hasConflicts = true; conflictCount++; result.push({ kind: 'conflict', ours: oSlice, theirs: tSlice }) }
        processedO.add(keyO(insO)); processedT.add(keyO(insT))
      } else if (insO) {
        for (const l of oSlice) result.push({ kind: 'ours', content: l }); processedO.add(keyO(insO))
      } else if (insT) {
        for (const l of tSlice) result.push({ kind: 'theirs', content: l }); processedT.add(keyO(insT))
      }
      if (!modO && !modT) {
        if (here.length === 1) {
          result.push({ kind: 'context', content: A[ai] }); ai++
        }
        continue
      }
      continue
    }
    result.push({ kind: 'context', content: A[ai] }); ai++
  }
  // 尾部插入
  const tailO = ao.find(d => d.kind !== 'EQUAL' && d.aStart === N)
  const tailT = at.find(d => d.kind !== 'EQUAL' && d.aStart === N)
  if (tailO || tailT) {
    const os = tailO ? O.slice(tailO.oStart, tailO.oEnd) : []
    const ts = tailT ? T.slice(tailT.oStart, tailT.oEnd) : []
    if (os.length && ts.length) {
      if (linesEq(os, ts)) for (const l of os) result.push({ kind: 'context', content: l })
      else { hasConflicts = true; conflictCount++; result.push({ kind: 'conflict', ours: os, theirs: ts }) }
    } else if (os.length) for (const l of os) result.push({ kind: 'ours', content: l })
    else for (const l of ts) result.push({ kind: 'theirs', content: l })
  }
  const merged: string[] = []
  for (const ln of result) {
    if ('content' in ln && ln.content != null) merged.push(ln.content)
    else if (ln.kind === 'conflict') {
      merged.push(`<<<<<<< ${oursLabel}\n`)
      for (const l of (ln as any).ours) merged.push(l)
      if (conflictStyle === 'diff3' && (ln as any).ancestor) {
        merged.push(`||||||| ${ancestorLabel}\n`)
        for (const l of (ln as any).ancestor) merged.push(l)
      }
      merged.push('=======\n')
      for (const l of (ln as any).theirs) merged.push(l)
      merged.push(`>>>>>>> ${theirsLabel}\n`)
    }
  }
  return { lines: result, hasConflicts, conflictCount, merged: merged.join(''), oursLabel, theirsLabel, ancestorLabel }
}

type MapItem = { kind: 'EQUAL' | 'CHANGED'; aStart: number; aCount: number; oStart: number; oEnd: number }
function diffMap(A: string[], B: string[]): MapItem[] {
  const steps = myersSteps(A, B)
  const out: MapItem[] = []
  let ai = 0, bi = 0
  for (const s of steps) {
    if (s.op === 'EQUAL') out.push({ kind: 'EQUAL', aStart: ai, aCount: s.aCount, oStart: bi, oEnd: bi + s.bCount })
    else out.push({ kind: 'CHANGED', aStart: ai, aCount: s.aCount, oStart: bi, oEnd: bi + s.bCount })
    ai += s.aCount; bi += s.bCount
  }
  return out
}

function linesEq(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}
