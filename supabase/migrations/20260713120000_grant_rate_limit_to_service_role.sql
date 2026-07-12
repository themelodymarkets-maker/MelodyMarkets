-- Allow the service-role client (used by auth-adjacent server actions before a
-- session exists) to call check_rate_limit for per-IP throttling on sign-in
-- and sign-up. Authenticated callers still use the existing grant.
grant execute on function
  public.check_rate_limit(text, integer, integer) to service_role;
