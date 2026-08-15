import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Form, Input, Button, Checkbox, Typography, App } from 'antd'
import { UserOutlined, LockOutlined } from '@ant-design/icons'
import { authApi } from '../../api'
import { ApiError } from '../../api/http'

const { Text } = Typography

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { message } = App.useApp()

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true)
    try {
      const user = await authApi.login(values.username, values.password)
      message.success(`Welcome back, ${user.username}!`)
      navigate('/')
    } catch (e) {
      const err = e as ApiError
      message.error(err.message || 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Text className="auth-form-title">Sign In</Text>
      <div className="auth-form-subtitle">Enter your account and password to sign in</div>
      <Form layout="vertical" onFinish={onFinish} size="large" initialValues={{ username: 'admin' }}>
        <Form.Item name="username" rules={[{ required: true, message: 'Please enter your username' }]}>
          <Input prefix={<UserOutlined style={{ color: '#667085' }} />} placeholder="Username" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, message: 'Please enter your password' }]}>
          <Input.Password prefix={<LockOutlined style={{ color: '#667085' }} />} placeholder="Password" />
        </Form.Item>
        <Form.Item>
          <Checkbox>Remember me</Checkbox>
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Sign In
          </Button>
        </Form.Item>
      </Form>
    </div>
  )
}

export default Login
