package services

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type NotesService struct {
	db *pgxpool.Pool
}

func NewNotesService(db *pgxpool.Pool) *NotesService {
	return &NotesService{db: db}
}

type Note struct {
	ID         string    `json:"id"`
	Title      string    `json:"title"`
	Content    string    `json:"content"`
	Format     string    `json:"format"`
	Tags       []string  `json:"tags"`
	OwnerID    string    `json:"owner_id"`
	FolderID   *string   `json:"folder_id,omitempty"`
	IsPinned   bool      `json:"is_pinned"`
	IsArchived bool      `json:"is_archived"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type CreateNoteInput struct {
	Title   string
	Content string
	Format  string
	Tags    []string
	OwnerID string
}

type UpdateNoteInput struct {
	Title      *string
	Content    *string
	Tags       []string
	IsPinned   *bool
	IsArchived *bool
}

func (s *NotesService) ListNotes(ctx context.Context, ownerID string, folderID *string) ([]Note, error) {
	var rows pgx.Rows
	var err error

	if folderID == nil {
		rows, err = s.db.Query(ctx,
			`SELECT id, title, content, format, tags, owner_id, folder_id, is_pinned, is_archived, created_at, updated_at
			 FROM notes WHERE owner_id = $1 AND is_archived = false
			 ORDER BY is_pinned DESC, updated_at DESC`, ownerID)
	} else {
		rows, err = s.db.Query(ctx,
			`SELECT id, title, content, format, tags, owner_id, folder_id, is_pinned, is_archived, created_at, updated_at
			 FROM notes WHERE owner_id = $1 AND folder_id = $2 AND is_archived = false
			 ORDER BY is_pinned DESC, updated_at DESC`, ownerID, *folderID)
	}
	if err != nil {
		return nil, fmt.Errorf("list notes: %w", err)
	}
	defer rows.Close()

	return scanNotes(rows)
}

func (s *NotesService) GetNote(ctx context.Context, id string, ownerID string) (*Note, error) {
	var n Note
	err := s.db.QueryRow(ctx,
		`SELECT id, title, content, format, tags, owner_id, folder_id, is_pinned, is_archived, created_at, updated_at
		 FROM notes WHERE id = $1 AND owner_id = $2`, id, ownerID).
		Scan(&n.ID, &n.Title, &n.Content, &n.Format, &n.Tags, &n.OwnerID, &n.FolderID, &n.IsPinned, &n.IsArchived, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get note: %w", err)
	}
	return &n, nil
}

func (s *NotesService) CreateNote(ctx context.Context, input CreateNoteInput) (*Note, error) {
	id := uuid.New().String()
	now := time.Now()

	format := input.Format
	if format == "" {
		format = "markdown"
	}
	tags := input.Tags
	if tags == nil {
		tags = []string{}
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO notes (id, title, content, format, tags, owner_id, created_at, updated_at)
		 VALUES ($1, $2, $3, $4, $5, $6, $7, $7)`,
		id, input.Title, input.Content, format, tags, input.OwnerID, now)
	if err != nil {
		return nil, fmt.Errorf("create note: %w", err)
	}

	return s.GetNote(ctx, id, input.OwnerID)
}

func (s *NotesService) UpdateNote(ctx context.Context, id string, ownerID string, input UpdateNoteInput) (*Note, error) {
	now := time.Now()

	// Build dynamic update
	sets := []string{"updated_at = $1"}
	args := []interface{}{now}
	argIdx := 2

	if input.Title != nil {
		sets = append(sets, fmt.Sprintf("title = $%d", argIdx))
		args = append(args, *input.Title)
		argIdx++
	}
	if input.Content != nil {
		sets = append(sets, fmt.Sprintf("content = $%d", argIdx))
		args = append(args, *input.Content)
		argIdx++
	}
	if input.Tags != nil {
		sets = append(sets, fmt.Sprintf("tags = $%d", argIdx))
		args = append(args, input.Tags)
		argIdx++
	}
	if input.IsPinned != nil {
		sets = append(sets, fmt.Sprintf("is_pinned = $%d", argIdx))
		args = append(args, *input.IsPinned)
		argIdx++
	}
	if input.IsArchived != nil {
		sets = append(sets, fmt.Sprintf("is_archived = $%d", argIdx))
		args = append(args, *input.IsArchived)
		argIdx++
	}

	args = append(args, id, ownerID)
	query := fmt.Sprintf("UPDATE notes SET %s WHERE id = $%d AND owner_id = $%d",
		joinStrings(sets, ", "), argIdx, argIdx+1)

	_, err := s.db.Exec(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("update note: %w", err)
	}

	return s.GetNote(ctx, id, ownerID)
}

func (s *NotesService) DeleteNote(ctx context.Context, id string, ownerID string) error {
	_, err := s.db.Exec(ctx, `DELETE FROM notes WHERE id = $1 AND owner_id = $2`, id, ownerID)
	if err != nil {
		return fmt.Errorf("delete note: %w", err)
	}
	return nil
}

func (s *NotesService) SearchNotes(ctx context.Context, ownerID string, query string) ([]Note, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, title, content, format, tags, owner_id, folder_id, is_pinned, is_archived, created_at, updated_at
		 FROM notes WHERE owner_id = $1 AND is_archived = false
		 AND (title ILIKE $2 OR content ILIKE $2)
		 ORDER BY updated_at DESC LIMIT 50`, ownerID, "%"+query+"%")
	if err != nil {
		return nil, fmt.Errorf("search notes: %w", err)
	}
	defer rows.Close()

	return scanNotes(rows)
}

func scanNotes(rows pgx.Rows) ([]Note, error) {
	var notes []Note
	for rows.Next() {
		var n Note
		err := rows.Scan(&n.ID, &n.Title, &n.Content, &n.Format, &n.Tags, &n.OwnerID, &n.FolderID, &n.IsPinned, &n.IsArchived, &n.CreatedAt, &n.UpdatedAt)
		if err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	if notes == nil {
		notes = []Note{}
	}
	return notes, nil
}
