import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = {
  title: "Home",
  description:
    "Buy and sell virtual shares of music artists with in-game tokens, and watch prices move as other people trade.",
};

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Find an artist",
    description: "Browse artists tracked live on MelodyMarkets.",
  },
  {
    step: "02",
    title: "Buy shares",
    description: "Spend in-game tokens to buy shares. The price moves as people trade.",
  },
  {
    step: "03",
    title: "Check the leaderboard",
    description: "See how your picks do against other traders.",
  },
] as const;

export default function Home() {
  return (
    <main className="mm-page-enter">
      <section className="relative mx-auto flex max-w-4xl flex-col items-center overflow-hidden px-4 py-24 text-center sm:px-6 sm:py-32">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,rgba(0,242,254,0.1),transparent_60%)]"
        />
        <span className="rounded-full border border-accent/40 bg-surface px-4 py-1.5 display-label text-2xs text-accent glow-accent">
          Early access
        </span>
        <h1 className="mt-6 display-label text-2xl text-balance text-foreground sm:text-3xl">
          Trade shares in <span className="text-accent text-glow">music artists</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted text-balance">
          Buy shares in artists with in-game tokens. Watch the price move as other people trade,
          and see how your picks do on the leaderboard.
        </p>
        <div className="mt-10">
          <LinkButton href="/markets" className="px-8">
            Browse markets
          </LinkButton>
        </div>
      </section>

      <section aria-labelledby="how-it-works-heading" className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
        <h2
          id="how-it-works-heading"
          className="display-label text-center text-lg text-foreground"
        >
          How it works
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map(({ step, title, description }) => (
            <Card key={step}>
              <span className="font-data text-sm font-bold text-accent text-glow">{step}</span>
              <h3 className="mt-3 display-label text-sm text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted">{description}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
