import type { Metadata } from "next";
import { CropsView } from "@/components/sections/CropsView";

export const metadata: Metadata = { title: "Crops and Water" };

export default function CropsPage() {
  return (
    <main id="main">
      <CropsView />
    </main>
  );
}
