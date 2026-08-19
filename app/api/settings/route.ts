import { fail } from "@/lib/api";
import { DEFAULT_MOVIE_COLOR, DEFAULT_TV_COLOR } from "@/lib/actions";
import { resolveSettings } from "@/lib/settings";
import { saveSettings } from "@/lib/store";
import type {
  MinimumAvailability,
  MonitorOption,
  MovieSource,
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
const MOVIE_SOURCES: MovieSource[] = ["radarr", "seerr", "both"];

/** A #rrggbb hex colour, else the fallback. Guards against junk reaching a style attribute. */
function hexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : fallback;
}

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
    const movieSource: MovieSource = MOVIE_SOURCES.includes(
      body.movieSource as MovieSource,
    )
      ? (body.movieSource as MovieSource)
      : "radarr";

    // The Radarr fields only drive right-swipes that go to Radarr, so only hold
    // them to account when Radarr is in play — a Seerr-only setup has no profiles.
    if (movieSource === "radarr" || movieSource === "both") {
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
      movieSource,
      tvSeasons: SEASONS.includes(body.tvSeasons as SeasonStrategy)
        ? (body.tvSeasons as SeasonStrategy)
        : "all",
      movieColor: hexColor(body.movieColor, DEFAULT_MOVIE_COLOR),
      tvColor: hexColor(body.tvColor, DEFAULT_TV_COLOR),
    };

    await saveSettings(settings);
    return Response.json(settings);
  } catch (err) {
    return fail(err);
  }
}
