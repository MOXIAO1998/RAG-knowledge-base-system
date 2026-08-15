import React, { useEffect, useState } from 'react'
import { Table, Card, Progress, Button, App } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import PageContainer from '../../components/PageContainer'
import StatusTag from '../../components/StatusTag'
import { taskApi } from '../../api'
import { ApiError } from '../../api/http'
import type { TaskItem } from '../../types'

const TaskCenter: React.FC = () => {
  const [tasks, setTasks] = useState<TaskItem[]>([])
  const [loading, setLoading] = useState(true)
  const { message } = App.useApp()

  const load = () => {
    setLoading(true)
    taskApi
      .list()
      .then(setTasks)
      .catch((e: ApiError) => message.error(e.message || 'Failed to load tasks'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRetry = async (taskId: string) => {
    try {
      await taskApi.retry(taskId)
      message.success('Task resubmitted')
      load()
    } catch (e) {
      message.error((e as ApiError).message || 'Retry failed')
    }
  }

  const columns = [
    { title: 'Task ID', dataIndex: 'taskId', key: 'taskId', width: 150, render: (v: string) => <code style={{ fontSize: 12, background: '#f9fafb', padding: '2px 6px', borderRadius: 4 }}>{v}</code> },
    { title: 'Type', dataIndex: 'type', key: 'type', width: 100 },
    { title: 'Target', dataIndex: 'target', key: 'target' },
    { title: 'Status', dataIndex: 'state', key: 'state', width: 90, render: (v: TaskItem['state']) => <StatusTag type={v} /> },
    {
      title: 'Progress', dataIndex: 'progress', key: 'progress', width: 150,
      render: (p: number) => <Progress percent={p} size="small" />,
    },
    { title: 'Retries', dataIndex: 'retryCount', key: 'retryCount', width: 60 },
    { title: 'Message', dataIndex: 'message', key: 'message', width: 200, ellipsis: true },
    { title: 'Created At', dataIndex: 'createdAt', key: 'createdAt', width: 170 },
    {
      title: 'Actions', key: 'actions', width: 90, fixed: 'right' as const,
      render: (_: unknown, r: TaskItem) =>
        r.state === 'FAILURE' ? (
          <Button type="link" size="small" icon={<ReloadOutlined />} onClick={() => handleRetry(r.taskId)}>Retry</Button>
        ) : null,
    },
  ]

  return (
    <PageContainer title="Task Center" breadcrumb={[{ label: 'System Management' }, { label: 'Task Center' }]} extra={
      <Button icon={<ReloadOutlined />} onClick={load}>Refresh</Button>
    }>
      <Card style={{ borderRadius: 12, border: '1px solid #eef1f5' }}>
        <Table
          dataSource={tasks.map((t) => ({ ...t, key: t.taskId }))}
          columns={columns}
          loading={loading}
          pagination={{ pageSize: 15, showTotal: (t) => `${t} total` }}
          size="middle"
          scroll={{ x: 1200 }}
        />
      </Card>
    </PageContainer>
  )
}

export default TaskCenter
