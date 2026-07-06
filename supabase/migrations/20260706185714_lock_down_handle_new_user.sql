-- Harden the signup trigger function.
--
-- Because handle_new_user() lives in the public schema, PostgREST exposes it as
-- a callable RPC endpoint (/rest/v1/rpc/handle_new_user) by default. It is only
-- ever meant to run as an auth.users insert trigger, so we revoke EXECUTE from
-- every client-facing role. The trigger continues to fire normally, since
-- triggers run with the table owner's privileges regardless of these grants.
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.handle_new_user() from anon;
revoke execute on function public.handle_new_user() from authenticated;
