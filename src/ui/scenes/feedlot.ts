// Feedlot: two pens with the cows, the feed silo, the additive shelf, the
// slaughterhouse with the conveyor to the restaurant and the director's barn.
import type { Additive, Cow, GameEvent } from "../../sim/index.ts";
import type { Action, App, Scene, Target } from "../core.ts";
import { C, type Ctx, Iso, type Pt, circle, clamp, cylinder, hash, isoBox, line, oval, paint, poly, rrect, shade, shadow, text } from "../draw.ts";
import { drawCow } from "../cows.ts";
import { drawPerson, type Person } from "../people.ts";
import { drawIcon } from "../icons.ts";
import { bubble, lamp, pill } from "../widgets.ts";
import { drawTree } from "./farm.ts";

const iso = new Iso(395, 140, 30);
const PENS: [number, number, number, number][] = [
  [0.5, 0.5, 6, 4.2],
  [0.5, 5.4, 6, 4.2],
];
const PER_PEN = 10;
/** grid cells (4 × 3) filled in a spread-out order */
const SLOT_ORDER = [5, 2, 8, 11, 0, 6, 3, 9, 1, 10];
const ADDITIVES: { kind: Additive; at: Pt; icon: string }[] = [
  { kind: "meal", at: [9.3, 3.7], icon: "meal" },
  { kind: "hormones", at: [10.8, 3.7], icon: "hormones" },
  { kind: "waste", at: [12.3, 3.7], icon: "waste" },
];
const SILO: Pt = [8.1, 1.3];
const DIRECTOR_AT: Pt = [13.6, 1.4];
/** the additive board: screen box above the shelf */
const BOARD = { x: 0, y: 0, w: 184, h: 84 };
{
  // hung on the barn wall, above the director
  const [bx, by] = iso.p(12.3, -0.8, 36);
  BOARD.x = bx - 92;
  BOARD.y = by - 60;
}
const DIRECTOR: Person = { skin: "#c98c5f", hair: "#3a2618", hairStyle: "curly", shirt: "#4f8f3a", pants: "#5a4632", hat: "cap", hatColor: C.mustard, glasses: true };

interface Walker {
  pen: number;
  slot: number;
}

function cowPlace(cow: Cow, w: Walker, t: number): { x: number; y: number; facing: 1 | -1; eating: boolean } {
  const [px, py, pw, pd] = PENS[w.pen]!;
  const a = hash(cow.id * 3) * 6.28;
  const sp = 0.05 + hash(cow.id * 7) * 0.05;
  const col = w.slot % 4;
  const row = Math.floor(w.slot / 4);
  const bu = px + 1 + (col + 0.5) * ((pw - 2) / 4);
  const bv = py + 0.9 + (row + 0.5) * ((pd - 1.8) / 3);
  const u = bu + Math.sin(t * sp + a) * 0.45;
  const v = bv + Math.cos(t * sp * 0.7 + a) * 0.3;
  const [x, y] = iso.p(u, v);
  const facing = Math.cos(t * sp + a) >= 0 ? 1 : -1;
  return { x, y, facing, eating: Math.sin(t * 0.3 + a) > 0.3 };
}

function pen(ctx: Ctx, [x, y, w, d]: [number, number, number, number], part: "back" | "front"): void {
  const posts: Pt[] = [];
  const step = 1.1;
  if (part === "back") {
    for (let u = 0; u <= w + 0.01; u += w / Math.round(w / step)) posts.push([x + u, y]);
    for (let v = d / Math.round(d / step); v <= d + 0.01; v += d / Math.round(d / step)) posts.push([x, y + v]);
    for (const z of [8, 15]) {
      line(ctx, [iso.p(x, y + d, z), iso.p(x, y, z), iso.p(x + w, y, z)], C.woodDark, 3);
    }
  } else {
    for (let u = 0; u <= w + 0.01; u += w / Math.round(w / step)) posts.push([x + u, y + d]);
    for (let v = 0; v < d - 0.01; v += d / Math.round(d / step)) posts.push([x + w, y + v]);
    for (const z of [8, 15]) line(ctx, [iso.p(x, y + d, z), iso.p(x + w, y + d, z), iso.p(x + w, y, z)], C.woodDark, 3);
  }
  for (const [u, v] of posts) {
    const [px, py] = iso.p(u, v);
    rrect(ctx, px - 2.3, py - 19, 4.6, 20, 1.2);
    paint(ctx, C.wood, 1.5);
  }
}

