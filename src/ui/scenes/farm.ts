// Farmland: 20 plots on a hill, the town that eats the grain at the back, the sea
// with the polar ice at the front and the road to the feedlot on the right.
import type { GameEvent, Plot } from "../../sim/index.ts";
import type { Action, App, Scene, Target } from "../core.ts";
import { C, type Ctx, Iso, type Pt, alpha, circle, clamp, hash, isoBox, line, mix, oval, paint, path, poly, rrect, shade, shadow, text } from "../draw.ts";
import { drawCow } from "../cows.ts";
import { drawPerson, randomPerson, type Person } from "../people.ts";
import { drawIcon } from "../icons.ts";
import { bar } from "../widgets.ts";

const iso = new Iso(442, 172, 32);
const GAP = 0.1;
const plotOrigin = (i: number): Pt => [(i % 5) * 2, Math.floor(i / 5) * 2];

const WORKER: Person = { skin: "#e9b48a", hair: "#3a2618", hairStyle: "short", shirt: "#e57a44", pants: "#3d4f6b", hat: "hardhat", hatColor: C.mustard };
const VILLAGER: Person = { skin: "#c98c5f", hair: "#2b2b2b", hairStyle: "bun", shirt: "#56b5a6", pants: "#5a4632" };

function seasonGrass(app: App): string {
  const s = app.game.state.season;
  return s === "winter" ? "#a9c98a" : s === "summer" ? "#a6d05a" : s === "autumn" ? "#b5c45e" : C.grass;
}

function slab(ctx: Ctx, x: number, y: number, w: number, d: number, top: string, side: string, depth = 7): void {
  const P = (a: number, b: number, z = 0) => iso.p(a, b, z);
  poly(ctx, [P(x, y + d), P(x + w, y + d), P(x + w, y + d, -depth), P(x, y + d, -depth)], shade(side, -0.05), 2);
  poly(ctx, [P(x + w, y), P(x + w, y + d), P(x + w, y + d, -depth), P(x + w, y, -depth)], shade(side, -0.22), 2);
  poly(ctx, iso.quad(x, y, w, d), top, 2);
}

export function drawTree(ctx: Ctx, x: number, y: number, s: number, t: number, seed: number, dark = false): void {
  const sway = Math.sin(t * 1.2 + seed * 6) * 1.2 * s;
  shadow(ctx, x, y, 9 * s, 4 * s);
  rrect(ctx, x - 2.2 * s, y - 13 * s, 4.4 * s, 13 * s, 1.5 * s);
  paint(ctx, C.woodDark, 1.6);
  const g = dark ? "#3f8a3a" : "#5aa646";
  if (hash(seed) < 0.45) {
    // a pine
    for (let k = 0; k < 3; k++) {
      const yy = y - 10 * s - k * 8 * s;
      const ww = (12 - k * 3) * s;
      poly(ctx, [[x + sway * (k + 1) * 0.4, yy - 13 * s], [x + ww, yy], [x - ww, yy]], shade(g, -0.06 + k * 0.06), 1.8);
    }
  } else {
    circle(ctx, x + sway * 0.5, y - 20 * s, 10.5 * s, g, 1.8);
    circle(ctx, x - 5 * s + sway * 0.7, y - 25 * s, 7 * s, shade(g, 0.12), 1.6);
    circle(ctx, x + 5 * s + sway, y - 27 * s, 6 * s, shade(g, 0.2), 1.6);
  }
}

function hut(ctx: Ctx, x: number, y: number, w: number, d: number, h: number, wall: string, roof: string, burning: boolean, t: number): void {
  isoBox(ctx, iso, x, y, 0, w, d, h, wall);
  const apex = iso.p(x + w / 2, y + d / 2, h + 15);
  const a = iso.p(x, y + d, h);
  const b = iso.p(x + w, y + d, h);
  const c = iso.p(x + w, y, h);
  poly(ctx, [apex, a, b], shade(roof, -0.05), 2);
  poly(ctx, [apex, b, c], shade(roof, -0.25), 2);
  // door
  const d0 = iso.p(x + w * 0.4, y + d, 0);
  const d1 = iso.p(x + w * 0.65, y + d, 0);
  poly(ctx, [d0, d1, [d1[0], d1[1] - 10], [d0[0], d0[1] - 10]], C.woodDark, 1.4);
  if (burning) flames(ctx, apex[0], apex[1] + 8, 1.2, t + x);
}

