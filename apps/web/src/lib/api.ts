/**
 * Astra API Client — connects the frontend to the real backend.
 * Replaces mock data with live API calls.
 */

const API_BASE = "/api/v1";
const AUTH_BASE = "/auth";

// --- Auth Store ---
let accessToken: string | null = localStorage.getItem("astra_token");

export function setToken(token: string | null) {
  accessToken = token;
  if (token) localStorage.setItem("astra_token", token);
  else localStorage.removeItem("astra_token");
}

export function getToken() {
  return accessToken;
}

export function isAuthenticated() {
  return !!accessToken;
}

// --- HTTP Helpers ---

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string> || {}),
  };
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401) {
    // Try refresh
    const refreshed = await refreshToken();
    if (refreshed) {
      headers["Authorization"] = `Bearer ${accessToken}`;
      const retry = await fetch(path, { ...options, headers });
      if (!retry.ok) throw new Error(await retry.text());
      return retry.json();
    }
    setToken(null);
    window.location.href = "/login";
    throw new Error("Unauthorized");
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }

  return res.json();
}

function get<T>(path: string) { return request<T>(`${API_BASE}${path}`); }
function post<T>(path: string, body?: unknown) { return request<T>(`${API_BASE}${path}`, { method: "POST", body: JSON.stringify(body) }); }
function put<T>(path: string, body?: unknown) { return request<T>(`${API_BASE}${path}`, { method: "PUT", body: JSON.stringify(body) }); }
function del<T>(path: string) { return request<T>(`${API_BASE}${path}`, { method: "DELETE" }); }

// --- Auth ---

export async function login(email: string, password: string, totpCode?: string) {
  const res = await request<{ access_token: string; refresh_token: string; requires_2fa?: boolean }>(
    `${AUTH_BASE}/login`, { method: "POST", body: JSON.stringify({ email, password, totp_code: totpCode }) }
  );
  if (res.access_token) {
    setToken(res.access_token);
    localStorage.setItem("astra_refresh", res.refresh_token);
  }
  return res;
}

export async function signup(email: string, password: string, displayName: string) {
  const res = await request<{ access_token: string; refresh_token: string }>(
    `${AUTH_BASE}/signup`, { method: "POST", body: JSON.stringify({ email, password, display_name: displayName }) }
  );
  if (res.access_token) {
    setToken(res.access_token);
    localStorage.setItem("astra_refresh", res.refresh_token);
  }
  return res;
}

export async function logout() {
  try { await request(`${AUTH_BASE}/logout`, { method: "POST" }); } catch {}
  setToken(null);
  localStorage.removeItem("astra_refresh");
}

