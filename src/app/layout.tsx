import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { Header } from "@/components/layout/Header";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "MelodyMarkets",
  description: "Trade virtual shares of your favorite music artists.",
};

// The root layout renders the session-aware Header on every page. Force
// dynamic rendering (no static HTML caching, no ISR) so Vercel always
// re-runs this layout per request and never serves one visitor's cached
// signed-in/signed-out shell to another visitor.
export const dynamic = "force-dynamic";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased">
        <Header />
        {children}
      </body>
    </html>
  );
}
