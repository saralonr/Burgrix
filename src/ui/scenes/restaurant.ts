// Restaurant: the kitchen with three grills along the back wall, the counter with
// three registers, the customers' queues and the manager by the door.
import type { GameEvent, Station, StationId } from "../../sim/index.ts";
import type { Action, App, Scene, Target } from "../core.ts";
import { C, type Ctx, Iso, type Pt, alpha, circle, clamp, cylinder, ease, hash, isoBox, line, oval, paint, poly, rrect, shade, text } from "../draw.ts";
import { drawPerson, drawZzz, randomPerson, type Mood, type Person } from "../people.ts";
import { drawIcon } from "../icons.ts";
import { bubble } from "../widgets.ts";

const iso = new Iso(476, 146, 30);
const LANE = [3, 6.5, 10];
const GRILL_Y = 1.3;
const COUNTER_Y = 4.5;
const QUEUE_Y = 6.1;
const QUEUE_STEP = 0.82;
const BOTTOM_Y = 556;
const MANAGER_AT: Pt = [13, 6.6];
const MANAGER: Person = { skin: "#f1c7a1", hair: "#a33b2a", hairStyle: "pony", shirt: "#3f7fc1", pants: "#2f3a2f", tie: C.mustard };

const COOK = (k: number): Person => ({ skin: ["#e9b48a", "#9a6440", "#f6d2b0"][k]!, hair: ["#3a2618", "#2b2b2b", "#e0b552"][k]!, hairStyle: (["short", "bald", "bun"] as const)[k]!, shirt: "#f4f1ea", pants: "#3d4f6b", hat: "chef", apron: true });
const CASHIER = (k: number): Person => ({ skin: ["#c98c5f", "#f1c7a1", "#6e452b"][k]!, hair: ["#6b3f22", "#2b2b2b", "#3a2618"][k]!, hairStyle: (["bob", "spiky", "curly"] as const)[k]!, shirt: C.teal, pants: "#2f3a2f", hat: "headset", hatColor: C.ketchup });

interface Walk {
  id: number;
  /** when it reached the queue (walk in) */
  born: number;
}
interface Leaving {
  id: number;
  lane: number;
  from: Pt;
  born: number;
  served: boolean;
}

function stationOf(s: Station[], id: StationId): Station {
  return s.find((k) => k.id === id)!;
}

function moodOf(st: Station, yawning: boolean): Mood {
  if (yawning) return "yawn";
  return clamp(Math.round(st.motivation), 1, 4) as 1 | 2 | 3 | 4;
}

export class RestaurantScene implements Scene {
  ambience = ["restaurant", "kitchen"];
  private queues: Walk[][] = [[], [], []];
  private leaving: Leaving[] = [];
  private nextId = 1;
  private yawn = new Map<StationId, number>();
  private busy = new Map<StationId, number>();

  private sync(app: App): void {
    const q = app.game.state.queues;
    for (let k = 0; k < 3; k++) {
      const list = this.queues[k]!;
      while (list.length < q[k]!) list.push({ id: this.nextId++, born: app.now });
      while (list.length > q[k]!) {
        const w = list.pop()!;
        this.leaving.push({ id: w.id, lane: k, from: iso.p(LANE[k]!, QUEUE_Y + list.length * QUEUE_STEP), born: app.now, served: false });
      }
    }
  }

