import { Card } from "@/components/ui/Card";

interface ComingSoonCardProps {
  title: string;
  description: string;
}

/** Placeholder content shown on pages that have not been built out yet. */
export function ComingSoonCard({ title, description }: ComingSoonCardProps) {
  return (
    <Card className="mx-auto max-w-lg text-center">
      <span className="text-accent-gradient text-xs font-semibold tracking-widest uppercase">
        Coming soon
      </span>
      <h1 className="mt-3 text-2xl font-semibold text-foreground">{title}</h1>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </Card>
  );
}
