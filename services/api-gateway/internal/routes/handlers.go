package routes

import (
	"encoding/json"
	"net/http"
	"strconv"
	"time"

	"github.com/go-chi/chi/v5"

	"github.com/astra-os/api-gateway/internal/auth"
	"github.com/astra-os/api-gateway/internal/services"
)

func getUserID(r *http.Request) string {
	claims, ok := r.Context().Value(auth.UserContextKey).(*auth.UserClaims)
	if !ok {
		return ""
	}
	return claims.UserID
}

func writeJSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(data)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

// --- Files ---

func (a *API) listFiles(w http.ResponseWriter, r *http.Request) {
	parentID := r.URL.Query().Get("parent_id")
	var pid *string
	if parentID != "" {
		pid = &parentID
	}
	files, err := a.files.ListFiles(r.Context(), getUserID(r), pid)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, files)
}

func (a *API) getFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	file, err := a.files.GetFile(r.Context(), id, getUserID(r))
	if err != nil {
		writeError(w, 404, "File not found")
		return
	}
	writeJSON(w, 200, file)
}

func (a *API) createFolder(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name     string  `json:"name"`
		ParentID *string `json:"parent_id"`
	}
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		writeError(w, 400, "Invalid request")
		return
	}
	folder, err := a.files.CreateFolder(r.Context(), services.CreateFolderInput{
		Name: input.Name, ParentID: input.ParentID, OwnerID: getUserID(r),
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, folder)
}

func (a *API) renameFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input struct{ Name string `json:"name"` }
	json.NewDecoder(r.Body).Decode(&input)
	file, err := a.files.RenameFile(r.Context(), id, input.Name, getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, file)
}

func (a *API) moveFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	var input struct{ ParentID *string `json:"parent_id"` }
	json.NewDecoder(r.Body).Decode(&input)
	file, err := a.files.MoveFile(r.Context(), id, input.ParentID, getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, file)
}

func (a *API) deleteFile(w http.ResponseWriter, r *http.Request) {
	id := chi.URLParam(r, "id")
	if err := a.files.DeleteFile(r.Context(), id, getUserID(r)); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"deleted": true})
}

func (a *API) searchFiles(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	files, err := a.files.SearchFiles(r.Context(), getUserID(r), q)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, files)
}

func (a *API) getStorageQuota(w http.ResponseWriter, r *http.Request) {
	used, total, err := a.files.GetStorageQuota(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]int64{"used": used, "total": total})
}

// --- Notes ---

func (a *API) listNotes(w http.ResponseWriter, r *http.Request) {
	notes, err := a.notes.ListNotes(r.Context(), getUserID(r), nil)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, notes)
}

func (a *API) getNote(w http.ResponseWriter, r *http.Request) {
	note, err := a.notes.GetNote(r.Context(), chi.URLParam(r, "id"), getUserID(r))
	if err != nil {
		writeError(w, 404, "Note not found")
		return
	}
	writeJSON(w, 200, note)
}

func (a *API) createNote(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title   string   `json:"title"`
		Content string   `json:"content"`
		Format  string   `json:"format"`
		Tags    []string `json:"tags"`
	}
	json.NewDecoder(r.Body).Decode(&input)
	note, err := a.notes.CreateNote(r.Context(), services.CreateNoteInput{
		Title: input.Title, Content: input.Content, Format: input.Format,
		Tags: input.Tags, OwnerID: getUserID(r),
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, note)
}

func (a *API) updateNote(w http.ResponseWriter, r *http.Request) {
	var input services.UpdateNoteInput
	json.NewDecoder(r.Body).Decode(&input)
	note, err := a.notes.UpdateNote(r.Context(), chi.URLParam(r, "id"), getUserID(r), input)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, note)
}

func (a *API) deleteNote(w http.ResponseWriter, r *http.Request) {
	if err := a.notes.DeleteNote(r.Context(), chi.URLParam(r, "id"), getUserID(r)); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"deleted": true})
}

func (a *API) searchNotes(w http.ResponseWriter, r *http.Request) {
	notes, err := a.notes.SearchNotes(r.Context(), getUserID(r), r.URL.Query().Get("q"))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, notes)
}

// --- Tasks ---

func (a *API) listTasks(w http.ResponseWriter, r *http.Request) {
	status := r.URL.Query().Get("status")
	priority := r.URL.Query().Get("priority")
	var sp, pp *string
	if status != "" { sp = &status }
	if priority != "" { pp = &priority }
	tasks, err := a.tasks.ListTasks(r.Context(), getUserID(r), sp, pp)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, tasks)
}

