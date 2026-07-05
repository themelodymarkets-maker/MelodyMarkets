import { PageShell } from "@/components/layout/PageShell";
import { ComingSoonCard } from "@/components/ui/ComingSoonCard";

export default function LoginPage() {
  return (
    <PageShell>
      <ComingSoonCard
        title="Sign In"
        description="Account creation and sign-in will be available soon."
      />
    </PageShell>
  );
}
