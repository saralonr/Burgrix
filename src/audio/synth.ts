// Burgrix's sounds, synthesized when the game starts (public/game/sounds.json).
// A sound is a list of events played by small instruments; songs are written as
// note sequences per track.
//
//   { "dur": 0.1, "gain": 0.8, "events": [{ "i": "marimba", "n": "C6", "t": 0, "d": 0.08 }] }
//   { "bpm": 112, "beats": 32, "gain": 0.6, "echo": { "time": 0.32, "fb": 0.3, "mix": 0.25 },
//     "tracks": [{ "i": "marimba", "v": 0.7, "seq": "E5/2 G5/2 C6 - C5+E5+G5*2 | ..." }] }
//
// seq tokens: a note (C4, F#5, Bb3), several joined by + (chord), - (rest) or x (a
// hit for drums); /k shortens to 1/k beat, *k lengthens to k beats; | is ignored.
// Event fields: i instrument, n note or f frequency (Hz), f2 end frequency (slides),
// t start (s), d length (s), v volume, and for noise lp (cut-off Hz) and lfo (Hz).

export interface SynthEvent {
  i: string;
  n?: string;
  f?: number;
  f2?: number;
  t: number;
  d: number;
  v?: number;
  lp?: number;
  lfo?: number;
  /** generators: how many and a seed */
  count?: number;
  seed?: number;
}
export interface SynthTrack {
  i: string;
  v?: number;
  seq: string;
  /** play the sequence this many times */
  repeat?: number;
}
export interface SynthSpec {
  dur?: number;
  gain?: number;
  bpm?: number;
  beats?: number;
  events?: SynthEvent[];
  tracks?: SynthTrack[];
  echo?: { time: number; fb: number; mix: number };
}

const NOTE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
export function noteHz(n: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(n.trim());
  if (!m) return 440;
  const semis = NOTE[m[1]!]! + (m[2] === "#" ? 1 : m[2] === "b" ? -1 : 0) + (Number(m[3]) + 1) * 12;
  return 440 * Math.pow(2, (semis - 69) / 12);
}

function rng(seed: number): () => number {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 100000) / 100000;
  };
}

const TAU = Math.PI * 2;

