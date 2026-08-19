import { getQualityProfiles, getRootFolders } from "./radarr";
import { readStore } from "./store";
import type { Settings } from "./types";

/**
 * Lives here rather than in lib/store so the store stays free of any Radarr
 * import — radarr reads its connection from the store, and a cycle between
 * the two modules would be fragile.
 */
export async function resolveSettings(): Promise<Settings> {
  const { settings } = await readStore();
  // Backfill fields added after the store was first written.
  if (settings) {
    return {
      ...settings,
      source: settings.source ?? "radarr",
      tvSeasons: settings.tvSeasons ?? "all",
    };
  }

  // Nothing saved yet: take Radarr's first profile and root folder so the app
  // works before anyone opens the settings screen. Tolerate Radarr being
  // unreachable so a Seerr-only setup can still load and save settings.
  let qualityProfileId = 1;
  let rootFolderPath = "";
  try {
    const [profiles, roots] = await Promise.all([
      getQualityProfiles(),
      getRootFolders(),
    ]);
    qualityProfileId = profiles[0]?.id ?? 1;
    rootFolderPath = roots[0]?.path ?? "";
  } catch {
    // Radarr not connected yet — defaults above are fine.
  }

  return {
    qualityProfileId,
    rootFolderPath,
    minimumAvailability: "released",
    monitor: "movieOnly",
    searchOnAdd: true,
    source: "radarr",
    tvSeasons: "all",
  };
}
