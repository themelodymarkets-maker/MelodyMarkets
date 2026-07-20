import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";

/** Shown in place of the positions table when a signed-in user holds no shares yet. */
export function PortfolioEmptyState() {
  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="display-label text-sm text-foreground">No positions yet</h2>
      <p className="mt-2 text-sm text-muted">
        You do not own any artists yet. Markets is where you start.
      </p>
      <LinkButton href="/markets" className="mt-5">
        Browse markets
      </LinkButton>
    </Card>
  );
}
