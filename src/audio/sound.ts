// Web Audio playback of Burgrix's synthesized sounds (public/game/sounds.json, synth.ts).
// Effects play once; a sector's ambience and the music loop until stopped.
import { renderSynth, type SynthSpec } from "./synth.ts";

const VOLUME_KEY = "burgrix.volume";

export class Sound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private buffers = new Map<string, AudioBuffer | Promise<AudioBuffer | null> | null>();
  private loops = new Map<string, AudioBufferSourceNode>();
  private specs: Record<string, SynthSpec> = {};
  private muted = false;
  /** the player's volume 0..1; Burgrix starts quiet */
  level = 0.2;

  constructor() {
    try {
      const v = Number(localStorage.getItem(VOLUME_KEY));
      if (localStorage.getItem(VOLUME_KEY) !== null && Number.isFinite(v)) this.level = Math.max(0, Math.min(1, v));
    } catch {
      /* storage blocked */
    }
  }

  setSpecs(specs: Record<string, SynthSpec>): void {
    this.specs = specs;
  }

  /** browsers start audio only after a user gesture */
  unlock(): void {
    if (!this.ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.apply();
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
  }

  setLevel(v: number): void {
    this.level = Math.max(0, Math.min(1, v));
    try {
      localStorage.setItem(VOLUME_KEY, String(this.level));
    } catch {
      /* storage blocked */
    }
    this.apply();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    this.apply();
  }

  private apply(): void {
    if (this.master) this.master.gain.value = this.muted ? 0 : this.level;
  }

  private load(name: string): Promise<AudioBuffer | null> | AudioBuffer | null {
    const have = this.buffers.get(name);
    if (have !== undefined) return have;
    const spec = this.specs[name];
    const ctx = this.ctx;
    if (!spec || !ctx) return null;
    // rendered off the frame, one sound per task
    const made = new Promise<AudioBuffer | null>((done) =>
      setTimeout(() => {
        try {
          const data = renderSynth(spec, ctx.sampleRate);
          const buf = ctx.createBuffer(1, data.length, ctx.sampleRate);
          buf.copyToChannel(data, 0);
          this.buffers.set(name, buf);
          done(buf);
        } catch {
          this.buffers.set(name, null);
          done(null);
        }
      }, 0),
    );
    this.buffers.set(name, made);
    return made;
  }

  /** renders the given sounds ahead of time */
  warm(names: string[]): void {
    if (this.ctx) for (const n of names) void this.load(n);
  }

  private start(name: string, loop: boolean, volume: number): void {
    const b = this.load(name);
    const go = (buf: AudioBuffer | null) => {
      if (!buf || !this.ctx || !this.master) return;
      if (loop && !this.loops.has(name)) return; // stopped while rendering
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.loop = loop;
      const g = this.ctx.createGain();
      g.gain.value = volume;
      src.connect(g);
      g.connect(this.master);
      src.start();
      if (loop) this.loops.set(name, src);
    };
    if (b instanceof Promise) void b.then(go);
    else go(b);
  }

  play(name: string, volume = 1): void {
    if (this.ctx) this.start(name, false, volume);
  }

  /** keeps exactly these loops running */
  setLoops(names: string[], volume = 1): void {
    for (const [n, src] of [...this.loops]) {
      if (names.includes(n)) continue;
      try {
        src.stop();
      } catch {
        /* not started yet */
      }
      this.loops.delete(n);
    }
    if (!this.ctx) return;
    for (const n of names) {
      if (this.loops.has(n)) continue;
      // placeholder until the buffer is ready, replaced in start()
      this.loops.set(n, this.ctx.createBufferSource());
      this.start(n, true, volume);
    }
  }
}
