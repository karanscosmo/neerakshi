import { districtSummary, districtTrends } from "@/lib/server/atlas";
import { error, handle, json } from "@/lib/server/http";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const summary = await districtSummary(id);
    if (!summary) return error(404, "Unknown district");
    const withTrends = new URL(req.url).searchParams.get("trends") === "1";
    return json({ ...summary, trends: withTrends ? await districtTrends(id) : undefined }, { cacheSeconds: 3600 });
  });
}
