/**
 * Optional procedural ambience (Web Audio, no audio files): wind (filtered
 * noise), rain (band-passed noise with a little crackle) and a distant bird
 * at dawn (short frequency sweeps). Muted by default; created only after the
 * user turns it on (browsers require a gesture).
 */
export class Ambience {
  private ctx: AudioContext;
  private wind: GainNode;
  private rain: GainNode;
  private master: GainNode;
  private birdTimer: number | null = null;

  constructor() {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.6;
    this.master.connect(this.ctx.destination);
    const noise = this.noiseBuffer();
    this.wind = this.noiseVoice(noise, "lowpass", 400, 0.7);
    this.rain = this.noiseVoice(noise, "bandpass", 2400, 0.9);
  }

  private noiseBuffer() {
    const len = this.ctx.sampleRate * 3;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      last = (last + 0.02 * white) / 1.02; // brown-ish
      d[i] = last * 3.5 + white * 0.15;
    }
    return buf;
  }

  private noiseVoice(buf: AudioBuffer, type: BiquadFilterType, freq: number, q: number) {
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(this.master);
    src.start();
    return g;
  }

  /** Set levels from the journey state: wind 0–1, rain 0–1, dawn toggles birds. */
  set(wind: number, rain: number, dawn: boolean) {
    const t = this.ctx.currentTime;
    this.wind.gain.setTargetAtTime(0.25 * wind, t, 0.4);
    this.rain.gain.setTargetAtTime(0.35 * rain, t, 0.4);
    if (dawn && this.birdTimer === null) this.scheduleBird();
    if (!dawn && this.birdTimer !== null) {
      window.clearTimeout(this.birdTimer);
      this.birdTimer = null;
    }
  }

  private scheduleBird() {
    this.birdTimer = window.setTimeout(() => {
      this.chirp();
      this.scheduleBird();
    }, 2500 + Math.random() * 4000);
  }

  private chirp() {
    const t = this.ctx.currentTime;
    for (let i = 0; i < 3; i++) {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = "sine";
      const s = t + i * 0.14;
      o.frequency.setValueAtTime(2600, s);
      o.frequency.exponentialRampToValueAtTime(4200, s + 0.08);
      g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(0.03, s + 0.02);
      g.gain.linearRampToValueAtTime(0, s + 0.1);
      o.connect(g).connect(this.master);
      o.start(s);
      o.stop(s + 0.12);
    }
  }

  resume() {
    return this.ctx.resume();
  }

  close() {
    if (this.birdTimer !== null) window.clearTimeout(this.birdTimer);
    void this.ctx.close();
  }
}
