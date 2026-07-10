import "server-only";

import Stripe from "stripe";

/**
 * Lazily-constructed, server-only Stripe client.
 *
 * The `server-only` import makes the build fail if this module is ever pulled
 * into a client bundle, so the secret key can never leak to the browser. The
 * client is created on first use (not at module load) so importing this file
 * during the build never throws when `STRIPE_SECRET_KEY` is absent.
 */
let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is not set.");
  }

  stripeClient = new Stripe(secretKey);
  return stripeClient;
}
