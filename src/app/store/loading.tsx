import { Card } from "@/components/ui/Card";

/** Suspense fallback for /store (including useSearchParams in StoreView). */
export default function StoreLoading() {
  return (
    <div className="mx-auto w-full max-w-5xl" aria-busy="true" aria-label="Loading store">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="h-7 w-40 animate-pulse rounded-control bg-border" />
          <div className="mt-3 h-4 w-64 animate-pulse rounded-control bg-border" />
        </div>
        <div className="h-10 w-36 animate-pulse rounded-control bg-border" />
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Card key={index} className="flex flex-col gap-4">
            <div className="h-5 w-24 animate-pulse rounded-control bg-border" />
            <div className="h-4 w-full animate-pulse rounded-control bg-border" />
            <div className="mt-4 h-10 w-28 animate-pulse rounded-control bg-border" />
            <div className="h-8 w-20 animate-pulse rounded-control bg-border" />
            <div className="mt-4 h-11 w-full animate-pulse rounded-control bg-border" />
          </Card>
        ))}
      </div>
    </div>
  );
}