function flames(ctx: Ctx, x: number, y: number, s: number, t: number): void {
  for (let k = 0; k < 3; k++) {
    const k2 = Math.sin(t * 10 + k * 2) * 2;
    const fx = x + (k - 1) * 6 * s;
    ctx.beginPath();
    ctx.moveTo(fx - 5 * s, y);
    ctx.quadraticCurveTo(fx - 6 * s, y - 10 * s, fx + k2 * s, y - (16 + k * 3) * s);
    ctx.quadraticCurveTo(fx + 6 * s, y - 9 * s, fx + 5 * s, y);
    ctx.closePath();
    paint(ctx, k === 1 ? C.mustard : C.ketchup, 1.4);
  }
  // smoke
  for (let k = 0; k < 4; k++) {
    const ph = (t * 0.5 + k / 4) % 1;
    circle(ctx, x + Math.sin(ph * 6 + k) * 6, y - 22 * s - ph * 40, 4 + ph * 7, `rgba(90,80,75,${0.45 * (1 - ph)})`, 0);
  }
}

function drawPlot(ctx: Ctx, app: App, i: number, p: Plot): void {
  const [x0, y0] = plotOrigin(i);
  const t = app.now;
  const s = app.game.state;
  const fert = clamp(p.fertility / app.game.config.fertilityMax, 0, 1);
  const grass = mix("#d6c27a", seasonGrass(app), fert);
  const x = x0 + GAP;
  const y = y0 + GAP;
  const w = 2 - GAP * 2;
  const P = (u: number, v: number, z = 0) => iso.p(x0 + u, y0 + v, z);

  let top = grass;
  if (p.kind === "forest") top = "#79b552";
  else if (p.kind === "desert") top = C.sand;
  else if (p.kind === "soy" || p.kind === "grain") top = s.season === "winter" && p.kind === "grain" ? "#b08356" : "#b8875a";
  slab(ctx, x, y, w, w, top, C.soilDark);

  // poor soil: dry patches
  if (p.kind !== "desert" && p.kind !== "forest" && p.fertility < app.game.config.fertilityAlarm) {
    for (let k = 0; k < 4; k++) {
      const [px, py] = P(0.4 + hash(i * 9 + k) * 1.2, 0.4 + hash(i * 3 + k) * 1.2);
      oval(ctx, px, py, 10, 4.5, alpha("#c9a45c", 0.8), 0);
      line(ctx, [[px - 5, py], [px - 1, py + 1.5], [px + 4, py - 1]], shade("#c9a45c", -0.4), 1.2);
    }
  }

  const items: { d: number; draw: () => void }[] = [];
  const put = (u: number, v: number, f: () => void) => items.push({ d: u + v, draw: f });

  switch (p.kind) {
    case "forest":
    case "village": {
      const clearing = p.work?.type === "clearing";
      const left = p.work ? p.work.weeksLeft / app.game.config.clearWeeks : 1;
      if (p.kind === "forest") {
        const spots: Pt[] = [[0.45, 0.45], [1.3, 0.4], [0.9, 0.95], [0.4, 1.4], [1.55, 1.15], [1.15, 1.6]];
        spots.forEach(([u, v], k) => {
          const [sx, sy] = P(u, v);
          if (clearing && k / spots.length >= left) put(u, v, () => stump(ctx, sx, sy));
          else put(u, v, () => drawTree(ctx, sx, sy, 0.95 + hash(i * 5 + k) * 0.3, t, i * 7 + k, true));
        });
      } else {
        // village: huts, a well and a villager
        const burning = p.work?.type === "burning";
        put(0.3, 0.3, () => hut(ctx, x0 + 0.25, y0 + 0.25, 0.7, 0.6, 14, "#f1dfbd", "#b4573a", burning, t));
        put(1.1, 0.4, () => hut(ctx, x0 + 1.05, y0 + 0.3, 0.6, 0.6, 12, "#ecd3a4", "#8f6b3c", burning, t + 1));
        put(0.5, 1.2, () => hut(ctx, x0 + 0.35, y0 + 1.1, 0.6, 0.55, 12, "#f5e6c8", "#a4463a", burning, t + 2));
        put(1.4, 1.4, () => {
          const [wx, wy] = P(1.45, 1.4);
          oval(ctx, wx, wy, 7, 3.5, C.stone, 1.8);
          oval(ctx, wx, wy - 1, 4, 2, C.seaDeep, 0);
        });
        if (!burning) {
          const ph = (t * 0.07 + i * 0.3) % 1;
          const u = 0.8 + Math.sin(ph * Math.PI * 2) * 0.4;
          const v = 1.0 + Math.cos(ph * Math.PI * 2) * 0.3;
          const [vx, vy] = P(u, v);
          put(u, v, () => drawPerson(ctx, vx, vy, VILLAGER, { scale: 0.55, pose: "walk", t, facing: Math.cos(ph * Math.PI * 2) > 0 ? 1 : -1, mood: 4 }));
          // chimney smoke
          const [cx, cy] = P(0.6, 0.55, 30);
          for (let k = 0; k < 3; k++) {
            const q = (t * 0.35 + k / 3) % 1;
            circle(ctx, cx + q * 8, cy - q * 26, 2.5 + q * 4, `rgba(240,240,240,${0.7 * (1 - q)})`, 0);
          }
        }
      }
      if (p.work) {
        const [wx, wy] = P(1.6, 1.65);
        put(1.6, 1.65, () => drawPerson(ctx, wx, wy, WORKER, { scale: 0.62, pose: "work", t, facing: -1, mood: 3 }));
      }
      break;
    }
    case "grain": {
      const col = s.season === "winter" ? "#8a6a45" : s.season === "spring" ? "#9ccf62" : "#e6c25a";
      for (let r = 0; r < 5; r++) {
        const v = 0.3 + r * 0.35;
        line(ctx, [P(0.2, v), P(1.8, v)], shade(top, -0.2), 2);
        if (s.season !== "winter")
          for (let k = 0; k < 7; k++) {
            const u = 0.3 + k * 0.22;
            const [sx, sy] = P(u, v);
            put(u, v, () => {
              const sw = Math.sin(t * 2 + u * 3 + v) * 1.2;
              line(ctx, [[sx, sy], [sx + sw, sy - 9]], shade(col, -0.25), 1.6);
              oval(ctx, sx + sw, sy - 10, 1.8, 3.2, col, 1);
            });
          }
      }
      break;
    }
    case "soy": {
      for (let r = 0; r < 4; r++) {
        const v = 0.35 + r * 0.43;
        line(ctx, [P(0.2, v), P(1.8, v)], shade(top, -0.25), 2.4);
        for (let k = 0; k < 5; k++) {
          const u = 0.35 + k * 0.32;
          const [sx, sy] = P(u, v);
          put(u, v, () => soyBush(ctx, sx, sy, p, t + k + r));
        }
      }
      if (p.gm) {
        const [gx, gy] = P(1.7, 1.75);
        put(1.9, 1.9, () => {
          line(ctx, [[gx, gy], [gx, gy - 22]], C.woodDark, 2.4);
          rrect(ctx, gx - 10, gy - 36, 20, 16, 3);
          paint(ctx, C.white, 1.8);
          drawIcon(ctx, "gm", gx, gy - 28, 13, t);
        });
      }
      break;
    }
    case "pasture": {
      fence(ctx, x0, y0, "back");
      p.herd.forEach((age, k) => {
        const slots: Pt[] = [[0.65, 0.75], [1.35, 0.85], [0.95, 1.4]];
        const [u, v] = slots[k]!;
        const du = Math.sin(t * 0.3 + k * 2 + i) * 0.12;
        const [cx, cy] = P(u + du, v);
        const grow = clamp(age / app.game.config.calfMonths, 0, 1);
        put(u, v, () => drawCow(ctx, cx, cy, i * 3 + k + 500, { scale: 0.42 + grow * 0.2, facing: Math.cos(t * 0.3 + k * 2 + i) > 0 ? 1 : -1, t, eating: Math.sin(t * 0.5 + k) > 0, fat: 0.3 }));
      });
      break;
    }
    case "desert": {
      for (let k = 0; k < 5; k++) {
        const [cx, cy] = P(0.3 + hash(i + k) * 1.4, 0.3 + hash(i * 2 + k) * 1.4);
        line(ctx, [[cx - 8, cy], [cx - 3, cy + 2], [cx + 2, cy - 1], [cx + 8, cy + 1]], shade(C.sand, -0.35), 1.4);
      }
      const [kx, ky] = P(1.3, 0.7);
      put(1.3, 0.7, () => cactus(ctx, kx, ky));
      const [bx, by] = P(0.7, 1.3);
      put(0.7, 1.3, () => skull(ctx, bx, by));
      break;
    }
    case "empty": {
      for (let k = 0; k < 7; k++) {
        const u = 0.25 + hash(i * 11 + k) * 1.5;
        const v = 0.25 + hash(i * 17 + k) * 1.5;
        const [sx, sy] = P(u, v);
        line(ctx, [[sx - 3, sy], [sx - 1, sy - 5]], shade(grass, -0.3), 1.4);
        line(ctx, [[sx + 2, sy], [sx + 1, sy - 6]], shade(grass, -0.3), 1.4);
        if (k % 3 === 0 && fert > 0.5) circle(ctx, sx + 4, sy - 3, 1.8, k % 2 ? C.white : C.mustard, 0.8);
      }
      break;
    }
  }
  items.sort((a, b) => a.d - b.d).forEach((it) => it.draw());
  if (p.kind === "pasture") fence(ctx, x0, y0, "front");

  if (p.work) {
    const [bx, by] = P(1, 1, 52);
    const total = app.game.config.clearWeeks;
    bar(ctx, bx - 26, by, 52, 10, 1 - p.work.weeksLeft / total, C.mustard);
  }
}

