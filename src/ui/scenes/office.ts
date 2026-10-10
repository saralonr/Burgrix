// Head office: the creative team with the advert posters, the lobbyist with the
// contact board, the board of directors around the table and the reports corner.
import type { CampaignId, GameEvent } from "../../sim/index.ts";
import type { Action, App, Scene, Target } from "../core.ts";
import { C, type Ctx, Iso, type Pt, alpha, circle, clamp, cylinder, isoBox, line, oval, paint, poly, rrect, shade, text } from "../draw.ts";
import { drawPerson, type Mood, type Person } from "../people.ts";
import { drawIcon } from "../icons.ts";
import { bubble, lamp } from "../widgets.ts";
import { ADVERTS, GROUP_COLOR, GROUPS, LOBBIES, campaignWindow, chartWindow, opponentsWindow, sheetWindow } from "../windows.ts";

const iso = new Iso(480, 104, 28);
const WALL = 116;

const CREATIVE_A: Person = { skin: "#f6d2b0", hair: "#c45b8f", hairStyle: "bob", shirt: "#f2c94c", pants: "#3d4f6b", glasses: true };
const CREATIVE_B: Person = { skin: "#9a6440", hair: "#2b2b2b", hairStyle: "spiky", shirt: "#56b5a6", pants: "#5a4632" };
const LOBBYIST: Person = { skin: "#e9b48a", hair: "#8a8a8a", hairStyle: "short", shirt: "#3a3f4a", pants: "#2b2b2b", tie: C.ketchup };
const ANALYST: Person = { skin: "#6e452b", hair: "#3a2618", hairStyle: "bun", shirt: "#9b7ad1", pants: "#3d4f6b", glasses: true };
const BOARD: Person[] = [
  { skin: "#f1c7a1", hair: "#8a8a8a", hairStyle: "bald", shirt: "#3a3f4a", pants: "#222", tie: C.blue, glasses: true },
  { skin: "#c98c5f", hair: "#3a2618", hairStyle: "bob", shirt: "#5a4632", pants: "#222", tie: C.mustard },
  { skin: "#f6d2b0", hair: "#e0b552", hairStyle: "short", shirt: "#2f3a4f", pants: "#222", tie: C.ketchup },
  { skin: "#9a6440", hair: "#8a8a8a", hairStyle: "curly", shirt: "#3a3f4a", pants: "#222", tie: C.lettuce },
];
const CHAIR: Person = { skin: "#e9b48a", hair: "#ffffff", hairStyle: "short", shirt: "#2b2b30", pants: "#222", tie: C.mustard };
const CHAIR_AT: Pt = [3.7, 7.2];
const SCREEN_AT: Pt = [14.3, 6.8];

function wallPoster(ctx: Ctx, app: App, id: CampaignId, v: number): void {
  const on = app.game.state.campaigns[id];
  const q = [iso.p(0, v, 44), iso.p(0, v + 1.9, 44), iso.p(0, v + 1.9, 100), iso.p(0, v, 100)];
  if (on) poly(ctx, [iso.p(0, v - 0.15, 40), iso.p(0, v + 2.05, 40), iso.p(0, v + 2.05, 104), iso.p(0, v - 0.15, 104)], alpha(C.mustard, 0.55 + Math.sin(app.now * 3) * 0.2), 0);
  poly(ctx, q, on ? "#fff6e0" : "#e9dfcf", 2);
  const [cx, cy] = iso.p(0, v + 0.95, 74);
  ctx.save();
  if (!on) ctx.globalAlpha = 0.5;
  drawIcon(ctx, id, cx, cy, 30, app.now);
  ctx.restore();
  const [lx, ly] = iso.p(0, v + 1.6, 52);
  lamp(ctx, lx, ly, on, 4.5);
}

