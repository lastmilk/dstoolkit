/**
 * 极简 Markdown → 文本片段
 * 小程序中不引入重型 markdown 渲染库，提供轻量清洗 + 分段
 */

export interface MdSegment {
  type: 'p' | 'h1' | 'h2' | 'h3' | 'code' | 'quote' | 'list' | 'br'
  text: string
}

export function stripMdToText(md: string, maxLen = 200): string {
  if (!md) return ''
  let s = md
    .replace(/```[\s\S]*?```/g, ' [代码] ')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '[图片]')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/[*_~]{1,3}([^*_~]+)[*_~]{1,3}/g, '$1')
    .replace(/>\s*/g, '')
    .replace(/^[-*+]\s+/gm, '• ')
    .replace(/\n{2,}/g, '\n')
    .replace(/\s+/g, ' ')
    .trim()
  if (s.length > maxLen) {
    s = s.slice(0, maxLen) + '...'
  }
  return s
}

export function parseSegments(md: string): MdSegment[] {
  if (!md) return []
  const lines = md.split('\n')
  const segments: MdSegment[] = []
  let inCode = false
  let codeBuf: string[] = []

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        segments.push({ type: 'code', text: codeBuf.join('\n') })
        codeBuf = []
        inCode = false
      } else {
        inCode = true
      }
      continue
    }
    if (inCode) {
      codeBuf.push(line)
      continue
    }
    if (line.trim() === '') {
      segments.push({ type: 'br', text: '' })
      continue
    }
    if (/^#\s+/.test(line)) {
      segments.push({ type: 'h1', text: line.replace(/^#\s+/, '') })
    } else if (/^##\s+/.test(line)) {
      segments.push({ type: 'h2', text: line.replace(/^##\s+/, '') })
    } else if (/^###\s+/.test(line)) {
      segments.push({ type: 'h3', text: line.replace(/^###\s+/, '') })
    } else if (/^>\s?/.test(line)) {
      segments.push({ type: 'quote', text: line.replace(/^>\s?/, '') })
    } else if (/^[-*+]\s+/.test(line)) {
      segments.push({ type: 'list', text: line.replace(/^[-*+]\s+/, '') })
    } else {
      segments.push({ type: 'p', text: line })
    }
  }
  if (inCode && codeBuf.length > 0) {
    segments.push({ type: 'code', text: codeBuf.join('\n') })
  }
  return segments.filter((s) => s.type !== 'br' || s.text !== '')
}