function soyBush(ctx: Ctx, x: number, y: number, p: Plot, t: number): void {
  const stage = p.soyStage ?? "sowing";
  if (stage === "sowing") {
    oval(ctx, x, y - 1, 2.4, 1.4, "#e9d9a0", 1);
    return;
  }
  const r = stage === "growing" ? 4.5 : 6;
  const leaf = p.gm ? (stage === "growing" ? "#6aa86a" : "#b9a65c") : stage === "growing" ? C.lettuce : "#d6b85a";
  const sw = Math.sin(t * 2) * 0.6;
  circle(ctx, x - 2 + sw, y - r, r * 0.8, shade(leaf, -0.1), 1.4);
  circle(ctx, x + 2 + sw, y - r - 1, r * 0.8, leaf, 1.4);
  if (p.gm) circle(ctx, x + sw, y - r * 1.8, 1.6, C.plum, 0.8);
  if (stage === "harvested") {
    oval(ctx, x - 2, y - r - 2, 1.3, 2.6, "#8a6a2f", 0);
    oval(ctx, x + 3, y - r - 3, 1.3, 2.6, "#8a6a2f", 0);
  }
}

function fence(ctx: Ctx, x0: number, y0: number, part: "back" | "front"): void {
  const a = 0.12;
  const b = 1.88;
  const ring: Pt[] = [
    [a, a],
    [1, a],
    [b, a],
    [b, 1],
    [b, b],
    [1, b],
    [a, b],
    [a, 1],
  ];
  // the back edges run along y = a and x = a
  const segs: [Pt, Pt, boolean][] = [];
  for (let k = 0; k < ring.length; k++) {
    const p = ring[k]!;
    const q = ring[(k + 1) % ring.length]!;
    const back = (p[1] === a && q[1] === a) || (p[0] === a && q[0] === a);
    segs.push([p, q, back]);
  }
  for (const [p, q, back] of segs) {
    if (back !== (part === "back")) continue;
    for (const z of [6, 11]) line(ctx, [iso.p(x0 + p[0], y0 + p[1], z), iso.p(x0 + q[0], y0 + q[1], z)], C.woodDark, 2.6);
  }
  for (const p of ring) {
    const back = p[0] === a || p[1] === a;
    if (back !== (part === "back") && !(p[0] === a && p[1] === b) && !(p[0] === b && p[1] === a)) continue;
    const [px, py] = iso.p(x0 + p[0], y0 + p[1]);
    rrect(ctx, px - 2, py - 14, 4, 15, 1);
    paint(ctx, C.wood, 1.4);
  }
}

