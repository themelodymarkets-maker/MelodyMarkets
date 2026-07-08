"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";

/**
 * App-wide token-balance state, fetched exactly once per signed-in session and
 * shared by both the navbar chip and the trade panel.
 *
 * The balance is the sum of the user's append-only `token_ledger` rows, exposed
 * to the client through the `get_token_balance` RPC (granted to `authenticated`
 * only -- see its migration). We never write balances on the client; after a
 * trade the panel calls `refresh()` and this provider re-reads the RPC so the
 * chip and any other consumer update together.
 */
interface BalanceContextValue {
  /** Current token balance, or null while unknown (loading / signed out). */
  balance: number | null;
  /** True on the very first load before the balance has resolved. */
  isLoading: boolean;
  /** Whether a signed-in user is present (drives the navbar chip visibility). */
  isAuthenticated: boolean;
  /** Re-read the balance from the ledger RPC (call after any trade). */
  refresh: () => Promise<void>;
}

const BalanceContext = createContext<BalanceContextValue | null>(null);

export function BalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // A single browser client instance for the provider's lifetime.
  const supabaseRef = useRef<ReturnType<typeof createClient>>(undefined);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

  const fetchBalance = useCallback(
    async (uid: string | null) => {
      if (!uid) {
        setBalance(null);
        setIsLoading(false);
        return;
      }

      const { data, error } = await supabase.rpc("get_token_balance", {
        p_user_id: uid,
      });

      if (!error && data !== null && data !== undefined) {
        setBalance(Number(data));
      }
      setIsLoading(false);
    },
    [supabase],
  );

  // Resolve the current user once, then keep the balance in sync with auth
  // state changes (sign in / out) for the rest of the session.
  useEffect(() => {
    let active = true;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!active) return;
      const uid = user?.id ?? null;
      setUserId(uid);
      void fetchBalance(uid);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_OUT") {
        setUserId(null);
        setBalance(null);
        setIsLoading(false);
      } else if (
        event === "SIGNED_IN" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED"
      ) {
        const uid = session?.user?.id ?? null;
        setUserId(uid);
        void fetchBalance(uid);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [supabase, fetchBalance]);

  const refresh = useCallback(() => fetchBalance(userId), [fetchBalance, userId]);

  return (
    <BalanceContext.Provider
      value={{ balance, isLoading, isAuthenticated: userId !== null, refresh }}
    >
      {children}
    </BalanceContext.Provider>
  );
}

/** Access the shared token balance. Must be used within a `BalanceProvider`. */
export function useBalance(): BalanceContextValue {
  const context = useContext(BalanceContext);
  if (!context) {
    throw new Error("useBalance must be used within a BalanceProvider");
  }
  return context;
}
