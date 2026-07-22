"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfettiBurst } from "@/components/ui/ConfettiBurst";
import { Num } from "@/components/ui/Num";
import { Explain } from "@/components/ui/Explain";
import { ImpactMeter } from "@/components/artist/ImpactMeter";
import { HowPricesMove } from "@/components/artist/HowPricesMove";
import { useBalance } from "@/lib/balance-context";
import { useToast } from "@/components/ui/Toast";
import { submitTrade } from "@/app/actions/trade";
import { quoteTrade, TRADE_FEE_RATE, FEE_FACTOR, type TradeSide } from "@/lib/amm";
import type { TradeErrorCode } from "@/lib/trade";
import { formatShares, formatTokenAmount } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import type { Tables } from "@/types/database";

interface TradePanelProps {
  artistId: string;
  artistName: string;
  initialTokenReserve: number;
  initialShareReserve: number;
  /** Server-resolved session state, so the gate renders correctly on first paint. */
  isAuthenticated: boolean;
}

/** Tokens above which a buy/sell asks for explicit confirmation. */
const CONFIRM_THRESHOLD_TOKENS = 1000;
/** Slippage tolerance applied to the quoted output to derive `min_receive`. */
const SLIPPAGE_TOLERANCE = 0.01;
const DEBOUNCE_MS = 220;

const ERROR_TITLES: Partial<Record<TradeErrorCode, string>> = {
  INSUFFICIENT_BALANCE: "Not enough tokens",
  INSUFFICIENT_SHARES: "Not enough shares",
  SLIPPAGE_EXCEEDED: "Price moved",
  NOT_AUTHENTICATED: "Sign in to trade",
  RATE_LIMITED: "Slow down",
};

