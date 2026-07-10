/**
 * Token pack catalog — the single source of truth for what a user can buy.
 *
 * Packs are defined here in code (never in the Stripe Dashboard) so a checkout
 * session builds its line item from `price_data` inline. That keeps the app
 * self-contained: there is no product/price to configure in Stripe, and the
 * token grant that a purchase is worth lives right next to its price.
 *
 * SECURITY: the token amount credited on a successful purchase is derived from
 * this catalog (via the pack id carried in the Checkout Session metadata), not
 * from anything the client sends. Editing these values changes both the price
 * charged and the tokens granted together.
 */
export interface TokenPack {
  /** Stable identifier used in metadata and the buy action. */
  id: string;
  /** Display name. */
  name: string;
  /** Tokens credited to the buyer on a successful purchase. */
  tokens: number;
  /** Price in USD cents (Stripe's smallest currency unit). */
  priceCents: number;
  /** Short pitch shown under the name. */
  tagline: string;
  /** When true, the card is emphasized as the recommended option. */
  highlight?: boolean;
}

/** The three purchasable token packs, cheapest first. */
export const TOKEN_PACKS: readonly TokenPack[] = [
  {
    id: "starter",
    name: "Starter",
    tokens: 5_000,
    priceCents: 499,
    tagline: "A quick top-up to keep trading.",
  },
  {
    id: "pro",
    name: "Pro",
    tokens: 12_000,
    priceCents: 999,
    tagline: "More tokens, better value per dollar.",
    highlight: true,
  },
  {
    id: "whale",
    name: "Whale",
    tokens: 30_000,
    priceCents: 1_999,
    tagline: "Go big and corner the market.",
  },
] as const;

/** Looks up a pack by id, or returns undefined for an unknown id. */
export function getTokenPack(id: string): TokenPack | undefined {
  return TOKEN_PACKS.find((pack) => pack.id === id);
}

/** Formats a cent price as USD, e.g. 499 -> "$4.99". */
export function formatPackPrice(priceCents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(priceCents / 100);
}
