import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";

/** Shown in place of the positions table when a signed-in user holds no shares yet. */
export function PortfolioEmptyState() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="text-lg font-semibold text-foreground">
        Your first trade starts your story
      </h2>
      <p className="mt-2 text-sm text-muted">
        You don&apos;t hold any shares yet. Browse Markets to find an artist and place your
        first trade.
      </p>
      <LinkButton href="/markets" className="mt-5">
        Browse Markets
      </LinkButton>
    </Card>
  );
}
