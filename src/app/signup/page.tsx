"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { createClient } from "@/lib/supabase/client";
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth-validation";

/** Per-field validation errors, keyed by field name. */
type FieldErrors = {
  username?: string;
  email?: string;
  password?: string;
};

export default function SignupPage() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  // Error returned by Supabase (for example, email already registered).
  const [formError, setFormError] = useState<string | null>(null);
  // Shown when signup succeeds but email confirmation is required.
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

    // Validate every field up front and collect the results.
    const errors: FieldErrors = {
      username: validateUsername(username) ?? undefined,
      email: validateEmail(email) ?? undefined,
      password: validatePassword(password) ?? undefined,
    };
    setFieldErrors(errors);
    if (errors.username || errors.email || errors.password) {
      return;
    }

    setIsSubmitting(true);
    const supabase = createClient();

    // The `username` in options.data becomes raw_user_meta_data, which the
    // on-signup database trigger reads to create the matching profile row.
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { username: username.trim() },
      },
    });

    if (error) {
      setFormError(error.message);
      setIsSubmitting(false);
      return;
    }

    // When email confirmation is enabled, no session is returned yet.
    if (!data.session) {
      setNotice("Check your email to confirm your account, then sign in.");
      setIsSubmitting(false);
      return;
    }

    // Refresh so server components (like the nav) see the new session.
    router.push("/markets");
    router.refresh();
  }

  return (
    <PageShell>
      <AuthCard
        title="Create your account"
        subtitle="Start trading virtual shares of your favorite artists."
        footer={{
          prompt: "Already have an account?",
          linkLabel: "Sign in",
          href: "/login",
        }}
      >
        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
          <Input
            label="Username"
            name="username"
            type="text"
            autoComplete="username"
            placeholder="melodymaker"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            invalid={Boolean(fieldErrors.username)}
            hint={fieldErrors.username ?? "3-20 characters. Letters, numbers, underscores."}
            disabled={isSubmitting}
          />
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
            autoComplete="new-password"
            placeholder="At least 8 characters"
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
          {notice && (
            <p role="status" className="text-sm text-accent-cyan">
              {notice}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="mt-2 w-full">
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </AuthCard>
    </PageShell>
  );
}
