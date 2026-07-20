import Link from "next/link";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";

interface AuthCardProps {
  title: string;
  subtitle: string;
  children: ReactNode;
  /** Link shown at the bottom to switch between login and signup. */
  footer: {
    prompt: string;
    linkLabel: string;
    href: string;
  };
}

/** Shared centered container for the login and signup forms. */
export function AuthCard({ title, subtitle, children, footer }: AuthCardProps) {
  return (
    <Card className="mx-auto w-full max-w-md">
      <div className="text-center">
        <h1 className="display-label text-lg text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted">{subtitle}</p>
      </div>

      <div className="mt-6">{children}</div>

      <p className="mt-6 text-center text-sm text-muted">
        {footer.prompt}{" "}
        <Link href={footer.href} className="text-accent underline underline-offset-2">
          {footer.linkLabel}
        </Link>
      </p>
    </Card>
  );
}