function trough(ctx: Ctx, x: number, y: number, len: number, fill: number): void {
  isoBox(ctx, iso, x, y, 0, 0.5, len, 7, C.woodDark);
  if (fill > 0) poly(ctx, iso.quad(x + 0.08, y + 0.1, 0.34, len - 0.2, 7), "#e2c25e", 0);
}

function silo(ctx: Ctx, app: App): void {
  const s = app.game.state;
  const [x, y] = iso.p(SILO[0], SILO[1]);
  shadow(ctx, x, y, 34, 14);
  for (const dx of [-22, 22]) line(ctx, [[x + dx, y + 4], [x + dx * 0.8, y - 40]], C.steel, 4);
  cylinder(ctx, x, y - 34, 30, 92, "#d7dee2");
  // the cone roof
  poly(ctx, [[x - 30, y - 126], [x, y - 152], [x + 30, y - 126]], "#c8d2d8", 2);
  oval(ctx, x, y - 126, 30, 15, null, 2);
  // level window
  const level = clamp(s.feed / app.game.config.feedMax, 0, 1);
  rrect(ctx, x - 7, y - 116, 14, 74, 4);
  paint(ctx, "#5c6b73", 2);
  if (level > 0) {
    rrect(ctx, x - 5, y - 44 - 70 * level, 10, 70 * level, 3);
    paint(ctx, "#e8c45c", 0);
  }
  for (let k = 1; k < 4; k++) line(ctx, [[x - 7, y - 44 - k * 17.5], [x - 3, y - 44 - k * 17.5]], C.white, 1.2);
  text(ctx, `${Math.round(s.feed)}`, x, y - 20, { size: 13, weight: 900, align: "center", color: C.ink, outline: C.white, outlineWidth: 4 });
  // pipe to the troughs
  line(ctx, [[x - 24, y - 50], iso.p(6.9, 1.2, 30), iso.p(6.9, 7.6, 30)], "#8e9aa1", 5);
  if (level < 0.07) bubble(ctx, x, y - 156, "!", { color: "#ffe1d6" });
}

function additiveItem(ctx: Ctx, app: App, kind: Additive, at: Pt, icon: string, hover: boolean): void {
  const on = app.game.state.additives[kind];
  const [x, y] = iso.p(at[0], at[1]);
  shadow(ctx, x, y, 22, 9);
  if (kind === "meal") {
    for (const [dx, dy] of [[-10, 0], [8, 2], [-1, -14]] as Pt[]) {
      rrect(ctx, x + dx - 10, y + dy - 18, 20, 18, 6);
      paint(ctx, "#d9b98a", 2);
      line(ctx, [[x + dx - 8, y + dy - 14], [x + dx + 8, y + dy - 14]], shade("#d9b98a", -0.4), 1.4);
    }
  } else if (kind === "hormones") {
    isoBox(ctx, iso, at[0] - 0.5, at[1] - 0.4, 0, 1.0, 0.8, 36, "#eef6f8");
    const [dx, dy] = iso.p(at[0] - 0.1, at[1] + 0.4, 18);
    rrect(ctx, dx - 7, dy - 9, 14, 16, 2);
    paint(ctx, "#cfe8f0", 1.4);
  } else {
    for (const [dx, dy] of [[-9, 0], [9, 2]] as Pt[]) cylinder(ctx, x + dx, y + dy, 9, 24, "#7a8f4c", 1.8);
    oval(ctx, x - 9, y - 24, 5, 2.4, "#b6d94c", 0);
  }
  if (hover) oval(ctx, x, y, 26, 11, null, 3, C.mustard);
  void on;
  void icon;
}

