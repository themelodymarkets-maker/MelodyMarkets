"use client";

import { useEffect } from "react";
import { StatusCard } from "@/components/ui/StatusCard";
import { Button } from "@/components/ui/Button";
import { LinkButton } from "@/components/ui/LinkButton";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Root error boundary — catches failures outside any route-level boundary.
 * Must define its own <html> and <body> (Next.js requirement for global-error).
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("[global-error]", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="en">
      <body className="font-sans antialiased" style={{ background: "#05050a", color: "#f5f5f7" }}>
        <main className="mx-auto flex min-h-screen max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
          <StatusCard
            title="Something went wrong"
            description="An unexpected error occurred. You can try again or head back to the markets."
          >
            <Button type="button" onClick={reset} className="w-full">
              Try again
            </Button>
            <LinkButton href="/markets" variant="secondary" className="w-full">
              Go to markets
            </LinkButton>
          </StatusCard>
        </main>
      </body>
    </html>
  );
}