function stump(ctx: Ctx, x: number, y: number): void {
  oval(ctx, x, y - 2, 5, 2.5, C.woodDark, 1.6);
  rrect(ctx, x - 5, y - 6, 10, 4, 1);
  paint(ctx, C.woodDark, 1.4);
  oval(ctx, x, y - 6, 5, 2.5, "#e3b97f", 1.4);
}

function cactus(ctx: Ctx, x: number, y: number): void {
  shadow(ctx, x, y, 7, 3);
  rrect(ctx, x - 3.5, y - 22, 7, 22, 3.5);
  paint(ctx, "#6a9a4a", 1.8);
  rrect(ctx, x - 11, y - 15, 5, 9, 2.5);
  paint(ctx, "#6a9a4a", 1.6);
  rrect(ctx, x + 6, y - 19, 5, 10, 2.5);
  paint(ctx, "#6a9a4a", 1.6);
}

function skull(ctx: Ctx, x: number, y: number): void {
  oval(ctx, x, y - 4, 6, 4.5, "#f6f1e6", 1.6);
  circle(ctx, x - 2.2, y - 4.5, 1.3, C.ink, 0);
  circle(ctx, x + 2.2, y - 4.5, 1.3, C.ink, 0);
  line(ctx, [[x - 9, y - 7], [x - 6, y - 5]], "#f6f1e6", 2.5);
  line(ctx, [[x + 9, y - 7], [x + 6, y - 5]], "#f6f1e6", 2.5);
}

// ---- town (behind the plots) and sea (in front)

const TOWN_HALL: Pt = [7.6, -3.1];
const BUILDINGS: [number, number, number, number, number, string, string][] = [
  // x, y, w, d, h, wall, roof
  [4.2, -4.4, 1.2, 1.1, 40, "#e9d2b0", "#b4573a"],
  [5.6, -4.6, 1.1, 1.2, 56, "#d7c3a4", "#7f8c97"],
  [9.3, -4.4, 1.3, 1.0, 34, "#f1dcc0", "#a4463a"],
  [4.4, -2.2, 1.0, 1.0, 26, "#f4e3c6", "#c06a3a"],
  [9.6, -2.3, 1.0, 1.1, 30, "#e8d8bd", "#8f6b3c"],
];

