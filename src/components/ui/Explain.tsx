"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";

/** The only terms allowed to carry an Explain popover. */
export type ExplainTerm =
  | "price impact"
  | "fee"
  | "cost basis"
  | "unrealized P/L"
  | "return"
  | "market cap"
  | "slippage";

/** Plain-English, 25-words-or-fewer definitions. */
const DEFINITIONS: Record<ExplainTerm, string> = {
  "price impact":
    "How much your order moves the price while it fills. Bigger orders move it more, so your average price gets worse.",
  fee: "A 1% cut taken from each trade. It stays in the pool, so a trade costs a little more than the raw price.",
  "cost basis":
    "The total tokens you spent to buy the shares you still hold. Your profit or loss is measured against it.",
  "unrealized P/L":
    "Profit or loss you would take if you sold right now. It moves with the price until you actually sell.",
  return:
    "How much your whole account has grown or shrunk since you started, as a percentage of the tokens you put in.",
  "market cap":
    "The price per share times the total shares in the pool. A rough size of the whole market for this artist.",
  slippage:
    "The gap between the price you see and the price you get, because your order moves the market as it fills.",
};

interface ExplainProps {
  term: ExplainTerm;
  /** Override the visible text; defaults to the term itself. */
  children?: ReactNode;
}

/**
 * A term with a small cyan dotted underline. Tapping it (hover does not
 * exist on phones) opens a popover with a plain-English definition. Dismissed
 * by tapping outside or pressing Escape.
 */
export function Explain({ term, children }: ExplainProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLSpanElement>(null);
  const popoverId = useId();

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <span ref={containerRef} className="relative inline-flex">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={popoverId}
        onClick={() => setOpen((o) => !o)}
        // -my-2 py-2 expands the tap target to ~44px without shifting the line.
        className="-my-2 inline-flex py-2 text-left underline decoration-accent decoration-dotted decoration-2 underline-offset-4"
      >
        {children ?? term}
      </button>

      {open && (
        <span
          id={popoverId}
          role="tooltip"
          className="absolute bottom-full left-0 z-50 mb-2 block w-64 rounded-card border border-border bg-surface p-3 text-sm text-muted shadow-none"
        >
          <span className="display-label mb-1 block text-2xs text-foreground">{term}</span>
          {DEFINITIONS[term]}
        </span>
      )}
    </span>
  );
}
