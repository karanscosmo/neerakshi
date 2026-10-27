"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n/client";

export function PasscodeForm({ configured }: { configured: boolean }) {
  const { t } = useI18n();
  const router = useRouter();
  const [v, setV] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  if (!configured) return <p className="notice">{t.impact.notConfigured}</p>;
  return (
    <form
      className="card stack"
      style={{ maxWidth: 420 }}
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        setBusy(true);
        setErr(null);
        const r = await fetch("/api/admin/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ passcode: v }) });
        setBusy(false);
        if (r.ok) router.refresh();
        else setErr(r.status === 401 ? t.impact.wrongPasscode : ((await r.json().catch(() => ({}))).error ?? t.common.error));
      }}
    >
      <label className="field">
        <span>{t.impact.passcode}</span>
        <input className="input" type="password" autoComplete="current-password" value={v} onChange={(e) => setV(e.target.value)} required />
      </label>
      {err ? <p className="notice" role="alert">{err}</p> : null}
      <button className="btn" disabled={busy}>
        {t.impact.signIn}
      </button>
    </form>
  );
}

export function SignOut() {
  const { t } = useI18n();
  const router = useRouter();
  return (
    <button
      className="btn btn--ghost btn--sm"
      onClick={async () => {
        await fetch("/api/admin/session", { method: "DELETE" });
        router.refresh();
      }}
    >
      {t.impact.signOut}
    </button>
  );
}
