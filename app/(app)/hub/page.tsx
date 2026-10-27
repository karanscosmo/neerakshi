import type { Metadata } from "next";
import { OrbitDial } from "@/components/dial/OrbitDial";

export const metadata: Metadata = { title: "Orbit Dial" };

export default function Hub() {
  return (
    <main id="main">
      <OrbitDial />
    </main>
  );
}