  private room(ctx: Ctx, app: App): void {
    ctx.fillStyle = "#3b2a22";
    ctx.fillRect(0, 60, 960, 500);
    // floor: checkered tiles
    for (let i = 0; i < 10; i++) for (let j = 0; j < 10; j++) poly(ctx, iso.quad(i * 1.45, j * 1.35, 1.45, 1.35), (i + j) % 2 ? "#f3e6cf" : "#e7d3b2", 0);
    poly(ctx, iso.quad(0, 0, 14.5, 13.5), null, 2);
    // the kitchen floor
    poly(ctx, iso.quad(0, 0, 14.5, 3.7), "#d8dde0", 1.5);
    // walls
    const H = 112;
    poly(ctx, [iso.p(0, 0), iso.p(14.5, 0), iso.p(14.5, 0, H), iso.p(0, 0, H)], "#f6c66b", 2);
    poly(ctx, [iso.p(0, 0), iso.p(0, 13.5), iso.p(0, 13.5, H), iso.p(0, 0, H)], "#e9a94e", 2);
    // tiles behind the grills
    poly(ctx, [iso.p(1.6, 0, 6), iso.p(11.4, 0, 6), iso.p(11.4, 0, 56), iso.p(1.6, 0, 56)], "#ffffff", 1.6);
    for (let u = 1.6; u < 11.4; u += 0.7) line(ctx, [iso.p(u, 0, 6), iso.p(u, 0, 56)], "rgba(58,38,24,0.12)", 1);
    // hoods over the grills
    for (const x of LANE) {
      poly(ctx, [iso.p(x - 1, 0, 76), iso.p(x + 1, 0, 76), iso.p(x + 0.8, 1, 62), iso.p(x - 0.8, 1, 62)], "#c3ccd1", 2);
      poly(ctx, [iso.p(x - 0.8, 1, 62), iso.p(x + 0.8, 1, 62), iso.p(x + 0.8, 1, 56), iso.p(x - 0.8, 1, 56)], "#9aa6ad", 2);
    }
    // menu boards on the back wall
    for (let k = 0; k < 3; k++) {
      const u = 2.1 + k * 3.5;
      poly(ctx, [iso.p(u, 0, 84), iso.p(u + 2.8, 0, 84), iso.p(u + 2.8, 0, 110), iso.p(u, 0, 110)], C.night, 2);
      const [mx, my] = iso.p(u + 0.7, 0, 97);
      drawIcon(ctx, ["burger", "patty", "coin"][k]!, mx, my, 16);
      for (let r = 0; r < 2; r++) line(ctx, [iso.p(u + 1.3, 0, 101 - r * 7), iso.p(u + 2.5, 0, 101 - r * 7)], alpha(C.cream, 0.7), 1.6);
    }
    // street windows on the left wall
    for (let k = 0; k < 2; k++) {
      const v0 = 5.4 + k * 3.8;
      const q = [iso.p(0, v0, 30), iso.p(0, v0 + 3, 30), iso.p(0, v0 + 3, 96), iso.p(0, v0, 96)];
      poly(ctx, q, C.sky, 2);
      // a passer-by behind the glass
      const ph = (app.now * 0.08 + k * 0.5) % 1;
      const [px, py] = iso.p(0, v0 + ph * 3, 30);
      ctx.save();
      ctx.beginPath();
      q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.closePath();
      ctx.clip();
      drawPerson(ctx, px - 8, py + 4, randomPerson(90 + k), { pose: "walk", t: app.now, scale: 0.8, facing: -1, mood: 3 });
      ctx.restore();
      line(ctx, [iso.p(0, v0 + 1.5, 30), iso.p(0, v0 + 1.5, 96)], C.ink, 2);
    }
    // a plant
    const [px, py] = iso.p(13.6, 12.4);
    cylinder(ctx, px, py, 12, 16, "#c96a3a");
    for (let k = 0; k < 5; k++) {
      const a = -Math.PI / 2 + (k - 2) * 0.45;
      oval(ctx, px + Math.cos(a) * 12, py - 26 + Math.sin(a) * 10, 5, 9, k % 2 ? C.lettuce : C.pickle, 1.5);
    }
  }

