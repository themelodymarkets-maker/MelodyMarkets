"use client";

import { useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

interface MarketsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Route-level error boundary for /markets (must be a Client Component --
 * Next.js requirement for error.tsx). Catches failures from the server
 * component's RPC call (e.g. a transient Supabase outage) and offers a retry
 * instead of a blank crashed page.
 */
export default function MarketsError({ error, reset }: MarketsErrorProps) {
  useEffect(() => {
    console.error("[markets] failed to load:", error);
  }, [error]);

  return (
    <PageShell>
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-semibold text-foreground">Couldn&apos;t load markets</h1>
        <p className="mt-2 text-sm text-muted">
          Something went wrong fetching live prices. Please try again.
        </p>
        <Button className="mt-6" onClick={reset}>
          Try again
        </Button>
      </Card>
    </PageShell>
  );
}
