import { PageShell } from "@/components/layout/PageShell";
import { LinkButton } from "@/components/ui/LinkButton";
import { Card } from "@/components/ui/Card";

/**
 * Rendered when `page.tsx` calls `notFound()` for an unknown or inactive
 * artist slug.
 */
export default function ArtistNotFound() {
  return (
    <PageShell>
      <Card className="mx-auto max-w-md text-center">
        <h1 className="text-lg font-semibold text-foreground">Artist not found</h1>
        <p className="mt-2 text-sm text-muted">
          We couldn&apos;t find an artist at this address. It may have been delisted or the link is wrong.
        </p>
        <LinkButton href="/markets" className="mt-6">
          Browse markets
        </LinkButton>
      </Card>
    </PageShell>
  );
}
