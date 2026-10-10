// The top bar (money, the four world windows, the date, clock buttons) and the
// info bar at the bottom.
import type { Season } from "../sim/index.ts";
import { SECTORS, type App, type Sector } from "./core.ts";
import { C, type Ctx, W, box, circle, line, measure, oval, paint, poly, rrect, shade, text } from "./draw.ts";
import { drawIcon } from "./icons.ts";
import { monthName } from "./windows.ts";
import type { Rect } from "./widgets.ts";

export const TOP = 60;
export const BOTTOM = 556;

export interface HudButton extends Rect {
  id: string;
  hint: string;
  run(): void;
}

const TAB_X = [372, 434, 496, 558];
const TAB_Y = 30;
const TAB_R = 24;

/** a round window onto one part of the same landscape: the road and the horizon run through all four */
function worldWindow(ctx: Ctx, sector: Sector, x: number, y: number, r: number, t: number): void {
  ctx.save();
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.clip();
  // sky and the shared horizon
  ctx.fillStyle = C.sky;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  const hz = y + r * 0.18;
  const k = SECTORS.indexOf(sector);
  ctx.fillStyle = ["#9ccf62", "#b9d27a", "#c9c2b6", "#aeb8c0"][k]!;
  ctx.fillRect(x - r, hz, r * 2, r);
  // the road continues from window to window
  poly(ctx, [[x - r, y + r * 0.62], [x + r, y + r * 0.5], [x + r, y + r * 0.72], [x - r, y + r * 0.84]], "#8f877a", 0);
  line(ctx, [[x - r, y + r * 0.73], [x + r, y + r * 0.61]], "rgba(255,255,255,0.7)", 1.2);
  if (sector === "farm") {
    circle(ctx, x - r * 0.45, y - r * 0.45, r * 0.22, "#ffd25a", 0);
    for (let k2 = 0; k2 < 3; k2++) poly(ctx, [[x - r + k2 * r * 0.7, hz + 2], [x - r * 0.6 + k2 * r * 0.7, hz - r * 0.35], [x - r * 0.25 + k2 * r * 0.7, hz + 2]], "#5aa646", 1);
    for (let k2 = 0; k2 < 4; k2++) line(ctx, [[x - r * 0.1 + k2 * 4, hz + 4], [x - r * 0.2 + k2 * 6, hz + r * 0.42]], "#d8b85a", 1.6);
  } else if (sector === "feedlot") {
    rrect(ctx, x + r * 0.2, hz - r * 0.42, r * 0.5, r * 0.45, 1);
    paint(ctx, "#c9583f", 1);
    for (let k2 = 0; k2 < 5; k2++) line(ctx, [[x - r + k2 * 7, hz + 9], [x - r + k2 * 7, hz + 1]], C.woodDark, 1.3);
    line(ctx, [[x - r, hz + 4], [x + r * 0.1, hz + 4]], C.woodDark, 1.2);
    oval(ctx, x - r * 0.25, hz + 6, 6, 3.6, "#fbf7ef", 1);
    circle(ctx, x - r * 0.25 + 6, hz + 3.5, 2.4, "#fbf7ef", 1);
  } else if (sector === "restaurant") {
    rrect(ctx, x - r * 0.55, hz - r * 0.55, r * 1.1, r * 0.6, 1.5);
    paint(ctx, "#f6c66b", 1.2);
    rrect(ctx, x - r * 0.4, hz - r * 0.3, r * 0.8, r * 0.3, 1);
    paint(ctx, C.sky, 1);
    poly(ctx, [[x - r * 0.62, hz - r * 0.55], [x + r * 0.62, hz - r * 0.55], [x + r * 0.5, hz - r * 0.75], [x - r * 0.5, hz - r * 0.75]], C.ketchup, 1.2);
    const b = Math.sin(t * 2) * 0.6;
    circle(ctx, x, hz - r * 0.92 + b, r * 0.16, C.mustard, 1);
  } else {
    for (const [dx, h, c] of [[-0.55, 0.7, "#8ea0ad"], [-0.05, 1.05, "#dfe7ec"], [0.45, 0.55, "#b0bec8"]] as [number, number, string][]) {
      rrect(ctx, x + dx * r - r * 0.2, hz - r * h, r * 0.42, r * h, 1);
      paint(ctx, c, 1.1);
      for (let w2 = 0; w2 < h * 4; w2++) line(ctx, [[x + dx * r - r * 0.1, hz - r * h + 4 + w2 * 5], [x + dx * r + r * 0.12, hz - r * h + 4 + w2 * 5]], "#7fd3e6", 1.3);
    }
  }
  ctx.restore();
}

