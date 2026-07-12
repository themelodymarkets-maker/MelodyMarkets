import type { ReactNode } from "react";
import { Card } from "@/components/ui/Card";
import { Logo } from "@/components/layout/Logo";

interface StatusCardProps {
  title: string;
  description: ReactNode;
  children?: ReactNode;
}

/** Branded centered card for error and not-found states. */
export function StatusCard({ title, description, children }: StatusCardProps) {
  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
      <Logo />
      <Card className="mt-8 w-full">
        <h1 className="text-lg font-semibold text-foreground">{title}</h1>
        <p className="mt-2 text-sm text-muted">{description}</p>
        {children && <div className="mt-6 flex flex-col gap-3">{children}</div>}
      </Card>
    </div>
  );
}
