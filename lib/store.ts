import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Connection, Settings, StoreData, SwipeRecord } from "./types";

/**
 * Persistence for the Radarr connection, settings, and swipe history: one JSON
 * file at $DATA_DIR. Small enough that a database would be overkill.
 *
 * Deliberately imports nothing from lib/radarr — radarr reads its connection
 * from here, and a cycle between the two would be fragile.
 */

/** Also the depth of the undo stack. */
const HISTORY_LIMIT = 50;

const EMPTY: StoreData = { settings: null, connection: null, history: [] };

function dataDir() {
  return process.env.DATA_DIR || "./data";
}

function filePath() {
  return path.join(dataDir(), "fliparr.json");
}

export async function readStore(): Promise<StoreData> {
  try {
    const raw = await readFile(filePath(), "utf8");
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      settings: parsed.settings ?? null,
      connection: parsed.connection ?? null,
      history: Array.isArray(parsed.history) ? parsed.history : [],
    };
  } catch {
    // Missing or corrupt: fall back to defaults rather than failing to boot.
    return { ...EMPTY };
  }
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
