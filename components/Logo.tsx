/**
 * The Neerakshi eye: an almond eye whose iris is a set of contour rings with
 * a single water drop as the pupil. `open` (0–1) parts the eyelids.
 */
export function Logo({ size = 32, open = 1, title, className }: { size?: number; open?: number; title?: string; className?: string }) {
  const lid = 14 * Math.max(0, Math.min(1, open));
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={className}
      fill="none"
      stroke="currentColor"
    >
      {title ? <title>{title}</title> : null}
      <defs>
        <clipPath id="nk-eye-clip">
          <path d={`M4 32 Q32 ${32 - lid * 1.9} 60 32 Q32 ${32 + lid * 1.9} 4 32 Z`} />
        </clipPath>
      </defs>
      <g clipPath="url(#nk-eye-clip)">
        <circle cx="32" cy="32" r="15" strokeWidth="1.6" />
        <circle cx="32" cy="32" r="11.5" strokeWidth="1" strokeDasharray="2.2 1.6" />
        <circle cx="32" cy="32" r="8" strokeWidth="1" />
        <path d="M32 24.5c3.2 4.2 4.8 7 4.8 9a4.8 4.8 0 0 1-9.6 0c0-2 1.6-4.8 4.8-9z" fill="var(--neer-teal)" stroke="none" />
      </g>
      <path d={`M4 32 Q32 ${32 - lid * 1.9} 60 32`} strokeWidth="2" strokeLinecap="round" />
      <path d={`M4 32 Q32 ${32 + lid * 1.9} 60 32`} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}
