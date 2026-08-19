import type { DiscoverMovie, RatingFilter } from "./types";

/**
 * Whether a card clears the rating gate. A card with no score from the chosen
 * source fails — if you asked for "IMDb 7+", something IMDb can't rate hasn't
 * met the bar. Pure and client-safe, so both the deck and the filter sheet use it.
 */
export function passesRating(movie: DiscoverMovie, filter: RatingFilter): boolean {
  if (filter.source === "any") return true;
  const value = movie.ratings?.[filter.source]?.value;
  return value != null && value >= filter.min;
}

/** The scales differ, so the picker offers sensible thresholds per source. */
export const RATING_SOURCES: {
  key: RatingFilter["source"];
  label: string;
  steps: number[];
  /** Renders a threshold for a button, e.g. 60 -> "60%". */
  format: (n: number) => string;
}[] = [
  { key: "any", label: "Any", steps: [], format: String },
  { key: "imdb", label: "IMDb", steps: [6, 7, 8], format: (n) => n.toFixed(0) },
  { key: "rottenTomatoes", label: "Rotten Tomatoes", steps: [60, 70, 80], format: (n) => `${n}%` },
  { key: "metacritic", label: "Metacritic", steps: [50, 60, 70], format: String },
  { key: "tmdb", label: "TMDb", steps: [6, 7, 8], format: (n) => n.toFixed(0) },
];
