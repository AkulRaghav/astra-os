import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect, useRef } from "react";
import { Play, Plus, Save, X, ChevronRight, File, Folder } from "lucide-react";

export const Route = createFileRoute("/app/code")({ component: CodeEditor });

const LANGUAGES: Record<string, { name: string; ext: string }> = {
  javascript: { name: "JavaScript", ext: "js" },
  typescript: { name: "TypeScript", ext: "ts" },
  python: { name: "Python", ext: "py" },
  java: { name: "Java", ext: "java" },
  c: { name: "C", ext: "c" },
  cpp: { name: "C++", ext: "cpp" },
  go: { name: "Go", ext: "go" },
  rust: { name: "Rust", ext: "rs" },
  html: { name: "HTML", ext: "html" },
  css: { name: "CSS", ext: "css" },
  json: { name: "JSON", ext: "json" },
  bash: { name: "Bash", ext: "sh" },
  markdown: { name: "Markdown", ext: "md" },
};

function detectLanguage(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  for (const [lang, info] of Object.entries(LANGUAGES)) {
    if (info.ext === ext) return lang;
  }
  return "plaintext";
}

interface EditorFile {
  id: string;
  name: string;
  content: string;
  language: string;
  saved: boolean;
}

const STORAGE_KEY = "astra.code_editor.files";

function loadFiles(): EditorFile[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return [];
}

