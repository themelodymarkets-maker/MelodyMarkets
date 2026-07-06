import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Optional helper or error text rendered beneath the field. */
  hint?: string;
  /** When true, styles the field and hint as an error state. */
  invalid?: boolean;
}

/** Labeled text input matching the MelodyMarkets dark design system. */
export function Input({ label, hint, invalid, id, className, ...props }: InputProps) {
  // Fall back to the `name` attribute so the label always targets the input.
  const inputId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={invalid}
        className={cn(
          "rounded-xl border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-muted",
          "transition-colors duration-200 focus:outline-none focus-visible:border-accent-cyan",
          invalid ? "border-loss" : "border-border",
          className,
        )}
        {...props}
      />
      {hint && (
        <p className={cn("text-xs", invalid ? "text-loss" : "text-muted")}>{hint}</p>
      )}
    </div>
  );
}
