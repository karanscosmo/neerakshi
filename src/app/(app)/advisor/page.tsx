import type { Metadata } from "next";
import { AdvisorClient } from "@/components/advisor/AdvisorClient";

export const metadata: Metadata = {
  title: "My Field Advisor",
  description:
    "Draw an agricultural field, review crop and soil context, and run a documented FAO-56 irrigation advisory with live weather and Sentinel-2 context.",
};

export default async function AdvisorPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string | string[] }>;
}) {
  const params = await searchParams;
  const districtId = Array.isArray(params.district) ? params.district[0] : params.district;

  return (
    <div className="min-h-screen bg-midnight text-cloud">
      <AdvisorClient />
      <span className="sr-only">{districtId ?? ""}</span>
    </div>
  );
}
