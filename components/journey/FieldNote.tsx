"use client";
import type { ReactNode } from "react";
import { useI18n } from "@/lib/i18n/client";

export type LiveState<T> = { status: "loading" } | { status: "ok"; value: T } | { status: "error"; message?: string } | { status: "none"; note: string };

/** Field-note caption: title, ≤ 2 lines, source name, one live value (skeleton → value | "unavailable" + retry). */
export function FieldNote<T>({
  title,
  body,
  source,
  label,
  live,
  render,
  onRetry,
  children,
  dark,
}: {
  title: string;
  body: string;
  source?: string;
  label?: string;
  live?: LiveState<T>;
  render?: (v: T) => ReactNode;
  onRetry?: () => void;
  children?: ReactNode;
  dark?: boolean;
}) {
  const { t } = useI18n();
  return (
    <aside className={`field-note jn-note${dark ? " jn-note--dark" : ""}`} aria-live="polite">
      <p className="annot" style={{ margin: 0 }}>
        {source}
      </p>
      <h3>{title}</h3>
      <p style={{ margin: "0 0 8px" }}>{body}</p>
      {live ? (
        <div className="jn-live">
          {label ? <span className="annot">{label}</span> : null}
          {live.status === "loading" ? <span className="skeleton" style={{ display: "block", height: 24, width: 140 }} /> : null}
          {live.status === "ok" && render ? <div className="value">{render(live.value)}</div> : null}
          {live.status === "none" ? <p className="annot" style={{ margin: 0 }}>{live.note}</p> : null}
          {live.status === "error" ? (
            <div className="row" style={{ gap: 8 }}>
              <span className="annot">{t.common.liveUnavailable}</span>
              {onRetry ? (
                <button className="btn btn--ghost btn--sm" onClick={onRetry}>
                  {t.common.retry}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      {children}
    </aside>
  );
}

export function Sparkline({ values, width = 160, height = 34, label }: { values: { x: number; y: number | null }[]; width?: number; height?: number; label: string }) {
  const ys = values.map((v) => v.y).filter((y): y is number => y !== null);
  if (ys.length < 2) return null;
  const max = Math.max(...ys.map(Math.abs), 10);
  const bw = width / values.length;
  return (
    <svg width={width} height={height} role="img" aria-label={label} style={{ display: "block", marginTop: 6 }}>
      <line x1="0" x2={width} y1={height / 2} y2={height / 2} stroke="currentColor" strokeOpacity="0.4" strokeWidth="0.5" />
      {values.map((v, i) =>
        v.y === null ? null : (
          <rect
            key={v.x}
            x={i * bw + 0.5}
            width={Math.max(1, bw - 1)}
            y={v.y >= 0 ? height / 2 - (v.y / max) * (height / 2) : height / 2}
            height={Math.max(0.5, (Math.abs(v.y) / max) * (height / 2))}
            fill={v.y <= -10 ? "var(--laterite)" : v.y >= 10 ? "var(--neer-teal)" : "var(--monsoon-slate)"}
          />
        ),
      )}
    </svg>
  );
}
