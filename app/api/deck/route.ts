import { fail } from "@/lib/api";
import { getDeck } from "@/lib/deck";

/**
 * GET /api/deck          cached deck
 * GET /api/deck?refresh=1 forces a fresh pull from Radarr (slow: 10-60s)
 */
export async function GET(request: Request) {
  const refresh = new URL(request.url).searchParams.get("refresh") === "1";
  try {
    return Response.json({ movies: await getDeck(refresh) });
  } catch (err) {
    return fail(err);
  }
}
