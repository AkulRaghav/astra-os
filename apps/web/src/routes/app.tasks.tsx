import ColourfulText from "@/components/ui/colourful-text";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Circle, CheckCircle2 } from "lucide-react";
import { tasksApi } from "@/lib/api";

export const Route = createFileRoute("/app/tasks")({ component: Tasks });

const TABS = ["All", "To Do", "In Progress", "Done"] as const;
const PRIORITY_COLORS: Record<string, string> = { High: "#EF4444", Medium: "#F59E0B", Low: "#10B981", high: "#EF4444", medium: "#F59E0B", low: "#10B981" };

function Tasks() {
  const [tab, setTab] = useState<typeof TABS[number]>("All");
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"High" | "Medium" | "Low">("Medium");
  const [status, setStatus] = useState<"To Do" | "In Progress" | "Done">("To Do");

  const loadTasks = () => {
    setLoading(true);
    tasksApi.list().then((data) => {
      setList(Array.isArray(data) ? data.map((t: any) => ({
        ...t,
        done: t.status === "done" || t.status === "Done",
        priority: t.priority || "Medium",
        status: t.status || "To Do",
      })) : []);
    }).catch(() => setList([])).finally(() => setLoading(false));
  };

  useEffect(() => { loadTasks(); }, []);

  const statusMap: Record<string, string> = { "To Do": "todo", "In Progress": "in_progress", "Done": "done" };
  const filtered = list.filter((t) => {
    if (tab === "All") return true;
    const normalized = t.status?.toLowerCase().replace(/[_ ]/g, "");
    const tabNormalized = tab.toLowerCase().replace(/[_ ]/g, "");
    return normalized === tabNormalized;
  });
  const groups = ["High", "Medium", "Low"].map((p) => ({
    p,
    items: filtered.filter((t) => (t.priority || "").toLowerCase() === p.toLowerCase()),
  }));

  const addTask = async () => {
    if (!title.trim()) return;
    try {
      const task = await tasksApi.create({ title: title.trim(), priority: priority.toLowerCase(), });
      const created = { ...task, done: status === "Done", priority, status };
      if (status !== "To Do") {
        await tasksApi.update(task.id, { status: statusMap[status] });
        created.status = status;
      }
      setList((l) => [created, ...l]);
      setTitle("");
      setPriority("Medium");
      setStatus("To Do");
      setOpen(false);
    } catch {}
  };

  const toggleDone = async (id: string) => {
    try {
      await tasksApi.update(id, { status: "done" });
      setList((l) => l.map((t) => t.id === id ? { ...t, done: true, status: "Done" } : t));
    } catch {}
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-2xl font-bold"><ColourfulText text="Tasks" /></h1>
        <button onClick={() => setOpen(true)} className="bg-gradient-astra glow inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white transition hover:scale-[1.02]"><Plus className="size-4" /> Add Task</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="glass w-full max-w-md rounded-2xl p-6">
            <h2 className="font-display text-lg font-bold">New Task</h2>
            <p className="mt-1 text-xs text-muted-foreground">Give your task a name and choose its priority.</p>
            <label className="mt-4 block text-xs font-medium text-muted-foreground">Task name</label>
            <input
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              placeholder="e.g. Finalize design review"
              className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/30"
            />
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Priority</label>
                <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none">
                  <option>High</option><option>Medium</option><option>Low</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value as any)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none">
                  <option>To Do</option><option>In Progress</option><option>Done</option>
                </select>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={() => setOpen(false)} className="rounded-xl border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={addTask} disabled={!title.trim()} className="bg-gradient-astra glow rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50">Continue</button>
            </div>
          </div>
        </div>
      )}

      <div className="glass inline-flex rounded-xl p-1">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-4 py-1.5 text-xs ${tab === t ? "bg-gradient-astra text-white" : "text-muted-foreground"}`}>{t}</button>
        ))}
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading tasks…</div>
      ) : list.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No tasks yet — add your first task to get started</div>
      ) : (
        <div className="space-y-4">
          {groups.map((g) => g.items.length > 0 && (
            <div key={g.p}>
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider" style={{ color: PRIORITY_COLORS[g.p] }}>
                <span className="size-2 rounded-full" style={{ background: PRIORITY_COLORS[g.p] }} /> {g.p} Priority
              </div>
              <div className="space-y-2">
                {g.items.map((t) => (
                  <div key={t.id} className="glass flex items-center gap-3 rounded-xl border-l-4 p-3" style={{ borderLeftColor: PRIORITY_COLORS[g.p] }}>
                    <button onClick={() => !t.done && toggleDone(t.id)}>
                      {t.done ? <CheckCircle2 className="size-5 text-emerald-400" /> : <Circle className="size-5 text-muted-foreground" />}
                    </button>
                    <span className={`flex-1 text-sm ${t.done ? "line-through text-muted-foreground" : ""}`}>{t.title}</span>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

