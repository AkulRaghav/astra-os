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

type CalendarService struct {
	db *pgxpool.Pool
}

func NewCalendarService(db *pgxpool.Pool) *CalendarService {
	return &CalendarService{db: db}
}

type CalendarEvent struct {
	ID             string          `json:"id"`
	Title          string          `json:"title"`
	Description    *string         `json:"description,omitempty"`
	StartTime      time.Time       `json:"start_time"`
	EndTime        time.Time       `json:"end_time"`
	IsAllDay       bool            `json:"is_all_day"`
	Location       *string         `json:"location,omitempty"`
	RecurrenceRule json.RawMessage `json:"recurrence_rule,omitempty"`
	Reminders      json.RawMessage `json:"reminders"`
	Attendees      []string        `json:"attendees"`
	OwnerID        string          `json:"owner_id"`
	Color          *string         `json:"color,omitempty"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}

type CreateEventInput struct {
	Title          string
	Description    *string
	StartTime      time.Time
	EndTime        time.Time
	IsAllDay       bool
	Location       *string
	RecurrenceRule json.RawMessage
	Reminders      json.RawMessage
	Attendees      []string
	Color          *string
	OwnerID        string
}

type UpdateEventInput struct {
	Title       *string
	Description *string
	StartTime   *time.Time
	EndTime     *time.Time
	IsAllDay    *bool
	Location    *string
	Color       *string
}

func (s *CalendarService) ListEvents(ctx context.Context, ownerID string, start, end time.Time) ([]CalendarEvent, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, title, description, start_time, end_time, is_all_day, location, recurrence_rule, reminders, attendees, owner_id, color, created_at, updated_at
		 FROM calendar_events
		 WHERE owner_id = $1 AND start_time >= $2 AND start_time <= $3
		 ORDER BY start_time ASC`, ownerID, start, end)
	if err != nil {
		return nil, fmt.Errorf("list events: %w", err)
	}
	defer rows.Close()

	return scanEvents(rows)
}

func (s *CalendarService) GetEvent(ctx context.Context, id string, ownerID string) (*CalendarEvent, error) {
	var e CalendarEvent
	err := s.db.QueryRow(ctx,
		`SELECT id, title, description, start_time, end_time, is_all_day, location, recurrence_rule, reminders, attendees, owner_id, color, created_at, updated_at
		 FROM calendar_events WHERE id = $1 AND owner_id = $2`, id, ownerID).
		Scan(&e.ID, &e.Title, &e.Description, &e.StartTime, &e.EndTime, &e.IsAllDay, &e.Location, &e.RecurrenceRule, &e.Reminders, &e.Attendees, &e.OwnerID, &e.Color, &e.CreatedAt, &e.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get event: %w", err)
	}
	return &e, nil
}

func (s *CalendarService) CreateEvent(ctx context.Context, input CreateEventInput) (*CalendarEvent, error) {
	id := uuid.New().String()
	now := time.Now()

	attendees := input.Attendees
	if attendees == nil {
		attendees = []string{}
	}
	reminders := input.Reminders
	if reminders == nil {
		reminders = json.RawMessage("[]")
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO calendar_events (id, title, description, start_time, end_time, is_all_day, location, recurrence_rule, reminders, attendees, owner_id, color, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13)`,
		id, input.Title, input.Description, input.StartTime, input.EndTime, input.IsAllDay,
		input.Location, input.RecurrenceRule, reminders, attendees, input.OwnerID, input.Color, now)
	if err != nil {
		return nil, fmt.Errorf("create event: %w", err)
	}

	return s.GetEvent(ctx, id, input.OwnerID)
}

func (s *CalendarService) UpdateEvent(ctx context.Context, id string, ownerID string, input UpdateEventInput) (*CalendarEvent, error) {
	now := time.Now()

	sets := []string{"updated_at = $1"}
	args := []interface{}{now}
	argIdx := 2

	if input.Title != nil {
		sets = append(sets, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, *input.Title)
		argIdx++
	}
	if input.Description != nil {
		sets = append(sets, fmt.Sprintf("description = $%d", argIdx))
		args = append(args, *input.Description)
		argIdx++
	}
	if input.StartTime != nil {
		sets = append(sets, fmt.Sprintf("start_time = $%d", argIdx))
		args = append(args, *input.StartTime)
		argIdx++
	}
	if input.EndTime != nil {
		sets = append(sets, fmt.Sprintf("end_time = $%d", argIdx))
		args = append(args, *input.EndTime)
		argIdx++
	}
	if input.IsAllDay != nil {
		sets = append(sets, fmt.Sprintf("is_all_day = $%d", argIdx))
		args = append(args, *input.IsAllDay)
		argIdx++
	}
	if input.Location != nil {
		sets = append(sets, fmt.Sprintf("location = $%d", argIdx))
		args = append(args, *input.Location)
		argIdx++
	}
	if input.Color != nil {
		sets = append(sets, fmt.Sprintf("color = $%d", argIdx))
		args = append(args, *input.Color)
		argIdx++
	}

	args = append(args, id, ownerID)
	query := fmt.Sprintf("UPDATE calendar_events SET %s WHERE id = $%d AND owner_id = $%d",
		joinStrings(sets, ", "), argIdx, argIdx+1)

	_, err := s.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update event: %w", err)
	}

	return s.GetEvent(ctx, id, ownerID)
}

func (s *CalendarService) DeleteEvent(ctx context.Context, id string, ownerID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM calendar_events WHERE id = $1 AND owner_id = $2`, id, ownerID)
	if err != nil {
		return fmt.Errorf("delete event: %w", err)
	}
	return nil
}

func scanEvents(rows pgx.Rows) ([]CalendarEvent, error) {
	var events []CalendarEvent
	for rows.Next() {
		var e CalendarEvent
		err := rows.Scan(&e.ID, &e.Title, &e.Description, &e.StartTime, &e.EndTime, &e.IsAllDay, &e.Location, &e.RecurrenceRule, &e.Reminders, &e.Attendees, &e.OwnerID, &e.Color, &e.CreatedAt, &e.UpdatedAt)
		if err != nil {
			return nil, err
		}
		events = append(events, e)
	}
	if events == nil {
		events = []CalendarEvent{}
	}
	return events, nil
}
