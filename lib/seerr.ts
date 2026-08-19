import { getSeerrConnection } from "./store";
import type {
  Connection,
  DiscoverMovie,
  MediaType,
  SeasonStrategy,
} from "./types";

/**
 * All Overseerr / Jellyseerr HTTP lives here. Server-only — the API key must
 * never reach the browser. Kept separate from lib/radarr on purpose: the two
 * services share nothing but the DiscoverMovie shape the deck renders.
 *
 * Why Seerr is the "endless" source: Radarr's recommendations are a finite
 * library-derived top ~100, so you swipe them dry. Seerr's /discover/movies is
 * TMDb's popular feed, hundreds of pages deep — the deck refills forever.
 */

export class SeerrError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "SeerrError";
  }
}

async function config(override?: Connection) {
  const connection = override ?? (await getSeerrConnection());
  if (!connection?.url || !connection.apiKey) {
    throw new SeerrError(
      "Overseerr/Jellyseerr isn't connected yet. Add its address and API key in Settings.",
      503,
    );
  }
  return {
    base: `${connection.url.replace(/\/+$/, "")}/api/v1`,
    apiKey: connection.apiKey,
  };
}

function readError(body: string, status: number): string {
  if (status === 401 || status === 403) return "Seerr rejected that API key.";
  if (status === 404 && !body) return "That address isn't a Seerr instance.";
  try {
    const parsed = JSON.parse(body);
    if (parsed?.message) return parsed.message;
  } catch {
    // Not JSON — fall through.
  }
  return body.slice(0, 300) || `Seerr returned ${status}`;
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
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json", ...rest.headers },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const cause = err instanceof Error ? err.cause : undefined;
    const name =
      cause instanceof Error ? cause.name : err instanceof Error ? err.name : "";
    throw new SeerrError(
      name === "TimeoutError"
        ? `Seerr did not respond within ${Math.round(timeoutMs / 1000)}s`
        : `Could not reach Seerr at ${base.replace(/\/api\/v1$/, "")}`,
      504,
    );
  }

  if (!res.ok) throw new SeerrError(readError(await res.text(), res.status), res.status);
  const text = await res.text();
  return (text ? JSON.parse(text) : null) as T;
}

/**
 * Shape of a Seerr discover result. Movies carry title/releaseDate, TV shows
 * name/firstAirDate; only the fields we map are typed.
 */
interface SeerrResult {
  id: number;
  mediaType?: string;
  title?: string;
  name?: string;
  overview?: string;
  releaseDate?: string;
  firstAirDate?: string;
  genreIds?: number[];
  posterPath?: string;
  backdropPath?: string;
  voteAverage?: number;
  voteCount?: number;
  popularity?: number;
  mediaInfo?: { status?: number };
}

const IMG = "https://image.tmdb.org/t/p";

/**
 * TMDb genre-id → name, one cache per media type (movie and TV genre ids differ).
 * Seerr's discover only carries ids, so we resolve names once.
 */
const genreMaps: Partial<Record<MediaType, Map<number, string>>> = {};
async function genreNames(mediaType: MediaType): Promise<Map<number, string>> {
  const cached = genreMaps[mediaType];
  if (cached) return cached;
  const list = await request<{ id: number; name: string }[]>(
    `/genres/${mediaType}`,
  );
  const map = new Map(list.map((g) => [g.id, g.name]));
  genreMaps[mediaType] = map;
  return map;
}