function contactCard(ctx: Ctx, app: App, id: CampaignId, u: number): void {
  const on = app.game.state.campaigns[id];
  const q = [iso.p(u, 0, 50), iso.p(u + 1.3, 0, 50), iso.p(u + 1.3, 0, 90), iso.p(u, 0, 90)];
  poly(ctx, q, on ? "#ffffff" : "#efe6d6", 1.8);
  const [cx, cy] = iso.p(u + 0.65, 0, 72);
  ctx.save();
  if (!on) ctx.globalAlpha = 0.5;
  drawIcon(ctx, id, cx, cy, 24, app.now);
  ctx.restore();
  const [px, py] = iso.p(u + 0.65, 0, 88);
  circle(ctx, px, py, 2.6, on ? C.ketchup : "#8d8478", 1.2);
  const [lx, ly] = iso.p(u + 1.1, 0, 56);
  lamp(ctx, lx, ly, on, 4);
}

function desk(ctx: Ctx, x: number, y: number, w: number, d: number, color = "#d9a066"): void {
  for (const [a, b] of [
    [x + 0.1, y + d - 0.15],
    [x + w - 0.15, y + d - 0.15],
    [x + w - 0.15, y + 0.1],
  ] as Pt[]) {
    const [lx, ly] = iso.p(a, b);
    line(ctx, [[lx, ly], [lx, ly - 30]], C.ink, 3);
  }
  isoBox(ctx, iso, x, y, 30, w, d, 5, color);
}

function monitor(ctx: Ctx, x: number, y: number, t: number): void {
  const [mx, my] = iso.p(x, y, 35);
  line(ctx, [[mx, my], [mx, my - 8]], C.ink, 3);
  rrect(ctx, mx - 13, my - 26, 26, 18, 2);
  paint(ctx, C.night, 2);
  rrect(ctx, mx - 10, my - 23, 20, 12, 1);
  paint(ctx, Math.sin(t * 0.7 + x) > 0 ? "#7fd3e6" : "#a3e3a0", 0);
}

function boardMood(app: App): Mood {
  const s = app.game.state;
  const max = 10;
  if (s.boardAlarm >= max || s.money < app.game.config.bankruptcy / 2) return 1;
  if (s.boardAlarm >= 7) return 2;
  if (s.boardAlarm >= 4) return 3;
  return 4;
}

export class OfficeScene implements Scene {
  ambience = ["town"];

