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

/**
 * Retries for the initial resolve chain (auth lookup + balance RPC). Mobile
 * connections (cellular hand-offs, a backgrounded tab suspending in-flight
 * requests, flaky wifi) drop or stall this first round trip far more often
 * than a stable desktop connection, so a single unretried attempt tends to
 * leave `balance` stuck at `null` (rendered as "--") on phones/tablets while
 * desktop never notices. A few short, backed-off retries make the fetch
 * resilient to that without masking a genuinely signed-out user.
 */
const MAX_FETCH_ATTEMPTS = 3;
const RETRY_BASE_DELAY_MS = 600;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function BalanceProvider({ children }: { children: ReactNode }) {
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Mirrors of the latest state for the visibility/online recovery listener
  // below, which needs to read current values without re-subscribing every
  // time balance/isLoading change.
  const balanceRef = useRef(balance);
  balanceRef.current = balance;
  const isLoadingRef = useRef(isLoading);
  isLoadingRef.current = isLoading;

  // A single browser client instance for the provider's lifetime.
  const supabaseRef = useRef<ReturnType<typeof createClient>>(undefined);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

  // Guards so a slow/failed fetch never gets clobbered by a newer one, and so
  // retries stop once the component unmounts or a fresher request has started.
  const activeRef = useRef(true);
  const requestIdRef = useRef(0);

  const fetchBalance = useCallback(
    async (uid: string | null) => {
      const requestId = ++requestIdRef.current;
      const isStale = () => !activeRef.current || requestIdRef.current !== requestId;

      if (!uid) {
        if (isStale()) return;
        setBalance(null);
        setIsLoading(false);
        return;
      }

      for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt++) {
        if (isStale()) return;

        try {
          const { data, error } = await supabase.rpc("get_token_balance", {
            p_user_id: uid,
          });

          if (isStale()) return;

          if (!error && data !== null && data !== undefined) {
            setBalance(Number(data));
            setIsLoading(false);
            return;
          }
        } catch {
          // Network hiccup (common on mobile): fall through to retry below.
        }

        if (attempt < MAX_FETCH_ATTEMPTS) {
          await delay(RETRY_BASE_DELAY_MS * attempt);
        }
      }

      // Every attempt failed. Stop the spinner, but deliberately leave any
      // previously-known `balance` in place rather than forcing it to null --
      // a transient failure shouldn't erase a value the user already saw.
      if (!isStale()) setIsLoading(false);
    },
    [supabase],
  );

  // Resolve the current user once, then keep the balance in sync with auth
  // state changes (sign in / out) for the rest of the session.
  useEffect(() => {
    activeRef.current = true;

    function resolveUser() {
      supabase.auth
        .getUser()
        .then(({ data: { user } }) => {
          if (!activeRef.current) return;
          const uid = user?.id ?? null;
          setUserId(uid);
          void fetchBalance(uid);
        })
        .catch(() => {
          // getUser() itself was dropped (e.g. request cancelled while the
          // tab was backgrounded on mobile). Retry shortly instead of leaving
          // isLoading stuck true and the balance stuck at "--" forever.
          if (!activeRef.current) return;
          setTimeout(() => {
            if (activeRef.current) resolveUser();
          }, RETRY_BASE_DELAY_MS);
        });
    }

    resolveUser();

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

    // Belt-and-suspenders recovery: if the balance never resolved (still
    // loading, or the retries above all failed) by the time the tab regains
    // focus or the device comes back online, try again. This is what
    // recovers a session that started loading while a mobile browser tab was
    // backgrounded/suspended or the connection briefly dropped.
    function retryIfUnresolved() {
      if (!activeRef.current) return;
      if (document.visibilityState !== "visible") return;
      if (balanceRef.current !== null && !isLoadingRef.current) return;
      setUserId((currentUserId) => {
        if (currentUserId) void fetchBalance(currentUserId);
        return currentUserId;
      });
    }
    document.addEventListener("visibilitychange", retryIfUnresolved);
    window.addEventListener("online", retryIfUnresolved);

    return () => {
      activeRef.current = false;
      subscription.unsubscribe();
      document.removeEventListener("visibilitychange", retryIfUnresolved);
      window.removeEventListener("online", retryIfUnresolved);
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
