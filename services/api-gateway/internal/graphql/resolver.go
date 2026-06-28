package graphql

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"github.com/astra-os/api-gateway/internal/auth"
	"github.com/astra-os/api-gateway/internal/database"
	redisclient "github.com/astra-os/api-gateway/internal/redis"
	"github.com/astra-os/api-gateway/internal/services"
)

type Resolver struct {
	files         *services.FilesService
	notes         *services.NotesService
	tasks         *services.TasksService
	calendar      *services.CalendarService
	mail          *services.MailService
	notifications *services.NotificationsService
	plugins       *services.PluginsService
	analytics     *services.AnalyticsService
	settings      *services.SettingsService
	workspaces    *services.WorkspacesService
}

func NewResolver(db *database.DB, rdb *redisclient.Client) *Resolver {
	pool := db.Pool
	return &Resolver{
		files:         services.NewFilesService(pool),
		notes:         services.NewNotesService(pool),
		tasks:         services.NewTasksService(pool),
		calendar:      services.NewCalendarService(pool),
		mail:          services.NewMailService(pool),
		notifications: services.NewNotificationsService(pool, rdb.Client),
		plugins:       services.NewPluginsService(pool),
		analytics:     services.NewAnalyticsService(pool),
		settings:      services.NewSettingsService(pool),
		workspaces:    services.NewWorkspacesService(pool),
	}
}

// getUserID extracts user ID from context (set by auth middleware)
func getUserID(ctx context.Context) string {
	claims, ok := ctx.Value(auth.UserContextKey).(*auth.UserClaims)
	if !ok {
		return ""
	}
	return claims.UserID
}

// resolveQuery handles GraphQL query operations
func (r *Resolver) resolveQuery(ctx context.Context, field string, args map[string]interface{}) (interface{}, error) {
	userID := getUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("unauthorized")
	}

	switch field {
	// User
	case "me":
		return r.settings.GetMe(ctx, userID)

	// Files
	case "files":
		parentID := getStringPtr(args, "parentId")
		return r.files.ListFiles(ctx, userID, parentID)
	case "file":
		return r.files.GetFile(ctx, getString(args, "id"), userID)
	case "storageQuota":
		used, total, err := r.files.GetStorageQuota(ctx, userID)
		if err != nil {
			return nil, err
		}
		return map[string]int64{"used": used, "total": total}, nil
	case "searchFiles":
		return r.files.SearchFiles(ctx, userID, getString(args, "query"))

	// Notes
	case "notes":
		folderID := getStringPtr(args, "folderId")
		return r.notes.ListNotes(ctx, userID, folderID)
	case "note":
		return r.notes.GetNote(ctx, getString(args, "id"), userID)
	case "searchNotes":
		return r.notes.SearchNotes(ctx, userID, getString(args, "query"))

	// Tasks
	case "tasks":
		status := getStringPtr(args, "status")
		priority := getStringPtr(args, "priority")
		return r.tasks.ListTasks(ctx, userID, status, priority)
	case "task":
		return r.tasks.GetTask(ctx, getString(args, "id"), userID)

	// Calendar
	case "events":
		start, _ := time.Parse(time.RFC3339, getString(args, "start"))
		end, _ := time.Parse(time.RFC3339, getString(args, "end"))
		return r.calendar.ListEvents(ctx, userID, start, end)
	case "event":
		return r.calendar.GetEvent(ctx, getString(args, "id"), userID)

	// Mail
	case "emails":
		folder := getString(args, "folder")
		limit := getInt(args, "limit", 50)
		offset := getInt(args, "offset", 0)
		return r.mail.ListEmails(ctx, userID, folder, limit, offset)
	case "email":
		return r.mail.GetEmail(ctx, getString(args, "id"), userID)
	case "mailFolders":
		return r.mail.GetFolders(ctx, userID)

	// Notifications
	case "notifications":
		unreadOnly := getBool(args, "unreadOnly", false)
		return r.notifications.ListNotifications(ctx, userID, unreadOnly)
	case "unreadNotificationCount":
		return r.notifications.GetUnreadCount(ctx, userID)

	// Plugins
	case "plugins":
		category := getStringPtr(args, "category")
		search := getStringPtr(args, "search")
		return r.plugins.ListPlugins(ctx, category, search)
	case "plugin":
		return r.plugins.GetPlugin(ctx, getString(args, "id"))
	case "installedPlugins":
		return r.plugins.ListInstalled(ctx, userID)

	// Workspaces
	case "workspaces":
		return r.workspaces.ListWorkspaces(ctx, userID)
	case "workspace":
		return r.workspaces.GetWorkspace(ctx, getString(args, "id"), userID)

	// Analytics
	case "analyticsSummary":
		return r.analytics.GetSummary(ctx, userID, getString(args, "period"))

	// Billing
	case "billingInfo":
		return r.settings.GetBillingInfo(ctx, userID)
	case "invoices":
		return r.settings.ListInvoices(ctx, userID)
	case "plans":
		return r.settings.ListPlans(ctx)

	// Settings
	case "settings":
		user, err := r.settings.GetMe(ctx, userID)
		if err != nil {
			return nil, err
		}
		return map[string]interface{}{
			"theme":                user.Theme,
			"language":             user.Language,
			"timezone":             user.Timezone,
			"notificationsEnabled": user.NotificationsEnabled,
			"emailNotifications":   user.EmailNotifications,
			"pushNotifications":    user.PushNotifications,
		}, nil
	}

	return nil, fmt.Errorf("unknown query field: %s", field)
}

