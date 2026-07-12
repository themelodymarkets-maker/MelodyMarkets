import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "Create account",
  description: "Join MelodyMarkets and start trading virtual shares of music artists.",
};

export default function SignupPage() {
  return <SignupForm />;
}
