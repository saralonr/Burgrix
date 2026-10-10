// Buttons, panels, bars and bubbles shared by the HUD, the action row and windows.
import { C, type Ctx, box, circle, line, measure, rrect, paint, shade, text } from "./draw.ts";
import { drawIcon } from "./icons.ts";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
export const inside = (r: Rect, x: number, y: number): boolean => x >= r.x && y >= r.y && x <= r.x + r.w && y <= r.y + r.h;

export function panel(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string = C.cream, r = 12): void {
  box(ctx, x + 2, y + 4, w, h, r, "rgba(58,38,24,0.25)", 0);
  box(ctx, x, y, w, h, r, fill, 2.5);
}

/** a chunky button; hover lifts it */
export function button(ctx: Ctx, r: Rect, label: string, o: { hover?: boolean; color?: string; icon?: string; disabled?: boolean; size?: number } = {}): void {
  const col = o.disabled ? "#b9ab98" : (o.color ?? C.mustard);
  const lift = o.hover && !o.disabled ? 2 : 0;
  box(ctx, r.x, r.y + 3, r.w, r.h, 10, shade(col, -0.35), 2.5);
  box(ctx, r.x, r.y - lift, r.w, r.h, 10, o.hover && !o.disabled ? shade(col, 0.12) : col, 2.5);
  rrect(ctx, r.x + 5, r.y - lift + 4, r.w - 10, r.h * 0.32, 6);
  paint(ctx, "rgba(255,255,255,0.28)", 0);
  const size = o.size ?? 16;
  const iw = o.icon ? size + 6 : 0;
  const tw = label ? measure(ctx, label, size, 800) : 0;
  const sx = r.x + (r.w - iw - tw) / 2;
  if (o.icon) drawIcon(ctx, o.icon, sx + size / 2, r.y + r.h / 2 - lift, size + 2);
  if (label) text(ctx, label, sx + iw + tw / 2, r.y + r.h / 2 - lift + 1, { size, weight: 800, align: "center", color: o.disabled ? "#7b6c5a" : C.ink, max: r.w - 12 });
}

/** a square tile with an icon, used by the action row */
export function tile(ctx: Ctx, x: number, y: number, s: number, icon: string, o: { hover?: boolean; on?: boolean; disabled?: boolean; t?: number } = {}): void {
  const lift = o.hover && !o.disabled ? 3 : 0;
  box(ctx, x - s / 2, y - s / 2 + 3, s, s, 11, "rgba(58,38,24,0.45)", 0);
  box(ctx, x - s / 2, y - s / 2 - lift, s, s, 11, o.disabled ? "#d9cdb9" : o.hover ? "#fffaf0" : C.cream, 2.5);
  ctx.save();
  if (o.disabled) ctx.globalAlpha = 0.45;
  drawIcon(ctx, icon, x, y - lift, s * 0.62, o.t ?? 0);
  ctx.restore();
  if (o.on !== undefined) lamp(ctx, x + s / 2 - 6, y - s / 2 + 6 - lift, o.on);
}

export function lamp(ctx: Ctx, x: number, y: number, on: boolean, r = 5.5): void {
  if (on) circle(ctx, x, y, r + 3, "rgba(124,192,75,0.35)", 0);
  circle(ctx, x, y, r, on ? "#6ddc4a" : "#8d8478", 2);
  circle(ctx, x - r * 0.3, y - r * 0.3, r * 0.3, "rgba(255,255,255,0.7)", 0);
}

/** a switch label: ON/OFF pill */
export function pill(ctx: Ctx, x: number, y: number, label: string, color: string, o: { size?: number; align?: "left" | "center" | "right" } = {}): number {
  const size = o.size ?? 12;
  const w = measure(ctx, label, size, 800) + 14;
  const left = o.align === "right" ? x - w : o.align === "left" ? x : x - w / 2;
  box(ctx, left, y - size * 0.8, w, size * 1.6, size * 0.8, color, 2);
  text(ctx, label, left + w / 2, y + 0.5, { size, weight: 800, align: "center", color: C.ink });
  return w;
}

/** a horizontal level bar */
export function bar(ctx: Ctx, x: number, y: number, w: number, h: number, v: number, color: string, back = "#efe2c8"): void {
  box(ctx, x, y, w, h, h / 2, back, 2);
  if (v > 0) {
    rrect(ctx, x + 2, y + 2, Math.max(h - 4, (w - 4) * Math.min(1, v)), h - 4, (h - 4) / 2);
    paint(ctx, color, 0);
  }
}

/** a speech bubble with a tail pointing down to (x, y) */
export function bubble(ctx: Ctx, x: number, y: number, s: string, o: { size?: number; color?: string } = {}): void {
  const size = o.size ?? 12;
  const w = measure(ctx, s, size, 800) + 16;
  const h = size + 12;
  const bx = Math.max(6, Math.min(960 - w - 6, x - w / 2));
  const by = y - h - 9;
  ctx.beginPath();
  rrect(ctx, bx, by, w, h, 8);
  paint(ctx, o.color ?? C.white, 2);
  ctx.beginPath();
  ctx.moveTo(x - 6, by + h - 1);
  ctx.lineTo(x, y);
  ctx.lineTo(x + 6, by + h - 1);
  paint(ctx, o.color ?? C.white, 0);
  line(ctx, [[x - 6, by + h], [x, y], [x + 6, by + h]], C.ink, 2);
  text(ctx, s, bx + w / 2, by + h / 2 + 1, { size, weight: 800, align: "center" });
}
