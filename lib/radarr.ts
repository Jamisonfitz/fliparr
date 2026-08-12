import { getConnection } from "./store";
import type {
  AddedMovie,
  Connection,
  DiscoverMovie,
  Exclusion,
  QualityProfile,
  RootFolder,
  Settings,
} from "./types";

/**
 * All Radarr HTTP lives here. This module is server-only — the API key must
 * never reach the browser.
 */

export class RadarrError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "RadarrError";
  }
}

async function config(override?: Connection) {
  const connection = override ?? (await getConnection());
  if (!connection?.url || !connection.apiKey) {
    throw new RadarrError(
      "Radarr isn't connected yet. Add its address and API key in Settings.",
      503,
    );
  }
  return {
    base: `${connection.url.replace(/\/+$/, "")}/api/v3`,
    apiKey: connection.apiKey,
  };
}

/**
 * Radarr reports validation failures as an array of objects carrying
 * `errorMessage`, but plain strings and `{message}` also show up. Pull out
 * something a toast can display rather than dumping raw JSON at the user.
 */
function readError(body: string, status: number): string {
  // Radarr answers a bad key with a bare 401 and no body worth showing.
  if (status === 401) return "Radarr rejected that API key.";
  if (status === 404 && !body) return "That address isn't a Radarr instance.";

  try {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed)) {
      const messages = parsed
        .map((e) => e?.errorMessage ?? e?.message)
        .filter(Boolean);
      if (messages.length) return messages.join("; ");
    }
    if (parsed?.message) return parsed.message;
  } catch {
    // Not JSON — fall through to the raw body.
  }
  return body.slice(0, 300) || `Radarr returned ${status}`;
}

async function request<T>(
  path: string,
  init: RequestInit & { timeoutMs?: number; connection?: Connection } = {},
): Promise<T> {
  const { timeoutMs = 20_000, connection, ...rest } = init;
  const { base, apiKey } = await config(connection);

  let res: Response;
  try {
    res = await fetch(`${base}${path}`, {
      ...rest,
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
        ...rest.headers,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    // undici wraps the real failure in `TypeError: fetch failed`, so the
    // useful name is on `cause`. Reading only `err.name` reports every
    // timeout as a connection failure and sends you debugging the network.
    const cause = err instanceof Error ? err.cause : undefined;
    const name =
      cause instanceof Error ? cause.name : err instanceof Error ? err.name : "";
    const detail = cause instanceof Error ? ` (${cause.message})` : "";

    throw new RadarrError(
      name === "TimeoutError"
        ? `Radarr did not respond within ${Math.round(timeoutMs / 1000)}s`
        : `Could not reach Radarr at ${base.replace(/\/api\/v3$/, "")}${detail}`,
      504,
    );
  }

  if (!res.ok) {
    throw new RadarrError(readError(await res.text(), res.status), res.status);
  }

  // DELETE returns 200 with an empty body.
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * The Discover list. Recommendations only — trending and popular are
 * deliberately excluded (see the design doc).
 *
 * Slow by design: Radarr's controller makes an uncached bulk TMDb call for all
 * ~100 ids on every request, so this routinely takes 10-60s. Always call it
 * through lib/deck.ts, never straight from a request path.
 */
export function getDiscoverMovies(): Promise<DiscoverMovie[]> {
  return request<DiscoverMovie[]>(
    "/importlist/movie?includeRecommendations=true",
    { timeoutMs: 120_000 },
  );
}

/**
 * Checks credentials without saving them, so the settings screen can tell you
 * whether an address and key work before you commit to them.
 */
export function testConnection(
  connection: Connection,
): Promise<{ instanceName?: string; version: string }> {
  return request<{ instanceName?: string; version: string }>(
    "/system/status",
    { connection, timeoutMs: 10_000 },
  );
}

export function getQualityProfiles(): Promise<QualityProfile[]> {
  return request<QualityProfile[]>("/qualityprofile");
}

export function getRootFolders(): Promise<RootFolder[]> {
  return request<RootFolder[]>("/rootfolder");
}

/**
 * Adds a movie. Uses the single-item endpoint rather than the bulk
 * POST /importlist/movie that Radarr's own Discover page uses: the bulk one
 * runs with ignoreErrors=true and answers 200 + [] when an add is rejected,
 * which would read as success here. This one 400s properly and returns the
 * created movie's id, which undo needs.
 */
export function addMovie(
  movie: { tmdbId: number; title: string; year: number },
  settings: Settings,
): Promise<AddedMovie> {
  return request<AddedMovie>("/movie", {
    method: "POST",
    body: JSON.stringify({
      tmdbId: movie.tmdbId,
      title: movie.title,
      year: movie.year,
      qualityProfileId: settings.qualityProfileId,
      rootFolderPath: settings.rootFolderPath,
      minimumAvailability: settings.minimumAvailability,
      monitored: settings.monitor !== "none",
      addOptions: {
        monitor: settings.monitor,
        searchForMovie: settings.searchOnAdd,
      },
    }),
    timeoutMs: 60_000,
  });
}

/**
 * Reverses an add. `addImportExclusion` MUST stay false — if Radarr defaulted
 * it to true, "undo" would permanently exclude the movie, the opposite of what
 * the user asked for.
 *
 * Note this does not cancel an in-flight grab in the download client.
 */
export function deleteMovie(id: number): Promise<null> {
  return request<null>(
    `/movie/${id}?deleteFiles=false&addImportExclusion=false`,
    { method: "DELETE" },
  );
}

export function addExclusion(movie: {
  tmdbId: number;
  title: string;
  year: number;
}): Promise<Exclusion> {
  return request<Exclusion>("/exclusions", {
    method: "POST",
    body: JSON.stringify({
      tmdbId: movie.tmdbId,
      movieTitle: movie.title,
      movieYear: movie.year,
    }),
  });
}

export function deleteExclusion(id: number): Promise<null> {
  return request<null>(`/exclusions/${id}`, { method: "DELETE" });
}
