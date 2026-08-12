import { fail } from "@/lib/api";
import { invalidate } from "@/lib/deck";
import { getConnection, saveConnection } from "@/lib/store";

/**
 * Where Radarr lives.
 *
 * The API key is never sent back to the browser — only whether one is set.
 * Saving with a blank key keeps the stored one, so you can change the address
 * without retyping the key.
 */
export async function GET() {
  try {
    const connection = await getConnection();
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
    const { url, apiKey } = (await request.json()) as {
      url?: string;
      apiKey?: string;
    };

    if (!url?.trim()) {
      return Response.json({ error: "Radarr's address is required." }, { status: 400 });
    }
    if (!/^https?:\/\//i.test(url.trim())) {
      return Response.json(
        { error: "Include http:// or https:// in the address." },
        { status: 400 },
      );
    }

    const existing = await getConnection();
    const key = apiKey?.trim() || existing?.apiKey;
    if (!key) {
      return Response.json({ error: "An API key is required." }, { status: 400 });
    }

    await saveConnection({ url: url.trim(), apiKey: key });
    // Cards in the cache came from the old instance.
    invalidate();

    return Response.json({ url: url.trim(), apiKeySet: true });
  } catch (err) {
    return fail(err);
  }
}