function drawTown(ctx: Ctx, app: App): void {
  const s = app.game.state;
  const t = app.now;
  const dead = s.townMood === "deserted";
  // plaza
  poly(ctx, iso.quad(3.9, -4.9, 7, 4.5), dead ? "#c2b8a6" : "#ddd0b5", 2);
  for (let k = 0; k < 6; k++) line(ctx, [iso.p(3.9 + k * 1.2, -4.9), iso.p(3.9 + k * 1.2, -0.4)], "rgba(58,38,24,0.12)", 1.2);
  const gray = (c: string) => (dead ? mix(c, "#9a948a", 0.65) : c);
  const all = [...BUILDINGS.map((b) => ({ b, hall: false })), { b: [TOWN_HALL[0] - 0.8, TOWN_HALL[1] - 0.8, 1.7, 1.5, 34, "#f6ead2", "#4d7fa8"] as (typeof BUILDINGS)[number], hall: true }];
  all.sort((a, b) => a.b[0] + a.b[1] - (b.b[0] + b.b[1]));
  for (const { b, hall } of all) {
    const [x, y, w, d, h, wall, roof] = b;
    isoBox(ctx, iso, x, y, 0, w, d, h, gray(wall));
    // windows
    for (let r = 0; r < Math.floor(h / 14); r++)
      for (let c = 0; c < 2; c++) {
        const u = x + w * (0.3 + c * 0.4);
        const [wx, wy] = iso.p(u, y + d, 8 + r * 13);
        const lit = !dead && (s.townMood === "content" || hash(Math.floor(x * 10 + r + c)) < 0.5);
        poly(ctx, [[wx - 3, wy], [wx + 3, wy + 1.5], [wx + 3, wy - 5.5], [wx - 3, wy - 7]], dead ? "#6f6a62" : lit ? "#ffe9a3" : "#7aa6c2", 1.2);
      }
    poly(ctx, iso.quad(x - 0.05, y - 0.05, w + 0.1, d + 0.1, h), shade(gray(roof), 0.05), 2);
    if (hall) {
      // clock tower and flag
      const cx = x + w / 2;
      const cy = y + d / 2;
      isoBox(ctx, iso, cx - 0.3, cy - 0.3, h, 0.6, 0.6, 24, gray("#f6ead2"));
      const [fx, fy] = iso.p(cx - 0.3, cy + 0.3, h + 14);
      circle(ctx, fx + 9, fy - 4, 5, C.white, 1.6);
      line(ctx, [[fx + 9, fy - 4], [fx + 9, fy - 7.5]], C.ink, 1.2);
      line(ctx, [[fx + 9, fy - 4], [fx + 11.5, fy - 3]], C.ink, 1.2);
      const [px, py] = iso.p(cx, cy, h + 24);
      line(ctx, [[px, py], [px, py - 22]], C.ink, 1.8);
      const wave = Math.sin(t * 4) * 2;
      poly(ctx, [[px, py - 22], [px + 14, py - 19 + wave], [px, py - 14]], dead ? "#8d8478" : s.mayorBribed ? C.mustard : C.ketchup, 1.4);
      if (s.mayorBribed) drawIcon(ctx, "coin", px - 14, py - 6, 16);
    }
  }
  // people
  if (!dead) {
    const n = s.townMood === "content" ? 5 : s.townMood === "short" ? 3 : 4;
    for (let k = 0; k < n; k++) {
      const ph = (t * 0.04 + k / n) % 1;
      const u = 4.6 + ph * 5.6;
      const v = -0.9 - (k % 2) * 0.5;
      const [px, py] = iso.p(u, v);
      const angry = s.townMood === "hungry";
      drawPerson(ctx, px, py, randomPerson(k + 40), { scale: 0.5, pose: angry ? "wave" : "walk", t: t + k, mood: angry ? 1 : s.townMood === "short" ? 2 : 4, facing: 1 });
      if (angry && k % 2 === 0) {
        line(ctx, [[px + 6, py - 14], [px + 6, py - 38]], C.woodDark, 1.8);
        rrect(ctx, px - 4, py - 50, 20, 13, 2);
        paint(ctx, C.white, 1.6);
        line(ctx, [[px, py - 45], [px + 12, py - 45]], C.ketchup, 2);
      }
    }
  }
}

