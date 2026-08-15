import React from 'react'
import { Result, Button } from 'antd'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

/** Global error boundary: catches render-time exceptions to avoid a blank page */
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // In production this can be reported to a monitoring platform
    console.error('Page render error:', error, info)
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined })
    window.location.href = '/'
  }

  render() {
    if (this.state.hasError) {
      return (
        <Result
          status="500"
          title="Something Went Wrong"
          subTitle={this.state.error?.message || 'Sorry, an unexpected error occurred on this page.'}
          extra={
            <Button type="primary" onClick={this.handleReset}>
              Back to Home
            </Button>
          }
        />
      )
    }
    return this.props.children
  }
}

export default ErrorBoundary