/** one board shows which additives are in use */
function additiveBoard(ctx: Ctx, app: App): void {
  const { x, y, w, h } = BOARD;
  rrect(ctx, x, y, w, h, 8);
  paint(ctx, C.cream, 2.5);
  for (const sx of [x + 7, x + w - 7]) circle(ctx, sx, y + 6, 2, C.steel, 1);
  ADDITIVES.forEach((a, k) => {
    const on = app.game.state.additives[a.kind];
    const ry = y + 15 + k * 27;
    if (app.hoverId === `add:${a.kind}`) {
      rrect(ctx, x + 4, ry - 12, w - 8, 24, 6);
      paint(ctx, "#fff0c4", 0);
    }
    drawIcon(ctx, a.icon, x + 16, ry, 18, app.now);
    text(ctx, app.t(`additive.${a.kind}`), x + 30, ry + 0.5, { size: 11, weight: 800, max: 86 });
    lamp(ctx, x + w - 52, ry, on, 5);
    pill(ctx, x + w - 8, ry, app.t(on ? "state.on" : "state.off"), on ? "#9fe07c" : "#ddd2c0", { size: 9, align: "right" });
  });
}

function barn(ctx: Ctx): void {
  isoBox(ctx, iso, 8.6, -3.8, 0, 5.4, 3.0, 56, "#c9583f");
  // roof
  const a = iso.p(8.4, -4.0, 56);
  const b = iso.p(14.2, -4.0, 56);
  const c = iso.p(14.2, -0.6, 56);
  const d = iso.p(8.4, -0.6, 56);
  const r1 = iso.p(8.4, -2.3, 84);
  const r2 = iso.p(14.2, -2.3, 84);
  poly(ctx, [d, c, r2, r1], "#7b4a3a", 2);
  poly(ctx, [c, b, r2], "#5e382c", 2);
  void a;
  // door with the cross bars
  const p0 = iso.p(9.6, -0.8, 0);
  const p1 = iso.p(11.2, -0.8, 0);
  poly(ctx, [p0, p1, [p1[0], p1[1] - 40], [p0[0], p0[1] - 40]], "#f4e3c6", 2);
  line(ctx, [p0, [p1[0], p1[1] - 40]], "#c9583f", 3);
  line(ctx, [p1, [p0[0], p0[1] - 40]], "#c9583f", 3);
  // windows
  for (const u of [12, 13.2]) {
    const q0 = iso.p(u, -0.8, 22);
    const q1 = iso.p(u + 0.7, -0.8, 22);
    poly(ctx, [q0, q1, [q1[0], q1[1] - 16], [q0[0], q0[1] - 16]], "#ffe9a3", 1.8);
  }
}

function shed(ctx: Ctx, app: App): void {
  isoBox(ctx, iso, 9.4, 6.2, 0, 3.6, 3.2, 50, "#c9c2b6");
  poly(ctx, iso.quad(9.3, 6.1, 3.8, 3.4, 50), "#8e9aa1", 2);
  // chimney
  isoBox(ctx, iso, 11.8, 6.8, 50, 0.5, 0.5, 26, "#8e9aa1");
  const [cx, cy] = iso.p(12.05, 7.05, 80);
  const busy = app.game.state.pattiesQueued > 0;
  if (busy)
    for (let k = 0; k < 3; k++) {
      const q = (app.now * 0.5 + k / 3) % 1;
      circle(ctx, cx + q * 10, cy - q * 30, 3 + q * 6, `rgba(230,230,230,${0.7 * (1 - q)})`, 0);
    }
  // the gate the cows walk into
  const g0 = iso.p(10, 9.4, 0);
  const g1 = iso.p(11.4, 9.4, 0);
  poly(ctx, [g0, g1, [g1[0], g1[1] - 30], [g0[0], g0[1] - 30]], "#5c4a3c", 2);
  // a patty sign
  const [sx, sy] = iso.p(12.4, 9.4, 34);
  circle(ctx, sx, sy, 11, C.white, 2);
  oval(ctx, sx, sy, 7, 4, "#8a4a2a", 1.4);
}

function conveyor(ctx: Ctx, app: App): void {
  const s = app.game.state;
  const y0 = 7.4;
  const y1 = 8.2;
  poly(ctx, [iso.p(13, y0, 14), iso.p(26, y0, 14), iso.p(26, y1, 14), iso.p(13, y1, 14)], "#5c6b73", 2);
  poly(ctx, [iso.p(13, y1, 14), iso.p(26, y1, 14), iso.p(26, y1, 8), iso.p(13, y1, 8)], "#3e4a50", 2);
  for (let u = 13.6; u < 26; u += 2.2) {
    const [lx, ly] = iso.p(u, y1, 8);
    line(ctx, [[lx, ly], [lx, ly + 8]], "#3e4a50", 2.5);
  }
  // crates of patties on the way
  const n = Math.min(6, Math.ceil((s.inTransit + s.pattiesQueued) / 6));
  for (let k = 0; k < n; k++) {
    const u = 13.2 + ((app.now * 0.9 + k * 2.1) % 12.6);
    isoBox(ctx, iso, u, y0 + 0.1, 14, 0.6, 0.6, 10, "#e4b26a", { lw: 1.6 });
  }
}