  draw(ctx: Ctx, app: App): void {
    const s = app.game.state;
    const t = app.now;
    ctx.fillStyle = "#2f3b45";
    ctx.fillRect(0, 60, 960, 500);
    // floor: wood planks with two rugs
    poly(ctx, iso.quad(0, 0, 15, 12.5), "#d9b07c", 2);
    for (let v = 0.5; v < 12.5; v += 0.5) line(ctx, [iso.p(0, v), iso.p(15, v)], "rgba(58,38,24,0.1)", 1);
    poly(ctx, iso.quad(3.6, 5.2, 8, 4.6), "#b9483a", 2);
    poly(ctx, iso.quad(4, 5.6, 7.2, 3.8), null, 1.6, alpha(C.mustard, 0.8));
    // walls with big windows onto the town
    poly(ctx, [iso.p(0, 0), iso.p(15, 0), iso.p(15, 0, WALL), iso.p(0, 0, WALL)], "#e8eef1", 2);
    poly(ctx, [iso.p(0, 0), iso.p(0, 12.5), iso.p(0, 12.5, WALL), iso.p(0, 0, WALL)], "#d3dde3", 2);
    const win = [iso.p(4.6, 0, 30), iso.p(7.6, 0, 30), iso.p(7.6, 0, 104), iso.p(4.6, 0, 104)];
    poly(ctx, win, C.sky, 2);
    ctx.save();
    ctx.beginPath();
    win.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.clip();
    // the town outside, with the restaurant's sign
    for (let k = 0; k < 5; k++) {
      const [bx, by] = iso.p(4.8 + k * 0.6, 0, 30);
      rrect(ctx, bx - 8, by - 30 - (k % 3) * 14, 18, 60, 1);
      paint(ctx, ["#c9b79c", "#b6a58b", "#d8c6a8"][k % 3]!, 1.4);
    }
    const [sx, sy] = iso.p(6.1, 0, 74);
    circle(ctx, sx, sy, 9, C.ketchup, 2);
    drawIcon(ctx, "burger", sx, sy, 12);
    ctx.restore();
    line(ctx, [iso.p(6.1, 0, 30), iso.p(6.1, 0, 104)], C.ink, 2);
    // company logo on the back wall
    const [gx, gy] = iso.p(1.6, 0, 92);
    circle(ctx, gx, gy, 14, C.mustard, 2.5);
    drawIcon(ctx, "burger", gx, gy, 18);
    text(ctx, "Burgrix", gx + 22, gy + 6, { size: 16, weight: 900, color: C.ketchup, outline: C.white });

    // adverts: posters on the left wall, the creative desk
    ADVERTS.forEach((id, k) => wallPoster(ctx, app, id, 1 + k * 2.3));
    // lobby: contact cards on the back wall
    LOBBIES.forEach((id, k) => contactCard(ctx, app, id, 9 + k * 1.45));
    if (app.hoverId === "ads") poly(ctx, [iso.p(0, 0.8, 40), iso.p(0, 9.9, 40), iso.p(0, 9.9, 108), iso.p(0, 0.8, 108)], null, 3.5, C.mustard);
    if (app.hoverId === "lobby") poly(ctx, [iso.p(8.8, 0, 46), iso.p(14.9, 0, 46), iso.p(14.9, 0, 94), iso.p(8.8, 0, 94)], null, 3.5, C.mustard);

    // a plant and the water cooler
    const [px, py] = iso.p(14.2, 0.9);
    cylinder(ctx, px, py, 11, 18, "#e2e2e2");
    for (let k = 0; k < 6; k++) oval(ctx, px + Math.cos(k) * 11, py - 34 + Math.sin(k * 2) * 8, 5, 10, k % 2 ? C.lettuce : C.pickle, 1.4);
    const [wx, wy] = iso.p(0.9, 11.3);
    isoBox(ctx, iso, 0.5, 10.9, 0, 0.8, 0.8, 34, "#e4eaed");
    cylinder(ctx, wx, wy - 34, 10, 26, "#9fd3ef");

    // creative team
    desk(ctx, 1.6, 2.2, 2.4, 1.4);
    monitor(ctx, 2.6, 2.7, t);
    drawPerson(ctx, ...iso.p(2.8, 4.3), CREATIVE_A, { pose: "work", mood: 4, t, facing: -1, seated: false });
    // easel with the next campaign
    const [ex, ey] = iso.p(4.8, 2.0);
    line(ctx, [[ex - 10, ey], [ex, ey - 60]], C.woodDark, 2.6);
    line(ctx, [[ex + 10, ey], [ex, ey - 60]], C.woodDark, 2.6);
    rrect(ctx, ex - 18, ey - 58, 36, 30, 2);
    paint(ctx, C.white, 2);
    line(ctx, [[ex - 12, ey - 36], [ex - 4, ey - 46], [ex + 4, ey - 40], [ex + 12, ey - 52]], C.ketchup, 2);
    drawPerson(ctx, ...iso.p(5.4, 3.0), CREATIVE_B, { pose: "talk", mood: "talk", t: t + 1, facing: -1 });

    // lobbyist
    desk(ctx, 9.6, 1.6, 2.6, 1.3, "#8a5a3a");
    monitor(ctx, 11.6, 2.0, t + 2);
    drawPerson(ctx, ...iso.p(10.6, 3.6), LOBBYIST, { pose: "talk", mood: "talk", t: t + 2, facing: 1, holding: "phone" });

    // the board around the table, the chairman at the end
    const mood = boardMood(app);
    BOARD.forEach((p, k) => drawPerson(ctx, ...iso.p(5.2 + k * 1.5, 6.0), p, { pose: "sit", mood, t: t + k, facing: 1, seated: true, lift: 2 }));
    isoBox(ctx, iso, 4.4, 6.4, 26, 6.2, 1.8, 6, "#6b4a33", { top: "#8a603f" });
    for (const [a, b] of [[4.6, 8.0], [10.4, 8.0], [10.4, 6.6]] as Pt[]) {
      const [lx, ly] = iso.p(a, b);
      line(ctx, [[lx, ly], [lx, ly - 26]], C.ink, 3.5);
    }
    for (let k = 0; k < 4; k++) {
      const [dx, dy] = iso.p(5.4 + k * 1.5, 7.1, 32);
      rrect(ctx, dx - 7, dy - 3, 14, 6, 1);
      paint(ctx, C.white, 1.2);
    }
    const alarm = mood === 1;
    const [cx, cy] = iso.p(CHAIR_AT[0], CHAIR_AT[1]);
    drawPerson(ctx, cx, cy, CHAIR, { scale: 1.1, pose: alarm ? "wave" : "talk", mood: alarm ? "worried" : "talk", t, facing: 1 });
    if (alarm) bubble(ctx, cx, cy - 80, "!", { color: "#ffe1d6", size: 14 });
    if (app.hoverId === "board") poly(ctx, iso.quad(4.2, 5.4, 8, 3.4), null, 3.5, C.mustard);

    // reports corner: the screen with the money line and the opponents' bars
    const [mx, my] = iso.p(SCREEN_AT[0], SCREEN_AT[1]);
    line(ctx, [[mx, my], [mx, my - 40]], C.ink, 4);
    oval(ctx, mx, my, 16, 6, "#3e4a50", 2);
    rrect(ctx, mx - 62, my - 120, 124, 84, 6);
    paint(ctx, C.night, 2.5);
    rrect(ctx, mx - 56, my - 114, 112, 72, 3);
    paint(ctx, "#13202a", 0);
    const data = s.chart.slice(-24);
    if (data.length > 1) {
      const lo = Math.min(0, ...data);
      const hi = Math.max(1, ...data);
      ctx.beginPath();
      data.forEach((v, i) => {
        const x = mx - 50 + (i / (data.length - 1)) * 76;
        const y = my - 50 - ((v - lo) / (hi - lo || 1)) * 56;
        if (i) ctx.lineTo(x, y);
        else ctx.moveTo(x, y);
      });
      paint(ctx, null, 2.2, "#9fe07c");
    }
    // the arrow of the last month
    const up = s.lastProfitable;
    const ax = mx + 40;
    const ay = my - 78;
    poly(ctx, up ? [[ax, ay - 16], [ax + 10, ay - 2], [ax + 4, ay - 2], [ax + 4, ay + 14], [ax - 4, ay + 14], [ax - 4, ay - 2], [ax - 10, ay - 2]] : [[ax, ay + 16], [ax + 10, ay + 2], [ax + 4, ay + 2], [ax + 4, ay - 14], [ax - 4, ay - 14], [ax - 4, ay + 2], [ax - 10, ay + 2]], up ? "#6ddc4a" : C.ketchup, 1.6);
    // opponents board
    const [ox, oy] = iso.p(12.6, 11.2);
    line(ctx, [[ox - 30, oy], [ox - 26, oy - 40]], C.woodDark, 3);
    line(ctx, [[ox + 30, oy], [ox + 26, oy - 40]], C.woodDark, 3);
    rrect(ctx, ox - 36, oy - 104, 72, 70, 4);
    paint(ctx, C.white, 2.2);
    GROUPS.forEach((gr, k) => {
      const v = clamp(s.dissent[gr], 0, 100) / 100;
      const bx = ox - 28 + k * 12;
      rrect(ctx, bx, oy - 42 - 54 * v, 9, 54 * v + 1, 1.5);
      paint(ctx, GROUP_COLOR[gr], 1.2);
    });
    line(ctx, [[ox - 32, oy - 69], [ox + 32, oy - 69]], alpha(C.ketchup, 0.6), 1.2);
    drawPerson(ctx, ...iso.p(14.2, 9.4), ANALYST, { pose: "idle", mood: 3, t: t + 3, facing: 1, holding: "paper" });
    if (app.hoverId === "stats") poly(ctx, iso.quad(11.4, 5.6, 3.6, 6.9), null, 3.5, C.mustard);
    void shade;
  }

