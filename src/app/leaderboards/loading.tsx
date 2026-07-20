import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";

const SKELETON_ROW_COUNT = 8;

/**
 * Automatic Suspense fallback for `app/leaderboards/page.tsx` while its
 * server-side RPC calls are in flight. Next.js wires this up on its own (any
 * `loading.tsx` sibling to a `page.tsx` becomes that route's Suspense
 * boundary).
 */
export default function LeaderboardsLoading() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-3xl" aria-busy="true" aria-label="Loading leaderboards">
        <div className="h-7 w-40 animate-pulse rounded-control bg-border" />
        <div className="mt-3 h-4 w-64 animate-pulse rounded-control bg-border" />

        <div className="mt-4 flex gap-4">
          <div className="h-4 w-24 animate-pulse rounded-control bg-border" />
          <div className="h-4 w-24 animate-pulse rounded-control bg-border" />
        </div>

        <div className="mt-6 h-11 w-72 animate-pulse rounded-control bg-border" />

        <Card className="mt-6 divide-y divide-rail p-0">
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3 sm:px-6">
              <div className="h-9 w-9 shrink-0 animate-pulse rounded-full bg-border" />
              <div className="h-10 w-10 shrink-0 animate-pulse rounded-full bg-border" />
              <div className="min-w-0 flex-1">
                <div className="h-4 w-32 animate-pulse rounded-control bg-border" />
              </div>
              <div className="h-5 w-20 animate-pulse rounded-control bg-border" />
            </div>
          ))}
        </Card>
      </div>
    </PageShell>
  );
}