  private fridge(ctx: Ctx, app: App): void {
    const s = app.game.state;
    isoBox(ctx, iso, 0.3, 0.3, 0, 1.4, 1.8, 84, "#e4eaed");
    const [hx, hy] = iso.p(1.7, 1.2, 40);
    line(ctx, [[hx + 3, hy - 14], [hx + 3, hy + 8]], "#8e9aa1", 3);
    const [lx, ly] = iso.p(1.7, 1.2, 70);
    rrect(ctx, lx - 2, ly - 9, 26, 18, 4);
    paint(ctx, C.night, 1.6);
    text(ctx, `${s.patties}`, lx + 11, ly + 0.5, { size: 11, weight: 900, align: "center", color: s.patties < 3 ? "#ff8a7a" : "#9fe07c" });
    drawIcon(ctx, "patty", lx - 9, ly + 18, 16);
    if (app.hoverId === "fridge") poly(ctx, iso.quad(0.3, 0.3, 1.4, 1.8), null, 3, C.mustard);
  }

  private tray(ctx: Ctx, app: App): void {
    const s = app.game.state;
    isoBox(ctx, iso, 11.8, 1.0, 0, 2.2, 1.6, 30, "#c3ccd1");
    // heat lamp
    const [ax, ay] = iso.p(12.9, 1.8, 78);
    line(ctx, [iso.p(12.9, 0.1, 100), [ax, ay]], C.ink, 2);
    poly(ctx, [[ax - 14, ay + 8], [ax + 14, ay + 8], [ax + 8, ay], [ax - 8, ay]], C.ketchup, 1.8);
    oval(ctx, ax, ay + 8, 14, 3, "rgba(255,200,90,0.6)", 0);
    const n = Math.min(12, s.burgers);
    for (let k = 0; k < n; k++) {
      const u = 12.2 + (k % 3) * 0.6;
      const v = 1.3 + Math.floor(k / 3) % 2 * 0.6;
      const z = 30 + Math.floor(k / 6) * 9;
      const [bx, by] = iso.p(u, v, z);
      drawIcon(ctx, "burger", bx, by - 5, 15);
    }
    const [tx, ty] = iso.p(12.9, 2.6, 30);
    text(ctx, `${s.burgers}`, tx + 18, ty + 6, { size: 13, weight: 900, align: "center", outline: C.white });
  }

  private grill(ctx: Ctx, app: App, k: number): void {
    const id = `grill${k + 1}` as StationId;
    const st = stationOf(app.game.state.stations, id);
    const x = LANE[k]!;
    const t = app.now;
    const [cx, cy] = iso.p(x, GRILL_Y - 0.6);
    if (st.staffed) {
      const yawning = (this.yawn.get(id) ?? -9) > t;
      const working = (this.busy.get(id) ?? -9) > t;
      drawPerson(ctx, cx, cy, COOK(k), { pose: yawning ? "yawn" : working ? "work" : "idle", mood: moodOf(st, yawning), t: t + k, facing: 1, holding: "spatula" });
      if (yawning) drawZzz(ctx, cx + 10, cy - 58, t);
      this.badges(ctx, cx, cy, st);
    }
    isoBox(ctx, iso, x - 1, GRILL_Y, 0, 2, 1, 34, "#7f8a90");
    poly(ctx, iso.quad(x - 0.85, GRILL_Y + 0.1, 1.7, 0.8, 34), "#2e2a28", 1.6);
    for (let r = 0; r < 4; r++) line(ctx, [iso.p(x - 0.8, GRILL_Y + 0.2 + r * 0.2, 35), iso.p(x + 0.8, GRILL_Y + 0.2 + r * 0.2, 35)], "#555", 1);
    if (st.staffed && app.game.state.patties > 0) {
      for (let p = 0; p < 2; p++) {
        const [px, py] = iso.p(x - 0.35 + p * 0.7, GRILL_Y + 0.5, 36);
        oval(ctx, px, py, 7, 3.5, "#7a3b20", 1.4);
        const q = (t * 0.7 + p * 0.5 + k) % 1;
        circle(ctx, px + Math.sin(q * 8) * 3, py - 8 - q * 22, 2 + q * 4, `rgba(255,255,255,${0.6 * (1 - q)})`, 0);
      }
    }
    if (!st.staffed) this.vacancy(ctx, cx, cy, app, id);
    if (app.hoverId === `station:${id}`) poly(ctx, iso.quad(x - 1.2, GRILL_Y - 1.2, 2.4, 2.4), null, 3, C.mustard);
  }

