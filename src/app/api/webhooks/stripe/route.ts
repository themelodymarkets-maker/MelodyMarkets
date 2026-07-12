import "server-only";

import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { getStripe } from "@/lib/stripe";
import { createAdminClient } from "@/lib/supabase/admin";

// Signature verification needs the exact raw bytes Stripe signed, and the
// service-role client must run server-side — so this handler is Node-only.
export const runtime = "nodejs";

// PostgREST/Postgres unique-violation SQLSTATE, raised by the partial unique
// index on token_ledger(reason, reference_id). We treat it as "already done".
const UNIQUE_VIOLATION = "23505";

/**
 * POST /api/webhooks/stripe
 *
 * The ONLY place token purchases are credited. Tokens are never granted on the
 * client or on the success redirect — only here, after Stripe's signature is
 * verified against the RAW request body.
 *
 * Flow:
 *   1. Read the raw body (needed for signature verification).
 *   2. Verify the signature with STRIPE_WEBHOOK_SECRET.
 *   3. On `checkout.session.completed`, credit a `stripe_purchase` ledger entry
 *      via the service role, using the session id as `reference_id` so retries
 *      are idempotent (a unique violation means we already credited it).
 *
 * Returns 200 for handled/duplicate events, 400 for a bad/missing signature.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!signature || !webhookSecret) {
    console.error("[stripe webhook] missing signature header or STRIPE_WEBHOOK_SECRET");
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }

  // The raw, unparsed body — exactly what Stripe signed.
  const rawBody = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error("[stripe webhook] signature verification failed:", message);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    try {
      await creditPurchase(session);
    } catch (error) {
      // A genuine failure (e.g. DB unreachable): return 500 so Stripe retries.
      console.error("[stripe webhook] failed to credit purchase:", error);
      return NextResponse.json({ error: "Processing failed" }, { status: 500 });
    }
  } else {
    console.log(`[stripe webhook] ignoring event type: ${event.type}`);
  }

  return NextResponse.json({ received: true });
}

/**
 * Credits the tokens for a completed checkout session, idempotently.
 *
 * The token amount comes from the session metadata written when the session was
 * created (server-side, from the in-code pack catalog), never from the client.
 */
async function creditPurchase(session: Stripe.Checkout.Session): Promise<void> {
  const userId = session.metadata?.user_id;
  const tokens = Number(session.metadata?.tokens);

  if (!userId || !Number.isFinite(tokens) || tokens <= 0) {
    // A validly-signed event we can't act on — log and ack so Stripe doesn't
    // retry forever. This should never happen with our own sessions.
    console.error(
      `[stripe webhook] session ${session.id} has invalid metadata; skipping`,
    );
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("token_ledger").insert({
    user_id: userId,
    amount: tokens,
    reason: "stripe_purchase",
    reference_id: session.id,
  });

  if (error) {
    if (error.code === UNIQUE_VIOLATION) {
      console.log(`[stripe webhook] session ${session.id} already credited; skipping`);
      return;
    }
    // Bubble up so the caller returns 500 and Stripe retries.
    throw new Error(`ledger insert failed: ${error.message}`);
  }

  console.log(`[stripe webhook] credited ${tokens} tokens for session ${session.id}`);
}
