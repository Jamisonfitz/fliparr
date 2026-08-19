import { RadarrError } from "./radarr";
import { SeerrError } from "./seerr";

/**
 * Turns a thrown error into a JSON response the UI can put straight into a
 * toast. The service's own message is far more useful than a generic 500.
 */
export function fail(err: unknown): Response {
  if (err instanceof RadarrError || err instanceof SeerrError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
