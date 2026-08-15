import React from 'react'
import { Tag } from 'antd'
import type { DocStatus, TaskState } from '../types'

interface StatusTagProps {
  type: DocStatus | TaskState | 'Passed' | 'Not Passed' | 'active' | 'disabled'
}

const colorMap: Record<string, string> = {
  ready: '#ecfdf5',
  indexing: '#eff6ff',
  failed: '#fef2f2',
  PENDING: '#f9fafb',
  STARTED: '#eff6ff',
  PROGRESS: '#eff6ff',
  SUCCESS: '#ecfdf5',
  FAILURE: '#fef2f2',
  'Passed': '#ecfdf5',
  'Not Passed': '#fff7ed',
  active: '#ecfdf5',
  disabled: '#f2f4f7',
}

const textColorMap: Record<string, string> = {
  ready: '#16a34a',
  indexing: '#2563eb',
  failed: '#dc2626',
  PENDING: '#667085',
  STARTED: '#2563eb',
  PROGRESS: '#2563eb',
  SUCCESS: '#16a34a',
  FAILURE: '#dc2626',
  'Passed': '#16a34a',
  'Not Passed': '#d97706',
  active: '#16a34a',
  disabled: '#667085',
}

const labelMap: Record<string, string> = {
  ready: 'Ready',
  indexing: 'Indexing',
  failed: 'Failed',
  PENDING: 'Pending',
  STARTED: 'Started',
  PROGRESS: 'In Progress',
  SUCCESS: 'Success',
  FAILURE: 'Failed',
  'Passed': 'Passed',
  'Not Passed': 'Not Passed',
  active: 'Enabled',
  disabled: 'Disabled',
}

const StatusTag: React.FC<StatusTagProps> = ({ type }) => {
  return (
    <Tag
      style={{
        background: colorMap[type] || '#f9fafb',
        color: textColorMap[type] || '#667085',
        border: 'none',
        borderRadius: 6,
        padding: '2px 10px',
        fontSize: 12,
        fontWeight: 500,
      }}
    >
      {labelMap[type] || type}
    </Tag>
  )
}

export default StatusTag
