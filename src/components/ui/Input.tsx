import type { InputHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  /** Optional helper or error text rendered beneath the field. */
  hint?: string;
  /** When true, styles the field and hint as an error state. */
  invalid?: boolean;
}

/** Labeled text input — pill shape, cobalt well, cyan focus via global ring. */
export function Input({ label, hint, invalid, id, className, ...props }: InputProps) {
  // Fall back to the `name` attribute so the label always targets the input.
  const inputId = id ?? props.name;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="display-label text-2xs text-muted">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={invalid}
        // Errors are neutral, not red: red is reserved for downward market data.
        className={cn(
          "min-h-11 rounded-full border bg-border px-4 text-sm text-foreground placeholder:text-muted transition-[box-shadow,border-color] duration-150",
          invalid ? "border-accent-dim" : "border-border focus:border-accent",
          className,
        )}
        {...props}
      />
      {hint && <p className={cn("text-xs", invalid ? "text-foreground" : "text-muted")}>{hint}</p>}
    </div>
  );
}
