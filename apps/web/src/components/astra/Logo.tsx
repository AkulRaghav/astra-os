import { Sparkle } from "lucide-react";

export function AstraLogo({ size = "md", className = "" }: { size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const sizes = { sm: "text-lg", md: "text-2xl", lg: "text-4xl", xl: "text-6xl" };
  return (
    <div className={`inline-flex items-center gap-2 font-display font-bold tracking-[0.18em] ${sizes[size]} ${className}`}>
      <Sparkle className="text-astra-purple" strokeWidth={2.5} style={{ width: "1em", height: "1em" }} />
      <span className="text-gradient">ASTRA</span>
    </div>
  );
}