async function refreshToken(): Promise<boolean> {
  const refresh = localStorage.getItem("astra_refresh");
  if (!refresh) return false;
  try {
    const res = await fetch(`${AUTH_BASE}/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setToken(data.access_token);
    localStorage.setItem("astra_refresh", data.refresh_token);
    return true;
  } catch { return false; }
}

export async function oauthRedirect(provider: string) {
  window.location.href = `${AUTH_BASE}/oauth/${provider}`;
}

// --- User / Settings ---
export const userApi = {
  getMe: () => get<any>("/settings/profile"),
  updateProfile: (data: any) => put<any>("/settings/profile", data),
  updateAvatar: (url: string) => put<any>("/settings/avatar", { url }),
  getSettings: () => get<any>("/settings"),
  updateSettings: (data: any) => put<any>("/settings", data),
};

// --- Files ---
export const filesApi = {
  list: (parentId?: string) => get<any[]>(`/files${parentId ? `?parent_id=${parentId}` : ""}`),
  get: (id: string) => get<any>(`/files/${id}`),
  createFolder: (name: string, parentId?: string) => post<any>("/files/folders", { name, parent_id: parentId }),
  rename: (id: string, name: string) => put<any>(`/files/${id}/rename`, { name }),
  move: (id: string, parentId?: string) => put<any>(`/files/${id}/move`, { parent_id: parentId }),
  delete: (id: string) => del<any>(`/files/${id}`),
  search: (q: string) => get<any[]>(`/files/search?q=${encodeURIComponent(q)}`),
  quota: () => get<{ used: number; total: number }>("/files/quota"),
};

// --- Notes ---
export const notesApi = {
  list: () => get<any[]>("/notes"),
  get: (id: string) => get<any>(`/notes/${id}`),
  create: (data: { title: string; content?: string; format?: string; tags?: string[] }) => post<any>("/notes", data),
  update: (id: string, data: any) => put<any>(`/notes/${id}`, data),
  delete: (id: string) => del<any>(`/notes/${id}`),
  search: (q: string) => get<any[]>(`/notes/search?q=${encodeURIComponent(q)}`),
};

// --- Tasks ---
export const tasksApi = {
  list: (status?: string, priority?: string) => {
    const params = new URLSearchParams();
    if (status) params.set("status", status);
    if (priority) params.set("priority", priority);
    return get<any[]>(`/tasks?${params}`);
  },
  get: (id: string) => get<any>(`/tasks/${id}`),
  create: (data: { title: string; description?: string; priority?: string; tags?: string[] }) => post<any>("/tasks", data),
  update: (id: string, data: any) => put<any>(`/tasks/${id}`, data),
  delete: (id: string) => del<any>(`/tasks/${id}`),
};

// --- Calendar ---
export const calendarApi = {
  listEvents: (start: string, end: string) => get<any[]>(`/calendar/events?start=${start}&end=${end}`),
  getEvent: (id: string) => get<any>(`/calendar/events/${id}`),
  createEvent: (data: any) => post<any>("/calendar/events", data),
  updateEvent: (id: string, data: any) => put<any>(`/calendar/events/${id}`, data),
  deleteEvent: (id: string) => del<any>(`/calendar/events/${id}`),
};

// --- Mail ---
export const mailApi = {
  list: (folder = "inbox", limit = 50, offset = 0) => get<any[]>(`/mail?folder=${folder}&limit=${limit}&offset=${offset}`),
  get: (id: string) => get<any>(`/mail/${id}`),
  send: (data: { to: string[]; cc?: string[]; subject: string; body: string }) => post<any>("/mail/send", data),
  move: (id: string, folder: string) => put<any>(`/mail/${id}/move`, { folder }),
  markRead: (id: string, isRead: boolean) => put<any>(`/mail/${id}/read`, { is_read: isRead }),
  delete: (id: string) => del<any>(`/mail/${id}`),
  folders: () => get<any[]>("/mail/folders"),
};

// --- Notifications ---
export const notificationsApi = {
  list: (unread = false) => get<any[]>(`/notifications${unread ? "?unread=true" : ""}`),
  count: () => get<{ count: number }>("/notifications/count"),
  markRead: (id: string) => put<any>(`/notifications/${id}/read`, {}),
  markAllRead: () => put<any>("/notifications/read-all", {}),
  delete: (id: string) => del<any>(`/notifications/${id}`),
};

// --- Plugins ---
export const pluginsApi = {
  list: (category?: string, search?: string) => {
    const params = new URLSearchParams();
    if (category) params.set("category", category);
    if (search) params.set("search", search);
    return get<any[]>(`/plugins?${params}`);
  },
  get: (id: string) => get<any>(`/plugins/${id}`),
  installed: () => get<any[]>("/plugins/installed"),
  install: (id: string) => post<any>(`/plugins/${id}/install`, {}),
  uninstall: (id: string) => del<any>(`/plugins/${id}/uninstall`),
  toggle: (id: string, enabled: boolean) => put<any>(`/plugins/${id}/toggle`, { enabled }),
};

// --- Analytics ---
export const analyticsApi = {
  summary: (period = "MONTH") => get<any>(`/analytics/summary?period=${period}`),
  ingest: (data: any) => post<any>("/analytics/events", data),
};

// --- Workspaces ---
export const workspacesApi = {
  list: () => get<any[]>("/workspaces"),
  get: (id: string) => get<any>(`/workspaces/${id}`),
  create: (data: { name: string; description?: string; type?: string }) => post<any>("/workspaces", data),
  invite: (id: string, userId: string, role: string) => post<any>(`/workspaces/${id}/members`, { user_id: userId, role }),
  remove: (id: string, userId: string) => del<any>(`/workspaces/${id}/members/${userId}`),
};

// --- Billing ---
export const billingApi = {
  info: () => get<any>("/billing"),
  plans: () => get<any[]>("/billing/plans"),
  invoices: () => get<any[]>("/billing/invoices"),
  checkout: (planId: string) => post<any>("/billing/checkout", { plan_id: planId }),
  cancel: () => post<any>("/billing/cancel", {}),
};

// --- AI Chat ---
export const aiApi = {
  send: (conversationId: string, message: string, agentType = "assistant", history?: Array<{role: string; content: string}>) =>
    fetch("http://localhost:8082/api/v1/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversation_id: conversationId, message, agent_type: agentType, user_id: "current", history: history || [] }),
    }).then(r => r.ok ? r.json() : r.text().then(t => Promise.reject(new Error(t)))),
  agents: () => fetch("http://localhost:8082/api/v1/agents/").then(r => r.json()),
};
