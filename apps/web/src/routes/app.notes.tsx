import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Plus, Search, Bold, Italic, List, ListOrdered, Link2, Trash2 } from "lucide-react";
import { notesApi } from "@/lib/api";

export const Route = createFileRoute("/app/notes")({ component: Notes });

function Notes() {
  const [notes, setNotes] = useState<any[]>([]);
  const [sel, setSel] = useState<any | null>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [bodyDraft, setBodyDraft] = useState("");
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    notesApi.list().then((data) => {
      const list = Array.isArray(data) ? data : [];
      setNotes(list);
      if (list.length > 0) {
        setSel(list[0]);
        setBodyDraft(list[0].content || list[0].body || "");
      }
    }).catch(() => setNotes([])).finally(() => setLoading(false));
  }, []);

  const handleSelect = (n: any) => {
    setSel(n);
    setBodyDraft(n.content || n.body || "");
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await notesApi.delete(id);
      const next = notes.filter((n) => n.id !== id);
      setNotes(next);
      if (sel?.id === id) {
        if (next.length > 0) { setSel(next[0]); setBodyDraft(next[0].content || next[0].body || ""); }
        else { setSel(null); setBodyDraft(""); }
      }
    } catch {}
  };

  const handleAdd = async () => {
    if (!newTitle.trim()) return;
    try {
      const note = await notesApi.create({ title: newTitle.trim(), content: "" });
      const next = [note, ...notes];
      setNotes(next);
      setSel(note);
      setBodyDraft("");
      setNewTitle("");
      setIsOpen(false);
    } catch {}
  };

  const handleBodyChange = (value: string) => {
    setBodyDraft(value);
    if (saveTimeout) clearTimeout(saveTimeout);
    const t = setTimeout(() => {
      if (sel) {
        notesApi.update(sel.id, { content: value }).catch(() => {});
      }
    }, 800);
    setSaveTimeout(t);
  };

  const handleTitleChange = (value: string) => {
    if (!sel) return;
    setSel({ ...sel, title: value });
    setNotes((prev) => prev.map((n) => n.id === sel.id ? { ...n, title: value } : n));
    if (saveTimeout) clearTimeout(saveTimeout);
    const t = setTimeout(() => {
      notesApi.update(sel.id, { title: value }).catch(() => {});
    }, 800);
    setSaveTimeout(t);
  };

  if (loading) {
    return <div className="grid h-[calc(100vh-130px)] place-items-center text-sm text-muted-foreground">Loading notes…</div>;
  }

  return (
    <div className="grid h-[calc(100vh-130px)] gap-4 lg:grid-cols-[280px_1fr]">
      <aside className="glass flex flex-col rounded-2xl p-3">
        <div className="mb-3 flex items-center gap-2">
          <div className="text-sm font-semibold">All Notes</div>
          <button onClick={() => setIsOpen(true)} className="ml-auto rounded p-1 hover:bg-muted" aria-label="Add note"><Plus className="size-4" /></button>
        </div>
        <div className="mb-3 flex items-center gap-2 rounded-lg bg-muted px-2 py-1.5"><Search className="size-3 text-muted-foreground" /><input className="flex-1 bg-transparent text-xs outline-none" placeholder="Search…" /></div>
        {notes.length === 0 ? (
          <div className="flex-1 grid place-items-center text-xs text-muted-foreground">No notes yet — create one to get started</div>
        ) : (
          <ul className="flex-1 space-y-1 overflow-y-auto">
            {notes.map((n) => (
              <li key={n.id}>
                <div className={`group flex items-center gap-2 rounded-lg p-2 ${sel?.id === n.id ? "bg-gradient-astra text-white" : "hover:bg-muted"}`}>
                  <button onClick={() => handleSelect(n)} className="block flex-1 text-left">
                    <div className="text-sm font-medium">{n.title}</div>
                    <div className={`text-[10px] ${sel?.id === n.id ? "text-white/70" : "text-muted-foreground"}`}>{n.updated_at ? new Date(n.updated_at).toLocaleDateString() : ""}</div>
                  </button>
                  <button onClick={(e) => handleDelete(e, n.id)} className={`rounded p-1 opacity-0 transition-opacity group-hover:opacity-100 ${sel?.id === n.id ? "hover:bg-white/20" : "hover:bg-muted"}`} aria-label="Delete note"><Trash2 className="size-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </aside>

      <section className="glass flex flex-col overflow-hidden rounded-2xl">
        {sel ? (
          <>
            <div className="flex items-center justify-between border-b border-border/60 px-4 py-2">
              <input className="bg-transparent font-display text-xl font-bold outline-none" value={sel.title} onChange={(e) => handleTitleChange(e.target.value)} />
              <div className="text-xs text-muted-foreground">{sel.updated_at ? `Last edited ${new Date(sel.updated_at).toLocaleDateString()}` : ""}</div>
            </div>
            <div className="flex gap-1 border-b border-border/60 px-3 py-2 text-muted-foreground">
              {[Bold, Italic, List, ListOrdered, Link2].map((I, i) => <button key={i} className="rounded p-1.5 hover:bg-muted hover:text-foreground"><I className="size-4" /></button>)}
            </div>
            <textarea className="flex-1 resize-none bg-transparent p-6 font-mono text-sm leading-7 outline-none" value={bodyDraft} onChange={(e) => handleBodyChange(e.target.value)} />
          </>
        ) : (
          <div className="grid flex-1 place-items-center text-sm text-muted-foreground">Select or create a note</div>
        )}
      </section>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setIsOpen(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-1 font-display text-lg font-semibold">Add new note</h3>
            <p className="mb-4 text-sm text-muted-foreground">Enter a title for your note.</p>
            <input
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="Note title"
              className="mb-4 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
              onKeyDown={(e) => { if (e.key === "Enter") handleAdd(); }}
              autoFocus
            />
            <div className="flex justify-end">
              <button onClick={handleAdd} className="rounded-lg bg-primary px-5 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90">Continue</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
