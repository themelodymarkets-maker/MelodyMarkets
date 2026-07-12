"use client";

import { useEffect } from "react";
import { PageShell } from "@/components/layout/PageShell";
import { StatusCard } from "@/components/ui/StatusCard";
import { Button } from "@/components/ui/Button";

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
    console.error("[markets] failed to load:", error.digest ?? error.message);
  }, [error]);

  return (
    <PageShell>
      <StatusCard
        title="Couldn't load markets"
        description="Something went wrong fetching live prices. Please try again."
      >
        <Button type="button" onClick={reset} className="w-full">
          Try again
        </Button>
      </StatusCard>
    </PageShell>
  );
}
