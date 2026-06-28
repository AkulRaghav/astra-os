import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Bell, Sparkles, FileText, CheckCircle2, Calendar, Mail, Bot, Trash2, Plus } from "lucide-react";

export const Route = createFileRoute("/app/notifications")({ component: Notifs });

interface Notification {
  id: string;
  type: "ai" | "file" | "task" | "calendar" | "mail" | "system";
  title: string;
  message: string;
  time: string;
  read: boolean;
}

const ICONS: Record<string, any> = { ai: Sparkles, file: FileText, task: CheckCircle2, calendar: Calendar, mail: Mail, system: Bot };
const ICON_COLORS: Record<string, string> = { ai: "#7C3AED", file: "#3B82F6", task: "#10B981", calendar: "#F59E0B", mail: "#EC4899", system: "#06B6D4" };

const STORAGE_KEY = "astra.notifications";

function loadNotifs(): Notification[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
}
function saveNotifs(n: Notification[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(n)); }

// Generate real notifications based on user activity
function generateActivityNotifs(): Notification[] {
  const notifs: Notification[] = [];
  const now = new Date();

  // Check if user has files
  const sentEmails = JSON.parse(localStorage.getItem("astra.sent_emails") || "[]");
  if (sentEmails.length > 0) {
    notifs.push({
      id: "mail_" + sentEmails.length,
      type: "mail",
      title: "Email Sent",
      message: `Your email "${sentEmails[0]?.subject || "message"}" was delivered successfully.`,
      time: sentEmails[0]?.time || now.toLocaleString(),
      read: false,
    });
  }

  // Check plan
  const plan = localStorage.getItem("astra.plan") || "free";
  if (plan === "enterprise") {
    notifs.push({
      id: "plan_enterprise",
      type: "system",
      title: "Enterprise Plan Active",
      message: "You have unlimited access to all Astra features.",
      time: now.toLocaleDateString(),
      read: true,
    });
  }

  // Check connected plugins
  const plugins = JSON.parse(localStorage.getItem("astra.plugins.connected") || "{}");
  Object.keys(plugins).forEach((name) => {
    notifs.push({
      id: "plugin_" + name,
      type: "system",
      title: `${name} Connected`,
      message: `${name} integration is active and syncing.`,
      time: now.toLocaleDateString(),
      read: true,
    });
  });

  // Check Gmail
  const gmail = localStorage.getItem("astra.gmail.account");
  if (gmail) {
    notifs.push({
      id: "gmail_connected",
      type: "mail",
      title: "Gmail Connected",
      message: "Your Gmail inbox is synced with Astra Mail.",
      time: now.toLocaleDateString(),
      read: true,
    });
  }

  // Welcome notification
  notifs.push({
    id: "welcome",
    type: "ai",
    title: "Welcome to Astra!",
    message: "Your AI workspace is ready. Try the AI Assistant, create files, or set up your calendar.",
    time: now.toLocaleDateString(),
    read: false,
  });

  return notifs;
}

function Notifs() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    let stored = loadNotifs();
    if (stored.length === 0) {
      // Generate from activity
      stored = generateActivityNotifs();
      saveNotifs(stored);
    }
    setNotifications(stored);
  }, []);

  const markAllRead = () => {
    const updated = notifications.map((n) => ({ ...n, read: true }));
    setNotifications(updated);
    saveNotifs(updated);
  };

  const markRead = (id: string) => {
    const updated = notifications.map((n) => n.id === id ? { ...n, read: true } : n);
    setNotifications(updated);
    saveNotifs(updated);
  };

  const deleteNotif = (id: string) => {
    const updated = notifications.filter((n) => n.id !== id);
    setNotifications(updated);
    saveNotifs(updated);
  };

  const clearAll = () => {
    setNotifications([]);
    saveNotifs([]);
  };

  const addTestNotif = () => {
    const types: Notification["type"][] = ["ai", "file", "task", "calendar", "mail", "system"];
    const messages = [
      { type: "ai" as const, title: "AI Task Complete", message: "Your code analysis has finished. View results in the AI Assistant." },
      { type: "task" as const, title: "Task Reminder", message: "You have 2 tasks due today. Check your task board." },
      { type: "file" as const, title: "File Uploaded", message: "report.pdf was uploaded successfully to your workspace." },
      { type: "calendar" as const, title: "Upcoming Meeting", message: "Team standup starts in 15 minutes." },
      { type: "mail" as const, title: "New Email", message: "You received a new message from GitHub." },
    ];
    const msg = messages[Math.floor(Math.random() * messages.length)];
    const notif: Notification = {
      id: `notif_${Date.now()}`,
      ...msg,
      time: new Date().toLocaleTimeString(),
      read: false,
    };
    const updated = [notif, ...notifications];
    setNotifications(updated);
    saveNotifs(updated);
  };

  const filtered = filter === "unread" ? notifications.filter((n) => !n.read) : notifications;
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bell className="size-5 text-astra-purple" />
          <h1 className="font-display text-2xl font-bold">Notifications</h1>
          {unreadCount > 0 && <span className="rounded-full bg-astra-purple px-2 py-0.5 text-[10px] text-white font-bold">{unreadCount}</span>}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={addTestNotif} className="glass rounded-lg px-2 py-1.5 text-xs hover:bg-muted" title="Simulate notification"><Plus className="size-3.5 inline mr-1" />Test</button>
          <button onClick={markAllRead} className="text-xs text-astra-cyan hover:underline">Mark all as read</button>
          <button onClick={clearAll} className="text-xs text-red-400 hover:underline">Clear all</button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass inline-flex rounded-xl p-1 text-xs">
        <button onClick={() => setFilter("all")} className={`rounded-lg px-3 py-1.5 ${filter === "all" ? "bg-gradient-astra text-white" : "text-muted-foreground"}`}>All ({notifications.length})</button>
        <button onClick={() => setFilter("unread")} className={`rounded-lg px-3 py-1.5 ${filter === "unread" ? "bg-gradient-astra text-white" : "text-muted-foreground"}`}>Unread ({unreadCount})</button>
      </div>

      {/* Notifications list */}
      <div className="glass rounded-2xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {filter === "unread" ? "No unread notifications" : "No notifications yet"}
          </div>
        ) : (
          <ul className="divide-y divide-border/60">
            {filtered.map((n) => {
              const I = ICONS[n.type] || Bell;
              const iconColor = ICON_COLORS[n.type] || "#7C3AED";
              return (
                <li
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={`flex items-start gap-4 p-4 transition hover:bg-muted/40 cursor-pointer group ${!n.read ? "bg-muted/20" : ""}`}
                >
                  <div className="grid size-10 shrink-0 place-items-center rounded-xl" style={{ background: iconColor + "20" }}>
                    <I className="size-4" style={{ color: iconColor }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-sm font-medium ${!n.read ? "" : "text-muted-foreground"}`}>{n.title}</span>
                      {!n.read && <span className="size-2 rounded-full bg-astra-purple" />}
                    </div>
                    <div className="text-sm text-muted-foreground mt-0.5">{n.message}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[10px] text-muted-foreground">{n.time}</span>
                    <button onClick={(e) => { e.stopPropagation(); deleteNotif(n.id); }} className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-muted transition"><Trash2 className="size-3.5 text-red-400" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
