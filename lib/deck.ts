import { getDiscoverMovies } from "./radarr";
import type { DiscoverMovie } from "./types";

/**
 * The swipe deck: Radarr's Discover list, cached and filtered.
 *
 * Caching is load-bearing rather than an optimization. Radarr's
 * ImportListMoviesController does an uncached bulk TMDb lookup for all ~100
 * recommendation ids on every request, so the upstream call can take a minute.
 */

const TTL_MS = 15 * 60 * 1000;

let cache: { items: DiscoverMovie[]; fetchedAt: number } | null = null;

/** Dedupes concurrent callers onto one upstream request. */
let inflight: Promise<DiscoverMovie[]> | null = null;

/**
 * Movies swiped since the cache was filled. Radarr's recommendation query
 * already subtracts the library and the exclusion list, so this only bridges
 * the window where our cached copy is stale about our own writes. It is
 * intentionally not persisted — after a restart the next fetch reflects the
 * writes upstream anyway.
 */
const swiped = new Set<number>();

export function markSwiped(tmdbId: number) {
  swiped.add(tmdbId);
}

/** Undo has to clear this, or the restored card stays hidden until the TTL expires. */
export function unmarkSwiped(tmdbId: number) {
  swiped.delete(tmdbId);
}

/**
 * Drops the cached list so the next read comes from Radarr.
 *
 * Undo needs this. Radarr's recommendation query subtracts the exclusion list
 * at the SQL level, so a movie excluded before the last fetch was never in the
 * cached payload — clearing the swiped set alone can't bring it back. Only a
 * fresh pull can.
 */
export function invalidate() {
  cache = null;
}

async function load(): Promise<DiscoverMovie[]> {
  inflight ??= getDiscoverMovies()
    .then((items) => {
      cache = { items, fetchedAt: Date.now() };
      // A fresh pull reflects everything we wrote, so the bridge set can go.
      swiped.clear();
      return items;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

/**
 * Cards to swipe, in Radarr's own order — already ranked by how many movies in
 * the library recommend each one, so the best candidates come first.
 *
 * `force` busts the cache. Worth doing as the deck thins: every swipe removes a
 * movie from Radarr's candidate pool, which promotes a new one into the top 100.
 */
export async function getDeck(force = false): Promise<DiscoverMovie[]> {
  const stale = !cache || Date.now() - cache.fetchedAt > TTL_MS;
  const items = force || stale ? await load() : cache!.items;

  return items.filter(
    (m) =>
      m.isRecommendation &&
      !m.isExisting &&
      !m.isExcluded &&
      !swiped.has(m.tmdbId),
  );
}

/** Looks a movie up in the cached deck so callers don't have to trust client input. */
export async function findMovie(
  tmdbId: number,
): Promise<DiscoverMovie | undefined> {
  const items = cache?.items ?? (await load());
  return items.find((m) => m.tmdbId === tmdbId);
}