function drawSea(ctx: Ctx, app: App): void {
  const s = app.game.state;
  const t = app.now;
  // shore and water at the front left
  poly(ctx, [iso.p(-8, 8.3), iso.p(7, 8.3), iso.p(7, 9.2), iso.p(-8, 9.2)], C.sand, 0);
  const rise = s.seaLevel * 0.06;
  const sea = [iso.p(-8, 9.2 - rise), iso.p(7, 9.2 - rise), iso.p(7, 16), iso.p(-8, 16)];
  path(ctx, sea);
  const g = ctx.createLinearGradient(0, 330, 0, 600);
  g.addColorStop(0, C.sea);
  g.addColorStop(1, C.seaDeep);
  ctx.fillStyle = g;
  ctx.fill();
  for (let k = 0; k < 9; k++) {
    const u = -6 + ((k * 1.7 + t * 0.25) % 13);
    const v = 10 + (k % 3) * 1.4;
    const [wx, wy] = iso.p(u, v);
    line(ctx, [[wx - 8, wy], [wx - 3, wy - 2.5], [wx + 2, wy]], "rgba(255,255,255,0.55)", 1.6);
  }
  // the polar ice and its bear
  const ice = clamp(s.polarIce / 100, 0, 1);
  const [ix, iy] = iso.p(0.6, 12.6);
  const bob = Math.sin(t * 1.3) * 1.2;
  if (ice > 0) {
    const r = 10 + ice * 34;
    ctx.beginPath();
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * Math.PI * 2;
      const rr = r * (0.82 + hash(k + 3) * 0.3);
      ctx.lineTo(ix + Math.cos(a) * rr, iy + bob + Math.sin(a) * rr * 0.42);
    }
    ctx.closePath();
    paint(ctx, C.ice, 2);
    oval(ctx, ix - r * 0.2, iy + bob + 2, r * 0.4, r * 0.1, "#d9eef7", 0);
  }
  polarBear(ctx, ix + 4, iy + bob - 2, ice);
  // sea level gauge
  const [gx, gy] = iso.p(3.2, 10.2);
  rrect(ctx, gx - 4, gy - 60, 8, 64, 2);
  paint(ctx, C.white, 1.8);
  for (let k = 0; k <= 10; k++) line(ctx, [[gx - 4, gy - 4 - k * 5.5], [gx + (k % 5 ? 0 : 3), gy - 4 - k * 5.5]], k > 6 ? C.ketchup : C.ink, 1.2);
  rrect(ctx, gx - 2, gy - 4 - s.seaLevel * 5.5, 4, s.seaLevel * 5.5 + 4, 1);
  paint(ctx, C.sea, 0);
}

function polarBear(ctx: Ctx, x: number, y: number, ice: number): void {
  const sad = ice < 0.35;
  shadow(ctx, x, y + 2, 12, 3);
  rrect(ctx, x - 12, y - 15, 22, 13, 6);
  paint(ctx, "#fbfbf6", 1.8);
  for (const lx of [-9, -4, 2, 6]) {
    rrect(ctx, x + lx, y - 6, 4, 7, 2);
    paint(ctx, "#fbfbf6", 1.4);
  }
  circle(ctx, x + 11, y - 15, 6.5, "#fbfbf6", 1.8);
  circle(ctx, x + 8, y - 21, 2.2, "#fbfbf6", 1.4);
  circle(ctx, x + 15, y - 21, 2.2, "#fbfbf6", 1.4);
  circle(ctx, x + 10, y - 16, 1.1, C.ink, 0);
  circle(ctx, x + 14, y - 16, 1.1, C.ink, 0);
  oval(ctx, x + 13, y - 12.5, 2, 1.4, C.ink, 0);
  if (sad) {
    ctx.beginPath();
    ctx.moveTo(x + 15, y - 14);
    ctx.quadraticCurveTo(x + 16.5, y - 10, x + 15, y - 9.5);
    paint(ctx, "#bfe9ff", 1);
  }
}

function drawRoad(ctx: Ctx, app: App): void {
  poly(ctx, [iso.p(10.35, -5), iso.p(11.25, -5), iso.p(11.25, 16), iso.p(10.35, 16)], "#9c9284", 2);
  for (let k = -4; k < 16; k += 1.4) line(ctx, [iso.p(10.8, k), iso.p(10.8, k + 0.6)], "#f6efe0", 2);
  // the truck that takes grown calves to the feedlot
  const t = app.now;
  const ph = (t * 0.06) % 1;
  const [tx, ty] = iso.p(10.8, -4 + ph * 20);
  truck(ctx, tx, ty);
  // a sign towards the feedlot
  const [sx, sy] = iso.p(11.6, 9.2);
  line(ctx, [[sx, sy], [sx, sy - 30]], C.woodDark, 3);
  poly(ctx, [[sx - 4, sy - 40], [sx + 22, sy - 27], [sx + 30, sy - 17], [sx + 22, sy - 14], [sx - 4, sy - 27]], C.wood, 1.8);
  drawIcon(ctx, "cow", sx + 11, sy - 25, 13);
}

function truck(ctx: Ctx, x: number, y: number): void {
  ctx.save();
  ctx.translate(x, y);
  shadow(ctx, 0, 2, 18, 6);
  // the truck drives towards the lower left
  ctx.scale(-1, 1);
  const P = (a: number, b: number): Pt => [a * 0.9 - b * 0.4, a * 0.45 + b * 0.2];
  void P;
  poly(ctx, [[-14, -4], [8, 7], [8, -9], [-14, -20]], "#e4e8ea", 2);
  poly(ctx, [[8, 7], [14, 4], [14, -12], [8, -9]], "#b9c2c7", 2);
  poly(ctx, [[-14, -20], [8, -9], [14, -12], [-8, -23]], "#f4f6f7", 2);
  poly(ctx, [[8, 7], [18, 12], [24, 9], [24, -2], [14, -7], [14, 4]], C.ketchup, 2);
  poly(ctx, [[18, 4], [24, 1], [24, -2], [18, 1]], "#bfe3f0", 1.2);
  circle(ctx, -6, 2, 3.5, C.night, 1.4);
  circle(ctx, 18, 12, 3.5, C.night, 1.4);
  ctx.restore();
}

