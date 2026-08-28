import React, { useState, useEffect } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import styles from './index.module.scss'
import NeuButton from '@/components/NeuButton'
import { callFunction } from '@/services/cloud'
import { formatRelative, formatDateTime } from '@/utils/date'
import { stripMdToText, parseSegments } from '@/utils/markdown'
import type {
  Conversation,
  Message,
  ConvSummary,
  KnowledgeCard
} from '@/types'
import type { DetailResponse } from '@/data/getConversationDetail'

export default function ConversationDetailPage() {
  const router = useRouter()
  const id = Number(router.params.id) || 1
  const [loading, setLoading] = useState(true)
  const [conv, setConv] = useState<Conversation | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [summary, setSummary] = useState<ConvSummary | null>(null)
  const [kc, setKc] = useState<KnowledgeCard[]>([])

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const d = await callFunction<DetailResponse>('getConversationDetail', {
          conversationId: id
        })
        setConv(d.conversation)
        setMessages(d.messages)
        setSummary(d.summary)
        setKc(d.knowledgeCards)
      } catch (err) {
        console.error('[ConvDetail] load failed:', err)
        Taro.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id])

  const handleShare = () => {
    Taro.showToast({ title: '分享链接已复制（演示）', icon: 'success' })
  }

  const handleExport = () => {
    Taro.showToast({ title: 'Markdown 导出中…', icon: 'none' })
  }

  // 渲染单条消息（极简 Markdown）
  const renderContent = (content: string, isUser: boolean) => {
    const segs = parseSegments(content)
    return segs.map((s, i) => {
      if (s.type === 'h1' || s.type === 'h2' || s.type === 'h3') {
        return (
          <Text key={i} className={styles.bubbleTitle}>
            {s.text}
          </Text>
        )
      }
      if (s.type === 'code') {
        return (
          <View key={i} className={styles.codeBlock}>
            <Text>{s.text}</Text>
          </View>
        )
      }
      if (s.type === 'list') {
        return (
          <View key={i} style={{ marginTop: 4 }}>
            <Text>• {s.text}</Text>
          </View>
        )
      }
      if (s.type === 'quote') {
        return (
          <View
            key={i}
            style={{
              marginTop: 6,
              paddingLeft: 12,
              borderLeft: `3rpx solid ${isUser ? 'rgba(255,255,255,0.4)' : '#165DFF'}`,
              fontSize: 24,
              opacity: 0.9
            }}
          >
            <Text>{s.text}</Text>
          </View>
        )
      }
      return (
        <Text key={i} style={{ display: 'block' }}>
          {s.text}
        </Text>
      )
    })
  }

  return (
    <ScrollView className={styles.page} scrollY enhanced showScrollbar={false}>
      {/* 头部 */}
      <View className={styles.header}>
        <Text className={styles.title}>{conv?.title || '加载中…'}</Text>
        <View className={styles.meta}>
          <View className={styles.metaChip}>
            <Text>🕒 更新于 {conv ? formatRelative(conv.updatedAt) : '--'}</Text>
          </View>
          <View className={styles.metaChip}>
            <Text>🔁 {conv?.turnCount ?? 0} 轮对话</Text>
          </View>
          <View className={styles.metaChip}>
            <Text>💬 {messages.length} 条消息</Text>
          </View>
        </View>
      </View>

      {/* AI 摘要 */}
      {summary && (
        <View className={styles.summaryCard}>
          <View className={styles.summaryLabel}>
            <Text>✨</Text>
            <Text>AI 智能摘要</Text>
            <Text style={{ fontSize: 20, color: '#86909C', fontWeight: 400 }}>
              置信度 {(summary.confidence * 100).toFixed(0)}%
            </Text>
          </View>
          <Text className={styles.tldr}>👉 {summary.tldr}</Text>
          <Text className={styles.summaryBody}>{summary.summary}</Text>
          {summary.tags?.length > 0 && (
            <View className={styles.tagRow}>
              {summary.tags.map((t) => (
                <View key={t} className={styles.tag}>
                  <Text>#{t}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* 知识卡片 */}
      {kc.length > 0 && (
        <View className={styles.section}>
          <Text className={styles.sectionHead}>📚 知识卡片</Text>
          <View className={styles.kcList}>
            {kc.map((k) => (
              <View key={k.id} className={styles.kc}>
                <View className={styles.kcHead}>
                  {k.category && (
                    <View className={styles.kcCate}>
                      <Text>{k.category}</Text>
                    </View>
                  )}
                  <Text className={styles.kcTitle}>{k.title}</Text>
                </View>
                <Text className={styles.kcContent}>{k.content}</Text>
                {k.tags?.length > 0 && (
                  <View className={styles.tagRow}>
                    {k.tags.map((t) => (
                      <View key={t} className={styles.tag}>
                        <Text>#{t}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))}
          </View>
        </View>
      )}

      {/* 消息列表 */}
      <View className={styles.section}>
        <Text className={styles.sectionHead}>💬 完整对话</Text>
        <View className={styles.msgList}>
          {messages.map((m) => {
            const isUser = m.role === 'USER'
            return (
              <View key={m.id} className={`${styles.msg} ${isUser ? styles.user : ''}`}>
                <View className={`${styles.avatar} ${isUser ? styles.userAvatar : ''}`}>
                  <Text>{isUser ? '我' : 'AI'}</Text>
                </View>
                <View className={styles.bubble}>
                  {renderContent(m.content, isUser)}
                  <View
                    style={{
                      marginTop: 12,
                      fontSize: 20,
                      opacity: 0.6,
                      textAlign: isUser ? 'right' : 'left'
                    }}
                  >
                    {m.model && `[${m.model}]  ·  `}
                    {formatDateTime(m.insertedAt)}
                  </View>
                </View>
              </View>
            )
          })}
        </View>
      </View>

      <View style={{ height: 32 }} />

      {/* 底部操作 */}
      <View className={styles.actionBar}>
        <NeuButton type="default" size="lg" full onClick={handleExport}>
          <Text>📥 导出</Text>
        </NeuButton>
        <NeuButton type="primary" size="lg" full onClick={handleShare}>
          <Text>🔗 分享</Text>
        </NeuButton>
      </View>
    </ScrollView>
  )
}