function seasonIcon(ctx: Ctx, s: Season, x: number, y: number, t: number): void {
  if (s === "summer") {
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2 + t * 0.4;
      line(ctx, [[x + Math.cos(a) * 9, y + Math.sin(a) * 9], [x + Math.cos(a) * 12, y + Math.sin(a) * 12]], "#f2a531", 2);
    }
    circle(ctx, x, y, 7, "#ffd25a", 1.8);
  } else if (s === "spring") {
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2;
      circle(ctx, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 4.2, C.pink, 1.4);
    }
    circle(ctx, x, y, 3.2, C.mustard, 1.2);
  } else if (s === "autumn") {
    ctx.beginPath();
    ctx.moveTo(x, y + 10);
    ctx.quadraticCurveTo(x - 12, y, x, y - 11);
    ctx.quadraticCurveTo(x + 12, y, x, y + 10);
    paint(ctx, "#e07a2e", 1.8);
    line(ctx, [[x, y + 11], [x, y - 7]], shade("#e07a2e", -0.4), 1.4);
  } else {
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI;
      line(ctx, [[x - Math.cos(a) * 10, y - Math.sin(a) * 10], [x + Math.cos(a) * 10, y + Math.sin(a) * 10]], "#6fb4d6", 2.4);
    }
    circle(ctx, x, y, 2.4, C.white, 1.2);
  }
}

export interface HudState {
  hover: string | null;
  fast: boolean;
}

export function sectorAlert(app: App, s: Sector): boolean {
  const g = app.game;
  if (s === "feedlot") return g.feedlotAlerts().length > 0;
  if (s === "restaurant") return g.restaurantAlerts().length > 0;
  if (s === "office") return g.state.boardAlarm >= 10 || g.state.money < g.config.bankruptcy / 2 || Object.values(g.state.dissent).some((v) => v >= 50);
  return g.state.townMood === "hungry" || g.state.townMood === "deserted";
}

export function drawTop(ctx: Ctx, app: App, hs: HudState): HudButton[] {
  const s = app.game.state;
  const t = app.now;
  const g = ctx.createLinearGradient(0, 0, 0, TOP);
  g.addColorStop(0, "#e2563c");
  g.addColorStop(1, "#bf3b27");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, TOP);
  line(ctx, [[0, TOP - 1], [W, TOP - 1]], C.ink, 3);
  for (let x = 0; x < W; x += 24) circle(ctx, x + 12, TOP + 2, 9, "#bf3b27", 0);
  for (let x = 0; x < W; x += 24) {
    ctx.beginPath();
    ctx.arc(x + 12, TOP + 2, 9, 0, Math.PI);
    paint(ctx, null, 2);
  }
  const out: HudButton[] = [];

  // money
  box(ctx, 10, 8, 214, 44, 12, C.cream, 2.5);
  drawIcon(ctx, "coin", 34, 30, 30);
  text(ctx, app.money(s.money), 54, 25, { size: 22, weight: 900, color: s.money < 0 ? C.ketchup : C.ink, max: 160 });
  const month = s.income - s.expenses;
  text(ctx, app.t("hud.month", { n: (month >= 0 ? "+" : "") + app.money(month) }), 55, 43, { size: 11, weight: 800, color: month >= 0 ? C.good : C.bad, max: 160 });
  out.push({ id: "money", x: 10, y: 8, w: 214, h: 44, hint: app.t("hud.money.hint"), run: () => {} });

  // the four world windows
  SECTORS.forEach((sec, k) => {
    const x = TAB_X[k]!;
    const active = app.sector === sec;
    const hover = hs.hover === `tab:${sec}`;
    const r = TAB_R + (active ? 2 : hover ? 1 : 0);
    circle(ctx, x, TAB_Y + 2, r + 3, "rgba(0,0,0,0.25)", 0);
    worldWindow(ctx, sec, x, TAB_Y, r, t);
    circle(ctx, x, TAB_Y, r, null, active ? 4.5 : 3, active ? C.mustard : C.ink);
    if (active) circle(ctx, x, TAB_Y, r + 3.5, null, 2, C.ink);
    if (sectorAlert(app, sec) && !active) {
      const pulse = 1 + Math.sin(t * 6) * 0.12;
      circle(ctx, x + r * 0.72, TAB_Y - r * 0.72, 7.5 * pulse, C.mustard, 2);
      text(ctx, "!", x + r * 0.72, TAB_Y - r * 0.72 + 0.5, { size: 11, weight: 900, align: "center" });
    }
    out.push({ id: `tab:${sec}`, x: x - r, y: TAB_Y - r, w: r * 2, h: r * 2, hint: app.t(`tab.${sec}`), run: () => app.setSector(sec) });
  });

  // date
  box(ctx, 600, 8, 196, 44, 12, C.cream, 2.5);
  seasonIcon(ctx, s.season, 624, 30, t);
  const date = `${monthName(app, s.month)} ${s.year}`;
  text(ctx, date, 712, 24, { size: 17, weight: 900, align: "center", max: 120 });
  for (let k = 0; k < 4; k++) circle(ctx, 691 + k * 14, 42, 4, k < s.week ? C.ketchup : "#e3d4ba", 1.6);
  out.push({ id: "date", x: 600, y: 8, w: 196, h: 44, hint: app.t("hud.date.hint", { season: app.t(`season.${s.season}`), week: s.week }), run: () => {} });

  // clock and menu
  const btn = (id: string, x: number, icon: string, hint: string, run: () => void, on = false) => {
    const hover = hs.hover === id;
    box(ctx, x, 12 + 3, 38, 38, 10, shade(C.ketchup, -0.45), 2.5);
    box(ctx, x, 12 - (hover ? 2 : 0), 38, 38, 10, on ? C.mustard : hover ? "#ef6a4e" : "#d24a32", 2.5);
    ctx.save();
    if (on) ctx.globalAlpha = 1;
    drawIcon(ctx, icon, x + 19, 31 - (hover ? 2 : 0), 22);
    ctx.restore();
    out.push({ id, x, y: 12, w: 38, h: 38, hint, run });
  };
  btn("pause", 810, app.paused ? "play" : "pause", app.t(app.paused ? "hud.resume" : "hud.pause"), () => {
    app.paused = !app.paused;
  }, app.paused);
  btn("fast", 856, "fast", app.t(hs.fast ? "hud.normal" : "hud.fast"), () => {
    hs.fast = !hs.fast;
  }, hs.fast);
  btn("menu", 906, "menu", app.t("hud.menu"), () => {});
  return out;
}

