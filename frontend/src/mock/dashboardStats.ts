// Mock data source for the dashboard runtime metrics
// Note: metrics such as today's Q&A count and cache hit rate rely on real-time backend statistics; this file simulates them during the mock phase.
// When connecting to the backend, replace with the result returned by GET /api/dashboard/stats.
export interface DashboardStats {
  /** Number of Q&As today */
  todayQAs: number
  /** Semantic cache hit rate (0-1) */
  cacheHitRate: number
}

export const dashboardStats: DashboardStats = {
  todayQAs: 28,
  cacheHitRate: 0.725,
}
