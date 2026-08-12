import { fail } from "@/lib/api";
import { findMovie, markSwiped } from "@/lib/deck";
import { addExclusion, addMovie } from "@/lib/radarr";
import { recordSwipe, resolveSettings } from "@/lib/store";
import type { SwipeDirection } from "@/lib/types";

/**
 * POST /api/swipe  { tmdbId, direction }
 *
 * right -> add to Radarr (monitored, optionally searched)
 * left  -> add to Radarr's import list exclusions
 *
 * Nothing is marked swiped or written to history unless Radarr accepted the
 * write, so a failed swipe puts the card back rather than silently losing it.
 */
export async function POST(request: Request) {
  try {
    const { tmdbId, direction } = (await request.json()) as {
      tmdbId?: number;
      direction?: SwipeDirection;
    };

    if (typeof tmdbId !== "number" || (direction !== "left" && direction !== "right")) {
      return Response.json({ error: "tmdbId and direction are required." }, { status: 400 });
    }

    // Read title/year from our own cache rather than trusting the client.
    const movie = await findMovie(tmdbId);
    if (!movie) {
      return Response.json({ error: "That movie is no longer in the deck." }, { status: 404 });
    }

    const radarrId =
      direction === "right"
        ? (await addMovie(movie, await resolveSettings())).id
        : (await addExclusion(movie)).id;

    markSwiped(tmdbId);
    await recordSwipe({
      tmdbId,
      title: movie.title,
      year: movie.year,
      direction,
      radarrId,
      at: new Date().toISOString(),
    });

    return Response.json({ ok: true, radarrId });
  } catch (err) {
    return fail(err);
  }
}
