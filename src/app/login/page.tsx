import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to your MelodyMarkets account to trade artist shares.",
};

export default function LoginPage() {
  return <LoginForm />;
}
