import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { Header } from "@/components/layout/Header";
import { AppProviders } from "@/components/providers/AppProviders";
import { baseMetadata } from "@/lib/site-metadata";
import "./globals.css";

export const metadata: Metadata = baseMetadata();

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
    <html lang="en" className={GeistSans.variable}>
      <body className="font-body antialiased">
        <AppProviders>
          <Header />
          {children}
        </AppProviders>
      </body>
    </html>
  );
}
