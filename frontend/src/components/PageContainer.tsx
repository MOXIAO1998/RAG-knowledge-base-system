import React from 'react'
import { Space } from 'antd'

interface PageContainerProps {
  title: string
  breadcrumb?: { label: string; path?: string }[]
  extra?: React.ReactNode
  children: React.ReactNode
}

const PageContainer: React.FC<PageContainerProps> = ({ extra, children }) => {
  return (
    <div className="app-page fade-in-up">
      {/* The top navigation already indicates the current page, so the title and breadcrumb are no longer repeated; the top-right extra is kept only when there is an action area */}
      {extra && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
          <Space>{extra}</Space>
        </div>
      )}
      {children}
    </div>
  )
}

export default PageContainer