  private register(ctx: Ctx, app: App, k: number): void {
    const id = `register${k + 1}` as StationId;
    const st = stationOf(app.game.state.stations, id);
    const x = LANE[k]!;
    const t = app.now;
    const [cx, cy] = iso.p(x, COUNTER_Y - 0.5);
    if (st.staffed) {
      const yawning = (this.yawn.get(id) ?? -9) > t;
      const working = (this.busy.get(id) ?? -9) > t;
      drawPerson(ctx, cx, cy, CASHIER(k), { pose: yawning ? "yawn" : working ? "talk" : "idle", mood: yawning ? "yawn" : working ? "talk" : moodOf(st, false), t: t + k * 2, facing: 1, holding: working ? "tray" : null });
      if (yawning) drawZzz(ctx, cx + 10, cy - 58, t);
      this.badges(ctx, cx, cy, st);
    } else this.vacancy(ctx, cx, cy, app, id);
    if (app.hoverId === `station:${id}`) poly(ctx, iso.quad(x - 1.2, COUNTER_Y - 1.3, 2.4, 2.4), null, 3, C.mustard);
  }

  private badges(ctx: Ctx, x: number, y: number, st: Station): void {
    // motivation dots over the head
    for (let k = 0; k < 4; k++) circle(ctx, x - 9 + k * 6, y - 66, 2.4, k < st.motivation ? (st.motivation <= 1 ? C.ketchup : st.motivation <= 2 ? C.mustard : C.lettuce) : "#d6cbb9", 1.2);
    if (st.badge) drawIcon(ctx, "badge", x - 4, y - 24, 10);
    if (st.warned) drawIcon(ctx, "warn", x + 5, y - 24, 9);
  }

  private vacancy(ctx: Ctx, x: number, y: number, app: App, id: StationId): void {
    ctx.save();
    ctx.globalAlpha = 0.35 + Math.sin(app.now * 3) * 0.08;
    ctx.setLineDash([4, 4]);
    oval(ctx, x, y - 42, 11, 11, null, 2, C.ink);
    ctx.beginPath();
    ctx.moveTo(x - 10, y - 12);
    ctx.lineTo(x - 9, y - 28);
    ctx.lineTo(x + 9, y - 28);
    ctx.lineTo(x + 10, y - 12);
    paint(ctx, null, 2);
    ctx.restore();
    if (app.hoverId === `station:${id}` || Math.sin(app.now * 2) > 0) drawIcon(ctx, "hire", x, y - 42, 18, app.now);
  }

  private counter(ctx: Ctx): void {
    isoBox(ctx, iso, 1.2, COUNTER_Y, 0, 10.6, 0.9, 38, C.ketchup, { top: "#f6efe2" });
    // stripes on the front
    for (let u = 1.6; u < 11.8; u += 0.8) line(ctx, [iso.p(u, COUNTER_Y + 0.9, 4), iso.p(u, COUNTER_Y + 0.9, 34)], alpha(C.white, 0.3), 3);
    for (const x of LANE) {
      isoBox(ctx, iso, x - 0.35, COUNTER_Y + 0.15, 38, 0.7, 0.55, 12, "#3e4a50");
      const [sx, sy] = iso.p(x - 0.1, COUNTER_Y + 0.3, 60);
      poly(ctx, [[sx - 8, sy], [sx + 8, sy + 4], [sx + 8, sy - 6], [sx - 8, sy - 10]], "#9fe07c", 1.6);
    }
  }

