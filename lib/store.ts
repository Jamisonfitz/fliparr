import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type {
  Connection,
  DeckSource,
  HiddenItem,
  MediaType,
  Settings,
  StoreData,
  SwipeRecord,
} from "./types";

/**
 * Persistence for the Radarr connection, settings, and swipe history: one JSON
 * file at $DATA_DIR. Small enough that a database would be overkill.
 *
 * Deliberately imports nothing from lib/radarr — radarr reads its connection
 * from here, and a cycle between the two would be fragile.
 */

/** Also the depth of the undo stack. */
const HISTORY_LIMIT = 50;

const EMPTY: StoreData = {
  settings: null,
  connection: null,
  seerr: null,
  history: [],
  hidden: [],
};

const hiddenKey = (mediaType: MediaType, tmdbId: number) =>
  `${mediaType}:${tmdbId}`;

function dataDir() {
  return process.env.DATA_DIR || "./data";
}

function filePath() {
  return path.join(dataDir(), "fliparr.json");
}

/**
 * In-memory copy of the store. All writes go through this module and refresh it,
 * so reads (including the hidden-list filter on every deck fetch) don't re-parse
 * the JSON each time — the hidden list is unbounded and would otherwise grow into
 * a per-fetch cost. Only stale if the file is edited out from under a running
 * process, which Fliparr never does.
 */
let cachedStore: StoreData | null = null;

export async function readStore(): Promise<StoreData> {
  if (cachedStore) return cachedStore;
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    cachedStore = {
      settings: parsed.settings ?? null,
      connection: parsed.connection ?? null,
      seerr: parsed.seerr ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
      hidden: Array.isArray(parsed.hidden) ? parsed.hidden : [],
    };
  } catch {
    // Missing or corrupt: fall back to defaults rather than failing to boot.
    cachedStore = { ...EMPTY };
  }
  return cachedStore;
}

/**
 * Serializes writes. Swipes can land close together and a read-modify-write
 * race would silently drop history entries that undo depends on.
 */
let queue: Promise<unknown> = Promise.resolve();

function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => {});
  return run;
}

async function write(data: StoreData): Promise<void> {
  const dir = dataDir();
  await mkdir(dir, { recursive: true });
  // Write-then-rename so a crash mid-write can't leave a truncated file.
  const tmp = path.join(dir, `.fliparr.${process.pid}.tmp`);
  await writeFile(tmp, JSON.stringify(data, null, 2), "utf8");
  await rename(tmp, filePath());
  cachedStore = data; // keep the in-memory copy in sync with disk
}

export function updateStore(
  mutate: (data: StoreData) => StoreData,
): Promise<StoreData> {
  return withLock(async () => {
    const next = mutate(await readStore());
    await write(next);
    return next;
  });
}

export function saveSettings(settings: Settings): Promise<StoreData> {
  return updateStore((data) => ({ ...data, settings }));
}

export function saveConnection(connection: Connection): Promise<StoreData> {
  return updateStore((data) => ({ ...data, connection }));
}

export function saveSeerrConnection(seerr: Connection): Promise<StoreData> {
  return updateStore((data) => ({ ...data, seerr }));
}

/**
 * The saved connection, or whatever the environment provides. Env acts as the
 * seed for a fresh container; once saved in the app, the stored value wins so
 * changing it doesn't need a redeploy.
 */
export async function getConnection(): Promise<Connection | null> {
  const { connection } = await readStore();
  if (connection?.url && connection.apiKey) return connection;

  const url = process.env.RADARR_URL;
  const apiKey = process.env.RADARR_API_KEY;
  return url && apiKey ? { url, apiKey } : null;
}

/** The Seerr connection, or whatever SEERR_URL / SEERR_API_KEY seed on a fresh container. */
export async function getSeerrConnection(): Promise<Connection | null> {
  const { seerr } = await readStore();
  if (seerr?.url && seerr.apiKey) return seerr;

  const url = process.env.SEERR_URL;
  const apiKey = process.env.SEERR_API_KEY;
  return url && apiKey ? { url, apiKey } : null;
}

/** Which feed the deck reads. Defaults to Radarr; read straight from the store to stay off Radarr's slow path. */
export async function getSource(): Promise<DeckSource> {
  const { settings } = await readStore();
  return settings?.source === "seerr" ? "seerr" : "radarr";
}

export function recordSwipe(record: SwipeRecord): Promise<StoreData> {
  return updateStore((data) => ({
    ...data,
    history: [record, ...data.history].slice(0, HISTORY_LIMIT),
  }));
}

export function removeSwipe(tmdbId: number): Promise<StoreData> {
  return updateStore((data) => ({
    ...data,
    history: data.history.filter((h) => h.tmdbId !== tmdbId),
  }));
}

/**
 * Fliparr's own persistent "don't show again" list. Radarr's exclusion list
 * covers its source; this is what keeps a Seerr skip from reappearing next
 * session (and records Radarr exclusions Fliparr made, so a reset can undo just
 * those rather than the user's entire exclusion history).
 */
export function addHidden(item: HiddenItem): Promise<StoreData> {
  return updateStore((data) => {
    const k = hiddenKey(item.mediaType, item.tmdbId);
    if (data.hidden.some((h) => hiddenKey(h.mediaType, h.tmdbId) === k)) {
      return data; // already hidden — don't duplicate
    }
    return { ...data, hidden: [item, ...data.hidden] };
  });
}

export function removeHidden(
  tmdbId: number,
  mediaType: MediaType,
): Promise<StoreData> {
  const k = hiddenKey(mediaType, tmdbId);
  return updateStore((data) => ({
    ...data,
    hidden: data.hidden.filter((h) => hiddenKey(h.mediaType, h.tmdbId) !== k),
  }));
}

/** Clears the hidden entries for one source (a reset). Returns the removed ones. */
export async function clearHidden(source: DeckSource): Promise<HiddenItem[]> {
  let removed: HiddenItem[] = [];
  await updateStore((data) => {
    removed = data.hidden.filter((h) => h.source === source);
    return { ...data, hidden: data.hidden.filter((h) => h.source !== source) };
  });
  return removed;
}

export async function getHidden(): Promise<HiddenItem[]> {
  return (await readStore()).hidden;
}

/**
 * The "mediaType:tmdbId" keys the deck filters against. With no source, returns
 * everything Fliparr has hidden — so a title you rejected on one source stays
 * gone on the other (a Radarr exclusion won't resurface in the Seerr deck).
 */
export async function getHiddenKeys(source?: DeckSource): Promise<Set<string>> {
  const { hidden } = await readStore();
  const items = source ? hidden.filter((h) => h.source === source) : hidden;
  return new Set(items.map((h) => hiddenKey(h.mediaType, h.tmdbId)));
}
