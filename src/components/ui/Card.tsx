import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

/**
 * Indigo-slate panel over navy/slate background. Elevation is surface color,
 * a 1px border, and a soft 10% cyan glow — no skeuomorphism.
 */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface p-6 glow-panel",
        className,
      )}
      {...props}
    />
  );
}
