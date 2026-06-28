package services

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type MailService struct {
	db *pgxpool.Pool
}

func NewMailService(db *pgxpool.Pool) *MailService {
	return &MailService{db: db}
}

type Email struct {
	ID             string          `json:"id"`
	Subject        string          `json:"subject"`
	Body           string          `json:"body"`
	BodyHTML       *string         `json:"body_html,omitempty"`
	FromName       *string         `json:"from_name,omitempty"`
	FromEmail      string          `json:"from_email"`
	ToAddresses    json.RawMessage `json:"to_addresses"`
	CcAddresses    json.RawMessage `json:"cc_addresses,omitempty"`
	BccAddresses   json.RawMessage `json:"bcc_addresses,omitempty"`
	Folder         string          `json:"folder"`
	IsRead         bool            `json:"is_read"`
	IsStarred      bool            `json:"is_starred"`
	HasAttachments bool            `json:"has_attachments"`
	ThreadID       *string         `json:"thread_id,omitempty"`
	OwnerID        string          `json:"owner_id"`
	ExternalID     *string         `json:"external_id,omitempty"`
	ReceivedAt     time.Time       `json:"received_at"`
	SentAt         *time.Time      `json:"sent_at,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
}

type MailFolderInfo struct {
	Folder      string `json:"folder"`
	Count       int    `json:"count"`
	UnreadCount int    `json:"unread_count"`
}

type SendEmailInput struct {
	To       []string
	Cc       []string
	Subject  string
	Body     string
	BodyHTML *string
	OwnerID  string
}

func (s *MailService) ListEmails(ctx context.Context, ownerID string, folder string, limit, offset int) ([]Email, error) {
	if limit <= 0 {
		limit = 50
	}
	if limit > 100 {
		limit = 100
	}

	rows, err := s.db.Query(ctx,
		`SELECT id, subject, body, body_html, from_name, from_email, to_addresses, cc_addresses, bcc_addresses, folder, is_read, is_starred, has_attachments, thread_id, owner_id, external_id, received_at, sent_at, created_at
		 FROM emails WHERE owner_id = $1 AND folder = $2
		 ORDER BY received_at DESC LIMIT $3 OFFSET $4`, ownerID, folder, limit, offset)
	if err != nil {
		return nil, fmt.Errorf("list emails: %w", err)
	}
	defer rows.Close()

	return scanEmails(rows)
}

func (s *MailService) GetEmail(ctx context.Context, id string, ownerID string) (*Email, error) {
	var e Email
	err := s.db.QueryRow(ctx,
		`SELECT id, subject, body, body_html, from_name, from_email, to_addresses, cc_addresses, bcc_addresses, folder, is_read, is_starred, has_attachments, thread_id, owner_id, external_id, received_at, sent_at, created_at
		 FROM emails WHERE id = $1 AND owner_id = $2`, id, ownerID).
		Scan(&e.ID, &e.Subject, &e.Body, &e.BodyHTML, &e.FromName, &e.FromEmail, &e.ToAddresses, &e.CcAddresses, &e.BccAddresses, &e.Folder, &e.IsRead, &e.IsStarred, &e.HasAttachments, &e.ThreadID, &e.OwnerID, &e.ExternalID, &e.ReceivedAt, &e.SentAt, &e.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("get email: %w", err)
	}
	return &e, nil
}

func (s *MailService) SendEmail(ctx context.Context, input SendEmailInput) (*Email, error) {
	id := uuid.New().String()
	now := time.Now()

	// Get user's email for the from field
	var userEmail, displayName string
	err := s.db.QueryRow(ctx, `SELECT email, display_name FROM users WHERE id = $1`, input.OwnerID).Scan(&userEmail, &displayName)
	if err != nil {
		return nil, fmt.Errorf("get user: %w", err)
	}

	toJSON, _ := json.Marshal(toEmailAddresses(input.To))
	ccJSON, _ := json.Marshal(toEmailAddresses(input.Cc))

	_, err = s.db.Exec(ctx,
		`INSERT INTO emails (id, subject, body, body_html, from_name, from_email, to_addresses, cc_addresses, folder, is_read, owner_id, received_at, sent_at, created_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'sent', true, $9, $10, $10, $10)`,
		id, input.Subject, input.Body, input.BodyHTML, displayName, userEmail, toJSON, ccJSON, input.OwnerID, now)
	if err != nil {
		return nil, fmt.Errorf("send email: %w", err)
	}

	// TODO: In production, actually send via SMTP/SendGrid here

	return s.GetEmail(ctx, id, input.OwnerID)
}

func (s *MailService) MoveEmail(ctx context.Context, id string, folder string, ownerID string) (*Email, error) {
	_, err := s.db.Exec(ctx,
		`UPDATE emails SET folder = $1 WHERE id = $2 AND owner_id = $3`,
		folder, id, ownerID)
	if err != nil {
		return nil, fmt.Errorf("move email: %w", err)
	}
	return s.GetEmail(ctx, id, ownerID)
}

func (s *MailService) MarkRead(ctx context.Context, id string, isRead bool, ownerID string) (*Email, error) {
	_, err := s.db.Exec(ctx,
		`UPDATE emails SET is_read = $1 WHERE id = $2 AND owner_id = $3`,
		isRead, id, ownerID)
	if err != nil {
		return nil, fmt.Errorf("mark read: %w", err)
	}
	return s.GetEmail(ctx, id, ownerID)
}

func (s *MailService) DeleteEmail(ctx context.Context, id string, ownerID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM emails WHERE id = $1 AND owner_id = $2`, id, ownerID)
	if err != nil {
		return fmt.Errorf("delete email: %w", err)
	}
	return nil
}

func (s *MailService) GetFolders(ctx context.Context, ownerID string) ([]MailFolderInfo, error) {
	rows, err := s.db.Query(ctx,
		`SELECT folder, COUNT(*) as count, COUNT(*) FILTER (WHERE is_read = false) as unread_count
		 FROM emails WHERE owner_id = $1
		 GROUP BY folder ORDER BY folder`, ownerID)
	if err != nil {
		return nil, fmt.Errorf("get folders: %w", err)
	}
	defer rows.Close()

	var folders []MailFolderInfo
	for rows.Next() {
		var f MailFolderInfo
		if err := rows.Scan(&f.Folder, &f.Count, &f.UnreadCount); err != nil {
			return nil, err
		}
		folders = append(folders, f)
	}
	if folders == nil {
		folders = []MailFolderInfo{}
	}
	return folders, nil
}

func scanEmails(rows pgx.Rows) ([]Email, error) {
	var emails []Email
	for rows.Next() {
		var e Email
		err := rows.Scan(&e.ID, &e.Subject, &e.Body, &e.BodyHTML, &e.FromName, &e.FromEmail, &e.ToAddresses, &e.CcAddresses, &e.BccAddresses, &e.Folder, &e.IsRead, &e.IsStarred, &e.HasAttachments, &e.ThreadID, &e.OwnerID, &e.ExternalID, &e.ReceivedAt, &e.SentAt, &e.CreatedAt)
		if err != nil {
			return nil, err
		}
		emails = append(emails, e)
	}
	if emails == nil {
		emails = []Email{}
	}
	return emails, nil
}

type emailAddr struct {
	Name  string `json:"name,omitempty"`
	Email string `json:"email"`
}

func toEmailAddresses(addrs []string) []emailAddr {
	result := make([]emailAddr, len(addrs))
	for i, a := range addrs {
		result[i] = emailAddr{Email: a}
	}
	return result
}
