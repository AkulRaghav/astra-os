import { createFileRoute, Link, Outlet, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, Search, Moon, Sun, ChevronLeft, ChevronRight, LogOut } from "lucide-react";
import { Icon } from "@/components/astra/Icon";
import { AstraLogo } from "@/components/astra/Logo";
import { setToken, isAuthenticated, userApi } from "@/lib/api";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

// Extract OAuth token from URL BEFORE component renders
function extractTokenFromURL() {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token");
  if (token) {
    setToken(token);
    window.history.replaceState({}, "", window.location.pathname);
  }
}
extractTokenFromURL();

// Check if user is authenticated - redirect to login if not
function checkAuth() {
  if (typeof window === "undefined") return;
  if (!isAuthenticated() && !window.location.search.includes("token=")) {
    // Allow access without auth for now (some features work without login)
    // But mark as unauthenticated
  }
}
checkAuth();

const NAV_ITEMS: { to: string; label: string; icon: string }[] = [
  { to: "/app", label: "Dashboard", icon: "LayoutDashboard" },
  { to: "/app/ai", label: "AI Assistant", icon: "Sparkles" },
  { to: "/app/files", label: "Files", icon: "Folder" },
  { to: "/app/terminal", label: "Terminal", icon: "TerminalSquare" },
  { to: "/app/browser", label: "Browser", icon: "Globe" },
  { to: "/app/code", label: "Code Editor", icon: "Code2" },
  { to: "/app/calendar", label: "Calendar", icon: "Calendar" },
  { to: "/app/mail", label: "Mail", icon: "Mail" },
  { to: "/app/tasks", label: "Tasks", icon: "CheckSquare" },
  { to: "/app/notes", label: "Notes", icon: "StickyNote" },
  { to: "/app/agents", label: "AI Agents", icon: "Bot" },
  { to: "/app/workspace", label: "Workspace", icon: "LayoutGrid" },
  { to: "/app/analytics", label: "Analytics", icon: "BarChart3" },
  { to: "/app/plugins", label: "Plugins", icon: "Puzzle" },
  { to: "/app/notifications", label: "Notifications", icon: "Bell" },
  { to: "/app/profile", label: "Profile", icon: "User" },
  { to: "/app/settings", label: "Settings", icon: "Settings" },
];

function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [dark, setDark] = useState(true);
  const [user, setUser] = useState<{ name: string; avatar: string; plan: string }>({
    name: "User",
    avatar: "https://api.dicebear.com/9.x/avataaars/svg?seed=User&backgroundColor=7c3aed",
    plan: "Free",
  });

  // Load user info for sidebar
  useEffect(() => {
    userApi.getMe().then((data) => {
      if (data) {
        setUser({
          name: data.display_name || data.name || "User",
          avatar: data.avatar || data.avatar_url || "https://api.dicebear.com/9.x/avataaars/svg?seed=User&backgroundColor=7c3aed",
          plan: data.plan || data.subscription || "Free",
        });
      }
    }).catch(() => {});
  }, []);

  const path = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className={`${dark ? "" : "light"} relative min-h-screen bg-background text-foreground`}>
      <div className="pointer-events-none fixed inset-0 -z-10 opacity-50"
        style={{ background: "radial-gradient(60% 60% at 80% 0%, oklch(0.55 0.28 295 / 0.18), transparent), radial-gradient(50% 50% at 0% 100%, oklch(0.6 0.22 250 / 0.15), transparent)" }} />

      <div className="flex min-h-screen">
        {/* SIDEBAR */}
        <aside className={`glass-strong relative z-20 hidden flex-col border-r border-border/60 transition-all md:flex ${collapsed ? "w-[72px]" : "w-[248px]"}`}>
          <div className="flex items-center justify-between p-4">
            {!collapsed && <Link to="/app"><AstraLogo size="sm" /></Link>}
            <button onClick={() => setCollapsed(!collapsed)} className="ml-auto rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition">
              {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
            </button>
          </div>

          <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-3">
            {NAV_ITEMS.map((item) => {
              const active = path === item.to || (item.to !== "/app" && path.startsWith(item.to));
              return (
                <Link key={item.to} to={item.to} className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${active ? "bg-gradient-astra text-white glow" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
                  <Icon name={item.icon} className="size-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              );
            })}
          </nav>

          <div className="border-t border-border/60 p-3">
            <div className="glass flex items-center gap-3 rounded-xl p-2">
              <img src={user.avatar} alt="" className="size-9 shrink-0 rounded-lg" />
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{user.name}</div>
                  <div className="truncate text-[10px] uppercase tracking-wider text-astra-cyan">{user.plan}</div>
                </div>
              )}
              {!collapsed && (
                <button onClick={() => { import("@/lib/api").then(m => { m.logout(); window.location.href = "/login"; }); }} className="text-muted-foreground hover:text-foreground" aria-label="Sign out"><LogOut className="size-4" /></button>
              )}
            </div>
          </div>
        </aside>

        {/* MAIN */}
        <div className="flex min-w-0 flex-1 flex-col">
          {/* Topbar */}
          <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border/40 bg-background/60 px-4 py-3 backdrop-blur-xl">
            <div className="glass flex flex-1 items-center gap-2 rounded-xl px-3 py-2 max-w-xl">
              <Search className="size-4 text-muted-foreground" />
              <input className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" placeholder="Search anything…" />
              <kbd className="hidden rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground sm:inline-block">⌘K</kbd>
            </div>
            <button onClick={() => setDark(!dark)} className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition" aria-label="Toggle theme">
              {dark ? <Sun className="size-4" /> : <Moon className="size-4" />}
            </button>
            <Link to="/app/notifications" className="relative rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground transition" aria-label="Notifications">
              <Bell className="size-4" />
              <span className="absolute right-1 top-1 size-2 rounded-full bg-gradient-astra" />
            </Link>
            <Link to="/app/profile" className="ml-1"><img src={user.avatar} alt="" className="size-9 rounded-lg ring-1 ring-border" /></Link>
          </header>

          {/* Mobile nav */}
          <nav className="glass-strong sticky top-[60px] z-10 flex gap-1 overflow-x-auto border-b border-border/40 px-2 py-2 md:hidden">
            {NAV_ITEMS.slice(0, 8).map((i) => {
              const active = path === i.to;
              return (
                <Link key={i.to} to={i.to} className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs ${active ? "bg-gradient-astra text-white" : "text-muted-foreground"}`}>
                  <Icon name={i.icon} className="size-3.5" /> {i.label}
                </Link>
              );
            })}
          </nav>

          <motion.main key={path} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="min-w-0 flex-1 p-4 md:p-6">
            <Outlet />
          </motion.main>
        </div>
      </div>
    </div>
  );
}
