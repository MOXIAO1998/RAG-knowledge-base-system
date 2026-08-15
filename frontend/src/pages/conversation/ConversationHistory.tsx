import React, { useState, useEffect } from 'react'
import { Table, Button, Drawer, Typography, Card, App } from 'antd'
import { EyeOutlined } from '@ant-design/icons'
import PageContainer from '../../components/PageContainer'
import MessageBubble from '../../components/MessageBubble'
import { conversationApi } from '../../api'
import { ApiError } from '../../api/http'
import { hasPermission } from '../../utils/permission'
import type { Conversation } from '../../types'

const { Text } = Typography

const ConversationHistory: React.FC = () => {
  const [detailOpen, setDetailOpen] = useState(false)
  const [selectedConv, setSelectedConv] = useState<Conversation | null>(null)
  const [convs, setConvs] = useState<Conversation[]>([])
  const [loading, setLoading] = useState(true)
  const { message } = App.useApp()
  const isAdmin = hasPermission('admin')

  useEffect(() => {
    // Backend already isolates by user (admins see all); frontend directly displays the returned results
    conversationApi
      .list()
      .then(setConvs)
      .catch((e: ApiError) => message.error(e.message || 'Failed to load conversations'))
      .finally(() => setLoading(false))
  }, [message])

  const openDetail = async (conv: Conversation) => {
    try {
      const full = await conversationApi.get(conv.id)
      setSelectedConv(full)
      setDetailOpen(true)
    } catch (e) {
      message.error((e as ApiError).message || 'Failed to load conversation details')
    }
  }

  const columns = [
    { title: 'Title', dataIndex: 'title', key: 'title', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Knowledge Base', dataIndex: 'kbName', key: 'kbName', width: 150 },
    ...(isAdmin ? [{ title: 'User ID', dataIndex: 'userId', key: 'userId', width: 100 }] : []),
    { title: 'Messages', dataIndex: 'messageCount', key: 'messageCount', width: 80, align: 'center' as const },
    { title: 'Last Updated', dataIndex: 'updatedAt', key: 'updatedAt', width: 180 },
    {
      title: 'Actions', key: 'actions', width: 100,
      render: (_: unknown, r: Conversation) => (
        <Button type="link" icon={<EyeOutlined />} onClick={() => openDetail(r)}>View</Button>
      ),
    },
  ]

  return (
    <PageContainer title="Conversation History" breadcrumb={[{ label: 'Conversation History' }]}>
      <Card style={{ borderRadius: 12, border: '1px solid #eef1f5' }}>
        <Table
          dataSource={convs.map((c) => ({ ...c, key: c.id }))}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 15, showTotal: (t) => `${t} total` }}
          size="middle"
        />
      </Card>

      <Drawer
        title={`Conversation Details - ${selectedConv?.title || ''}`}
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        width={640}
      >
        {selectedConv?.messages?.map((m) => (
          <MessageBubble key={m.id} message={m} citationMode="tags" showRoleInMeta size="compact" />
        ))}
      </Drawer>
    </PageContainer>
  )
}

export default ConversationHistory
