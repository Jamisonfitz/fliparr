import { fail } from "@/lib/api";
import { getQualityProfiles, getRootFolders } from "@/lib/radarr";

/** Choices for the settings screen, read live from Radarr. */
export async function GET() {
  try {
    const [qualityProfiles, rootFolders] = await Promise.all([
      getQualityProfiles(),
      getRootFolders(),
    ]);
    // Quality profile resources carry their whole cutoff/items tree; the
    // settings screen only ever shows the name.
    return Response.json({
      qualityProfiles: qualityProfiles.map(({ id, name }) => ({ id, name })),
      rootFolders: rootFolders.map(({ id, path, freeSpace }) => ({
        id,
        path,
        freeSpace,
      })),
    });
  } catch (err) {
    return fail(err);
  }
}
