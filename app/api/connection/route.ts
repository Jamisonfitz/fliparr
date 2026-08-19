import { fail } from "@/lib/api";
import { invalidate, resetSeerr } from "@/lib/deck";
import {
  getConnection,
  getSeerrConnection,
  saveConnection,
  saveSeerrConnection,
} from "@/lib/store";

/**
 * Where Radarr — or, with ?type=seerr, Overseerr/Jellyseerr — lives.
 *
 * The API key is never sent back to the browser — only whether one is set.
 * Saving with a blank key keeps the stored one, so you can change the address
 * without retyping the key.
 */
function isSeerr(request: Request) {
  return new URL(request.url).searchParams.get("type") === "seerr";
}

export async function GET(request: Request) {
  try {
    const seerr = isSeerr(request);
    const connection = seerr ? await getSeerrConnection() : await getConnection();
    return Response.json({
      url: connection?.url ?? "",
      apiKeySet: Boolean(connection?.apiKey),
    });
  } catch (err) {
    return fail(err);
  }
}

export async function PUT(request: Request) {
  try {
    const seerr = isSeerr(request);
    const label = seerr ? "Seerr" : "Radarr";
    const { url, apiKey } = (await request.json()) as {
      url?: string;
      apiKey?: string;
    };

    if (!url?.trim()) {
      return Response.json({ error: `${label}'s address is required.` }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(url.trim())) {
      return Response.json(
        { error: "Include http:// or https:// in the address." },
        { status: 400 },
      );
    }

    const existing = seerr ? await getSeerrConnection() : await getConnection();
    const key = apiKey?.trim() || existing?.apiKey;
    if (!key) {
      return Response.json({ error: "An API key is required." }, { status: 400 });
    }

    // Cards in the cache came from the old instance.
    if (seerr) {
      await saveSeerrConnection({ url: url.trim(), apiKey: key });
      resetSeerr();
    } else {
      await saveConnection({ url: url.trim(), apiKey: key });
      invalidate();
    }

    return Response.json({ url: url.trim(), apiKeySet: true });
  } catch (err) {
    return fail(err);
  }
}