export interface Info {
  title: string;
  text?: string;
  cost?: number;
  earn?: number;
  note?: string;
}

export function drawBottom(ctx: Ctx, app: App, info: Info | null): void {
  const y = BOTTOM;
  ctx.fillStyle = "#3b2a22";
  ctx.fillRect(0, y, W, 600 - y);
  line(ctx, [[0, y], [W, y]], C.ink, 3);
  box(ctx, 8, y + 6, W - 16, 600 - y - 12, 10, C.cream, 2);
  let x = 22;
  const cy = y + 22;
  if (!info) {
    text(ctx, app.t(`hint.${app.sector}`), x, cy, { size: 13, weight: 700, color: "#8d7a64", max: W - 300 });
  } else {
    text(ctx, info.title, x, cy, { size: 14, weight: 900, max: 300 });
    x += Math.min(300, measure(ctx, info.title, 14, 900)) + 12;
    if (info.cost) {
      drawIcon(ctx, "coin", x + 8, cy, 16);
      text(ctx, "−" + app.money(info.cost), x + 20, cy, { size: 14, weight: 900, color: C.bad });
      x += measure(ctx, "−" + app.money(info.cost), 14, 900) + 32;
    }
    if (info.earn) {
      drawIcon(ctx, "coin", x + 8, cy, 16);
      text(ctx, "+" + app.money(info.earn), x + 20, cy, { size: 14, weight: 900, color: C.good });
      x += measure(ctx, "+" + app.money(info.earn), 14, 900) + 32;
    }
    const rest = [info.note, info.text].filter(Boolean).join(" · ");
    if (rest) text(ctx, rest, x, cy, { size: 13, weight: 700, max: W - x - 260 });
  }
  drawStatus(ctx, app, y);
}

/** on/off chips of the current sector at the right end of the info bar */
function drawStatus(ctx: Ctx, app: App, y: number): void {
  const s = app.game.state;
  const chips: { icon: string; on: boolean; label?: string }[] = [];
  if (app.sector === "feedlot") {
    chips.push({ icon: "meal", on: s.additives.meal }, { icon: "hormones", on: s.additives.hormones }, { icon: "waste", on: s.additives.waste });
  } else if (app.sector === "farm") {
    const gm = s.plots.filter((p) => p.kind === "soy" && p.gm).length;
    chips.push({ icon: "gm", on: gm > 0, label: String(gm) }, { icon: "bribe", on: s.mayorBribed });
  } else if (app.sector === "restaurant") {
    chips.push({ icon: "patty", on: s.patties > 0, label: String(s.patties) }, { icon: "burger", on: s.burgers > 0, label: String(s.burgers) });
  } else {
    const camps = Object.entries(s.campaigns).filter(([, v]) => v).map(([k]) => k);
    for (const c of camps.slice(0, 6)) chips.push({ icon: c, on: true });
    if (!camps.length) chips.push({ icon: "kids", on: false });
  }
  let x = W - 18;
  for (const c of [...chips].reverse()) {
    const w = c.label ? 58 : 34;
    x -= w;
    box(ctx, x, y + 10, w, 24, 12, c.on ? "#dff3cf" : "#e8dfd0", 2);
    ctx.save();
    if (!c.on) ctx.globalAlpha = 0.5;
    drawIcon(ctx, c.icon, x + 17, y + 22, 17, app.now);
    ctx.restore();
    if (c.label) text(ctx, c.label, x + 32, y + 22.5, { size: 12, weight: 900 });
    else circle(ctx, x + w - 6, y + 14, 3.2, c.on ? "#6ddc4a" : "#8d8478", 1);
    x -= 6;
  }
}
