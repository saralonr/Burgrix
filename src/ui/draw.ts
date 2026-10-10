// Burgrix's drawing kit: palette, colour helpers, isometric projection, outlined
// shapes and text. Everything on screen is drawn with these on a 2D canvas.

export type Ctx = CanvasRenderingContext2D;
export type Pt = [number, number];

export const W = 960;
export const H = 600;
export const FONT = "Nunito, 'Trebuchet MS', Arial, sans-serif";

export const C = {
  ink: "#3a2618",
  cream: "#fff4dd",
  paper: "#fbe9c6",
  bun: "#e7a24f",
  bunDark: "#b8732f",
  ketchup: "#d8432f",
  mustard: "#f2b631",
  lettuce: "#7cc04b",
  pickle: "#4f8f3a",
  grass: "#9ccf62",
  grassDark: "#6faa45",
  soil: "#a8744a",
  soilDark: "#7c5333",
  sand: "#e8cf8e",
  wood: "#c98b52",
  woodDark: "#93603a",
  stone: "#c9c2b6",
  steel: "#a9b7bf",
  sky: "#bfe3f0",
  sea: "#3b9dc4",
  seaDeep: "#24739a",
  ice: "#f4fbff",
  night: "#2b1d14",
  white: "#ffffff",
  shadow: "rgba(58,38,24,0.22)",
  good: "#53a83c",
  bad: "#d8432f",
  warn: "#f2b631",
  plum: "#8a4f9e",
  blue: "#3f7fc1",
  teal: "#3aa39b",
  pink: "#f19bb0",
};

// ---- colours

function hex(c: string): [number, number, number] {
  const h = c.replace("#", "");
  const n = parseInt(h.length === 3 ? h.replace(/./g, (x) => x + x) : h, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("");

export function mix(a: string, b: string, t: number): string {
  const x = hex(a);
  const y = hex(b);
  return toHex(x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t);
}
/** k > 0 lightens towards white, k < 0 darkens towards the ink */
export const shade = (c: string, k: number): string => (k >= 0 ? mix(c, "#ffffff", k) : mix(c, "#2a1a10", -k));
export const alpha = (c: string, a: number): string => {
  const [r, g, b] = hex(c);
  return `rgba(${r},${g},${b},${a})`;
};

// ---- paths

export function path(ctx: Ctx, pts: Pt[], close = true): void {
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  if (close) ctx.closePath();
}

export function paint(ctx: Ctx, fill: string | null, lw = 2, stroke: string = C.ink): void {
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (lw > 0) {
    ctx.lineWidth = lw;
    ctx.strokeStyle = stroke;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.stroke();
  }
}

export function poly(ctx: Ctx, pts: Pt[], fill: string | null, lw = 2, stroke: string = C.ink): void {
  path(ctx, pts);
  paint(ctx, fill, lw, stroke);
}

export function line(ctx: Ctx, pts: Pt[], color: string = C.ink, lw = 2): void {
  path(ctx, pts, false);
  paint(ctx, null, lw, color);
}

export function rrect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const k = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + k, y);
  ctx.arcTo(x + w, y, x + w, y + h, k);
  ctx.arcTo(x + w, y + h, x, y + h, k);
  ctx.arcTo(x, y + h, x, y, k);
  ctx.arcTo(x, y, x + w, y, k);
  ctx.closePath();
}

export function box(ctx: Ctx, x: number, y: number, w: number, h: number, r: number, fill: string | null, lw = 2, stroke: string = C.ink): void {
  rrect(ctx, x, y, w, h, r);
  paint(ctx, fill, lw, stroke);
}

export function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, fill: string | null, lw = 2, stroke: string = C.ink): void {
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), 0, 0, Math.PI * 2);
  paint(ctx, fill, lw, stroke);
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill: string | null, lw = 2, stroke: string = C.ink): void {
  oval(ctx, x, y, r, r, fill, lw, stroke);
}

export function shadow(ctx: Ctx, x: number, y: number, rx: number, ry = rx * 0.45): void {
  oval(ctx, x, y, rx, ry, C.shadow, 0);
}

// ---- isometric projection (2:1); x runs to the lower right, y to the lower left

export class Iso {
  constructor(
    public ox: number,
    public oy: number,
    /** screen pixels per world unit along x / y (half tile width) */
    public k = 32,
  ) {}
  p(x: number, y: number, z = 0): Pt {
    return [this.ox + (x - y) * this.k, this.oy + (x + y) * this.k * 0.5 - z];
  }
  /** screen point → ground (z = 0) */
  ground(sx: number, sy: number): Pt {
    const a = (sx - this.ox) / this.k;
    const b = ((sy - this.oy) * 2) / this.k;
    return [(a + b) / 2, (b - a) / 2];
  }
  /** ground rectangle */
  quad(x: number, y: number, w: number, d: number, z = 0): Pt[] {
    return [this.p(x, y, z), this.p(x + w, y, z), this.p(x + w, y + d, z), this.p(x, y + d, z)];
  }
}

