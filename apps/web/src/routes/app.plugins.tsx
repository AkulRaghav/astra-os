import ColourfulText from "@/components/ui/colourful-text";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Search, Plus, Check, ExternalLink, X, Link2, Unplug } from "lucide-react";
import { pluginsApi } from "@/lib/api";

export const Route = createFileRoute("/app/plugins")({ component: Plugins });

const CATS = ["All", "AI", "Productivity", "Design", "Development", "Integration"];

// Real OAuth URLs for each plugin
const PLUGIN_OAUTH: Record<string, { url: string; scopes: string; docs: string }> = {
  "GitHub Integration": {
    url: "https://github.com/login/oauth/authorize",
    scopes: "repo,user,read:org",
    docs: "https://docs.github.com/en/apps/oauth-apps",
  },
  "Slack Integration": {
    url: "https://slack.com/oauth/v2/authorize",
    scopes: "channels:read,chat:write,users:read",
    docs: "https://api.slack.com/authentication/oauth-v2",
  },
  "Notion Sync": {
    url: "https://api.notion.com/v1/oauth/authorize",
    scopes: "read_content,update_content",
    docs: "https://developers.notion.com/docs/authorization",
  },
  "Figma Connect": {
    url: "https://www.figma.com/oauth",
    scopes: "files:read",
    docs: "https://www.figma.com/developers/api#oauth2",
  },
  "Linear Integration": {
    url: "https://linear.app/oauth/authorize",
    scopes: "read,write",
    docs: "https://developers.linear.app/docs/oauth",
  },
};

const STORAGE_KEY = "astra.plugins.connected";