export function TradePanel({
  artistId,
  artistName,
  initialTokenReserve,
  initialShareReserve,
  isAuthenticated,
}: TradePanelProps) {
  const { balance, isLoading: isBalanceLoading, refresh: refreshBalance } = useBalance();
  const { toast } = useToast();

  const [side, setSide] = useState<TradeSide>("buy");
  const [amountInput, setAmountInput] = useState("");
  const [debouncedAmount, setDebouncedAmount] = useState(0);
  const [reserves, setReserves] = useState({
    tokenReserve: initialTokenReserve,
    shareReserve: initialShareReserve,
  });
  const [holdingShares, setHoldingShares] = useState<number | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);
  const [fireKey, setFireKey] = useState(0);
  const [pulse, setPulse] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const [supabase] = useState(() => createClient());

  // --- Live reserves: keep quotes priced against the latest market state ----
  useEffect(() => {
    const channel = supabase
      .channel(`trade-panel-market-${artistId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "markets", filter: `artist_id=eq.${artistId}` },
        (payload) => {
          const m = payload.new as Tables<"markets">;
          setReserves({
            tokenReserve: Number(m.token_reserve),
            shareReserve: Number(m.share_reserve),
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, artistId]);

  // --- The signed-in user's position in THIS artist (own row via RLS) -------
  const fetchHoldings = useCallback(async () => {
    if (!isAuthenticated) return;
    const { data } = await supabase
      .from("holdings")
      .select("shares")
      .eq("artist_id", artistId)
      .maybeSingle();
    setHoldingShares(data ? Number(data.shares) : 0);
  }, [supabase, artistId, isAuthenticated]);

  useEffect(() => {
    void fetchHoldings();
  }, [fetchHoldings]);

  // --- Debounced numeric amount for the live preview ------------------------
  useEffect(() => {
    const parsed = Number.parseFloat(amountInput);
    const next = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
    const timer = setTimeout(() => setDebouncedAmount(next), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [amountInput]);

  // Reset a queued confirmation whenever the trade parameters change.
  useEffect(() => {
    setAwaitingConfirm(false);
  }, [side, debouncedAmount]);

  const spotPrice = reserves.tokenReserve / reserves.shareReserve;
  // While the token balance hasn't resolved yet (e.g. a slow/retrying mobile
  // network round trip), don't treat the unknown value as "0 tokens" -- that
  // falsely blocks the buy side with "not enough tokens" before we actually
  // know the balance. Shares (sell side) already default to 0 once holdings
  // have loaded, which is a real number, not a placeholder.
  const balanceUnresolved = side === "buy" && balance === null && isBalanceLoading;
  const maxAmount = side === "buy" ? (balance ?? 0) : (holdingShares ?? 0);

  const quote = useMemo(() => {
    if (debouncedAmount <= 0) return null;
    try {
      return quoteTrade(reserves, side, debouncedAmount);
    } catch {
      return null;
    }
  }, [reserves, side, debouncedAmount]);

  const preview = useMemo(() => {
    if (!quote) return null;
    const feeAmount =
      side === "buy"
        ? debouncedAmount * TRADE_FEE_RATE
        : quote.tokens / FEE_FACTOR - quote.tokens;
    const priceImpact =
      spotPrice > 0 ? (Math.abs(quote.pricePerShare - spotPrice) / spotPrice) * 100 : 0;
    // Magnitude in tokens that decides whether we confirm the trade.
    const tokenMagnitude = side === "buy" ? debouncedAmount : quote.tokens;
    const minReceive = (side === "buy" ? quote.shares : quote.tokens) * (1 - SLIPPAGE_TOLERANCE);
    return { feeAmount, priceImpact, tokenMagnitude, minReceive };
  }, [quote, side, debouncedAmount, spotPrice]);

  const parsedAmount = Number.parseFloat(amountInput);
  const hasAmount = Number.isFinite(parsedAmount) && parsedAmount > 0;
  const exceedsMax = !balanceUnresolved && hasAmount && parsedAmount > maxAmount + 1e-9;
  const canSubmit =
    Boolean(quote) && hasAmount && !exceedsMax && !isPending && !balanceUnresolved;
  const needsConfirm = (preview?.tokenMagnitude ?? 0) > CONFIRM_THRESHOLD_TOKENS;

  const runTrade = useCallback(async () => {
    if (!quote || !preview) return;
    setAwaitingConfirm(false);
    setIsPending(true);

    const result = await submitTrade({
      artistId,
      side,
      amount: debouncedAmount,
      minReceive: preview.minReceive,
    });

    setIsPending(false);

    if (result.ok) {
      const fill = result.result;
      toast({
        variant: "success",
        title: `${side === "buy" ? "Bought" : "Sold"} ${formatShares(fill.shares)} shares`,
        description: `${side === "buy" ? "Spent" : "Received"} ${formatTokenAmount(
          fill.tokens,
        )} tokens at ${formatTokenAmount(fill.pricePerShare)} per share`,
      });
      setAmountInput("");
      setDebouncedAmount(0);
      // Confetti fires on completing a trade (a reward for learning), never on
      // spending money.
      setFireKey((k) => k + 1);
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
      void refreshBalance();
      void fetchHoldings();
    } else {
      toast({
        variant: "error",
        title: ERROR_TITLES[result.code] ?? "Trade did not go through",
        description: result.message,
      });
    }
  }, [quote, preview, artistId, side, debouncedAmount, toast, refreshBalance, fetchHoldings]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    if (needsConfirm && !awaitingConfirm) {
      setAwaitingConfirm(true);
      return;
    }
    void runTrade();
  }

  function handleSelectMax() {
    if (balanceUnresolved || maxAmount <= 0) return;
    // Trim trailing zeros for a clean editable value.
    setAmountInput(String(Number(maxAmount.toFixed(side === "buy" ? 2 : 8))));
  }

  const isBuy = side === "buy";

  /**
   * The channel strip itself. Rendered inline in the desktop sidebar and,
   * on mobile, inside the bottom sheet. `idPrefix` keeps input ids unique
   * between the two placements. All state lives in the parent, so the single
   * Realtime subscription is never duplicated.
   */
  const strip = (idPrefix: string): ReactNode => {
    const amountId = `${idPrefix}-trade-amount`;

    if (!isAuthenticated) {
      return (
        <>
          <div className="flex items-center justify-between">
            <h2 className="display-label text-sm text-foreground">Trade</h2>
            <span className="text-xs text-muted">
              <Num value={spotPrice} variant="price" className="text-foreground" /> / share
            </span>
          </div>
          <div className="mt-5 rounded-card border border-border px-4 py-6 text-center">
            <p className="text-sm text-foreground">Sign in to trade {artistName}.</p>
            <p className="mt-1 text-sm text-muted">
              You need an account to buy and sell shares.
            </p>
            <Link
              href="/login"
              className="mt-4 inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-5 text-sm text-background display-label transition-colors hover:bg-accent/90"
            >
              Sign in to trade
            </Link>
          </div>
        </>
      );
    }

    return (
      <>
        <div className="flex items-center justify-between gap-3">
          <h2 className="display-label text-sm text-foreground">Trade</h2>
          <span className="text-xs text-muted">
            <Num value={spotPrice} variant="price" className="text-foreground" /> / share
          </span>
        </div>

        {/* Buy / Sell tabs. Cyan marks the active control; the label carries
            the meaning, so red stays reserved for downward market data. */}
        <div
          role="tablist"
          aria-label="Trade side"
          className="mt-4 grid grid-cols-2 gap-1 rounded-full border border-border bg-background p-1"
        >
          {(["buy", "sell"] as const).map((tab) => {
            const active = side === tab;
            return (
              <button
                key={tab}
                role="tab"
                type="button"
                aria-selected={active}
                onClick={() => setSide(tab)}
                className={cn(
                  "min-h-11 rounded-full text-sm display-label transition-[transform,background-color,box-shadow,color] duration-100 ease-out active:scale-95",
                  active
                    ? "bg-accent text-background glow-accent"
                    : "text-muted hover:text-foreground",
                )}
              >
                {tab === "buy" ? "Buy" : "Sell"}
              </button>
            );
          })}
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" noValidate>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted">{isBuy ? "Balance" : "Your shares"}</span>
            <span className="text-foreground">
              {isBuy ? (
                balanceUnresolved ? (
                  <span className="text-muted">Loading balance…</span>
                ) : (
                  <>
                    <Num value={balance} variant="token" className="text-token text-glow-token" />
                    {" tokens"}
                  </>
                )
              ) : (
                <>
                  <Num value={holdingShares} variant="share" /> shares
                </>
              )}
            </span>
          </div>

          <div>
            <label htmlFor={amountId} className="sr-only">
              {isBuy ? "Tokens to spend" : "Shares to sell"}
            </label>
            <div
              className={cn(
                "flex items-center gap-2 rounded-full border bg-border px-4 py-2.5 transition-[box-shadow,border-color] duration-150",
                exceedsMax ? "border-accent-dim" : "border-border focus-within:border-accent",
              )}
            >
              <input
                id={amountId}
                name={amountId}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0.00"
                value={amountInput}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) setAmountInput(v);
                }}
                disabled={isPending}
                className="min-w-0 flex-1 bg-transparent font-data tabular text-lg text-foreground outline-none placeholder:text-muted disabled:opacity-50"
              />
              <span className="shrink-0 display-label text-2xs text-muted">
                {isBuy ? "tokens" : "shares"}
              </span>
              <button
                type="button"
                onClick={handleSelectMax}
                disabled={balanceUnresolved || maxAmount <= 0 || isPending}
                className="shrink-0 rounded-control border border-border px-2.5 py-1 text-xs display-label text-accent transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-40"
              >
                Max
              </button>
            </div>
            {exceedsMax && (
              <p className="mt-1.5 text-sm text-foreground">
                {isBuy ? (
                  <>
                    That is more than your token balance.{" "}
                    <Link href="/store" className="text-accent underline underline-offset-2">
                      Buy more tokens
                    </Link>
                    .
                  </>
                ) : (
                  "You do not hold that many shares."
                )}
              </p>
            )}
          </div>

          {quote && preview && (
            <div className="flex flex-col gap-3 rounded-card border border-border bg-background p-3">
              <PreviewRow
                label={isBuy ? "Est. shares out" : "Est. tokens out"}
                value={
                  isBuy ? (
                    <Num value={quote.shares} variant="share" className="text-foreground" />
                  ) : (
                    <Num value={quote.tokens} variant="token" className="text-foreground" />
                  )
                }
                emphasized
              />
              <PreviewRow
                label="Effective price"
                value={
                  <span className="text-foreground">
                    <Num value={quote.pricePerShare} variant="price" className="text-foreground" /> / share
                  </span>
                }
              />
              <PreviewRow
                label={<Explain term="fee"><span className="text-muted">Fee (1%)</span></Explain>}
                value={<Num value={preview.feeAmount} variant="token" className="text-foreground" />}
              />

              <div className="border-t border-border pt-3">
                <ImpactMeter impactPercent={preview.priceImpact} side={side} />
              </div>

              <p className="text-xs text-muted">
                Max <Explain term="slippage">slippage</Explain> 1%. If the price moves past that
                before your order fills, it does not go through.
              </p>
            </div>
          )}

          <HowPricesMove />

          {awaitingConfirm && quote && preview ? (
            <div className="flex flex-col gap-3 rounded-card border border-accent/50 bg-border p-3">
              <p className="text-sm text-foreground">
                {isBuy ? (
                  <>
                    Confirm buy: about <Num value={quote.shares} variant="share" /> shares for{" "}
                    <Num value={debouncedAmount} variant="token" /> tokens.
                  </>
                ) : (
                  <>
                    Confirm sell: <Num value={debouncedAmount} variant="share" /> shares for about{" "}
                    <Num value={quote.tokens} variant="token" /> tokens.
                  </>
                )}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setAwaitingConfirm(false)}
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button type="button" className="flex-1" onClick={() => void runTrade()} disabled={isPending}>
                  {isPending ? "Placing" : "Confirm"}
                </Button>
              </div>
            </div>
          ) : (
            <Button type="submit" disabled={!canSubmit} className="w-full">
              {isPending
                ? "Placing"
                : balanceUnresolved
                  ? "Loading balance…"
                  : needsConfirm && hasAmount && !exceedsMax
                    ? `Review ${isBuy ? "buy" : "sell"}`
                    : isBuy
                      ? "Buy shares"
                      : "Sell shares"}
            </Button>
          )}
        </form>
      </>
    );
  };

  return (
    <>
      {/* Desktop: the strip lives in the sidebar rail. */}
      <div className="hidden lg:block">
        <Card className={cn("relative overflow-visible", pulse && "mm-pulse")}>
          <ConfettiBurst fireKey={fireKey} />
          {strip("d")}
        </Card>
      </div>

      {/* Mobile: a sticky price bar that opens the strip in a bottom sheet, so
          you never have to scroll past the chart to trade. */}
      <div className="lg:hidden">
        <div
          className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-surface px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)]"
        >
          <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="display-label text-2xs text-muted">{artistName}</p>
              <p className="truncate text-sm text-foreground">
                <Num value={spotPrice} variant="price" /> tokens / share
              </p>
            </div>
            <Button type="button" className="shrink-0" onClick={() => setSheetOpen(true)}>
              Trade
            </Button>
          </div>
        </div>

        {sheetOpen && (
          <TradeSheet onClose={() => setSheetOpen(false)}>
            <div className={cn("relative", pulse && "mm-pulse")}>
              <ConfettiBurst fireKey={fireKey} />
              {strip("m")}
            </div>
          </TradeSheet>
        )}
      </div>
    </>
  );
}

function PreviewRow({
  label,
  value,
  emphasized,
}: {
  label: ReactNode;
  value: ReactNode;
  emphasized?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-muted">{label}</span>
      <span className={cn(emphasized && "text-base")}>{value}</span>
    </div>
  );
}

/**
 * Mobile bottom sheet holding the channel strip. Dismissible by an explicit
 * Close control, by tapping the backdrop, by Escape, and by swiping down on
 * the grab handle.
 */
function TradeSheet({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const [dragY, setDragY] = useState(0);
  const startYRef = useRef<number | null>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Trade"
      className="fixed inset-0 z-[90] flex items-end bg-background/80"
      onClick={onClose}
    >
      <div
        className="mm-sheet-enter max-h-[85vh] w-full overflow-y-auto rounded-t-card border-t border-border bg-surface px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-2"
        style={dragY ? { transform: `translateY(${dragY}px)` } : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        {/* Grab handle: swipe down to dismiss. */}
        <div
          className="flex cursor-grab touch-none justify-center py-2"
          onPointerDown={(e) => {
            startYRef.current = e.clientY;
          }}
          onPointerMove={(e) => {
            if (startYRef.current === null) return;
            setDragY(Math.max(0, e.clientY - startYRef.current));
          }}
          onPointerUp={() => {
            if (dragY > 80) onClose();
            else setDragY(0);
            startYRef.current = null;
          }}
        >
          <span className="h-1 w-10 rounded-full bg-border" aria-hidden="true" />
        </div>

        <div className="flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="-m-1 rounded-control p-1 text-muted transition-colors hover:text-foreground"
            aria-label="Close"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="pb-4">{children}</div>
      </div>
    </div>
  );
}
