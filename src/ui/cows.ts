// Burgrix's cows: chunky, round-snouted, with a coat chosen by id. Ill cows turn
// pale green and carry a thermometer, mad ones have spinning eyes.
import { C, type Ctx, circle, hash, line, oval, paint, rrect, shade, shadow } from "./draw.ts";

interface Coat {
  body: string;
  spot: string | null;
  head: string;
}
const COATS: Coat[] = [
  { body: "#fbf7ef", spot: "#3a2f2a", head: "#fbf7ef" },
  { body: "#b8693a", spot: "#fbf1e2", head: "#b8693a" },
  { body: "#f3e2c3", spot: "#a0582f", head: "#f3e2c3" },
  { body: "#5a4438", spot: null, head: "#5a4438" },
  { body: "#d9a066", spot: null, head: "#f6ead4" },
];

export interface CowOpts {
  scale?: number;
  facing?: 1 | -1;
  t?: number;
  ill?: boolean;
  mad?: boolean;
  /** head down to the grass or the trough */
  eating?: boolean;
  /** 0..1 thin → fat */
  fat?: number;
  highlight?: boolean;
}

export function drawCow(ctx: Ctx, x: number, y: number, id: number, o: CowOpts = {}): void {
  const coat = COATS[Math.floor(hash(id * 13) * COATS.length) % COATS.length]!;
  const s = o.scale ?? 1;
  const f = o.facing ?? 1;
  const t = (o.t ?? 0) + hash(id) * 10;
  const fat = o.fat ?? 0.5;
  const body = o.ill || o.mad ? "#d6e6c0" : coat.body;
  const head = o.ill || o.mad ? "#d6e6c0" : coat.head;
  const bw = 17 + fat * 5;
  const bh = 10 + fat * 3;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * f, s);
  shadow(ctx, 0, 0, bw + 3, 5);

  // legs
  const legs = [-bw + 6, -bw + 11, bw - 11, bw - 6];
  legs.forEach((lx, i) => {
    const sw = o.eating ? 0 : Math.sin(t * 3 + i) * 0.4;
    rrect(ctx, lx - 2.5 + sw, -10, 5, 10, 2);
    paint(ctx, i % 2 ? shade(body, -0.1) : body, 1.6);
    rrect(ctx, lx - 2.5 + sw, -3, 5, 3, 1.2);
    paint(ctx, C.ink, 0);
  });

  // tail
  const wag = Math.sin(t * 2.2) * 3;
  line(ctx, [[-bw + 1, -bh - 8], [-bw - 5, -bh - 2 + wag * 0.3], [-bw - 6 + wag * 0.3, -7]], C.ink, 1.8);
  oval(ctx, -bw - 6 + wag * 0.3, -6, 2.2, 3, shade(body, -0.3), 1.2);

  // body
  rrect(ctx, -bw, -bh * 2 - 8, bw * 2, bh * 2, bh);
  paint(ctx, body, 2);
  if (coat.spot) {
    ctx.save();
    rrect(ctx, -bw, -bh * 2 - 8, bw * 2, bh * 2, bh);
    ctx.clip();
    const k = hash(id * 5);
    oval(ctx, -bw * 0.4 + k * 6, -bh * 1.5 - 8, 6 + k * 3, 4.5, coat.spot, 0);
    oval(ctx, bw * 0.35, -bh * 0.7 - 7, 5, 4 + k * 2, coat.spot, 0);
    oval(ctx, -bw * 0.9, -bh * 0.6 - 8, 4, 5, coat.spot, 0);
    ctx.restore();
  }
  // udder
  oval(ctx, -2, -9, 4, 2.4, C.pink, 1.4);

  // head
  const hx = bw - 1;
  const hy = o.eating ? -10 + Math.sin(t * 4) * 0.8 : -bh * 2 - 6 + Math.sin(t * 1.5) * 0.8;
  ctx.save();
  ctx.translate(hx, hy);
  // ears and horns
  oval(ctx, -2, -6, 5, 2.4, shade(head, -0.12), 1.5);
  oval(ctx, 12, -6, 5, 2.4, shade(head, -0.12), 1.5);
  line(ctx, [[1.5, -8], [0, -12]], "#efe3c4", 3.4);
  line(ctx, [[8.5, -8], [10, -12]], "#efe3c4", 3.4);
  rrect(ctx, -1, -10, 12, 15, 6);
  paint(ctx, head, 2);
  // snout
  rrect(ctx, -2, 0, 14, 8, 4);
  paint(ctx, "#f2b8ae", 1.8);
  circle(ctx, 2.5, 4, 1.1, C.ink, 0);
  circle(ctx, 7.5, 4, 1.1, C.ink, 0);
  // eyes
  if (o.mad) {
    for (const ex of [2, 8]) {
      ctx.beginPath();
      for (let a = 0; a < 12; a += 0.6) {
        const r = a * 0.22;
        const px = ex + Math.cos(a + t * 6) * r;
        const py = -4 + Math.sin(a + t * 6) * r;
        if (a === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      paint(ctx, null, 1, C.ketchup);
    }
  } else {
    const blink = Math.sin(t * 0.9) > 0.97;
    for (const ex of [2, 8]) {
      if (blink) line(ctx, [[ex - 1.6, -4], [ex + 1.6, -4]], C.ink, 1.4);
      else {
        circle(ctx, ex, -4, 1.9, C.ink, 0);
        circle(ctx, ex + 0.6, -4.7, 0.6, C.white, 0);
      }
    }
  }
  ctx.restore();

  if (o.highlight) {
    rrect(ctx, -bw - 3, -bh * 2 - 11, bw * 2 + 20, bh * 2 + 14, bh + 3);
    paint(ctx, null, 2.5, C.mustard);
  }
  ctx.restore();

  // sickness signs stay upright
  if (o.ill) drawThermometer(ctx, x + f * (bw - 2) * s, y - (bh * 2 + 24) * s, s);
  if (o.mad) {
    const k = Math.sin(t * 9) * 2;
    line(ctx, [[x - 4 * s, y - (bh * 2 + 30) * s], [x + 1 * s + k, y - (bh * 2 + 24) * s], [x - 2 * s, y - (bh * 2 + 22) * s], [x + 3 * s, y - (bh * 2 + 16) * s]], C.ketchup, 2.4);
  }
}

function drawThermometer(ctx: Ctx, x: number, y: number, s: number): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.rotate(0.5);
  rrect(ctx, -2.2, -10, 4.4, 14, 2.2);
  paint(ctx, C.white, 1.4);
  circle(ctx, 0, 5, 3.3, C.ketchup, 1.4);
  rrect(ctx, -0.9, -6, 1.8, 10, 0.9);
  paint(ctx, C.ketchup, 0);
  ctx.restore();
}
