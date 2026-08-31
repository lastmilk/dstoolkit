<script setup lang="ts">
/**
 * PRCommentThread — 代码行内评论 + 讨论
 * Props:
 *   comments: PRCommentEntity[] (带 replyTo 自引用关系)
 *   currentUserId: number
 * Emits:
 *   submit(body, inReplyToId?, filePath?, lineNumber?, side?)
 *   resolve(id)
 */
import { ref } from 'vue'
import type { PRCommentEntity } from '../types/types'

const props = defineProps<{
  comments: PRCommentEntity[]
  currentUserId: number
  filePath?: string
  lineNumber?: number
  side?: 'LEFT' | 'RIGHT'
  title?: string
}>()

const emit = defineEmits<{
  'submit': [body: string, replyToId?: number, filePath?: string, lineNumber?: number, side?: 'LEFT' | 'RIGHT']
  'resolve': [id: number]
}>()

const replyToId = ref<number | null>(null)
const body = ref('')

function submit() {
  if (!body.value.trim()) return
  emit(
    'submit',
    body.value,
    replyToId.value ?? undefined,
    props.filePath,
    props.lineNumber,
    props.side,
  )
  body.value = ''
  replyToId.value = null
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
  return new Date(iso).toLocaleDateString()
}

function roots(comments: PRCommentEntity[]) {
  // 顶层评论（无 replyToId 或 replyToId 不存在） — 带 children
  const map = new Map<number, PRCommentEntity & { children?: PRCommentEntity[] }>()
  comments.forEach(c => map.set(c.id, { ...c, children: [] }))
  const rootsList: (PRCommentEntity & { children?: PRCommentEntity[] })[] = []
  for (const c of map.values()) {
    if (c.replyToId && map.has(c.replyToId)) {
      map.get(c.replyToId)!.children!.push(c)
    } else {
      rootsList.push(c)
    }
  }
  return rootsList
}
</script>

<template>
  <div class="pr-comments neu-card" style="padding: 14px 16px;">
    <div class="prc-title" v-if="title">{{ title }}</div>
    <div v-if="comments.length === 0" class="prc-empty">暂无评论</div>
    <div v-else class="prc-list">
      <div
        v-for="c in roots(comments)"
        :key="c.id"
        class="prc-thread"
        :class="{ resolved: c.isResolved }"
      >
        <div class="prc-avatar" :style="{ background: `hsl(${(c.authorId * 97) % 360}, 70%, 70%)` }">
          {{ c.authorName.charAt(0).toUpperCase() }}
        </div>
        <div class="prc-body">
          <div class="prc-head">
            <span class="prc-author">{{ c.authorName }}</span>
            <span class="prc-time">{{ timeAgo(c.createdAt) }}</span>
            <span v-if="c.filePath" class="prc-ref" :title="c.filePath">
              📍 {{ c.filePath }}{{ c.lineNumber ? `:${c.lineNumber}` : '' }}
            </span>
            <span v-if="c.isResolved" class="prc-resolved-badge">✔ 已解决</span>
          </div>
          <div class="prc-body-text">{{ c.body }}</div>
          <div class="prc-actions">
            <button class="btn-link" @click="replyToId = replyToId === c.id ? null : c.id">
              {{ replyToId === c.id ? '取消' : '回复' }}
            </button>
            <button
              v-if="!c.isResolved && (c.authorId === currentUserId)"
              class="btn-link resolve"
              @click="emit('resolve', c.id)"
            >标记已解决</button>
          </div>
          <div v-if="c.children && c.children.length > 0" class="prc-replies">
            <div
              v-for="r in c.children"
              :key="r.id"
              class="prc-reply"
            >
              <div class="prc-avatar small" :style="{ background: `hsl(${(r.authorId * 97) % 360}, 70%, 70%)` }">
                {{ r.authorName.charAt(0).toUpperCase() }}
              </div>
              <div class="prc-body">
                <div class="prc-head small">
                  <span class="prc-author">{{ r.authorName }}</span>
                  <span class="prc-time">{{ timeAgo(r.createdAt) }}</span>
                </div>
                <div class="prc-body-text">{{ r.body }}</div>
              </div>
            </div>
          </div>
          <div v-if="replyToId === c.id" class="prc-reply-input">
            <textarea v-model="body" rows="2" placeholder="回复 @{{ c.authorName }}..."></textarea>
            <button class="btn btn-primary btn-sm" :disabled="!body.trim()" @click="submit">回复</button>
          </div>
        </div>
      </div>
    </div>
    <div v-if="!replyToId" class="prc-new-comment">
      <textarea v-model="body" rows="3" placeholder="撰写评论 / 建议..."></textarea>
      <div class="prc-new-actions">
        <span v-if="filePath" class="prc-new-ref">
          定位：{{ filePath }}{{ lineNumber ? `:${lineNumber} (${side ?? ''})` : '' }}
        </span>
        <button class="btn btn-primary" :disabled="!body.trim()" @click="submit">发表</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.prc-title { font-weight: 600; font-size: 15px; margin-bottom: 10px; }
