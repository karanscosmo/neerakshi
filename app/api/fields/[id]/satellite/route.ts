import { getOwnerId } from "@/lib/server/session";
import { error, handle, json } from "@/lib/server/http";
import { fieldSatellite, getOwnedField } from "@/lib/server/advisor";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Sentinel-2 NDVI/NDWI series for the field (Copernicus Statistical API, cached 24 h). */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const field = await getOwnedField(id, await getOwnerId());
    if (!field) return error(404, "Field not found");
    const sat = await fieldSatellite(field);
    if (sat.status === "error") return error(502, sat.message, { status: "error" });
    return json(sat);
  });
}
