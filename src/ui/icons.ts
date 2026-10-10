// Burgrix's icons, drawn in a 24 × 24 box around the origin and scaled on use.
import { C, type Ctx, circle, line, oval, paint, path, poly, rrect, shade } from "./draw.ts";

type Draw = (ctx: Ctx, t: number) => void;

const coin: Draw = (ctx) => {
  circle(ctx, 0, 0, 9, C.mustard, 2);
  circle(ctx, 0, 0, 6, null, 1.4, shade(C.mustard, -0.35));
  ctx.font = "900 9px Nunito, Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = shade(C.mustard, -0.45);
  ctx.fillText("B", 0, 0.5);
};

const cowHead: Draw = (ctx) => {
  oval(ctx, -9, -4, 4, 2.2, "#e9dccb", 1.5);
  oval(ctx, 9, -4, 4, 2.2, "#e9dccb", 1.5);
  rrect(ctx, -7, -9, 14, 16, 6);
  paint(ctx, "#fbf7ef", 1.8);
  oval(ctx, -3, -5, 3, 2.4, "#3a2f2a", 0);
  rrect(ctx, -7.5, 1, 15, 8, 4);
  paint(ctx, "#f2b8ae", 1.6);
  circle(ctx, -2.5, 5, 1, C.ink, 0);
  circle(ctx, 2.5, 5, 1, C.ink, 0);
  circle(ctx, -3, -2, 1.4, C.ink, 0);
  circle(ctx, 3, -2, 1.4, C.ink, 0);
};

const person = (shirt: string): Draw => (ctx) => {
  path(ctx, [
    [-8, 10],
    [8, 10],
    [7, 2],
    [3, 0],
    [-3, 0],
    [-7, 2],
  ]);
  paint(ctx, shirt, 1.8);
  circle(ctx, 0, -5, 5.5, "#f1c7a1", 1.8);
};

const burger: Draw = (ctx) => {
  ctx.beginPath();
  ctx.moveTo(-10, -1);
  ctx.quadraticCurveTo(-10, -10, 0, -10);
  ctx.quadraticCurveTo(10, -10, 10, -1);
  ctx.closePath();
  paint(ctx, C.bun, 1.8);
  for (const [x, y] of [[-4, -6], [1, -8], [5, -5]]) oval(ctx, x!, y!, 1.2, 0.7, "#fff1c9", 0);
  path(ctx, [
    [-11, 0],
    [-6, 2],
    [-2, 0],
    [2, 2],
    [6, 0],
    [11, 1],
    [10, -1.5],
    [-10, -1.5],
  ]);
  paint(ctx, C.lettuce, 1.4);
  rrect(ctx, -10, 1, 20, 4, 2);
  paint(ctx, "#7a3b20", 1.6);
  rrect(ctx, -10, 5, 20, 5, 2.5);
  paint(ctx, C.bun, 1.8);
};

