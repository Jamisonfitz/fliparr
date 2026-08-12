import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { getQualityProfiles, getRootFolders } from "./radarr";
import type { Settings, StoreData, SwipeRecord } from "./types";

/**
 * Persistence for settings and swipe history: one JSON file at $DATA_DIR.
 * Small enough that a database would be overkill — a settings object plus a
 * capped history list.
 */

/** Also the depth of the undo stack. */
const HISTORY_LIMIT = 50;

const EMPTY: StoreData = { settings: null, history: [] };

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
 * Settings the user has saved, or sensible defaults pulled live from Radarr
 * (first quality profile, first root folder) so the app works before anyone
 * opens the settings screen.
 */
export async function resolveSettings(): Promise<Settings> {
  const { settings } = await readStore();
  if (settings) return settings;

  const [profiles, roots] = await Promise.all([
    getQualityProfiles(),
    getRootFolders(),
  ]);

  return {
    qualityProfileId: profiles[0]?.id ?? 1,
    rootFolderPath: roots[0]?.path ?? "",
    minimumAvailability: "released",
    monitor: "movieOnly",
    searchOnAdd: true,
  };
}
