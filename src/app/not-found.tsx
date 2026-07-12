import { PageShell } from "@/components/layout/PageShell";
import { StatusCard } from "@/components/ui/StatusCard";
import { LinkButton } from "@/components/ui/LinkButton";

/** Branded 404 for any route that does not define its own not-found.tsx. */
export default function NotFound() {
  return (
    <PageShell>
      <StatusCard
        title="Page not found"
        description="We couldn't find what you're looking for. It may have moved or the link is wrong."
      >
        <LinkButton href="/markets" className="w-full">
          Browse markets
        </LinkButton>
        <LinkButton href="/" variant="secondary" className="w-full">
          Back to home
        </LinkButton>
      </StatusCard>
    </PageShell>
  );
}