export const ICONS: Record<string, Draw> = {
  coin,
  burger,
  patty: (ctx) => {
    oval(ctx, 0, 2, 10, 5, "#7a3b20", 1.8);
    oval(ctx, 0, 0, 10, 5, "#9a5230", 1.8);
    for (const x of [-5, 0, 5]) line(ctx, [[x - 2, -1], [x + 2, 1]], "#5e2c16", 1.2);
  },
  cow: cowHead,
  plus: (ctx) => {
    circle(ctx, 0, 0, 10, C.lettuce, 2);
    line(ctx, [[-5, 0], [5, 0]], C.white, 3.2);
    line(ctx, [[0, -5], [0, 5]], C.white, 3.2);
  },
  minus: (ctx) => {
    circle(ctx, 0, 0, 10, C.ketchup, 2);
    line(ctx, [[-5, 0], [5, 0]], C.white, 3.2);
  },
  pasture: (ctx) => {
    oval(ctx, 0, 6, 11, 4, C.grass, 1.8);
    for (const x of [-8, 0, 8]) {
      rrect(ctx, x - 1.5, -6, 3, 12, 1);
      paint(ctx, C.wood, 1.4);
    }
    line(ctx, [[-9, -3], [9, -3]], C.woodDark, 2);
    line(ctx, [[-9, 2], [9, 2]], C.woodDark, 2);
  },
  soy: (ctx) => {
    line(ctx, [[0, 10], [0, -2]], C.pickle, 2.2);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 2);
      ctx.quadraticCurveTo(s * 10, -1, s * 9, -9);
      ctx.quadraticCurveTo(s * 2, -6, 0, 2);
      paint(ctx, C.lettuce, 1.6);
    }
    oval(ctx, 0, -5, 2.5, 4.5, "#d9c46a", 1.4);
  },
  gm: (ctx, t) => {
    for (let k = -9; k <= 9; k += 3) {
      const a = Math.sin(k * 0.45 + t * 2) * 5;
      line(ctx, [[-a, k], [a, k]], shade(C.plum, 0.3), 1.6);
    }
    ctx.beginPath();
    for (let k = -10; k <= 10; k += 1) ctx.lineTo(Math.sin(k * 0.45 + t * 2) * 5, k);
    paint(ctx, null, 2.2, C.plum);
    ctx.beginPath();
    for (let k = -10; k <= 10; k += 1) ctx.lineTo(-Math.sin(k * 0.45 + t * 2) * 5, k);
    paint(ctx, null, 2.2, C.lettuce);
  },
  sell: (ctx) => {
    coin(ctx, 0);
    path(ctx, [
      [4, 4],
      [11, 4],
      [11, 1],
      [15, 6],
      [11, 11],
      [11, 8],
      [4, 8],
    ]);
    paint(ctx, C.lettuce, 1.4);
  },
  bin: (ctx) => {
    rrect(ctx, -7, -5, 14, 15, 2);
    paint(ctx, C.steel, 1.8);
    for (const x of [-3, 0, 3]) line(ctx, [[x, -2], [x, 7]], shade(C.steel, -0.4), 1.4);
    rrect(ctx, -9, -9, 18, 4, 1.5);
    paint(ctx, shade(C.steel, 0.15), 1.8);
    rrect(ctx, -3, -11.5, 6, 3, 1);
    paint(ctx, shade(C.steel, 0.15), 1.4);
  },
  bribe: (ctx) => {
    rrect(ctx, -11, -6, 22, 14, 2);
    paint(ctx, "#f4e7c8", 1.8);
    line(ctx, [[-11, -6], [0, 2], [11, -6]], C.ink, 1.6);
    coin(ctx, 0);
    ctx.save();
    ctx.translate(6, -6);
    ctx.scale(0.55, 0.55);
    coin(ctx, 0);
    ctx.restore();
  },
  hire: (ctx, t) => {
    person(C.blue)(ctx, t);
    ctx.save();
    ctx.translate(7, -6);
    ctx.scale(0.5, 0.5);
    ICONS.plus!(ctx, t);
    ctx.restore();
  },
  fire: (ctx) => {
    rrect(ctx, -9, -10, 12, 20, 1.5);
    paint(ctx, C.wood, 1.8);
    circle(ctx, 0, 0, 1.2, C.ink, 0);
    path(ctx, [
      [2, -2],
      [8, -2],
      [8, -6],
      [13, 0],
      [8, 6],
      [8, 2],
      [2, 2],
    ]);
    paint(ctx, C.ketchup, 1.4);
  },
  badge: (ctx) => {
    path(ctx, [
      [-5, 2],
      [-8, 12],
      [-3, 9],
      [0, 12],
      [0, 2],
    ]);
    paint(ctx, C.ketchup, 1.4);
    path(ctx, [
      [5, 2],
      [8, 12],
      [3, 9],
      [0, 12],
      [0, 2],
    ]);
    paint(ctx, C.blue, 1.4);
    ctx.beginPath();
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      const r = k % 2 ? 7.5 : 9.5;
      ctx.lineTo(Math.cos(a) * r, -2 + Math.sin(a) * r);
    }
    ctx.closePath();
    paint(ctx, C.mustard, 1.6);
    circle(ctx, 0, -2, 4.5, shade(C.mustard, 0.3), 1.2);
  },
  warn: (ctx) => {
    ctx.save();
    ctx.rotate(0.2);
    rrect(ctx, -6, -10, 12, 18, 2);
    paint(ctx, C.mustard, 1.8);
    ctx.restore();
    line(ctx, [[-1, -5], [-0.5, 1]], C.ink, 2.4);
    circle(ctx, 0, 4.5, 1.3, C.ink, 0);
  },
  info: (ctx) => {
    circle(ctx, 0, 0, 10, C.blue, 2);
    circle(ctx, 0, -5, 1.6, C.white, 0);
    line(ctx, [[0, -1], [0, 6]], C.white, 3);
  },
  question: (ctx) => {
    circle(ctx, 0, 0, 10, C.teal, 2);
    ctx.font = "900 14px Nunito, Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = C.white;
    ctx.fillText("?", 0, 1);
  },
  chart: (ctx) => {
    rrect(ctx, -10, -9, 20, 18, 2);
    paint(ctx, C.white, 1.8);
    line(ctx, [[-7, 5], [-3, 0], [1, 2], [7, -6]], C.ketchup, 2.2);
    line(ctx, [[-7, 6.5], [7, 6.5]], C.ink, 1.2);
  },
  sheet: (ctx) => {
    path(ctx, [
      [-8, -10],
      [4, -10],
      [8, -6],
      [8, 10],
      [-8, 10],
    ]);
    paint(ctx, C.white, 1.8);
    for (const y of [-5, -1, 3, 7]) line(ctx, [[-5, y], [y > 5 ? 0 : 5, y]], shade(C.ink, 0.5), 1.4);
  },
  opponents: (ctx) => {
    path(ctx, [
      [-9, -3],
      [-3, -3],
      [7, -9],
      [7, 9],
      [-3, 3],
      [-9, 3],
    ]);
    paint(ctx, C.ketchup, 1.8);
    rrect(ctx, -7, 3, 4, 7, 1);
    paint(ctx, C.ketchup, 1.4);
    line(ctx, [[10, -4], [12, -6]], C.ink, 1.6);
    line(ctx, [[10, 0], [13, 0]], C.ink, 1.6);
    line(ctx, [[10, 4], [12, 6]], C.ink, 1.6);
  },
  meal: (ctx) => {
    rrect(ctx, -8, -7, 16, 17, 4);
    paint(ctx, "#d9b98a", 1.8);
    line(ctx, [[-8, -3], [8, -3]], C.ink, 1.2);
    // a bone on the sack
    line(ctx, [[-4, 4], [4, 4]], C.white, 3);
    for (const x of [-4.5, 4.5]) {
      circle(ctx, x, 2.6, 1.8, C.white, 1);
      circle(ctx, x, 5.4, 1.8, C.white, 1);
    }
    path(ctx, [
      [-6, -7],
      [-3, -11],
      [3, -11],
      [6, -7],
    ]);
    paint(ctx, "#c9a674", 1.6);
  },
  hormones: (ctx) => {
    ctx.save();
    ctx.rotate(-0.75);
    rrect(ctx, -3.5, -8, 7, 14, 1.5);
    paint(ctx, "#e8f6ff", 1.8);
    rrect(ctx, -2.2, -2, 4.4, 7, 1);
    paint(ctx, C.lettuce, 0);
    line(ctx, [[0, 6], [0, 12]], C.ink, 1.6);
    line(ctx, [[-4.5, -8], [4.5, -8]], C.ink, 2);
    line(ctx, [[0, -8], [0, -12]], C.ink, 2.2);
    line(ctx, [[-3, -12], [3, -12]], C.ink, 2);
    ctx.restore();
  },
  waste: (ctx) => {
    rrect(ctx, -7, -9, 14, 19, 3);
    paint(ctx, "#7a8f4c", 1.8);
    line(ctx, [[-7, -3], [7, -3]], C.ink, 1.4);
    line(ctx, [[-7, 4], [7, 4]], C.ink, 1.4);
    // a dripping blob
    ctx.beginPath();
    ctx.moveTo(-2, -9);
    ctx.quadraticCurveTo(-3, -4, 0, -4);
    ctx.quadraticCurveTo(3, -4, 2, -9);
    paint(ctx, "#b6d94c", 1.2);
  },
  kids: (ctx, t) => {
    const sw = Math.sin(t * 2) * 1.5;
    line(ctx, [[0, 11], [-5 + sw, -2]], C.ink, 1.2);
    line(ctx, [[0, 11], [5 - sw, -4]], C.ink, 1.2);
    oval(ctx, -5 + sw, -6, 5, 6, C.ketchup, 1.6);
    oval(ctx, 5 - sw, -8, 5, 6, C.mustard, 1.6);
  },
  pyramid: (ctx) => {
    poly(ctx, [[0, -11], [11, 9], [-11, 9]], C.paper, 1.8);
    line(ctx, [[-5.5, -1], [5.5, -1]], C.ink, 1.4);
    line(ctx, [[-8.5, 4.5], [8.5, 4.5]], C.ink, 1.4);
    poly(ctx, [[0, -11], [3, -5.5], [-3, -5.5]], C.ketchup, 0);
    poly(ctx, [[-8.2, 4.5], [8.2, 4.5], [11, 9], [-11, 9]], C.lettuce, 0);
    poly(ctx, [[0, -11], [11, 9], [-11, 9]], null, 1.8);
  },
  charity: (ctx) => {
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-14, 0, -8, -12, 0, -4);
    ctx.bezierCurveTo(8, -12, 14, 0, 0, 9);
    paint(ctx, C.ketchup, 1.8);
    oval(ctx, -3, -4, 2, 1.2, "rgba(255,255,255,0.5)", 0);
  },
  toons: (ctx) => {
    rrect(ctx, -10, -5, 20, 15, 2);
    paint(ctx, C.night, 1.8);
    ctx.save();
    ctx.translate(0, -6);
    ctx.rotate(-0.25);
    rrect(ctx, -10, -3, 20, 5, 1);
    paint(ctx, C.white, 1.6);
    for (const x of [-6, 0, 6]) poly(ctx, [[x - 2, -3], [x + 1, -3], [x + 3, 2], [x, 2]], C.night, 0);
    ctx.restore();
    circle(ctx, 0, 3, 3.5, C.mustard, 1.2);
  },
  politician: (ctx) => {
    poly(ctx, [[-8, 10], [8, 10], [6, -1], [-6, -1]], C.woodDark, 1.8);
    rrect(ctx, -9, -4, 18, 4, 1);
    paint(ctx, C.wood, 1.6);
    line(ctx, [[3, -4], [6, -10]], C.ink, 1.6);
    circle(ctx, 6.5, -11, 2.2, C.night, 1);
    circle(ctx, 0, 4, 2.6, C.mustard, 1.2);
  },
  climatologist: (ctx) => {
    circle(ctx, -2, 0, 9, C.sea, 1.8);
    ctx.save();
    ctx.beginPath();
    ctx.arc(-2, 0, 9, 0, Math.PI * 2);
    ctx.clip();
    oval(ctx, -5, -3, 5, 3.5, C.lettuce, 1.2);
    oval(ctx, 2, 4, 4, 3, C.lettuce, 1.2);
    ctx.restore();
    rrect(ctx, 7, -10, 4, 15, 2);
    paint(ctx, C.white, 1.4);
    circle(ctx, 9, 7, 3, C.ketchup, 1.4);
    rrect(ctx, 8.2, -4, 1.6, 9, 0.8);
    paint(ctx, C.ketchup, 0);
  },
  nutritionist: (ctx) => {
    circle(ctx, -3, 2, 7.5, C.ketchup, 1.8);
    circle(ctx, 3, 2, 7.5, C.ketchup, 1.8);
    oval(ctx, 0, 2, 8, 6.5, C.ketchup, 0);
    line(ctx, [[0, -4], [1, -9]], C.woodDark, 2);
    ctx.beginPath();
    ctx.moveTo(1, -7);
    ctx.quadraticCurveTo(7, -11, 9, -6);
    ctx.quadraticCurveTo(4, -4, 1, -7);
    paint(ctx, C.lettuce, 1.2);
    oval(ctx, -4, -1, 2, 1.3, "rgba(255,255,255,0.5)", 0);
  },
  inspector: (ctx) => {
    line(ctx, [[3, 3], [10, 10]], C.woodDark, 4.2);
    circle(ctx, -2, -2, 7.5, "#dff4ff", 2.2);
    oval(ctx, -4.5, -4.5, 2.2, 1.4, "rgba(255,255,255,0.9)", 0);
  },
  axe: (ctx) => {
    line(ctx, [[-7, 10], [5, -8]], C.woodDark, 3.4);
    ctx.save();
    ctx.translate(4, -7);
    ctx.rotate(0.6);
    path(ctx, [
      [-2, -3],
      [8, -6],
      [8, 5],
      [-2, 2],
    ]);
    paint(ctx, C.steel, 1.6);
    ctx.restore();
  },
  flame: (ctx, t) => {
    const k = Math.sin(t * 9) * 1.2;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.bezierCurveTo(-11, 8, -8, -3, -3 + k, -11);
    ctx.bezierCurveTo(-1, -4, 3, -6, 4, -9);
    ctx.bezierCurveTo(11, -1, 10, 9, 0, 10);
    paint(ctx, C.ketchup, 1.8);
    ctx.beginPath();
    ctx.moveTo(0, 9);
    ctx.bezierCurveTo(-5, 8, -5, 2, -1, -3);
    ctx.bezierCurveTo(1, 1, 5, 3, 0, 9);
    paint(ctx, C.mustard, 0);
  },
  check: (ctx) => {
    circle(ctx, 0, 0, 10, C.lettuce, 2);
    line(ctx, [[-5, 0], [-1, 4], [5, -4]], C.white, 3.2);
  },
  close: (ctx) => {
    circle(ctx, 0, 0, 10, C.ketchup, 2);
    line(ctx, [[-4, -4], [4, 4]], C.white, 3);
    line(ctx, [[4, -4], [-4, 4]], C.white, 3);
  },
  play: (ctx) => poly(ctx, [[-5, -8], [8, 0], [-5, 8]], C.white, 1.8),
  pause: (ctx) => {
    rrect(ctx, -7, -8, 5, 16, 1.5);
    paint(ctx, C.white, 1.6);
    rrect(ctx, 2, -8, 5, 16, 1.5);
    paint(ctx, C.white, 1.6);
  },
  fast: (ctx) => {
    poly(ctx, [[-10, -7], [0, 0], [-10, 7]], C.white, 1.6);
    poly(ctx, [[0, -7], [10, 0], [0, 7]], C.white, 1.6);
  },
  menu: (ctx) => {
    for (const y of [-6, 0, 6]) line(ctx, [[-8, y], [8, y]], C.white, 3.2);
  },
  sound: (ctx) => {
    poly(ctx, [[-9, -3], [-4, -3], [2, -9], [2, 9], [-4, 3], [-9, 3]], C.white, 1.6);
    ctx.beginPath();
    ctx.arc(2, 0, 6, -0.8, 0.8);
    paint(ctx, null, 2, C.white);
    ctx.beginPath();
    ctx.arc(2, 0, 10, -0.8, 0.8);
    paint(ctx, null, 2, C.white);
  },
  bell: (ctx, t) => {
    ctx.save();
    ctx.rotate(Math.sin(t * 12) * 0.25);
    ctx.beginPath();
    ctx.moveTo(-8, 6);
    ctx.quadraticCurveTo(-7, -9, 0, -9);
    ctx.quadraticCurveTo(7, -9, 8, 6);
    ctx.closePath();
    paint(ctx, C.mustard, 1.8);
    circle(ctx, 0, 8, 2.4, C.mustard, 1.4);
    ctx.restore();
  },
};

export function drawIcon(ctx: Ctx, name: string, x: number, y: number, size = 24, t = 0): void {
  const d = ICONS[name];
  if (!d) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(size / 24, size / 24);
  d(ctx, t);
  ctx.restore();
}
