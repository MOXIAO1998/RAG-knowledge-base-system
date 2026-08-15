import React from 'react'
import { Card, Typography } from 'antd'

const { Text } = Typography

interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  color: string
  bgColor: string
}

const StatCard: React.FC<StatCardProps> = ({ icon, label, value, color, bgColor }) => {
  return (
    <Card className="hover-lift">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div
          style={{
            width: 46,
            height: 46,
            borderRadius: 12,
            background: bgColor,
            color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            fontSize: 21,
            boxShadow: `0 6px 18px ${bgColor}`,
          }}
        >
          {icon}
        </div>
        <div>
          <Text style={{ fontSize: 13, color: '#667085', display: 'block', marginBottom: 4 }}>
            {label}
          </Text>
          <Text
            className="gradient-text"
            style={{ fontSize: 27, fontWeight: 800, letterSpacing: 0.3 }}
          >
            {value}
          </Text>
        </div>
      </div>
    </Card>
  )
}

export default StatCard
