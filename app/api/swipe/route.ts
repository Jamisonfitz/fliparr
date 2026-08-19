import { fail } from "@/lib/api";
import { findMovie, markSwiped } from "@/lib/deck";
import { addExclusion, addMovie } from "@/lib/radarr";
import { requestSeerr } from "@/lib/seerr";
import { resolveSettings } from "@/lib/settings";
import { addHidden, recordSwipe } from "@/lib/store";
import type { MediaType, SwipeDirection } from "@/lib/types";

/**
 * POST /api/swipe  { tmdbId, direction, mediaType }
 *
 * The write is routed by the card's own source/type, not a global setting, so a
 * deck can mix sources:
 *   radarr movie: right -> add to Radarr; left -> add an import list exclusion.
 *   seerr movie/tv: right -> file a Seerr request; left -> a plain skip (Seerr has
 *                   no exclusion list), reversible from history without any write.
 *
 * Nothing is marked swiped or written to history unless the write was accepted,
 * so a failed swipe puts the card back rather than silently losing it.
 */
export async function POST(request: Request) {
  try {
    const { tmdbId, direction, mediaType: rawType } = (await request.json()) as {
      tmdbId?: number;
      direction?: SwipeDirection;
      mediaType?: MediaType;
    };
    const mediaType: MediaType = rawType === "tv" ? "tv" : "movie";

    if (typeof tmdbId !== "number" || (direction !== "left" && direction !== "right")) {
      return Response.json({ error: "tmdbId and direction are required." }, { status: 400 });
    }

    // Read title/year and origin from our own cache rather than trusting the client.
    const movie = await findMovie(tmdbId, mediaType);
    if (!movie) {
      return Response.json({ error: "That title is no longer in the deck." }, { status: 404 });
    }

    let radarrId: number;
    if (movie.source === "seerr") {
      // Left is a skip — nothing to write, so it can't fail; record it so undo
      // can still bring the card back.
      if (direction === "right") {
        const { tvSeasons } = await resolveSettings();
        radarrId = (await requestSeerr(tmdbId, mediaType, tvSeasons)).id;
      } else {
        radarrId = 0;
      }
    } else {
      radarrId =
        direction === "right"
          ? (await addMovie(movie, await resolveSettings())).id
          : (await addExclusion(movie)).id;
    }

    const at = new Date().toISOString();
    markSwiped(tmdbId, mediaType);
    await recordSwipe({
      tmdbId,
      title: movie.title,
      year: movie.year,
      direction,
      radarrId,
      source: movie.source,
      mediaType,
      at,
    });

    // A left swipe is a "don't show again": a Seerr skip (radarrId 0) or a Radarr
    // exclusion Fliparr made. Persist it so it survives a restart and can be reset.
    if (direction === "left") {
      await addHidden({
        tmdbId,
        mediaType,
        source: movie.source,
        radarrId,
        title: movie.title,
        year: movie.year,
        at,
      });
    }

    return Response.json({ ok: true, radarrId });
  } catch (err) {
    return fail(err);
  }
}