function alertsText(app: App): string {
  const a = app.game.feedlotAlerts();
  return a.length ? a.map((k) => app.t(`alert.feedlot.${k}`)).join(" · ") : app.t("alert.none");
}

export class FeedlotScene implements Scene {
  ambience = ["feedlot"];
  private walkers = new Map<number, Walker>();
  private gone: { id: number; x: number; y: number; born: number; kind: "slaughter" | "died" | "destroyed" }[] = [];

  private place(cows: Cow[]): void {
    const used = new Set<string>();
    for (const c of cows) {
      const w = this.walkers.get(c.id);
      if (w) used.add(`${w.pen}:${w.slot}`);
    }
    for (const c of cows) {
      if (this.walkers.has(c.id)) continue;
      for (let k = 0; k < PENS.length * PER_PEN; k++) {
        const pen = k < PER_PEN ? 0 : 1;
        const slot = SLOT_ORDER[k % PER_PEN]!;
        const key = `${pen}:${slot}`;
        if (used.has(key)) continue;
        used.add(key);
        this.walkers.set(c.id, { pen, slot });
        break;
      }
    }
    const ids = new Set(cows.map((c) => c.id));
    for (const id of [...this.walkers.keys()]) if (!ids.has(id)) this.walkers.delete(id);
  }

  draw(ctx: Ctx, app: App): void {
    const s = app.game.state;
    const t = app.now;
    this.place(s.cows);
    ctx.fillStyle = "#b9d27a";
    ctx.fillRect(0, 60, 960, 500);
    for (let k = 0; k < 6; k++) oval(ctx, 80 + k * 170, 120, 130, 44, shade("#a9c96a", -(k % 2) * 0.06), 0);
    poly(ctx, [iso.p(-10, -6), iso.p(30, -6), iso.p(30, 22), iso.p(-10, 22)], "#b4cf72", 0);
    // the yard
    poly(ctx, iso.quad(-0.2, -0.2, 14.6, 10.2), "#d2b98a", 2);
    for (let k = 0; k < 18; k++) {
      const [dx, dy] = iso.p(hash(k) * 14, hash(k + 50) * 10);
      oval(ctx, dx, dy, 6, 2.5, "rgba(140,100,60,0.18)", 0);
    }
    // the road from the farm at the left
    poly(ctx, [iso.p(-1.6, -6), iso.p(-0.6, -6), iso.p(-0.6, 22), iso.p(-1.6, 22)], "#9c9284", 2);
    for (let k = 0; k < 4; k++) {
      const [tx, ty] = iso.p(-3.4 - (k % 2), -3 + k * 2.4);
      drawTree(ctx, tx, ty, 0.9, t, 700 + k);
    }
    // hay bales at the front left
    for (const [u, v] of [[1.6, 11.4], [2.8, 11.2], [2.2, 12.2]] as Pt[]) {
      const [hx, hy] = iso.p(u, v);
      cylinder(ctx, hx, hy, 14, 14, "#e6c86e", 1.8);
    }
    barn(ctx);
    // pens: back fences, troughs, cows, front fences
    PENS.forEach((p, k) => {
      poly(ctx, iso.quad(p[0], p[1], p[2], p[3]), "#c7a46f", 2);
      pen(ctx, p, "back");
      trough(ctx, p[0] + p[2] - 0.6, p[1] + 0.4, p[3] - 0.8, s.feed);
      const cows = s.cows
        .filter((c) => this.walkers.get(c.id)?.pen === k)
        .map((c) => ({ c, at: cowPlace(c, this.walkers.get(c.id)!, t) }))
        .sort((a, b) => a.at.y - b.at.y);
      for (const { c, at } of cows) {
        const fat = clamp((c.weight - app.game.config.minWeight) / (app.game.config.slaughterWeight - app.game.config.minWeight), 0, 1);
        drawCow(ctx, at.x, at.y, c.id, { scale: 0.8, facing: at.facing, t, ill: c.ill, mad: c.mad, eating: at.eating, fat, highlight: app.hoverId === `cow:${c.id}` });
      }
      pen(ctx, p, "front");
    });
    // cows that just left
    this.gone = this.gone.filter((g) => t - g.born < 1.6);
    for (const g of this.gone) {
      const k = (t - g.born) / 1.6;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      if (g.kind === "slaughter") drawCow(ctx, g.x, g.y - k * 30, g.id, { scale: 0.8, t });
      else {
        drawIcon(ctx, g.kind === "died" ? "cow" : "bin", g.x, g.y - 20 - k * 30, 26, t);
      }
      ctx.restore();
    }
    silo(ctx, app);
    // director in front of the barn
    const alerts = app.game.feedlotAlerts();
    const [dx, dy] = iso.p(DIRECTOR_AT[0], DIRECTOR_AT[1]);
    drawPerson(ctx, dx, dy, DIRECTOR, { scale: 1.1, pose: alerts.length ? "wave" : "idle", mood: alerts.length ? "worried" : 4, t, facing: -1, holding: alerts.length ? null : "paper" });
    if (alerts.length) bubble(ctx, dx, dy - 80, "!", { color: "#ffe1d6", size: 14 });
    if (app.hoverId === "director") oval(ctx, dx, dy, 18, 8, null, 3, C.mustard);
    additiveBoard(ctx, app);
    ADDITIVES.forEach((a) => additiveItem(ctx, app, a.kind, a.at, a.icon, app.hoverId === `add:${a.kind}`));
    shed(ctx, app);
    conveyor(ctx, app);
    // capacity sign on the first pen
    const [nx, ny] = iso.p(0.5, 0.5, 46);
    rrect(ctx, nx - 30, ny - 14, 60, 24, 6);
    paint(ctx, C.cream, 2);
    drawIcon(ctx, "cow", nx - 15, ny - 2, 16);
    text(ctx, `${s.cows.length}/${app.game.config.maxCows}`, nx + 9, ny - 1, { size: 13, weight: 900, align: "center" });
  }