// ---- interaction

function plotTitle(app: App, p: Plot): string {
  return app.t(`plot.${p.kind}`);
}

function plotText(app: App, i: number, p: Plot): string {
  const t = app.t;
  const parts: string[] = [];
  if (p.work) parts.push(t(`work.${p.work.type}`, { n: p.work.weeksLeft }));
  else if (p.kind === "grain" && !app.game.state.mayorBribed) parts.push(t("plot.grain.locked"));
  else parts.push(t(`plot.${p.kind}.text`));
  if (p.kind === "soy" && p.soyStage) parts.push(t(`soy.${p.soyStage}`) + (p.gm ? " · " + t("soy.gm") : ""));
  if (p.kind === "pasture") parts.push(t("pasture.herd", { n: p.herd.length }));
  if (p.kind !== "forest" && p.kind !== "desert" && p.kind !== "village") {
    const low = p.fertility < app.game.config.fertilityAlarm;
    parts.push(t(low ? "plot.fertility.low" : "plot.fertility", { n: Math.round((p.fertility / app.game.config.fertilityMax) * 100) }));
  }
  void i;
  return parts.join(" · ");
}

function plotActions(app: App, i: number, p: Plot): Action[] {
  const g = app.game;
  const t = app.t;
  if (p.work || p.kind === "desert") return [];
  if (p.kind === "grain" && !g.state.mayorBribed) return [];
  const act = (icon: string, label: string, cost: number | null, run: () => unknown, extra: Partial<Action> = {}): Action | null =>
    cost === null ? null : { icon, label, cost: cost || undefined, run: () => void run(), ...extra };
  const pastureCost = g.farm.cost(i, "pasture");
  const soyCost = g.farm.cost(i, "soy");
  const out: (Action | null)[] = [];
  const pre = p.kind === "forest" ? "clear" : p.kind === "village" ? "burn" : p.kind === "grain" ? "take" : p.kind === "soy" ? "to" : p.kind === "pasture" ? "to" : "";
  if (p.kind !== "pasture") out.push(act(p.kind === "village" ? "flame" : p.kind === "forest" ? "axe" : "pasture", t(pre ? `act.${pre}Pasture` : "act.pasture"), pastureCost, () => g.farm.makePasture(i)));
  if (p.kind !== "soy") out.push(act(p.kind === "village" ? "flame" : p.kind === "forest" ? "axe" : "soy", t(pre ? `act.${pre}Soy` : "act.soy"), soyCost, () => g.farm.sowSoy(i)));
  if (p.kind === "pasture") {
    out.unshift(
      act("plus", t("act.addCow"), 0, () => g.farm.addCow(i), { keep: true, disabled: p.herd.length >= 3 }),
      act("minus", t("act.removeCow"), 0, () => g.farm.removeCow(i), { keep: true, disabled: p.herd.length === 0 }),
    );
  }
  if (p.kind === "soy") out.unshift(act("gm", t("act.gm"), 0, () => g.farm.setGm(i, !p.gm), { on: p.gm, keep: true, note: t("act.gm.note", { n: g.config.gmCost }) }));
  if (p.kind === "pasture" || p.kind === "soy") {
    const price = Math.round((p.kind === "pasture" ? g.config.pastureCost : g.config.soyCost) / 2);
    out.push(act("sell", t("act.sell"), 0, () => g.farm.sell(i), { earn: price }));
  }
  return out.filter((a): a is Action => a !== null);
}

export class FarmScene implements Scene {
  ambience = ["farm"];

