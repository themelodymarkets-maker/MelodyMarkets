"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import { validateEmail } from "@/lib/auth-validation";

type FieldErrors = {
  email?: string;
  password?: string;
};

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Error returned by Supabase (for example, invalid credentials).
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    // Only shape-check here; the real credential check happens at Supabase.
    const errors: FieldErrors = {
      email: validateEmail(email) ?? undefined,
      password: password.length === 0 ? "Enter your password." : undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setFormError(error.message);
      setIsSubmitting(false);
      return;
    }

    // Success: clear the form so no stale credentials linger in the DOM,
    // then navigate immediately. We deliberately call only `router.push`
    // here — the session-aware header updates itself instantly from the
    // `onAuthStateChange` event (see HeaderNav), so it no longer needs a
    // paired `router.refresh()` to reflect the new session. Firing both
    // calls back-to-back used to race Next.js's router (the refresh's
    // fetch could contend with the navigation's own fetch), which was
    // exactly what produced the "stuck until you switch tabs" symptom —
    // a stalled router transition that only unstuck itself when a window
    // focus event nudged Next.js to revalidate.
    setEmail("");
    setPassword("");
    router.push("/markets");
  }

  return (
    <PageShell>
      <AuthCard
        title="Welcome back"
        subtitle="Sign in to pick up where you left off."
        footer={{
          prompt: "New to MelodyMarkets?",
          linkLabel: "Create an account",
          href: "/signup",
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            invalid={Boolean(fieldErrors.email)}
            hint={fieldErrors.email}
            disabled={isSubmitting}
          />
          <Input
            label="Password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            invalid={Boolean(fieldErrors.password)}
            hint={fieldErrors.password}
            disabled={isSubmitting}
          />

          {formError && (
            <p role="alert" className="text-sm text-loss">
              {formError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </AuthCard>
    </PageShell>
  );
}
