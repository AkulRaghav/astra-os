package routes

import (
	"github.com/go-chi/chi/v5"

	"github.com/astra-os/api-gateway/internal/database"
	redisclient "github.com/astra-os/api-gateway/internal/redis"
	"github.com/astra-os/api-gateway/internal/services"
)

type API struct {
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

func NewAPI(db *database.DB, rdb *redisclient.Client) *API {
	pool := db.Pool
	return &API{
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

func (a *API) Mount(r chi.Router) {
	r.Route("/api/v1", func(r chi.Router) {
		// Files
		r.Route("/files", func(r chi.Router) {
			r.Get("/", a.listFiles)
			r.Post("/folders", a.createFolder)
			r.Get("/{id}", a.getFile)
			r.Put("/{id}/rename", a.renameFile)
			r.Put("/{id}/move", a.moveFile)
			r.Delete("/{id}", a.deleteFile)
			r.Get("/search", a.searchFiles)
			r.Get("/quota", a.getStorageQuota)
		})

		// Notes
		r.Route("/notes", func(r chi.Router) {
			r.Get("/", a.listNotes)
			r.Post("/", a.createNote)
			r.Get("/{id}", a.getNote)
			r.Put("/{id}", a.updateNote)
			r.Delete("/{id}", a.deleteNote)
			r.Get("/search", a.searchNotes)
		})

		// Tasks
		r.Route("/tasks", func(r chi.Router) {
			r.Get("/", a.listTasks)
			r.Post("/", a.createTask)
			r.Get("/{id}", a.getTask)
			r.Put("/{id}", a.updateTask)
			r.Delete("/{id}", a.deleteTask)
		})

		// Calendar
		r.Route("/calendar", func(r chi.Router) {
			r.Get("/events", a.listEvents)
			r.Post("/events", a.createEvent)
			r.Get("/events/{id}", a.getEvent)
			r.Put("/events/{id}", a.updateEvent)
			r.Delete("/events/{id}", a.deleteEvent)
		})

		// Mail
		r.Route("/mail", func(r chi.Router) {
			r.Get("/", a.listEmails)
			r.Get("/folders", a.getMailFolders)
			r.Post("/send", a.sendEmail)
			r.Get("/{id}", a.getEmail)
			r.Put("/{id}/move", a.moveEmail)
			r.Put("/{id}/read", a.markEmailRead)
			r.Delete("/{id}", a.deleteEmail)
		})

		// Notifications
		r.Route("/notifications", func(r chi.Router) {
			r.Get("/", a.listNotifications)
			r.Get("/count", a.getUnreadCount)
			r.Put("/{id}/read", a.markNotifRead)
			r.Put("/read-all", a.markAllNotifsRead)
			r.Delete("/{id}", a.deleteNotification)
		})

		// Plugins
		r.Route("/plugins", func(r chi.Router) {
			r.Get("/", a.listPlugins)
			r.Get("/installed", a.listInstalledPlugins)
			r.Get("/{id}", a.getPlugin)
			r.Post("/{id}/install", a.installPlugin)
			r.Delete("/{id}/uninstall", a.uninstallPlugin)
			r.Put("/{id}/toggle", a.togglePlugin)
		})

		// Analytics
		r.Route("/analytics", func(r chi.Router) {
			r.Post("/events", a.ingestAnalyticsEvent)
			r.Get("/summary", a.getAnalyticsSummary)
		})

		// Workspaces
		r.Route("/workspaces", func(r chi.Router) {
			r.Get("/", a.listWorkspaces)
			r.Post("/", a.createWorkspace)
			r.Get("/{id}", a.getWorkspace)
			r.Post("/{id}/members", a.inviteMember)
			r.Delete("/{id}/members/{userId}", a.removeMember)
		})

		// Settings & Profile
		r.Route("/settings", func(r chi.Router) {
			r.Get("/", a.getSettings)
			r.Put("/", a.updateSettings)
			r.Get("/profile", a.getProfile)
			r.Put("/profile", a.updateProfile)
			r.Put("/avatar", a.updateAvatar)
		})

		// Billing
		r.Route("/billing", func(r chi.Router) {
			r.Get("/", a.getBillingInfo)
			r.Get("/plans", a.listPlans)
			r.Get("/invoices", a.listInvoices)
			r.Post("/checkout", a.createCheckout)
			r.Post("/cancel", a.cancelSubscription)
		})
	})
}
