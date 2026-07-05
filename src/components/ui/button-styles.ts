export type ButtonVariant = "primary" | "secondary" | "ghost";

export const BUTTON_BASE_CLASSES =
  "inline-flex items-center justify-center rounded-full px-5 py-2.5 text-sm font-medium transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan";

export const BUTTON_VARIANT_CLASSES: Record<ButtonVariant, string> = {
  primary: "bg-accent-gradient text-white hover:opacity-90",
  secondary: "bg-surface border border-border text-foreground hover:bg-surface-hover",
  ghost: "text-foreground hover:bg-surface",
};
