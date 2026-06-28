import { createFileRoute } from "@tanstack/react-router";
import { useState, useRef, useEffect } from "react";
import { Play, RotateCcw } from "lucide-react";
import { Terminal } from "@/components/ui/terminal";

export const Route = createFileRoute("/app/terminal")({ component: TerminalPage });

const LANGUAGES = [
  { id: "python", name: "Python", version: "3.10.0", ext: "py" },
  { id: "java", name: "Java", version: "15.0.2", ext: "java" },
  { id: "javascript", name: "Node.js", version: "18.15.0", ext: "js" },
  { id: "typescript", name: "TypeScript", version: "5.0.3", ext: "ts" },
  { id: "c", name: "C", version: "10.2.0", ext: "c" },
  { id: "cpp", name: "C++", version: "10.2.0", ext: "cpp" },
  { id: "go", name: "Go", version: "1.16.2", ext: "go" },
  { id: "rust", name: "Rust", version: "1.68.2", ext: "rs" },
  { id: "bash", name: "Bash", version: "5.2.0", ext: "sh" },
];

function TerminalPage() {
  const [mode, setMode] = useState<"interactive" | "demo">("interactive");
  const [activeLang, setActiveLang] = useState(0);
  const [code, setCode] = useState(() => getPlaceholder("python"));
  const [output, setOutput] = useState<{ text: string; isError: boolean }[]>([]);
  const [running, setRunning] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setCode(getPlaceholder(LANGUAGES[activeLang].id));
    setOutput([]);
  }, [activeLang]);

  useEffect(() => {
    outputRef.current?.scrollTo(0, outputRef.current.scrollHeight);
  }, [output]);

  const handleRun = async () => {
    if (!code.trim() || running) return;
    const lang = LANGUAGES[activeLang];
    setRunning(true);

    let codeToRun = code;
    const looksLikePrompt = /^(write|create|make|generate|build|show|give me|can you|i want|how to|writ|crete|mak|genrate|bild)/i.test(code.trim());

    if (looksLikePrompt) {
      setOutput([{ text: `Generating ${lang.name} code...`, isError: false }]);
      try {
        const aiResp = await fetch("http://localhost:8082/api/v1/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: "terminal_gen",
            message: `Write ${lang.name} code for: ${code}. Return ONLY code, no markdown, no backticks. For Java use class Main.`,
            agent_type: "assistant", user_id: "terminal", history: [],
          }),
        });
        const aiData = await aiResp.json();
        let generated = (aiData.content || "").trim().replace(/^```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();
        if (generated) { codeToRun = generated; setCode(generated); }
      } catch {}
    }

    setOutput([{ text: `Running ${lang.name} (v${lang.version})...`, isError: false }]);
    try {
      const resp = await fetch("http://localhost:8082/api/v1/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversation_id: "terminal_exec",
          message: `Execute this ${lang.id} code. Return ONLY the exact output. No explanations, no markdown. If error, show the error:\n\n${codeToRun}`,
          agent_type: "assistant", user_id: "terminal_exec", history: [],
        }),
      });
      const data = await resp.json();
      const content = (data.content || "").trim();
      if (content.toLowerCase().startsWith("error") || content.includes("Exception") || content.includes("Traceback")) {
        // Try to auto-fix
        const fixResp = await fetch("http://localhost:8082/api/v1/chat/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            conversation_id: "terminal_fix",
            message: `Fix this ${lang.id} code. Error: ${content}\n\nCode:\n${codeToRun}\n\nReturn ONLY the fixed code, no markdown.`,
            agent_type: "assistant", user_id: "terminal", history: [],
          }),
        });
        const fixData = await fixResp.json();
        let fixed = (fixData.content || "").trim().replace(/^```[\w]*\n?/gm, "").replace(/```$/gm, "").trim();
        if (fixed && fixed !== codeToRun) {
          setCode(fixed);
          const retryResp = await fetch("http://localhost:8082/api/v1/chat/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              conversation_id: "terminal_exec2",
              message: `Execute this ${lang.id} code. Return ONLY the output:\n\n${fixed}`,
              agent_type: "assistant", user_id: "terminal_exec", history: [],
            }),
          });
          const retryData = await retryResp.json();
          setOutput([
            { text: "✓ Code auto-corrected:", isError: false },
            { text: (retryData.content || "").trim(), isError: false },
          ]);
          setRunning(false);
          return;
        }
      }
      setOutput([{ text: content, isError: content.toLowerCase().includes("error") }]);
    } catch (e: any) {
      setOutput([{ text: `Error: ${e.message}`, isError: true }]);
    } finally {
      setRunning(false);
    }
  };

  if (mode === "demo") {
    return (
      <div className="flex h-[calc(100vh-110px)] flex-col gap-4">
        <div className="flex items-center justify-between">
          <h1 className="font-display text-xl font-bold">Terminal Demo</h1>
          <button onClick={() => setMode("interactive")} className="glass rounded-lg px-3 py-1.5 text-xs hover:bg-muted">Switch to Interactive</button>
        </div>
        <Terminal
          commands={[
            "npx create-astra-app my-project",
            "cd my-project && npm install",
            "npm run dev",
            "echo 'Astra OS is running!'",
          ]}
          outputs={{
            0: ["✔ Creating new Astra project...", "✔ Project scaffolded successfully.", "✔ Dependencies configured."],
            1: ["added 847 packages in 12s", "✔ All dependencies installed."],
            2: ["✔ Compiled successfully.", "  ➜ Local:   http://localhost:3000/", "  ➜ Network: http://192.168.1.5:3000/"],
            3: ["Astra OS is running!"],
          }}
          typingSpeed={40}
          delayBetweenCommands={1200}
        />
      </div>
    );
  }

  const lang = LANGUAGES[activeLang];

  return (
    <div className="flex h-[calc(100vh-110px)] flex-col">
      <div className="glass-strong overflow-hidden rounded-2xl flex flex-col h-full">
        {/* Top bar */}
        <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-red-500" />
            <span className="size-3 rounded-full bg-yellow-500" />
            <span className="size-3 rounded-full bg-green-500" />
          </div>
          <div className="ml-3 flex gap-1 overflow-x-auto">
            {LANGUAGES.map((l, i) => (
              <button key={l.id} onClick={() => setActiveLang(i)} className={`rounded-md px-2.5 py-1 font-mono text-xs whitespace-nowrap ${activeLang === i ? "bg-background text-foreground" : "text-muted-foreground hover:text-foreground"}`}>{l.name}</button>
            ))}
          </div>
          <div className="ml-auto flex gap-2">
            <button onClick={() => setMode("demo")} className="rounded-lg border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted">Demo</button>
            <button onClick={() => { setCode(getPlaceholder(LANGUAGES[activeLang].id)); setOutput([]); }} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted" title="Reset"><RotateCcw className="size-3.5" /></button>
            <button onClick={handleRun} disabled={running || !code.trim()} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500 disabled:opacity-50 transition">
              <Play className="size-3" /> {running ? "Running..." : "Run"}
            </button>
          </div>
        </div>

        {/* Editor + Output */}
        <div className="flex-1 grid grid-rows-[1fr_auto] min-h-0">
          <div className="relative overflow-hidden border-b border-border/60">
            <div className="absolute top-2 right-3 text-[10px] font-mono text-muted-foreground/60">{lang.name} v{lang.version}</div>
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              spellCheck={false}
              className="h-full w-full resize-none bg-[#0a0a0f] p-4 font-mono text-sm text-green-400 outline-none placeholder:text-muted-foreground/40"
              placeholder={`Write ${lang.name} code or describe what you want...`}
            />
          </div>
          <div ref={outputRef} className="h-[180px] overflow-y-auto bg-[#0a0a0f] p-4">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Output</div>
            {output.length === 0 ? (
              <div className="text-xs text-muted-foreground/50 font-mono">Click "Run" to execute • Type code or describe what you want</div>
            ) : (
              output.map((line, i) => (
                <pre key={i} className={`text-sm font-mono whitespace-pre-wrap ${line.isError ? "text-red-400" : "text-green-400"}`}>{line.text}</pre>
              ))
            )}
          </div>
        </div>

        <div className="flex items-center justify-between border-t border-border/60 bg-gradient-astra px-3 py-1 font-mono text-[11px] text-white">
          <div className="flex gap-3"><span>{lang.name}</span><span>v{lang.version}</span></div>
          <div className="flex gap-3"><span>AI-Powered</span><span>Groq + Astra</span></div>
        </div>
      </div>
    </div>
  );
}

function getPlaceholder(lang: string): string {
  switch (lang) {
    case "python": return 'print("Hello, World!")';
    case "java": return 'public class Main {\n    public static void main(String[] args) {\n        System.out.println("Hello, World!");\n    }\n}';
    case "javascript": return 'console.log("Hello, World!");';
    case "typescript": return 'const greeting: string = "Hello, World!";\nconsole.log(greeting);';
    case "c": return '#include <stdio.h>\n\nint main() {\n    printf("Hello, World!\\n");\n    return 0;\n}';
    case "cpp": return '#include <iostream>\nusing namespace std;\n\nint main() {\n    cout << "Hello, World!" << endl;\n    return 0;\n}';
    case "go": return 'package main\n\nimport "fmt"\n\nfunc main() {\n    fmt.Println("Hello, World!")\n}';
    case "rust": return 'fn main() {\n    println!("Hello, World!");\n}';
    case "bash": return 'echo "Hello, World!"';
    default: return "";
  }
}
