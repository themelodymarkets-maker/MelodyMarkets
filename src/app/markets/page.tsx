import { PageShell } from "@/components/layout/PageShell";
import { ComingSoonCard } from "@/components/ui/ComingSoonCard";

export default function MarketsPage() {
  return (
    <PageShell>
      <ComingSoonCard
        title="Markets"
        description="Live artist prices and trading will show up here soon."
      />
    </PageShell>
  );
}
