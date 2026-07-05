import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

type CardProps = HTMLAttributes<HTMLDivElement>;

/** Elevated surface used across the app for grouped content. */
export function Card({ className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card border border-border bg-surface p-6 transition-colors duration-200 hover:border-accent-cyan/40",
        className,
      )}
      {...props}
    />
  );
}
