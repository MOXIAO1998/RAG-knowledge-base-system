import { Suspense, lazy } from 'react'
import type { ReactNode } from 'react'
import { createBrowserRouter } from 'react-router-dom'
import { Spin, Result, Button } from 'antd'
import MainLayout from './layouts/MainLayout'
import AuthLayout from './layouts/AuthLayout'
import RequireAuth from './components/RequireAuth'
import Login from './pages/auth/Login'
import Register from './pages/auth/Register'

// Lazy-load feature pages to reduce the initial bundle size
const Dashboard = lazy(() => import('./pages/dashboard/Dashboard'))
const KnowledgeBaseList = lazy(() => import('./pages/kb/KnowledgeBaseList'))
const DocumentList = lazy(() => import('./pages/document/DocumentList'))
const ChatPage = lazy(() => import('./pages/qa/ChatPage'))
const ConversationHistory = lazy(() => import('./pages/conversation/ConversationHistory'))
const UserRole = lazy(() => import('./pages/admin/UserRole'))
const AuditLog = lazy(() => import('./pages/admin/AuditLog'))
const SystemConfig = lazy(() => import('./pages/admin/SystemConfig'))
const TaskCenter = lazy(() => import('./pages/admin/TaskCenter'))

/** Unified loading state for lazy-loaded pages */
const withSuspense = (node: ReactNode) => (
  <Suspense
    fallback={
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <Spin size="large" />
      </div>
    }
  >
    {node}
  </Suspense>
)

const NotFound = () => (
  <Result
    status="404"
    title="404"
    subTitle="Sorry, the page you visited does not exist."
    extra={
      <Button type="primary" onClick={() => (window.location.href = '/')}>
        Back to Home
      </Button>
    }
  />
)

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <AuthLayout />,
    children: [{ index: true, element: <Login /> }],
  },
  {
    path: '/register',
    element: <AuthLayout />,
    children: [{ index: true, element: <Register /> }],
  },
  {
    path: '/',
    // Unified auth guard: redirects to /login when not logged in, protecting all feature pages
    element: (
      <RequireAuth>
        <MainLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: withSuspense(<Dashboard />) },
      { path: 'kb', element: withSuspense(<KnowledgeBaseList />) },
      { path: 'documents', element: withSuspense(<DocumentList />) },
      { path: 'qa', element: withSuspense(<ChatPage />) },
      { path: 'conversations', element: withSuspense(<ConversationHistory />) },
      { path: 'admin/users', element: <RequireAuth permission="admin">{withSuspense(<UserRole />)}</RequireAuth> },
      { path: 'admin/audit', element: <RequireAuth permission="admin">{withSuspense(<AuditLog />)}</RequireAuth> },
      { path: 'admin/config', element: <RequireAuth permission="admin">{withSuspense(<SystemConfig />)}</RequireAuth> },
      { path: 'admin/tasks', element: <RequireAuth permission="admin">{withSuspense(<TaskCenter />)}</RequireAuth> },
    ],
  },
  { path: '*', element: <NotFound /> },
])
