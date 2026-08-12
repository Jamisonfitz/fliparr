import { fail } from "@/lib/api";
import { resolveSettings, saveSettings } from "@/lib/store";
import type { MinimumAvailability, MonitorOption, Settings } from "@/lib/types";

const MONITOR: MonitorOption[] = ["movieOnly", "movieAndCollection", "none"];
const AVAILABILITY: MinimumAvailability[] = [
  "announced",
  "inCinemas",
  "released",
];

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

    // Bad settings break every later add, so reject them here rather than
    // letting Radarr 400 on each swipe.
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

    const settings: Settings = {
      qualityProfileId: body.qualityProfileId,
      rootFolderPath: body.rootFolderPath,
      monitor: body.monitor as MonitorOption,
      minimumAvailability: body.minimumAvailability as MinimumAvailability,
      searchOnAdd: body.searchOnAdd !== false,
    };

    await saveSettings(settings);
    return Response.json(settings);
  } catch (err) {
    return fail(err);
  }
}
