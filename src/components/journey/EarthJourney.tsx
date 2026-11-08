"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUpRight, Droplets, Radar, Satellite, Waves } from "lucide-react";
import { Starfield } from "@/components/journey/Starfield";
import { MonsoonBars } from "@/components/journey/MonsoonBars";
import { Logo } from "@/components/shared/Logo";
import { formatNumber, formatPercent } from "@/lib/utils";

export interface JourneyData {
  districtCount: number;
  latestYear: number;
  meanDeparturePct: number | null;
  meanGroundwaterDepthM: number | null;
  meanIrrigatedSharePct: number | null;
  monsoonSeries: { year: number; value: number }[];
  stressClasses: Record<string, number>;
  generatedAt: string;
  monthlyObservations: number;
  crops: { crop: string; cropName: string; productionTonnes: number; yieldKgHa: number | null }[];
}

const CROP_IMAGES: Record<string, string> = {
  rice: "/images/crops/rice.jpg",
  wheat: "/images/crops/wheat.jpg",
  maize: "/images/crops/maize.jpg",
  sugarcane: "/images/crops/sugarcane.jpg",
};

function subscribeToReducedMotion(callback: () => void) {
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => media.removeEventListener("change", callback);
}

function getReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function getServerReducedMotion() {
  return false;
}

