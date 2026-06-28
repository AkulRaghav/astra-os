import { createFileRoute } from "@tanstack/react-router";
import { Globe } from "lucide-react";

export const Route = createFileRoute("/app/browser")({ component: Browser });

function Browser() {
  return (
    <div className="glass-strong overflow-hidden rounded-2xl">
      <div className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-3 py-2">
        <div className="flex gap-1.5"><span className="size-3 rounded-full bg-red-500"/><span className="size-3 rounded-full bg-yellow-500"/><span className="size-3 rounded-full bg-green-500"/></div>
        <div className="ml-2 text-xs text-muted-foreground">Browser</div>
      </div>
      <div className="flex min-h-[60vh] flex-col items-center justify-center p-10 text-center">
        <Globe className="size-16 text-muted-foreground/40 mb-4" />
        <h1 className="font-display text-2xl font-bold">Browser</h1>
        <p className="mt-2 text-sm text-muted-foreground">Coming soon</p>
        <p className="mt-1 text-xs text-muted-foreground/60">The integrated browser experience is under development.</p>
      </div>
    </div>
  );
}
