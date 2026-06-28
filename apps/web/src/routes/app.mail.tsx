import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Inbox, Star, Send, FileEdit, AlertCircle, Trash2, Plus, Paperclip, Shield, Check, LogOut } from "lucide-react";
import { mailApi } from "@/lib/api";

export const Route = createFileRoute("/app/mail")({ component: Mail });

const FOLDERS = [
  { name: "Inbox", icon: Inbox, key: "inbox" },
  { name: "Starred", icon: Star, key: "starred" },
  { name: "Sent", icon: Send, key: "sent" },
  { name: "Drafts", icon: FileEdit, key: "drafts" },
  { name: "Spam", icon: AlertCircle, key: "spam" },
  { name: "Trash", icon: Trash2, key: "trash" },
];

const STORAGE_KEY = "astra.gmail.account";

function GoogleIcon({ className = "size-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/>
      <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3 0 5.8 1.1 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.6 39.6 16.2 44 24 44z"/>
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C41 35.4 44 30.1 44 24c0-1.3-.1-2.4-.4-3.5z"/>
    </svg>
  );
}

function ConnectGmail({ onConnect }: { onConnect: (email: string) => void }) {
  const [loading, setLoading] = useState(false);

  const handleConnect = () => {
    setLoading(true);
    // Redirect to Gmail OAuth via AI service
    window.location.href = "http://localhost:8082/api/v1/gmail/connect";
  };

  // Check if returning from OAuth
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("gmail") === "connected") {
      onConnect("connected@gmail.com");
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, [onConnect]);

  return (
    <div className="grid h-[calc(100vh-130px)] place-items-center">
      <div className="glass w-full max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto mb-5 grid size-16 place-items-center rounded-2xl bg-white shadow-md">
          <GoogleIcon className="size-9" />
        </div>
        <h1 className="font-display text-2xl font-bold">Connect your Gmail</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Sign in with your Google account to read and send mail from Astra.
        </p>
        <button
          onClick={handleConnect}
          disabled={loading}
          className="mt-6 inline-flex w-full items-center justify-center gap-3 rounded-xl border border-border bg-white px-4 py-3 text-sm font-medium text-neutral-800 shadow-sm transition hover:scale-[1.01] hover:shadow-md"
        >
          {loading ? "Connecting..." : <><GoogleIcon /> Continue with Google</>}
        </button>
        <div className="mt-6 flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-left text-xs text-muted-foreground">
          <Shield className="mt-0.5 size-4 shrink-0" />
          <span>Astra requests read-only access to your Gmail via OAuth. Your password is never shared.</span>
        </div>
      </div>
    </div>
  );
}

