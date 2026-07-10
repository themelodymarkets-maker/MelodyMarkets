import { Suspense } from "react";
import type { Metadata } from "next";
import { PageShell } from "@/components/layout/PageShell";
import { StoreView } from "@/components/store/StoreView";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Buy tokens",
  description: "Top up your MelodyMarkets token balance.",
};

/**
 * Token store. The session is resolved on the server so the sign-in gate is
 * correct on first paint; the live balance, buy flow, and the return-from-Stripe
 * handling all live in the `StoreView` client component (which shares the same
 * balance source as the navbar chip).
 */
export default async function StorePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <PageShell>
      {/* useSearchParams (in StoreView) requires a Suspense boundary. */}
      <Suspense fallback={null}>
        <StoreView isAuthenticated={user !== null} />
      </Suspense>
    </PageShell>
  );
}
