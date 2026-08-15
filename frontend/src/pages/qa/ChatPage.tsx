import React, { useState, useRef, useEffect } from 'react'
import {
  Input, Button, Typography, Drawer, App, Card,
} from 'antd'
import {
  SendOutlined, StopOutlined, FileTextOutlined, DeploymentUnitOutlined,
  ThunderboltFilled, PlusOutlined, MessageOutlined,
} from '@ant-design/icons'
import PageContainer from '../../components/PageContainer'
import MessageBubble from '../../components/MessageBubble'
import MarkdownText from '../../components/MarkdownText'
import { conversationApi, qaStream } from '../../api'
import { ApiError } from '../../api/http'
import type { Message, Citation, Conversation } from '../../types'

const { TextArea } = Input
const { Text } = Typography

interface RoutedKb {
  id: number
  name: string
}

const STAGE_TEXT: Record<string, string> = {
  routing: 'Analyzing your question and automatically matching knowledge bases…',
  retrieving: 'Retrieving relevant documents…',
  grading: 'Evaluating retrieval quality…',
  rewriting: 'Retrieval results were poor; optimizing the query and retrieving again…',
  generating: 'Generating the answer…',
  verifying: 'Verifying the basis of the answer…',
  regenerating: 'Insufficient basis for the answer; regenerating…',
}

