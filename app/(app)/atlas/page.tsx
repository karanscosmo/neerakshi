import type { Metadata } from "next";
import { AtlasView } from "@/components/atlas/AtlasView";

export const metadata: Metadata = { title: "Water Stress Atlas" };

export default function AtlasPage() {
  return (
    <main id="main">
      <AtlasView />
    </main>
  );
}