func (a *API) getTask(w http.ResponseWriter, r *http.Request) {
	task, err := a.tasks.GetTask(r.Context(), chi.URLParam(r, "id"), getUserID(r))
	if err != nil {
		writeError(w, 404, "Task not found")
		return
	}
	writeJSON(w, 200, task)
}

func (a *API) createTask(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title       string   `json:"title"`
		Description *string  `json:"description"`
		Priority    string   `json:"priority"`
		Tags        []string `json:"tags"`
	}
	json.NewDecoder(r.Body).Decode(&input)
	task, err := a.tasks.CreateTask(r.Context(), services.CreateTaskInput{
		Title: input.Title, Description: input.Description, Priority: input.Priority,
		Tags: input.Tags, OwnerID: getUserID(r),
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, task)
}

func (a *API) updateTask(w http.ResponseWriter, r *http.Request) {
	var input services.UpdateTaskInput
	json.NewDecoder(r.Body).Decode(&input)
	task, err := a.tasks.UpdateTask(r.Context(), chi.URLParam(r, "id"), getUserID(r), input)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, task)
}

func (a *API) deleteTask(w http.ResponseWriter, r *http.Request) {
	if err := a.tasks.DeleteTask(r.Context(), chi.URLParam(r, "id"), getUserID(r)); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"deleted": true})
}

// --- Calendar ---

func (a *API) listEvents(w http.ResponseWriter, r *http.Request) {
	start, _ := time.Parse(time.RFC3339, r.URL.Query().Get("start"))
	end, _ := time.Parse(time.RFC3339, r.URL.Query().Get("end"))
	if start.IsZero() { start = time.Now().AddDate(0, -1, 0) }
	if end.IsZero() { end = time.Now().AddDate(0, 1, 0) }
	events, err := a.calendar.ListEvents(r.Context(), getUserID(r), start, end)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, events)
}

func (a *API) getEvent(w http.ResponseWriter, r *http.Request) {
	event, err := a.calendar.GetEvent(r.Context(), chi.URLParam(r, "id"), getUserID(r))
	if err != nil {
		writeError(w, 404, "Event not found")
		return
	}
	writeJSON(w, 200, event)
}

func (a *API) createEvent(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Title       string   `json:"title"`
		Description *string  `json:"description"`
		StartTime   string   `json:"start_time"`
		EndTime     string   `json:"end_time"`
		IsAllDay    bool     `json:"is_all_day"`
		Location    *string  `json:"location"`
		Color       *string  `json:"color"`
		Attendees   []string `json:"attendees"`
	}
	json.NewDecoder(r.Body).Decode(&input)
	st, _ := time.Parse(time.RFC3339, input.StartTime)
	et, _ := time.Parse(time.RFC3339, input.EndTime)
	event, err := a.calendar.CreateEvent(r.Context(), services.CreateEventInput{
		Title: input.Title, Description: input.Description,
		StartTime: st, EndTime: et, IsAllDay: input.IsAllDay,
		Location: input.Location, Color: input.Color,
		Attendees: input.Attendees, OwnerID: getUserID(r),
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, event)
}

func (a *API) updateEvent(w http.ResponseWriter, r *http.Request) {
	var input services.UpdateEventInput
	json.NewDecoder(r.Body).Decode(&input)
	event, err := a.calendar.UpdateEvent(r.Context(), chi.URLParam(r, "id"), getUserID(r), input)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, event)
}

func (a *API) deleteEvent(w http.ResponseWriter, r *http.Request) {
	if err := a.calendar.DeleteEvent(r.Context(), chi.URLParam(r, "id"), getUserID(r)); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"deleted": true})
}

// --- Mail ---

func (a *API) listEmails(w http.ResponseWriter, r *http.Request) {
	folder := r.URL.Query().Get("folder")
	if folder == "" { folder = "inbox" }
	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))
	emails, err := a.mail.ListEmails(r.Context(), getUserID(r), folder, limit, offset)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, emails)
}

func (a *API) getEmail(w http.ResponseWriter, r *http.Request) {
	email, err := a.mail.GetEmail(r.Context(), chi.URLParam(r, "id"), getUserID(r))
	if err != nil {
		writeError(w, 404, "Email not found")
		return
	}
	writeJSON(w, 200, email)
}

