import { Card } from "@/components/ui/Card";

interface MarketsEmptyStateProps {
  title: string;
  description: string;
}

/** Shared empty-state panel: reused for "no markets listed yet" and "no search results". */
export function MarketsEmptyState({ title, description }: MarketsEmptyStateProps) {
  return (
    <Card className="mx-auto max-w-md text-center">
      <h2 className="display-label text-sm text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
    </Card>
  );
}
