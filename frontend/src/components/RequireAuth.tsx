import React from 'react'
import { Navigate } from 'react-router-dom'
import { Result, Button } from 'antd'
import { getCurrentUser } from '../api/session'
import { hasPermission } from '../utils/permission'

interface RequireAuthProps {
  /** Required permission; if omitted, only checks whether the user is logged in */
  permission?: string
  children: React.ReactNode
}

/** Route-level permission guard: shows a 403 page when access is denied */
const RequireAuth: React.FC<RequireAuthProps> = ({ permission, children }) => {
  const user = getCurrentUser()

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (permission && !hasPermission(permission)) {
    return (
      <Result
        status="403"
        title="403"
        subTitle="Sorry, you do not have permission to access this page."
        extra={
          <Button type="primary" onClick={() => window.history.back()}>
            Go Back
          </Button>
        }
      />
    )
  }

  return <>{children}</>
}

export default RequireAuth
