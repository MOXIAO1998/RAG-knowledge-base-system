import React from 'react'
import { Typography, Tag } from 'antd'
import { LinkOutlined, UserOutlined, ThunderboltFilled } from '@ant-design/icons'
import MarkdownText from './MarkdownText'
import type { Message, Citation } from '../types'

const { Text } = Typography

interface MessageBubbleProps {
  message: Message
  /** Citation display mode: 'link' is clickable to expand (Q&A page), 'tags' shows inline tags (conversation detail) */
  citationMode?: 'link' | 'tags'
  /** Callback when a citation is clicked while citationMode='link' */
  onCitationClick?: (citations: Citation[]) => void
  /** Whether the timestamp is prefixed with the role (User/Assistant) */
  showRoleInMeta?: boolean
  /** Size style: default for the main Q&A area, compact for the drawer detail */
  size?: 'default' | 'compact'
}

/** Shared message bubble component: unifies the display for ChatPage and conversation detail, eliminating duplicate implementations */
const MessageBubble: React.FC<MessageBubbleProps> = ({
  message: m,
  citationMode = 'link',
  onCitationClick,
  showRoleInMeta = false,
  size = 'default',
}) => {
  const isUser = m.role === 'user'
  const compact = size === 'compact'

  const avatar = (
    <div className={`chat-avatar ${isUser ? 'chat-avatar-user' : 'chat-avatar-ai'}`}>
      {isUser ? <UserOutlined /> : <ThunderboltFilled />}
    </div>
  )

  return (
    <div className={`chat-row ${isUser ? 'is-user' : 'is-ai'} ${compact ? 'is-compact' : ''}`}>
      {!compact && !isUser && avatar}
      <div className="chat-col">
        <div className={`chat-bubble ${isUser ? 'chat-bubble-user' : 'chat-bubble-ai'}`}>
          {isUser ? (
            <Text style={{ whiteSpace: 'pre-wrap', color: '#fff', fontSize: compact ? 13 : 14, lineHeight: 1.7 }}>
              {m.content}
            </Text>
          ) : (
            <MarkdownText content={m.content} />
          )}

          {m.citations && m.citations.length > 0 && (
            <div className="chat-citations">
              {citationMode === 'link' ? (
                <span className="chat-citation-link" onClick={() => onCitationClick?.(m.citations!)}>
                  <LinkOutlined style={{ marginRight: 5 }} />
                  Citations ({m.citations.length})
                </span>
              ) : (
                <>
                  <Text style={{ fontSize: 11, color: '#667085' }}>Citations:</Text>
                  {m.citations.map((c, i) => (
                    <Tag key={i} style={{ fontSize: 11, marginTop: 4, background: '#f3f7ff', border: 'none', color: '#2563eb' }}>
                      {c.title} (P{c.page})
                    </Tag>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <Text className="chat-meta">
          {showRoleInMeta ? `${isUser ? 'User' : 'Assistant'} · ${m.createdAt}` : m.createdAt}
        </Text>
      </div>
      {!compact && isUser && avatar}
    </div>
  )
}

export default MessageBubble
