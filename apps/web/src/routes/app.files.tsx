import ColourfulText from "@/components/ui/colourful-text";
import { createFileRoute } from "@tanstack/react-router";
import { Folder, Upload, Grid2x2, List, FileText, Search, Trash2, Plus } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { filesApi } from "@/lib/api";

export const Route = createFileRoute("/app/files")({ component: Files });

function formatBytes(bytes: number) {
  if (!bytes) return "";
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / (1024 * 1024);
  if (mb >= 1) return `${mb.toFixed(1)} MB`;
  const kb = bytes / 1024;
  return `${kb.toFixed(1)} KB`;
}

function Files() {
  const [view, setView] = useState<"grid" | "list">("grid");
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quota, setQuota] = useState<{ used: number; total: number } | null>(null);
  const [creating, setCreating] = useState(false);
  const [folderName, setFolderName] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadFiles = () => {
    setLoading(true);
    filesApi.list().then((f) => {
      setFiles(Array.isArray(f) ? f : []);
    }).catch(() => setFiles([])).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadFiles();
    filesApi.quota().then((q) => setQuota(q)).catch(() => {});
  }, []);

  const handleCreateFolder = async () => {
    if (!folderName.trim()) return;
    try {
      await filesApi.createFolder(folderName.trim());
      setFolderName("");
      setCreating(false);
      loadFiles();
    } catch {}
  };

  const handleDelete = async (id: string) => {
    try {
      await filesApi.delete(id);
      setFiles((prev) => prev.filter((f) => f.id !== id));
    } catch {}
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      const token = localStorage.getItem("astra_token");
      await fetch("/api/v1/files", {
        method: "POST",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      loadFiles();
    } catch {}
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const folders = files.filter((f) => f.is_folder || f.type === "folder");
  const storagePercent = quota ? Math.round((quota.used / quota.total) * 100) : 0;

  return (
    <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
      <aside className="glass flex flex-col rounded-2xl p-4">
        <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Folders</div>
        <ul className="flex-1 space-y-1">
          {folders.length === 0 ? (
            <li className="px-2 py-4 text-center text-xs text-muted-foreground">No folders yet</li>
          ) : (
            folders.map((f) => (
              <li key={f.id}><button className="flex w-full items-center gap-2 rounded-lg p-2 text-sm hover:bg-muted transition">
                <Folder className="size-4 text-astra-purple" />
                <span className="flex-1 text-left truncate">{f.name || f.filename}</span>
              </button></li>
            ))
          )}
          <li>
            <button onClick={() => setCreating(true)} className="flex w-full items-center gap-2 rounded-lg p-2 text-sm text-muted-foreground hover:bg-muted transition">
              <Plus className="size-4" />
              <span>New folder</span>
            </button>
          </li>
        </ul>
        <div className="mt-4 rounded-xl border border-border p-3">
          <div className="mb-1 flex justify-between text-xs"><span className="text-muted-foreground">Storage</span><span>{storagePercent}%</span></div>
          <div className="h-1.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-gradient-astra" style={{ width: `${storagePercent}%` }} /></div>
          <div className="mt-1 text-[10px] text-muted-foreground">{quota ? `${formatBytes(quota.used)} of ${formatBytes(quota.total)} used` : "Loading…"}</div>
        </div>
      </aside>

      <section>
        <div className="mb-4 flex items-center gap-2">
          <div className="glass flex flex-1 items-center gap-2 rounded-xl px-3 py-2"><Search className="size-4 text-muted-foreground" /><input placeholder="Search files…" className="flex-1 bg-transparent text-sm outline-none" /></div>
          <div className="glass flex items-center rounded-xl p-1">
            <button onClick={() => setView("grid")} className={`rounded-lg p-1.5 ${view === "grid" ? "bg-muted" : "text-muted-foreground"}`}><Grid2x2 className="size-4" /></button>
            <button onClick={() => setView("list")} className={`rounded-lg p-1.5 ${view === "list" ? "bg-muted" : "text-muted-foreground"}`}><List className="size-4" /></button>
          </div>
          <button onClick={() => fileInputRef.current?.click()} className="bg-gradient-astra inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-white"><Upload className="size-4" /> Upload</button>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
        </div>

        <div className="glass rounded-2xl p-4">
          <div className="mb-3 text-sm font-semibold">All files</div>
          {loading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">Loading…</div>
          ) : files.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">No files yet — upload a file or create a folder to get started</div>
          ) : view === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {files.map((f) => (
                <div key={f.id} className="group glass rounded-xl p-4 transition hover:scale-[1.02] hover:ring-astra relative">
                  <div className="bg-gradient-astra mb-3 inline-flex size-10 items-center justify-center rounded-lg text-white">
                    {f.is_folder || f.type === "folder" ? <Folder className="size-5" /> : <FileText className="size-5" />}
                  </div>
                  <div className="truncate text-sm font-medium">{f.name || f.filename}</div>
                  <div className="text-xs text-muted-foreground">{f.size ? formatBytes(f.size) : ""}{f.updated_at ? ` · ${new Date(f.updated_at).toLocaleDateString()}` : ""}</div>
                  <button onClick={() => handleDelete(f.id)} className="absolute top-2 right-2 rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-muted transition" aria-label="Delete">
                    <Trash2 className="size-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-3 group">
                  {f.is_folder || f.type === "folder" ? <Folder className="size-4 text-astra-purple" /> : <FileText className="size-4 text-astra-purple" />}
                  <div className="flex-1 text-sm truncate">{f.name || f.filename}</div>
                  <div className="w-24 text-xs text-muted-foreground">{f.size ? formatBytes(f.size) : ""}</div>
                  <div className="w-24 text-xs text-muted-foreground">{f.updated_at ? new Date(f.updated_at).toLocaleDateString() : ""}</div>
                  <button onClick={() => handleDelete(f.id)} className="rounded p-1 opacity-0 group-hover:opacity-100 hover:bg-muted transition" aria-label="Delete">
                    <Trash2 className="size-4 text-red-400" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {creating && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setCreating(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-display text-lg font-semibold">New folder</h3>
            <p className="mb-4 text-sm text-muted-foreground">Enter a name for the folder.</p>
            <input
              value={folderName}
              onChange={(e) => setFolderName(e.target.value)}
              placeholder="Folder name"
              className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              onKeyDown={(e) => { if (e.key === "Enter") handleCreateFolder(); }}
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setCreating(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleCreateFolder} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

