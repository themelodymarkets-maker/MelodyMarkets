import "server-only";

import { timingSafeEqual } from "node:crypto";

/**
 * Shared guard for every cron-triggered route (`/api/admin/seed`,
 * `/api/cron/snapshot`, ...): requires `Authorization: Bearer <CRON_SECRET>`.
 *
 * This is also exactly the header Vercel Cron sends: when a `CRON_SECRET`
 * environment variable is configured on the project, Vercel automatically
 * attaches `Authorization: Bearer <CRON_SECRET>` to every request it makes to
 * a scheduled route (see `vercel.json` and the note in ARCHITECTURE.md), so a
 * single check here authenticates both Vercel's own scheduler and any manual
 * / third-party trigger that presents the same secret.
 */
export function isAuthorizedCronRequest(request: Request): boolean {
  const expectedSecret = process.env.CRON_SECRET;
  if (!expectedSecret) return false;

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return false;

  const provided = Buffer.from(token);
  const expected = Buffer.from(expectedSecret);
  // timingSafeEqual throws if lengths differ, so compare lengths first.
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(provided, expected);
}