const ChatPage: React.FC = () => {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [streaming, setStreaming] = useState(false)
  const [currentStream, setCurrentStream] = useState('')
  const [statusStage, setStatusStage] = useState('')
  // Knowledge bases automatically matched by the model (no longer requires manual user selection)
  const [routedKbs, setRoutedKbs] = useState<RoutedKb[]>([])
  const [citations, setCitations] = useState<Citation[]>([])
  const [refPanelOpen, setRefPanelOpen] = useState(false)
  const [refTarget, setRefTarget] = useState<Citation[]>([])
  const [convs, setConvs] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<number | null>(null)
  const abortRef = useRef<null | (() => void)>(null)
  const answerRef = useRef('')
  const citationsRef = useRef<Citation[]>([])
  const scrollRef = useRef<HTMLDivElement>(null)
  const { message } = App.useApp()

  const loadConvs = () => {
    conversationApi.list().then(setConvs).catch(() => {})
  }

  useEffect(() => {
    loadConvs()
    return () => {
      abortRef.current?.()
    }
  }, [])

  // Auto-scroll to the bottom on new messages / streaming output
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, currentStream, statusStage])

  const openConversation = async (c: Conversation) => {
    try {
      const full = await conversationApi.get(c.id)
      setMessages(full.messages || [])
      setConversationId(c.id)
    } catch (e) {
      message.error((e as ApiError).message || 'Failed to load conversation')
    }
  }

  const send = (text: string) => {
    if (!text.trim() || streaming) return
    const q = text.trim()
    const userMsg: Message = { id: Date.now(), role: 'user', content: q, createdAt: new Date().toLocaleTimeString() }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    startStream(q)
  }

  const handleSend = () => send(input)

  const startStream = (query: string) => {
    setStreaming(true)
    setStatusStage('routing')
    setCitations([])
    setCurrentStream('')
    setRoutedKbs([])
    answerRef.current = ''

    abortRef.current = qaStream(
      { query, conversationId, kbId: null },
      {
        onEvent: (e) => {
          switch (e.type) {
            case 'routing':
              setRoutedKbs(e.kbs || [])
              setStatusStage('routing')
              break
            case 'retrieving':
              setStatusStage('retrieving')
              break
            case 'stage':
              // In-graph extended stages (grading / rewriting / verifying / regenerating)
              setStatusStage(e.stage || '')
              break
            case 'restart':
              // Hallucination check failed; clear already-output content and wait for regeneration
              answerRef.current = ''
              setCurrentStream('')
              break
            case 'generating':
              setStatusStage('generating')
              break
            case 'token':
              answerRef.current += e.delta || ''
              setCurrentStream(answerRef.current)
              break
            case 'citations':
              citationsRef.current = e.citations || []
              setCitations(e.citations || [])
              break
            case 'done': {
              const assistantMsg: Message = {
                id: Date.now() + 1,
                role: 'assistant',
                content: answerRef.current,
                citations: citationsRef.current,
                createdAt: new Date().toLocaleTimeString(),
              }
              setMessages((prev) => [...prev, assistantMsg])
              setStreaming(false)
              setCurrentStream('')
              setStatusStage('')
              if (e.conversationId) setConversationId(e.conversationId)
              loadConvs()
              break
            }
            case 'error':
              message.error(e.message || 'Generation failed')
              setStreaming(false)
              setStatusStage('')
              setCurrentStream('')
              break
          }
        },
        onError: (err) => {
          message.error(err.message || 'Connection failed')
          setStreaming(false)
          setStatusStage('')
          setCurrentStream('')
        },
      },
    )
  }

  // Stop / interrupt streaming generation
  const handleStop = () => {
    abortRef.current?.()
    setStreaming(false)
    setStatusStage('')
    setCurrentStream('')
    message.info('Generation stopped')
  }

  const showCitations = (refs?: Citation[]) => {
    if (refs && refs.length > 0) {
      setRefTarget(refs)
      setRefPanelOpen(true)
    }
  }

  const newChat = () => {
    setMessages([])
    setConversationId(null)
    setCurrentStream('')
    setCitations([])
  }

  return (
    <PageContainer title="Intelligent Q&A" breadcrumb={[{ label: 'Intelligent Q&A' }]} extra={
      <div className="qa-route-badge">
        <DeploymentUnitOutlined />
        <span>Intelligent Routing · Auto-matching Knowledge Bases</span>
      </div>
    }>
      <div className="qa-layout">
        {/* Left conversation list */}
        <aside className="qa-sidebar">
          <Button
            type="primary"
            icon={<PlusOutlined />}
            block
            onClick={newChat}
            className="qa-newchat-btn"
          >
            New Conversation
          </Button>
          <div className="qa-sidebar-label">
            <MessageOutlined style={{ marginRight: 6 }} />Conversation History
          </div>
          <div className="qa-conv-list">
            {convs.length === 0 && (
              <div className="qa-conv-empty">No conversation history</div>
            )}
            {convs.slice(0, 20).map((c) => (
              <div
                key={c.id}
                className={`qa-conv-item ${conversationId === c.id ? 'active' : ''}`}
                onClick={() => openConversation(c)}
              >
                <div className="qa-conv-title">{c.title}</div>
                <div className="qa-conv-meta">{c.messageCount} messages</div>
              </div>
            ))}
          </div>
        </aside>

        {/* Center conversation area */}
        <section className="qa-main">
          <div className="qa-messages" ref={scrollRef}>
            {messages.length === 0 && !streaming && (
              <div className="qa-welcome">
                <div className="qa-welcome-icon"><ThunderboltFilled /></div>
                <h2 className="qa-welcome-title">Hello, I'm your Knowledge Base Assistant</h2>
                <p className="qa-welcome-sub">Just ask a question, and I'll automatically match relevant knowledge bases and provide answers with cited sources</p>
              </div>
            )}

            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} citationMode="link" onCitationClick={showCitations} />
            ))}

            {/* Streaming output */}
            {streaming && (
              <div className="chat-row is-ai">
                <div className="chat-avatar chat-avatar-ai"><ThunderboltFilled /></div>
                <div className="chat-col">
                  <div className="chat-bubble chat-bubble-ai">
                    {routedKbs.length > 0 && (
                      <div className="qa-routed">
                        <span className="qa-routed-label">Auto-matched</span>
                        {routedKbs.map((k) => (
                          <span key={k.id} className="qa-routed-tag">{k.name}</span>
                        ))}
                      </div>
                    )}
                    {statusStage && !currentStream && (
                      <div className="qa-thinking">
                        <span className="qa-dots"><i /><i /><i /></span>
                        <span className="qa-thinking-text">{STAGE_TEXT[statusStage] || 'Thinking…'}</span>
                      </div>
                    )}
                    {currentStream && (
                      <div className="qa-streaming">
                        <MarkdownText content={currentStream} />
                        <span className="cursor-blink">▍</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input area */}
          <div className="qa-composer">
            <TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); handleSend() } }}
              placeholder="Enter your question. Enter to send / Shift+Enter for a new line"
              autoSize={{ minRows: 1, maxRows: 5 }}
              variant="borderless"
              className="qa-input"
            />
            {streaming ? (
              <Button icon={<StopOutlined />} onClick={handleStop} className="qa-send-btn" danger>
                Stop
              </Button>
            ) : (
              <Button type="primary" icon={<SendOutlined />} onClick={handleSend} disabled={!input.trim()} className="qa-send-btn">
                Send
              </Button>
            )}
          </div>
        </section>

        {/* Citation traceability floating entry */}
        {citations.length > 0 && (
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => showCitations(citations)}
            className="qa-cite-fab"
          >
            View Citations ({citations.length})
          </Button>
        )}
      </div>

      <Drawer title="Citation Sources" open={refPanelOpen} onClose={() => setRefPanelOpen(false)} width={460}>
        {refTarget.map((c, i) => (
          <Card key={i} className="qa-cite-card" size="small">
            <div className="qa-cite-head">
              <span className="qa-cite-index">{i + 1}</span>
              <Text strong style={{ fontSize: 14 }}>{c.title}</Text>
            </div>
            <Text style={{ fontSize: 12, color: '#667085', display: 'block', margin: '4px 0 8px' }}>Page {c.page}</Text>
            <div className="qa-cite-snippet">{c.snippet}</div>
          </Card>
        ))}
      </Drawer>
    </PageContainer>
  )
}

export default ChatPage
