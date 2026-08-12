import { RadarrError } from "./radarr";

/**
 * Turns a thrown error into a JSON response the UI can put straight into a
 * toast. Radarr's own message is far more useful than a generic 500.
 */
export function fail(err: unknown): Response {
  if (err instanceof RadarrError) {
    return Response.json({ error: err.message }, { status: err.status });
  }
  console.error(err);
  return Response.json({ error: "Something went wrong." }, { status: 500 });
}
