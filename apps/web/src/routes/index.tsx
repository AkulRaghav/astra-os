import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Play, Shield, Sparkles, Zap, RefreshCw, Layers, Bot, FolderOpen, TerminalSquare, Code2, Globe, Mail, Calendar, Mic, Github, Twitter, Youtube, Chrome } from "lucide-react";
import { AstraScene } from "@/components/astra/AstraScene";
import { Aurora, Starfield } from "@/components/astra/Backdrops";
import { AstraLogo } from "@/components/astra/Logo";

export const Route = createFileRoute("/")({
  component: Landing,
});

const badges = [
  { icon: Layers, label: "Modern UI" },
  { icon: Sparkles, label: "AI Powered" },
  { icon: RefreshCw, label: "Real-time Sync" },
  { icon: Shield, label: "Secure" },
  { icon: Zap, label: "Scalable" },
];

const features = [
  { icon: Bot, title: "AI Assistant", desc: "Conversational copilot trained on your workspace." },
  { icon: FolderOpen, title: "Virtual Files", desc: "A blazing-fast cloud drive baked into the OS." },
  { icon: TerminalSquare, title: "Terminal", desc: "Run bash, python or node from any device." },
  { icon: Code2, title: "Code Editor", desc: "Full IDE with syntax highlighting and minimap." },
  { icon: Globe, title: "Browser", desc: "Browse and bookmark without leaving Astra." },
  { icon: Mail, title: "Email", desc: "Triage, write and schedule mail with AI drafts." },
  { icon: Calendar, title: "Calendar", desc: "Smart scheduling that respects your focus time." },
  { icon: Mic, title: "Voice Control", desc: "Talk to Astra. It listens, plans and acts." },
];

function Landing() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <Aurora />
      <Starfield className="absolute inset-0 h-full w-full" />

      {/* NAV */}
      <header className="relative z-20">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <Link to="/"><AstraLogo size="md" /></Link>
          <div className="hidden items-center gap-8 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground transition">Features</a>
            <a href="#pricing" className="hover:text-foreground transition">Pricing</a>
            <a href="#docs" className="hover:text-foreground transition">Docs</a>
          </div>
          <div className="flex items-center gap-3">
            <Link to="/login" className="rounded-lg px-4 py-2 text-sm text-foreground/80 hover:text-foreground transition">Sign In</Link>
            <Link to="/login" className="bg-gradient-astra glow group inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-white transition hover:scale-[1.03]">
              Get Started <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
          </div>
        </nav>
      </header>

      {/* HERO */}
      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-12 px-6 py-12 lg:grid-cols-2 lg:py-20">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }}>
          <div className="glass mb-6 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs text-muted-foreground">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse-soft" /> New · Astra 2.0 is live
          </div>
          <h1 className="font-display text-5xl font-bold leading-[1.05] tracking-tight md:text-7xl">
            The future of <span className="text-gradient">work</span> is here.
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Everything you need, in one intelligent workspace. Files, terminal, mail, code, calendar
            and AI agents — unified into a single browser-native OS.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Link to="/login" className="bg-gradient-astra glow group inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium text-white transition hover:scale-[1.03]">
              Get Started <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
            </Link>
            <button className="glass inline-flex items-center gap-2 rounded-xl px-5 py-3 font-medium transition hover:scale-[1.02]">
              <Play className="size-4" /> Watch Demo
            </button>
          </div>
          <div className="mt-10 flex flex-wrap gap-2">
            {badges.map(({ icon: I, label }) => (
              <div key={label} className="glass inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs">
                <I className="size-3.5 text-astra-purple" /> {label}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.9, delay: 0.1 }} className="relative h-[420px] lg:h-[560px]">
          <div className="absolute inset-0 rounded-3xl glass overflow-hidden ring-astra">
            <AstraScene className="absolute inset-0" />
          </div>
        </motion.div>
      </section>

      {/* FEATURES */}
      <section id="features" className="relative z-10 mx-auto max-w-7xl px-6 py-20">
        <div className="mb-12 text-center">
          <h2 className="font-display text-4xl font-bold md:text-5xl">One workspace. <span className="text-gradient">Every tool.</span></h2>
          <p className="mt-3 text-muted-foreground">Native modules built to work together.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f, i) => (
            <motion.div key={f.title} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }}
              className="glass group rounded-2xl p-5 transition hover:scale-[1.02] hover:ring-astra">
              <div className="bg-gradient-astra mb-4 inline-flex size-11 items-center justify-center rounded-xl text-white">
                <f.icon className="size-5" />
              </div>
              <div className="text-base font-semibold">{f.title}</div>
              <div className="mt-1 text-sm text-muted-foreground">{f.desc}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Social proof */}
      <section className="relative z-10 mx-auto max-w-7xl px-6 pb-16">
        <div className="glass rounded-2xl p-6">
          <div className="text-center text-xs uppercase tracking-widest text-muted-foreground">Trusted by builders at</div>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-8 text-muted-foreground/70">
            {["Vercel", "Linear", "Notion", "Stripe", "Figma", "GitHub"].map((n) => (
              <div key={n} className="font-display text-lg tracking-wider">{n}</div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/40 mt-10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-8 sm:flex-row">
          <AstraLogo size="sm" />
          <div className="text-xs text-muted-foreground">© 2026 Astra. All rights reserved.</div>
          <div className="flex items-center gap-4 text-muted-foreground">
            <a href="#" aria-label="Google"><Chrome className="size-4" /></a>
            <a href="#" aria-label="YouTube"><Youtube className="size-4" /></a>
            <a href="#" aria-label="Twitter"><Twitter className="size-4" /></a>
            <a href="#" aria-label="GitHub"><Github className="size-4" /></a>
          </div>
        </div>
      </footer>
    </div>
  );
}
