import React, { useState, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Table, Select, Button, Upload, Modal, Form, Progress, Drawer, App, Typography,
  Tooltip, Space, Tag,
} from 'antd'
import type { UploadFile } from 'antd'
import {
  UploadOutlined, ReloadOutlined, DeleteOutlined, EyeOutlined,
  FilterOutlined,
} from '@ant-design/icons'
import PageContainer from '../../components/PageContainer'
import StatusTag from '../../components/StatusTag'
import { kbApi, docApi } from '../../api'
import { ApiError } from '../../api/http'
import { hasPermission } from '../../utils/permission'
import type { DocumentItem, KnowledgeBase, Chunk } from '../../types'

const { Text } = Typography

const fileTypeColors: Record<string, string> = {
  PDF: '#fef2f2',
  Word: '#eff6ff',
  Markdown: '#ecfdf5',
  TXT: '#f9fafb',
  HTML: '#fff7ed',
}

const DocumentList: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams()
  const [kbs, setKbs] = useState<KnowledgeBase[]>([])
  const [docs, setDocs] = useState<DocumentItem[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedKb, setSelectedKb] = useState<number | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [fileList, setFileList] = useState<UploadFile[]>([])
  const [chunkOpen, setChunkOpen] = useState(false)
  const [selectedDoc, setSelectedDoc] = useState<DocumentItem | null>(null)
  const [chunks, setChunks] = useState<Chunk[]>([])
  const [chunkLoading, setChunkLoading] = useState(false)
  const { message, modal } = App.useApp()
  const canUpload = hasPermission('document:upload')
  const canManage = hasPermission('document:manage')
  const timersRef = useRef<ReturnType<typeof setInterval>[]>([])

  useEffect(() => {
    kbApi.list().then(setKbs).catch(() => {})
    const kbIdParam = searchParams.get('kbId')
    if (kbIdParam) setSelectedKb(Number(kbIdParam))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const loadDocs = (kbId: number | null) => {
    setLoading(true)
    docApi
      .list(kbId ?? undefined)
      .then(setDocs)
      .catch((e: ApiError) => message.error(e.message || 'Failed to load documents'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadDocs(selectedKb)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedKb])

  useEffect(() => {
    return () => {
      timersRef.current.forEach((t) => clearInterval(t))
      timersRef.current = []
    }
  }, [])

  /** Poll a single document's indexing progress until ready/failed */
  const pollDoc = (docId: number) => {
    const timer = setInterval(async () => {
      try {
        const d = await docApi.get(docId)
        setDocs((prev) => prev.map((x) => (x.id === docId ? d : x)))
        if (d.status !== 'indexing') {
          clearInterval(timer)
          timersRef.current = timersRef.current.filter((t) => t !== timer)
        }
      } catch {
        clearInterval(timer)
      }
    }, 1200)
    timersRef.current.push(timer)
  }

  const handleUpload = async () => {
    if (!selectedKb) {
      message.warning('Please select a knowledge base first')
      return
    }
    const file = fileList[0]?.originFileObj
    if (!file) {
      message.warning('Please select a file')
      return
    }
    setUploading(true)
    try {
      const { document } = await docApi.upload(selectedKb, file as File)
      setUploadOpen(false)
      setFileList([])
      message.success('Document submitted for indexing')
      setDocs((prev) => [document, ...prev])
      pollDoc(document.id)
    } catch (e) {
      message.error((e as ApiError).message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const handleReindex = async (doc: DocumentItem) => {
    try {
      await docApi.reindex(doc.id)
      message.info('Reindex triggered')
      setDocs((prev) => prev.map((d) => (d.id === doc.id ? { ...d, status: 'indexing', progress: 0 } : d)))
      pollDoc(doc.id)
    } catch (e) {
      message.error((e as ApiError).message || 'Reindex failed')
    }
  }

  const handleDelete = (doc: DocumentItem) => {
    modal.confirm({
      title: 'Confirm Deletion',
      content: `Are you sure you want to delete the document "${doc.title}"? Its index data will also be deleted.`,
      okText: 'Confirm Delete',
      okButtonProps: { danger: true },
      onOk: async () => {
        try {
          await docApi.remove(doc.id)
          message.success('Document deleted')
          setDocs((prev) => prev.filter((d) => d.id !== doc.id))
        } catch (e) {
          message.error((e as ApiError).message || 'Failed to delete')
        }
      },
    })
  }

  const viewChunks = (doc: DocumentItem) => {
    setSelectedDoc(doc)
    setChunkOpen(true)
    setChunkLoading(true)
    docApi
      .chunks(doc.id)
      .then(setChunks)
      .catch((e: ApiError) => message.error(e.message || 'Failed to load chunks'))
      .finally(() => setChunkLoading(false))
  }

  const columns = [
    { title: 'Document Title', dataIndex: 'title', key: 'title', width: 220, render: (v: string) => <Text strong style={{ fontSize: 13 }}>{v}</Text> },
    {
      title: 'Type', dataIndex: 'fileType', key: 'fileType', width: 90,
      render: (v: string) => (
        <Tag style={{ background: fileTypeColors[v] || '#f9fafb', color: '#475467', border: 'none', borderRadius: 4, fontSize: 12 }}>{v}</Tag>
      ),
    },
    { title: 'Status', dataIndex: 'status', key: 'status', width: 100, render: (v: DocumentItem['status']) => <StatusTag type={v} /> },
    {
      title: 'Progress', dataIndex: 'progress', key: 'progress', width: 120,
      render: (p: number | undefined, r: DocumentItem) =>
        r.status === 'indexing' ? <Progress percent={p || 0} size="small" /> : <Text style={{ color: '#667085', fontSize: 12 }}>--</Text>,
    },
    { title: 'Chunks', dataIndex: 'chunkCount', key: 'chunkCount', width: 70 },
    { title: 'Size', dataIndex: 'sizeKb', key: 'sizeKb', width: 80, render: (v: number) => `${(v / 1024).toFixed(1)} MB` },
    { title: 'Updated', dataIndex: 'updatedAt', key: 'updatedAt', width: 170 },
    {
      title: 'Actions', key: 'actions', width: 180,
      render: (_: unknown, r: DocumentItem) => (
        <Space size={0}>
          <Tooltip title="View Chunks"><Button type="link" size="small" icon={<EyeOutlined />} onClick={() => viewChunks(r)} /></Tooltip>
          {canManage && <Tooltip title="Reindex"><Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleReindex(r)} /></Tooltip>}
          {canManage && <Tooltip title="Delete"><Button type="link" size="small" danger icon={<DeleteOutlined />} onClick={() => handleDelete(r)} /></Tooltip>}
        </Space>
      ),
    },
  ]

  return (
    <PageContainer title="Document Management" breadcrumb={[{ label: 'Document Management' }]} extra={
      canUpload ? (
        <Button type="primary" icon={<UploadOutlined />} onClick={() => setUploadOpen(true)} disabled={!selectedKb}>
          Upload Document
        </Button>
      ) : null
    }>
      <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center' }}>
        <FilterOutlined style={{ color: '#667085' }} />
        <Text style={{ fontSize: 13, color: '#667085' }}>Knowledge Base:</Text>
        <Select
          style={{ width: 240 }}
          placeholder="All Knowledge Bases"
          allowClear
          value={selectedKb}
          onChange={(v) => {
            setSelectedKb(v || null)
            if (v) {
              setSearchParams({ kbId: String(v) })
            } else {
              setSearchParams({})
            }
          }}
          options={kbs.map((k) => ({ label: k.name, value: k.id }))}
        />
      </div>

      <Table
        dataSource={docs}
        columns={columns}
        rowKey="id"
        size="middle"
        loading={loading}
        pagination={{ pageSize: 15, showTotal: (t) => `${t} total` }}
        scroll={{ x: 1200 }}
      />

      <Modal title="Upload Document" open={uploadOpen} onOk={handleUpload} confirmLoading={uploading} onCancel={() => setUploadOpen(false)} okText="Upload" cancelText="Cancel" destroyOnClose>
        <Form layout="vertical">
          <Form.Item label="Select File" required>
            <Upload
              maxCount={1}
              fileList={fileList}
              beforeUpload={() => false}
              onChange={({ fileList: fl }) => setFileList(fl)}
            >
              <Button icon={<UploadOutlined />}>Select File</Button>
            </Upload>
            <Text style={{ fontSize: 12, color: '#98a2b3' }}>Supports PDF / Word / Markdown / TXT / HTML</Text>
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title={`Document Chunks - ${selectedDoc?.title || ''}`} open={chunkOpen} onClose={() => setChunkOpen(false)} width={640}>
        <Table
          dataSource={chunks}
          rowKey="id"
          loading={chunkLoading}
          columns={[
            { title: 'No.', dataIndex: 'chunkIndex', key: 'chunkIndex', width: 50 },
            { title: 'Title Path', dataIndex: 'titlePath', key: 'titlePath', width: 120, ellipsis: true },
            { title: 'Content Preview', dataIndex: 'content', key: 'content', ellipsis: true },
            { title: 'Page', dataIndex: 'sourcePage', key: 'sourcePage', width: 60 },
          ]}
          pagination={false}
          size="small"
        />
      </Drawer>
    </PageContainer>
  )
}

export default DocumentList