// resolveMutation handles GraphQL mutation operations
func (r *Resolver) resolveMutation(ctx context.Context, field string, args map[string]interface{}) (interface{}, error) {
	userID := getUserID(ctx)
	if userID == "" {
		return nil, fmt.Errorf("unauthorized")
	}

	switch field {
	// Profile
	case "updateProfile":
		input := args["input"].(map[string]interface{})
		return r.settings.UpdateProfile(ctx, userID, services.UpdateProfileInput{
			DisplayName: getStringPtr(input, "displayName"),
			Bio:         getStringPtr(input, "bio"),
			Timezone:    getStringPtr(input, "timezone"),
			Language:    getStringPtr(input, "language"),
		})
	case "updateAvatar":
		return r.settings.UpdateAvatar(ctx, userID, getString(args, "url"))

	// Files
	case "createFolder":
		return r.files.CreateFolder(ctx, services.CreateFolderInput{
			Name:     getString(args, "name"),
			ParentID: getStringPtr(args, "parentId"),
			OwnerID:  userID,
		})
	case "renameFile":
		return r.files.RenameFile(ctx, getString(args, "id"), getString(args, "name"), userID)
	case "moveFile":
		return r.files.MoveFile(ctx, getString(args, "id"), getStringPtr(args, "parentId"), userID)
	case "deleteFile":
		err := r.files.DeleteFile(ctx, getString(args, "id"), userID)
		return err == nil, err

	// Notes
	case "createNote":
		input := args["input"].(map[string]interface{})
		return r.notes.CreateNote(ctx, services.CreateNoteInput{
			Title:   getString(input, "title"),
			Content: getStringDefault(input, "content", ""),
			Format:  getStringDefault(input, "format", "markdown"),
			Tags:    getStringSlice(input, "tags"),
			OwnerID: userID,
		})
	case "updateNote":
		input := args["input"].(map[string]interface{})
		return r.notes.UpdateNote(ctx, getString(args, "id"), userID, services.UpdateNoteInput{
			Title:      getStringPtr(input, "title"),
			Content:    getStringPtr(input, "content"),
			Tags:       getStringSlice(input, "tags"),
			IsPinned:   getBoolPtr(input, "isPinned"),
			IsArchived: getBoolPtr(input, "isArchived"),
		})
	case "deleteNote":
		err := r.notes.DeleteNote(ctx, getString(args, "id"), userID)
		return err == nil, err

	// Tasks
	case "createTask":
		input := args["input"].(map[string]interface{})
		return r.tasks.CreateTask(ctx, services.CreateTaskInput{
			Title:       getString(input, "title"),
			Description: getStringPtr(input, "description"),
			Priority:    getStringDefault(input, "priority", "medium"),
			Tags:        getStringSlice(input, "tags"),
			OwnerID:     userID,
		})
	case "updateTask":
		input := args["input"].(map[string]interface{})
		return r.tasks.UpdateTask(ctx, getString(args, "id"), userID, services.UpdateTaskInput{
			Title:       getStringPtr(input, "title"),
			Description: getStringPtr(input, "description"),
			Status:      getStringPtr(input, "status"),
			Priority:    getStringPtr(input, "priority"),
			Tags:        getStringSlice(input, "tags"),
		})
	case "deleteTask":
		err := r.tasks.DeleteTask(ctx, getString(args, "id"), userID)
		return err == nil, err

	// Calendar
	case "createEvent":
		input := args["input"].(map[string]interface{})
		startTime, _ := time.Parse(time.RFC3339, getString(input, "startTime"))
		endTime, _ := time.Parse(time.RFC3339, getString(input, "endTime"))
		return r.calendar.CreateEvent(ctx, services.CreateEventInput{
			Title:       getString(input, "title"),
			Description: getStringPtr(input, "description"),
			StartTime:   startTime,
			EndTime:     endTime,
			IsAllDay:    getBool(input, "isAllDay", false),
			Location:    getStringPtr(input, "location"),
			Attendees:   getStringSlice(input, "attendees"),
			Color:       getStringPtr(input, "color"),
			OwnerID:     userID,
		})
	case "updateEvent":
		input := args["input"].(map[string]interface{})
		return r.calendar.UpdateEvent(ctx, getString(args, "id"), userID, services.UpdateEventInput{
			Title:       getStringPtr(input, "title"),
			Description: getStringPtr(input, "description"),
			Location:    getStringPtr(input, "location"),
			Color:       getStringPtr(input, "color"),
		})
	case "deleteEvent":
		err := r.calendar.DeleteEvent(ctx, getString(args, "id"), userID)
		return err == nil, err

	// Mail
	case "sendEmail":
		input := args["input"].(map[string]interface{})
		return r.mail.SendEmail(ctx, services.SendEmailInput{
			To:      getStringSlice(input, "to"),
			Cc:      getStringSlice(input, "cc"),
			Subject: getString(input, "subject"),
			Body:    getString(input, "body"),
			OwnerID: userID,
		})
	case "moveEmail":
		return r.mail.MoveEmail(ctx, getString(args, "id"), getString(args, "folder"), userID)
	case "markEmailRead":
		return r.mail.MarkRead(ctx, getString(args, "id"), getBool(args, "isRead", true), userID)
	case "deleteEmail":
		err := r.mail.DeleteEmail(ctx, getString(args, "id"), userID)
		return err == nil, err

	// Notifications
	case "markNotificationRead":
		return r.notifications.MarkRead(ctx, getString(args, "id"), userID)
	case "markAllNotificationsRead":
		err := r.notifications.MarkAllRead(ctx, userID)
		return err == nil, err
	case "deleteNotification":
		err := r.notifications.Delete(ctx, getString(args, "id"), userID)
		return err == nil, err

	// Plugins
	case "installPlugin":
		return r.plugins.Install(ctx, userID, getString(args, "pluginId"))
	case "uninstallPlugin":
		err := r.plugins.Uninstall(ctx, userID, getString(args, "pluginId"))
		return err == nil, err
	case "togglePlugin":
		return r.plugins.Toggle(ctx, userID, getString(args, "pluginId"), getBool(args, "enabled", true))

	// Workspaces
	case "createWorkspace":
		input := args["input"].(map[string]interface{})
		return r.workspaces.CreateWorkspace(ctx, services.CreateWorkspaceInput{
			Name:        getString(input, "name"),
			Description: getStringPtr(input, "description"),
			Type:        getStringDefault(input, "type", "personal"),
			OwnerID:     userID,
		})
	case "inviteMember":
		return r.workspaces.InviteMember(ctx, getString(args, "workspaceId"), getString(args, "userId"), getString(args, "role"))
	case "removeMember":
		return r.workspaces.RemoveMember(ctx, getString(args, "workspaceId"), getString(args, "userId"))

	// Billing
	case "createCheckoutSession":
		return r.settings.CreateCheckoutSession(ctx, userID, getString(args, "planId"))
	case "cancelSubscription":
		return r.settings.CancelSubscription(ctx, userID)

	// Settings
	case "updateSettings":
		input := args["input"].(map[string]interface{})
		return r.settings.UpdateSettings(ctx, userID, services.UpdateSettingsInput{
			Theme:                getStringPtr(input, "theme"),
			Language:             getStringPtr(input, "language"),
			Timezone:             getStringPtr(input, "timezone"),
			NotificationsEnabled: getBoolPtr(input, "notificationsEnabled"),
			EmailNotifications:   getBoolPtr(input, "emailNotifications"),
			PushNotifications:    getBoolPtr(input, "pushNotifications"),
		})
	}

	return nil, fmt.Errorf("unknown mutation field: %s", field)
}

