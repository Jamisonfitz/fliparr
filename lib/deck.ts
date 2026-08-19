import { getDiscoverMovies } from "./radarr";
import { getSeerrDiscover } from "./seerr";
import { getHiddenKeys, getSource } from "./store";
import type { DiscoverMovie, MediaType } from "./types";

/**
 * The swipe deck. Three feeds behind one interface:
 *   - radarr movies: Discover recommendations, a finite top ~100, cached and
 *     replaced on refresh (the upstream call is slow — see below).
 *   - seerr movies / seerr TV: TMDb's discover feeds, paginated and accumulated,
 *     effectively endless. TV has no Radarr equivalent, so it's Seerr-only.
 *
 * Radarr caching is load-bearing rather than an optimization: Radarr's
 * ImportListMoviesController does an uncached bulk TMDb lookup for all ~100
 * recommendation ids on every request, so the upstream call can take a minute.
 */

const TTL_MS = 15 * 60 * 1000;

// --- radarr movies: replace-on-refresh cache ---
let cache: { items: DiscoverMovie[]; fetchedAt: number } | null = null;
/** Dedupes concurrent callers onto one upstream request. */
let inflight: Promise<DiscoverMovie[]> | null = null;

// --- seerr: paginated accumulation, one lane per media type ---
type SeerrLane = {
  items: DiscoverMovie[];
  page: number;
  inflight: Promise<DiscoverMovie[]> | null;
};
const seerr: Record<MediaType, SeerrLane> = {
  movie: { items: [], page: 0, inflight: null },
  tv: { items: [], page: 0, inflight: null },
};

/**
 * Every card we've ever handed out, keyed by "mediaType:tmdbId" (TMDb movie and
 * TV ids share a numeric namespace, so the type has to be part of the key).
 * Never evicted for the life of the process. This is what fixes "That movie is
 * no longer in the deck": a swipe reads the card from here, so a card that has
 * since left the current view — Radarr promoted it out on a refill, or it was on
 * an earlier Seerr page — is still swipeable instead of 404ing.
 */
const byId = new Map<string, DiscoverMovie>();
const key = (mediaType: MediaType, tmdbId: number) => `${mediaType}:${tmdbId}`;
function remember(items: DiscoverMovie[]): DiscoverMovie[] {
  for (const m of items) byId.set(key(m.mediaType, m.tmdbId), m);
  return items;
}

/**
 * Cards swiped since the source was last (re)loaded, keyed like byId. For Radarr
 * this bridges the window where our cached copy is stale about our own writes;
 * for Seerr it hides swiped cards from the accumulated feed. Not persisted.
 */
const swiped = new Set<string>();

export function markSwiped(tmdbId: number, mediaType: MediaType = "movie") {
  swiped.add(key(mediaType, tmdbId));
}

/** Undo has to clear this, or the restored card stays hidden until a reload. */
export function unmarkSwiped(tmdbId: number, mediaType: MediaType = "movie") {
  swiped.delete(key(mediaType, tmdbId));
}

/**
 * Drops the Radarr cache so the next read comes from Radarr. Undo needs it:
 * Radarr's recommendation query subtracts the exclusion list at the SQL level,
 * so a movie excluded before the last fetch was never in the cached payload —
 * only a fresh pull can bring it back.
 */
export function invalidate() {
  cache = null;
}

/** A Seerr connection change makes the accumulated feeds stale — start over. */
export function resetSeerr() {
  seerr.movie = { items: [], page: 0, inflight: null };
  seerr.tv = { items: [], page: 0, inflight: null };
}

