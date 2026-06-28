import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { User, Shield, Bell, Settings as Sett, CreditCard, Key, Check, Crown } from "lucide-react";
import { userApi } from "@/lib/api";

export const Route = createFileRoute("/app/settings")({ component: Settings });

const TABS = [
  { id: "profile", label: "Profile", icon: User },
  { id: "security", label: "Security", icon: Shield },
  { id: "notifications", label: "Notifications", icon: Bell },
  { id: "preferences", label: "Preferences", icon: Sett },
  { id: "billing", label: "Billing", icon: CreditCard },
  { id: "api", label: "API", icon: Key },
];

const RAZORPAY_KEY = "rzp_test_T6x8ebM7rLfE5p";

const PLANS = [
  { id: "free", name: "Free", price: 0, period: "forever", features: ["5 GB Storage", "50 AI requests/day", "1 Workspace", "Community support"], current: true },
  { id: "pro", name: "Pro", price: 20, period: "/month", features: ["50 GB Storage", "Unlimited AI requests", "10 Workspaces", "Priority support", "All plugins", "Code execution"], current: false },
  { id: "enterprise", name: "Enterprise", price: 100, period: "/month", features: ["Unlimited Storage", "Unlimited AI", "Unlimited Workspaces", "Dedicated support", "Custom agents", "SSO/SAML", "Audit logs"], current: false },
];

