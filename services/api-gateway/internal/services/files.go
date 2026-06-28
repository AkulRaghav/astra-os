package services

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

type FilesService struct {
	db *pgxpool.Pool
}

func NewFilesService(db *pgxpool.Pool) *FilesService {
	return &FilesService{db: db}
}

type FileNode struct {
	ID        string     `json:"id"`
	Name      string     `json:"name"`
	Type      string     `json:"type"`
	MimeType  *string    `json:"mime_type,omitempty"`
	Size      int64      `json:"size"`
	ParentID  *string    `json:"parent_id,omitempty"`
	Path      string     `json:"path"`
	StorageKey *string   `json:"storage_key,omitempty"`
	OwnerID   string     `json:"owner_id"`
	IsTrashed bool       `json:"is_trashed"`
	CreatedAt time.Time  `json:"created_at"`
	UpdatedAt time.Time  `json:"updated_at"`
}

type CreateFolderInput struct {
	Name     string
	ParentID *string
	OwnerID  string
}

type UploadFileInput struct {
	Name       string
	ParentID   *string
	MimeType   string
	Size       int64
	StorageKey string
	OwnerID    string
}

func (s *FilesService) ListFiles(ctx context.Context, ownerID string, parentID *string) ([]FileNode, error) {
	var rows pgx.Rows
	var err error

	if parentID == nil {
		rows, err = s.db.Query(ctx,
			`SELECT id, name, type, mime_type, size, parent_id, path, storage_key, owner_id, is_trashed, created_at, updated_at
			 FROM files WHERE owner_id = $1 AND parent_id IS NULL AND is_trashed = false
			 ORDER BY type DESC, name ASC`, ownerID)
	} else {
		rows, err = s.db.Query(ctx,
			`SELECT id, name, type, mime_type, size, parent_id, path, storage_key, owner_id, is_trashed, created_at, updated_at
			 FROM files WHERE owner_id = $1 AND parent_id = $2 AND is_trashed = false
			 ORDER BY type DESC, name ASC`, ownerID, *parentID)
	}
	if err != nil {
		return nil, fmt.Errorf("query files: %w", err)
	}
	defer rows.Close()

	return scanFiles(rows)
}

func (s *FilesService) GetFile(ctx context.Context, id string, ownerID string) (*FileNode, error) {
	var f FileNode
	err := s.db.QueryRow(ctx,
		`SELECT id, name, type, mime_type, size, parent_id, path, storage_key, owner_id, is_trashed, created_at, updated_at
		 FROM files WHERE id = $1 AND owner_id = $2`, id, ownerID).
		Scan(&f.ID, &f.Name, &f.Type, &f.MimeType, &f.Size, &f.ParentID, &f.Path, &f.StorageKey, &f.OwnerID, &f.IsTrashed, &f.CreatedAt, &f.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get file: %w", err)
	}
	return &f, nil
}

