import { formatCompactNumber } from "@/lib/format";

interface ArtistHeaderProps {
  name: string;
  genre: string | null;
  imageUrl: string | null;
  listeners: number | null;
  playcount: number | null;
}

/** Server Component: the artist's identity block at the top of the detail page's main column. */
export function ArtistHeader({ name, genre, imageUrl, listeners, playcount }: ArtistHeaderProps) {
  return (
    <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
      <ArtistAvatar name={name} imageUrl={imageUrl} />

      <div className="min-w-0">
        <h1 className="truncate text-3xl font-semibold text-foreground">{name}</h1>

        {genre && (
          <span className="mt-2 inline-block rounded-full border border-border px-2.5 py-1 text-[11px] font-medium tracking-wide text-muted uppercase">
            {genre}
          </span>
        )}

        <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="font-semibold text-foreground">{formatCompactNumber(listeners)}</dt>
            <dd className="text-muted">listeners</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="font-semibold text-foreground">{formatCompactNumber(playcount)}</dt>
            <dd className="text-muted">plays</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

function ArtistAvatar({ name, imageUrl }: { name: string; imageUrl: string | null }) {
  if (!imageUrl) {
    return (
      <span
        className="flex h-24 w-24 shrink-0 items-center justify-center rounded-2xl bg-accent-gradient text-3xl font-semibold text-white"
        aria-hidden="true"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // Artist art comes from Last.fm/dicebear CDNs decided at ingestion time
    // (see src/lib/lastfm.ts) -- a plain <img> is used here for the same
    // reason as MarketRow's avatar (see that file for the full rationale).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt=""
      width={96}
      height={96}
      className="h-24 w-24 shrink-0 rounded-2xl object-cover"
    />
  );
}
