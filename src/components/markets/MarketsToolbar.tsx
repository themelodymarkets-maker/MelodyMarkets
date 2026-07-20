"use client";

import { cn } from "@/lib/utils";
import type { SortDirection, SortField } from "./types";

interface MarketsToolbarProps {
  query: string;
  onQueryChange: (value: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField) => void;
}

const SORT_OPTIONS: Array<{ field: SortField; label: string }> = [
  { field: "popularity", label: "Popularity" },
  { field: "price", label: "Price" },
  { field: "change", label: "24h" },
];

/**
 * Client Component: instant client-side search + sort controls for the
 * watchlist. "Instant" because it never hits the network: `MarketsExplorer`
 * filters/sorts the already-fetched rows in memory on every keystroke/click.
 */
export function MarketsToolbar({
  query,
  onQueryChange,
  sortField,
  sortDirection,
  onSortChange,
}: MarketsToolbarProps) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative w-full sm:max-w-xs">
        <label htmlFor="markets-search" className="sr-only">
          Search artists
        </label>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3.5 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          id="markets-search"
          type="search"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search artists"
          className="min-h-11 w-full rounded-full border border-border bg-border pr-4 pl-10 text-sm text-foreground placeholder:text-muted transition-[border-color,box-shadow] duration-150 focus:border-accent"
        />
      </div>

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort markets">
        {SORT_OPTIONS.map(({ field, label }) => (
          <SortToggle
            key={field}
            label={label}
            active={sortField === field}
            direction={sortField === field ? sortDirection : undefined}
            onClick={() => onSortChange(field)}
          />
        ))}
      </div>
    </div>
  );
}

interface SortToggleProps {
  label: string;
  active: boolean;
  direction: SortDirection | undefined;
  onClick: () => void;
}

function SortToggle({ label, active, direction, onClick }: SortToggleProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm display-label transition-[transform,background-color,box-shadow,color] duration-100 ease-out active:scale-95",
        active
          ? "border-accent bg-accent/10 text-accent glow-accent"
          : "border-border bg-surface text-muted hover:text-foreground",
      )}
    >
      {label}
      {active && (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className={cn("h-3 w-3 transition-transform", direction === "asc" && "rotate-180")}
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
        </svg>
      )}
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" />
      <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
    </svg>
  );
}
