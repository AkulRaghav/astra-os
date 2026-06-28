package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/redis/go-redis/v9"
)

type NotificationsService struct {
	db    *pgxpool.Pool
	redis *redis.Client
}

func NewNotificationsService(db *pgxpool.Pool, redis *redis.Client) *NotificationsService {
	return &NotificationsService{db: db, redis: redis}
}

type Notification struct {
	ID        string          `json:"id"`
	UserID    string          `json:"user_id"`
	Type      string          `json:"type"`
	Title     string          `json:"title"`
	Message   string          `json:"message"`
	ActionURL *string         `json:"action_url,omitempty"`
	IsRead    bool            `json:"is_read"`
	Metadata  json.RawMessage `json:"metadata,omitempty"`
	CreatedAt time.Time       `json:"created_at"`
}

type CreateNotificationInput struct {
	UserID    string
	Type      string
	Title     string
	Message   string
	ActionURL *string
	Metadata  map[string]interface{}
}

func (s *NotificationsService) ListNotifications(ctx context.Context, userID string, unreadOnly bool) ([]Notification, error) {
	query := `SELECT id, user_id, type, title, message, action_url, is_read, metadata, created_at
		 FROM notifications WHERE user_id = $1`
	if unreadOnly {
		query += " AND is_read = false"
	}
	query += " ORDER BY created_at DESC LIMIT 100"

	rows, err := s.db.Query(ctx, query, userID)
	if err != nil {
		return nil, fmt.Errorf("list notifications: %w", err)
	}
	defer rows.Close()

	return scanNotifications(rows)
}

func (s *NotificationsService) GetUnreadCount(ctx context.Context, userID string) (int, error) {
	var count int
	err := s.db.QueryRow(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = false`, userID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("count notifications: %w", err)
	}
	return count, nil
}

func (s *NotificationsService) Create(ctx context.Context, input CreateNotificationInput) (*Notification, error) {
	id := uuid.New().String()
	now := time.Now()

	metadata, _ := json.Marshal(input.Metadata)
	if input.Metadata == nil {
		metadata = json.RawMessage("{}")
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO notifications (id, user_id, type, title, message, action_url, metadata, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
		id, input.UserID, input.Type, input.Title, input.Message, input.ActionURL, metadata, now)
	if err != nil {
		return nil, fmt.Errorf("create notification: %w", err)
	}

	// Publish to Redis for real-time delivery via WebSocket
	notifJSON, _ := json.Marshal(map[string]interface{}{
		"id":      id,
		"type":    input.Type,
		"title":   input.Title,
		"message": input.Message,
	})
	s.redis.Publish(ctx, "astra:notifications:"+input.UserID, string(notifJSON))

	var n Notification
	err = s.db.QueryRow(ctx,
		`SELECT id, user_id, type, title, message, action_url, is_read, metadata, created_at
		 FROM notifications WHERE id = $1`, id).
		Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.ActionURL, &n.IsRead, &n.Metadata, &n.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (s *NotificationsService) MarkRead(ctx context.Context, id string, userID string) (*Notification, error) {
	_, err := s.db.Exec(ctx,
		`UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return nil, fmt.Errorf("mark read: %w", err)
	}

	var n Notification
	err = s.db.QueryRow(ctx,
		`SELECT id, user_id, type, title, message, action_url, is_read, metadata, created_at
		 FROM notifications WHERE id = $1`, id).
		Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.ActionURL, &n.IsRead, &n.Metadata, &n.CreatedAt)
	if err != nil {
		return nil, err
	}
	return &n, nil
}

func (s *NotificationsService) MarkAllRead(ctx context.Context, userID string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`, userID)
	if err != nil {
		return fmt.Errorf("mark all read: %w", err)
	}
	return nil
}

func (s *NotificationsService) Delete(ctx context.Context, id string, userID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM notifications WHERE id = $1 AND user_id = $2`, id, userID)
	if err != nil {
		return fmt.Errorf("delete notification: %w", err)
	}
	return nil
}

func scanNotifications(rows pgx.Rows) ([]Notification, error) {
	var notifications []Notification
	for rows.Next() {
		var n Notification
		err := rows.Scan(&n.ID, &n.UserID, &n.Type, &n.Title, &n.Message, &n.ActionURL, &n.IsRead, &n.Metadata, &n.CreatedAt)
		if err != nil {
			return nil, err
		}
		notifications = append(notifications, n)
	}
	if notifications == nil {
		notifications = []Notification{}
	}
	return notifications, nil
}
