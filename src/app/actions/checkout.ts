"use server";

import { redirect } from "next/navigation";
import { getStripe } from "@/lib/stripe";
import { getTokenPack } from "@/lib/token-packs";
import { formatInteger } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

/**
 * Returned only on failure. On success this action never returns normally: it
 * throws Next's redirect to hand the browser off to Stripe Checkout.
 */
export interface CheckoutError {
  ok: false;
  message: string;
}

/**
 * Server Action that starts a token purchase.
 *
 * It validates the pack id against the in-code catalog, resolves the signed-in
 * user from cookies, and creates a Stripe Checkout Session in `payment` mode
 * with the line item built inline from the pack (no Dashboard product needed).
 * The session carries `{ user_id, pack_id, tokens }` in metadata so the webhook,
 * the ONLY place tokens are ever credited, can grant the correct amount.
 *
 * Tokens are NOT credited here and NOT on the success redirect: this only opens
 * the payment flow.
 */
export async function createCheckoutSession(packId: string): Promise<CheckoutError> {
  const pack = getTokenPack(packId);
  if (!pack) {
    return { ok: false, message: "That token pack doesn't exist." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, message: "Sign in to buy tokens." };
  }

  // Throttle checkout-session creation both per IP and per user (best-effort,
  // fails open) so a script can't spam Stripe session creation. See
  // src/lib/rate-limit.ts for the in-database strategy and its tradeoffs.
  const { checkRateLimit, getClientIp, CHECKOUT_IP_RATE_LIMIT, CHECKOUT_USER_RATE_LIMIT } =
    await import("@/lib/rate-limit");
  const ip = await getClientIp();
  const [ipAllowed, userAllowed] = await Promise.all([
    checkRateLimit(supabase, `checkout-ip:${ip}`, CHECKOUT_IP_RATE_LIMIT),
    checkRateLimit(supabase, `checkout-user:${user.id}`, CHECKOUT_USER_RATE_LIMIT),
  ]);
  if (!ipAllowed || !userAllowed) {
    return { ok: false, message: "Too many checkout attempts. Wait a minute and try again." };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!appUrl) {
    console.error("[checkout] NEXT_PUBLIC_APP_URL is not set.");
    return { ok: false, message: "Checkout is not configured. Try again later." };
  }

  let checkoutUrl: string | null = null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: pack.priceCents,
            product_data: {
              name: `${pack.name} pack: ${formatInteger(pack.tokens)} tokens`,
              description: "MelodyMarkets in-game tokens",
            },
          },
        },
      ],
      // Consumed by the webhook to credit the ledger. Values must be strings.
      metadata: {
        user_id: user.id,
        pack_id: pack.id,
        tokens: String(pack.tokens),
      },
      success_url: `${appUrl}/store?status=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/store?status=cancelled`,
    });
    checkoutUrl = session.url;
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[checkout] failed to create session:", message);
    return { ok: false, message: "Could not start checkout. Please try again." };
  }

  if (!checkoutUrl) {
    return { ok: false, message: "Could not start checkout. Please try again." };
  }

  // redirect() throws internally, so it must live outside the try/catch above.
  redirect(checkoutUrl);
}
