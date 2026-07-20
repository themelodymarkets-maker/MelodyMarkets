"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signInWithEmail } from "@/app/actions/auth";
import { validateEmail } from "@/lib/auth-validation";

type FieldErrors = {
  email?: string;
  password?: string;
};

export function LoginForm() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const errors: FieldErrors = {
      email: validateEmail(email) ?? undefined,
      password: password.length === 0 ? "Enter your password." : undefined,
    };
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      return;
    }

    setIsSubmitting(true);

    const result = await signInWithEmail({
      email: email.trim(),
      password,
    });

    if (!result.ok) {
      setFormError(result.message);
      setIsSubmitting(false);
      return;
    }

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
            <p role="alert" className="text-sm text-foreground">
              {formError}
            </p>
          )}

          <Button type="submit" disabled={isSubmitting} className="mt-2 w-full" aria-busy={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </AuthCard>
    </PageShell>
  );
}