  targets(app: App): Target[] {
    const s = app.game.state;
    const g = app.game;
    const out: Target[] = [];
    out.push({
      id: "silo",
      hit: (x, y) => {
        const [sx, sy] = iso.p(SILO[0], SILO[1]);
        return x > sx - 32 && x < sx + 32 && y > sy - 156 && y < sy + 6;
      },
      info: () => ({ title: app.t("silo.title"), text: app.t("silo.text", { n: Math.round(s.feed), max: g.config.feedMax }) }),
      anchor: () => iso.p(SILO[0], SILO[1], 120),
    });
    out.push({
      id: "shed",
      hit: (x, y) => {
        const [gx, gy] = iso.ground(x, y + 25);
        return gx > 9.4 && gx < 13 && gy > 6.2 && gy < 9.4;
      },
      info: () => ({ title: app.t("shed.title"), text: app.t("shed.text", { q: s.pattiesQueued, n: s.inTransit }) }),
      anchor: () => iso.p(11.2, 7.8, 60),
    });
    for (const a of ADDITIVES) {
      out.push({
        id: `add:${a.kind}`,
        hit: (x, y) => {
          const [ax, ay] = iso.p(a.at[0], a.at[1]);
          const row = ADDITIVES.indexOf(a);
          const onBoard = x > BOARD.x && x < BOARD.x + BOARD.w && y > BOARD.y + 3 + row * 27 && y < BOARD.y + 27 + row * 27;
          return onBoard || (x > ax - 24 && x < ax + 24 && y > ay - 44 && y < ay + 8);
        },
        info: () => ({
          title: app.t(`additive.${a.kind}`) + " — " + app.t(s.additives[a.kind] ? "state.on" : "state.off"),
          text: app.t(`additive.${a.kind}.text`),
        }),
        actions: (): Action[] => {
          const on = s.additives[a.kind];
          return [
            {
              icon: a.icon,
              label: app.t(on ? "act.stopAdditive" : "act.useAdditive"),
              on,
              keep: true,
              note: a.kind === "hormones" ? app.t("act.perMonth", { n: g.config.hormoneCost }) : undefined,
              run: () => void g.feedlot.setAdditive(a.kind, !on),
            },
          ];
        },
        anchor: () => [BOARD.x + BOARD.w / 2, BOARD.y - 8],
      });
    }
    out.push({
      id: "director",
      hit: (x, y) => {
        const [dx, dy] = iso.p(DIRECTOR_AT[0], DIRECTOR_AT[1]);
        return x > dx - 16 && x < dx + 16 && y > dy - 70 && y < dy + 4;
      },
      info: () => ({ title: app.t("director.feedlot"), text: alertsText(app) }),
      anchor: () => iso.p(DIRECTOR_AT[0], DIRECTOR_AT[1], 80),
    });
    // cows, front ones first in the hit order (they are drawn last)
    for (const c of s.cows) {
      const w = this.walkers.get(c.id);
      if (!w) continue;
      out.push({
        id: `cow:${c.id}`,
        hit: (x, y) => {
          const at = cowPlace(c, w, app.now);
          return x > at.x - 22 && x < at.x + 22 && y > at.y - 34 && y < at.y + 3;
        },
        info: () => ({
          title: c.name,
          text: app.t("cow.text", { kg: Math.round(c.weight), gain: c.gain + (s.additives.hormones ? g.config.hormoneGain : 0), max: g.config.slaughterWeight }) + (c.mad ? " · " + app.t("cow.mad") : c.ill ? " · " + app.t("cow.ill") : ""),
        }),
        actions: () => [{ icon: "bin", label: app.t("act.destroy"), run: () => void g.feedlot.destroy(c.id) }],
        anchor: () => {
          const at = cowPlace(c, w, app.now);
          return [at.x, at.y - 36];
        },
      });
    }
    out.sort((a, b) => (a.id.startsWith("cow:") && b.id.startsWith("cow:") ? this.depth(a.id, app) - this.depth(b.id, app) : 0));
    return out;
  }

