import type { Metadata } from "next";
import { GroundwaterView } from "@/components/sections/GroundwaterView";

export const metadata: Metadata = { title: "Groundwater" };

export default function GroundwaterPage() {
  return (
    <main id="main">
      <GroundwaterView />
    </main>
  );
}