function toDiscover(
  r: SeerrResult,
  genres: Map<number, string>,
  mediaType: MediaType,
): DiscoverMovie {
  const title = (mediaType === "tv" ? r.name : r.title) ?? "Untitled";
  const date = mediaType === "tv" ? r.firstAirDate : r.releaseDate;
  // mediaInfo appears only once a title is requested/available — treat those as
  // "existing" so the deck filter drops them, same as Radarr's own library.
  const requested = typeof r.mediaInfo?.status === "number" && r.mediaInfo.status >= 2;

  return {
    source: "seerr",
    mediaType,
    title,
    sortTitle: title.toLowerCase(),
    year: date ? Number(date.slice(0, 4)) || 0 : 0,
    overview: r.overview,
    runtime: 0,
    genres: (r.genreIds ?? [])
      .map((id) => genres.get(id))
      .filter((g): g is string => Boolean(g)),
    images: r.backdropPath
      ? [{ coverType: "fanart", remoteUrl: `${IMG}/w780${r.backdropPath}` }]
      : [],
    remotePoster: r.posterPath ? `${IMG}/w500${r.posterPath}` : undefined,
    tmdbId: r.id,
    ratings: r.voteAverage
      ? { tmdb: { value: r.voteAverage, votes: r.voteCount ?? 0, type: "user" } }
      : undefined,
    popularity: r.popularity,
    isExisting: requested,
    isExcluded: false,
    isRecommendation: true,
    isTrending: false,
    isPopular: false,
    lists: [],
  };
}

/** One page of Seerr's movie or TV discover feed, mapped to the deck's card shape. */
export async function getSeerrDiscover(
  page: number,
  mediaType: MediaType,
): Promise<DiscoverMovie[]> {
  const genres = await genreNames(mediaType);
  const path = mediaType === "tv" ? "tv" : "movies";
  const data = await request<{ results?: SeerrResult[] }>(
    `/discover/${path}?page=${page}`,
  );
  return (data.results ?? [])
    .filter((r) => !r.mediaType || r.mediaType === mediaType)
    .map((r) => toDiscover(r, genres, mediaType));
}

interface SeerrSeason {
  seasonNumber: number;
  episodeCount?: number;
  airDate?: string | null;
}

/**
 * Resolves the strategy to what Seerr's request body wants: "all" or a season
 * list. Only fetched when a specific season is needed — "all" skips this call.
 *
 * Prefers seasons that have actually aired. TMDb lists announced-but-unaired
 * seasons — typically one placeholder episode with a future airDate — that
 * Sonarr/TVDB doesn't carry yet, so a naive "latest" (max season number) points
 * at a phantom season and Sonarr monitors nothing. We pick the latest/first
 * *aired* season instead, falling back to raw season numbers, then to "all".
 */
async function resolveSeasons(
  tmdbId: number,
  strategy: SeasonStrategy,
): Promise<"all" | number[]> {
  if (strategy === "all") return "all";

  const show = await request<{ seasons?: SeerrSeason[] }>(`/tv/${tmdbId}`);
  const real = (show.seasons ?? []).filter((s) => s.seasonNumber > 0);

  const today = new Date().toISOString().slice(0, 10);
  const aired = real.filter(
    (s) => s.airDate && s.airDate <= today && (s.episodeCount ?? 0) > 0,
  );

  const nums = (aired.length ? aired : real)
    .map((s) => s.seasonNumber)
    .sort((a, b) => a - b);
  if (nums.length === 0) return "all";
  return strategy === "first" ? [nums[0]] : [nums[nums.length - 1]];
}

/**
 * Right swipe. Files a request; returns the request id undo deletes against.
 * Movies request straight; TV resolves the season strategy first, then Seerr
 * routes it to Sonarr under Seerr's own default profile/root.
 */
export async function requestSeerr(
  tmdbId: number,
  mediaType: MediaType,
  tvSeasons: SeasonStrategy = "all",
): Promise<{ id: number }> {
  const body =
    mediaType === "tv"
      ? { mediaType: "tv", mediaId: tmdbId, seasons: await resolveSeasons(tmdbId, tvSeasons) }
      : { mediaType: "movie", mediaId: tmdbId };
  return request<{ id: number }>("/request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

/** Undo of a right swipe: cancels the request Seerr created. */
export function deleteSeerrRequest(id: number): Promise<null> {
  return request<null>(`/request/${id}`, { method: "DELETE" });
}

/** The Test button. Verifies an address and key without saving them. */
export async function testSeerr(
  connection: Connection,
): Promise<{ instanceName: string; version: string }> {
  const status = await request<{ version: string }>("/status", {
    connection,
    timeoutMs: 10_000,
  });
  return { instanceName: "Seerr", version: status.version };
}
