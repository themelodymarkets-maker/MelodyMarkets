import Link from "next/link";

/** MelodyMarkets wordmark, linking back to the landing page. */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-gradient text-sm text-white"
        aria-hidden="true"
      >
        M
      </span>
      <span className="text-foreground">
        Melody<span className="text-accent-gradient">Markets</span>
      </span>
    </Link>
  );
}
