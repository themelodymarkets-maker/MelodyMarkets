import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";

const SKELETON_ROW_COUNT = 8;

/**
 * Automatic Suspense fallback for `app/markets/page.tsx` while its server-side
 * RPC call is in flight. Next.js wires this up on its own (any `loading.tsx`
 * sibling to a `page.tsx` becomes that route's Suspense boundary).
 */
export default function MarketsLoading() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl" aria-busy="true" aria-label="Loading markets">
        <div className="h-7 w-40 animate-pulse rounded-control bg-border" />
        <div className="mt-3 h-4 w-64 animate-pulse rounded-control bg-border" />

        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="h-11 w-full animate-pulse rounded-control bg-border sm:max-w-xs" />
          <div className="flex gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-11 w-24 animate-pulse rounded-control bg-border" />
            ))}
          </div>
        </div>

        <Card className="mt-6 divide-y divide-rail p-0">
          {Array.from({ length: SKELETON_ROW_COUNT }).map((_, index) => (
            <div key={index} className="flex items-center gap-4 px-4 py-3 sm:px-6">
              <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-border" />
              <div className="min-w-0 flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded-control bg-border" />
                <div className="h-3 w-16 animate-pulse rounded-control bg-border" />
              </div>
              <div className="hidden h-4 w-16 animate-pulse rounded-control bg-border sm:block" />
              <div className="h-4 w-16 animate-pulse rounded-control bg-border" />
              <div className="h-5 w-16 animate-pulse rounded-control bg-border" />
            </div>
          ))}
        </Card>
      </div>
    </PageShell>
  );
}
