import type { ReactNode } from "react";

interface PageShellProps {
  children: ReactNode;
}

/** Consistent width and spacing wrapper with a soft page-enter motion. */
export function PageShell({ children }: PageShellProps) {
  return (
    <main className="mm-page-enter mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl flex-col justify-center px-4 py-16 sm:px-6">
      {children}
    </main>
  );
}
