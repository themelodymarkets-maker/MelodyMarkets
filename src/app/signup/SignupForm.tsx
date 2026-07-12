"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/layout/PageShell";
import { AuthCard } from "@/components/auth/AuthCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { signUpWithEmail } from "@/app/actions/auth";
import {
  validateEmail,
  validatePassword,
  validateUsername,
} from "@/lib/auth-validation";

type FieldErrors = {
  username?: string;
  email?: string;
  password?: string;
};

export function SignupForm() {
  const router = useRouter();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setNotice(null);

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

    const result = await signUpWithEmail({
      email: email.trim(),
      password,
      username: username.trim(),
    });

    if (!result.ok) {
      setFormError(result.message);
      setIsSubmitting(false);
      return;
    }

    if (result.needsEmailConfirmation) {
      setNotice("Check your email to confirm your account, then sign in.");
      setPassword("");
      setIsSubmitting(false);
      return;
    }

    setUsername("");
    setEmail("");
    setPassword("");
    router.push("/markets");
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

          <Button type="submit" disabled={isSubmitting} className="mt-2 w-full" aria-busy={isSubmitting}>
            {isSubmitting ? "Creating account…" : "Create account"}
          </Button>
        </form>
      </AuthCard>
    </PageShell>
  );
}