function Settings() {
  const [tab, setTab] = useState("profile");
  const [user, setUser] = useState<any>(null);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("free");

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");

  // Preferences state
  const [theme, setTheme] = useState("dark");
  const [fontSize, setFontSize] = useState("14");
  const [language, setLanguage] = useState("en");
  const [autoSave, setAutoSave] = useState(true);
  const [codeFont, setCodeFont] = useState("JetBrains Mono");

  // Notifications state
  const [emailNotifs, setEmailNotifs] = useState(true);
  const [pushNotifs, setPushNotifs] = useState(false);
  const [aiNotifs, setAiNotifs] = useState(true);
  const [taskNotifs, setTaskNotifs] = useState(true);

  useEffect(() => {
    Promise.all([
      userApi.getMe().catch(() => null),
      userApi.getSettings().catch(() => null),
    ]).then(([u, s]) => {
      setUser(u);
      setSettings(s);
      if (u) {
        setName(u.display_name || u.name || "");
        setUsername(u.username || "");
        setEmail(u.email || "");
        setLocation(u.location || "");
        setBio(u.bio || "");
        // Admin gets enterprise free
        if (u.role === "superadmin" || u.role === "admin") {
          setCurrentPlan("enterprise");
          localStorage.setItem("astra.plan", "enterprise");
        }
      }
      if (s) {
        setTheme(s.theme || "dark");
        setLanguage(s.language || "en");
      }
    }).finally(() => setLoading(false));

    // Load plan from localStorage
    setCurrentPlan(localStorage.getItem("astra.plan") || "free");
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      await userApi.updateProfile({ display_name: name, username, email, location, bio });
    } catch {}
    setSaving(false);
  };

  const handleSettingsUpdate = async (key: string, value: any) => {
    try { await userApi.updateSettings({ [key]: value }); } catch {}
    setSettings((prev: any) => ({ ...prev, [key]: value }));
  };

  const handlePayment = (plan: typeof PLANS[number]) => {
    if (plan.price === 0) return;
    const options = {
      key: RAZORPAY_KEY,
      amount: plan.price * 100, // paise
      currency: "INR",
      name: "Astra OS",
      description: `${plan.name} Plan - Monthly`,
      handler: function (response: any) {
        alert(`Payment successful! ID: ${response.razorpay_payment_id}`);
        setCurrentPlan(plan.id);
        localStorage.setItem("astra.plan", plan.id);
      },
      prefill: { name: name || "User", email: email || "" },
      theme: { color: "#7C3AED" },
    };
    const rzp = new (window as any).Razorpay(options);
    rzp.open();
  };

  if (loading) {
    return <div className="grid h-64 place-items-center text-sm text-muted-foreground">Loading settings…</div>;
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
      {/* Razorpay script */}
      <script src="https://checkout.razorpay.com/v1/checkout.js" />

      <aside className="glass space-y-1 rounded-2xl p-3">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm ${tab === t.id ? "bg-gradient-astra text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}>
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </aside>

      <section className="glass rounded-2xl p-6">
        {/* Profile */}
        {tab === "profile" && (
          <>
            <h2 className="mb-1 font-display text-xl font-bold">Profile Settings</h2>
            <p className="mb-5 text-sm text-muted-foreground">Update your personal information.</p>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Full Name" value={name} onChange={setName} />
              <Field label="Username" value={username} onChange={setUsername} />
              <Field label="Email" value={email} onChange={setEmail} />
              <Field label="Location" value={location} onChange={setLocation} />
              <div className="sm:col-span-2"><Field label="Bio" value={bio} onChange={setBio} /></div>
            </div>
            <button onClick={handleSave} disabled={saving} className="bg-gradient-astra glow mt-6 rounded-xl px-5 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save Changes"}</button>
          </>
        )}

        {/* Security */}
        {tab === "security" && (
          <div>
            <h2 className="mb-4 font-display text-xl font-bold">Security</h2>
            <Toggle title="Two-Factor Authentication" desc="Add an extra layer of security with TOTP" checked={settings?.two_factor || false} onChange={(v) => handleSettingsUpdate("two_factor", v)} />
            <Toggle title="Encrypted Storage" desc="AES-256 encryption for all your files" checked={settings?.encrypted_storage !== false} onChange={(v) => handleSettingsUpdate("encrypted_storage", v)} />
            <Toggle title="Login Alerts" desc="Get notified when someone logs into your account" checked={true} onChange={() => {}} />
          </div>
        )}

        {/* Notifications */}
        {tab === "notifications" && (
          <div>
            <h2 className="mb-4 font-display text-xl font-bold">Notification Preferences</h2>
            <Toggle title="Email Notifications" desc="Receive important updates via email" checked={emailNotifs} onChange={setEmailNotifs} />
            <Toggle title="Push Notifications" desc="Browser push notifications for real-time alerts" checked={pushNotifs} onChange={setPushNotifs} />
            <Toggle title="AI Completion Alerts" desc="Notify when AI tasks finish processing" checked={aiNotifs} onChange={setAiNotifs} />
            <Toggle title="Task Reminders" desc="Get reminded about upcoming deadlines" checked={taskNotifs} onChange={setTaskNotifs} />
          </div>
        )}

        {/* Preferences */}
        {tab === "preferences" && (
          <div>
            <h2 className="mb-4 font-display text-xl font-bold">Preferences</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Theme</label>
                <div className="mt-1.5 flex gap-2">
                  {["dark", "light", "system"].map((t) => (
                    <button key={t} onClick={() => setTheme(t)} className={`rounded-lg border px-4 py-2 text-sm capitalize ${theme === t ? "border-astra-purple bg-astra-purple/10 text-foreground" : "border-border text-muted-foreground"}`}>{t}</button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Editor Font Size</label>
                <select value={fontSize} onChange={(e) => setFontSize(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none">
                  {["12", "13", "14", "15", "16", "18", "20"].map((s) => <option key={s} value={s}>{s}px</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Code Font</label>
                <select value={codeFont} onChange={(e) => setCodeFont(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none">
                  {["JetBrains Mono", "Fira Code", "Source Code Pro", "Cascadia Code", "Consolas"].map((f) => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="mt-1.5 w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none">
                  <option value="en">English</option>
                  <option value="hi">Hindi</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>
              <Toggle title="Auto-Save" desc="Automatically save changes in code editor and notes" checked={autoSave} onChange={setAutoSave} />
            </div>
          </div>
        )}

        {/* Billing */}
        {tab === "billing" && (
          <div>
            <h2 className="mb-1 font-display text-xl font-bold">Billing & Plans</h2>
            <p className="mb-5 text-sm text-muted-foreground">Manage your subscription and payment.</p>
            <div className="grid gap-4 sm:grid-cols-3">
              {PLANS.map((plan) => {
                const isCurrent = currentPlan === plan.id;
                return (
                  <div key={plan.id} className={`glass rounded-2xl p-5 transition ${isCurrent ? "ring-2 ring-astra-purple" : "hover:ring-1 hover:ring-astra-purple/50"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      {plan.id === "enterprise" && <Crown className="size-4 text-amber-400" />}
                      <h3 className="font-display text-lg font-bold">{plan.name}</h3>
                    </div>
                    <div className="mb-4">
                      <span className="text-3xl font-bold">{plan.price === 0 ? "Free" : `₹${plan.price}`}</span>
                      {plan.price > 0 && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                    </div>
                    <ul className="space-y-2 mb-5">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Check className="size-3 text-emerald-500" /> {f}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <button disabled className="w-full rounded-lg border border-emerald-500/50 bg-emerald-500/10 py-2 text-sm font-medium text-emerald-600">Current Plan</button>
                    ) : (
                      <button onClick={() => handlePayment(plan)} className="bg-gradient-astra glow w-full rounded-lg py-2 text-sm font-medium text-white">{plan.price === 0 ? "Downgrade" : "Upgrade"}</button>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="mt-5 glass rounded-xl p-4 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Payment powered by Razorpay.</span> Payments are processed securely. You can cancel anytime.
            </div>
          </div>
        )}

        {/* API */}
        {tab === "api" && (
          <div>
            <h2 className="mb-1 font-display text-xl font-bold">API Keys</h2>
            <p className="mb-5 text-sm text-muted-foreground">Manage API keys for external integrations.</p>
            <div className="space-y-3">
              <ApiKeyRow label="Astra API Key" value="astra_sk_••••••••••••••••" />
              <ApiKeyRow label="Webhook URL" value="https://api.astra.dev/webhooks/your-id" />
            </div>
            <div className="mt-5 glass rounded-xl p-4">
              <h3 className="text-sm font-semibold mb-2">Usage This Month</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                <div><div className="text-2xl font-bold">142</div><div className="text-[10px] text-muted-foreground">API Calls</div></div>
                <div><div className="text-2xl font-bold">2.4k</div><div className="text-[10px] text-muted-foreground">Tokens Used</div></div>
                <div><div className="text-2xl font-bold">99.9%</div><div className="text-[10px] text-muted-foreground">Uptime</div></div>
              </div>
            </div>
            <div className="mt-4">
              <button className="bg-gradient-astra rounded-lg px-4 py-2 text-sm font-medium text-white">Generate New Key</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <div className="mb-1.5 text-xs font-medium text-muted-foreground">{label}</div>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm outline-none focus:border-astra-purple" />
    </label>
  );
}

function Toggle({ title, desc, checked, onChange }: { title: string; desc: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="glass mb-3 flex items-center justify-between rounded-xl p-4">
      <div><div className="text-sm font-medium">{title}</div><div className="text-xs text-muted-foreground">{desc}</div></div>
      <button onClick={() => onChange(!checked)} className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-gradient-astra" : "bg-muted"}`}>
        <span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${checked ? "left-5" : "left-0.5"}`} />
      </button>
    </div>
  );
}

function ApiKeyRow({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="glass flex items-center justify-between rounded-xl p-3">
      <div>
        <div className="text-xs font-medium">{label}</div>
        <div className="font-mono text-xs text-muted-foreground">{value}</div>
      </div>
      <button onClick={() => { navigator.clipboard.writeText(value); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="rounded-lg border border-border px-2 py-1 text-[10px] hover:bg-muted">
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}
