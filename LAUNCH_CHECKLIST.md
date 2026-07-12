# Launch Checklist

Manual steps to take MelodyMarkets from staging to fully live. Work through each section in order.

---

## 1. Environment variables (Vercel)

In the Vercel project → **Settings → Environment Variables**, verify every variable from `.env.example` is set for **Production** (and Preview if you use preview deploys):

| Variable | Scope | Notes |
|----------|-------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | Production, Preview | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Production, Preview | Anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Production only | **Never** expose to Preview if previews are public |
| `LASTFM_API_KEY` | Production | Artist ingestion |
| `STRIPE_SECRET_KEY` | Production | Use **test** key until live-mode switch (section 5) |
| `STRIPE_WEBHOOK_SECRET` | Production | Must match the webhook endpoint signing secret |
| `NEXT_PUBLIC_APP_URL` | Production | e.g. `https://melodymarkets.com` (no trailing slash) |
| `CRON_SECRET` | Production | Long random string; Vercel Cron sends this automatically |

After changes, **redeploy** so functions pick up new values.

---

## 2. Supabase

### Database migrations

Apply all migrations in `supabase/migrations/` to the production project (Supabase CLI `supabase db push` or run SQL in order in the dashboard).

Confirm these exist in production:

- `execute_trade`, `get_portfolio_summary`, leaderboard RPCs
- `check_rate_limit` and `rate_limits` table
- `grant_rate_limit_to_service_role` (auth IP limiting)

### Auth settings

In Supabase → **Authentication → Providers → Email**:

- [ ] **Enable email confirmations** for production (recommended)
- [ ] Set **Site URL** to your production domain (`NEXT_PUBLIC_APP_URL`)
- [ ] Add **Redirect URLs**: production URL, `https://<your-domain>/auth/callback` if using OAuth later

In **Authentication → Rate Limits** (if available on your plan):

- [ ] Review sign-in / sign-up rate limits as a second layer behind app-level IP limiting

### RLS smoke test

- [ ] Confirm anon can read `artists`, `markets`, `price_snapshots`
- [ ] Confirm authenticated users cannot INSERT into `token_ledger`, `holdings`, or `trades` directly (should fail)

---

## 3. Stripe (test mode first)

- [ ] Create a **test mode** webhook pointing to `https://<your-domain>/api/webhooks/stripe`
- [ ] Subscribe to `checkout.session.completed`
- [ ] Copy the signing secret into `STRIPE_WEBHOOK_SECRET`
- [ ] Run a test purchase on `/store` and confirm tokens appear in the ledger

---

## 4. Vercel Cron

- [ ] Confirm `vercel.json` cron path `/api/cron/snapshot` is deployed
- [ ] `CRON_SECRET` is set (Vercel attaches `Authorization: Bearer …` automatically)
- [ ] After first scheduled run, verify new `price_snapshots` rows with `source = 'cron'` in Supabase

### Initial market seed (one-time)

`/api/admin/seed` is **not** in `vercel.json`. Trigger manually after deploy:

```bash
curl -X POST "https://<your-domain>/api/admin/seed" \
  -H "Authorization: Bearer <CRON_SECRET>"
```

- [ ] Confirm artists and markets appear on `/markets`

---

## 5. Stripe live mode (future decision — do not rush)

> **Keep test mode until you are ready to accept real payments.**

When switching to live:

1. Replace `STRIPE_SECRET_KEY` with the **live** secret key in Vercel Production
2. Create a **new live webhook** endpoint (live signing secret differs from test)
3. Update `STRIPE_WEBHOOK_SECRET` to the live webhook signing secret
4. Redeploy
5. Run one small real purchase and verify ledger credit + Stripe Dashboard event

---

## 6. DNS and domain

- [ ] Point custom domain to Vercel
- [ ] Update `NEXT_PUBLIC_APP_URL` to the final HTTPS URL
- [ ] Update Supabase Site URL and redirect URLs to match

---

## 7. Post-launch verification

- [ ] `npm run build` passes in CI / locally against production env
- [ ] Sign up → confirm email (if enabled) → sign in → trade → portfolio updates
- [ ] Buy tokens (test or live) → webhook credits balance
- [ ] `/leaderboards` loads for signed-out users
- [ ] `/portfolio` redirects unauthenticated users to `/login`
- [ ] Open Graph preview looks correct (share a link in Slack/iMessage)
- [ ] Spot-check all pages at **375px** width (mobile)

---

## 8. Weekly ops routine

Do this once a week (≈15 minutes):

### Cron health

- [ ] Supabase → `price_snapshots`: confirm rows with `source = 'cron'` from the last 7 days
- [ ] Vercel → Project → **Cron Jobs**: check last run status for `/api/cron/snapshot`

### Stripe

- [ ] Stripe Dashboard → **Events**: skim recent `checkout.session.completed` events; confirm no repeated failures
- [ ] Check for webhook delivery errors (Developers → Webhooks → endpoint → recent deliveries)

### Supabase logs

- [ ] Supabase → **Logs** → API / Postgres: glance for unusual error spikes or auth failures

### Optional

- [ ] Re-run `/api/admin/seed` if you want fresh Last.fm top artists (creates new markets only; never rewrites existing reserves)

---

## Quick reference

| Endpoint | Auth | Purpose |
|----------|------|---------|
| `POST /api/webhooks/stripe` | Stripe signature | Credit token purchases |
| `GET /api/cron/snapshot` | `CRON_SECRET` | Daily price snapshots + Last.fm refresh |
| `POST /api/admin/seed` | `CRON_SECRET` | Ingest top artists (manual) |
| `submitTrade` (server action) | Session | Execute trades |
| `createCheckoutSession` (server action) | Session | Start Stripe checkout |
| `signInWithEmail` / `signUpWithEmail` | Per-IP rate limit | Auth with throttling |

See also: `SECURITY_NOTES.md`, `ARCHITECTURE.md`.
