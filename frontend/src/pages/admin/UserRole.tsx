import React, { useEffect, useState } from 'react'
import { Table, Card, Tag, Button, Modal, Form, Input, Select, App, Typography, Tabs, Checkbox, Tooltip } from 'antd'
import { EditOutlined, SafetyCertificateOutlined, PlusOutlined } from '@ant-design/icons'
import PageContainer from '../../components/PageContainer'
import { adminApi } from '../../api'
import { ApiError } from '../../api/http'
import { getPermissionLabel, PERMISSION_GROUPS } from '../../utils/permission'
import type { User, UserStatus, Role } from '../../types'

const { Text, Title } = Typography

const UserRole: React.FC = () => {
  const [userList, setUserList] = useState<User[]>([])
  const [roleList, setRoleList] = useState<Role[]>([])
  const [loading, setLoading] = useState(true)
  const [editOpen, setEditOpen] = useState(false)
  const [selectedUser, setSelectedUser] = useState<User | null>(null)
  const [form] = Form.useForm()
  const { message } = App.useApp()

  // Role permission editing state
  const [permOpen, setPermOpen] = useState(false)
  const [selectedRole, setSelectedRole] = useState<Role | null>(null)
  const [checkedPerms, setCheckedPerms] = useState<string[]>([])

  // Add role state
  const [addOpen, setAddOpen] = useState(false)
  const [roleForm] = Form.useForm()
  const [newPerms, setNewPerms] = useState<string[]>([])

  // Add user state
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [userForm] = Form.useForm()

  const loadUsers = () => adminApi.listUsers().then(setUserList)
  const loadRoles = () => adminApi.listRoles().then(setRoleList)

  useEffect(() => {
    Promise.all([loadUsers(), loadRoles()])
      .catch((e: ApiError) => message.error(e.message || 'Failed to load data'))
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const editUser = (u: User) => {
    setSelectedUser(u)
    form.setFieldsValue({ username: u.username, email: u.email, status: u.status, roles: u.roles })
    setEditOpen(true)
  }

  const handleSave = () => {
    form.validateFields().then(async (values) => {
      if (!selectedUser) return
      try {
        // The backend only supports updating status and roles
        await adminApi.updateUser(selectedUser.id, { status: values.status, roles: values.roles })
        message.success('User information updated')
        setEditOpen(false)
        loadUsers()
      } catch (e) {
        message.error((e as ApiError).message || 'Update failed')
      }
    })
  }

  const openAddUser = () => {
    userForm.resetFields()
    setAddUserOpen(true)
  }

  const handleAddUser = () => {
    userForm.validateFields().then(async (values) => {
      try {
        await adminApi.createUser({
          username: values.username,
          email: values.email || '',
          password: values.password,
          roles: values.roles || [],
        })
        message.success(`User "${values.username}" created`)
        setAddUserOpen(false)
        loadUsers()
      } catch (e) {
        message.error((e as ApiError).message || 'Creation failed')
      }
    })
  }

  const editRolePerms = (r: Role) => {
    setSelectedRole(r)
    setCheckedPerms(r.permissions)
    setPermOpen(true)
  }

  const handleSavePerms = async () => {
    if (!selectedRole) return
    try {
      await adminApi.updateRole(selectedRole.id, { permissions: checkedPerms })
      message.success(`Permissions for "${selectedRole.name}" updated`)
      setPermOpen(false)
      loadRoles()
    } catch (e) {
      message.error((e as ApiError).message || 'Update failed')
    }
  }

  const openAddRole = () => {
    roleForm.resetFields()
    setNewPerms([])
    setAddOpen(true)
  }

  const handleAddRole = () => {
    roleForm.validateFields().then(async (values) => {
      try {
        await adminApi.createRole({
          name: (values.name as string).trim(),
          description: values.description || '',
          permissions: newPerms,
        })
        message.success(`Role "${values.name}" created`)
        setAddOpen(false)
        loadRoles()
      } catch (e) {
        message.error((e as ApiError).message || 'Creation failed')
      }
    })
  }

  const userColumns = [
    { title: 'Username', dataIndex: 'username', key: 'username', render: (v: string) => <Text strong>{v}</Text> },
    { title: 'Email', dataIndex: 'email', key: 'email' },
    {
      title: 'Status', dataIndex: 'status', key: 'status',
      render: (v: string) => (
        <Tag style={{ background: v === 'active' ? '#ecfdf5' : '#f2f4f7', color: v === 'active' ? '#16a34a' : '#667085', border: 'none', borderRadius: 6 }}>
          {v === 'active' ? 'Enabled' : 'Disabled'}
        </Tag>
      ),
    },
    {
      title: 'Roles', dataIndex: 'roles', key: 'roles',
      render: (v: string[]) => v.map((r) => <Tag key={r} style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 4, fontSize: 12 }}>{r}</Tag>),
    },
    { title: 'Last Login', dataIndex: 'lastLogin', key: 'lastLogin' },
    {
      title: 'Actions', key: 'actions',
      render: (_: unknown, r: User) => <Button type="link" icon={<EditOutlined />} onClick={() => editUser(r)} />,
    },
  ]

  return (
    <PageContainer title="Users & Roles" breadcrumb={[{ label: 'System Management' }, { label: 'Users & Roles' }]}>
      <Tabs
        items={[
          {
            key: 'users',
            label: 'User Management',
            children: (
              <Card style={{ borderRadius: 12, border: '1px solid #eef1f5' }}>
                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAddUser}>Add User</Button>
                </div>
                <Table
                  dataSource={userList.map((u) => ({ ...u, key: u.id }))}
                  columns={userColumns}
                  loading={loading}
                  pagination={{ pageSize: 15, showTotal: (t) => `${t} total` }}
                  size="middle"
                />
              </Card>
            ),
          },
          {
            key: 'roles',
            label: 'Roles & Permissions',
            children: (
              <div>
                <div style={{ marginBottom: 16, textAlign: 'right' }}>
                  <Button type="primary" icon={<PlusOutlined />} onClick={openAddRole}>
                    Add Role
                  </Button>
                </div>
                {roleList.map((r) => (
                  <Card key={r.id} style={{ borderRadius: 12, border: '1px solid #eef1f5', marginBottom: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <Title level={5} style={{ marginBottom: 4 }}>{r.name}</Title>
                        <Text style={{ color: '#667085', fontSize: 13, display: 'block', marginBottom: 12 }}>{r.description}</Text>
                      </div>
                      <Button icon={<SafetyCertificateOutlined />} onClick={() => editRolePerms(r)}>
                        Edit Permissions
                      </Button>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {r.permissions.map((p) => (
                        <Tooltip key={p} title={p}>
                          <Tag style={{ background: '#eff6ff', color: '#2563eb', border: 'none', borderRadius: 4, fontSize: 12 }}>{getPermissionLabel(p)}</Tag>
                        </Tooltip>
                      ))}
                    </div>
                  </Card>
                ))}
              </div>
            ),
          },
        ]}
      />

      <Modal
        title={`Edit User - ${selectedUser?.username || ''}`}
        open={editOpen}
        onOk={handleSave}
        onCancel={() => setEditOpen(false)}
        okText="Save"
        cancelText="Cancel"
        destroyOnClose
      >
        <Form form={form} layout="vertical">
          <Form.Item name="username" label="Username">
            <Input disabled />
          </Form.Item>
          <Form.Item name="email" label="Email">
            <Input disabled placeholder="Email" />
          </Form.Item>
          <Form.Item name="status" label="Status" rules={[{ required: true, message: 'Please select a status' }]}>
            <Select<UserStatus>
              options={[
                { label: 'Enabled', value: 'active' },
                { label: 'Disabled', value: 'disabled' },
              ]}
            />
          </Form.Item>
          <Form.Item name="roles" label="Roles" rules={[{ required: true, message: 'Please select a role' }]}>
            <Select mode="multiple" options={roleList.map((r) => ({ label: r.name, value: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Add User"
        open={addUserOpen}
        onOk={handleAddUser}
        onCancel={() => setAddUserOpen(false)}
        okText="Create"
        cancelText="Cancel"
        destroyOnClose
      >
        <Form form={userForm} layout="vertical">
          <Form.Item name="username" label="Username" rules={[{ required: true, min: 2, message: 'Please enter a username (at least 2 characters)' }]}>
            <Input placeholder="Username" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Please enter a valid email' }]}>
            <Input placeholder="Email (optional)" />
          </Form.Item>
          <Form.Item name="password" label="Initial Password" rules={[{ required: true, message: 'Please enter an initial password' }]}>
            <Input.Password placeholder="Initial password" />
          </Form.Item>
          <Form.Item name="roles" label="Roles">
            <Select mode="multiple" placeholder="Assign roles" options={roleList.map((r) => ({ label: r.name, value: r.name }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={`Edit Permissions - ${selectedRole?.name || ''}`}
        open={permOpen}
        onOk={handleSavePerms}
        onCancel={() => setPermOpen(false)}
        okText="Save"
        cancelText="Cancel"
        destroyOnClose
        width={520}
      >
        <Text style={{ color: '#667085', fontSize: 13, display: 'block', marginBottom: 16 }}>
          Select the permissions granted to this role. Hover to view the corresponding permission code.
        </Text>
        {PERMISSION_GROUPS.map((g) => (
          <div key={g.group} style={{ marginBottom: 16 }}>
            <Text strong style={{ display: 'block', marginBottom: 8 }}>{g.group}</Text>
            <Checkbox.Group
              value={checkedPerms.filter((p) => g.items.includes(p))}
              onChange={(vals) => {
                const others = checkedPerms.filter((p) => !g.items.includes(p))
                setCheckedPerms([...others, ...(vals as string[])])
              }}
              options={g.items.map((p) => ({ label: getPermissionLabel(p), value: p }))}
            />
          </div>
        ))}
      </Modal>

      <Modal
        title="Add Role"
        open={addOpen}
        onOk={handleAddRole}
        onCancel={() => setAddOpen(false)}
        okText="Create"
        cancelText="Cancel"
        destroyOnClose
        width={520}
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item name="name" label="Role Name" rules={[{ required: true, message: 'Please enter a role name' }]}>
            <Input placeholder="e.g. Evaluator" />
          </Form.Item>
          <Form.Item name="description" label="Role Description">
            <Input.TextArea rows={2} placeholder="Briefly describe the responsibilities of this role" />
          </Form.Item>
        </Form>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>Permission Assignment</Text>
        {PERMISSION_GROUPS.map((g) => (
          <div key={g.group} style={{ marginBottom: 16 }}>
            <Text style={{ color: '#667085', fontSize: 13, display: 'block', marginBottom: 8 }}>{g.group}</Text>
            <Checkbox.Group
              value={newPerms.filter((p) => g.items.includes(p))}
              onChange={(vals) => {
                const others = newPerms.filter((p) => !g.items.includes(p))
                setNewPerms([...others, ...(vals as string[])])
              }}
              options={g.items.map((p) => ({ label: getPermissionLabel(p), value: p }))}
            />
          </div>
        ))}
      </Modal>
    </PageContainer>
  )
}

export default UserRole