func (a *API) sendEmail(w http.ResponseWriter, r *http.Request) {
	var input struct {
		To      []string `json:"to"`
		Cc      []string `json:"cc"`
		Subject string   `json:"subject"`
		Body    string   `json:"body"`
	}
	json.NewDecoder(r.Body).Decode(&input)
	email, err := a.mail.SendEmail(r.Context(), services.SendEmailInput{
		To: input.To, Cc: input.Cc, Subject: input.Subject,
		Body: input.Body, OwnerID: getUserID(r),
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, email)
}

func (a *API) moveEmail(w http.ResponseWriter, r *http.Request) {
	var input struct{ Folder string `json:"folder"` }
	json.NewDecoder(r.Body).Decode(&input)
	email, err := a.mail.MoveEmail(r.Context(), chi.URLParam(r, "id"), input.Folder, getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, email)
}

func (a *API) markEmailRead(w http.ResponseWriter, r *http.Request) {
	var input struct{ IsRead bool `json:"is_read"` }
	json.NewDecoder(r.Body).Decode(&input)
	email, err := a.mail.MarkRead(r.Context(), chi.URLParam(r, "id"), input.IsRead, getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, email)
}

func (a *API) deleteEmail(w http.ResponseWriter, r *http.Request) {
	if err := a.mail.DeleteEmail(r.Context(), chi.URLParam(r, "id"), getUserID(r)); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"deleted": true})
}

func (a *API) getMailFolders(w http.ResponseWriter, r *http.Request) {
	folders, err := a.mail.GetFolders(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, folders)
}

// --- Notifications ---

func (a *API) listNotifications(w http.ResponseWriter, r *http.Request) {
	unread := r.URL.Query().Get("unread") == "true"
	notifs, err := a.notifications.ListNotifications(r.Context(), getUserID(r), unread)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, notifs)
}

func (a *API) getUnreadCount(w http.ResponseWriter, r *http.Request) {
	count, err := a.notifications.GetUnreadCount(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]int{"count": count})
}

func (a *API) markNotifRead(w http.ResponseWriter, r *http.Request) {
	notif, err := a.notifications.MarkRead(r.Context(), chi.URLParam(r, "id"), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, notif)
}

func (a *API) markAllNotifsRead(w http.ResponseWriter, r *http.Request) {
	if err := a.notifications.MarkAllRead(r.Context(), getUserID(r)); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"success": true})
}

func (a *API) deleteNotification(w http.ResponseWriter, r *http.Request) {
	if err := a.notifications.Delete(r.Context(), chi.URLParam(r, "id"), getUserID(r)); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"deleted": true})
}

// --- Plugins ---

func (a *API) listPlugins(w http.ResponseWriter, r *http.Request) {
	cat := r.URL.Query().Get("category")
	search := r.URL.Query().Get("search")
	var cp, sp *string
	if cat != "" { cp = &cat }
	if search != "" { sp = &search }
	plugins, err := a.plugins.ListPlugins(r.Context(), cp, sp)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, plugins)
}

func (a *API) getPlugin(w http.ResponseWriter, r *http.Request) {
	plugin, err := a.plugins.GetPlugin(r.Context(), chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 404, "Plugin not found")
		return
	}
	writeJSON(w, 200, plugin)
}

func (a *API) listInstalledPlugins(w http.ResponseWriter, r *http.Request) {
	installs, err := a.plugins.ListInstalled(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, installs)
}

func (a *API) installPlugin(w http.ResponseWriter, r *http.Request) {
	install, err := a.plugins.Install(r.Context(), getUserID(r), chi.URLParam(r, "id"))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, install)
}

func (a *API) uninstallPlugin(w http.ResponseWriter, r *http.Request) {
	if err := a.plugins.Uninstall(r.Context(), getUserID(r), chi.URLParam(r, "id")); err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]bool{"uninstalled": true})
}

func (a *API) togglePlugin(w http.ResponseWriter, r *http.Request) {
	var input struct{ Enabled bool `json:"enabled"` }
	json.NewDecoder(r.Body).Decode(&input)
	install, err := a.plugins.Toggle(r.Context(), getUserID(r), chi.URLParam(r, "id"), input.Enabled)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, install)
}

// --- Analytics ---

func (a *API) ingestAnalyticsEvent(w http.ResponseWriter, r *http.Request) {
	var input struct {
		EventType string                 `json:"event_type"`
		EventData map[string]interface{} `json:"event_data"`
		SessionID string                 `json:"session_id"`
		Source    string                 `json:"source"`
	}
	json.NewDecoder(r.Body).Decode(&input)
	uid := getUserID(r)
	err := a.analytics.IngestEvent(r.Context(), services.IngestEventInput{
		UserID: &uid, EventType: input.EventType, EventData: input.EventData,
		SessionID: input.SessionID, Source: input.Source,
		IPAddress: r.RemoteAddr, UserAgent: r.UserAgent(),
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, map[string]bool{"ingested": true})
}

func (a *API) getAnalyticsSummary(w http.ResponseWriter, r *http.Request) {
	period := r.URL.Query().Get("period")
	if period == "" { period = "MONTH" }
	summary, err := a.analytics.GetSummary(r.Context(), getUserID(r), period)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, summary)
}

