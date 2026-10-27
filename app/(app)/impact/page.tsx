import type { Metadata } from "next";
import { isAdmin } from "@/lib/server/session";
import { adminStats } from "@/lib/server/admin";
import { getDict } from "@/lib/i18n/server";
import { PasscodeForm } from "@/components/impact/PasscodeForm";
import { ImpactDashboard } from "@/components/impact/ImpactDashboard";

export const metadata: Metadata = { title: "Advisory Impact", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function ImpactPage() {
  const { t } = await getDict();
  const ok = await isAdmin();
  return (
    <main id="main" className="page">
      <h2>{t.impact.title}</h2>
      {ok ? <ImpactDashboard s={await adminStats()} /> : <PasscodeForm configured={Boolean(process.env.ADMIN_PASSCODE)} />}
    </main>
  );
}