// --- Helpers ---

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok && v != nil {
		return fmt.Sprintf("%v", v)
	}
	return ""
}

func getStringDefault(m map[string]interface{}, key, def string) string {
	if v := getString(m, key); v != "" {
		return v
	}
	return def
}

func getStringPtr(m map[string]interface{}, key string) *string {
	if v, ok := m[key]; ok && v != nil {
		s := fmt.Sprintf("%v", v)
		return &s
	}
	return nil
}

func getStringSlice(m map[string]interface{}, key string) []string {
	if v, ok := m[key]; ok && v != nil {
		switch val := v.(type) {
		case []interface{}:
			result := make([]string, len(val))
			for i, item := range val {
				result[i] = fmt.Sprintf("%v", item)
			}
			return result
		case []string:
			return val
		}
	}
	return nil
}

func getInt(m map[string]interface{}, key string, def int) int {
	if v, ok := m[key]; ok && v != nil {
		switch val := v.(type) {
		case float64:
			return int(val)
		case int:
			return val
		case json.Number:
			n, _ := val.Int64()
			return int(n)
		}
	}
	return def
}

func getBool(m map[string]interface{}, key string, def bool) bool {
	if v, ok := m[key]; ok && v != nil {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return def
}

func getBoolPtr(m map[string]interface{}, key string) *bool {
	if v, ok := m[key]; ok && v != nil {
		if b, ok := v.(bool); ok {
			return &b
		}
	}
	return nil
}

// Placeholder for unused import
var _ = http.StatusOK
