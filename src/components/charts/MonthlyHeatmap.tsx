import { cn } from "@/lib/utils";

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function color(value: number, min: number, max: number) {
  const ratio = Math.max(0, Math.min(1, (value - min) / Math.max(max - min, 1)));
  const stops = [
    [7, 21, 33],
    [16, 44, 59],
    [23, 68, 86],
    [72, 217, 232],
  ];
  const position = ratio * (stops.length - 1);
  const index = Math.min(Math.floor(position), stops.length - 2);
  const t = position - index;
  const rgb = stops[index].map((channel, i) => Math.round(channel + (stops[index + 1][i] - channel) * t));
  return `rgb(${rgb.join(",")})`;
}

export function MonthlyHeatmap({
  rows,
  unit = "mm",
  className,
}: {
  rows: { year: number; months: number[] }[];
  unit?: string;
  className?: string;
}) {
  const values = rows.flatMap((row) => row.months);
  const min = Math.min(...values);
  const max = Math.max(...values);

  return (
    <figure className={cn("w-full overflow-x-auto", className)}>
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[3rem_repeat(12,minmax(0,1fr))] gap-1">
          <div />
          {MONTHS.map((month, index) => (
            <div
              key={`${month}-${index}`}
              className="text-center font-mono text-[0.56rem] uppercase tracking-[0.08em] text-muted"
              title={MONTH_NAMES[index]}
            >
              {month}
            </div>
          ))}
          {rows.map((row) => (
            <div key={row.year} className="contents">
              <div className="flex items-center font-mono text-[0.6rem] text-muted">{row.year}</div>
              {row.months.map((value, monthIndex) => (
                <div
                  key={monthIndex}
                  className="group relative aspect-square rounded-[3px] border border-white/5"
                  style={{ backgroundColor: color(value, min, max) }}
                  title={`${MONTH_NAMES[monthIndex]} ${row.year}: ${value.toFixed(0)} ${unit}`}
                >
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[0.5rem] font-medium text-midnight opacity-0 transition-opacity group-hover:opacity-100">
                    {value.toFixed(0)}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2 font-mono text-[0.56rem] uppercase tracking-[0.1em] text-muted">
          <span>{min.toFixed(0)}</span>
          <span className="h-2 flex-1 rounded-full bg-gradient-to-r from-[#071521] via-[#174456] to-[#48D9E8]" />
          <span>{max.toFixed(0)} {unit}</span>
        </div>
      </div>
      <figcaption className="mt-2 text-[0.65rem] leading-relaxed text-muted">
        Monthly rainfall totals. Hover or focus a cell for the exact value; a data table
        follows for assistive technology.
      </figcaption>
      <table className="sr-only">
        <caption>Monthly rainfall totals</caption>
        <thead>
          <tr>
            <th>Year</th>
            {MONTH_NAMES.map((month) => (
              <th key={month}>{month}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.year}>
              <td>{row.year}</td>
              {row.months.map((value, index) => (
                <td key={index}>{value.toFixed(1)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
