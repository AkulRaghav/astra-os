export interface AnalyticsEvent {
  id: string;
  userId: string;
  eventType: string;
  eventData: Record<string, unknown>;
  sessionId: string;
  timestamp: string;
  source: string;
}

export interface AnalyticsSummary {
  totalVisitors: number;
  totalSessions: number;
  bounceRate: number;
  avgSessionDuration: number;
  topPages: PageView[];
  userLocations: LocationData[];
  dailyActiveUsers: DailyMetric[];
}

export interface PageView {
  path: string;
  views: number;
  uniqueViews: number;
}

export interface LocationData {
  country: string;
  count: number;
  percentage: number;
}

export interface DailyMetric {
  date: string;
  value: number;
}
