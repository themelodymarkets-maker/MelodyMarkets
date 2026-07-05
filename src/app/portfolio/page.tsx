import { PageShell } from "@/components/layout/PageShell";
import { ComingSoonCard } from "@/components/ui/ComingSoonCard";

export default function PortfolioPage() {
  return (
    <PageShell>
      <ComingSoonCard
        title="Portfolio"
        description="Your holdings, token balance, and performance will live here soon."
      />
    </PageShell>
  );
}
