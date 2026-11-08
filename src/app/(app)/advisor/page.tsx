import type { Metadata } from "next";
import { AdvisorClient } from "@/components/advisor/AdvisorClient";
import { getAtlasData, getPreparedMetadata } from "@/lib/data/atlas";

export const metadata: Metadata = {
  title: "My Field Advisor",
  description:
    "Draw an agricultural field, review crop and soil context, and run a documented FAO-56 irrigation advisory with live weather and Sentinel-2 context. Integrated with Karnataka CGWB groundwater data.",
};

export default async function AdvisorPage({
  searchParams,
}: {
  searchParams: Promise<{ district?: string }>;
}) {
  const resolvedParams = await searchParams;
  const district = resolvedParams.district;

  const [atlas, metadata] = await Promise.all([
    getAtlasData(),
    getPreparedMetadata(),
  ]);

  return (
    <div className="min-h-screen bg-midnight text-cloud">
      <AdvisorClient />
      <span className="sr-only">District: {district ?? ""}</span>
    </div>
  );
}