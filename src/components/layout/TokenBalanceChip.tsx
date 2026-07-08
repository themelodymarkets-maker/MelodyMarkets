"use client";

import { useBalance } from "@/lib/balance-context";
import { formatTokenAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Navbar chip showing the signed-in user's live token balance. Reads the
 * shared `BalanceProvider` state (same source as the trade panel), so it
 * refreshes automatically after any trade calls `refresh()`.
 */
export function TokenBalanceChip({ className }: { className?: string }) {
  const { balance, isLoading, isAuthenticated } = useBalance();

  if (!isAuthenticated) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-3 py-1.5 text-sm font-semibold text-foreground tabular-nums",
        className,
      )}
      title="Your token balance"
    >
      <CoinIcon />
      {isLoading || balance === null ? "—" : formatTokenAmount(balance)}
    </span>
  );
}

function CoinIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 text-accent-cyan" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={2} />
      <path
        d="M12 7v10M9.5 9.5a2 2 0 0 1 2-2h1.25a1.75 1.75 0 0 1 0 3.5h-2.5a1.75 1.75 0 0 0 0 3.5H13a2 2 0 0 0 2-2"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </svg>
  );
}
