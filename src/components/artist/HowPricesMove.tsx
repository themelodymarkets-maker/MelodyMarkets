"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A quiet "How prices move here" link that opens a short modal explaining the
 * AMM in plain English, with a small diagram. This is literally true of the
 * app, so it is stated plainly: no one sets the price by hand.
 */
export function HowPricesMove() {
  const [open, setOpen] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    closeRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm text-accent underline decoration-dotted underline-offset-4"
      >
        How prices move here
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="how-prices-move-title"
          className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 p-4"
          onClick={() => setOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-card border border-border bg-surface p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="how-prices-move-title" className="display-label text-lg text-foreground">
                How prices move here
              </h2>
              <button
                ref={closeRef}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close"
                className="-m-1 rounded-control p-1 text-muted transition-colors hover:text-foreground"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="h-5 w-5" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <PoolDiagram />

            <p className="mt-4 text-sm text-muted">
              Nobody sets this price by hand. Each artist has a pool holding tokens on one side and
              shares on the other, and the price is just the ratio between them. When you buy,
              tokens go into the pool and shares come out, so the price goes up. When you sell,
              shares go back in and the price goes down. Bigger orders shift the pool more, which is
              why a large trade moves the price further than a small one. Every trade here works the
              same way.
            </p>
          </div>
        </div>
      )}
    </>
  );
}

/** A tiny token-pool diagram: buying moves the balance and the price up. */
function PoolDiagram() {
  return (
    <div className="mt-4 flex items-center justify-center gap-4 rounded-card border border-border bg-background p-4">
      <div className="flex flex-col items-center gap-1">
        <span className="display-label text-2xs text-muted">Tokens</span>
        <span className="h-14 w-6 rounded-control bg-accent" aria-hidden="true" style={{ height: 56 }} />
      </div>
      <svg viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth={2} className="h-6 w-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 19V5M6 11l6-6 6 6" />
      </svg>
      <div className="flex flex-col items-center gap-1">
        <span className="display-label text-2xs text-muted">Shares</span>
        <span className="w-6 rounded-control bg-accent-dim" aria-hidden="true" style={{ height: 32 }} />
      </div>
    </div>
  );
}
