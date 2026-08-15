import type { ThemeConfig } from 'antd'

// Glassmorphism tech theme: light background + blue-cyan gradient accents, translucent containers, glowing shadows, large border radius
export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: '#2563eb',
    colorInfo: '#0ea5e9',
    colorSuccess: '#16a34a',
    colorWarning: '#d97706',
    colorError: '#dc2626',
    colorBgLayout: 'transparent',
    colorBgContainer: 'rgba(255, 255, 255, 0.85)',
    colorBorderSecondary: 'rgba(37, 99, 235, 0.12)',
    borderRadius: 10,
    fontSize: 14,
    fontFamily:
      "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'PingFang SC', 'Microsoft YaHei', sans-serif",
    controlHeight: 36,
    boxShadowSecondary: '0 8px 32px rgba(16, 52, 120, 0.10)',
  },
  components: {
    Layout: {
      headerBg: 'rgba(255, 255, 255, 0.65)',
      headerHeight: 60,
      headerPadding: '0 24px',
      bodyBg: 'transparent',
    },
    Menu: {
      horizontalItemSelectedColor: '#2563eb',
      itemSelectedBg: '#eef4ff',
      itemSelectedColor: '#2563eb',
      itemHoverColor: '#2563eb',
    },
    Card: {
      borderRadiusLG: 16,
    },
    Table: {
      headerBg: '#fafbfc',
      headerColor: '#475467',
      borderColor: '#eef1f5',
    },
    Button: {
      primaryShadow: 'none',
    },
  },
}
