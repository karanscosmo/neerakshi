import { getOwnerId } from "@/lib/server/session";
import { error, handle, json } from "@/lib/server/http";
import { getOwnedField, runFieldAdvisory } from "@/lib/server/advisor";

export const runtime = "nodejs";
export const maxDuration = 45;

/** Fetch weather + satellite, run the FAO-56 balance, store and return the advisory with its explanation. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const field = await getOwnedField(id, await getOwnerId());
    if (!field) return error(404, "Field not found");
    const bundle = await runFieldAdvisory(field, "user");
    return json({
      ...bundle,
      advisory: { ...bundle.advisory, history: bundle.advisory.history.slice(-21) },
    });
  });
}
