import { fail } from "@/lib/api";
import { resolveSettings } from "@/lib/settings";
import { saveSettings } from "@/lib/store";
import type {
  DeckSource,
  MinimumAvailability,
  MonitorOption,
  SeasonStrategy,
  Settings,
} from "@/lib/types";

const MONITOR: MonitorOption[] = ["movieOnly", "movieAndCollection", "none"];
const AVAILABILITY: MinimumAvailability[] = [
  "announced",
  "inCinemas",
  "released",
];
const SEASONS: SeasonStrategy[] = ["all", "latest", "first"];

export async function GET() {
  try {
    return Response.json(await resolveSettings());
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as Partial<Settings>;
    const source: DeckSource = body.source === "seerr" ? "seerr" : "radarr";

    // The Radarr fields only drive right-swipes on the Radarr source, so only
    // hold them to account there — a Seerr-only setup has no profiles to pick.
    if (source === "radarr") {
      if (typeof body.qualityProfileId !== "number") {
        return Response.json({ error: "qualityProfileId is required." }, { status: 400 });
      }
      if (!body.rootFolderPath) {
        return Response.json({ error: "rootFolderPath is required." }, { status: 400 });
      }
      if (!MONITOR.includes(body.monitor as MonitorOption)) {
        return Response.json({ error: "Unknown monitor option." }, { status: 400 });
      }
      if (!AVAILABILITY.includes(body.minimumAvailability as MinimumAvailability)) {
        return Response.json({ error: "Unknown minimum availability." }, { status: 400 });
      }
    }

    const settings: Settings = {
      qualityProfileId:
        typeof body.qualityProfileId === "number" ? body.qualityProfileId : 1,
      rootFolderPath: body.rootFolderPath ?? "",
      monitor: MONITOR.includes(body.monitor as MonitorOption)
        ? (body.monitor as MonitorOption)
        : "movieOnly",
      minimumAvailability: AVAILABILITY.includes(
        body.minimumAvailability as MinimumAvailability,
      )
        ? (body.minimumAvailability as MinimumAvailability)
        : "released",
      searchOnAdd: body.searchOnAdd !== false,
      source,
      tvSeasons: SEASONS.includes(body.tvSeasons as SeasonStrategy)
        ? (body.tvSeasons as SeasonStrategy)
        : "all",
    };

    await saveSettings(settings);
    return Response.json(settings);
  } catch (err) {
    return fail(err);
  }
}