// --- Workspaces ---

func (a *API) listWorkspaces(w http.ResponseWriter, r *http.Request) {
	ws, err := a.workspaces.ListWorkspaces(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, ws)
}

func (a *API) getWorkspace(w http.ResponseWriter, r *http.Request) {
	ws, err := a.workspaces.GetWorkspace(r.Context(), chi.URLParam(r, "id"), getUserID(r))
	if err != nil {
		writeError(w, 404, "Workspace not found")
		return
	}
	writeJSON(w, 200, ws)
}

func (a *API) createWorkspace(w http.ResponseWriter, r *http.Request) {
	var input struct {
		Name        string  `json:"name"`
		Description *string `json:"description"`
		Type        string  `json:"type"`
	}
	json.NewDecoder(r.Body).Decode(&input)
	ws, err := a.workspaces.CreateWorkspace(r.Context(), services.CreateWorkspaceInput{
		Name: input.Name, Description: input.Description,
		Type: input.Type, OwnerID: getUserID(r),
	})
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 201, ws)
}

func (a *API) inviteMember(w http.ResponseWriter, r *http.Request) {
	var input struct {
		UserID string `json:"user_id"`
		Role   string `json:"role"`
	}
	json.NewDecoder(r.Body).Decode(&input)
	ws, err := a.workspaces.InviteMember(r.Context(), chi.URLParam(r, "id"), input.UserID, input.Role)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, ws)
}

func (a *API) removeMember(w http.ResponseWriter, r *http.Request) {
	ws, err := a.workspaces.RemoveMember(r.Context(), chi.URLParam(r, "id"), chi.URLParam(r, "userId"))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, ws)
}

// --- Settings ---

func (a *API) getSettings(w http.ResponseWriter, r *http.Request) {
	user, err := a.settings.GetMe(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, map[string]interface{}{
		"theme": user.Theme, "language": user.Language, "timezone": user.Timezone,
		"notifications_enabled": user.NotificationsEnabled,
		"email_notifications": user.EmailNotifications,
		"push_notifications": user.PushNotifications,
	})
}

func (a *API) updateSettings(w http.ResponseWriter, r *http.Request) {
	var input services.UpdateSettingsInput
	json.NewDecoder(r.Body).Decode(&input)
	user, err := a.settings.UpdateSettings(r.Context(), getUserID(r), input)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, user)
}

func (a *API) getProfile(w http.ResponseWriter, r *http.Request) {
	user, err := a.settings.GetMe(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, user)
}

func (a *API) updateProfile(w http.ResponseWriter, r *http.Request) {
	var input services.UpdateProfileInput
	json.NewDecoder(r.Body).Decode(&input)
	user, err := a.settings.UpdateProfile(r.Context(), getUserID(r), input)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, user)
}

func (a *API) updateAvatar(w http.ResponseWriter, r *http.Request) {
	var input struct{ URL string `json:"url"` }
	json.NewDecoder(r.Body).Decode(&input)
	user, err := a.settings.UpdateAvatar(r.Context(), getUserID(r), input.URL)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, user)
}

// --- Billing ---

func (a *API) getBillingInfo(w http.ResponseWriter, r *http.Request) {
	info, err := a.settings.GetBillingInfo(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, info)
}

func (a *API) listPlans(w http.ResponseWriter, r *http.Request) {
	plans, err := a.settings.ListPlans(r.Context())
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, plans)
}

func (a *API) listInvoices(w http.ResponseWriter, r *http.Request) {
	invoices, err := a.settings.ListInvoices(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, invoices)
}

func (a *API) createCheckout(w http.ResponseWriter, r *http.Request) {
	var input struct{ PlanID string `json:"plan_id"` }
	json.NewDecoder(r.Body).Decode(&input)
	session, err := a.settings.CreateCheckoutSession(r.Context(), getUserID(r), input.PlanID)
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, session)
}

func (a *API) cancelSubscription(w http.ResponseWriter, r *http.Request) {
	info, err := a.settings.CancelSubscription(r.Context(), getUserID(r))
	if err != nil {
		writeError(w, 500, err.Error())
		return
	}
	writeJSON(w, 200, info)
}

// suppress unused import
var _ = strconv.Itoa
