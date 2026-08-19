import { fail } from "@/lib/api";
import { findMovie, invalidate, unmarkSwiped } from "@/lib/deck";
import { deleteExclusion, deleteMovie } from "@/lib/radarr";
import { deleteSeerrRequest } from "@/lib/seerr";
import { readStore, removeHidden, removeSwipe } from "@/lib/store";

/**
 * POST /api/undo               reverses the most recent swipe on the given tab
 * POST /api/undo {mediaType}   most recent swipe of that media type (deck button)
 * POST /api/undo {tmdbId}      that specific swipe, however long ago (history screen)
 *
 * Returns the movie so the deck can put the card back, plus a warning when
 * undoing an add that may already be downloading. Scoping by mediaType keeps the
 * deck's undo tied to the tab you're on, so it can't reverse the other tab's
 * last action out from under you.
 */
export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      tmdbId?: number;
      mediaType?: "movie" | "tv";
    };

    const { history } = await readStore();
    const entry =
      typeof body.tmdbId === "number"
        ? history.find((h) => h.tmdbId === body.tmdbId)
        : body.mediaType
          ? history.find((h) => (h.mediaType ?? "movie") === body.mediaType)
          : history[0];

    if (!entry) {
      return Response.json({ error: "Nothing to undo." }, { status: 400 });
    }

    if (entry.source === "seerr") {
      // A seerr right filed a request; a seerr left was a plain skip with no
      // write, so there's nothing to reverse but the local hide.
      if (entry.direction === "right" && entry.radarrId) {
        await deleteSeerrRequest(entry.radarrId);
      }
    } else if (entry.direction === "right") {
      await deleteMovie(entry.radarrId);
    } else {
      await deleteExclusion(entry.radarrId);
    }

    // All three are required: the history entry drives undo, the swiped set
    // drives deck filtering, and the cache predates the write. Leaving any of
    // them behind keeps the card invisible.
    const mediaType = entry.mediaType ?? "movie";
    await removeSwipe(entry.tmdbId);
    unmarkSwiped(entry.tmdbId, mediaType);
    // A left swipe added a hidden entry; undoing it must clear that too, or the
    // card stays out of the deck.
    await removeHidden(entry.tmdbId, mediaType);

    // Look the card up before dropping the cache — if it's still in the
    // cached payload we can hand it straight back for an instant restore.
    const movie = await findMovie(entry.tmdbId, mediaType);
    invalidate();

    return Response.json({
      movie,
      undone: entry,
      warning:
        entry.direction === "right"
          ? entry.source === "seerr"
            ? "Request cancelled in Seerr."
            : "Removed from Radarr. A download already grabbed keeps going."
          : undefined,
    });
  } catch (err) {
    return fail(err);
  }
}
