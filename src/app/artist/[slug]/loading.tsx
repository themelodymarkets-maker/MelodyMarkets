import { PageShell } from "@/components/layout/PageShell";
import { Card } from "@/components/ui/Card";

/**
 * Automatic Suspense fallback for `app/artist/[slug]/page.tsx` while its
 * server-side Supabase calls are in flight. Mirrors the page's two-column
 * layout so there is no shift once real content arrives.
 */
export default function ArtistLoading() {
  return (
    <PageShell>
      <div className="mx-auto w-full max-w-5xl" aria-busy="true" aria-label="Loading artist">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px] lg:items-start">
          <div className="min-w-0">
            <Card>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
                <div className="h-24 w-24 shrink-0 animate-pulse rounded-card bg-border" />
                <div className="flex-1 space-y-3">
                  <div className="h-7 w-48 animate-pulse rounded-control bg-border" />
                  <div className="h-5 w-20 animate-pulse rounded-control bg-border" />
                  <div className="h-4 w-40 animate-pulse rounded-control bg-border" />
                </div>
              </div>
            </Card>

            <Card className="mt-6">
              <div className="h-12 w-56 animate-pulse rounded-control bg-border" />
            </Card>

            <Card className="mt-6">
              <div className="h-6 w-32 animate-pulse rounded-control bg-border" />
              <div className="mt-4 h-48 animate-pulse rounded-card bg-border" />
            </Card>

            <Card className="mt-6 overflow-hidden p-0">
              <div className="border-b border-border px-6 py-4">
                <div className="h-6 w-32 animate-pulse rounded-control bg-border" />
              </div>
              <div className="space-y-4 p-6">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-4 w-full animate-pulse rounded-control bg-border" />
                ))}
              </div>
            </Card>
          </div>

          <div className="flex flex-col gap-6">
            <Card>
              <div className="h-4 w-16 animate-pulse rounded-control bg-border" />
              <div className="mt-3 h-8 w-28 animate-pulse rounded-control bg-border" />
              <div className="mt-5 flex gap-3">
                <div className="h-11 flex-1 animate-pulse rounded-control bg-border" />
                <div className="h-11 flex-1 animate-pulse rounded-control bg-border" />
              </div>
            </Card>
            <Card>
              <div className="h-4 w-24 animate-pulse rounded-control bg-border" />
              <div className="mt-4 space-y-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <div key={index} className="h-4 w-full animate-pulse rounded-control bg-border" />
                ))}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
