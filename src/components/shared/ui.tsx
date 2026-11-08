import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  children,
  aside,
}: {
  eyebrow: string;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="relative border-b border-line/60">
      <div className="mx-auto grid max-w-[1500px] gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[1.5fr_0.8fr] lg:items-end lg:py-16">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h1 className="display mt-4 max-w-4xl text-[clamp(2.3rem,5.4vw,4.8rem)] font-semibold text-cloud">
            {title}
          </h1>
          {description && (
            <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">
              {description}
            </p>
          )}
          {children && <div className="mt-6 flex flex-wrap items-center gap-2">{children}</div>}
        </div>
        {aside && <div className="lg:justify-self-end">{aside}</div>}
      </div>
    </header>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  aside,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  aside?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="max-w-3xl">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2 className="display mt-2 text-2xl font-semibold text-cloud sm:text-3xl">{title}</h2>
        {description && <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {aside}
    </div>
  );
}

export function Stat({
  label,
  value,
  unit,
  note,
  accent = "glacier",
  demo = false,
}: {
  label: string;
  value: ReactNode;
  unit?: string;
  note?: ReactNode;
  accent?: "glacier" | "mint" | "amber" | "coral" | "muted";
  demo?: boolean;
}) {
  const accentClass = {
    glacier: "text-glacier",
    mint: "text-mint",
    amber: "text-amber",
    coral: "text-coral",
    muted: "text-cloud",
  }[accent];
  return (
    <div className="panel-flat relative overflow-hidden p-5">
      <div className="flex items-start justify-between gap-2">
        <p className="font-mono text-[0.6rem] uppercase leading-relaxed tracking-[0.14em] text-muted">
          {label}
        </p>
        {demo && <span className="demo-badge shrink-0">Demo</span>}
      </div>
      <p className={cn("mt-3 font-display text-3xl font-semibold", accentClass)}>
        {value}
        {unit && <span className="ml-1 text-sm font-normal text-muted">{unit}</span>}
      </p>
      {note && <p className="mt-2 text-[0.7rem] leading-relaxed text-muted">{note}</p>}
    </div>
  );
}

export function ProvenanceBadge({
  type,
  source,
}: {
  type: "observed" | "reanalysis" | "demo_fixture" | "model" | string;
  source?: string;
}) {
  const label = type === "demo_fixture" ? "DEMO FIXTURE" : type.toUpperCase();
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md border px-2 py-1 font-mono text-[0.56rem] uppercase tracking-[0.12em]",
        type === "demo_fixture"
          ? "border-amber/40 bg-amber/10 text-amber"
          : type === "reanalysis"
            ? "border-glacier/30 bg-glacier/5 text-glacier"
            : "border-line bg-white/5 text-muted",
      )}
      title={source}
    >
      {label}
      {source && <span className="hidden opacity-70 sm:inline">· {source}</span>}
    </span>
  );
}

export function DataNotice({
  tone = "amber",
  title,
  children,
}: {
  tone?: "amber" | "glacier" | "coral";
  title: string;
  children: ReactNode;
}) {
  const styles = {
    amber: "border-amber/30 bg-amber/5 text-amber",
    glacier: "border-glacier/25 bg-glacier/5 text-glacier",
    coral: "border-coral/30 bg-coral/5 text-coral",
  }[tone];
  return (
    <div className={cn("rounded-xl border px-4 py-3", styles)}>
      <p className="font-mono text-[0.6rem] uppercase tracking-[0.16em]">{title}</p>
      <div className="mt-1.5 text-[0.78rem] leading-relaxed text-cloud/70">{children}</div>
    </div>
  );
}

export function EmptyState({
  title,
  children,
  icon,
}: {
  title: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-line/80 px-6 py-14 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-display text-lg font-medium text-cloud">{title}</p>
      <div className="mt-2 max-w-md text-sm leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export function SourceLine({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3 font-mono text-[0.58rem] uppercase leading-relaxed tracking-[0.1em] text-muted/70">
      {children}
    </p>
  );
}
