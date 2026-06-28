import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { TrendingUp, Users, Clock, MousePointer, FileText, Zap, Calendar, Bot } from "lucide-react";
import { filesApi, tasksApi, notesApi, calendarApi } from "@/lib/api";

export const Route = createFileRoute("/app/analytics")({ component: Analytics });

function Analytics() {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalTasks: 0,
    completedTasks: 0,
    totalNotes: 0,
    totalEvents: 0,
    storageUsed: 0,
    storageTotal: 0,
    aiChats: 0,
  });
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<{ day: string; value: number }[]>([]);

  useEffect(() => {
    // Gather real stats from all services
    Promise.all([
      filesApi.list().catch(() => []),
      filesApi.quota().catch(() => ({ used: 0, total: 5368709120 })),
      tasksApi.list().catch(() => []),
      notesApi.list().catch(() => []),
      calendarApi.listEvents(
        new Date(Date.now() - 30 * 86400000).toISOString(),
        new Date(Date.now() + 30 * 86400000).toISOString()
      ).catch(() => []),
    ]).then(([files, quota, tasks, notes, events]) => {
      const fileList = Array.isArray(files) ? files : [];
      const taskList = Array.isArray(tasks) ? tasks : [];
      const noteList = Array.isArray(notes) ? notes : [];
      const eventList = Array.isArray(events) ? events : [];

      setStats({
        totalFiles: fileList.length,
        totalTasks: taskList.length,
        completedTasks: taskList.filter((t: any) => t.status === "done").length,
        totalNotes: noteList.length,
        totalEvents: eventList.length,
        storageUsed: quota?.used || 0,
        storageTotal: quota?.total || 5368709120,
        aiChats: parseInt(localStorage.getItem("astra.ai_chats") || "0"),
      });

      // Build activity from real data (files/notes/tasks by day)
      const last7 = Array.from({ length: 7 }, (_, i) => {
        const d = new Date();
        d.setDate(d.getDate() - (6 - i));
        return d.toISOString().split("T")[0];
      });

      const activityData = last7.map((day) => {
        const dayFiles = fileList.filter((f: any) => f.created_at?.startsWith(day) || f.updated_at?.startsWith(day)).length;
        const dayTasks = taskList.filter((t: any) => t.created_at?.startsWith(day) || t.updated_at?.startsWith(day)).length;
        const dayNotes = noteList.filter((n: any) => n.created_at?.startsWith(day) || n.updated_at?.startsWith(day)).length;
        return { day: new Date(day).toLocaleDateString("default", { weekday: "short" }), value: dayFiles + dayTasks + dayNotes };
      });
      setActivity(activityData);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <div className="grid h-64 place-items-center text-sm text-muted-foreground">Loading analytics…</div>;
  }

  const storagePercent = stats.storageTotal > 0 ? Math.round((stats.storageUsed / stats.storageTotal) * 100) : 0;
  const taskCompletion = stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0;
  const totalActivity = activity.reduce((s, a) => s + a.value, 0);

  const statCards = [
    { label: "Total Files", value: stats.totalFiles, icon: FileText, color: "#7C3AED" },
    { label: "Tasks", value: `${stats.completedTasks}/${stats.totalTasks}`, icon: Zap, color: "#10B981" },
    { label: "Notes", value: stats.totalNotes, icon: MousePointer, color: "#3B82F6" },
    { label: "Events", value: stats.totalEvents, icon: Calendar, color: "#F59E0B" },
    { label: "AI Conversations", value: stats.aiChats, icon: Bot, color: "#EC4899" },
    { label: "Activity (7d)", value: totalActivity, icon: TrendingUp, color: "#06B6D4" },
  ];

  return (
    <div className="space-y-5">
      <h1 className="font-display text-2xl font-bold">Analytics</h1>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {statCards.map((s) => (
          <div key={s.label} className="glass rounded-2xl p-4 flex items-center gap-4">
            <div className="grid size-11 place-items-center rounded-xl" style={{ background: s.color + "20" }}>
              <s.icon className="size-5" style={{ color: s.color }} />
            </div>
            <div>
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-muted-foreground">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Activity chart */}
      <div className="glass rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Activity (Last 7 Days)</h2>
          <span className="text-xs text-muted-foreground">Files + Tasks + Notes created/updated</span>
        </div>
        <div className="flex items-end gap-2 h-40">
          {activity.map((a, i) => {
            const maxVal = Math.max(...activity.map((x) => x.value), 1);
            const height = (a.value / maxVal) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <div className="text-[10px] text-muted-foreground">{a.value}</div>
                <div className="w-full rounded-t-lg bg-gradient-astra transition-all" style={{ height: `${Math.max(height, 4)}%` }} />
                <div className="text-[10px] text-muted-foreground">{a.day}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Storage & Tasks progress */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Storage Usage</h3>
          <div className="relative h-4 rounded-full bg-muted overflow-hidden mb-2">
            <div className="absolute inset-y-0 left-0 bg-gradient-astra rounded-full transition-all" style={{ width: `${storagePercent}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatBytes(stats.storageUsed)} used</span>
            <span>{formatBytes(stats.storageTotal)} total</span>
          </div>
          <div className="mt-1 text-xs font-medium">{storagePercent}% used</div>
        </div>

        <div className="glass rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Task Completion</h3>
          <div className="relative h-4 rounded-full bg-muted overflow-hidden mb-2">
            <div className="absolute inset-y-0 left-0 rounded-full bg-emerald-500 transition-all" style={{ width: `${taskCompletion}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{stats.completedTasks} completed</span>
            <span>{stats.totalTasks} total</span>
          </div>
          <div className="mt-1 text-xs font-medium">{taskCompletion}% done</div>
        </div>
      </div>

      {/* Quick insights */}
      <div className="glass rounded-2xl p-5">
        <h3 className="font-semibold mb-3">Quick Insights</h3>
        <ul className="space-y-2 text-sm">
          {stats.totalFiles === 0 && <li className="flex items-center gap-2 text-muted-foreground"><FileText className="size-4" /> Upload your first file to start tracking storage usage</li>}
          {stats.totalTasks === 0 && <li className="flex items-center gap-2 text-muted-foreground"><Zap className="size-4" /> Create tasks to track your productivity</li>}
          {stats.totalTasks > 0 && stats.completedTasks === stats.totalTasks && <li className="flex items-center gap-2 text-emerald-500"><Zap className="size-4" /> All tasks completed! Great job 🎉</li>}
          {stats.totalTasks > 0 && stats.completedTasks < stats.totalTasks && <li className="flex items-center gap-2 text-muted-foreground"><Zap className="size-4" /> {stats.totalTasks - stats.completedTasks} tasks still pending</li>}
          {stats.totalNotes > 0 && <li className="flex items-center gap-2 text-muted-foreground"><MousePointer className="size-4" /> You have {stats.totalNotes} notes in your workspace</li>}
          {stats.totalEvents > 0 && <li className="flex items-center gap-2 text-muted-foreground"><Calendar className="size-4" /> {stats.totalEvents} upcoming events on your calendar</li>}
        </ul>
      </div>
    </div>
  );
}

function formatBytes(b: number) {
  if (b === 0) return "0 B";
  const gb = b / (1024 ** 3);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = b / (1024 ** 2);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  return `${(b / 1024).toFixed(1)} KB`;
}
