import { fail } from "@/lib/api";
import { findMovie, invalidate, unmarkSwiped } from "@/lib/deck";
import { deleteExclusion, deleteMovie } from "@/lib/radarr";
import { readStore, removeSwipe } from "@/lib/store";

/**
 * POST /api/undo            reverses the most recent swipe
 * POST /api/undo {tmdbId}   reverses that specific swipe, however long ago
 *
 * Returns the movie so the deck can put the card back, plus a warning when
 * undoing an add that may already be downloading.
 */
export async function POST(request: Request) {
  try {
    // The deck's undo button sends no body at all.
    const body = (await request.json().catch(() => ({}))) as {
      tmdbId?: number;
    };

    const { history } = await readStore();
    const entry =
      typeof body.tmdbId === "number"
        ? history.find((h) => h.tmdbId === body.tmdbId)
        : history[0];

    if (!entry) {
      return Response.json({ error: "Nothing to undo." }, { status: 400 });
    }

    if (entry.direction === "right") {
      await deleteMovie(entry.radarrId);
    } else {
      await deleteExclusion(entry.radarrId);
    }

    // All three are required: the history entry drives undo, the swiped set
    // drives deck filtering, and the cache predates the write. Leaving any of
    // them behind keeps the card invisible.
    await removeSwipe(entry.tmdbId);
    unmarkSwiped(entry.tmdbId);

    // Look the movie up before dropping the cache — if it's still in the
    // cached payload we can hand it straight back for an instant restore.
    const movie = await findMovie(entry.tmdbId);
    invalidate();

    return Response.json({
      movie,
      undone: entry,
      warning:
        entry.direction === "right"
          ? "Removed from Radarr. A download already grabbed keeps going."
          : undefined,
    });
  } catch (err) {
    return fail(err);
  }
}