function Mail() {
  const [account, setAccount] = useState<string | null>(() =>
    typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null,
  );
  const [emails, setEmails] = useState<any[]>([]);
  const [sel, setSel] = useState(0);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [loading, setLoading] = useState(false);
  const [composing, setComposing] = useState(false);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sentEmails, setSentEmails] = useState<any[]>(() => {
    try { return JSON.parse(localStorage.getItem("astra.sent_emails") || "[]"); } catch { return []; }
  });

  useEffect(() => {
    if (!account) return;
    setLoading(true);
    if (activeFolder === "sent") {
      setEmails(sentEmails);
      setSel(0);
      setLoading(false);
    } else if (activeFolder === "inbox") {
      // Fetch real Gmail inbox
      fetch("http://localhost:8082/api/v1/gmail/inbox")
        .then(r => r.json())
        .then(data => {
          if (data.emails && data.emails.length > 0) {
            setEmails(data.emails);
          } else {
            setEmails([]);
          }
          setSel(0);
        })
        .catch(() => setEmails([]))
        .finally(() => setLoading(false));
    } else {
      setEmails([]);
      setLoading(false);
    }
  }, [account, activeFolder, sentEmails]);

  const handleSend = async () => {
    if (!composeTo.trim() || !composeSubject.trim()) return;
    try {
      const resp = await fetch("http://localhost:8082/api/v1/mail/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: [composeTo.trim()], subject: composeSubject, body: composeBody, cc: [] }),
      });
      const data = await resp.json();
      if (data.success) {
        const sent = { id: data.id || Date.now(), subject: composeSubject, body: composeBody, to: composeTo, from: account, time: new Date().toLocaleString(), is_read: true };
        const updated = [sent, ...sentEmails];
        setSentEmails(updated);
        localStorage.setItem("astra.sent_emails", JSON.stringify(updated));
        setComposing(false); setComposeTo(""); setComposeSubject(""); setComposeBody("");
        alert("✓ Email sent successfully!");
      } else {
        alert("Failed to send: " + data.message);
      }
    } catch (e: any) {
      alert("Error sending email: " + (e.message || "Unknown error"));
    }
  };

  if (!account) {
    return (
      <ConnectGmail
        onConnect={(em) => {
          localStorage.setItem(STORAGE_KEY, em);
          setAccount(em);
        }}
      />
    );
  }

  const disconnect = () => {
    localStorage.removeItem(STORAGE_KEY);
    setAccount(null);
  };

  const e = emails[sel];

  return (
    <div className="grid h-[calc(100vh-130px)] gap-4 lg:grid-cols-[220px_320px_1fr]">
      <aside className="glass flex flex-col rounded-2xl p-3">
        <div className="mb-3 flex items-center gap-2 rounded-xl border border-border/60 bg-muted/40 p-2 text-xs">
          <GoogleIcon className="size-4" />
          <span className="truncate font-medium" title={account}>{account}</span>
        </div>
        <button onClick={() => setComposing(true)} className="bg-gradient-astra glow mb-3 inline-flex w-full items-center justify-center gap-2 rounded-xl py-2 text-sm font-medium text-white"><Plus className="size-4" /> Compose</button>
        <ul className="space-y-1 text-sm">
          {FOLDERS.map((f) => (
            <li key={f.name}><button onClick={() => setActiveFolder(f.key)} className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 ${activeFolder === f.key ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted/50"}`}>
              <f.icon className="size-4" /><span className="flex-1 text-left">{f.name}</span>
            </button></li>
          ))}
        </ul>
        <button onClick={disconnect} className="mt-auto inline-flex items-center justify-center gap-2 rounded-lg border border-border/60 px-2 py-1.5 text-xs text-muted-foreground hover:bg-muted/50">
          <LogOut className="size-3.5" /> Disconnect Gmail
        </button>
      </aside>

      <section className="glass overflow-hidden rounded-2xl">
        <div className="border-b border-border/60 p-3"><input className="w-full rounded-lg bg-muted px-3 py-1.5 text-sm outline-none" placeholder="Search mail…" /></div>
        {loading ? (
          <div className="p-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : emails.length === 0 ? (
          <div className="p-6 text-center text-sm text-muted-foreground">No emails — connect your email account to get started</div>
        ) : (
          <ul className="overflow-y-auto">
            {emails.map((em, i) => (
              <li key={em.id || i}><button onClick={() => setSel(i)} className={`block w-full border-b border-border/40 p-3 text-left transition hover:bg-muted/40 ${sel === i ? "bg-muted/60" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-sm ${em.unread || !em.is_read ? "font-bold" : ""}`}>{em.from || em.sender || "Unknown"}</span>
                  <span className="text-[10px] text-muted-foreground">{em.time || (em.created_at ? new Date(em.created_at).toLocaleDateString() : "")}</span>
                </div>
                <div className={`mt-0.5 text-xs ${em.unread || !em.is_read ? "font-semibold" : "text-muted-foreground"}`}>{em.subject}</div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">{em.preview || em.body?.slice(0, 80) || ""}</div>
              </button></li>
            ))}
          </ul>
        )}
      </section>

      <section className="glass overflow-y-auto rounded-2xl p-6">
        {e ? (
          <EmailDetail email={e} account={account || ""} />
        ) : (
          <div className="grid h-full place-items-center text-sm text-muted-foreground">Select an email to read</div>
        )}
      </section>

      {composing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setComposing(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-4 font-display text-lg font-semibold">Compose</h3>
            <input value={composeTo} onChange={(e) => setComposeTo(e.target.value)} placeholder="To" className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
            <input value={composeSubject} onChange={(e) => setComposeSubject(e.target.value)} placeholder="Subject" className="mb-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
            <textarea value={composeBody} onChange={(e) => setComposeBody(e.target.value)} placeholder="Write your message…" className="mb-4 h-40 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setComposing(false)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={handleSend} className="bg-gradient-astra glow rounded-lg px-5 py-2 text-sm font-medium text-white">Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmailDetail({ email, account }: { email: any; account: string }) {
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!email?.id) return;
    // If it's a sent email with body already, use it
    if (email.body && email.body.length > 5) {
      setBody(email.body);
      return;
    }
    // Fetch full message from Gmail API
    setLoading(true);
    setBody(null);
    fetch(`http://localhost:8082/api/v1/gmail/message/${email.id}`)
      .then(r => r.json())
      .then(data => {
        setBody(data.body || data.snippet || "No content available");
      })
      .catch(() => setBody("Failed to load email content"))
      .finally(() => setLoading(false));
  }, [email?.id]);

  const from = email.from || email.sender || "Unknown";
  const date = email.date || email.time || (email.created_at ? new Date(email.created_at).toLocaleString() : "");

  return (
    <>
      <div className="mb-1 text-xs text-muted-foreground">{date}</div>
      <h2 className="font-display text-xl font-bold">{email.subject}</h2>
      <div className="mt-3 flex items-center gap-3 border-b border-border/40 pb-3">
        <div className="bg-gradient-astra grid size-10 place-items-center rounded-full text-white">{from[0]?.toUpperCase() || "?"}</div>
        <div>
          <div className="text-sm font-medium">{from}</div>
          <div className="text-xs text-muted-foreground">to {account}</div>
        </div>
      </div>
      <div className="mt-5 max-w-none text-sm leading-7 text-foreground/90">
        {loading ? (
          <div className="text-muted-foreground">Loading...</div>
        ) : body ? (
          <div dangerouslySetInnerHTML={{ __html: body }} className="prose prose-sm max-w-none" />
        ) : (
          <div className="whitespace-pre-wrap">{email.snippet || "No content"}</div>
        )}
      </div>
    </>
  );
}