  private customers(ctx: Ctx, app: App): void {
    const t = app.now;
    const drawn: { y: number; f: () => void }[] = [];
    this.queues.forEach((list, k) => {
      list.forEach((w, i) => {
        const [qx, qy] = iso.p(LANE[k]!, QUEUE_Y + i * QUEUE_STEP);
        const walk = ease((t - w.born) / 1.2);
        const [sx, sy] = iso.p(13.5, 13.4);
        const x = sx + (qx - sx) * walk;
        const y = sy + (qy - sy) * walk;
        const impatient = i >= 5;
        drawn.push({ y, f: () => drawPerson(ctx, x, y, randomPerson(w.id), { pose: walk < 1 ? "walk" : "idle", t: t + w.id, facing: walk < 1 ? -1 : 1, mood: impatient ? 1 : i >= 3 ? 2 : 3, scale: 0.95 }) });
      });
    });
    this.leaving = this.leaving.filter((l) => t - l.born < 2);
    for (const l of this.leaving) {
      const k = (t - l.born) / 2;
      const [ex, ey] = iso.p(14.5, 9);
      const x = l.from[0] + (ex - l.from[0]) * k;
      const y = l.from[1] + (ey - l.from[1]) * k;
      drawn.push({
        y,
        f: () => {
          ctx.save();
          ctx.globalAlpha = 1 - k * 0.7;
          drawPerson(ctx, x, y, randomPerson(l.id), { pose: "walk", t: t + l.id, facing: 1, mood: l.served ? 4 : 1, scale: 0.95, holding: l.served ? "tray" : null });
          ctx.restore();
        },
      });
    }
    drawn.sort((a, b) => a.y - b.y).forEach((d) => d.f());
  }

  draw(ctx: Ctx, app: App): void {
    this.sync(app);
    this.room(ctx, app);
    this.fridge(ctx, app);
    for (let k = 0; k < 3; k++) this.grill(ctx, app, k);
    this.tray(ctx, app);
    for (let k = 0; k < 3; k++) this.register(ctx, app, k);
    this.counter(ctx);
    this.customers(ctx, app);
    // the manager
    const alerts = app.game.restaurantAlerts();
    const [mx, my] = iso.p(MANAGER_AT[0], MANAGER_AT[1]);
    drawPerson(ctx, mx, my, MANAGER, { scale: 1.08, pose: alerts.length ? "wave" : "idle", mood: alerts.length ? "worried" : 4, t: app.now, facing: -1, holding: alerts.length ? null : "paper" });
    if (alerts.length) bubble(ctx, mx, my - 78, "!", { color: "#ffe1d6", size: 14 });
    if (app.hoverId === "manager") oval(ctx, mx, my, 18, 8, null, 3, C.mustard);
    // queue length sign
    const s = app.game.state;
    const queued = s.queues.reduce((a, b) => a + b, 0);
    rrect(ctx, 14, BOTTOM_Y - 40, 190, 28, 10);
    paint(ctx, C.cream, 2);
    drawIcon(ctx, "hire", 32, BOTTOM_Y - 26, 18);
    text(ctx, app.t("restaurant.footfall", { n: s.footfall, q: queued }), 46, BOTTOM_Y - 25.5, { size: 12, weight: 800, max: 150 });
    void hash;
    void shade;
  }

