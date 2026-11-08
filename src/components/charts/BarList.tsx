import { cn } from "@/lib/utils";

export function BarList({
  items,
  valueSuffix = "",
  digits = 0,
  max: maxOverride,
  color = "#48D9E8",
  className,
  ariaLabel,
}: {
  items: { label: string; value: number; note?: string; color?: string }[];
  valueSuffix?: string;
  digits?: number;
  max?: number;
  color?: string;
  className?: string;
  ariaLabel?: string;
}) {
  const max = maxOverride ?? Math.max(...items.map((item) => item.value), 0.0001);
  return (
    <ul className={cn("space-y-2.5", className)} aria-label={ariaLabel}>
      {items.map((item, index) => {
        const width = Math.max(1.5, (item.value / max) * 100);
        return (
          <li key={`${item.label}-${index}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="truncate text-[0.78rem] text-cloud/85">{item.label}</span>
              <span className="mono shrink-0 text-[0.7rem] text-muted">
                {item.value.toLocaleString("en-IN", {
                  maximumFractionDigits: digits,
                  minimumFractionDigits: digits,
                })}
                {valueSuffix}
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
              <div
                className="h-full rounded-full"
                style={{ width: `${width}%`, backgroundColor: item.color ?? color }}
              />
            </div>
            {item.note && <p className="mt-1 text-[0.62rem] text-muted">{item.note}</p>}
          </li>
        );
      })}
    </ul>
  );
}
