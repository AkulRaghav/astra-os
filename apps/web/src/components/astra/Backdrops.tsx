import { useEffect, useRef } from "react";

export function Starfield({ density = 140, className = "" }: { density?: number; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current!;
    const ctx = canvas.getContext("2d")!;
    let w = (canvas.width = canvas.offsetWidth * devicePixelRatio);
    let h = (canvas.height = canvas.offsetHeight * devicePixelRatio);
    const stars = Array.from({ length: density }, () => ({
      x: Math.random() * w, y: Math.random() * h, r: Math.random() * 1.4 + 0.2,
      a: Math.random(), s: Math.random() * 0.02 + 0.005,
    }));
    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, w, h);
      for (const s of stars) {
        s.a += s.s; if (s.a > 1 || s.a < 0.1) s.s *= -1;
        ctx.beginPath();
        ctx.fillStyle = `rgba(200,180,255,${s.a})`;
        ctx.arc(s.x, s.y, s.r * devicePixelRatio, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    const onResize = () => { w = canvas.width = canvas.offsetWidth * devicePixelRatio; h = canvas.height = canvas.offsetHeight * devicePixelRatio; };
    window.addEventListener("resize", onResize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", onResize); };
  }, [density]);
  return <canvas ref={ref} className={`pointer-events-none ${className}`} />;
}

export function Aurora({ className = "" }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      <div className="absolute -top-1/3 -left-1/4 h-[60rem] w-[60rem] rounded-full opacity-50 blur-3xl animate-aurora"
        style={{ background: "radial-gradient(closest-side, oklch(0.55 0.28 295 / 0.6), transparent)" }} />
      <div className="absolute top-1/4 -right-1/4 h-[50rem] w-[50rem] rounded-full opacity-40 blur-3xl animate-aurora"
        style={{ background: "radial-gradient(closest-side, oklch(0.6 0.24 250 / 0.55), transparent)", animationDelay: "-6s" }} />
      <div className="absolute bottom-0 left-1/3 h-[40rem] w-[40rem] rounded-full opacity-30 blur-3xl animate-aurora"
        style={{ background: "radial-gradient(closest-side, oklch(0.7 0.18 210 / 0.5), transparent)", animationDelay: "-12s" }} />
    </div>
  );
}
