import { fail } from "@/lib/api";
import { testConnection } from "@/lib/radarr";
import { getConnection } from "@/lib/store";

/**
 * The Test button. Checks an address and key against Radarr without saving,
 * so a typo shows up here rather than as a failed swipe later.
 */
export async function POST(request: Request) {
  try {
    const { url, apiKey } = (await request.json().catch(() => ({}))) as {
      url?: string;
      apiKey?: string;
    };

    const existing = await getConnection();
    // A blank key means "test the saved one" — it's never sent to the browser.
    const connection = {
      url: (url || existing?.url || "").trim(),
      apiKey: (apiKey || existing?.apiKey || "").trim(),
    };

    if (!connection.url || !connection.apiKey) {
      return Response.json(
        { error: "Enter Radarr's address and API key first." },
        { status: 400 },
      );
    }

    const status = await testConnection(connection);
    return Response.json({
      ok: true,
      name: status.instanceName || "Radarr",
      version: status.version,
    });
  } catch (err) {
    return fail(err);
  }
}
