package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

type WorkspacesService struct {
	db *pgxpool.Pool
}

func NewWorkspacesService(db *pgxpool.Pool) *WorkspacesService {
	return &WorkspacesService{db: db}
}

type Workspace struct {
	ID          string            `json:"id"`
	Name        string            `json:"name"`
	Description *string           `json:"description,omitempty"`
	OwnerID     string            `json:"owner_id"`
	Type        string            `json:"type"`
	Members     []WorkspaceMember `json:"members"`
	CreatedAt   time.Time         `json:"created_at"`
	UpdatedAt   time.Time         `json:"updated_at"`
}

type WorkspaceMember struct {
	UserID   string    `json:"user_id"`
	Role     string    `json:"role"`
	JoinedAt time.Time `json:"joined_at"`
}

type CreateWorkspaceInput struct {
	Name        string
	Description *string
	Type        string
	OwnerID     string
}

func (s *WorkspacesService) ListWorkspaces(ctx context.Context, userID string) ([]Workspace, error) {
	rows, err := s.db.Query(ctx,
		`SELECT DISTINCT w.id, w.name, w.description, w.owner_id, w.type, w.created_at, w.updated_at
		 FROM workspaces w
		 LEFT JOIN workspace_members wm ON wm.workspace_id = w.id
		 WHERE w.owner_id = $1 OR wm.user_id = $1
		 ORDER BY w.updated_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list workspaces: %w", err)
	}
	defer rows.Close()

	var workspaces []Workspace
	for rows.Next() {
		var w Workspace
		if err := rows.Scan(&w.ID, &w.Name, &w.Description, &w.OwnerID, &w.Type, &w.CreatedAt, &w.UpdatedAt); err != nil {
			return nil, err
		}
		w.Members = []WorkspaceMember{}
		workspaces = append(workspaces, w)
	}
	if workspaces == nil {
		workspaces = []Workspace{}
	}

	// Load members for each workspace
	for i := range workspaces {
		members, _ := s.getMembers(ctx, workspaces[i].ID)
		workspaces[i].Members = members
	}

	return workspaces, nil
}

func (s *WorkspacesService) GetWorkspace(ctx context.Context, id string, userID string) (*Workspace, error) {
	var w Workspace
	err := s.db.QueryRow(ctx,
		`SELECT id, name, description, owner_id, type, created_at, updated_at
		 FROM workspaces WHERE id = $1`, id).
		Scan(&w.ID, &w.Name, &w.Description, &w.OwnerID, &w.Type, &w.CreatedAt, &w.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get workspace: %w", err)
	}

	members, _ := s.getMembers(ctx, w.ID)
	w.Members = members

	return &w, nil
}

func (s *WorkspacesService) CreateWorkspace(ctx context.Context, input CreateWorkspaceInput) (*Workspace, error) {
	id := uuid.New().String()
	now := time.Now()

	wsType := input.Type
	if wsType == "" {
		wsType = "personal"
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO workspaces (id, name, description, owner_id, type, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $6)`,
		id, input.Name, input.Description, input.OwnerID, wsType, now)
	if err != nil {
		return nil, fmt.Errorf("create workspace: %w", err)
	}

	// Add owner as member
	s.db.Exec(ctx,
		`INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
		 VALUES ($1, $2, $3, 'owner', $4)`,
		uuid.New().String(), id, input.OwnerID, now)

	return s.GetWorkspace(ctx, id, input.OwnerID)
}

func (s *WorkspacesService) InviteMember(ctx context.Context, workspaceID string, userID string, role string) (*Workspace, error) {
	_, err := s.db.Exec(ctx,
		`INSERT INTO workspace_members (id, workspace_id, user_id, role, joined_at)
		 VALUES ($1, $2, $3, $4, $5)
		 ON CONFLICT (workspace_id, user_id) DO UPDATE SET role = $4`,
		uuid.New().String(), workspaceID, userID, role, time.Now())
	if err != nil {
		return nil, fmt.Errorf("invite member: %w", err)
	}
	return s.GetWorkspace(ctx, workspaceID, userID)
}

func (s *WorkspacesService) RemoveMember(ctx context.Context, workspaceID string, userID string) (*Workspace, error) {
	_, err := s.db.Exec(ctx,
		`DELETE FROM workspace_members WHERE workspace_id = $1 AND user_id = $2`,
		workspaceID, userID)
	if err != nil {
		return nil, fmt.Errorf("remove member: %w", err)
	}
	return s.GetWorkspace(ctx, workspaceID, userID)
}

func (s *WorkspacesService) getMembers(ctx context.Context, workspaceID string) ([]WorkspaceMember, error) {
	rows, err := s.db.Query(ctx,
		`SELECT user_id, role, joined_at FROM workspace_members WHERE workspace_id = $1 ORDER BY joined_at`, workspaceID)
	if err != nil {
		return []WorkspaceMember{}, nil
	}
	defer rows.Close()

	var members []WorkspaceMember
	for rows.Next() {
		var m WorkspaceMember
		if err := rows.Scan(&m.UserID, &m.Role, &m.JoinedAt); err != nil {
			continue
		}
		members = append(members, m)
	}
	if members == nil {
		members = []WorkspaceMember{}
	}
	return members, nil
}
