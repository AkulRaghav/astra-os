package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type AnalyticsService struct {
	db *pgxpool.Pool
}

func NewAnalyticsService(db *pgxpool.Pool) *AnalyticsService {
	return &AnalyticsService{db: db}
}

type AnalyticsEvent struct {
	ID        string                 `json:"id"`
	UserID    *string                `json:"user_id,omitempty"`
	EventType string                 `json:"event_type"`
	EventData map[string]interface{} `json:"event_data"`
	SessionID string                 `json:"session_id"`
	Source    string                 `json:"source"`
	Timestamp time.Time             `json:"timestamp"`
}

type AnalyticsSummary struct {
	TotalVisitors      int            `json:"total_visitors"`
	TotalSessions      int            `json:"total_sessions"`
	BounceRate         float64        `json:"bounce_rate"`
	AvgSessionDuration float64        `json:"avg_session_duration"`
	TopPages           []PageView     `json:"top_pages"`
	DailyActiveUsers   []DailyMetric  `json:"daily_active_users"`
}

type PageView struct {
	Path  string `json:"path"`
	Views int    `json:"views"`
}

type DailyMetric struct {
	Date  string `json:"date"`
	Value int    `json:"value"`
}

type IngestEventInput struct {
	UserID    *string
	EventType string
	EventData map[string]interface{}
	SessionID string
	Source    string
	IPAddress string
	UserAgent string
}

func (s *AnalyticsService) IngestEvent(ctx context.Context, input IngestEventInput) error {
	id := uuid.New().String()

	_, err := s.db.Exec(ctx,
		`INSERT INTO analytics_events (id, user_id, event_type, event_data, session_id, source, ip_address, user_agent, timestamp)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
		id, input.UserID, input.EventType, input.EventData, input.SessionID, input.Source, input.IPAddress, input.UserAgent, time.Now())
	if err != nil {
		return fmt.Errorf("ingest event: %w", err)
	}
	return nil
}

func (s *AnalyticsService) GetSummary(ctx context.Context, userID string, period string) (*AnalyticsSummary, error) {
	// Determine time range
	var since time.Time
	now := time.Now()
	switch period {
	case "DAY":
		since = now.Add(-24 * time.Hour)
	case "WEEK":
		since = now.Add(-7 * 24 * time.Hour)
	case "MONTH":
		since = now.Add(-30 * 24 * time.Hour)
	case "YEAR":
		since = now.Add(-365 * 24 * time.Hour)
	default:
		since = now.Add(-30 * 24 * time.Hour)
	}

	summary := &AnalyticsSummary{}

	// Total unique visitors
	s.db.QueryRow(ctx,
		`SELECT COUNT(DISTINCT COALESCE(user_id::text, ip_address)) FROM analytics_events WHERE timestamp >= $1`,
		since).Scan(&summary.TotalVisitors)

	// Total sessions
	s.db.QueryRow(ctx,
		`SELECT COUNT(DISTINCT session_id) FROM analytics_events WHERE timestamp >= $1`,
		since).Scan(&summary.TotalSessions)

	// Bounce rate (sessions with only 1 event)
	var singleEventSessions int
	s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM (
			SELECT session_id FROM analytics_events WHERE timestamp >= $1
			GROUP BY session_id HAVING COUNT(*) = 1
		) t`, since).Scan(&singleEventSessions)
	if summary.TotalSessions > 0 {
		summary.BounceRate = float64(singleEventSessions) / float64(summary.TotalSessions) * 100
	}

	// Top pages
	rows, err := s.db.Query(ctx,
		`SELECT event_data->>'path' as path, COUNT(*) as views
		 FROM analytics_events
		 WHERE timestamp >= $1 AND event_type = 'page_view' AND event_data->>'path' IS NOT NULL
		 GROUP BY path ORDER BY views DESC LIMIT 10`, since)
	if err == nil {
		defer rows.Close()
		for rows.Next() {
			var pv PageView
			rows.Scan(&pv.Path, &pv.Views)
			summary.TopPages = append(summary.TopPages, pv)
		}
	}
	if summary.TopPages == nil {
		summary.TopPages = []PageView{}
	}

	// Daily active users
	dauRows, err := s.db.Query(ctx,
		`SELECT DATE(timestamp) as date, COUNT(DISTINCT user_id) as dau
		 FROM analytics_events
		 WHERE timestamp >= $1 AND user_id IS NOT NULL
		 GROUP BY DATE(timestamp) ORDER BY date`, since)
	if err == nil {
		defer dauRows.Close()
		for dauRows.Next() {
			var dm DailyMetric
			var d time.Time
			dauRows.Scan(&d, &dm.Value)
			dm.Date = d.Format("2006-01-02")
			summary.DailyActiveUsers = append(summary.DailyActiveUsers, dm)
		}
	}
	if summary.DailyActiveUsers == nil {
		summary.DailyActiveUsers = []DailyMetric{}
	}

	return summary, nil
}
