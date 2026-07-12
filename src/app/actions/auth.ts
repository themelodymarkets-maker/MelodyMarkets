"use server";

import { createClient } from "@/lib/supabase/server";

export type AuthActionResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; message: string };

/**
 * Server-side sign-in with per-IP rate limiting. Runs before Supabase auth so
 * brute-force attempts are throttled even though credentials are checked by
 * Supabase directly (see src/lib/rate-limit.ts for the in-database strategy).
 */
export async function signInWithEmail(input: {
  email: string;
  password: string;
}): Promise<AuthActionResult> {
  const { checkRateLimitAdmin, getClientIp, AUTH_IP_RATE_LIMIT } = await import(
    "@/lib/rate-limit"
  );
  const ip = await getClientIp();
  const allowed = await checkRateLimitAdmin(`auth-ip:${ip}`, AUTH_IP_RATE_LIMIT);
  if (!allowed) {
    return {
      ok: false,
      message: "Too many sign-in attempts. Please wait a few minutes and try again.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: input.email.trim(),
    password: input.password,
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  return { ok: true };
}

/**
 * Server-side sign-up with the same per-IP throttle as sign-in. Profile
 * creation still happens via the database trigger on auth.users insert.
 */
export async function signUpWithEmail(input: {
  email: string;
  password: string;
  username: string;
}): Promise<AuthActionResult> {
  const { checkRateLimitAdmin, getClientIp, AUTH_IP_RATE_LIMIT } = await import(
    "@/lib/rate-limit"
  );
  const ip = await getClientIp();
  const allowed = await checkRateLimitAdmin(`auth-ip:${ip}`, AUTH_IP_RATE_LIMIT);
  if (!allowed) {
    return {
      ok: false,
      message: "Too many sign-up attempts. Please wait a few minutes and try again.",
    };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: input.email.trim(),
    password: input.password,
    options: {
      data: { username: input.username.trim() },
    },
  });

  if (error) {
    return { ok: false, message: error.message };
  }

  if (!data.session) {
    return { ok: true, needsEmailConfirmation: true };
  }

  return { ok: true };
}
