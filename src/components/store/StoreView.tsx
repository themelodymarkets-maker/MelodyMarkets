"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Num } from "@/components/ui/Num";
import { useBalance } from "@/lib/balance-context";
import { useToast } from "@/components/ui/Toast";
import { createCheckoutSession } from "@/app/actions/checkout";
import { TOKEN_PACKS, formatPackPrice, type TokenPack } from "@/lib/token-packs";
import { formatInteger } from "@/lib/format";
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
          toast({ variant: "error", title: "Checkout did not start", description: result.message });
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

    // The credit lands via the webhook, which can take a few seconds, so poll
    // the balance briefly until it updates. No confetti here: celebration is
    // for completing a trade, not for spending money.
    setShowSuccess(true);
    setCreditPending(true);
    toast({
      variant: "success",
      title: "Purchase complete",
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
          <h1 className="display-label text-lg text-foreground">Buy tokens</h1>
          <p className="mt-2 text-sm text-muted">Sign in to add tokens to your balance.</p>
          <Link
            href="/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-control bg-accent px-6 text-sm text-background display-label transition-colors hover:bg-accent/90"
          >
            Sign in to continue
          </Link>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="display-label text-xl text-foreground">Buy tokens</h1>
          <p className="mt-1 text-sm text-muted">Add tokens to your balance. Tokens do not expire.</p>
        </div>
        <span
          className="inline-flex items-center gap-2 self-start rounded-control border border-border bg-background px-3 py-2 sm:self-auto"
          title="Your token balance"
        >
          <span className="display-label text-2xs text-muted">Balance</span>
          <Num
            value={isLoading ? null : balance}
            variant="token"
            className="text-sm text-token text-glow-token"
          />
        </span>
      </div>

      {showSuccess && (
        <div className="mt-6 rounded-card border border-border bg-surface p-4">
          <p className="text-sm text-foreground">Purchase complete.</p>
          <p className="mt-1 text-sm text-muted">
            {creditPending
              ? "Your tokens are being credited. This can take a few seconds, and your balance updates on its own."
              : "Your tokens have been added to your balance."}
          </p>
        </div>
      )}

      {/* Non-redeemable, stated plainly and up front, not buried in a footer. */}
      <p className="mt-6 font-data text-xs text-muted">
        Tokens are for playing MelodyMarkets. They are not real money and cannot be cashed out.
      </p>

      <div className="mt-4 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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

      <p className="mt-6 text-center text-sm text-muted">
        Payments are handled by Stripe. Tokens are credited after your payment is confirmed.
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
    <Card className={cn("relative flex flex-col", pack.highlight && "border-accent")}>
      {pack.highlight && (
        <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-control bg-accent px-3 py-1 display-label text-2xs text-background">
          Best value
        </span>
      )}

      <h2 className="display-label text-sm text-foreground">{pack.name}</h2>
      <p className="mt-1 text-sm text-muted">{pack.tagline}</p>

      <div className="mt-6">
        <p className="font-data tabular text-xl text-token text-glow-token">
          {formatInteger(pack.tokens)}
        </p>
        <p className="display-label text-2xs text-muted">tokens</p>
      </div>

      <p className="mt-4 font-data tabular text-lg text-foreground">{formatPackPrice(pack.priceCents)}</p>

      <Button
        type="button"
        variant={pack.highlight ? "primary" : "secondary"}
        className="mt-6 w-full"
        onClick={onBuy}
        disabled={disabled}
        aria-label={`Buy ${pack.name} pack, ${formatInteger(pack.tokens)} tokens for ${formatPackPrice(pack.priceCents)}`}
        aria-busy={isPending}
      >
        {isPending ? "Redirecting" : `Buy ${pack.name}`}
      </Button>
    </Card>
  );
}
