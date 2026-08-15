import type { AuditLog } from '../types'

export const auditLogs: AuditLog[] = [
  { id: 1, username: 'admin', action: 'User Login', resource: '/api/auth/login', ip: '192.168.1.100', createdAt: '2026-07-24 11:00:00' },
  { id: 2, username: 'zhangsan', action: 'Document Upload', resource: '/api/kb/1/documents', ip: '192.168.1.101', createdAt: '2026-07-24 09:00:00' },
  { id: 3, username: 'admin', action: 'Create Knowledge Base', resource: '/api/kb', ip: '192.168.1.100', createdAt: '2026-07-23 14:00:00' },
  { id: 4, username: 'wangwu', action: 'Delete Document', resource: '/api/documents/108', ip: '192.168.1.102', createdAt: '2026-07-24 08:05:00' },
  { id: 5, username: 'zhangsan', action: 'Permission Change', resource: '/api/kb/1/members', ip: '192.168.1.101', createdAt: '2026-07-23 15:30:00' },
  { id: 6, username: 'lisi', action: 'Q&A Request', resource: '/api/qa/stream', ip: '192.168.1.103', createdAt: '2026-07-24 10:29:00' },
  { id: 7, username: 'sunqi', action: 'View Document', resource: '/api/kb/5/documents', ip: '192.168.1.104', createdAt: '2026-07-24 10:00:00' },
  { id: 8, username: 'admin', action: 'System Configuration Change', resource: '/api/admin/config', ip: '192.168.1.100', createdAt: '2026-07-22 16:00:00' },
  { id: 9, username: 'zhouba', action: 'User Login', resource: '/api/auth/login', ip: '192.168.1.105', createdAt: '2026-07-24 11:10:00' },
  { id: 10, username: 'wangwu', action: 'Reindex', resource: '/api/documents/201/reindex', ip: '192.168.1.102', createdAt: '2026-07-23 10:00:00' },
  { id: 11, username: 'lisi', action: 'Q&A Request', resource: '/api/qa/stream', ip: '192.168.1.103', createdAt: '2026-07-24 10:30:00' },
  { id: 12, username: 'zhangsan', action: 'Evaluation Triggered', resource: '/api/eval/runs', ip: '192.168.1.101', createdAt: '2026-07-24 11:00:00' },
]
