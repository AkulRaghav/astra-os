import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { Cpu, HardDrive, MemoryStick, FileText, CheckCircle2, Circle } from "lucide-react";
import { useState, useEffect } from "react";
import { filesApi, tasksApi, analyticsApi, userApi } from "@/lib/api";

export const Route = createFileRoute("/app/")({
  component: Dashboard,
});

function Ring({ value, color, label, sub }: { value: number; color: string; label: string; sub: string }) {
  const C = 2 * Math.PI * 30;
  return (
    <div className="glass flex items-center gap-4 rounded-2xl p-4">
      <div className="relative size-20">
        <svg viewBox="0 0 80 80" className="size-full -rotate-90">
          <circle cx="40" cy="40" r="30" stroke="oklch(var(--muted))" strokeWidth="8" fill="none" />
          <circle cx="40" cy="40" r="30" stroke={color} strokeWidth="8" fill="none" strokeLinecap="round"
            strokeDasharray={`${(value / 100) * C} ${C}`} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold">{value}%</div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-wider text-muted-foreground">{label}</div>
        <div className="text-base font-semibold">{sub}</div>
      </div>
    </div>
  );
}

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

function Dashboard() {
  const [userName, setUserName] = useState("there");
  const [quota, setQuota] = useState<{ used: number; total: number } | null>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [activityData, setActivityData] = useState<any[]>([]);
  const [memoryPercent, setMemoryPercent] = useState<number | null>(null);
  const [memoryLabel, setMemoryLabel] = useState("Estimated");
  const [cpuPercent, setCpuPercent] = useState<number | null>(null);

  useEffect(() => {
    userApi.getMe().then((u) => {
      if (u?.display_name || u?.name) setUserName((u.display_name || u.name).split(" ")[0]);
    }).catch(() => {});

    filesApi.quota().then((q) => setQuota(q)).catch(() => {});

    filesApi.list().then((f) => setFiles(Array.isArray(f) ? f.slice(0, 5) : [])).catch(() => setFiles([]));

    Promise.all([
      tasksApi.list("todo").catch(() => []),
      tasksApi.list("in_progress").catch(() => []),
      tasksApi.list("done").catch(() => []),
    ]).then(([todo, inProgress, done]) => {
      const all = [
        ...(Array.isArray(todo) ? todo.map((t: any) => ({ ...t, done: false })) : []),
        ...(Array.isArray(inProgress) ? inProgress.map((t: any) => ({ ...t, done: false })) : []),
        ...(Array.isArray(done) ? done.map((t: any) => ({ ...t, done: true })) : []),
      ];
      setTasks(all);
    });

    analyticsApi.summary("WEEK").then((data) => {
      if (data?.activity && Array.isArray(data.activity)) {
        setActivityData(data.activity);
      } else if (data?.data && Array.isArray(data.data)) {
        setActivityData(data.data);
      }
    }).catch(() => {});

    // System metrics - best effort
    const nav = navigator as any;
    if (nav.deviceMemory) {
      const totalGB = nav.deviceMemory;
      const usedEstimate = Math.round(totalGB * 0.6 * 100) / 100;
      setMemoryPercent(Math.round((usedEstimate / totalGB) * 100));
      setMemoryLabel(`~${usedEstimate} GB / ${totalGB} GB`);
    } else {
      setMemoryPercent(60);
      setMemoryLabel("Estimated");
    }
    setCpuPercent(null);
  }, []);

  const storagePercent = quota ? Math.round((quota.used / quota.total) * 100) : 0;
  const storageSub = quota ? `${formatBytes(quota.used)} / ${formatBytes(quota.total)}` : "Loading…";

  const doneCount = tasks.filter((t) => t.done).length;

  const toggleTask = async (id: string) => {
    try {
      await tasksApi.update(id, { status: "done" });
      setTasks((prev) => prev.map((t) => t.id === id ? { ...t, done: true, status: "done" } : t));
    } catch {}
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Good morning, {userName} 👋</h1>
        <p className="text-sm text-muted-foreground">Here's what's happening in your workspace today.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
          <Ring value={storagePercent} color="oklch(0.62 0.24 295)" label="Storage" sub={storageSub} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Ring value={memoryPercent ?? 0} color="oklch(0.62 0.22 255)" label="Memory" sub={memoryLabel} />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Ring value={cpuPercent ?? 0} color="oklch(0.78 0.16 210)" label="CPU" sub={cpuPercent != null ? `${cpuPercent}%` : "Not available"} />
        </motion.div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold">Recent files</div>
          </div>
          {files.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No files yet</div>
          ) : (
            <ul className="space-y-2">
              {files.map((f: any) => (
                <li key={f.id || f.name} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-muted/50">
                  <div className="bg-gradient-astra grid size-9 place-items-center rounded-lg text-white"><FileText className="size-4" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{f.name || f.filename}</div>
                    <div className="text-xs text-muted-foreground">{f.size ? formatBytes(f.size) : ""}{f.updated_at ? ` · ${new Date(f.updated_at).toLocaleDateString()}` : ""}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="mb-3 flex items-center justify-between">
            <div className="font-semibold">Today's tasks</div>
            <div className="text-xs text-muted-foreground">{doneCount}/{tasks.length} completed</div>
          </div>
          {tasks.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No tasks yet</div>
          ) : (
            <ul className="space-y-2">
              {tasks.slice(0, 5).map((t: any) => (
                <li key={t.id} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-muted/50">
                  <button onClick={() => !t.done && toggleTask(t.id)}>
                    {t.done ? <CheckCircle2 className="size-5 text-emerald-400" /> : <Circle className="size-5 text-muted-foreground" />}
                  </button>
                  <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t.status}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl p-5">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-semibold">Workspace activity</div>
          <div className="text-xs text-muted-foreground">Last 7 days</div>
        </div>
        {activityData.length === 0 ? (
          <div className="flex h-56 items-center justify-center text-sm text-muted-foreground">No activity data yet — it will appear as you use Astra</div>
        ) : (
          <div className="h-56">
            <ResponsiveContainer>
              <AreaChart data={activityData}>
                <defs>
                  <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#7C3AED" stopOpacity={0.6} />
                    <stop offset="100%" stopColor="#06B6D4" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" fontSize={10} />
                <Tooltip contentStyle={{ background: "rgba(20,10,40,0.9)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 12, fontSize: 12 }} />
                <Area type="monotone" dataKey="value" stroke="#A855F7" strokeWidth={2} fill="url(#g1)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
}
