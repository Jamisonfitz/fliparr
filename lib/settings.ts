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
  if (settings) return settings;

  // Nothing saved yet: take Radarr's first profile and root folder so the app
  // works before anyone opens the settings screen.
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