  targets(app: App): Target[] {
    const g = app.game;
    const s = g.state;
    const out: Target[] = [];
    out.push({
      id: "fridge",
      hit: (x, y) => {
        const [fx, fy] = iso.p(1, 1.2);
        return x > fx - 34 && x < fx + 44 && y > fy - 100 && y < fy + 24;
      },
      info: () => ({ title: app.t("fridge.title"), text: app.t("fridge.text", { n: s.patties, max: g.config.fridgeMax, b: s.burgers }) }),
      anchor: () => iso.p(1, 1.2, 90),
    });
    out.push({
      id: "manager",
      hit: (x, y) => {
        const [mx, my] = iso.p(MANAGER_AT[0], MANAGER_AT[1]);
        return x > mx - 16 && x < mx + 16 && y > my - 70 && y < my + 4;
      },
      info: () => {
        const a = g.restaurantAlerts();
        return { title: app.t("director.restaurant"), text: a.length ? a.map((k) => app.t(`alert.restaurant.${k}`)).join(" · ") : app.t("alert.none") };
      },
      anchor: () => iso.p(MANAGER_AT[0], MANAGER_AT[1], 80),
    });
    for (let k = 0; k < 3; k++)
      for (const kind of ["grill", "register"] as const) {
        const id = `${kind}${k + 1}` as StationId;
        const yy = kind === "grill" ? GRILL_Y - 0.6 : COUNTER_Y - 0.5;
        out.push({
          id: `station:${id}`,
          hit: (x, y) => {
            const [cx, cy] = iso.p(LANE[k]!, yy);
            return x > cx - 26 && x < cx + 26 && y > cy - 70 && y < cy + (kind === "grill" ? 34 : 24);
          },
          info: () => {
            const st = stationOf(s.stations, id);
            const name = app.t(`station.${kind}`, { n: k + 1 });
            if (!st.staffed) return { title: name, text: app.t("station.empty", { n: g.config.crewWage }) };
            const extra = [st.badge ? app.t("station.hasBadge") : "", st.warned ? app.t("station.wasWarned") : ""].filter(Boolean).join(" · ");
            return { title: name, text: app.t(`mood.${clamp(Math.round(st.motivation), 1, 4)}`) + (extra ? " · " + extra : "") };
          },
          actions: (): Action[] => {
            const st = stationOf(s.stations, id);
            if (!st.staffed) return [{ icon: "hire", label: app.t("act.hire"), note: app.t("act.perMonth", { n: g.config.crewWage }), run: () => void g.restaurant.hire(id) }];
            return [
              { icon: "badge", label: app.t("act.badge"), disabled: st.badge, note: app.t("act.badge.note"), run: () => void g.restaurant.badge(id) },
              { icon: "warn", label: app.t("act.warn"), disabled: st.warned, note: app.t("act.warn.note"), run: () => void g.restaurant.warn(id) },
              { icon: "fire", label: app.t("act.fire"), note: app.t("act.fire.note"), run: () => void g.restaurant.fire(id) },
            ];
          },
          anchor: () => iso.p(LANE[k]!, yy, 76),
        });
      }
    return out;
  }

  event(e: GameEvent, app: App): void {
    const here = app.sector === "restaurant";
    switch (e.type) {
      case "burgerCooked":
        this.busy.set(e.station, app.now + 0.9);
        break;
      case "cookYawned":
      case "cashierYawned":
        this.yawn.set(e.station, app.now + 1.6);
        break;
      case "customerServed": {
        const list = this.queues[e.queue]!;
        const w = list.shift();
        if (w) this.leaving.push({ id: w.id, lane: e.queue, from: iso.p(LANE[e.queue]!, QUEUE_Y), born: app.now, served: true });
        this.busy.set(`register${e.queue + 1}` as StationId, app.now + 0.9);
        if (here) {
          const [x, y] = iso.p(LANE[e.queue]!, COUNTER_Y, 80);
          app.float({ sector: "restaurant", x, y, text: "+" + app.money(app.game.config.burgerPrice), color: C.good });
          app.sound.play("till", 0.5);
        }
        break;
      }
      case "customerJoined":
        this.queues[e.queue]?.push({ id: this.nextId++, born: app.now });
        break;
      case "customerLeft":
        if (e.queue !== null) {
          const w = this.queues[e.queue]?.pop();
          if (w) this.leaving.push({ id: w.id, lane: e.queue, from: iso.p(LANE[e.queue]!, QUEUE_Y + (this.queues[e.queue]?.length ?? 0) * QUEUE_STEP), born: app.now, served: false });
        } else if (here) {
          const [x, y] = iso.p(13.5, 12.6, 60);
          app.float({ sector: "restaurant", x, y, text: app.t("float.walkedAway"), color: C.ketchup });
        }
        break;
      case "pattiesArrived":
        if (here) {
          const [x, y] = iso.p(1, 1.2, 100);
          app.float({ sector: "restaurant", x, y, text: `+${e.count}`, color: C.good, icon: "patty" });
          if (e.lost > 0) app.float({ sector: "restaurant", x, y: y + 20, text: app.t("float.lost", { n: e.lost }), color: C.ketchup });
        }
        break;
    }
  }
}
