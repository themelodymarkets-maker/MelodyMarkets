# Architecture

MelodyMarkets is a [Next.js 15](https://nextjs.org) App Router application in TypeScript, styled with Tailwind CSS v4, backed by Supabase (Postgres + Auth + Realtime), and monetized via Stripe Checkout. All application code lives under `src/`.

## System overview

```
Browser (React client components)
    │
    ├─ Supabase Auth (cookie session, anon key)
    ├─ Supabase Realtime (market price updates)
    │
    ▼
Next.js Server (Server Components, Server Actions, Route Handlers)
    │
    ├─ Supabase (anon key + user JWT) — reads, execute_trade RPC
    ├─ Supabase Admin (service role) — webhooks, cron, seed
    ├─ Stripe API — checkout session creation
    └─ Last.fm API — artist ingestion (cron/seed only)
    │
    ▼
Postgres (Supabase)
    ├─ RLS on all tables; economic writes via SECURITY DEFINER functions
    ├─ execute_trade — atomic AMM trades
    ├─ check_rate_limit — serverless-safe rate limiting
    └─ Portfolio / leaderboard RPCs
```

## Folder structure

### `src/app`

Route definitions using the App Router. Each folder maps to a URL segment; `page.tsx` renders that route. Special files:

| File | Purpose |
|------|---------|
| `layout.tsx` | Root shell: fonts, header, providers, base metadata |
| `loading.tsx` | Suspense fallback skeleton (markets, artist, leaderboards, portfolio, store) |
| `error.tsx` | Route error boundary (`/markets`) |
| `global-error.tsx` | Root error boundary |
| `not-found.tsx` | Branded 404 |
| `icon.tsx` / `opengraph-image.tsx` | Favicon and OG image |

### `src/app/actions`

Server Actions (marked `"use server"`):

- `trade.ts` — `submitTrade` → `executeTrade`
- `checkout.ts` — `createCheckoutSession` → Stripe redirect
- `auth.ts` — `signInWithEmail`, `signUpWithEmail` with per-IP rate limiting

### `src/app/api`

Route Handlers:

| Route | Auth | Purpose |
|-------|------|---------|
| `POST /api/webhooks/stripe` | Stripe signature | Credit token purchases (only place tokens are granted) |
| `GET /api/cron/snapshot` | `CRON_SECRET` | Daily price snapshots + Last.fm refresh |
| `POST /api/admin/seed` | `CRON_SECRET` | Ingest Last.fm top artists (manual trigger) |
| `GET /api/artists/:id/price-history` | Public (RLS) | Chart data for artist pages |

### `src/components`

Feature and UI components. Key areas:

- `ui/` — primitives (`Button`, `Card`, `Input`, `Toast`, `StatusCard`)
- `layout/` — `Header`, `Logo`, `PageShell`
- `artist/`, `markets/`, `portfolio/`, `leaderboards/`, `store/` — feature views

### `src/lib`

Framework-agnostic business logic and server utilities:

| Module | Role |
|--------|------|
| `amm.ts` | Pure constant-product AMM math (`quoteTrade`) |
| `trade.ts` | Server-side `executeTrade` wrapper + error mapping |
| `portfolio.ts`, `leaderboard.ts`, `market.ts` | Display metrics and data helpers |
| `format.ts` | Shared number/date formatting |
| `rate-limit.ts` | Postgres-backed rate limiting (see tradeoff below) |
| `supabase/` | Browser, server, admin, and middleware clients |
| `site-metadata.ts` | Shared SEO / OG metadata helpers |

### `supabase/migrations`

Postgres schema, RLS policies, and `SECURITY DEFINER` functions. The trade engine is `execute_trade`; rate limiting is `check_rate_limit` + `rate_limits` table.

## Authentication

Supabase Auth with cookie-based sessions. Middleware (`src/middleware.ts` → `src/lib/supabase/middleware.ts`) refreshes tokens and protects `/portfolio`.

Sign-in and sign-up run through server actions (`src/app/actions/auth.ts`) with per-IP rate limiting before Supabase validates credentials. Profile rows are created by the `handle_new_user` database trigger on signup.

## Trading flow

```
TradePanel (client)
  → submitTrade (server action)
  → executeTrade (rate limit check)
  → supabase.rpc("execute_trade") as authenticated user
  → Postgres: row lock, AMM swap, ledger/holdings/trades/snapshot writes
```

`quoteTrade` in `amm.ts` is preview-only. The SQL function is the single source of truth for economic writes. Clients pass `minReceive` derived from a quoted output with slippage tolerance.

## Payments

```
StoreView → createCheckoutSession (server action, rate limited)
  → Stripe Checkout redirect
  → User pays
  → POST /api/webhooks/stripe (signature verified on raw body)
  → token_ledger insert (idempotent by session id)
```

Token pack catalog lives in `src/lib/token-packs.ts` (not Stripe Dashboard). Token amounts in webhook metadata are set server-side at checkout creation.

## Rate limiting

Implemented in `src/lib/rate-limit.ts`, backed by the `check_rate_limit` Postgres function.

**Why Postgres, not in-memory or Redis:** Vercel serverless instances do not share memory. Postgres is already in the request path, adds no new infrastructure, and works across all instances. Tradeoff: one extra DB round trip per guarded request — acceptable at this scale; revisit Redis if traffic grows significantly.

| Action | Limit | Bucket |
|--------|-------|--------|
| Trade | 10 / 10s | `trade:<userId>` |
| Checkout | 5 / 60s | `checkout-ip:<ip>`, `checkout-user:<userId>` |
| Auth | 10 / 15 min | `auth-ip:<ip>` |

Fails open if the limiter errors (protective guard, not a correctness gate).

## Price history and charts

`price_snapshots` is append-only. Rows are written from exactly two places:

- `execute_trade` (`source: 'trade'`) — one row per executed trade
- `/api/cron/snapshot` (`source: 'cron'`) — one row per active market, daily

Charts render real rows only; downsampling buckets time and keeps the last real row per bucket (see `src/lib/price-history.ts`).

## Cron jobs

Scheduled jobs live under `src/app/api/cron/*` and share `isAuthorizedCronRequest` (`src/lib/cron-auth.ts`): `Authorization: Bearer <CRON_SECRET>` with constant-time comparison.

Schedules are in `vercel.json`. The snapshot job runs once daily (Vercel Hobby plan constraint). When `CRON_SECRET` is set, Vercel Cron attaches the bearer token automatically.

`/api/admin/seed` is not scheduled — trigger manually for initial artist ingestion.

## Design system

Colors, fonts, and radii are Tailwind theme tokens in `src/app/globals.css` (`@theme` block). Shared formatting lives in `src/lib/format.ts`. Branded error/404 states use `StatusCard`.

## Security model

See `SECURITY_NOTES.md` for the full audit. In short:

- Service role key is server-only (`server-only` import guard)
- All tables have RLS; no client-writable economic paths
- `execute_trade` asserts `p_user_id = auth.uid()`
- Stripe webhook verifies signatures on the raw request body
- Admin/cron routes reject missing or incorrect secrets

## Deployment

- **Hosting:** Vercel (Next.js)
- **Database / Auth:** Supabase
- **Payments:** Stripe (test mode first; see `LAUNCH_CHECKLIST.md` for live-mode switch)
- **Launch steps:** `LAUNCH_CHECKLIST.md`

## Testing

```bash
npm test          # Vitest unit tests (AMM math, portfolio metrics)
npm run build     # Production build
```

DB smoke test: `supabase/tests/execute_trade_smoke_test.sql` (manual, run in Supabase SQL editor).