  draw(ctx: Ctx, app: App): void {
    const s = app.game.state;
    // ground and sky edge
    const sky = ctx.createLinearGradient(0, 60, 0, 600);
    sky.addColorStop(0, s.season === "winter" ? "#cfe4ea" : C.sky);
    sky.addColorStop(0.25, seasonGrass(app));
    sky.addColorStop(1, shade(seasonGrass(app), -0.15));
    ctx.fillStyle = sky;
    ctx.fillRect(0, 60, 960, 500);
    poly(ctx, [iso.p(-8, -8), iso.p(16, -8), iso.p(16, 16), iso.p(-8, 16)], seasonGrass(app), 0);
    // distant hills behind everything
    for (let k = 0; k < 6; k++) {
      const hx = 60 + k * 170;
      oval(ctx, hx, 150 - (k % 2) * 10, 130, 46, shade(seasonGrass(app), -0.08 - (k % 2) * 0.05), 0);
    }
    poly(ctx, [iso.p(-8, -8), iso.p(16, -8), iso.p(16, 16), iso.p(-8, 16)], alpha(seasonGrass(app), 0.6), 0);
    // background trees along the back edge
    for (let k = 0; k < 9; k++) {
      const [tx, ty] = iso.p(-1.5 + k * 0.6, -1.3 - (k % 2) * 0.6);
      drawTree(ctx, tx, ty, 0.8, app.now, 300 + k);
    }
    drawSea(ctx, app);
    drawRoad(ctx, app);
    drawTown(ctx, app);
    const order = s.plots.map((_, i) => i).sort((a, b) => {
      const [ax, ay] = plotOrigin(a);
      const [bx, by] = plotOrigin(b);
      return ax + ay - (bx + by) || ax - bx;
    });
    for (const i of order) drawPlot(ctx, app, i, s.plots[i]!);
    // hover outline
    const hov = app.hoverId?.startsWith("plot:") ? Number(app.hoverId.slice(5)) : -1;
    if (hov >= 0) {
      const [x0, y0] = plotOrigin(hov);
      poly(ctx, iso.quad(x0 + GAP, y0 + GAP, 2 - GAP * 2, 2 - GAP * 2), "rgba(255,240,180,0.25)", 3.5, C.mustard);
    }
    if (app.hoverId === "town") {
      poly(ctx, iso.quad(3.9, -4.9, 7, 4.5), null, 3.5, C.mustard);
    }
    // town mood bubble
    const [bx, by] = iso.p(TOWN_HALL[0], TOWN_HALL[1], 80);
    const mood = s.townMood;
    if (mood !== "content") {
      ctx.save();
      ctx.globalAlpha = 0.92;
      text(ctx, mood === "deserted" ? "…" : "!", bx - 40, by + 20, { size: 22, weight: 900, color: mood === "short" ? C.mustard : C.ketchup, outline: C.white, align: "center" });
      ctx.restore();
    }
  }

  targets(app: App): Target[] {
    const s = app.game.state;
    const out: Target[] = [];
    out.push({
      id: "sea",
      hit: (x, y) => {
        const [gx, gy] = iso.ground(x, y);
        return gy > 9 && gx < 7 && y > 300;
      },
      info: () => ({ title: app.t("sea.title"), text: app.t("sea.text", { ice: Math.round(s.polarIce), level: s.seaLevel }) }),
      anchor: () => iso.p(-2, 11),
    });
    out.push({
      id: "town",
      hit: (x, y) => {
        const [gx, gy] = iso.ground(x, y);
        return (gx > 3.9 && gx < 10.9 && gy > -4.9 && gy < -0.4) || (x > 610 && x < 900 && y > 100 && y < 260 && gy < -0.2);
      },
      info: () => ({
        title: app.t("town.title"),
        text: app.t(`town.${s.townMood}`) + " · " + app.t(s.mayorBribed ? "town.bribed" : "town.notBribed"),
      }),
      actions: () =>
        s.mayorBribed
          ? []
          : [{ icon: "bribe", label: app.t("act.bribe"), cost: app.game.config.bribeCost, run: () => void app.game.farm.bribeMayor() }],
      anchor: () => iso.p(TOWN_HALL[0], TOWN_HALL[1], 60),
    });
    s.plots.forEach((p, i) => {
      out.push({
        id: `plot:${i}`,
        hit: (x, y) => {
          const [gx, gy] = iso.ground(x, y);
          const [x0, y0] = plotOrigin(i);
          return gx >= x0 && gx < x0 + 2 && gy >= y0 && gy < y0 + 2;
        },
        info: () => ({ title: plotTitle(app, p), text: plotText(app, i, p) }),
        actions: () => plotActions(app, i, s.plots[i]!),
        anchor: () => {
          const [x0, y0] = plotOrigin(i);
          return iso.p(x0 + 1, y0 + 1, 40);
        },
      });
    });
    return out;
  }

  event(e: GameEvent, app: App): void {
    const at = (i: number, z = 50): Pt => {
      const [x0, y0] = plotOrigin(i);
      return iso.p(x0 + 1, y0 + 1, z);
    };
    switch (e.type) {
      case "soyYield": {
        const [x, y] = at(e.plot);
        app.float({ sector: "farm", x, y, text: app.t("float.feed", { n: e.amount }), color: C.lettuce });
        break;
      }
      case "workDone":
        app.sound.play(app.game.state.plots[e.plot]?.kind === "pasture" ? "moo2" : "plough", 0.7);
        break;
      case "desert": {
        const [x, y] = at(e.plot);
        app.float({ sector: "farm", x, y, text: app.t("float.desert"), color: C.ketchup });
        app.sound.play("desert");
        break;
      }
      case "calfShipped": {
        const [x, y] = at(e.plot);
        app.float({ sector: "farm", x, y, text: app.t("float.calf"), color: C.blue, icon: "cow" });
        break;
      }
      case "harvest":
        app.sound.play("harvest", 0.6);
        break;
      case "season":
        if (e.season === "autumn") app.sound.play("plough", 0.5);
        break;
    }
  }
}
