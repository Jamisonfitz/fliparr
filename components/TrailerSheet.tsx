"use client";

import Sheet from "./Sheet";
import type { DiscoverMovie } from "@/lib/types";

/**
 * Plays the film's trailer without leaving the deck. Radarr already hands us a
 * YouTube id in the Discover payload, so there's no extra lookup.
 */
export default function TrailerSheet({
  movie,
  onClose,
}: {
  movie: DiscoverMovie | null;
  onClose: () => void;
}) {
  return (
    <Sheet
      open={Boolean(movie?.youTubeTrailerId)}
      onClose={onClose}
      title={movie ? `${movie.title} (${movie.year})` : "Trailer"}
    >
      {movie?.youTubeTrailerId && (
        <div className="mb-5 aspect-video w-full overflow-hidden rounded-lg bg-black">
          <iframe
            // Keyed on the id so switching films reloads the player instead of
            // leaving the previous trailer playing.
            key={movie.youTubeTrailerId}
            src={`https://www.youtube-nocookie.com/embed/${movie.youTubeTrailerId}?autoplay=1&rel=0&modestbranding=1`}
            title={`${movie.title} trailer`}
            allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="h-full w-full border-0"
          />
        </div>
      )}
    </Sheet>
  );
}