export function EarthJourney({ data }: { data: JourneyData }) {
  const root = useRef<HTMLDivElement | null>(null);
  const [progress, setProgress] = useState(0);

  const crops = useMemo(() => data.crops.slice(0, 4), [data.crops]);

  const reduced = useSyncExternalStore(subscribeToReducedMotion, getReducedMotion, getServerReducedMotion);

  useEffect(() => {
    let frame = 0;
    let last = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const max = document.documentElement.scrollHeight - window.innerHeight;
        const value = max > 0 ? Math.min(1, window.scrollY / max) : 0;
        if (Math.abs(value - last) > 0.002) {
          last = value;
          setProgress(value);
        }
      });
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
    };
  }, []);

  useEffect(() => {
    if (reduced) return;
    let cancelled = false;
    let context: { revert: () => void } | undefined;
    let matchMedia: { revert: () => void } | undefined;

    (async () => {
      const [{ gsap }, { ScrollTrigger }] = await Promise.all([
        import("gsap"),
        import("gsap/ScrollTrigger"),
      ]);
      if (cancelled) return;
      gsap.registerPlugin(ScrollTrigger);
      context = gsap.context(() => {
        const q = gsap.utils.selector(root);
        const mm = gsap.matchMedia();
        matchMedia = mm;

        mm.add("(min-width: 900px)", () => {
          gsap.to(q(".hero-earth"), {
            yPercent: 16,
            scale: 1.08,
            ease: "none",
            scrollTrigger: {
              trigger: q(".hero")[0],
              start: "top top",
              end: "bottom top",
              scrub: 0.6,
            },
          });
          gsap.to(q(".hero-copy"), {
            yPercent: -18,
            opacity: 0,
            ease: "none",
            scrollTrigger: {
              trigger: q(".hero")[0],
              start: "20% top",
              end: "bottom top",
              scrub: true,
            },
          });

          const pinned = [
            { section: ".scene-atmosphere", bg: ".atmosphere-bg", copy: ".atmosphere-copy" },
            { section: ".scene-india", bg: ".india-bg", copy: ".india-copy" },
            { section: ".scene-monsoon", bg: ".monsoon-bg", copy: ".monsoon-copy" },
            { section: ".scene-ground", bg: ".ground-art", copy: ".ground-copy" },
            { section: ".scene-agri", bg: ".agri-bg", copy: ".agri-copy" },
            { section: ".scene-field", bg: ".field-bg", copy: ".field-copy" },
          ];

          pinned.forEach(({ section, bg, copy }) => {
            const trigger = q(section)[0];
            if (!trigger) return;
            const timeline = gsap.timeline({
              scrollTrigger: {
                trigger,
                start: "top top",
                end: "+=110%",
                pin: true,
                scrub: 0.8,
                anticipatePin: 1,
              },
            });
            timeline.fromTo(
              q(bg),
              { scale: 1.12, yPercent: 2 },
              { scale: 1, yPercent: -3, ease: "none" },
              0,
            );
            timeline.fromTo(
              q(copy),
              { y: 60, opacity: 0.35 },
              { y: -20, opacity: 1, ease: "none" },
              0,
            );
          });

          gsap.fromTo(
            q(".water-table"),
            { y: -18 },
            {
              y: 74,
              ease: "none",
              scrollTrigger: {
                trigger: q(".scene-ground")[0],
                start: "top bottom",
                end: "bottom top",
                scrub: true,
              },
            },
          );

          gsap.fromTo(
            q(".field-mask"),
            { scale: 1.22, borderRadius: "4%" },
            {
              scale: 1,
              borderRadius: "50%",
              ease: "none",
              scrollTrigger: {
                trigger: q(".scene-field")[0],
                start: "top top",
                end: "bottom top",
                scrub: true,
              },
            },
          );

          gsap.from(q(".crop-card"), {
            y: 40,
            opacity: 0,
            stagger: 0.08,
            scrollTrigger: {
              trigger: q(".scene-agri")[0],
              start: "top 60%",
              toggleActions: "play none none reverse",
            },
          });

          gsap.from(q(".india-stat"), {
            y: 26,
            opacity: 0,
            stagger: 0.08,
            scrollTrigger: {
              trigger: q(".scene-india")[0],
              start: "top 55%",
              toggleActions: "play none none reverse",
            },
          });
        });

        mm.add("(max-width: 899px)", () => {
          gsap.utils.toArray<HTMLElement>(".mobile-parallax").forEach((element) => {
            gsap.fromTo(
              element,
              { y: 30 },
              {
                y: -30,
                ease: "none",
                scrollTrigger: {
                  trigger: element,
                  start: "top bottom",
                  end: "bottom top",
                  scrub: true,
                },
              },
            );
          });
        });
      }, root);
    })();

    return () => {
      cancelled = true;
      matchMedia?.revert();
      context?.revert();
    };
  }, [reduced]);

  return (
    <div ref={root} className="relative overflow-clip bg-midnight">
      <div
        aria-hidden
        className="fixed right-0 top-1/2 z-40 hidden h-40 w-[2px] -translate-y-1/2 bg-line/60 lg:block"
      >
        <div
          className="w-full bg-glacier transition-[height] duration-150"
          style={{ height: `${Math.round(progress * 100)}%` }}
        />
      </div>

      <nav
        aria-label="Journey"
        className="absolute inset-x-0 top-0 z-30 mx-auto flex max-w-[1500px] items-center justify-between px-4 py-5 sm:px-6"
      >
        <Logo />
        <div className="flex items-center gap-1 sm:gap-3">
          <Link
            href="/atlas"
            className="hidden rounded-full px-3 py-2 text-xs text-muted transition-colors hover:text-cloud sm:inline-flex"
          >
            Atlas
          </Link>
          <Link
            href="/advisor"
            className="hidden rounded-full px-3 py-2 text-xs text-muted transition-colors hover:text-cloud sm:inline-flex"
          >
            Field advisor
          </Link>
          <Link href="/overview" className="btn-ghost min-h-10 px-4 py-2 text-xs">
            Enter platform
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
          </Link>
        </div>
      </nav>

      <section className="hero noise relative min-h-[100svh] overflow-hidden">
        <Starfield className="absolute inset-0 h-full w-full" />
        <div className="hero-earth absolute inset-0">
          <Image
            src="/images/earth/eastern-hemisphere.jpg"
            alt="NASA Blue Marble view of Earth with India, the Arabian Sea and the Bay of Bengal visible"
            fill
            priority
            sizes="100vw"
            className="object-contain object-[68%_center] opacity-95 sm:object-[72%_center]"
          />
        </div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_45%,rgba(72,217,232,0.14),transparent_42%)]" />
        <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/80 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-midnight via-transparent to-midnight/30" />

        <div className="hero-copy relative z-10 mx-auto flex min-h-[100svh] max-w-[1500px] flex-col justify-end px-4 pb-16 pt-32 sm:justify-center sm:px-6 sm:pb-24">
          <div className="max-w-3xl">
            <p className="eyebrow flex items-center gap-2">
              <Satellite className="h-3.5 w-3.5" aria-hidden />
              Earth observation · Agricultural water intelligence
            </p>
            <h1 className="display mt-6 text-[clamp(3.6rem,12vw,10.5rem)] font-semibold text-cloud glow-text">
              NEERAKSHI
            </h1>
            <p className="mt-5 max-w-2xl font-display text-[clamp(1.05rem,2.4vw,1.6rem)] font-medium uppercase tracking-[0.14em] text-glacier">
              Every drop, seen from the sky.
            </p>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-muted sm:text-lg">
              An intelligent view of India&apos;s agricultural water systems, powered by
              Earth observation and environmental data.
            </p>
            <div className="mt-9 flex flex-wrap items-center gap-3">
              <a href="#descent" className="btn-primary text-sm">
                Begin the descent
                <ArrowDown className="h-4 w-4" aria-hidden />
              </a>
              <Link href="/overview" className="btn-ghost text-sm">
                Skip to intelligence
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-6 right-4 z-10 hidden text-right font-mono text-[0.58rem] uppercase leading-relaxed tracking-[0.18em] text-muted/80 sm:right-6 sm:block">
          <p>LAT 20.5937° N</p>
          <p>LON 78.9629° E</p>
          <p className="mt-2 text-glacier/70">Orbit data · NASA Blue Marble</p>
        </div>
        <a
          href="#descent"
          className="absolute bottom-5 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2 font-mono text-[0.58rem] uppercase tracking-[0.22em] text-muted sm:left-6 sm:translate-x-0"
        >
          Scroll to descend
          <ArrowDown className="h-3.5 w-3.5 animate-bounce text-glacier" aria-hidden />
        </a>
      </section>

      <section
        id="descent"
        className="scene-atmosphere relative flex min-h-[100svh] items-center overflow-hidden border-t border-line/40"
      >
        <div className="atmosphere-bg absolute inset-0">
          <Image
            src="/images/atmosphere/sunrise.jpg"
            alt="Earth's atmosphere at sunrise photographed from the International Space Station"
            fill
            sizes="100vw"
            className="object-cover opacity-70"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-midnight/40 via-midnight/20 to-midnight" />
        <div className="atmosphere-copy relative z-10 mx-auto w-full max-w-[1500px] px-4 py-24 sm:px-6">
          <p className="eyebrow">02 · Descent</p>
          <h2 className="display mt-5 max-w-4xl text-[clamp(2.4rem,6.5vw,5.8rem)] font-semibold text-cloud">
            THROUGH THE ATMOSPHERE
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-cloud/65 sm:text-lg">
            The camera falls toward the subcontinent. Cloud systems, river basins and
            agricultural plains emerge from the blue — each one part of the same water
            cycle.
          </p>
          <div className="mt-12 grid max-w-2xl gap-4 border-l border-glacier/30 pl-5 font-mono text-[0.65rem] uppercase tracking-[0.16em] text-muted sm:grid-cols-2">
            <p>Altitude · 408 km → 700 m</p>
            <p>Instrument · ISS / VIIRS true colour</p>
            <p>Cloud motion · multi-layer parallax</p>
            <p>Target · Indian subcontinent</p>
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-midnight to-transparent" />
      </section>

      <section className="scene-india relative flex min-h-[100svh] items-end overflow-hidden border-t border-line/40">
        <div className="india-bg absolute inset-0">
          <Image
            src="/images/earth/india-satellite.jpg"
            alt="Satellite true-colour view of India during the monsoon, showing cloud bands over the subcontinent"
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/55 to-midnight/10" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,transparent_20%,rgba(7,21,33,0.55)_100%)]" />
        <div className="india-copy relative z-10 mx-auto w-full max-w-[1500px] px-4 pb-16 pt-32 sm:px-6 sm:pb-20">
          <p className="eyebrow">03 · The subcontinent</p>
          <h2 className="display mt-5 max-w-5xl text-[clamp(2.5rem,7vw,6.6rem)] font-semibold text-cloud">
            A NATION CONNECTED BY WATER.
          </h2>
          <p className="mt-6 max-w-2xl text-base leading-relaxed text-cloud/70 sm:text-lg">
            Every monsoon, river, aquifer and agricultural field contributes to India&apos;s
            water story. Neerakshi reads that story across{" "}
            <span className="text-glacier">{formatNumber(data.districtCount)}</span>{" "}
            districts.
          </p>
          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-cloud/15 pt-6 sm:grid-cols-4">
            {[
              ["Districts", formatNumber(data.districtCount), "administrative units"],
              ["Monsoon years", `${data.latestYear - 2014}`, "2015 → " + data.latestYear],
              ["Rainfall departure", formatPercent(data.meanDeparturePct, 1), "district mean"],
              ["Monthly observations", formatNumber(data.monthlyObservations), "ERA5/POWER"],
            ].map(([label, value, note]) => (
              <div key={label} className="india-stat">
                <dt className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-muted">
                  {label}
                </dt>
                <dd className="mt-2 font-display text-2xl font-semibold text-cloud sm:text-3xl">
                  {value}
                </dd>
                <dd className="mt-1 text-[0.7rem] text-muted">{note}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <section className="scene-monsoon relative flex min-h-[100svh] items-center overflow-hidden border-t border-line/40">
        <div className="monsoon-bg absolute inset-0 bg-[radial-gradient(ellipse_at_20%_20%,#174456_0%,#071521_60%)]" />
        <div aria-hidden className="rain-layer pointer-events-none absolute inset-0 opacity-50" />
        <div className="monsoon-copy relative z-10 mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <p className="eyebrow">04 · The monsoon</p>
            <h2 className="display mt-5 text-[clamp(2.4rem,6vw,5.4rem)] font-semibold text-cloud">
              THE PULSE OF THE NATION
            </h2>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-cloud/65 sm:text-lg">
              June to September delivers most of India&apos;s annual rainfall. When the
              monsoon departs from its long-term rhythm, the consequences move through
              soil, crops and aquifers.
            </p>
            <div className="mt-8 flex items-center gap-3">
              <span className="chip">
                <Waves className="h-3 w-3" aria-hidden /> Reanalysis · NASA POWER
              </span>
              <span className="chip">2015 → {data.latestYear}</span>
            </div>
          </div>
          <div className="panel p-5 sm:p-7">
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="font-mono text-[0.6rem] uppercase tracking-[0.18em] text-muted">
                  National monsoon total
                </p>
                <p className="mt-1 font-display text-3xl font-semibold text-cloud">
                  {formatNumber(
                    data.monsoonSeries.at(-1)?.value
                      ? data.monsoonSeries.at(-1)!.value / 1000
                      : null,
                    2,
                  )}{" "}
                  <span className="text-sm font-normal text-muted">thousand mm</span>
                </p>
              </div>
              <span className="demo-badge">Reanalysis</span>
            </div>
            <div className="mt-4">
              <MonsoonBars series={data.monsoonSeries} height={220} compact />
            </div>
            <p className="mt-3 text-[0.68rem] leading-relaxed text-muted">
              Sum of district monsoon totals across {formatNumber(data.districtCount)}{" "}
              representative points. Reanalysis is not an IMD gauge observation.
            </p>
          </div>
        </div>
      </section>

      <section className="scene-ground relative min-h-[100svh] overflow-hidden border-t border-line/40 bg-[#08131b]">
        <div className="ground-copy relative z-20 mx-auto w-full max-w-[1500px] px-4 pb-10 pt-20 sm:px-6">
          <div className="max-w-2xl">
            <p className="eyebrow">05 · Beneath the surface</p>
            <h2 className="display mt-5 text-[clamp(2.4rem,6vw,5.4rem)] font-semibold text-cloud">
              THE WATER BELOW
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-cloud/65 sm:text-lg">
              Groundwater is the hidden reservoir that carries agriculture through dry
              months. Depth below ground is not the same as volume — and both matter.
            </p>
          </div>
        </div>

        <div className="ground-art relative mx-auto w-full max-w-[1500px] px-4 sm:px-6">
          <div className="relative h-[46vh] min-h-[320px] overflow-hidden rounded-3xl border border-line/70 bg-gradient-to-b from-[#174456] to-[#071521]">
            <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-[#1d5a4b] to-[#16413c]" />
            <div className="absolute inset-x-0 top-16 h-20 bg-[#33281d]/80" />
            <div className="absolute inset-x-0 top-36 h-24 bg-[#2a2118]/80" />
            <div className="absolute inset-x-0 bottom-0 top-60 bg-[radial-gradient(circle_at_50%_100%,#123548,#071521_75%)]" />
            <div className="absolute inset-0 opacity-30 [background-image:repeating-linear-gradient(180deg,transparent_0,transparent_38px,rgba(140,168,181,0.12)_39px,transparent_40px)]" />
            <div className="absolute left-6 top-4 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-mint/80">
              Surface
            </div>
            <div className="absolute left-6 top-24 font-mono text-[0.58rem] uppercase tracking-[0.18em] text-amber/70">
              Soil zone
            </div>
            <div className="water-table absolute inset-x-0 top-40 z-10">
              <div className="h-px w-full bg-glacier shadow-[0_0_24px_rgba(72,217,232,0.8)]" />
              <div className="mx-auto flex max-w-[1500px] items-center justify-between px-6 py-2">
                <span className="font-mono text-[0.58rem] uppercase tracking-[0.18em] text-glacier">
                  Pre-monsoon water table
                </span>
                <span className="mono text-xs text-glacier">
                  {data.meanGroundwaterDepthM?.toFixed(1) ?? "—"} m
                </span>
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-0 z-0 h-40 bg-gradient-to-t from-glacier/10 to-transparent" />
            <div className="absolute bottom-6 left-6 right-6 flex flex-wrap items-end justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                <span className="chip">CGWB schema · demo fixture</span>
                <span className="chip">Depth below ground</span>
              </div>
              <div className="rounded-xl border border-amber/30 bg-amber/5 px-3 py-2 text-right">
                <p className="font-mono text-[0.55rem] uppercase tracking-[0.16em] text-amber">
                  DEMO DATA
                </p>
                <p className="mt-1 max-w-[28rem] text-[0.65rem] leading-relaxed text-muted">
                  Groundwater values are synthetic fixtures until official CGWB files are
                  loaded. They are not observations.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative z-20 mx-auto mt-8 grid w-full max-w-[1500px] gap-4 px-4 pb-16 sm:grid-cols-3 sm:px-6">
          {[
            ["Mean pre-monsoon depth", `${data.meanGroundwaterDepthM?.toFixed(1) ?? "—"} m`, "demo fixture"],
            ["Mean irrigated share", `${data.meanIrrigatedSharePct?.toFixed(0) ?? "—"}%`, "demo fixture"],
            ["Severe-stress districts", formatNumber(data.stressClasses.Severe ?? 0), "composite index"],
          ].map(([label, value, note]) => (
            <div key={label} className="panel-flat px-5 py-4">
              <p className="font-mono text-[0.58rem] uppercase tracking-[0.16em] text-muted">
                {label}
              </p>
              <p className="mt-2 font-display text-2xl font-semibold text-cloud">{value}</p>
              <p className="mt-1 text-[0.65rem] text-amber/80">{note}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="scene-agri relative flex min-h-[100svh] items-center overflow-hidden border-t border-line/40">
        <div className="agri-bg absolute inset-0">
          <Image
            src="/images/crops/agriculture-tractor.jpg"
            alt="Aerial view of a tractor harvesting a large agricultural field"
            fill
            sizes="100vw"
            className="object-cover"
          />
        </div>
        <div className="absolute inset-0 bg-gradient-to-r from-midnight via-midnight/80 to-midnight/20" />
        <div className="agri-copy relative z-10 mx-auto w-full max-w-[1500px] px-4 py-24 sm:px-6">
          <p className="eyebrow">06 · The agricultural ecosystem</p>
          <h2 className="display mt-5 max-w-3xl text-[clamp(2.4rem,6vw,5.4rem)] font-semibold text-cloud">
            THE LAND THAT FEEDS
          </h2>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-cloud/65 sm:text-lg">
            Production, cultivated area and irrigation dependence describe different
            dimensions of the same agricultural water story.
          </p>
          <div className="mt-10 grid max-w-4xl grid-cols-2 gap-3 lg:grid-cols-4">
            {crops.map((crop) => (
              <article key={crop.crop} className="crop-card group relative overflow-hidden rounded-2xl border border-cloud/15">
                <div className="relative h-28 sm:h-32">
                  <Image
                    src={CROP_IMAGES[crop.crop] ?? "/images/crops/crop-rows.jpg"}
                    alt={crop.cropName}
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-700 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-midnight/90 to-transparent" />
                </div>
                <div className="absolute inset-x-0 bottom-0 p-3">
                  <p className="text-sm font-medium text-cloud">{crop.cropName}</p>
                  <p className="mono mt-0.5 text-[0.62rem] text-glacier">
                    {formatNumber(crop.productionTonnes / 1_000_000, 1)}M t
                  </p>
                  <p className="mt-1 font-mono text-[0.5rem] uppercase tracking-[0.14em] text-amber">
                    Demo fixture
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="scene-field relative flex min-h-[100svh] items-center overflow-hidden border-t border-line/40">
        <div className="field-bg absolute inset-0">
          <Image
            src="/images/crops/farmland-rows.jpg"
            alt="Aerial view of cultivated farmland rows"
            fill
            sizes="100vw"
            className="object-cover opacity-60"
          />
        </div>
        <div className="absolute inset-0 bg-midnight/60" />
        <div className="field-copy relative z-20 mx-auto grid w-full max-w-[1500px] gap-10 px-4 py-24 sm:px-6 lg:grid-cols-[1fr_0.85fr] lg:items-center">
          <div>
            <p className="eyebrow">07 · The individual field</p>
            <h2 className="display mt-5 max-w-3xl text-[clamp(2.4rem,6vw,5.2rem)] font-semibold text-cloud">
              FROM THE SKY TO YOUR FIELD.
            </h2>
            <p className="mt-6 max-w-xl text-base leading-relaxed text-cloud/70 sm:text-lg">
              Satellite intelligence and scientific water modelling, translated into
              practical irrigation decisions. This is the scale where water is actually
              applied — and where advice must be explainable.
            </p>
            <Link href="/advisor" className="btn-primary mt-8 text-sm">
              Open My Field Advisor
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </Link>
          </div>
          <div className="relative mx-auto w-full max-w-md">
            <div className="field-mask relative aspect-square overflow-hidden border border-glacier/30">
              <Image
                src="/images/crops/rice.jpg"
                alt="Paddy field with farmers and a tractor at the field edge"
                fill
                sizes="(max-width: 1024px) 80vw, 40vw"
                className="object-cover"
              />
              <div className="absolute inset-0 ring-1 ring-inset ring-glacier/30" />
            </div>
            <div className="absolute -left-3 top-1/2 -translate-y-1/2 rounded-md border border-glacier/30 bg-midnight/80 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-glacier">
              Sentinel-2 · 10 m
            </div>
            <div className="absolute -right-2 bottom-8 rounded-md border border-line bg-midnight/85 px-2 py-1 font-mono text-[0.55rem] uppercase tracking-[0.14em] text-muted">
              FAO-56 · water balance
            </div>
          </div>
        </div>
      </section>

      <section id="enter" className="relative border-t border-line/40 bg-midnight">
        <div className="mx-auto w-full max-w-[1500px] px-4 py-24 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">08 · Enter Neerakshi</p>
              <h2 className="display mt-4 text-[clamp(2.2rem,5vw,4.4rem)] font-semibold text-cloud">
                TWO EXPERIENCES.
                <br />
                ONE WATER SYSTEM.
              </h2>
            </div>
            <p className="max-w-md text-sm leading-relaxed text-muted">
              Move between national intelligence and the individual field. The same
              datasets, metrics and scientific definitions connect both.
            </p>
          </div>

          <div className="mt-12 grid gap-4 lg:grid-cols-2">
            <Link
              href="/atlas"
              className="group relative min-h-[340px] overflow-hidden rounded-3xl border border-line/70"
            >
              <Image
                src="/images/earth/india-satellite.jpg"
                alt="Satellite view of India under monsoon cloud"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover opacity-60 transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/50 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <span className="chip">
                  <Radar className="h-3 w-3" aria-hidden /> Intelligence atlas
                </span>
                <h3 className="display mt-4 text-3xl font-semibold text-cloud sm:text-4xl">
                  Explore the Water Intelligence Atlas
                </h3>
                <p className="mt-3 max-w-md text-sm text-cloud/65">
                  India&apos;s water-stress geography, monsoon departure, groundwater and
                  crop context at district scale.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm text-glacier">
                  Open atlas <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>

            <Link
              href="/advisor"
              className="group relative min-h-[340px] overflow-hidden rounded-3xl border border-line/70"
            >
              <Image
                src="/images/crops/rice.jpg"
                alt="Paddy field with a farmer and tractor"
                fill
                sizes="(max-width: 1024px) 100vw, 50vw"
                className="object-cover opacity-65 transition-transform duration-700 group-hover:scale-[1.04]"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-midnight via-midnight/55 to-transparent" />
              <div className="absolute inset-x-0 bottom-0 p-6 sm:p-8">
                <span className="chip">
                  <Droplets className="h-3 w-3" aria-hidden /> Field intelligence
                </span>
                <h3 className="display mt-4 text-3xl font-semibold text-cloud sm:text-4xl">
                  Open My Field Advisor
                </h3>
                <p className="mt-3 max-w-md text-sm text-cloud/65">
                  Draw a field, choose a crop, and receive an explainable FAO-56 irrigation
                  recommendation using live weather and Sentinel-2 context.
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-sm text-glacier">
                  Advise my field <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </span>
              </div>
            </Link>
          </div>

          <div className="mt-16 flex flex-col items-start justify-between gap-6 border-t border-line/50 pt-8 sm:flex-row sm:items-end">
            <div>
              <p className="font-display text-2xl font-semibold tracking-[0.14em] text-cloud">
                NEERAKSHI
              </p>
              <p className="mt-2 font-mono text-[0.6rem] uppercase tracking-[0.2em] text-muted">
                Every drop, seen from the sky.
              </p>
            </div>
            <div className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[0.6rem] uppercase tracking-[0.14em] text-muted">
              <Link href="/methods" className="hover:text-cloud">
                Methods & sources
              </Link>
              <Link href="/impact" className="hover:text-cloud">
                Advisory impact
              </Link>
              <span>Research prototype · {new Date().getFullYear()}</span>
            </div>
          </div>
          <p className="mt-6 max-w-3xl text-[0.65rem] leading-relaxed text-muted/80">
            Imagery: NASA Blue Marble, NASA ISS, NASA GIBS VIIRS, Unsplash (agriculture).
            Rainfall: NASA POWER / MERRA-2 reanalysis. Groundwater, irrigation and crop
            production layers are clearly labelled demo fixtures pending official source
            downloads. See Methods & Sources for provenance.
          </p>
        </div>
      </section>


    </div>
  );
}
