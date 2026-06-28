import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Eye, EyeOff, Github, Apple, Chrome, AlertTriangle, ArrowRight, Mail, Lock, User } from "lucide-react";
import { AstraLogo } from "@/components/astra/Logo";
import { login, signup, oauthRedirect } from "@/lib/api";
import idleImg from "@/assets/people-idle.jpg";
import typingImg from "@/assets/people-typing.jpg";
import imposterImg from "@/assets/people-imposter.jpg";

export const Route = createFileRoute("/login")({
  component: Login,
});

const CORRECT_PASSWORD = "astra2026";
type Mood = "idle" | "typing" | "denied";

const MOOD_IMG: Record<Mood, string> = {
  idle: idleImg,
  typing: typingImg,
  denied: imposterImg,
};

function Login() {
  const nav = useNavigate();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [showPw, setShowPw] = useState(false);
  const [email, setEmail] = useState("akul@example.com");
  const [pw, setPw] = useState("");
  const [pwFocused, setPwFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [denied, setDenied] = useState(false);
  const deniedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const mood: Mood = denied ? "denied" : pwFocused || pw.length > 0 ? "typing" : "idle";

  useEffect(() => () => { if (deniedTimer.current) clearTimeout(deniedTimer.current); }, []);

  const triggerDenied = () => {
    setDenied(true);
    if (deniedTimer.current) clearTimeout(deniedTimer.current);
    deniedTimer.current = setTimeout(() => setDenied(false), 3500);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (tab === "up") {
      // Real signup
      try {
        await signup(email, pw, email.split("@")[0]);
        nav({ to: "/app" });
      } catch (err: any) {
        setError(err.message || "Signup failed");
        setShake(true); setTimeout(() => setShake(false), 500);
      }
      return;
    }
    if (pw === "") {
      setError("Please enter your password.");
      setShake(true); setTimeout(() => setShake(false), 500);
      return;
    }
    // Real login
    try {
      const res = await login(email, pw);
      if (res.requires_2fa) {
        setError("2FA required — enter your TOTP code.");
        return;
      }
      nav({ to: "/app" });
    } catch (err: any) {
      setError(err.message || "Incorrect password. Try again.");
      setShake(true); setTimeout(() => setShake(false), 500);
      triggerDenied();
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#06060a] text-white">
      {/* CROSSFADING BACKGROUND PHOTOS */}
      <div className="absolute inset-0">
        {(Object.keys(MOOD_IMG) as Mood[]).map((m) => (
          <img
            key={m}
            src={MOOD_IMG[m]}
            alt=""
            aria-hidden
            className={`absolute inset-0 h-full w-full object-cover transition-opacity duration-700 ease-out ${
              mood === m ? "opacity-100" : "opacity-0"
            }`}
            style={{ filter: m === "denied" ? "saturate(1.1) contrast(1.05)" : "saturate(1) contrast(1)" }}
          />
        ))}
        {/* vignette + readability gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(0,0,0,0.7)_100%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/20 to-black/80" />
        {/* red wash when denied */}
        <div
          className="absolute inset-0 transition-opacity duration-500"
          style={{
            background: "radial-gradient(ellipse at 50% 40%, rgba(239,68,68,0.25), transparent 65%)",
            opacity: mood === "denied" ? 1 : 0,
          }}
        />
      </div>

      {/* TOP BAR */}
      <div className="relative z-20 flex items-center justify-between px-6 py-5 sm:px-10">
        <Link to="/"><AstraLogo size="md" /></Link>
        <Link to="/" className="text-xs text-white/60 transition hover:text-white">← Back to home</Link>
      </div>

      {/* IMPOSTER SPEECH BUBBLE */}
      <AnimatePresence>
        {mood === "denied" && (
          <motion.div
            key="bubble"
            initial={{ opacity: 0, y: 20, scale: 0.85 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 280, damping: 22 }}
            className="pointer-events-none absolute left-1/2 top-[14%] z-20 -translate-x-1/2 sm:left-[42%] sm:top-[18%]"
          >
            <div className="relative">
              <div
                className="rounded-2xl px-6 py-4 font-display text-2xl font-bold text-white shadow-[0_20px_60px_-15px_rgba(239,68,68,0.7)] sm:text-3xl"
                style={{
                  background: "linear-gradient(135deg, #ff3b5c, #b91c4a)",
                  boxShadow:
                    "0 20px 60px -15px rgba(239,68,68,0.7), inset 0 0 0 1px rgba(255,255,255,0.15)",
                }}
              >
                Who are an imposter?
              </div>
              <div
                className="absolute -bottom-2 left-10 h-5 w-5 rotate-45"
                style={{ background: "#b91c4a" }}
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* CONTENT: PHOTO LEFT, FORM RIGHT */}
      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-80px)] max-w-7xl items-center justify-end px-4 pb-10 sm:px-10">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={`w-full max-w-md ${shake ? "animate-shake" : ""}`}
        >
          <div
            className="rounded-3xl border border-white/10 bg-black/55 p-7 backdrop-blur-2xl"
            style={{
              boxShadow:
                "0 30px 80px -20px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.06)",
            }}
          >
            {/* HEADER */}
            <div className="mb-5 flex items-center gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 text-white shadow-lg">
                <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <path d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z" strokeLinejoin="round" />
                </svg>
              </div>
              <div>
                <div className="font-display text-xl font-bold tracking-wider">ASTRA</div>
                <div className="text-xs text-white/55">Welcome back 👋</div>
              </div>
            </div>
            <div className="mb-5 text-sm text-white/65">
              Sign in to continue to your workspace.
            </div>

            {/* TABS */}
            <div className="relative mb-6 grid grid-cols-2 rounded-xl bg-white/5 p-1 text-sm font-medium">
              <motion.div
                layout
                className="absolute inset-y-1 w-[calc(50%-4px)] rounded-lg bg-gradient-to-r from-violet-500 to-blue-500 shadow-[0_8px_20px_-8px_rgba(124,58,237,0.8)]"
                style={{ left: tab === "in" ? 4 : "calc(50% + 0px)" }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
              />
              <button onClick={() => setTab("in")} className={`relative z-10 py-2 transition ${tab === "in" ? "text-white" : "text-white/55"}`}>Sign In</button>
              <button onClick={() => setTab("up")} className={`relative z-10 py-2 transition ${tab === "up" ? "text-white" : "text-white/55"}`}>Sign Up</button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-3.5">
              {tab === "up" && (
                <IconField icon={<User className="size-4" />}>
                  <input className="input-astra" placeholder="Full name" defaultValue="Akul Raghav" />
                </IconField>
              )}
              <IconField icon={<Mail className="size-4" />}>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="input-astra"
                  placeholder="you@astra.dev"
                />
              </IconField>
              <IconField icon={<Lock className="size-4" />}>
                <input
                  value={pw}
                  onChange={(e) => { setPw(e.target.value); if (denied) setDenied(false); }}
                  onFocus={() => setPwFocused(true)}
                  onBlur={() => setPwFocused(false)}
                  type={showPw ? "text" : "password"}
                  className="input-astra pr-10"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 transition hover:text-white"
                  aria-label="Toggle password visibility"
                >
                  {showPw ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </IconField>
              {tab === "up" && (
                <IconField icon={<Lock className="size-4" />}>
                  <input type="password" className="input-astra" placeholder="Confirm password" />
                </IconField>
              )}

              {tab === "in" ? (
                <div className="flex items-center justify-between pt-1 text-xs">
                  <label className="flex items-center gap-2 text-white/65">
                    <input type="checkbox" className="accent-violet-500" defaultChecked /> Remember me
                  </label>
                  <a href="#" className="text-cyan-300 hover:underline">Forgot password?</a>
                </div>
              ) : (
                <label className="flex items-start gap-2 pt-1 text-xs text-white/65">
                  <input type="checkbox" className="mt-0.5" /> I agree to the Terms of Service and Privacy Policy.
                </label>
              )}

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className="flex items-start gap-2 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm"
                  >
                    <AlertTriangle className="mt-0.5 size-4 text-red-400" />
                    <div className="text-red-200">
                      <div className="font-semibold">Access denied</div>
                      <div className="text-xs opacity-90">You are not an authorised user. {error}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                className="group mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 via-blue-500 to-cyan-400 py-3 font-medium text-white shadow-[0_12px_30px_-10px_rgba(124,58,237,0.7)] transition hover:scale-[1.01] hover:shadow-[0_16px_40px_-10px_rgba(124,58,237,0.85)]"
              >
                {tab === "in" ? "Sign In" : "Create Account"}
                <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
              </button>
            </form>

            <div className="my-5 flex items-center gap-3 text-xs text-white/45">
              <div className="h-px flex-1 bg-white/10" /> or continue with <div className="h-px flex-1 bg-white/10" />
            </div>

            <button onClick={() => oauthRedirect("google")} className="mb-3 flex w-full items-center justify-center gap-3 rounded-xl border border-white/10 bg-white/5 py-2.5 text-sm transition hover:scale-[1.01] hover:bg-white/10">
              <Chrome className="size-4" /> Continue with Google
            </button>
            <div className="grid grid-cols-3 gap-3">
              <SocialBtn onClick={() => oauthRedirect("github")}><Github className="size-4" /></SocialBtn>
              <SocialBtn onClick={() => oauthRedirect("microsoft")}>
                <svg className="size-4" viewBox="0 0 23 23" fill="currentColor">
                  <path d="M1 1h10v10H1zM12 1h10v10H12zM1 12h10v10H1zM12 12h10v10H12z" />
                </svg>
              </SocialBtn>
              <SocialBtn onClick={() => oauthRedirect("apple")}><Apple className="size-4" /></SocialBtn>
            </div>

            <p className="mt-5 text-center text-[11px] text-white/45">
              Demo hint: password is <code className="text-cyan-300">astra2026</code>. Anything else triggers the imposter alert.
            </p>
          </div>

          <div className="mt-6 text-center text-xs text-white/50">© 2026 Astra. All rights reserved.</div>
        </motion.div>
      </div>

      <style>{`
        .input-astra {
          width: 100%;
          border-radius: 0.75rem;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          padding: 0.7rem 0.95rem 0.7rem 2.4rem;
          font-size: 0.9rem;
          color: white;
          outline: none;
          transition: all .2s;
        }
        .input-astra::placeholder { color: rgba(255,255,255,0.4); }
        .input-astra:focus {
          border-color: rgba(139,92,246,0.7);
          background: rgba(255,255,255,0.06);
          box-shadow: 0 0 0 3px rgba(139,92,246,0.18);
        }
        @keyframes shake {
          0%,100%{transform:translateX(0)}
          20%{transform:translateX(-8px)}
          40%{transform:translateX(8px)}
          60%{transform:translateX(-6px)}
          80%{transform:translateX(6px)}
        }
        .animate-shake { animation: shake .5s ease-in-out; }
      `}</style>
    </div>
  );
}

function IconField({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/45">{icon}</span>
      {children}
    </div>
  );
}

function SocialBtn({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center justify-center rounded-xl border border-white/10 bg-white/5 py-2.5 transition hover:scale-[1.03] hover:bg-white/10"
    >
      {children}
    </button>
  );
}
