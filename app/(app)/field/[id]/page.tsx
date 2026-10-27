import type { Metadata } from "next";
import { AdvisoryView } from "@/components/field/AdvisoryView";

export const metadata: Metadata = { title: "Your advice" };

export default async function FieldAdvicePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main id="main">
      <AdvisoryView id={id} />
    </main>
  );
}
