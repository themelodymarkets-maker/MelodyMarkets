import { PageShell } from "@/components/layout/PageShell";
import { ComingSoonCard } from "@/components/ui/ComingSoonCard";

export default function LeaderboardsPage() {
  return (
    <PageShell>
      <ComingSoonCard
        title="Leaderboards"
        description="Rankings of the top MelodyMarkets traders will show up here soon."
      />
    </PageShell>
  );
}
