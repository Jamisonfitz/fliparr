import { fail } from "@/lib/api";
import { invalidate, resetDeckState } from "@/lib/deck";
import { deleteExclusion } from "@/lib/radarr";
import { clearHidden, getHidden } from "@/lib/store";

/**
 * Start-over controls for the deck's own memory of what you've passed on.
 *
 * GET  /api/reset            counts of what's currently hidden
 * POST /api/reset {target}   "skipped" clears Seerr skips so they come back;
 *                            "radarr-exclusions" deletes the Radarr exclusions
 *                            Fliparr created (not the user's whole exclusion list)
 *                            so those movies are recommended again.
 */
export async function GET() {
  try {
    const hidden = await getHidden();
    return Response.json({
      skipped: hidden.filter((h) => h.source === "seerr").length,
      radarrExclusions: hidden.filter((h) => h.source === "radarr").length,
    });
  } catch (err) {
    return fail(err);
  }
}

export async function POST(request: Request) {
  try {
    const { target } = (await request.json().catch(() => ({}))) as {
      target?: "skipped" | "radarr-exclusions";
    };

    if (target === "skipped") {
      const removed = await clearHidden("seerr");
      resetDeckState();
      return Response.json({ ok: true, cleared: removed.length });
    }

    if (target === "radarr-exclusions") {
      const removed = await clearHidden("radarr");
      // Delete each exclusion Fliparr created. Tolerate ones already gone.
      let deleted = 0;
      for (const item of removed) {
        if (!item.radarrId) continue;
        try {
          await deleteExclusion(item.radarrId);
          deleted++;
        } catch {
          // Already removed in Radarr, or Radarr unreachable — the local record
          // is cleared regardless.
        }
      }
      invalidate();
      return Response.json({ ok: true, cleared: removed.length, deleted });
    }

    return Response.json(
      { error: "target must be 'skipped' or 'radarr-exclusions'." },
      { status: 400 },
    );
  } catch (err) {
    return fail(err);
  }
}
