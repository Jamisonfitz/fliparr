"use client";

import Sheet from "./Sheet";
import { RATING_SOURCES, passesRating } from "@/lib/ratings";
import type { DiscoverMovie, RatingFilter } from "@/lib/types";

const pill =
  "font-data cursor-pointer rounded-full border px-3.5 py-2 text-[0.6rem] tracking-[0.16em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none";
const pillOn = "border-screen bg-screen text-pit";
const pillOff = "border-edge text-muted hover:text-screen";

/**
 * The deck's filters: genre (off by default — multiple selections widen the
 * deck, a movie shows if it matches any) and a minimum rating gate.
 */
export default function GenreSheet({
  open,
  onClose,
  deck,
  selected,
  onChange,
  rating,
  onRatingChange,
}: {
  open: boolean;
  onClose: () => void;
  deck: DiscoverMovie[];
  selected: string[];
  onChange: (genres: string[]) => void;
  rating: RatingFilter;
  onRatingChange: (rating: RatingFilter) => void;
}) {
  const counts = new Map<string, number>();
  for (const movie of deck) {
    for (const genre of movie.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
    }
  }
  const genres = [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || a[0].localeCompare(b[0]),
  );

  function toggle(genre: string) {
    onChange(
      selected.includes(genre)
        ? selected.filter((g) => g !== genre)
        : [...selected, genre],
    );
  }

  function pickSource(source: RatingFilter["source"]) {
    const def = RATING_SOURCES.find((s) => s.key === source);
    // Default a freshly picked source to its middle threshold.
    onRatingChange({ source, min: def?.steps[1] ?? 0 });
  }

  const active = selected.length > 0 || rating.source !== "any";
  const matching = deck.filter(
    (m) =>
      (selected.length === 0 || m.genres.some((g) => selected.includes(g))) &&
      passesRating(m, rating),
  ).length;

  const steps = RATING_SOURCES.find((s) => s.key === rating.source);

  return (
    <Sheet open={open} onClose={onClose} title="Filters">
      <div className="pb-5">
        <p className="font-data mb-3 text-[0.58rem] tracking-[0.22em] text-muted uppercase">
          Minimum rating
        </p>
        <div className="flex flex-wrap gap-2">
          {RATING_SOURCES.map((s) => (
            <button
              key={s.key}
              type="button"
              onClick={() => pickSource(s.key)}
              aria-pressed={rating.source === s.key}
              className={`${pill} ${rating.source === s.key ? pillOn : pillOff}`}
            >
              {s.label}
            </button>
          ))}
        </div>
        {steps && steps.steps.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {steps.steps.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onRatingChange({ source: rating.source, min: n })}
                aria-pressed={rating.min === n}
                className={`${pill} ${rating.min === n ? pillOn : pillOff}`}
              >
                {steps.format(n)}+
              </button>
            ))}
          </div>
        )}
      </div>

      <p className="font-data border-t border-edge pt-5 pb-3 text-[0.58rem] tracking-[0.22em] text-muted uppercase">
        Genre
      </p>
      <div className="flex flex-wrap gap-2 pb-5">
        {genres.map(([genre, count]) => {
          const on = selected.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              onClick={() => toggle(genre)}
              aria-pressed={on}
              className={`font-data cursor-pointer rounded-full border px-3.5 py-2 text-[0.6rem] tracking-[0.16em] uppercase transition-colors focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none ${
                on
                  ? "border-screen bg-screen text-pit"
                  : "border-edge text-muted hover:text-screen"
              }`}
            >
              {genre}
              <span className={on ? "text-pit/60" : "text-muted/60"}>
                {" "}
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between border-t border-edge py-4">
        <span className="font-data text-[0.62rem] tracking-[0.18em] text-muted uppercase tabular-nums">
          {active ? `${matching} of ${deck.length}` : `Showing all ${deck.length}`}
        </span>
        <button
          type="button"
          onClick={() => {
            onChange([]);
            onRatingChange({ source: "any", min: 0 });
          }}
          disabled={!active}
          className="font-data cursor-pointer rounded-full border border-edge px-4 py-2 text-[0.6rem] tracking-[0.18em] text-screen uppercase transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
        >
          Clear
        </button>
      </div>
    </Sheet>
  );
}
