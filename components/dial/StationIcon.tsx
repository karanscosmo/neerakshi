import type { SectionKey } from "@/lib/shared/sections";

/** Small engraved icons for the dial stations (stroke = currentColor). */
export function StationIcon({ k, size = 34 }: { k: SectionKey; size?: number }) {
  const p = { fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 32 32" width={size} height={size} aria-hidden>
      {k === "atlas" && (
        <g {...p}>
          <path d="M4 8l7-3 10 3 7-3v19l-7 3-10-3-7 3z" />
          <path d="M11 5v19M21 8v19" strokeWidth="1" />
          <path d="M6 14h20M6 19h20" strokeWidth="0.6" strokeDasharray="1.5 2" />
        </g>
      )}
      {k === "monsoon" && (
        <g {...p}>
          <path d="M8 17a5 5 0 0 1 1-9.9A7 7 0 0 1 22 8a4.5 4.5 0 0 1 1 9z" />
          <path d="M11 21l-2 5M16 21l-2 5M21 21l-2 5" />
        </g>
      )}
      {k === "groundwater" && (
        <g {...p}>
          <path d="M5 10h22M9 10v18h14V10" />
          <path d="M16 4v6M12 4h8" />
          <path d="M9 21q3.5-2 7 0t7 0" />
        </g>
      )}
      {k === "crops" && (
        <g {...p}>
          <path d="M16 29V9" />
          {[10, 14, 18].map((y) => (
            <g key={y}>
              <path d={`M16 ${y}c-3-1-5-3-5-6 3 0 5 2 5 5`} />
              <path d={`M16 ${y}c3-1 5-3 5-6-3 0-5 2-5 5`} />
            </g>
          ))}
          <path d="M8 29h16" strokeWidth="1" />
        </g>
      )}
      {k === "field" && (
        <g {...p}>
          <path d="M4 22l12-6 12 6-12 6z" />
          <path d="M16 3c3 4 5 6.5 5 8.5a5 5 0 0 1-10 0c0-2 2-4.5 5-8.5z" />
        </g>
      )}
      {k === "impact" && (
        <g {...p}>
          <path d="M5 27h22" />
          <rect x="7" y="16" width="4" height="11" />
          <rect x="14" y="10" width="4" height="17" />
          <rect x="21" y="5" width="4" height="22" />
        </g>
      )}
      {k === "methods" && (
        <g {...p}>
          <circle cx="16" cy="16" r="11" />
          <path d="M16 5v4M16 23v4M5 16h4M23 16h4" />
          <path d="M16 16l5-5" />
          <circle cx="16" cy="16" r="1.5" fill="currentColor" />
        </g>
      )}
    </svg>
  );
}