.prc-empty { padding: 20px; text-align: center; color: var(--text-muted); }
.prc-list { display: flex; flex-direction: column; gap: 12px; }
.prc-thread {
  display: flex; gap: 12px;
  padding: 12px; border-radius: 10px;
  border: 1px solid var(--border-color);
  background: white;
}
.prc-thread.resolved { opacity: .7; background: var(--success-bg); border-style: dashed; }
.prc-avatar {
  width: 36px; height: 36px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  color: white; font-weight: 700; flex-shrink: 0;
  font-size: 13px;
}
.prc-avatar.small { width: 28px; height: 28px; font-size: 11px; }
.prc-body { flex: 1; min-width: 0; }
.prc-head {
  display: flex; align-items: center; gap: 10px; font-size: 12px; color: var(--text-muted);
}
.prc-head.small { font-size: 11px; }
.prc-author { font-weight: 600; color: var(--text-color); }
.prc-ref {
  font-family: ui-monospace, monospace; font-size: 11px;
  background: var(--neutral-soft); padding: 1px 6px; border-radius: 4px;
  max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.prc-resolved-badge {
  font-size: 10.5px; background: var(--success-bg); color: var(--success-fg);
  padding: 1px 6px; border-radius: 4px; font-weight: 600;
}
.prc-body-text {
  margin-top: 4px; line-height: 1.55; white-space: pre-wrap; word-break: break-word;
  font-size: 13.5px; color: var(--text-color);
}
.prc-actions { margin-top: 6px; display: flex; gap: 12px; }
.btn-link {
  background: none; border: none; color: var(--primary);
  font-size: 12px; cursor: pointer; padding: 2px 0;
}
.btn-link:hover { text-decoration: underline; }
.btn-link.resolve { color: var(--success); }
.prc-replies { margin-top: 10px; display: flex; flex-direction: column; gap: 8px; }
.prc-reply {
  display: flex; gap: 8px; padding: 8px 10px;
  background: var(--neutral-soft); border-radius: 8px;
}
.prc-reply-input { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
.prc-reply-input textarea {
  width: 100%; resize: vertical; min-height: 56px;
  border: 1px solid var(--border-color); border-radius: 6px;
  padding: 6px 10px; font-size: 13px; outline: none;
}
.prc-new-comment { margin-top: 14px; border-top: 1px dashed var(--border-color); padding-top: 12px; }
.prc-new-comment textarea {
  width: 100%; min-height: 80px; resize: vertical;
  padding: 10px 12px; border: 1px solid var(--border-color);
  border-radius: 8px; outline: none; font-size: 13.5px;
}
.prc-new-comment textarea:focus { border-color: var(--primary); }
.prc-new-actions { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
.prc-new-ref { font-size: 11.5px; color: var(--text-muted); font-family: ui-monospace, monospace; }
.btn {
  padding: 6px 14px; border-radius: 6px; font-size: 12.5px;
  cursor: pointer; border: 1px solid transparent;
}
.btn-primary { background: var(--primary); color: white; }
.btn:disabled { opacity: .4; cursor: not-allowed; }
.btn-sm { padding: 4px 10px; font-size: 12px; }
</style>
