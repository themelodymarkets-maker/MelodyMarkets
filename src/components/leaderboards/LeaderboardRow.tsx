import { Num } from "@/components/ui/Num";
import { cn } from "@/lib/utils";
import { RankBadge } from "./RankBadge";
import type { LeaderboardEntry, LeaderboardKind } from "./types";

interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  kind: LeaderboardKind;
  /** Highlights the row (cyan tint + "You" tag) when it's the signed-in user. */
  isCurrentUser?: boolean;
}

/**
 * A single ranked trader. Shared by both boards and by the pinned "you" row.
 * The rank badge, avatar, and stat are all shrink-0; only the username flexes
 * and truncates, so a long name never pushes the rank or the stat off screen.
 */
export function LeaderboardRow({ entry, kind, isCurrentUser = false }: LeaderboardRowProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-4 py-3 sm:gap-4 sm:px-6",
        isCurrentUser ? "bg-accent/5" : "hover:bg-border",
      )}
    >
      <RankBadge rank={entry.rank} />
      <UserAvatar username={entry.username} avatarUrl={entry.avatarUrl} />

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <p className="truncate text-sm font-medium text-foreground" title={entry.username}>
          {entry.username}
        </p>
        {isCurrentUser && (
          <span className="shrink-0 rounded-control bg-accent/15 px-2 py-0.5 display-label text-2xs text-accent">
            You
          </span>
        )}
      </div>

      <RowStat entry={entry} kind={kind} />
    </div>
  );
}

/** The board-specific stat on the right: return % (return board) or value (value board). */
function RowStat({ entry, kind }: { entry: LeaderboardEntry; kind: LeaderboardKind }) {
  if (kind === "return") {
    const direction = entry.returnPercent > 0 ? "up" : entry.returnPercent < 0 ? "down" : "flat";
    return (
      <Num
        value={entry.returnPercent}
        variant="percent"
        className={cn(
          "shrink-0 whitespace-nowrap text-right text-lg",
          direction === "up" && "text-gain",
          direction === "down" && "text-loss",
          direction === "flat" && "text-muted",
        )}
      />
    );
  }

  return (
    <span className="shrink-0 whitespace-nowrap text-right text-lg text-foreground">
      <Num value={entry.totalValue} variant="token" />
      <span className="ml-1.5 text-xs text-muted">tokens</span>
    </span>
  );
}

function UserAvatar({ username, avatarUrl }: { username: string; avatarUrl: string | null }) {
  if (!avatarUrl) {
    return (
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-border text-sm font-bold text-foreground"
        aria-hidden="true"
      >
        {username.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // Avatars come from arbitrary user-provided/CDN hosts, so a plain <img> is
    // used instead of next/image (same rationale as the markets artist art).
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={avatarUrl}
      alt=""
      width={40}
      height={40}
      className="h-10 w-10 shrink-0 rounded-full object-cover"
    />
  );
}
