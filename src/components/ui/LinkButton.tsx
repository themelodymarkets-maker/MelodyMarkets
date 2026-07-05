import Link from "next/link";
import type { AnchorHTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import { BUTTON_BASE_CLASSES, BUTTON_VARIANT_CLASSES, type ButtonVariant } from "./button-styles";

interface LinkButtonProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
}

/** Button-styled navigation link, for actions that route to another page. */
export function LinkButton({ href, variant = "primary", className, ...props }: LinkButtonProps) {
  return (
    <Link
      href={href}
      className={cn(BUTTON_BASE_CLASSES, BUTTON_VARIANT_CLASSES[variant], className)}
      {...props}
    />
  );
}
