export type ButtonVariant = "primary" | "secondary" | "ghost";

// Sleek controls: Geist display face, fully rounded, 44px min tap target.
// Snappy press feedback (scale-95, 100ms ease) + soft cyan glow on primary.
export const BUTTON_BASE_CLASSES =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm display-label transition-[transform,filter,background-color,box-shadow] duration-100 ease-out active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 disabled:active:scale-100";

export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  // Cyan is the brand: the primary action is the lit control.
  primary: "bg-accent text-background glow-accent hover:bg-accent/90",
  secondary:
    "border border-border bg-surface text-foreground hover:bg-border hover:shadow-[0_0_20px_rgba(0,242,254,0.1)]",
  ghost: "text-foreground hover:bg-border",
};
