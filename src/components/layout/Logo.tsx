import Link from "next/link";

/** MelodyMarkets wordmark — cyan mark, clean Geist lockup. */
export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2 rounded-full">
      <span
        className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-sm font-semibold text-background glow-accent"
        aria-hidden="true"
      >
        M
      </span>
      <span className="display-label text-base text-foreground">
        Melody<span className="text-accent">Markets</span>
      </span>
    </Link>
  );
}
