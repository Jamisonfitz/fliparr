import { fail } from "@/lib/api";
import { readStore } from "@/lib/store";

/** Every swipe still on record, newest first. */
export async function GET() {
  try {
    const { history } = await readStore();
    return Response.json({ history });
  } catch (err) {
    return fail(err);
  }
}
