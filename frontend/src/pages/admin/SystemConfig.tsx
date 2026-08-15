import React, { useEffect, useState } from 'react'
import { Card, Form, InputNumber, Button, Row, Col, App, Spin } from 'antd'
import { SaveOutlined } from '@ant-design/icons'
import PageContainer from '../../components/PageContainer'
import { adminApi } from '../../api'
import type { SystemConfigData } from '../../api'
import { ApiError } from '../../api/http'

const SystemConfig: React.FC = () => {
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const { message } = App.useApp()

  useEffect(() => {
    adminApi
      .getConfig()
      .then((cfg) => {
        form.setFieldsValue({
          ttlSeconds: cfg.cache.ttlSeconds,
          cacheSimilarityThreshold: cfg.cache.similarityThreshold,
          maxCacheSize: cfg.cache.maxCacheSize,
          ...cfg.rateLimit,
        })
      })
      .catch((e: ApiError) => message.error(e.message || 'Failed to load system configuration'))
      .finally(() => setLoading(false))
  }, [form, message])

  const handleSave = () => {
    form.validateFields().then(async (values) => {
      const payload: Partial<SystemConfigData> = {
        cache: {
          ttlSeconds: values.ttlSeconds,
          similarityThreshold: values.cacheSimilarityThreshold,
          maxCacheSize: values.maxCacheSize,
        },
        rateLimit: {
          userPerMinute: values.userPerMinute,
          qaPerMinute: values.qaPerMinute,
          uploadPerMinute: values.uploadPerMinute,
          llmConcurrency: values.llmConcurrency,
        },
      }
      setSaving(true)
      try {
        await adminApi.updateConfig(payload)
        message.success('System configuration saved')
      } catch (e) {
        message.error((e as ApiError).message || 'Save failed')
      } finally {
        setSaving(false)
      }
    })
  }

  return (
    <PageContainer title="System Configuration" breadcrumb={[{ label: 'System Management' }, { label: 'System Configuration' }]}>
      <Spin spinning={loading}>
      <Form form={form} layout="vertical">
        <Row gutter={[24, 0]}>
          <Col xs={24} lg={12}>
            <Card title="Cache Settings" style={{ borderRadius: 12, border: '1px solid #eef1f5', marginBottom: 24 }}>
              <Form.Item label="Cache TTL (seconds)" name="ttlSeconds"><InputNumber min={60} max={86400} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Semantic Cache Similarity Threshold" name="cacheSimilarityThreshold"><InputNumber min={0} max={1} step={0.05} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Max Cache Size" name="maxCacheSize"><InputNumber min={100} max={100000} style={{ width: '100%' }} /></Form.Item>
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Rate Limit Settings" style={{ borderRadius: 12, border: '1px solid #eef1f5', marginBottom: 24 }}>
              <Form.Item label="User Requests per Minute" name="userPerMinute"><InputNumber min={1} max={1000} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Q&A Requests per Minute" name="qaPerMinute"><InputNumber min={1} max={1000} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Uploads per Minute" name="uploadPerMinute"><InputNumber min={1} max={100} style={{ width: '100%' }} /></Form.Item>
              <Form.Item label="Max LLM Concurrency" name="llmConcurrency"><InputNumber min={1} max={50} style={{ width: '100%' }} /></Form.Item>
            </Card>
          </Col>
        </Row>

        <div style={{ textAlign: 'right', marginTop: -8 }}>
          <Button type="primary" icon={<SaveOutlined />} onClick={handleSave} loading={saving} size="large">Save Configuration</Button>
        </div>
      </Form>
      </Spin>
    </PageContainer>
  )
}

export default SystemConfig
