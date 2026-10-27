"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useDistrict } from "@/lib/client/district";
import { useI18n } from "@/lib/i18n/client";

/** Searchable district picker in a modal dialog. Shared across all sections. */
export function DistrictPicker({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const { districts, districtsLoading, setDistrict, locate, districtId } = useDistrict();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      setQ("");
      setStatus(null);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
    if (!open && d.open) d.close();
  }, [open]);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    const list = s ? districts.filter((d) => d.name.toLowerCase().includes(s) || d.state.toLowerCase().includes(s)) : districts;
    return list.slice(0, 80);
  }, [q, districts]);

  const choose = (id: string) => {
    setDistrict(id);
    onClose();
  };

  const onLocate = async () => {
    setBusy(true);
    setStatus(t.common.locating);
    const r = await locate();
    setBusy(false);
    if (r === "ok") onClose();
    else setStatus(t.common.locationFailed);
  };

  return (
    <dialog ref={ref} className="picker" onClose={onClose} aria-labelledby={`${listId}-h`} onClick={(e) => e.target === ref.current && onClose()}>
      <div className="picker__inner">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h2 id={`${listId}-h`} style={{ fontSize: "var(--step-2)", margin: 0 }}>
            {t.common.pickDistrict}
          </h2>
          <button className="btn btn--ghost btn--icon" onClick={onClose} aria-label={t.common.close}>
            ✕
          </button>
        </div>
        <button className="btn btn--ghost" onClick={onLocate} disabled={busy} style={{ marginTop: 12 }}>
          ◎ {t.common.useMyLocation}
        </button>
        {status ? (
          <p role="status" className="annot" style={{ marginTop: 8 }}>
            {status}
          </p>
        ) : null}
        <label className="field" style={{ marginTop: 12 }}>
          <span className="sr-only">{t.common.searchDistrict}</span>
          <input
            ref={inputRef}
            className="input"
            type="search"
            placeholder={t.common.searchDistrict}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-controls={listId}
            autoComplete="off"
            onKeyDown={(e) => {
              if (e.key === "Enter" && results[0]) choose(results[0].id);
            }}
          />
        </label>
        <ul id={listId} className="picker__list" role="listbox" aria-label={t.common.district}>
          {districtsLoading ? <li className="skeleton" style={{ height: 44 }} /> : null}
          {!districtsLoading && results.length === 0 ? <li className="annot">{t.common.noResults}</li> : null}
          {results.map((d) => (
            <li key={d.id} role="option" aria-selected={d.id === districtId}>
              <button className="picker__item" onClick={() => choose(d.id)}>
                <span>{d.name}</span>
                <span className="annot">{d.state}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <style>{`
        .picker { border: 1px solid var(--ink); border-radius: 14px; padding: 0; background: var(--paper-light); color: var(--ink); width: min(520px, calc(100vw - 24px)); max-height: min(80dvh, 720px); }
        .picker::backdrop { background: rgba(20,27,45,.45); }
        .picker__inner { padding: 18px; display: flex; flex-direction: column; max-height: min(80dvh, 720px); }
        .picker__list { list-style: none; margin: 10px 0 0; padding: 0; overflow: auto; flex: 1; }
        .picker__item { width: 100%; min-height: 44px; display: flex; justify-content: space-between; align-items: center; gap: 12px; padding: 8px 10px; border: 0; border-bottom: 1px solid var(--hairline); background: none; cursor: pointer; text-align: left; }
        .picker__item:hover, [aria-selected="true"] > .picker__item { background: var(--paper-deep); }
      `}</style>
    </dialog>
  );
}
