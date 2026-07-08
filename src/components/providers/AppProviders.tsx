"use client";

import type { ReactNode } from "react";
import { BalanceProvider } from "@/lib/balance-context";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * Client-side provider stack mounted once at the root layout so the whole app
 * (navbar + page content) shares a single token-balance source and a single
 * toast surface. Server components passed as `children` still render on the
 * server; they're just handed to these client providers as an opaque subtree.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ToastProvider>
      <BalanceProvider>{children}</BalanceProvider>
    </ToastProvider>
  );
}
