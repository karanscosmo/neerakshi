import type { Metadata } from "next";
import { MonsoonView } from "@/components/sections/MonsoonView";

export const metadata: Metadata = { title: "Monsoon Story" };

export default function MonsoonPage() {
  return (
    <main id="main">
      <MonsoonView />
    </main>
  );
}
