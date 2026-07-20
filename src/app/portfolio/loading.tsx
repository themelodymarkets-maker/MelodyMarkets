import { Card } from "@/components/ui/Card";

/** Suspense fallback for /portfolio while server data loads. */
export default function PortfolioLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl" aria-busy="true" aria-label="Loading portfolio">
      <div className="h-7 w-36 animate-pulse rounded-control bg-border" />
      <div className="mt-3 h-4 w-72 animate-pulse rounded-control bg-border" />

      <Card className="mt-6 h-28 animate-pulse bg-border" />

      <Card className="mt-6 divide-y divide-rail p-0">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="flex items-center gap-4 px-4 py-3 sm:px-6">
            <div className="h-11 w-11 shrink-0 animate-pulse rounded-full bg-border" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded-control bg-border" />
              <div className="h-3 w-20 animate-pulse rounded-control bg-border" />
            </div>
            <div className="h-4 w-16 animate-pulse rounded-control bg-border" />
            <div className="h-6 w-14 animate-pulse rounded-control bg-border" />
          </div>
        ))}
      </Card>
    </div>
  );
}