  targets(app: App): Target[] {
    const s = app.game.state;
    const g = app.game;
    const campaignActions = (ids: CampaignId[]): Action[] =>
      ids.map((id) => ({
        icon: id,
        label: app.t(`camp.${id}`),
        on: s.campaigns[id],
        note: app.t("act.perMonth", { n: g.config.campaignCost[id] }),
        run: () => app.open(campaignWindow(app, id)),
      }));
    return [
      {
        id: "ads",
        hit: (x, y) => {
          const [gx, gy] = iso.ground(x, y);
          return (gx < 6.2 && gy < 5 && gy > 0.6) || (gx < 0.6 && gy < 10 && y < iso.p(0, gy)[1] && y > iso.p(0, gy, 110)[1]);
        },
        info: () => ({ title: app.t("office.ads"), text: app.t("office.ads.text", { n: ADVERTS.filter((k) => s.campaigns[k]).length }) }),
        actions: () => campaignActions(ADVERTS),
        anchor: () => iso.p(2.5, 3, 90),
      },
      {
        id: "lobby",
        hit: (x, y) => {
          const [gx, gy] = iso.ground(x, y);
          return (gx > 8.8 && gx < 13.6 && gy < 4.4 && gy > 0.4) || (gy < 0.6 && gx > 8.6 && x > iso.p(9, 0)[0] - 10 && y > iso.p(gx, 0, 100)[1]);
        },
        info: () => ({ title: app.t("office.lobby"), text: app.t("office.lobby.text", { n: LOBBIES.filter((k) => s.campaigns[k]).length }) }),
        actions: () => campaignActions(LOBBIES),
        anchor: () => iso.p(11, 2.4, 90),
      },
      {
        id: "board",
        hit: (x, y) => {
          const [gx, gy] = iso.ground(x, y + 20);
          return gx > 3 && gx < 11 && gy > 5.2 && gy < 8.8;
        },
        info: () => ({
          title: app.t("office.board"),
          text: app.t("office.board.text", { n: app.money(s.expectation), a: s.boardAlarm }),
        }),
        actions: () => [{ icon: "sheet", label: app.t("report.sheet"), run: () => app.open(sheetWindow(app)) }],
        anchor: () => iso.p(7.6, 7.2, 80),
      },
      {
        id: "stats",
        hit: (x, y) => {
          const [gx, gy] = iso.ground(x, y + 30);
          return gx > 11.4 && gx < 15.5 && gy > 5.6 && gy < 12.5;
        },
        info: () => ({ title: app.t("office.stats"), text: app.t("office.stats.text") }),
        actions: () => [
          { icon: "chart", label: app.t("report.chart"), run: () => app.open(chartWindow(app)) },
          { icon: "sheet", label: app.t("report.sheet"), run: () => app.open(sheetWindow(app)) },
          { icon: "opponents", label: app.t("report.opponents"), run: () => app.open(opponentsWindow(app)) },
        ],
        anchor: () => iso.p(SCREEN_AT[0], SCREEN_AT[1], 130),
      },
    ];
  }

  event(e: GameEvent, app: App): void {
    if (app.sector !== "office") return;
    if (e.type === "monthEnd") app.sound.play("printer", 0.4);
    if (e.type === "boardAlarm") app.sound.play(Math.random() < 0.5 ? "phone1" : "phone2", 0.4);
  }
}
