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

type PluginsService struct {
	db *pgxpool.Pool
}

func NewPluginsService(db *pgxpool.Pool) *PluginsService {
	return &PluginsService{db: db}
}

type Plugin struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Slug        string   `json:"slug"`
	Description string   `json:"description"`
	Version     string   `json:"version"`
	Author      string   `json:"author"`
	IconURL     *string  `json:"icon_url,omitempty"`
	Category    string   `json:"category"`
	Tags        []string `json:"tags"`
	Downloads   int      `json:"downloads"`
	Rating      float64  `json:"rating"`
	IsOfficial  bool     `json:"is_official"`
	Pricing     string   `json:"pricing"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

type PluginInstall struct {
	ID          string          `json:"id"`
	UserID      string          `json:"user_id"`
	PluginID    string          `json:"plugin_id"`
	IsEnabled   bool            `json:"is_enabled"`
	Config      json.RawMessage `json:"config,omitempty"`
	InstalledAt time.Time       `json:"installed_at"`
	Plugin      *Plugin         `json:"plugin,omitempty"`
}

func (s *PluginsService) ListPlugins(ctx context.Context, category *string, search *string) ([]Plugin, error) {
	query := `SELECT id, name, slug, description, version, author, icon_url, category, tags, downloads, rating, is_official, pricing, created_at, updated_at
		 FROM plugins WHERE 1=1`
	args := []interface{}{}
	argIdx := 1

	if category != nil && *category != "" {
		query += fmt.Sprintf(" AND category = $%d", argIdx)
		args = append(args, *category)
		argIdx++
	}
	if search != nil && *search != "" {
		query += fmt.Sprintf(" AND (name ILIKE $%d OR description ILIKE $%d)", argIdx, argIdx)
		args = append(args, "%"+*search+"%")
		argIdx++
	}

	query += " ORDER BY downloads DESC"

	rows, err := s.db.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("list plugins: %w", err)
	}
	defer rows.Close()

	return scanPlugins(rows)
}

func (s *PluginsService) GetPlugin(ctx context.Context, id string) (*Plugin, error) {
	var p Plugin
	err := s.db.QueryRow(ctx,
		`SELECT id, name, slug, description, version, author, icon_url, category, tags, downloads, rating, is_official, pricing, created_at, updated_at
		 FROM plugins WHERE id = $1`, id).
		Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.Version, &p.Author, &p.IconURL, &p.Category, &p.Tags, &p.Downloads, &p.Rating, &p.IsOfficial, &p.Pricing, &p.CreatedAt, &p.UpdatedAt)
	if err != nil {
		return nil, fmt.Errorf("get plugin: %w", err)
	}
	return &p, nil
}

func (s *PluginsService) ListInstalled(ctx context.Context, userID string) ([]PluginInstall, error) {
	rows, err := s.db.Query(ctx,
		`SELECT pi.id, pi.user_id, pi.plugin_id, pi.is_enabled, pi.config, pi.installed_at,
		        p.id, p.name, p.slug, p.description, p.version, p.author, p.icon_url, p.category, p.tags, p.downloads, p.rating, p.is_official, p.pricing, p.created_at, p.updated_at
		 FROM plugin_installs pi
		 JOIN plugins p ON p.id = pi.plugin_id
		 WHERE pi.user_id = $1
		 ORDER BY pi.installed_at DESC`, userID)
	if err != nil {
		return nil, fmt.Errorf("list installed: %w", err)
	}
	defer rows.Close()

	var installs []PluginInstall
	for rows.Next() {
		var pi PluginInstall
		var p Plugin
		err := rows.Scan(&pi.ID, &pi.UserID, &pi.PluginID, &pi.IsEnabled, &pi.Config, &pi.InstalledAt,
			&p.ID, &p.Name, &p.Slug, &p.Description, &p.Version, &p.Author, &p.IconURL, &p.Category, &p.Tags, &p.Downloads, &p.Rating, &p.IsOfficial, &p.Pricing, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		pi.Plugin = &p
		installs = append(installs, pi)
	}
	if installs == nil {
		installs = []PluginInstall{}
	}
	return installs, nil
}

func (s *PluginsService) Install(ctx context.Context, userID string, pluginID string) (*PluginInstall, error) {
	id := uuid.New().String()
	now := time.Now()

	_, err := s.db.Exec(ctx,
		`INSERT INTO plugin_installs (id, user_id, plugin_id, is_enabled, installed_at)
		 VALUES ($1, $2, $3, true, $4)
		 ON CONFLICT (user_id, plugin_id) DO UPDATE SET is_enabled = true`,
		id, userID, pluginID, now)
	if err != nil {
		return nil, fmt.Errorf("install plugin: %w", err)
	}

	// Increment download count
	s.db.Exec(ctx, `UPDATE plugins SET downloads = downloads + 1 WHERE id = $1`, pluginID)

	return &PluginInstall{
		ID:          id,
		UserID:      userID,
		PluginID:    pluginID,
		IsEnabled:   true,
		InstalledAt: now,
	}, nil
}

func (s *PluginsService) Uninstall(ctx context.Context, userID string, pluginID string) error {
	_, err := s.db.Exec(ctx,
		`DELETE FROM plugin_installs WHERE user_id = $1 AND plugin_id = $2`, userID, pluginID)
	if err != nil {
		return fmt.Errorf("uninstall plugin: %w", err)
	}
	return nil
}

func (s *PluginsService) Toggle(ctx context.Context, userID string, pluginID string, enabled bool) (*PluginInstall, error) {
	_, err := s.db.Exec(ctx,
		`UPDATE plugin_installs SET is_enabled = $1 WHERE user_id = $2 AND plugin_id = $3`,
		enabled, userID, pluginID)
	if err != nil {
		return nil, fmt.Errorf("toggle plugin: %w", err)
	}

	var pi PluginInstall
	err = s.db.QueryRow(ctx,
		`SELECT id, user_id, plugin_id, is_enabled, config, installed_at
		 FROM plugin_installs WHERE user_id = $1 AND plugin_id = $2`, userID, pluginID).
		Scan(&pi.ID, &pi.UserID, &pi.PluginID, &pi.IsEnabled, &pi.Config, &pi.InstalledAt)
	if err != nil {
		return nil, err
	}
	return &pi, nil
}

func scanPlugins(rows pgx.Rows) ([]Plugin, error) {
	var plugins []Plugin
	for rows.Next() {
		var p Plugin
		err := rows.Scan(&p.ID, &p.Name, &p.Slug, &p.Description, &p.Version, &p.Author, &p.IconURL, &p.Category, &p.Tags, &p.Downloads, &p.Rating, &p.IsOfficial, &p.Pricing, &p.CreatedAt, &p.UpdatedAt)
		if err != nil {
			return nil, err
		}
		plugins = append(plugins, p)
	}
	if plugins == nil {
		plugins = []Plugin{}
	}
	return plugins, nil
}
