import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { BUTTON_BASE_CLASSES, BUTTON_VARIANT_CLASSES, type ButtonVariant } from "./button-styles";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
}

/** Reusable button primitive for interactive controls that do not navigate. */
export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return (
    <button
      className={cn(BUTTON_BASE_CLASSES, BUTTON_VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
