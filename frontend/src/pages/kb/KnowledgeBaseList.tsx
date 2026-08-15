import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Row, Col, Card, Button, Tag, Modal, Form, Input, Select, Table, Drawer, App, Typography, Tooltip, Spin, InputNumber, Space, Empty } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  TeamOutlined,
} from '@ant-design/icons'
import PageContainer from '../../components/PageContainer'
import { kbApi } from '../../api'
import { ApiError } from '../../api/http'
import { hasPermission } from '../../utils/permission'
import type { KnowledgeBase, KbMember, Visibility } from '../../types'

const { Text } = Typography

const visibilityMap: Record<Visibility, string> = { public: 'Public', department: 'Department', private: 'Private' }
const visibilityColor: Record<Visibility, string> = { public: '#ecfdf5', department: '#eff6ff', private: '#f9fafb' }
const visibilityTextColor: Record<Visibility, string> = { public: '#16a34a', department: '#2563eb', private: '#667085' }

const KnowledgeBaseList: React.FC = () => {
  const navigate = useNavigate()
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<KnowledgeBase | null>(null)
  const [memberOpen, setMemberOpen] = useState(false)
  const [selectedKb, setSelectedKb] = useState<KnowledgeBase | null>(null)
  const [members, setMembers] = useState<KbMember[]>([])
  const [memberLoading, setMemberLoading] = useState(false)
  const [form] = Form.useForm()
  const [memberForm] = Form.useForm()
  const { message, modal } = App.useApp()
  const canManage = hasPermission('kb:manage')

  const loadKbs = () => {
    setLoading(true)
    kbApi
      .list()
      .then(setKbs)
      .catch((e: ApiError) => message.error(e.message || 'Failed to load knowledge bases'))
      .finally(() => setLoading(false))
  }

  useEffect(loadKbs, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (kb: KnowledgeBase) => {
    setEditing(kb)
    form.setFieldsValue({ name: kb.name, description: kb.description, visibility: kb.visibility })
    setModalOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(async (values) => {
      setSaving(true)
      try {
        if (editing) {
          await kbApi.update(editing.id, values)
          message.success('Knowledge base updated')
        } else {
          await kbApi.create(values)
          message.success('Knowledge base created')
        }
        setModalOpen(false)
        loadKbs()
      } catch (e) {
        message.error((e as ApiError).message || 'Failed to save')
      } finally {
        setSaving(false)
      }
    })
  }

  const handleDelete = (kb: KnowledgeBase) => {
    modal.confirm({
      title: 'Confirm Deletion',
      content: `Are you sure you want to delete the knowledge base "${kb.name}"? This will cascade delete its documents and indexes and cannot be undone.`,
      okText: 'Confirm Delete',
      okButtonProps: { danger: true },
      cancelText: 'Cancel',
      onOk: async () => {
        try {
          await kbApi.remove(kb.id)
          message.success('Knowledge base deleted')
          loadKbs()
        } catch (e) {
          message.error((e as ApiError).message || 'Failed to delete')
        }
      },
    })
  }

  const openMembers = (kb: KnowledgeBase) => {
    setSelectedKb(kb)
    setMemberOpen(true)
    memberForm.resetFields()
    setMemberLoading(true)
    kbApi
      .listMembers(kb.id)
      .then(setMembers)
      .catch((e: ApiError) => message.error(e.message || 'Failed to load members'))
      .finally(() => setMemberLoading(false))
  }

  const handleAddMember = () => {
    if (!selectedKb) return
    memberForm.validateFields().then(async (values: { userId: number; accessLevel: string }) => {
      try {
        await kbApi.addMember(selectedKb.id, values.userId, values.accessLevel)
        message.success('Member saved')
        memberForm.resetFields()
        const list = await kbApi.listMembers(selectedKb.id)
        setMembers(list)
      } catch (e) {
        message.error((e as ApiError).message || 'Failed to add member')
      }
    })
  }

  const handleRemoveMember = async (userId: number) => {
    if (!selectedKb) return
    try {
      await kbApi.removeMember(selectedKb.id, userId)
      message.success('Member removed')
      setMembers((prev) => prev.filter((m) => m.userId !== userId))
    } catch (e) {
      message.error((e as ApiError).message || 'Failed to remove')
    }
  }

  return (
    <PageContainer title="Knowledge Base Management" breadcrumb={[{ label: 'Knowledge Base Management' }]} extra={
      canManage ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>New Knowledge Base</Button> : null
    }>
      <Spin spinning={loading}>
      {!loading && kbs.length === 0 ? (
        <Empty description="No visible knowledge bases" />
      ) : (
      <Row gutter={[16, 16]}>
        {kbs.map((kb) => (
          <Col xs={24} sm={12} lg={8} key={kb.id}>
            <Card
              className="hover-lift"
              hoverable
              style={{ borderRadius: 12, border: '1px solid #eef1f5', height: '100%', cursor: 'pointer' }}
              onClick={() => navigate(`/documents?kbId=${kb.id}`)}
              actions={canManage ? [
                <Tooltip title="Edit" key="edit"><EditOutlined onClick={(e) => { e.stopPropagation(); openEdit(kb) }} /></Tooltip>,
                <Tooltip title="Member Management" key="member"><TeamOutlined onClick={(e) => { e.stopPropagation(); openMembers(kb) }} /></Tooltip>,
                <Tooltip title="Delete" key="delete"><DeleteOutlined style={{ color: '#dc2626' }} onClick={(e) => { e.stopPropagation(); handleDelete(kb) }} /></Tooltip>,
              ] : undefined}
            >
              <div style={{ marginBottom: 12 }}>
                <Text strong style={{ fontSize: 16, display: 'block', marginBottom: 6 }}>{kb.name}</Text>
                <Text style={{ fontSize: 13, color: '#667085', display: 'block', marginBottom: 10, minHeight: 36 }}>
                  {kb.description}
                </Text>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Tag style={{
                  background: visibilityColor[kb.visibility],
                  color: visibilityTextColor[kb.visibility],
                  border: 'none', borderRadius: 6, padding: '2px 10px', fontSize: 12,
                }}>
                  {visibilityMap[kb.visibility]}
                </Tag>
                <Text style={{ fontSize: 12, color: '#98a2b3' }}>
                  {kb.docCount} documents | {kb.chunkCount} chunks
                </Text>
              </div>
              <div style={{ marginTop: 10 }}>
                <Text style={{ fontSize: 12, color: '#98a2b3' }}>
                  Owner: {kb.ownerName} | Updated: {kb.updatedAt}
                </Text>
              </div>
            </Card>
          </Col>
        ))}
      </Row>
      )}
      </Spin>

      <Modal
        title={editing ? 'Edit Knowledge Base' : 'New Knowledge Base'}
        open={modalOpen}
        onOk={handleSave}
        confirmLoading={saving}
        onCancel={() => setModalOpen(false)}
        okText="Save"
        cancelText="Cancel"
        destroyOnClose
      >
        <Form form={form} layout="vertical" initialValues={{ visibility: 'public' }}>
          <Form.Item name="name" label="Name" rules={[{ required: true, message: 'Please enter a knowledge base name' }]}>
            <Input placeholder="Knowledge base name" />
          </Form.Item>
          <Form.Item name="description" label="Description">
            <Input.TextArea rows={3} placeholder="Description" />
          </Form.Item>
          <Form.Item name="visibility" label="Visibility">
            <Select>
              <Select.Option value="public">Public</Select.Option>
              <Select.Option value="department">Department</Select.Option>
              <Select.Option value="private">Private</Select.Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer
        title={`Member Management - ${selectedKb?.name || ''}`}
        open={memberOpen}
        onClose={() => setMemberOpen(false)}
        width={520}
      >
        <Form form={memberForm} layout="inline" initialValues={{ accessLevel: 'read' }} style={{ marginBottom: 16 }}>
          <Form.Item name="userId" rules={[{ required: true, message: 'Please enter a user ID' }]}>
            <InputNumber placeholder="User ID" min={1} style={{ width: 120 }} />
          </Form.Item>
          <Form.Item name="accessLevel">
            <Select style={{ width: 100 }}>
              <Select.Option value="read">Read-only</Select.Option>
              <Select.Option value="write">Read/Write</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleAddMember}>Add Member</Button>
          </Form.Item>
        </Form>
        <Table
          dataSource={members}
          rowKey="userId"
          loading={memberLoading}
          columns={[
            { title: 'User ID', dataIndex: 'userId', key: 'userId', width: 80 },
            { title: 'Username', dataIndex: 'username', key: 'username' },
            { title: 'Role', dataIndex: 'roleName', key: 'roleName' },
            {
              title: 'Permission',
              dataIndex: 'accessLevel',
              key: 'accessLevel',
              render: (v: string) => (
                <Tag style={{
                  background: v === 'write' ? '#eff6ff' : '#f9fafb',
                  color: v === 'write' ? '#2563eb' : '#667085',
                  border: 'none', borderRadius: 6,
                }}>
                  {v === 'write' ? 'Read/Write' : 'Read-only'}
                </Tag>
              ),
            },
            {
              title: 'Actions',
              key: 'action',
              width: 80,
              render: (_: unknown, m: KbMember) => (
                <Button type="link" danger size="small" onClick={() => handleRemoveMember(m.userId)}>Remove</Button>
              ),
            },
          ]}
          pagination={false}
          size="small"
        />
      </Drawer>
    </PageContainer>
  )
}

export default KnowledgeBaseList
