"use client";

import { useEffect, useRef } from "react";

export function Starfield({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let raf = 0;
    let width = 0;
    let height = 0;
    let stars: { x: number; y: number; r: number; a: number; speed: number }[] = [];

    function resize() {
      if (!canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * dpr;
      canvas.height = height * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round((width * height) / 9000);
      stars = Array.from({ length: Math.min(count, 260) }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        r: Math.random() * 1.15 + 0.2,
        a: Math.random() * 0.55 + 0.15,
        speed: Math.random() * 0.04 + 0.01,
      }));
      if (reduce) {
        draw(0);
      }
    }

    function draw(time: number) {
      if (!ctx) return;
      ctx.clearRect(0, 0, width, height);
      for (const star of stars) {
        if (!reduce) {
          star.y += star.speed;
          if (star.y > height) star.y = 0;
        }
        const twinkle = reduce ? 1 : 0.75 + Math.sin(time * 0.0006 + star.x) * 0.25;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(214, 242, 246, ${star.a * twinkle})`;
        ctx.fill();
      }
    }

    function loop(time: number) {
      draw(time);
      raf = requestAnimationFrame(loop);
    }

    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    if (!reduce) raf = requestAnimationFrame(loop);
    const onVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(raf);
      } else if (!reduce) {
        raf = requestAnimationFrame(loop);
      }
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  return <canvas ref={ref} aria-hidden="true" className={className} />;
}
