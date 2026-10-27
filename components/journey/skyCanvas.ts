import { altAz, bvToRgb, localSiderealDeg, moonPhase } from "@/lib/astro";

export type SkyData = { stars: [number, number, number, number][]; lines: [number, number][][] };

/**
 * One shared <canvas> for the journey: real stars (300 brightest, positioned
 * for the viewer's latitude/longitude and the current time), constellation
 * figures, the current Moon phase, and rain particles. Device pixel ratio is
 * capped; the loop pauses when the tab is hidden or the canvas is off-screen.
 */
export class SkyCanvas {
  private ctx: CanvasRenderingContext2D;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private raf = 0;
  private running = false;
  private visible = true;
  private projected: { x: number; y: number; r: number; c: string; tw: number }[] = [];
  private segs: [number, number, number, number][] = [];
  private drops: { x: number; y: number; v: number; l: number }[] = [];
  starAlpha = 1;
  rain = 0; // 0..1 intensity
  moon = moonPhase(new Date());
  private io: IntersectionObserver | null = null;

  constructor(
    private canvas: HTMLCanvasElement,
    private sky: SkyData | null,
    private lat: number,
    private lon: number,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.resize();
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.onVis);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.start();
    });
    this.io.observe(canvas);
  }

  setLocation(lat: number, lon: number) {
    this.lat = lat;
    this.lon = lon;
    this.project();
  }

  setSky(sky: SkyData) {
    this.sky = sky;
    this.project();
  }

  private onVis = () => {
    if (document.hidden) this.stop();
    else this.start();
  };

  resize = () => {
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    this.w = this.canvas.clientWidth;
    this.h = this.canvas.clientHeight;
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.project();
    const n = Math.round(Math.min(260, (this.w * this.h) / 5000));
    this.drops = Array.from({ length: n }, () => this.newDrop(true));
  };

  /** Stereographic all-sky projection centred on the zenith; the horizon circle is larger than the screen so we look up into the sky. */
  private project() {
    if (!this.sky || !this.w) return;
    const lst = localSiderealDeg(new Date(), this.lon);
    const R = Math.max(this.w, this.h) * 0.95;
    const cx = this.w / 2;
    const cy = this.h * 0.55;
    const toXY = (ra: number, dec: number) => {
      const { alt, az } = altAz(ra, dec, this.lat, lst);
      if (alt < -2) return null;
      const r = R * Math.tan(((90 - alt) * Math.PI) / 360);
      const a = (az * Math.PI) / 180;
      return { x: cx - r * Math.sin(a), y: cy - r * Math.cos(a) };
    };
    this.projected = [];
    for (const [ra, dec, mag, bv] of this.sky.stars) {
      const p = toXY(ra, dec);
      if (!p || p.x < -10 || p.x > this.w + 10 || p.y < -10 || p.y > this.h + 10) continue;
      this.projected.push({ x: p.x, y: p.y, r: Math.max(0.5, 2.6 - mag * 0.55), c: bvToRgb(bv), tw: Math.random() * Math.PI * 2 });
    }
    this.segs = [];
    for (const line of this.sky.lines) {
      for (let i = 0; i < line.length - 1; i++) {
        const a = toXY(line[i][0], line[i][1]);
        const b = toXY(line[i + 1][0], line[i + 1][1]);
        if (a && b) this.segs.push([a.x, a.y, b.x, b.y]);
      }
    }
  }

  private newDrop(anywhere = false) {
    return { x: Math.random() * (this.w + 100) - 50, y: anywhere ? Math.random() * this.h : -20 - Math.random() * 100, v: 9 + Math.random() * 7, l: 10 + Math.random() * 12 };
  }

  start() {
    if (this.running || document.hidden || !this.visible) return;
    this.running = true;
    const loop = (t: number) => {
      if (!this.running) return;
      this.draw(t);
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  destroy() {
    this.stop();
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.onVis);
    this.io?.disconnect();
  }

  private draw(t: number) {
    const { ctx } = this;
    ctx.clearRect(0, 0, this.w, this.h);
    if (this.starAlpha > 0.01) {
      ctx.globalAlpha = this.starAlpha * 0.28;
      ctx.strokeStyle = "rgb(243,235,216)";
      ctx.lineWidth = 0.6;
      ctx.beginPath();
      for (const [x1, y1, x2, y2] of this.segs) {
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.stroke();
      for (const s of this.projected) {
        const tw = 0.75 + 0.25 * Math.sin(t / 900 + s.tw);
        ctx.globalAlpha = this.starAlpha * tw;
        ctx.fillStyle = `rgb(${s.c})`;
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      this.drawMoon();
      ctx.globalAlpha = 1;
    }
    if (this.rain > 0.01) {
      const n = Math.round(this.drops.length * this.rain);
      ctx.globalAlpha = 0.55 * Math.min(1, this.rain * 1.5);
      ctx.strokeStyle = "rgb(94,110,126)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const d = this.drops[i];
        d.y += d.v;
        d.x -= d.v * 0.18;
        if (d.y > this.h + 20) Object.assign(d, this.newDrop());
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x + d.l * 0.18, d.y - d.l);
      }
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  /** Moon disc with the terminator for the current phase (position is decorative; the phase is real). */
  private drawMoon() {
    const { ctx } = this;
    const r = Math.max(10, Math.min(this.w, this.h) * 0.028);
    const x = this.w * 0.78;
    const y = this.h * 0.2;
    const p = this.moon;
    ctx.save();
    ctx.globalAlpha = this.starAlpha * 0.95;
    ctx.fillStyle = "rgba(243,235,216,0.12)";
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgb(243,235,216)";
    ctx.beginPath();
    const waxing = p < 0.5;
    const k = Math.cos(p * 2 * Math.PI); // 1 new, -1 full
    ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
    ctx.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, waxing ? k > 0 : k < 0);
    ctx.fill();
    ctx.restore();
  }
}
