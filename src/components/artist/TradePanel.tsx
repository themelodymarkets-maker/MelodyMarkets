"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfettiBurst } from "@/components/ui/ConfettiBurst";
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
};

export function TradePanel({
  artistId,
  artistName,
  initialTokenReserve,
  initialShareReserve,
  isAuthenticated,
}: TradePanelProps) {
  const { balance, refresh: refreshBalance } = useBalance();
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

  const supabaseRef = useRef<ReturnType<typeof createClient>>(undefined);
  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

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
  const exceedsMax = hasAmount && parsedAmount > maxAmount + 1e-9;
  const canSubmit = Boolean(quote) && hasAmount && !exceedsMax && !isPending;
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
        )} tokens @ ${formatTokenAmount(fill.pricePerShare)} / share`,
      });
      setAmountInput("");
      setDebouncedAmount(0);
      setFireKey((k) => k + 1);
      setPulse(true);
      setTimeout(() => setPulse(false), 700);
      void refreshBalance();
      void fetchHoldings();
    } else {
      toast({
        variant: "error",
        title: ERROR_TITLES[result.code] ?? "Trade failed",
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
    if (maxAmount <= 0) return;
    // Trim trailing zeros for a clean editable value.
    setAmountInput(String(Number(maxAmount.toFixed(side === "buy" ? 2 : 8))));
  }

  // ---------------------------------------------------------------------------
  // Signed-out gate.
  // ---------------------------------------------------------------------------
  if (!isAuthenticated) {
    return (
      <Card>
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Trade</h2>
        <p className="mt-3 text-2xl font-semibold text-foreground tabular-nums">
          {formatTokenAmount(spotPrice)}
        </p>
        <p className="text-xs text-muted">tokens / share</p>

        <div className="mt-5 rounded-xl border border-dashed border-border px-4 py-6 text-center">
          <p className="text-sm font-medium text-foreground">Sign in to trade {artistName}</p>
          <p className="mt-1 text-xs text-muted">
            Create an account or sign in to buy and sell shares.
          </p>
          <Link
            href="/login"
            className="mt-4 inline-flex items-center justify-center rounded-full bg-accent-gradient px-5 py-2.5 text-sm font-medium text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
          >
            Sign in to trade
          </Link>
        </div>
      </Card>
    );
  }

  const isBuy = side === "buy";

  return (
    <Card className={cn("relative overflow-visible", pulse && "mm-pulse")}>
      <ConfettiBurst fireKey={fireKey} />

      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold tracking-wide text-muted uppercase">Trade</h2>
        <span className="text-xs text-muted tabular-nums">
          {formatTokenAmount(spotPrice)} / share
        </span>
      </div>

      {/* Buy / Sell tabs */}
      <div
        role="tablist"
        aria-label="Trade side"
        className="mt-4 grid grid-cols-2 gap-1 rounded-full border border-border p-1"
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
                "rounded-full py-2 text-sm font-semibold capitalize transition-colors duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan",
                active && tab === "buy" && "bg-gain/15 text-gain",
                active && tab === "sell" && "bg-loss/15 text-loss",
                !active && "text-muted hover:text-foreground",
              )}
            >
              {tab}
            </button>
          );
        })}
      </div>

      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-4" noValidate>
        {/* Available context: balance for buy, holdings for sell */}
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted">{isBuy ? "Balance" : "Your shares"}</span>
          <span className="font-medium text-foreground tabular-nums">
            {isBuy
              ? `${balance === null ? "--" : formatTokenAmount(balance)} tokens`
              : `${holdingShares === null ? "--" : formatShares(holdingShares)} shares`}
          </span>
        </div>

        {/* Amount input with Max */}
        <div>
          <label htmlFor="trade-amount" className="sr-only">
            {isBuy ? "Tokens to spend" : "Shares to sell"}
          </label>
          <div
            className={cn(
              "flex items-center gap-2 rounded-xl border bg-background px-3 py-2.5 transition-colors focus-within:border-accent-cyan",
              exceedsMax ? "border-loss" : "border-border",
            )}
          >
            <input
              id="trade-amount"
              name="trade-amount"
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              value={amountInput}
              onChange={(e) => {
                const v = e.target.value;
                // Allow only a sane decimal string (digits + one dot).
                if (v === "" || /^\d*\.?\d*$/.test(v)) setAmountInput(v);
              }}
              disabled={isPending}
              className="min-w-0 flex-1 bg-transparent text-lg font-semibold text-foreground tabular-nums outline-none placeholder:text-muted disabled:opacity-50"
            />
            <span className="shrink-0 text-xs font-medium text-muted">
              {isBuy ? "tokens" : "shares"}
            </span>
            <button
              type="button"
              onClick={handleSelectMax}
              disabled={maxAmount <= 0 || isPending}
              className="shrink-0 rounded-full border border-border px-2.5 py-1 text-xs font-semibold text-accent-cyan transition-colors hover:bg-surface-hover disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
            >
              Max
            </button>
          </div>
          {exceedsMax && (
            <p className="mt-1.5 text-xs text-loss">
              {isBuy ? (
                <>
                  Amount exceeds your token balance.{" "}
                  <Link href="/store" className="font-semibold text-accent-cyan hover:underline">
                    Need more tokens?
                  </Link>
                </>
              ) : (
                "You don't hold that many shares."
              )}
            </p>
          )}
        </div>

        {/* Live quote preview */}
        {quote && preview && (
          <div className="flex flex-col gap-2 rounded-xl border border-border bg-background/60 p-3 text-sm">
            <PreviewRow
              label={isBuy ? "Est. shares received" : "Est. tokens received"}
              value={
                isBuy
                  ? `${formatShares(quote.shares)} shares`
                  : `${formatTokenAmount(quote.tokens)} tokens`
              }
              emphasized
            />
            <PreviewRow
              label="Effective price"
              value={`${formatTokenAmount(quote.pricePerShare)} / share`}
            />
            <PreviewRow
              label="Fee (1%)"
              value={`${formatTokenAmount(preview.feeAmount)} tokens`}
            />
            <PreviewRow
              label="Price impact"
              value={`${preview.priceImpact.toFixed(2)}%`}
              valueClassName={cn(
                preview.priceImpact > 5
                  ? "text-loss"
                  : preview.priceImpact > 2
                    ? "text-[#f59e0b]"
                    : "text-foreground",
              )}
            />
            {preview.priceImpact > 2 && (
              <p
                className={cn(
                  "text-xs",
                  preview.priceImpact > 5 ? "text-loss" : "text-[#f59e0b]",
                )}
              >
                {preview.priceImpact > 5
                  ? "High price impact — this trade moves the market significantly."
                  : "Elevated price impact for this trade size."}
              </p>
            )}
          </div>
        )}

        {/* Confirmation step for large trades */}
        {awaitingConfirm && quote && preview ? (
          <div className="flex flex-col gap-3 rounded-xl border border-accent-cyan/40 bg-surface-hover p-3">
            <p className="text-sm text-foreground">
              {isBuy ? (
                <>
                  Confirm buy: <span className="font-semibold">~{formatShares(quote.shares)}</span>{" "}
                  shares for <span className="font-semibold">{formatTokenAmount(debouncedAmount)}</span>{" "}
                  tokens
                </>
              ) : (
                <>
                  Confirm sell: <span className="font-semibold">{formatShares(debouncedAmount)}</span>{" "}
                  shares for <span className="font-semibold">~{formatTokenAmount(quote.tokens)}</span>{" "}
                  tokens
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
                {isPending ? "Placing…" : "Confirm"}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="submit"
            disabled={!canSubmit}
            className={cn(
              "w-full disabled:cursor-not-allowed disabled:opacity-50",
              isBuy ? "" : "bg-loss text-white hover:opacity-90",
            )}
          >
            {isPending
              ? "Placing…"
              : needsConfirm && hasAmount && !exceedsMax
                ? `Review ${isBuy ? "buy" : "sell"}`
                : isBuy
                  ? "Buy shares"
                  : "Sell shares"}
          </Button>
        )}
      </form>
    </Card>
  );
}

function PreviewRow({
  label,
  value,
  emphasized,
  valueClassName,
}: {
  label: string;
  value: string;
  emphasized?: boolean;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasized ? "text-base font-semibold text-foreground" : "font-medium text-foreground",
          valueClassName,
        )}
      >
        {value}
      </span>
    </div>
  );
}
