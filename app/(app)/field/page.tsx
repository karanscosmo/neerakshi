import type { Metadata } from "next";
import { FieldFlow } from "@/components/field/FieldFlow";

export const metadata: Metadata = { title: "My Field" };

export default function FieldPage() {
  return (
    <main id="main">
      <FieldFlow />
    </main>
  );
}