async function loadRadarr(): Promise<DiscoverMovie[]> {
  inflight ??= getDiscoverMovies()
    .then((raw) => {
      // Tag every card so a swipe can route by the card itself, not a global lookup.
      const items = raw.map(
        (m): DiscoverMovie => ({ ...m, source: "radarr", mediaType: "movie" }),
      );
      cache = { items, fetchedAt: Date.now() };
      // A fresh pull reflects everything we wrote, so drop this type's bridge set.
      for (const k of swiped) if (k.startsWith("movie:")) swiped.delete(k);
      return remember(items);
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

async function getRadarrDeck(force: boolean): Promise<DiscoverMovie[]> {
  const stale = !cache || Date.now() - cache.fetchedAt > TTL_MS;
  const items = force || stale ? await loadRadarr() : cache!.items;

  return items.filter(
    (m) =>
      m.isRecommendation &&
      !m.isExisting &&
      !m.isExcluded &&
      !swiped.has(key("movie", m.tmdbId)),
  );
}

/** Pulls the next page for a media type and appends only titles not already held. */
async function loadSeerrPage(mediaType: MediaType): Promise<DiscoverMovie[]> {
  const lane = seerr[mediaType];
  lane.inflight ??= (async () => {
    const page = lane.page + 1;
    const items = await getSeerrDiscover(page, mediaType);
    lane.page = page;
    const known = new Set(lane.items.map((m) => m.tmdbId));
    lane.items = [...lane.items, ...items.filter((m) => !known.has(m.tmdbId))];
    return remember(lane.items);
  })().finally(() => {
    lane.inflight = null;
  });
  return lane.inflight;
}

/** Pages pulled in one refill before giving up, so a run of fully-filtered pages can't spin. */
const REFILL_PAGE_CAP = 5;
/** How many fresh, showable cards a refill tries to add. */
const REFILL_BATCH = 10;

async function getSeerrDeck(
  force: boolean,
  mediaType: MediaType,
): Promise<DiscoverMovie[]> {
  const lane = seerr[mediaType];
  // Seerr has no exclusion list, so our own persistent hidden set (across all
  // sources — a Radarr exclusion shouldn't resurface here either) is what keeps
  // a skipped or excluded card from coming back next session.
  const hidden = await getHiddenKeys();
  const showable = () =>
    lane.items.filter(
      (m) =>
        !m.isExisting &&
        !swiped.has(key(mediaType, m.tmdbId)) &&
        !hidden.has(key(mediaType, m.tmdbId)),
    );

  if (lane.items.length === 0) await loadSeerrPage(mediaType);

  // force ("refresh") means the deck is thinning — pull pages until we've added a
  // batch of genuinely showable cards, so a page that's entirely filtered out
  // (existing/skipped/hidden) doesn't leave the deck stuck.
  if (force) {
    const target = showable().length + REFILL_BATCH;
    for (let i = 0; i < REFILL_PAGE_CAP && showable().length < target; i++) {
      const before = lane.items.length;
      await loadSeerrPage(mediaType);
      if (lane.items.length === before) break; // no new items upstream — stop
    }
  }

  return showable();
}

/** Drops all in-memory deck state so a reset's un-hidden titles resurface now, not next restart. */
export function resetDeckState() {
  swiped.clear();
  cache = null;
  resetSeerr();
}

/**
 * Cards to swipe. `force` busts the cache / advances a page — worth doing as the
 * deck thins: for Radarr every swipe frees a slot in its top 100, and for Seerr
 * it pulls the next discover page. TV is always Seerr; movies follow the
 * configured source.
 */
export async function getDeck(
  force = false,
  mediaType: MediaType = "movie",
): Promise<DiscoverMovie[]> {
  if (mediaType === "tv") return getSeerrDeck(force, "tv");
  const source = await getSource();
  return source === "seerr" ? getSeerrDeck(force, "movie") : getRadarrDeck(force);
}

/**
 * Looks a card up so swipe callers don't have to trust client input. Reads the
 * never-evicted index first, so a card still on screen resolves even after it
 * has left the current source view. Only falls back to a load on a cold process.
 */
export async function findMovie(
  tmdbId: number,
  mediaType: MediaType = "movie",
): Promise<DiscoverMovie | undefined> {
  const known = byId.get(key(mediaType, tmdbId));
  if (known) return known;
  await getDeck(false, mediaType).catch(() => {});
  return byId.get(key(mediaType, tmdbId));
}
