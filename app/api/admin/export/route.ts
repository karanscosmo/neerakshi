import { adminAllowed, advisoriesExport } from "@/lib/server/admin";
import { error, handle } from "@/lib/server/http";
import { toCsv } from "@/lib/shared/csv";

export const runtime = "nodejs";

/** advisories.csv (anonymised) for Tableau. */
export async function GET(req: Request) {
  return handle(async () => {
    if (!(await adminAllowed(req))) return error(401, "Officer passcode required");
    const rows = await advisoriesExport();
    return new Response(toCsv(rows, ["date", "district_id", "district", "crop", "advice_type", "etc_mm", "rain_forecast_mm", "deficit_mm", "raw_mm", "net_depth_mm"]), {
      headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="advisories.csv"', "cache-control": "no-store" },
    });
  });
}