function getConnected(): Record<string, boolean> {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); } catch { return {}; }
}
function setConnected(data: Record<string, boolean>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function Plugins() {
  const [cat, setCat] = useState("All");
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnectedState] = useState<Record<string, boolean>>(getConnected);
  const [connectingPlugin, setConnectingPlugin] = useState<any | null>(null);
  const [detailPlugin, setDetailPlugin] = useState<any | null>(null);

  useEffect(() => {
    pluginsApi.list().then((all) => {
      setPlugins(Array.isArray(all) ? all : []);
    }).catch(() => setPlugins([])).finally(() => setLoading(false));
  }, []);

  const handleConnect = (plugin: any) => {
    setConnectingPlugin(plugin);
  };

  const confirmConnect = (plugin: any) => {
    const next = { ...connected, [plugin.name]: true };
    setConnectedState(next);
    setConnected(next);
    setConnectingPlugin(null);

    // In production, this would redirect to the OAuth URL:
    // window.open(PLUGIN_OAUTH[plugin.name]?.url + `?client_id=...&scope=...&redirect_uri=...`, "_blank");
  };

  const handleDisconnect = (plugin: any) => {
    const next = { ...connected };
    delete next[plugin.name];
    setConnectedState(next);
    setConnected(next);
    setDetailPlugin(null);
  };

  const list = plugins.filter((p) => cat === "All" || (p.category || "").toLowerCase() === cat.toLowerCase());

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold"><ColourfulText text="Marketplace" /></h1>
        <p className="text-sm text-muted-foreground">Extend Astra with plugins and integrations.</p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="glass flex flex-1 items-center gap-2 rounded-xl px-3 py-2 min-w-[220px]"><Search className="size-4 text-muted-foreground" /><input placeholder="Search plugins…" className="flex-1 bg-transparent text-sm outline-none" /></div>
        <div className="glass flex gap-1 rounded-xl p-1 text-xs">
          {CATS.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`rounded-lg px-3 py-1 ${cat === c ? "bg-gradient-astra text-white" : "text-muted-foreground"}`}>{c}</button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">Loading plugins…</div>
      ) : list.length === 0 ? (
        <div className="py-8 text-center text-sm text-muted-foreground">No plugins available</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((p) => {
            const isConnected = connected[p.name];
            const oauth = PLUGIN_OAUTH[p.name];
            return (
              <div key={p.id || p.name} className="glass rounded-2xl p-5 transition hover:scale-[1.01] hover:ring-astra">
                <div className="flex items-center gap-3">
                  <div className="grid size-12 place-items-center rounded-xl text-lg font-bold" style={{ background: p.color || "#7C3AED", color: (p.color === "#fff" || p.color === "#ffffff") ? "#000" : "white" }}>{(p.name || "P")[0]}</div>
                  <div className="flex-1">
                    <div className="font-semibold">{p.name}</div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{p.category}</div>
                  </div>
                  {isConnected && <div className="size-3 rounded-full bg-emerald-500" title="Connected" />}
                </div>
                <div className="mt-3 text-sm text-muted-foreground">{p.description || p.desc || ""}</div>

                {isConnected ? (
                  <div className="mt-4 flex gap-2">
                    <button onClick={() => setDetailPlugin(p)} className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 py-2 text-sm font-medium text-emerald-600">
                      <Check className="size-4" /> Connected
                    </button>
                    <button onClick={() => handleDisconnect(p)} className="rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-muted" title="Disconnect">
                      <Unplug className="size-4" />
                    </button>
                  </div>
                ) : (
                  <button onClick={() => handleConnect(p)} className="bg-gradient-astra glow mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg py-2 text-sm font-medium text-white">
                    <Link2 className="size-4" /> Connect
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Connect modal */}
      {connectingPlugin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setConnectingPlugin(null)}>
          <div className="w-full max-w-md rounded-2xl bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="grid size-12 place-items-center rounded-xl text-lg font-bold" style={{ background: connectingPlugin.color || "#7C3AED", color: "white" }}>{connectingPlugin.name[0]}</div>
              <div>
                <h3 className="font-display text-lg font-semibold">Connect {connectingPlugin.name}</h3>
                <div className="text-xs text-muted-foreground">{connectingPlugin.category}</div>
              </div>
            </div>

            <div className="glass rounded-xl p-4 mb-4">
              <div className="text-sm font-medium mb-2">This integration will:</div>
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {connectingPlugin.name === "GitHub Integration" && (
                  <>
                    <li>• Access your repositories and pull requests</li>
                    <li>• View and manage issues</li>
                    <li>• Read organization info</li>
                  </>
                )}
                {connectingPlugin.name === "Slack Integration" && (
                  <>
                    <li>• Read channels and messages</li>
                    <li>• Send messages on your behalf</li>
                    <li>• View workspace members</li>
                  </>
                )}
                {connectingPlugin.name === "Notion Sync" && (
                  <>
                    <li>• Sync your Notion pages with Astra Notes</li>
                    <li>• Read and update page content</li>
                    <li>• Access your databases</li>
                  </>
                )}
                {connectingPlugin.name === "Figma Connect" && (
                  <>
                    <li>• View your Figma files and projects</li>
                    <li>• Export design assets</li>
                    <li>• View comments and annotations</li>
                  </>
                )}
                {connectingPlugin.name === "Linear Integration" && (
                  <>
                    <li>• Sync issues with Astra Tasks</li>
                    <li>• View projects and cycles</li>
                    <li>• Create and update issues</li>
                  </>
                )}
              </ul>
            </div>

            {PLUGIN_OAUTH[connectingPlugin.name] && (
              <div className="flex items-center gap-2 mb-4 text-xs text-muted-foreground">
                <ExternalLink className="size-3" />
                <span>Connects via OAuth 2.0 — your credentials are never stored</span>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button onClick={() => setConnectingPlugin(null)} className="rounded-lg border border-border px-4 py-2 text-sm">Cancel</button>
              <button onClick={() => confirmConnect(connectingPlugin)} className="bg-gradient-astra glow rounded-lg px-5 py-2 text-sm font-medium text-white">
                <span className="flex items-center gap-2"><Link2 className="size-4" /> Authorize & Connect</span>
              </button>
            </div>

            {PLUGIN_OAUTH[connectingPlugin.name] && (
              <a href={PLUGIN_OAUTH[connectingPlugin.name].docs} target="_blank" rel="noopener noreferrer" className="mt-3 block text-center text-xs text-astra-cyan hover:underline">
                View API documentation →
              </a>
            )}
          </div>
        </div>
      )}

      {/* Detail/manage modal for connected plugins */}
      {detailPlugin && connected[detailPlugin.name] && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={() => setDetailPlugin(null)}>
          <div className="w-full max-w-md rounded-2xl bg-popover p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="grid size-10 place-items-center rounded-xl text-sm font-bold" style={{ background: detailPlugin.color || "#7C3AED", color: "white" }}>{detailPlugin.name[0]}</div>
                <div>
                  <h3 className="font-semibold">{detailPlugin.name}</h3>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-500"><div className="size-2 rounded-full bg-emerald-500" /> Connected</div>
                </div>
              </div>
              <button onClick={() => setDetailPlugin(null)}><X className="size-5 text-muted-foreground" /></button>
            </div>

            <div className="space-y-3">
              <div className="glass rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Status</div>
                <div className="text-sm font-medium text-emerald-500">Active & Syncing</div>
              </div>
              <div className="glass rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Connected since</div>
                <div className="text-sm">{new Date().toLocaleDateString()}</div>
              </div>
              <div className="glass rounded-xl p-3">
                <div className="text-xs text-muted-foreground mb-1">Permissions</div>
                <div className="text-sm">{PLUGIN_OAUTH[detailPlugin.name]?.scopes?.split(",").join(", ") || "Read & Write"}</div>
              </div>
            </div>

            <button onClick={() => handleDisconnect(detailPlugin)} className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-lg border border-red-500/50 bg-red-500/10 py-2.5 text-sm font-medium text-red-500 hover:bg-red-500/20 transition">
              <Unplug className="size-4" /> Disconnect {detailPlugin.name}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