func (s *FilesService) CreateFolder(ctx context.Context, input CreateFolderInput) (*FileNode, error) {
	id := uuid.New().String()
	now := time.Now()

	// Build path
	path := "/" + input.Name
	if input.ParentID != nil {
		var parentPath string
		err := s.db.QueryRow(ctx, `SELECT path FROM files WHERE id = $1 AND owner_id = $2`, *input.ParentID, input.OwnerID).Scan(&parentPath)
		if err != nil {
			return nil, fmt.Errorf("parent not found: %w", err)
		}
		path = parentPath + "/" + input.Name
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO files (id, name, type, size, parent_id, path, owner_id, created_at, updated_at)
		 VALUES ($1, $2, 'folder', 0, $3, $4, $5, $6, $6)`,
		id, input.Name, input.ParentID, path, input.OwnerID, now)
	if err != nil {
		return nil, fmt.Errorf("create folder: %w", err)
	}

	return s.GetFile(ctx, id, input.OwnerID)
}

func (s *FilesService) CreateFile(ctx context.Context, input UploadFileInput) (*FileNode, error) {
	id := uuid.New().String()
	now := time.Now()

	path := "/" + input.Name
	if input.ParentID != nil {
		var parentPath string
		err := s.db.QueryRow(ctx, `SELECT path FROM files WHERE id = $1 AND owner_id = $2`, *input.ParentID, input.OwnerID).Scan(&parentPath)
		if err != nil {
			return nil, fmt.Errorf("parent not found: %w", err)
		}
		path = parentPath + "/" + input.Name
	}

	_, err := s.db.Exec(ctx,
		`INSERT INTO files (id, name, type, mime_type, size, parent_id, path, storage_key, owner_id, created_at, updated_at)
		 VALUES ($1, $2, 'file', $3, $4, $5, $6, $7, $8, $9, $9)`,
		id, input.Name, input.MimeType, input.Size, input.ParentID, path, input.StorageKey, input.OwnerID, now)
	if err != nil {
		return nil, fmt.Errorf("create file: %w", err)
	}

	return s.GetFile(ctx, id, input.OwnerID)
}

func (s *FilesService) RenameFile(ctx context.Context, id string, name string, ownerID string) (*FileNode, error) {
	now := time.Now()

	// Get current file to update path
	file, err := s.GetFile(ctx, id, ownerID)
	if err != nil {
		return nil, err
	}

	// Build new path
	parts := strings.Split(file.Path, "/")
	parts[len(parts)-1] = name
	newPath := strings.Join(parts, "/")

	_, err = s.db.Exec(ctx,
		`UPDATE files SET name = $1, path = $2, updated_at = $3 WHERE id = $4 AND owner_id = $5`,
		name, newPath, now, id, ownerID)
	if err != nil {
		return nil, fmt.Errorf("rename file: %w", err)
	}

	return s.GetFile(ctx, id, ownerID)
}

func (s *FilesService) MoveFile(ctx context.Context, id string, parentID *string, ownerID string) (*FileNode, error) {
	now := time.Now()
	file, err := s.GetFile(ctx, id, ownerID)
	if err != nil {
		return nil, err
	}

	var newPath string
	if parentID == nil {
		newPath = "/" + file.Name
	} else {
		var parentPath string
		err := s.db.QueryRow(ctx, `SELECT path FROM files WHERE id = $1 AND owner_id = $2`, *parentID, ownerID).Scan(&parentPath)
		if err != nil {
			return nil, fmt.Errorf("parent not found: %w", err)
		}
		newPath = parentPath + "/" + file.Name
	}

	_, err = s.db.Exec(ctx,
		`UPDATE files SET parent_id = $1, path = $2, updated_at = $3 WHERE id = $4 AND owner_id = $5`,
		parentID, newPath, now, id, ownerID)
	if err != nil {
		return nil, fmt.Errorf("move file: %w", err)
	}

	return s.GetFile(ctx, id, ownerID)
}

func (s *FilesService) DeleteFile(ctx context.Context, id string, ownerID string) error {
	_, err := s.db.Exec(ctx,
		`UPDATE files SET is_trashed = true, trashed_at = $1, updated_at = $1 WHERE id = $2 AND owner_id = $3`,
		time.Now(), id, ownerID)
	if err != nil {
		return fmt.Errorf("delete file: %w", err)
	}
	return nil
}

func (s *FilesService) SearchFiles(ctx context.Context, ownerID string, query string) ([]FileNode, error) {
	rows, err := s.db.Query(ctx,
		`SELECT id, name, type, mime_type, size, parent_id, path, storage_key, owner_id, is_trashed, created_at, updated_at
		 FROM files WHERE owner_id = $1 AND is_trashed = false AND name ILIKE $2
		 ORDER BY name ASC LIMIT 50`, ownerID, "%"+query+"%")
	if err != nil {
		return nil, fmt.Errorf("search files: %w", err)
	}
	defer rows.Close()

	return scanFiles(rows)
}

func (s *FilesService) GetStorageQuota(ctx context.Context, ownerID string) (used int64, total int64, err error) {
	err = s.db.QueryRow(ctx,
		`SELECT COALESCE(SUM(size), 0) FROM files WHERE owner_id = $1 AND is_trashed = false`, ownerID).Scan(&used)
	if err != nil {
		return 0, 0, fmt.Errorf("get storage: %w", err)
	}
	// Get plan limit
	var limits *string
	err = s.db.QueryRow(ctx,
		`SELECT bp.limits->>'storageGb' FROM users u
		 LEFT JOIN billing_info bi ON bi.user_id = u.id
		 LEFT JOIN billing_plans bp ON bp.id = bi.plan_id
		 WHERE u.id = $1`, ownerID).Scan(&limits)
	if err != nil || limits == nil {
		total = 5 * 1024 * 1024 * 1024 // 5GB default free tier
	} else {
		// Parse from plan
		total = 5 * 1024 * 1024 * 1024
	}
	return used, total, nil
}

func scanFiles(rows pgx.Rows) ([]FileNode, error) {
	var files []FileNode
	for rows.Next() {
		var f FileNode
		err := rows.Scan(&f.ID, &f.Name, &f.Type, &f.MimeType, &f.Size, &f.ParentID, &f.Path, &f.StorageKey, &f.OwnerID, &f.IsTrashed, &f.CreatedAt, &f.UpdatedAt)
		if err != nil {
			return nil, err
		}
		files = append(files, f)
	}
	if files == nil {
		files = []FileNode{}
	}
	return files, nil
}