  private depth(id: string, app: App): number {
    const c = app.game.state.cows.find((k) => `cow:${k.id}` === id);
    const w = c && this.walkers.get(c.id);
    return c && w ? cowPlace(c, w, app.now).y : 0;
  }

  event(e: GameEvent, app: App): void {
    const at = (id: number): Pt | null => {
      const c = app.game.state.cows.find((k) => k.id === id);
      const w = this.walkers.get(id);
      if (c && w) {
        const p = cowPlace(c, w, app.now);
        return [p.x, p.y];
      }
      return null;
    };
    switch (e.type) {
      case "cowArrived":
        if (app.sector === "feedlot") app.sound.play(["moo1", "moo2", "moo3"][e.cowId % 3]!, 0.7);
        break;
      case "cowSlaughtered":
      case "cowDied":
      case "cowDestroyed": {
        // the cow is already gone from the state: use its last place
        const w = this.walkers.get(e.cowId);
        let p: Pt = iso.p(10.6, 9.6);
        if (w) {
          const fake = { id: e.cowId } as Cow;
          const q = cowPlace(fake, w, app.now);
          p = [q.x, q.y];
        }
        this.gone.push({ id: e.cowId, x: p[0], y: p[1], born: app.now, kind: e.type === "cowSlaughtered" ? "slaughter" : e.type === "cowDied" ? "died" : "destroyed" });
        if (app.sector === "feedlot") app.sound.play(e.type === "cowSlaughtered" ? "slaughter" : e.type === "cowDied" ? "cowDied" : "cull", 0.8);
        if (e.type === "cowSlaughtered" && (e.ill || e.mad)) app.float({ sector: "feedlot", x: p[0], y: p[1] - 40, text: app.t(e.mad ? "float.madSold" : "float.illSold"), color: C.ketchup });
        break;
      }
      case "cowIll":
      case "cowMad": {
        const p = at(e.cowId);
        if (p) app.float({ sector: "feedlot", x: p[0], y: p[1] - 50, text: app.t(e.type === "cowMad" ? "float.mad" : "float.ill"), color: C.ketchup });
        break;
      }
      case "pattyTrip":
        if (app.sector === "feedlot") app.sound.play("belt", 0.5);
        break;
    }
  }
}