/** adds one note of an instrument into the buffer */
function play(out: Float32Array, sr: number, e: SynthEvent): void {
  const f0 = e.f ?? (e.n ? noteHz(e.n) : 440);
  const f1 = e.f2 ?? f0;
  const v = e.v ?? 1;
  const start = Math.floor(e.t * sr);
  const n = Math.floor(e.d * sr);
  const rnd = rng(e.seed ?? Math.floor(f0 * 7 + e.t * 1000));
  let phase = 0;
  let ph2 = 0;
  let lp = 0;
  let prev = 0;
  const tail = (k: number) => Math.min(1, (n - k) / (sr * 0.01)); // 10 ms release, no clicks
  const attack = (k: number, a = 0.004) => Math.min(1, k / (sr * a));
  for (let k = 0; k < n; k++) {
    const idx = start + k;
    if (idx < 0 || idx >= out.length) continue;
    const t = k / sr;
    const p = k / Math.max(1, n);
    const f = f0 + (f1 - f0) * p;
    phase += (TAU * f) / sr;
    let s = 0;
    switch (e.i) {
      case "marimba": {
        const env = Math.exp(-t / 0.22) * attack(k, 0.002);
        s = (Math.sin(phase) + 0.3 * Math.sin(phase * 4) * Math.exp(-t / 0.04)) * env;
        break;
      }
      case "bell": {
        const env = Math.exp(-t / 0.55) * attack(k, 0.002);
        s = (Math.sin(phase) + 0.45 * Math.sin(phase * 2.76) * Math.exp(-t / 0.25) + 0.2 * Math.sin(phase * 5.4) * Math.exp(-t / 0.1)) * env * 0.7;
        break;
      }
      case "pluck": {
        const env = Math.exp(-t / 0.18) * attack(k, 0.002);
        const tri = (2 / Math.PI) * Math.asin(Math.sin(phase));
        s = (tri * 0.8 + 0.2 * Math.sin(phase * 2)) * env;
        break;
      }
      case "pad": {
        const env = Math.min(1, t / 0.25) * Math.min(1, (e.d - t) / 0.35);
        s = (Math.sin(phase) + 0.35 * Math.sin(phase * 2.004) + 0.15 * Math.sin(phase * 3.01)) * env * 0.5;
        break;
      }
      case "bass": {
        const env = Math.exp(-t / 0.35) * attack(k, 0.005);
        s = (Math.sin(phase) + 0.25 * Math.sin(phase * 2)) * env;
        break;
      }
      case "square": {
        // soft square: odd harmonics only, short decay (cheerful chiptune)
        const env = Math.exp(-t / 0.3) * attack(k);
        s = (Math.sin(phase) + Math.sin(phase * 3) / 3 + Math.sin(phase * 5) / 5) * env * 0.6;
        break;
      }
      case "trombone": {
        // brassy and wobbly, for the comic bankruptcy jingle
        const vib = 1 + 0.012 * Math.sin(TAU * 5.5 * t) * Math.min(1, t / 0.3);
        phase += ((TAU * f) / sr) * (vib - 1);
        const env = Math.min(1, t / 0.04) * Math.min(1, (e.d - t) / 0.12);
        let h = 0;
        for (let j = 1; j <= 7; j++) h += Math.sin(phase * j) / (j * 0.9);
        s = h * env * 0.32;
        break;
      }
      case "kick": {
        const fk = 140 * Math.exp(-t / 0.05) + 48;
        ph2 += (TAU * fk) / sr;
        s = Math.sin(ph2) * Math.exp(-t / 0.12);
        break;
      }
      case "snare":
      case "hat": {
        const w = rnd() * 2 - 1;
        const hp = w - prev; // a little brighter
        prev = w;
        s = e.i === "hat" ? hp * Math.exp(-t / 0.03) * 0.5 : (w * 0.6 + Math.sin(TAU * 190 * t) * 0.4) * Math.exp(-t / 0.08);
        break;
      }
      case "noise": {
        // soft filtered noise with a slow swell: waves, wind, frying, crowds
        const w = rnd() * 2 - 1;
        const a = 1 - Math.exp((-TAU * (e.lp ?? 800)) / sr);
        lp += a * (w - lp);
        const swell = e.lfo ? 0.55 + 0.45 * Math.sin(TAU * e.lfo * t - Math.PI / 2) : 1;
        const env = Math.min(1, t / 0.15) * Math.min(1, (e.d - t) / 0.15);
        s = lp * swell * env * 2.2;
        break;
      }
      case "slide": {
        // sine glide f -> f2: boings, whooshes, pops
        const env = Math.min(1, t / 0.005) * Math.min(1, (e.d - t) / 0.03);
        s = Math.sin(phase) * env * (1 - 0.4 * p);
        break;
      }
      case "boing": {
        const wob = 1 + 0.25 * Math.sin(TAU * 18 * t) * Math.exp(-t / 0.15);
        phase += ((TAU * f) / sr) * (wob - 1);
        s = Math.sin(phase) * Math.exp(-t / 0.25) * attack(k);
        break;
      }
      case "whirr": {
        // small motor: buzzy tone gliding f -> f2 plus a little noise
        const env = Math.min(1, t / 0.05) * Math.min(1, (e.d - t) / 0.08);
        s = (Math.sin(phase) * 0.6 + Math.sin(phase * 2) * 0.25 + (rnd() * 2 - 1) * 0.08) * env * 0.6;
        break;
      }
      case "moo": {
        // a cartoon cow: low buzzy voice with a rising-falling "mooo"
        const contour = 1 + 0.18 * Math.sin(Math.PI * Math.min(1, p * 1.3)) - 0.12 * p;
        phase += ((TAU * f) / sr) * (contour - 1);
        const env = Math.min(1, t / 0.12) * Math.min(1, (e.d - t) / 0.2);
        let h = 0;
        for (let j = 1; j <= 10; j++) h += (Math.sin(phase * j) / j) * (j >= 3 && j <= 6 ? 1.6 : 1); // "oo" formant
        s = h * env * 0.28;
        break;
      }
      case "thud": {
        const ft = 90 * Math.exp(-t / 0.08) + 40;
        ph2 += (TAU * ft) / sr;
        s = (Math.sin(ph2) * 0.8 + (rnd() * 2 - 1) * 0.25 * Math.exp(-t / 0.02)) * Math.exp(-t / 0.14);
        break;
      }
    }
    out[idx]! += s * v * tail(k);
  }
}