export interface BoxStyle {
  top?: string;
  left?: string;
  right?: string;
  lw?: number;
}

/** a solid block: the top, the face looking to the lower left (y + d) and the one to the lower right (x + w) */
export function isoBox(ctx: Ctx, iso: Iso, x: number, y: number, z: number, w: number, d: number, h: number, color: string, s: BoxStyle = {}): void {
  const lw = s.lw ?? 2;
  const P = (a: number, b: number, c: number) => iso.p(a, b, c);
  poly(ctx, [P(x, y + d, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x, y + d, z + h)], s.left ?? shade(color, -0.12), lw);
  poly(ctx, [P(x + w, y, z), P(x + w, y + d, z), P(x + w, y + d, z + h), P(x + w, y, z + h)], s.right ?? shade(color, -0.26), lw);
  poly(ctx, iso.quad(x, y, w, d, z + h), s.top ?? shade(color, 0.08), lw);
}

/** an upright cylinder standing on (x, y) */
export function cylinder(ctx: Ctx, cx: number, cy: number, rx: number, h: number, color: string, lw = 2): void {
  const ry = rx * 0.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI);
  ctx.lineTo(cx - rx, cy - h);
  ctx.ellipse(cx, cy - h, rx, ry, 0, Math.PI, 0, true);
  ctx.closePath();
  const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  g.addColorStop(0, shade(color, -0.05));
  g.addColorStop(0.35, shade(color, 0.18));
  g.addColorStop(1, shade(color, -0.3));
  paint(ctx, null, 0);
  ctx.fillStyle = g;
  ctx.fill();
  paint(ctx, null, lw);
  oval(ctx, cx, cy - h, rx, ry, shade(color, 0.12), lw);
}

// ---- text

export interface TextStyle {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  base?: CanvasTextBaseline;
  weight?: number;
  outline?: string;
  outlineWidth?: number;
  max?: number;
}

export function font(size: number, weight = 700): string {
  return `${weight} ${size}px ${FONT}`;
}

export function text(ctx: Ctx, s: string, x: number, y: number, st: TextStyle = {}): void {
  ctx.font = font(st.size ?? 14, st.weight ?? 700);
  ctx.textAlign = st.align ?? "left";
  ctx.textBaseline = st.base ?? "middle";
  if (st.outline) {
    ctx.lineWidth = st.outlineWidth ?? 4;
    ctx.strokeStyle = st.outline;
    ctx.lineJoin = "round";
    ctx.strokeText(s, x, y, st.max);
  }
  ctx.fillStyle = st.color ?? C.ink;
  ctx.fillText(s, x, y, st.max);
}

export function measure(ctx: Ctx, s: string, size: number, weight = 700): number {
  ctx.font = font(size, weight);
  return ctx.measureText(s).width;
}

/** splits a text into lines no wider than max; "\n" starts a new paragraph */
export function wrap(ctx: Ctx, s: string, max: number, size: number, weight = 600): string[] {
  ctx.font = font(size, weight);
  const out: string[] = [];
  for (const para of s.split("\n")) {
    let cur = "";
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const next = cur ? cur + " " + word : word;
      if (ctx.measureText(next).width > max && cur) {
        out.push(cur);
        cur = word;
      } else cur = next;
    }
    out.push(cur);
  }
  return out;
}

/** text block, returns its height */
export function paragraph(ctx: Ctx, s: string, x: number, y: number, max: number, st: TextStyle & { lh?: number } = {}): number {
  const size = st.size ?? 14;
  const lh = st.lh ?? Math.round(size * 1.35);
  const lines = wrap(ctx, s, max, size, st.weight ?? 600);
  lines.forEach((l, i) => text(ctx, l, x, y + i * lh, { ...st, base: "top", weight: st.weight ?? 600 }));
  return lines.length * lh;
}

export const fmt = (n: number, lang: string): string => Math.round(n).toLocaleString(lang === "tr" ? "tr-TR" : "en-US");

// ---- small helpers

export const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const ease = (t: number): number => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
/** a stable pseudo random number 0..1 for an integer key */
export function hash(n: number): number {
  let x = (n | 0) * 374761393 + 668265263;
  x = (x ^ (x >>> 13)) * 1274126177;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}
