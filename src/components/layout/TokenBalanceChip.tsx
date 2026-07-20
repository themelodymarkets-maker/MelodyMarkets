"use client";

import { useBalance } from "@/lib/balance-context";
import { Num } from "@/components/ui/Num";
import { cn } from "@/lib/utils";

/**
 * Navbar token readout: gold LED-style chip. Gold is exclusive to token
 * balances / store. Reads shared `BalanceProvider` state so it updates after trades.
 */
export function TokenBalanceChip({ className }: { className?: string }) {
  const { balance, isLoading, isAuthenticated } = useBalance();

  if (!isAuthenticated) return null;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1 text-right glow-token",
        className,
      )}
      title="Your token balance"
    >
      <span className="h-1.5 w-1.5 rounded-full bg-token" aria-hidden="true" />
      <Num
        value={isLoading ? null : balance}
        variant="token"
        className="text-sm text-token text-glow-token"
      />
    </span>
  );
}
