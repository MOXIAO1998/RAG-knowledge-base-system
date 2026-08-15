import React from 'react'
import { Outlet } from 'react-router-dom'
import { Layout, Typography } from 'antd'
import { FileTextOutlined } from '@ant-design/icons'
import './AuthLayout.css'

const { Text } = Typography

const AuthLayout: React.FC = () => {
  return (
    <Layout className="auth-layout">
      <div className="auth-bg">
        <div className="auth-bg-grid" />
        <div className="auth-bg-orb orb-a" />
        <div className="auth-bg-orb orb-b" />
        <div className="auth-bg-orb orb-c" />
        <div className="auth-bg-beam" />
        <div className="auth-bg-stars">
          <span /><span /><span /><span /><span /><span />
          <span /><span /><span /><span /><span /><span />
        </div>
      </div>
      <div className="auth-container">
        <div className="auth-brand">
          <div className="auth-brand-grid" />
          <div className="auth-brand-aurora aurora-1" />
          <div className="auth-brand-aurora aurora-2" />
          <div className="auth-brand-aurora aurora-3" />
          <div className="auth-brand-particles">
            <span /><span /><span /><span /><span /><span />
          </div>
          <div className="auth-brand-content">
            <div className="auth-brand-logo">
              <FileTextOutlined className="auth-brand-icon" />
            </div>
            <div className="auth-brand-title">RAG Knowledge Base</div>
            <Text className="auth-brand-desc">Enterprise-grade intelligent document Q&A platform</Text>
            <div className="auth-brand-features">
              <div className="auth-feature-item">Unified management of multiple knowledge bases</div>
              <div className="auth-feature-item">Hybrid retrieval + intelligent Q&A</div>
              <div className="auth-feature-item">Citation traceability for trustworthy answers</div>
              <div className="auth-feature-item">Enterprise-grade permissions and security</div>
            </div>
          </div>
        </div>
        <div className="auth-form-area">
          <Outlet />
        </div>
      </div>
    </Layout>
  )
}

export default AuthLayout
