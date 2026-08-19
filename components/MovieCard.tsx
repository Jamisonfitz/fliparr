"use client";

import { useState } from "react";
import RatingRow from "./RatingRow";
import type { DiscoverMovie } from "@/lib/types";

/**
 * A single card: poster up top, everything you need to decide underneath.
 *
 * Posters are plain <img> rather than next/image on purpose — they come from
 * TMDb's CDN already sized, and routing them through the optimizer would put
 * sharp in the container and proxy every image through the Unraid box.
 */

function runtimeLabel(minutes: number) {
  if (!minutes) return null;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? `${h}h ${m}m` : `${m}m`;
}

export default function MovieCard({
  movie,
  accent,
  onPlayTrailer,
}: {
  movie: DiscoverMovie;
  /** Per-type accent colour (hex) for the Movie/TV badge — tells the two apart at a glance. */
  accent?: string;
  /** Only the top card gets this; the card behind is inert. */
  onPlayTrailer?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const facts = [
    String(movie.year),
    runtimeLabel(movie.runtime),
    movie.certification,
  ].filter(Boolean);

  return (
    <article className="card-surface flex h-full flex-col gap-5 overflow-hidden rounded-2xl border border-edge bg-surface p-5 shadow-[0_24px_60px_-12px_rgba(0,0,0,0.9)]">
      <div className="relative flex min-h-0 flex-1 items-center justify-center">
        {/* Media-type badge, coloured so Movies and TV read apart at a glance —
            especially in the blended "Both" deck. The 8-digit hex appends alpha
            to the #rrggbb accent for the translucent fill and border. */}
        {accent && (
          <span
            className="font-data absolute top-0 left-0 z-10 rounded-full border px-2.5 py-1 text-[0.5rem] font-600 tracking-[0.22em] uppercase backdrop-blur-sm"
            style={{
              color: accent,
              borderColor: `${accent}80`,
              backgroundColor: `${accent}1f`,
            }}
          >
            {movie.mediaType === "tv" ? "TV" : "Movie"}
          </span>
        )}

        {movie.remotePoster ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={movie.remotePoster}
            alt={`Poster for ${movie.title}`}
            draggable={false}
            className="max-h-full max-w-full rounded-lg object-contain shadow-[0_12px_32px_rgba(0,0,0,0.7)] ring-1 ring-white/10"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-lg border border-dashed border-edge">
            <span className="font-data text-[0.65rem] tracking-[0.2em] text-muted uppercase">
              No poster
            </span>
          </div>
        )}

        {onPlayTrailer && movie.youTubeTrailerId && (
          <button
            type="button"
            // The card is a drag surface: only fire when the pointer didn't
            // travel, and keep the press from starting a drag at all.
            onPointerDownCapture={(e) => e.stopPropagation()}
            onClick={onPlayTrailer}
            aria-label={`Play ${movie.title} trailer`}
            className="absolute right-3 bottom-3 flex cursor-pointer items-center gap-2 rounded-full border border-white/25 bg-black/70 px-3.5 py-2 backdrop-blur transition-colors hover:bg-black/85 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none"
          >
            <svg viewBox="0 0 24 24" className="size-3.5 text-screen" fill="currentColor">
              <path d="M8 5.5v13l11-6.5z" />
            </svg>
            <span className="font-data text-[0.58rem] tracking-[0.2em] text-screen uppercase">
              Trailer
            </span>
          </button>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-3">
        <h2 className="font-display text-[1.6rem] leading-[1.05] tracking-[-0.02em] text-balance uppercase">
          {movie.title}
        </h2>

        {/* One line, always — a long studio name shouldn't push the card around. */}
        <p className="font-data truncate text-[0.68rem] tracking-[0.16em] text-muted uppercase">
          {facts.join("  ·  ")}
          {movie.studio ? `  ·  ${movie.studio}` : ""}
        </p>

        <RatingRow ratings={movie.ratings} />

        {movie.genres.length > 0 && (
          <p className="font-data text-[0.62rem] tracking-[0.2em] text-muted/80 uppercase">
            {movie.genres.slice(0, 3).join("  /  ")}
          </p>
        )}

        {movie.overview && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-screen/60 focus-visible:outline-none"
            aria-expanded={expanded}
          >
            {/* No `block` here: it and line-clamp both set `display`, and
                whichever lands later in the sheet wins — the clamp loses. */}
            <span
              className={`font-body text-[0.94rem] leading-relaxed text-screen/75 ${
                expanded ? "block" : "line-clamp-3"
              }`}
            >
              {movie.overview}
            </span>
            <span className="font-data mt-1 inline-block text-[0.6rem] tracking-[0.18em] text-muted uppercase">
              {expanded ? "Less" : "More"}
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