/** generators: many small events from one line */
function expand(e: SynthEvent): SynthEvent[] {
  const r = rng(e.seed ?? 7);
  const out: SynthEvent[] = [];
  const count = e.count ?? 6;
  const at = () => e.t + r() * Math.max(0.01, e.d - 0.3);
  switch (e.i) {
    case "birds":
      for (let k = 0; k < count; k++) {
        const t = at();
        const base = 2600 + r() * 1800;
        const notes = 2 + Math.floor(r() * 3);
        for (let j = 0; j < notes; j++) out.push({ i: "slide", f: base, f2: base * (1.25 + r() * 0.3), t: t + j * 0.09, d: 0.06, v: (e.v ?? 0.3) * (0.6 + r() * 0.4) });
      }
      return out;
    case "babble":
      // cheerful gibberish voices, like little characters talking
      for (let k = 0; k < count; k++) {
        const t = e.t + (k / count) * e.d + r() * 0.05;
        const base = (e.f ?? 300) * (0.8 + r() * 0.6);
        out.push({ i: "slide", f: base, f2: base * (0.85 + r() * 0.4), t, d: 0.05 + r() * 0.05, v: (e.v ?? 0.4) * (0.6 + r() * 0.4) });
      }
      return out;
    case "typing":
      for (let k = 0; k < count; k++) out.push({ i: "marimba", f: 1800 + r() * 900, t: e.t + (k / count) * e.d + r() * 0.03, d: 0.03, v: (e.v ?? 0.4) * (0.5 + r() * 0.5) });
      return out;
    case "clinks":
      for (let k = 0; k < count; k++) out.push({ i: "bell", f: 2200 + r() * 1600, t: at(), d: 0.25, v: (e.v ?? 0.2) * (0.5 + r() * 0.5) });
      return out;
  }
  return [e];
}

const TOKEN = /^([A-Gb#0-9+\-x]+)(?:\/(\d+(?:\.\d+)?)|\*(\d+(?:\.\d+)?))?$/;

/** turns a track's note sequence into events */
export function sequence(tr: SynthTrack, bpm: number): SynthEvent[] {
  const beat = 60 / bpm;
  const out: SynthEvent[] = [];
  let t = 0;
  const tokens = tr.seq.split(/\s+/).filter((x) => x && x !== "|");
  for (let r = 0; r < (tr.repeat ?? 1); r++)
    for (const tok of tokens) {
      const m = TOKEN.exec(tok);
      if (!m) continue;
      const len = beat * (m[2] ? 1 / Number(m[2]) : m[3] ? Number(m[3]) : 1);
      if (m[1] !== "-")
        for (const n of m[1]!.split("+")) {
          const drum = n === "x";
          out.push({ i: tr.i, n: drum ? undefined : n, f: drum ? 200 : undefined, t, d: ["pad", "trombone"].includes(tr.i) ? len * 0.98 : Math.max(len, 0.5), v: tr.v ?? 1 });
        }
      t += len;
    }
  return out;
}

/** renders a sound to mono samples */
export function renderSynth(spec: SynthSpec, sr: number): Float32Array<ArrayBuffer> {
  const events: SynthEvent[] = [...(spec.events ?? []).flatMap(expand)];
  let dur = spec.dur ?? 0;
  if (spec.tracks) {
    const bpm = spec.bpm ?? 120;
    for (const tr of spec.tracks) events.push(...sequence(tr, bpm));
    if (spec.beats) dur = Math.max(dur, (spec.beats * 60) / bpm);
  }
  for (const e of events) if (!spec.beats) dur = Math.max(dur, e.t + e.d);
  const len = Math.max(1, Math.ceil(dur * sr));
  // songs loop: render a tail and fold it onto the start so the loop is seamless
  const full = new Float32Array(len + (spec.beats ? 2 * sr : 0));
  for (const e of events) play(full, sr, e);
  const out = full.slice(0, len);
  if (spec.beats) for (let k = len; k < full.length; k++) out[(k - len) % len] = out[(k - len) % len]! + full[k]!;
  if (spec.echo) {
    const d = Math.floor(spec.echo.time * sr);
    const wet = new Float32Array(out.length);
    for (let k = 0; k < out.length; k++) wet[k] = out[k]! + (k >= d ? wet[k - d]! * spec.echo.fb : 0);
    for (let k = 0; k < out.length; k++) out[k] = out[k]! + (wet[k]! - out[k]!) * spec.echo.mix;
  }
  let peak = 0;
  for (const s of out) peak = Math.max(peak, Math.abs(s));
  const g = peak > 0 ? (spec.gain ?? 0.8) / peak : 0;
  for (let k = 0; k < out.length; k++) out[k] = out[k]! * g;
  return out;
}
