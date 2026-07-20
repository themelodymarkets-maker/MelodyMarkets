import { Num } from "@/components/ui/Num";
import { Explain } from "@/components/ui/Explain";
import { cn } from "@/lib/utils";

interface ImpactMeterProps {
  /** Absolute price-impact percentage for the current order (e.g. 3.4). */
  impactPercent: number;
  /** Which direction the order moves the price, for the plain-English line. */
  side?: "buy" | "sell";
}

/** Impact (%) at which the bar is considered fully filled (pinned). */
const FULL_AT = 10;

function fillPercent(impactPercent: number): number {
  return Math.min(Math.max(impactPercent, 0) / FULL_AT, 1) * 100;
}

function explain(impactPercent: number, side: "buy" | "sell"): string {
  if (impactPercent < 2) return "Your order barely moves the price.";
  const worse = side === "buy" ? "fewer shares per token" : "fewer tokens per share";
  if (impactPercent <= 5) {
    return `This order moves the price as it fills, so you get ${worse}.`;
  }
  return "This order is large next to the pool. You are paying well past the current price.";
}

/**
 * Fluid price-impact meter: one seamless gradient bar (Cyan → Neon Green → Red)
 * that interpolates width smoothly as the order size changes.
 */
export function ImpactMeter({ impactPercent, side = "buy" }: ImpactMeterProps) {
  const width = fillPercent(impactPercent);
  const isActive = impactPercent > 0.05;
  const isHot = impactPercent > 5;

  return (
    <div>
      <div
        className="relative h-2.5 overflow-hidden rounded-full border border-border bg-background"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={FULL_AT}
        aria-valuenow={Math.min(impactPercent, FULL_AT)}
        aria-label="Price impact"
      >
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-[width,filter,box-shadow] duration-300 ease-out",
            isActive && "mm-meter-fill",
          )}
          style={{
            width: `${width}%`,
            backgroundImage:
              "linear-gradient(90deg, var(--accent) 0%, var(--gain) 50%, var(--loss) 100%)",
            backgroundSize: "100% 100%",
          }}
        />
      </div>

      <div className="mt-2 flex items-baseline justify-between gap-3">
        <Explain term="price impact">
          <span className="display-label text-2xs text-muted">Price impact</span>
        </Explain>
        <Num
          value={impactPercent}
          variant="percent"
          className={cn(isHot ? "text-loss text-glow-loss" : "text-foreground")}
        />
      </div>
      <p className="mt-1 text-sm text-muted">{explain(impactPercent, side)}</p>
    </div>
  );
}
