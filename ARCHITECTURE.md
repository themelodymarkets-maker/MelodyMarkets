# Architecture

MelodyMarkets is a [Next.js](https://nextjs.org) App Router project written in TypeScript
and styled with Tailwind CSS. All application code lives under `src/`.

## Folder structure

### `src/app`

Route definitions using the Next.js App Router. Each folder maps to a URL segment, and
`page.tsx` inside a folder is the page rendered at that route (e.g. `src/app/markets/page.tsx`
renders `/markets`). `layout.tsx` at the root defines the shared HTML shell (fonts, global
navigation) that wraps every page, and `globals.css` holds the global stylesheet and design
tokens.

### `src/components/ui`

Small, reusable, presentation-only UI primitives that have no knowledge of routes or business
logic — things like `Button`, `Card`, and other building blocks that any page can compose
together. These should stay generic so they can be reused across unrelated features.

### `src/components/layout`

Structural "shell" components that define the app's chrome: the top navigation bar, the
logo/wordmark, and page wrappers. These components are aware of the site's routes and overall
layout, unlike the generic primitives in `components/ui`.

### `src/lib`

Framework-agnostic utilities, constants, and (in the future) API clients — for example, helper
functions, shared configuration like the navigation link list, and later on things like a
Supabase client or a Last.fm API wrapper. Nothing in here should render UI.

### `src/types`

Shared TypeScript types and interfaces used across multiple files, so features rely on a single
source of truth instead of redefining shapes inline.

## Design system

Colors, fonts, and border radii are defined once as Tailwind theme tokens in
`src/app/globals.css` (via the `@theme` block) rather than hard-coded in components. This keeps
the dark theme, accent gradient, and gain/loss colors consistent as new pages are added.

## Price history & charts

`price_snapshots` is the single, append-only source of truth for every chart in the app (see
its migration in `supabase/migrations`). Rows are written from exactly two places, and nowhere
else:

- `execute_trade` (`source: 'trade'`) — one row per executed trade, at the market's new price.
- `/api/cron/snapshot` (`source: 'cron'`) — one row per active market, every hour.

No code path is allowed to interpolate, backfill, or otherwise fabricate a `price_snapshots`
row. Charts (`src/components/artist/PriceChart.tsx`, the `/markets` sparklines) render exactly
the rows that exist; when an artist has too little history to plot a meaningful line, the UI
says so honestly instead of inventing data. Range fetches beyond ~500 real rows are downsampled
by bucketing time and keeping the *last real row* in each bucket (never averaged or
interpolated) — see `src/lib/price-history.ts`.

## Cron jobs

Scheduled server-side jobs live under `src/app/api/cron/*` and share one auth guard,
`isAuthorizedCronRequest` (`src/lib/cron-auth.ts`): every request must carry
`Authorization: Bearer <CRON_SECRET>`, checked with a constant-time comparison.

Schedules are declared in `vercel.json`. When a `CRON_SECRET` environment variable is set on the
Vercel project, Vercel's own scheduler automatically attaches
`Authorization: Bearer <CRON_SECRET>` to every request it makes to a cron path — the exact same
header format `isAuthorizedCronRequest` already expects — so no separate code path is needed to
accept "Vercel's" auth versus anyone else's; presenting the correct secret is what authenticates
the request, regardless of caller. (Vercel-triggered requests are also identifiable, if ever
useful, by a `vercel-cron/1.0` `User-Agent` and an `x-vercel-cron-schedule` header, but neither
of those is trusted for authentication since they aren't signed and could be forged by any
caller — the bearer secret is the only thing that actually proves the request came from a holder
of `CRON_SECRET`.)

## What's intentionally not here yet

A database (Supabase/Postgres), authentication, price charts, and the core AMM trading logic
have since been layered on top of this original foundation — see `supabase/migrations`,
`src/lib/supabase`, `src/components/artist/PriceChart.tsx`, and
`supabase/migrations/20260708160000_create_execute_trade_function.sql` respectively.
