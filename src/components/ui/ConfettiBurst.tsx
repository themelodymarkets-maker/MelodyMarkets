"use client";

import { useEffect, useState, type CSSProperties } from "react";

interface ConfettiBurstProps {
  /**
   * Increment this to fire a new burst. Each distinct value renders one burst
   * of pieces that clean themselves up when the animation ends.
   */
  fireKey: number;
}

// Sleek celebration palette: cyan, gold, gain green, white (never loss red).
const PIECE_COLORS = ["var(--accent)", "var(--token)", "var(--gain)", "var(--foreground)"];
const PIECE_COUNT = 32;

interface Piece {
  id: number;
  style: CSSProperties;
}

/**
 * Lightweight, canvas-free confetti. When `fireKey` changes it spawns a burst
 * of neon pieces that fall and fade via `mm-confetti-piece`, then unmount.
 * Purely decorative and `aria-hidden`.
 */
export function ConfettiBurst({ fireKey }: ConfettiBurstProps) {
  const [pieces, setPieces] = useState<Piece[]>([]);

  useEffect(() => {
    if (fireKey === 0) return;

    const spawned: Piece[] = Array.from({ length: PIECE_COUNT }, (_, i) => {
      const xDrift = Math.round((Math.random() - 0.5) * 280);
      const rotation = Math.round(180 + Math.random() * 720);
      const size = 8 + Math.round(Math.random() * 6);
      return {
        id: fireKey * 1000 + i,
        style: {
          left: `${Math.round(Math.random() * 100)}%`,
          width: size,
          height: size,
          backgroundColor: PIECE_COLORS[i % PIECE_COLORS.length],
          boxShadow: `0 0 8px ${PIECE_COLORS[i % PIECE_COLORS.length]}`,
          animationDelay: `${Math.round(Math.random() * 140)}ms`,
          ["--mm-confetti-x" as string]: `${xDrift}px`,
          ["--mm-confetti-r" as string]: `${rotation}deg`,
        },
      };
    });

    setPieces(spawned);
    const timer = setTimeout(() => setPieces([]), 1300);
    return () => clearTimeout(timer);
  }, [fireKey]);

  if (pieces.length === 0) return null;

  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-0 overflow-visible" aria-hidden="true">
      {pieces.map((piece) => (
        <span key={piece.id} className="mm-confetti-piece" style={piece.style} />
      ))}
    </div>
  );
}
