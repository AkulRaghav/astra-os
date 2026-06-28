package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type TasksService struct {
	db *pgxpool.Pool
}

func NewTasksService(db *pgxpool.Pool) *TasksService {
	return &TasksService{db: db}
}

type Task struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Description *string   `json:"description,omitempty"`
	Status      string    `json:"status"`
	Priority    string    `json:"priority"`
	DueDate     *time.Time `json:"due_date,omitempty"`
	AssigneeID  *string   `json:"assignee_id,omitempty"`
	OwnerID     string    `json:"owner_id"`
	ProjectID   *string   `json:"project_id,omitempty"`
	Tags        []string  `json:"tags"`
	SortOrder   int       `json:"sort_order"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type CreateTaskInput struct {
	Title       string
	Description *string
	Priority    string
	DueDate     *time.Time
	AssigneeID  *string
	Tags        []string
	OwnerID     string
}

type UpdateTaskInput struct {
	Title       *string
	Description *string
	Status      *string
	Priority    *string
	DueDate     *time.Time
	AssigneeID  *string
	Tags        []string
}

func (s *TasksService) ListTasks(ctx context.Context, ownerID string, status *string, priority *string) ([]Task, error) {
	query := `SELECT id, title, description, status, priority, due_date, assignee_id, owner_id, project_id, tags, sort_order, created_at, updated_at
		 FROM tasks WHERE owner_id = $1`
	args := []interface{}{ownerID}
	argIdx := 2

	if status != nil {
		query += fmt.Sprintf(" AND status = $%d", argIdx)
		args = append(args, *status)
		argIdx++
	}
	if priority != nil {
		query += fmt.Sprintf(" AND priority = $%d", argIdx)
		args = append(args, *priority)
		argIdx++
	}

	query += " ORDER BY sort_order ASC, created_at DESC"

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list tasks: %w", err)
	}
	defer rows.Close()

	return scanTasks(rows)
}

func (s *TasksService) GetTask(ctx context.Context, id string, ownerID string) (*Task, error) {
	var t Task
	err := s.db.QueryRow(ctx,
		`SELECT id, title, description, status, priority, due_date, assignee_id, owner_id, project_id, tags, sort_order, created_at, updated_at
		 FROM tasks WHERE id = $1 AND owner_id = $2`, id, ownerID).
		Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.DueDate, &t.AssigneeID, &t.OwnerID, &t.ProjectID, &t.Tags, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get task: %w", err)
	}
	return &t, nil
}

func (s *TasksService) CreateTask(ctx context.Context, input CreateTaskInput) (*Task, error) {
	id := uuid.New().String()
	now := time.Now()

	priority := input.Priority
	if priority == "" {
		priority = "medium"
	}
	tags := input.Tags
	if tags == nil {
		tags = []string{}
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO tasks (id, title, description, status, priority, due_date, assignee_id, owner_id, tags, created_at, updated_at)
		 VALUES ($1, $2, $3, 'todo', $4, $5, $6, $7, $8, $9, $9)`,
		id, input.Title, input.Description, priority, input.DueDate, input.AssigneeID, input.OwnerID, tags, now)
	if err != nil {
		return nil, fmt.Errorf("create task: %w", err)
	}

	return s.GetTask(ctx, id, input.OwnerID)
}

func (s *TasksService) UpdateTask(ctx context.Context, id string, ownerID string, input UpdateTaskInput) (*Task, error) {
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
	if input.Status != nil {
		sets = append(sets, fmt.Sprintf("status = $%d", argIdx))
		args = append(args, *input.Status)
		argIdx++
	}
	if input.Priority != nil {
		sets = append(sets, fmt.Sprintf("priority = $%d", argIdx))
		args = append(args, *input.Priority)
		argIdx++
	}
	if input.DueDate != nil {
		sets = append(sets, fmt.Sprintf("due_date = $%d", argIdx))
		args = append(args, *input.DueDate)
		argIdx++
	}
	if input.AssigneeID != nil {
		sets = append(sets, fmt.Sprintf("assignee_id = $%d", argIdx))
		args = append(args, *input.AssigneeID)
		argIdx++
	}
	if input.Tags != nil {
		sets = append(sets, fmt.Sprintf("tags = $%d", argIdx))
		args = append(args, input.Tags)
		argIdx++
	}

	args = append(args, id, ownerID)
	query := fmt.Sprintf("UPDATE tasks SET %s WHERE id = $%d AND owner_id = $%d",
		joinStrings(sets, ", "), argIdx, argIdx+1)

	_, err := s.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update task: %w", err)
	}

	return s.GetTask(ctx, id, ownerID)
}

func (s *TasksService) DeleteTask(ctx context.Context, id string, ownerID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM tasks WHERE id = $1 AND owner_id = $2`, id, ownerID)
	if err != nil {
		return fmt.Errorf("delete task: %w", err)
	}
	return nil
}

func scanTasks(rows pgx.Rows) ([]Task, error) {
	var tasks []Task
	for rows.Next() {
		var t Task
		err := rows.Scan(&t.ID, &t.Title, &t.Description, &t.Status, &t.Priority, &t.DueDate, &t.AssigneeID, &t.OwnerID, &t.ProjectID, &t.Tags, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt)
		if err != nil {
			return nil, err
		}
		tasks = append(tasks, t)
	}
	if tasks == nil {
		tasks = []Task{}
	}
	return tasks, nil
}
