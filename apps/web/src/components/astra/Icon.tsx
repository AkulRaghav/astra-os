import * as Lucide from "lucide-react";
import type { LucideProps } from "lucide-react";

export function Icon({ name, className, ...props }: { name: string; className?: string } & Omit<LucideProps, 'className'>) {
  const C = (Lucide as unknown as Record<string, React.ComponentType<LucideProps>>)[name] ?? Lucide.Circle;
  return <C className={className} {...props} />;
}
