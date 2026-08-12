"use client";

import Sheet from "./Sheet";
import type { DiscoverMovie } from "@/lib/types";

/**
 * Optional genre filter. Off by default — selecting nothing means everything.
 * Multiple selections widen the deck rather than narrowing it: a movie shows
 * if it matches any selected genre, which is how you'd expect "Horror and
 * Thriller" to behave when you're in the mood for either.
 */
export default function GenreSheet({
  open,
  onClose,
  deck,
  selected,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  deck: DiscoverMovie[];
  selected: string[];
  onChange: (genres: string[]) => void;
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

  const matching = selected.length
    ? deck.filter((m) => m.genres.some((g) => selected.includes(g))).length
    : deck.length;

  return (
    <Sheet open={open} onClose={onClose} title="Filter by genre">
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
          {selected.length === 0
            ? `Showing all ${deck.length}`
            : `${matching} of ${deck.length}`}
        </span>
        <button
          type="button"
          onClick={() => onChange([])}
          disabled={selected.length === 0}
          className="font-data cursor-pointer rounded-full border border-edge px-4 py-2 text-[0.6rem] tracking-[0.18em] text-screen uppercase transition-colors hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-screen/70 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-30"
        >
          Clear
        </button>
      </div>
    </Sheet>
  );
}
