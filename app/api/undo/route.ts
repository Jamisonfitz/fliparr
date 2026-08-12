import { fail } from "@/lib/api";
import { findMovie, unmarkSwiped } from "@/lib/deck";
import { deleteExclusion, deleteMovie } from "@/lib/radarr";
import { readStore, removeSwipe } from "@/lib/store";

/**
 * POST /api/undo — reverses the most recent swipe.
 *
 * Returns the movie so the client can drop the card back on top of the deck,
 * plus a warning when undoing an add that may already be downloading.
 */
export async function POST() {
  try {
    const { history } = await readStore();
    const last = history[0];
    if (!last) {
      return Response.json({ error: "Nothing to undo." }, { status: 400 });
    }

    if (last.direction === "right") {
      await deleteMovie(last.radarrId);
    } else {
      await deleteExclusion(last.radarrId);
    }

    // Both are required: the history entry drives undo, the swiped set drives
    // deck filtering. Leaving either behind keeps the card invisible.
    await removeSwipe(last.tmdbId);
    unmarkSwiped(last.tmdbId);

    return Response.json({
      movie: await findMovie(last.tmdbId),
      undone: last,
      warning:
        last.direction === "right"
          ? "Removed from Radarr. A download already grabbed keeps going."
          : undefined,
    });
  } catch (err) {
    return fail(err);
  }
}
