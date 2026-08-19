import { fail } from "@/lib/api";
import { getDeck } from "@/lib/deck";
import type { ContentType } from "@/lib/types";

/**
 * GET /api/deck                    movie deck (per the movie-source setting)
 * GET /api/deck?content=tv         TV only (Seerr)
 * GET /api/deck?content=both       movies and TV blended together
 * GET /api/deck?refresh=1          forces a fresh pull / next page (slow for Radarr)
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const refresh = params.get("refresh") === "1";
  const raw = params.get("content");
  const content: ContentType = raw === "tv" || raw === "both" ? raw : "movie";
  try {
    return Response.json({ movies: await getDeck(refresh, content) });
  } catch (err) {
    return fail(err);
  }
}
