# Security Notes

Audit date: 2026-07-11. This document summarizes the MelodyMarkets security model and the findings from the launch-readiness pass.

## Summary

No critical vulnerabilities were found. The app follows a defense-in-depth pattern: economic writes are gated by Postgres `SECURITY DEFINER` functions and RLS; privileged server routes require shared secrets or Stripe signatures; rate limiting is best-effort and database-backed for Vercel serverless.

## Service role key isolation

| Check | Status |
|-------|--------|
| `SUPABASE_SERVICE_ROLE_KEY` only referenced in `src/lib/supabase/admin.ts` | Pass |
| `admin.ts` imports `server-only` (build fails if bundled client-side) | Pass |
| Admin client used only in webhook, cron, seed, and auth rate-limit helper | Pass |
| No `NEXT_PUBLIC_*` prefix on service role or Stripe secret | Pass |

## Row Level Security (RLS)

All application tables have RLS enabled. Client-writable economic tables (`token_ledger`, `holdings`, `trades`, `markets`, `price_snapshots`) have **no** INSERT/UPDATE/DELETE policies for `anon` or `authenticated`.

| Table | Client read | Client write |
|-------|-------------|--------------|
| `profiles` | All (authenticated) | Update own row only |
| `artists`, `markets`, `price_snapshots` | Public read (anon + authenticated) | None |
| `token_ledger`, `holdings` | Own rows only | None |
| `trades` | All (authenticated) | None |
| `rate_limits` | None (zero policies) | None (via RPC only) |

Economic mutations flow through:

- `execute_trade` — trades (asserts `p_user_id = auth.uid()`)
- `handle_new_user` trigger — signup bonus (EXECUTE revoked from clients)
- Service role — Stripe webhook credits, cron snapshots, admin seed

## Admin and cron routes

Both `/api/cron/snapshot` and `/api/admin/seed` call `isAuthorizedCronRequest()` which:

- Returns `false` when `CRON_SECRET` is unset
- Requires `Authorization: Bearer <CRON_SECRET>` with constant-time comparison

Vercel Cron attaches the same header automatically when `CRON_SECRET` is set on the project.

## Trade identity assertion

`execute_trade` (see `supabase/migrations/20260708160000_create_execute_trade_function.sql`) raises `FORBIDDEN_USER` when `p_user_id <> auth.uid()`. The server action passes the session user's id from `auth.getUser()`, so callers cannot trade as another account.

## Stripe webhook

| Check | Status |
|-------|--------|
| Raw body read via `request.text()` before JSON parse | Pass |
| Signature verified with `STRIPE_WEBHOOK_SECRET` | Pass |
| Token amount from session metadata (set server-side at checkout creation) | Pass |
| Idempotent credit via unique `(reason, reference_id)` on `token_ledger` | Pass |
| Returns 400 on bad signature, 500 on genuine DB failure (Stripe retries) | Pass |

## Rate limiting

Implemented in `src/lib/rate-limit.ts`, backed by Postgres `check_rate_limit` (see migration `20260712120000_create_rate_limits.sql`).

| Action | Limit | Key |
|--------|-------|-----|
| Trade | 10 / 10s | `trade:<userId>` |
| Checkout | 5 / 60s | `checkout-ip:<ip>`, `checkout-user:<userId>` |
| Sign-in / sign-up | 10 / 15 min | `auth-ip:<ip>` |

**Tradeoff:** Postgres over Redis — no new infra at this scale; fails open if the limiter errors so legitimate users are never blocked by a limiter outage.

## Logging hygiene

Server logs avoid secrets and minimize PII:

- Rate-limit logs use action prefix only (`trade`, `checkout-ip`), never full bucket keys
- Stripe webhook logs session id and token count, not user id (fixed in this pass)
- Checkout errors log message string only, not full error objects

## Residual risks / accepted tradeoffs

1. **Auth brute force:** Supabase Auth has its own rate limits; app adds per-IP throttling on server actions but direct Supabase API calls from a determined attacker are still possible at the Supabase layer — configure Supabase Auth rate limits in the dashboard.
2. **Rate limiter fails open:** By design; abuse protection is best-effort, not a correctness gate.
3. **Cron schedule:** Hobby plan allows one daily cron; hourly snapshots require Pro or an external scheduler.
4. **Last.fm API key:** Server-only; rotate if exposed.

## Files reviewed

- `src/lib/supabase/{client,server,admin,middleware}.ts`
- `src/app/actions/{trade,checkout,auth}.ts`
- `src/app/api/{webhooks/stripe,admin/seed,cron/snapshot}/route.ts`
- `src/lib/{cron-auth,rate-limit,stripe}.ts`
- `supabase/migrations/*` (RLS, `execute_trade`, `check_rate_limit`)
