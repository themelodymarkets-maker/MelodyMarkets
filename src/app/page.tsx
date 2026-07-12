import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { LinkButton } from "@/components/ui/LinkButton";

export const metadata: Metadata = {
  title: "Home",
  description:
    "MelodyMarkets turns music fandom into a game. Buy and sell virtual shares of your favorite artists and climb the leaderboard.",
};

const HOW_IT_WORKS_STEPS = [
  {
    step: "01",
    title: "Discover artists",
    description: "Browse rising and established artists tracked live on MelodyMarkets.",
  },
  {
    step: "02",
    title: "Trade with tokens",
    description: "Use in-game tokens to buy and sell virtual shares as artist buzz shifts.",
  },
  {
    step: "03",
    title: "Climb the leaderboard",
    description: "Grow your portfolio and see how your picks stack up against other traders.",
  },
] as const;

export default function Home() {
  return (
    <main>
      <section className="mx-auto flex max-w-4xl flex-col items-center px-4 py-24 text-center sm:px-6 sm:py-32">
        <span className="rounded-full border border-border bg-surface px-4 py-1.5 text-xs font-medium tracking-wide text-muted uppercase">
          Now in early access
        </span>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-balance sm:text-6xl">
          Trade the <span className="text-accent-gradient">artists</span> you love
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted text-balance">
          MelodyMarkets turns music fandom into a game. Buy and sell virtual shares of your
          favorite artists using in-game tokens, and see your instincts pay off on the
          leaderboard.
        </p>
        <div className="mt-10">
          <LinkButton href="/markets" className="px-8 py-3 text-base">
            Explore Markets
          </LinkButton>
        </div>
      </section>

      <section
        aria-labelledby="how-it-works-heading"
        className="mx-auto max-w-6xl px-4 pb-24 sm:px-6"
      >
        <h2 id="how-it-works-heading" className="text-center text-2xl font-semibold sm:text-3xl">
          How it works
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-3">
          {HOW_IT_WORKS_STEPS.map(({ step, title, description }) => (
            <Card key={step}>
              <span className="text-accent-gradient text-sm font-bold">{step}</span>
              <h3 className="mt-3 text-lg font-semibold text-foreground">{title}</h3>
              <p className="mt-2 text-sm text-muted">{description}</p>
            </Card>
          ))}
        </div>
      </section>
    </main>
  );
}
