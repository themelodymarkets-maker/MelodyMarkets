"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ConfettiBurst } from "@/components/ui/ConfettiBurst";
import { useBalance } from "@/lib/balance-context";
import { useToast } from "@/components/ui/Toast";
import { createCheckoutSession } from "@/app/actions/checkout";
import { TOKEN_PACKS, formatPackPrice, type TokenPack } from "@/lib/token-packs";
import { formatTokenAmount } from "@/lib/format";
import { cn } from "@/lib/utils";

interface StoreViewProps {
  /** Server-resolved session state, so the gate is correct on first paint. */
  isAuthenticated: boolean;
}

/** How many times, and how often, to re-check the balance after a success. */
const BALANCE_POLL_ATTEMPTS = 6;
const BALANCE_POLL_INTERVAL_MS = 2_000;

export function StoreView({ isAuthenticated }: StoreViewProps) {
  const { balance, isLoading, refresh: refreshBalance } = useBalance();
  const { toast } = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [pendingPackId, setPendingPackId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [fireKey, setFireKey] = useState(0);
  const [showSuccess, setShowSuccess] = useState(false);
  const [creditPending, setCreditPending] = useState(false);

  const status = searchParams.get("status");
  // Guard so the return handler runs once per navigation, not on every render.
  const handledStatusRef = useRef<string | null>(null);

  const handleBuy = useCallback(
    (packId: string) => {
      setPendingPackId(packId);
      startTransition(async () => {
        // On success this redirects to Stripe and never returns; we only get a
        // value back when something went wrong.
        const result = await createCheckoutSession(packId);
        if (result && !result.ok) {
          toast({ variant: "error", title: "Checkout failed", description: result.message });
          setPendingPackId(null);
        }
      });
    },
    [toast],
  );

  // Handle the return from Stripe (?status=success|cancelled).
  useEffect(() => {
    if (!status || handledStatusRef.current === status) return;
    handledStatusRef.current = status;

    if (status === "cancelled") {
      toast({
        variant: "error",
        title: "Checkout cancelled",
        description: "No charge was made. Your tokens are unchanged.",
      });
      router.replace("/store");
      return;
    }

    if (status !== "success") return;

    // Celebrate immediately; the credit itself lands via the webhook, which can
    // take a few seconds, so poll the balance briefly until it updates.
    setShowSuccess(true);
    setFireKey((k) => k + 1);
    setCreditPending(true);
    toast({
      variant: "success",
      title: "Purchase complete!",
      description: "Your tokens are on the way.",
    });

    const startingBalance = balance;
    let attempts = 0;
    let cancelled = false;

    const poll = async () => {
      if (cancelled) return;
      attempts += 1;
      await refreshBalance();
      if (cancelled) return;

      const updated =
        startingBalance === null ? balance !== null : (balance ?? 0) > (startingBalance ?? 0);

      if (updated || attempts >= BALANCE_POLL_ATTEMPTS) {
        setCreditPending(false);
        return;
      }
      window.setTimeout(poll, BALANCE_POLL_INTERVAL_MS);
    };
    void poll();

    // Clean the query string so a refresh doesn't re-trigger the celebration.
    router.replace("/store");

    return () => {
      cancelled = true;
    };
    // We intentionally key this only on `status`; balance is read as a snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  if (!isAuthenticated) {
    return (
      <div className="mx-auto w-full max-w-md">
        <Card className="text-center">
          <h1 className="text-xl font-semibold text-foreground">Buy tokens</h1>
          <p className="mt-2 text-sm text-muted">
            Sign in to top up your balance and keep trading the artists you love.
          </p>
          <Link
            href="/login"
            className="mt-6 inline-flex items-center justify-center rounded-full bg-accent-gradient px-6 py-2.5 text-sm font-medium text-white transition-opacity duration-200 hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-cyan"
          >
            Sign in to continue
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-full max-w-5xl">
      <ConfettiBurst fireKey={fireKey} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Buy tokens</h1>
          <p className="mt-1 text-sm text-muted">
            Top up your balance to trade more artists. Tokens never expire.
          </p>
        </div>
        <span
          className="inline-flex items-center gap-2 self-start rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-foreground tabular-nums sm:self-auto"
          title="Your token balance"
        >
          <span className="text-muted">Balance</span>
          {isLoading || balance === null ? "—" : formatTokenAmount(balance)}
        </span>
      </div>

      {showSuccess && (
        <div className="mt-6 rounded-card border border-gain/40 bg-gain/10 p-4">
          <p className="text-sm font-semibold text-gain">Thanks for your purchase! 🎉</p>
          <p className="mt-1 text-xs text-muted">
            {creditPending
              ? "Your tokens are being credited — this can take a few seconds. Your balance will update automatically."
              : "Your tokens have been added to your balance."}
          </p>
        </div>
      )}

      <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {TOKEN_PACKS.map((pack) => (
          <PackCard
            key={pack.id}
            pack={pack}
            isPending={pendingPackId === pack.id}
            disabled={pendingPackId !== null}
            onBuy={() => handleBuy(pack.id)}
          />
        ))}
      </div>

      <p className="mt-6 text-center text-xs text-muted">
        Payments are securely processed by Stripe. Tokens are credited after your payment is
        confirmed.
      </p>
    </div>
  );
}

function PackCard({
  pack,
  isPending,
  disabled,
  onBuy,
}: {
  pack: TokenPack;
  isPending: boolean;
  disabled: boolean;
  onBuy: () => void;
}) {
  return (
    <Card
      className={cn(
        "relative flex flex-col",
        pack.highlight && "border-accent-purple/60 hover:border-accent-purple",
      )}
    >
      {pack.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-accent-gradient px-3 py-1 text-xs font-semibold text-white">
          Best value
        </span>
      )}

      <h2 className="text-lg font-semibold text-foreground">{pack.name}</h2>
      <p className="mt-1 text-sm text-muted">{pack.tagline}</p>

      <div className="mt-6">
        <p className="text-3xl font-bold text-accent-gradient tabular-nums">
          {pack.tokens.toLocaleString("en-US")}
        </p>
        <p className="text-xs font-medium tracking-wide text-muted uppercase">tokens</p>
      </div>

      <p className="mt-4 text-2xl font-semibold text-foreground tabular-nums">
        {formatPackPrice(pack.priceCents)}
      </p>

      <Button
        type="button"
        variant={pack.highlight ? "primary" : "secondary"}
        className="mt-6 w-full disabled:cursor-not-allowed disabled:opacity-60"
        onClick={onBuy}
        disabled={disabled}
      >
        {isPending ? "Redirecting…" : `Buy ${pack.name}`}
      </Button>
    </Card>
  );
}
