import type { Metadata } from "next";
import { OfflineAdvisory } from "@/components/field/AdvisoryView";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main id="main">
      <OfflineAdvisory />
    </main>
  );
}
