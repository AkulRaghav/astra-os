import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Send, Paperclip, Plus, History, Sparkles, Loader2, Copy, Check } from "lucide-react";
import { aiApi } from "@/lib/api";

export const Route = createFileRoute("/app/ai")({ component: AIAssistant });

type Msg = { role: "user" | "ai"; text: string };
const PROMPTS = ["Generate a project idea", "Summarize this document", "Write code for…", "Explain this concept"];

function AIAssistant() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId] = useState(() => `conv_${Date.now()}`);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const updatedMessages = [...messages, { role: "user" as const, text }];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    // Build history for multi-turn context
    const history = updatedMessages.map(m => ({
      role: m.role === "ai" ? "assistant" : "user",
      content: m.text,
    }));

    try {
      const res = await aiApi.send(conversationId, text, "assistant", history.slice(-20));
      setMessages((m) => [...m, { role: "ai", text: res.content || res.message || "I received your message." }]);
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to get a response. Please check that the AI service is running.";
      setMessages((m) => [...m, { role: "ai", text: `Error: ${errorMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-110px)] flex-col">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2"><Sparkles className="size-5 text-astra-purple" /><h1 className="font-display text-xl font-bold">AI Assistant</h1><span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">powered by Groq</span></div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <button className="glass rounded-lg p-2 hover:scale-105 transition" aria-label="History"><History className="size-4" /></button>
          <button onClick={() => setMessages([])} className="glass rounded-lg p-2 hover:scale-105 transition" aria-label="New chat"><Plus className="size-4" /></button>
        </div>
      </div>

      <div className="glass flex-1 overflow-y-auto rounded-2xl p-6">
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-center">
            <div className="bg-gradient-astra glow grid size-16 place-items-center rounded-2xl text-white"><Sparkles className="size-7" /></div>
            <h2 className="mt-5 font-display text-2xl font-bold">Hello</h2>
            <p className="text-muted-foreground">How can I help you today?</p>
            <div className="mt-8 grid w-full max-w-2xl gap-2 sm:grid-cols-2">
              {PROMPTS.map((p) => (
                <button key={p} onClick={() => send(p)} className="glass rounded-xl p-3 text-left text-sm transition hover:ring-astra hover:scale-[1.02]">{p}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <AnimatePresence>
              {messages.map((m, i) => (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${m.role === "user" ? "bg-gradient-astra text-white" : "bg-muted"}`}>{m.role === "user" ? "U" : "✦"}</div>
                  <div className="relative group">
                    <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-gradient-astra text-white" : "glass"}`}>{m.text}</div>
                    {m.role === "ai" && <CopyButton text={m.text} />}
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            {loading && (
              <div className="flex gap-3">
                <div className="grid size-8 shrink-0 place-items-center rounded-lg bg-muted"><Loader2 className="size-4 animate-spin" /></div>
                <div className="glass max-w-[80%] rounded-2xl px-4 py-2.5 text-sm text-muted-foreground">Thinking…</div>
              </div>
            )}
          </div>
        )}
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="glass mt-4 flex items-center gap-2 rounded-2xl p-2">
        <button type="button" className="rounded-lg p-2 text-muted-foreground hover:text-foreground"><Paperclip className="size-4" /></button>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask anything…" className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground" disabled={loading} />
        <button type="submit" disabled={loading || !input.trim()} className="bg-gradient-astra glow grid size-9 place-items-center rounded-lg text-white transition hover:scale-105 disabled:opacity-50"><Send className="size-4" /></button>
      </form>
      <p className="mt-2 text-center text-[10px] text-muted-foreground">AI responses may be inaccurate. Please verify important information.</p>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="absolute -bottom-2 right-2 rounded-lg bg-muted p-1.5 text-muted-foreground opacity-0 transition hover:text-foreground group-hover:opacity-100"
      aria-label="Copy"
    >
      {copied ? <Check className="size-3.5 text-emerald-500" /> : <Copy className="size-3.5" />}
    </button>
  );
}
