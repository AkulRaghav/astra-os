import ColourfulText from "@/components/ui/colourful-text";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Send, ArrowLeft, Loader2 } from "lucide-react";
import { Icon } from "@/components/astra/Icon";
import { aiApi } from "@/lib/api";

export const Route = createFileRoute("/app/agents")({ component: Agents });

const KNOWN_AGENTS = [
  { name: "Assistant", type: "assistant", desc: "General-purpose AI assistant", icon: "Sparkles" },
  { name: "Code Helper", type: "code_helper", desc: "Assists with coding and debugging", icon: "Code2" },
  { name: "Data Analyst", type: "data_analyst", desc: "Analyzes data and generates insights", icon: "BarChart3" },
  { name: "Content Writer", type: "content_writer", desc: "Creates content and documents", icon: "PenLine" },
  { name: "Researcher", type: "researcher", desc: "Search and summarize information", icon: "Search" },
];

type Msg = { role: "user" | "ai"; text: string };

function Agents() {
  const [chatAgent, setChatAgent] = useState<typeof KNOWN_AGENTS[number] | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [conversationId] = useState(() => `agent_${Date.now()}`);

  const send = async (text: string) => {
    if (!text.trim() || loading || !chatAgent) return;
    setMessages((m) => [...m, { role: "user", text }]);
    setInput("");
    setLoading(true);
    try {
      const res = await aiApi.send(conversationId, text, chatAgent.type);
      setMessages((m) => [...m, { role: "ai", text: res.content || res.message || "Response received." }]);
    } catch (err: any) {
      const errorMsg = err?.message || "Failed to get response from agent.";
      setMessages((m) => [...m, { role: "ai", text: `Error: ${errorMsg}` }]);
    } finally {
      setLoading(false);
    }
  };

  if (chatAgent) {
    return (
      <div className="flex h-[calc(100vh-130px)] flex-col">
        <div className="mb-4 flex items-center gap-3">
          <button onClick={() => { setChatAgent(null); setMessages([]); }} className="rounded-lg p-2 hover:bg-muted"><ArrowLeft className="size-4" /></button>
          <div className="bg-gradient-astra grid size-10 place-items-center rounded-xl text-white"><Icon name={chatAgent.icon} className="size-5" /></div>
          <div>
            <div className="font-semibold">{chatAgent.name}</div>
            <div className="text-xs text-muted-foreground">{chatAgent.desc}</div>
          </div>
        </div>

        <div className="glass flex-1 overflow-y-auto rounded-2xl p-6">
          {messages.length === 0 ? (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">Start a conversation with {chatAgent.name}</div>
          ) : (
            <div className="space-y-4">
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                  <div className={`grid size-8 shrink-0 place-items-center rounded-lg ${m.role === "user" ? "bg-gradient-astra text-white" : "bg-muted"}`}>{m.role === "user" ? "U" : "✦"}</div>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${m.role === "user" ? "bg-gradient-astra text-white" : "glass"}`}>{m.text}</div>
                </div>
              ))}
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
          <input value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Ask ${chatAgent.name}…`} className="flex-1 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground" disabled={loading} />
          <button type="submit" disabled={loading || !input.trim()} className="bg-gradient-astra glow grid size-9 place-items-center rounded-lg text-white transition hover:scale-105 disabled:opacity-50"><Send className="size-4" /></button>
        </form>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold"><ColourfulText text="AI Agents" /></h1>
          <p className="text-sm text-muted-foreground">Specialized assistants working in your workspace.</p>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {KNOWN_AGENTS.map((a) => (
          <div key={a.type} className="glass group rounded-2xl p-5 transition hover:scale-[1.01] hover:ring-astra">
            <div className="flex items-start gap-3">
              <div className="bg-gradient-astra grid size-12 place-items-center rounded-xl text-white"><Icon name={a.icon} className="size-5" /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="font-semibold">{a.name}</div>
                </div>
                <div className="text-sm text-muted-foreground">{a.desc}</div>
                <div className="mt-3 flex gap-2">
                  <button onClick={() => setChatAgent(a)} className="rounded-lg bg-muted px-3 py-1 text-xs hover:bg-muted/80">Chat</button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

