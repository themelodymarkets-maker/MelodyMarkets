import "server-only";

import { headers } from "next/headers";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

/**
 * Application-level rate limiting, backed by the `check_rate_limit` Postgres
 * function (see supabase/migrations/20260712120000_create_rate_limits.sql for
 * the full rationale on why the limiter lives in the database rather than in
 * process memory or an external store).
 *
 * Everything here is BEST-EFFORT and FAILS OPEN: if the limiter errors (e.g.
 * the migration hasn't been applied yet, or the DB is briefly unreachable) we
 * allow the request rather than block a legitimate user. Rate limiting is a
 * protective guard against abuse, not a correctness gate: the real economic
 * invariants are enforced by `execute_trade` and Stripe signature checks.
 */

export interface RateLimitRule {
  /** Maximum number of allowed hits within the window. */
  max: number;
  /** Rolling fixed window length, in seconds. */
  windowSeconds: number;
}

/** Trade submissions: at most 10 per rolling 10 seconds, per user. */
export const TRADE_RATE_LIMIT: RateLimitRule = { max: 10, windowSeconds: 10 };

/** Checkout session creation: at most 5 per minute, per IP. */
export const CHECKOUT_IP_RATE_LIMIT: RateLimitRule = { max: 5, windowSeconds: 60 };

/** Checkout session creation: at most 5 per minute, per user. */
export const CHECKOUT_USER_RATE_LIMIT: RateLimitRule = { max: 5, windowSeconds: 60 };

/** Auth-adjacent actions (sign-in / sign-up): at most 10 per 15 minutes, per IP. */
export const AUTH_IP_RATE_LIMIT: RateLimitRule = { max: 10, windowSeconds: 900 };

/**
 * Records a hit against `bucket` and returns whether the caller is still under
 * the limit. The bucket key is `"<action>:<subject>"`, e.g. `trade:<userId>`
 * or `checkout-ip:<ip>`, never a secret.
 *
 * @returns `true` if the request is allowed, `false` if it should be blocked.
 */
export async function checkRateLimit(
  supabase: SupabaseClient<Database>,
  bucket: string,
  rule: RateLimitRule,
): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc("check_rate_limit", {
      p_key: bucket,
      p_max: rule.max,
      p_window_seconds: rule.windowSeconds,
    });

    if (error) {
      // Log only the action prefix, never the full key (which may contain a
      // user id or IP). Fail open so a limiter hiccup never blocks trading.
      console.error(`[rate-limit] check failed for "${bucketAction(bucket)}":`, error.message);
      return true;
    }

    return data === true;
  } catch (error) {
    console.error(`[rate-limit] unexpected error for "${bucketAction(bucket)}":`, error);
    return true;
  }
}

/**
 * Best-effort client IP for per-IP limiting, read from the proxy headers Vercel
 * sets. Falls back to a shared "unknown" bucket when no header is present
 * (e.g. local dev), which simply means those callers share one limit.
 */
export async function getClientIp(): Promise<string> {
  const headerList = await headers();
  const forwardedFor = headerList.get("x-forwarded-for");
  if (forwardedFor) {
    // May be a comma-separated list; the first entry is the originating client.
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }
  return headerList.get("x-real-ip") ?? "unknown";
}

/** The `<action>` portion of a bucket key, safe to log. */
function bucketAction(bucket: string): string {
  return bucket.split(":")[0] ?? "unknown";
}

/**
 * Rate-limit check via the service-role client. Used for auth-adjacent server
 * actions where no user session exists yet, so the authenticated-only RPC
 * grant on `check_rate_limit` is unavailable.
 */
export async function checkRateLimitAdmin(
  bucket: string,
  rule: RateLimitRule,
): Promise<boolean> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  return checkRateLimit(admin, bucket, rule);
}
