import Link from "next/link";
import { cn } from "@/lib/utils";

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <Link
      href="/"
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="Neerakshi home"
    >
      <svg
        width="30"
        height="30"
        viewBox="0 0 32 32"
        fill="none"
        aria-hidden="true"
        className="shrink-0 transition-transform duration-500 group-hover:rotate-6"
      >
        <defs>
          <linearGradient id="nk-mark" x1="4" y1="2" x2="28" y2="30" gradientUnits="userSpaceOnUse">
            <stop stopColor="#48D9E8" />
            <stop offset="0.55" stopColor="#8CE5B1" />
            <stop offset="1" stopColor="#48D9E8" />
          </linearGradient>
        </defs>
        <path
          d="M16 2.5C16 2.5 5.5 14.2 5.5 21a10.5 10.5 0 0 0 21 0C26.5 14.2 16 2.5 16 2.5Z"
          stroke="url(#nk-mark)"
          strokeWidth="1.6"
        />
        <ellipse cx="16" cy="21" rx="6.4" ry="3.9" stroke="#48D9E8" strokeWidth="1.3" opacity="0.9" />
        <circle cx="16" cy="21" r="1.8" fill="#8CE5B1" />
        <path d="M9.8 21h-2.1M24.3 21h-2.1" stroke="#48D9E8" strokeWidth="1.1" strokeLinecap="round" opacity="0.7" />
      </svg>
      {!compact && (
        <span className="flex flex-col leading-none">
          <span className="font-display text-[0.95rem] font-semibold tracking-[0.16em] text-cloud">
            NEERAKSHI
          </span>
          <span className="mt-1 font-mono text-[0.5rem] uppercase tracking-[0.2em] text-muted">
            Water intelligence
          </span>
        </span>
      )}
    </Link>
  );
}
