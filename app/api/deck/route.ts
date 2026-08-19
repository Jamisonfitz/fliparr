import { fail } from "@/lib/api";
import { getDeck } from "@/lib/deck";

/**
 * GET /api/deck                   cached movie deck
 * GET /api/deck?type=tv           the TV deck (Seerr only)
 * GET /api/deck?refresh=1         forces a fresh pull / next page (slow for Radarr)
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const refresh = params.get("refresh") === "1";
  const mediaType = params.get("type") === "tv" ? "tv" : "movie";
  try {
    return Response.json({ movies: await getDeck(refresh, mediaType) });
  } catch (err) {
    return fail(err);
  }
}
