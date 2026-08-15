import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Form, Input, Button, Typography, App } from 'antd'
import { UserOutlined, LockOutlined, MailOutlined } from '@ant-design/icons'
import { authApi } from '../../api'
import { ApiError } from '../../api/http'

const { Text } = Typography

const Register: React.FC = () => {
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { message } = App.useApp()

  const onFinish = async (values: { username: string; email: string; password: string; confirm: string }) => {
    if (values.password !== values.confirm) {
      message.error('The two passwords do not match')
      return
    }
    setLoading(true)
    try {
      await authApi.register(values.username, values.email, values.password)
      message.success('Registration successful, you are now signed in!')
      navigate('/')
    } catch (e) {
      const err = e as ApiError
      message.error(err.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <Text className="auth-form-title">Sign Up</Text>
      <div className="auth-form-subtitle">Create your enterprise knowledge base account</div>
      <Form layout="vertical" onFinish={onFinish} size="large">
        <Form.Item name="username" rules={[{ required: true, message: 'Please enter a username' }]}>
          <Input prefix={<UserOutlined style={{ color: '#667085' }} />} placeholder="Username" />
        </Form.Item>
        <Form.Item name="email" rules={[{ required: true, type: 'email', message: 'Please enter a valid email' }]}>
          <Input prefix={<MailOutlined style={{ color: '#667085' }} />} placeholder="Email" />
        </Form.Item>
        <Form.Item name="password" rules={[{ required: true, min: 6, message: 'Password must be at least 6 characters' }]}>
          <Input.Password prefix={<LockOutlined style={{ color: '#667085' }} />} placeholder="Password" />
        </Form.Item>
        <Form.Item name="confirm" rules={[{ required: true, message: 'Please confirm your password' }]}>
          <Input.Password prefix={<LockOutlined style={{ color: '#667085' }} />} placeholder="Confirm password" />
        </Form.Item>
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={loading} block>
            Sign Up
          </Button>
        </Form.Item>
        <div style={{ textAlign: 'center' }}>
          <Text style={{ color: '#667085', fontSize: 13 }}>
            Already have an account?
            <Link to="/login" style={{ color: '#2563eb', marginLeft: 4 }}>
              Sign in now
            </Link>
          </Text>
        </div>
      </Form>
    </div>
  )
}

export default Register