function saveFiles(files: EditorFile[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

function CodeEditor() {
  const [files, setFiles] = useState<EditorFile[]>(loadFiles);
  const [activeId, setActiveId] = useState<string | null>(() => files[0]?.id || null);
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);
  const [showNewFile, setShowNewFile] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [sidebarWidth] = useState(200);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const activeFile = files.find((f) => f.id === activeId) || null;

  useEffect(() => { saveFiles(files); }, [files]);

  const createFile = () => {
    if (!newFileName.trim()) return;
    const name = newFileName.trim();
    const lang = detectLanguage(name);
    const newFile: EditorFile = {
      id: `file_${Date.now()}`,
      name,
      content: getTemplate(lang),
      language: lang,
      saved: true,
    };
    setFiles([...files, newFile]);
    setActiveId(newFile.id);
    setNewFileName("");
    setShowNewFile(false);
  };

  const closeFile = (id: string) => {
    const next = files.filter((f) => f.id !== id);
    setFiles(next);
    if (activeId === id) setActiveId(next[0]?.id || null);
  };

  const updateContent = (content: string) => {
    setFiles(files.map((f) => f.id === activeId ? { ...f, content, saved: false } : f));
  };

  const saveFile = () => {
    setFiles(files.map((f) => f.id === activeId ? { ...f, saved: true } : f));
  };

  const runCode = async () => {
    if (!activeFile || running) return;
    setRunning(true);
    setOutput("Running...");
    try {
      const resp = await fetch("http://localhost:8082/api/v1/execute/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: activeFile.content,
          language: activeFile.language,
        }),
      });
      const data = await resp.json();
      if (data.success) {
        setOutput(data.output || "(no output)");
      } else {
        setOutput(data.error || data.output || "Execution failed");
      }
    } catch (e: any) {
      setOutput(`Error: ${e.message}`);
    } finally {
      setRunning(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveFile(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") { e.preventDefault(); runCode(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });

  const lineCount = (activeFile?.content || "").split("\n").length;

  return (
    <div className="flex h-[calc(100vh-110px)] flex-col glass-strong rounded-2xl overflow-hidden">
      {/* Tab bar */}
      <div className="flex items-center border-b border-border/60 bg-muted/40 text-xs overflow-x-auto">
        {files.map((f) => (
          <div
            key={f.id}
            onClick={() => setActiveId(f.id)}
            className={`flex items-center gap-1.5 border-r border-border/60 px-3 py-2 cursor-pointer whitespace-nowrap ${activeId === f.id ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            <File className="size-3" />
            <span>{f.name}</span>
            {!f.saved && <span className="size-2 rounded-full bg-orange-400" />}
            <button onClick={(e) => { e.stopPropagation(); closeFile(f.id); }} className="ml-1 rounded hover:bg-muted p-0.5"><X className="size-3" /></button>
          </div>
        ))}
        <button onClick={() => setShowNewFile(true)} className="px-2 py-2 text-muted-foreground hover:text-foreground"><Plus className="size-3.5" /></button>
        {activeFile && (
          <div className="ml-auto flex items-center gap-1 px-2">
            <button onClick={saveFile} className="rounded px-2 py-1 text-[10px] hover:bg-muted" title="Ctrl+S"><Save className="size-3 inline mr-1" />Save</button>
            <button onClick={runCode} disabled={running} className="rounded bg-emerald-600 px-2 py-1 text-[10px] text-white hover:bg-emerald-500 disabled:opacity-50" title="Ctrl+Enter"><Play className="size-3 inline mr-1" />{running ? "..." : "Run"}</button>
          </div>
        )}
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Sidebar - file tree */}
        <aside className="w-[180px] shrink-0 border-r border-border/60 bg-muted/20 p-2 overflow-y-auto hidden md:block">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2 px-1">Explorer</div>
          {files.length === 0 ? (
            <div className="text-xs text-muted-foreground/50 px-1">No files</div>
          ) : (
            files.map((f) => (
              <div
                key={f.id}
                onClick={() => setActiveId(f.id)}
                className={`flex items-center gap-1.5 rounded px-2 py-1 text-xs cursor-pointer ${activeId === f.id ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}
              >
                <File className="size-3" />
                <span className="truncate">{f.name}</span>
              </div>
            ))
          )}
        </aside>

        {/* Editor area */}
        <div className="flex-1 flex flex-col min-w-0">
          {activeFile ? (
            <>
              <div className="flex-1 flex min-h-0 overflow-hidden">
                {/* Line numbers */}
                <div className="shrink-0 w-[45px] bg-[#0a0a0f] p-2 text-right font-mono text-[11px] text-muted-foreground/40 select-none overflow-hidden">
                  {Array.from({ length: lineCount }).map((_, i) => (
                    <div key={i} className="leading-[1.6rem]">{i + 1}</div>
                  ))}
                </div>
                {/* Code textarea */}
                <textarea
                  ref={textareaRef}
                  value={activeFile.content}
                  onChange={(e) => updateContent(e.target.value)}
                  spellCheck={false}
                  className="flex-1 resize-none bg-[#0a0a0f] p-2 font-mono text-[13px] leading-[1.6rem] text-green-400 outline-none overflow-auto"
                  style={{ tabSize: 2 }}
                />
              </div>

              {/* Output panel */}
              {output && (
                <div className="h-[140px] shrink-0 border-t border-border/60 bg-[#0a0a0f] p-3 overflow-y-auto">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Output</span>
                    <button onClick={() => setOutput("")} className="text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
                  </div>
                  <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap">{output}</pre>
                </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
              <div className="text-center">
                <div className="text-lg mb-2">No file open</div>
                <div className="text-xs text-muted-foreground/60">Create a new file to start coding</div>
                <button onClick={() => setShowNewFile(true)} className="mt-3 bg-gradient-astra rounded-lg px-4 py-2 text-xs text-white">+ New File</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between border-t border-border/60 bg-gradient-astra px-3 py-1 font-mono text-[11px] text-white">
        <div className="flex gap-3">
          <span>main</span>
          <span>⚠ 0</span>
          <span>✖ 0</span>
        </div>
        <div className="flex gap-3">
          <span>Ln {1}, Col {1}</span>
          <span>Spaces: 2</span>
          <span>UTF-8</span>
          <span>{activeFile ? LANGUAGES[activeFile.language]?.name || activeFile.language : ""}</span>
        </div>
      </div>

      {/* New file modal */}
      {showNewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setShowNewFile(false)}>
          <div className="w-full max-w-sm rounded-2xl bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-display text-lg font-semibold mb-1">New File</h3>
            <p className="text-sm text-muted-foreground mb-4">Enter filename with extension (e.g. main.py, app.js, Main.java)</p>
            <input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder="filename.ext"
              className="w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm font-mono outline-none focus:border-primary"
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") createFile(); }}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {["main.py", "app.js", "Main.java", "main.go", "main.rs", "index.html", "style.css"].map((s) => (
                <button key={s} onClick={() => setNewFileName(s)} className="rounded bg-muted px-2 py-0.5 text-[10px] font-mono hover:bg-muted/80">{s}</button>
              ))}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowNewFile(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={createFile} disabled={!newFileName.trim()} className="bg-gradient-astra rounded-lg px-5 py-2 text-sm font-medium text-white disabled:opacity-50">Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function getTemplate(lang: string): string {
  switch (lang) {
    case "python": return '# Python\nprint("Hello, World!")\n';
    case "javascript": return '// JavaScript\nconsole.log("Hello, World!");\n';
    case "typescript": return '// TypeScript\nconst msg: string = "Hello, World!";\nconsole.log(msg);\n';
    case "java": return 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}\n';
    case "c": return '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}\n';
    case "cpp": return '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}\n';
    case "go": return 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}\n';
    case "rust": return 'fn main() {\n    println!("Hello, World!");\n}\n';
    case "html": return '<!DOCTYPE html>\n<html>\n<head>\n    <title>Hello</title>\n</head>\n<body>\n    <h1>Hello, World!</h1>\n</body>\n</html>\n';
    case "css": return 'body {\n    font-family: sans-serif;\n    background: #0a0a0f;\n    color: #22c55e;\n}\n';
    case "json": return '{\n    "name": "astra",\n    "version": "1.0.0"\n}\n';
    case "bash": return '#!/bin/bash\necho "Hello, World!"\n';
    case "markdown": return '# Hello World\n\nWelcome to Astra Code Editor.\n';
    default: return '';
  }
}
