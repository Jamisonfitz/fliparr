import type { Ratings } from "@/lib/types";

/**
 * Each source keeps its own colour so the row can be read at a glance rather
 * than parsed. Radarr omits sources it has no data for and reports `votes: 0`
 * with a real value for Metacritic and Rotten Tomatoes, so presence of a value
 * is the only reliable test.
 */

/** Metacritic bands its own scores green / yellow / red at 61 and 40. */
function metacriticColor(score: number) {
  if (score >= 61) return "#00ce7a";
  if (score >= 40) return "#ffbd3f";
  return "#ff6874";
}

function Chip({
  source,
  value,
  color,
}: {
  source: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span
        className="font-data text-[0.6rem] font-600 tracking-[0.18em] uppercase"
        style={{ color }}
      >
        {source}
      </span>
      <span className="font-data text-sm font-500 text-screen tabular-nums">
        {value}
      </span>
    </div>
  );
}

export default function RatingRow({ ratings }: { ratings?: Ratings }) {
  const imdb = ratings?.imdb?.value;
  const rt = ratings?.rottenTomatoes?.value;
  const mc = ratings?.metacritic?.value;

  if (imdb == null && rt == null && mc == null) {
    return (
      <p className="font-data text-[0.65rem] tracking-[0.14em] text-muted uppercase">
        Unrated
      </p>
    );
  }

  return (
    <div className="flex flex-wrap items-baseline gap-x-5 gap-y-1">
      {imdb != null && (
        <Chip source="IMDb" value={imdb.toFixed(1)} color="var(--color-imdb)" />
      )}
      {rt != null && (
        <Chip
          source="Tomatometer"
          value={`${Math.round(rt)}%`}
          // Fresh keeps the tomato; rotten drops to the neutral chrome colour.
          color={rt >= 60 ? "var(--color-tomato)" : "var(--color-muted)"}
        />
      )}
      {mc != null && (
        <Chip
          source="Metacritic"
          value={String(Math.round(mc))}
          color={metacriticColor(mc)}
        />
      )}
    </div>
  );
}
