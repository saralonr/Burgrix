// Window builders: messages, campaign cards, the reports, help, pause and game over.
import type { BalanceSheet, CampaignId, Group } from "../sim/index.ts";
import type { App, Win } from "./core.ts";
import { C, type Ctx, box, circle, clamp, line, paint, paragraph, poly, rrect, text } from "./draw.ts";
import { drawIcon } from "./icons.ts";
import { bar, lamp } from "./widgets.ts";
import { drawPerson, randomPerson } from "./people.ts";

export const GROUPS: Group[] = ["ecologists", "globalists", "consumers", "unions", "obesity"];
export const ADVERTS: CampaignId[] = ["kids", "pyramid", "charity", "toons"];
export const LOBBIES: CampaignId[] = ["politician", "climatologist", "nutritionist", "inspector"];
export const GROUP_COLOR: Record<Group, string> = {
  ecologists: C.lettuce,
  globalists: C.plum,
  consumers: C.blue,
  unions: C.ketchup,
  obesity: C.mustard,
};

/** a plain message with an icon on the left */
export function message(app: App, title: string, body: string, icon = "info", accent?: string): Win {
  return {
    title,
    w: 470,
    h: 250,
    accent,
    body: (ctx, x, y, w) => {
      circle(ctx, x + 44, y + 50, 36, C.paper, 2);
      drawIcon(ctx, icon, x + 44, y + 50, 46, app.now);
      paragraph(ctx, body, x + 100, y + 8, w - 110, { size: 15 });
    },
    buttons: [{ label: app.t("btn.ok"), run: () => app.close() }],
  };
}

export const campaignIcon = (id: CampaignId): string => id;

/** the card of an advert or lobby with its switch */
export function campaignWindow(app: App, id: CampaignId): Win {
  const g = app.game;
  const kind = ADVERTS.includes(id) ? "advert" : "lobby";
  const win: Win = {
    title: app.t(`camp.${id}`),
    w: 520,
    h: 300,
    accent: kind === "advert" ? C.ketchup : C.blue,
    body: (ctx, x, y, w) => {
      const on = g.state.campaigns[id];
      box(ctx, x + 6, y + 6, 120, 150, 12, kind === "advert" ? "#ffe8c2" : "#dcebf7", 2);
      drawIcon(ctx, campaignIcon(id), x + 66, y + 66, 76, app.now);
      lamp(ctx, x + 112, y + 20, on, 7);
      text(ctx, app.t(kind === "advert" ? "camp.kind.advert" : "camp.kind.lobby"), x + 66, y + 136, { size: 12, weight: 800, align: "center", color: kind === "advert" ? C.ketchup : C.blue });
      const hgt = paragraph(ctx, app.t(`camp.${id}.text`), x + 144, y + 6, w - 150, { size: 15 });
      text(ctx, app.t("camp.cost", { n: app.money(g.config.campaignCost[id]) }), x + 144, y + 18 + hgt, { size: 15, weight: 900, base: "top" });
      text(ctx, app.t(on ? "camp.running" : "camp.idle"), x + 144, y + 42 + hgt, { size: 14, weight: 800, base: "top", color: on ? C.good : "#8d8478" });
    },
    buttons: [],
  };
  const refresh = () => {
    const on = g.state.campaigns[id];
    win.buttons = [
      {
        label: app.t(on ? "btn.stop" : "btn.start"),
        color: on ? "#f19b8a" : C.lettuce,
        run: () => {
          g.office.setCampaign(id, !on);
          app.sound.play(on ? "close" : "open", 0.6);
          refresh();
        },
      },
      { label: app.t("btn.close"), run: () => app.close() },
    ];
  };
  refresh();
  return win;
}

/** money at each month end of the current 5-year period */
export function chartWindow(app: App): Win {
  const g = app.game;
  const W = 640;
  const H = 360;
  const win: Win = {
    title: app.t("report.chart"),
    w: W,
    h: H,
    body: (ctx, x, y, w, h) => {
      const s = g.state;
      const data = s.chart;
      const left = x + 70;
      const top = y + 10;
      const cw = w - 90;
      const ch = h - 50;
      box(ctx, left, top, cw, ch, 6, "#fffdf6", 2);
      const lo = Math.min(0, ...data, g.config.bankruptcy * 0.2);
      const hi = Math.max(1000, ...data);
      const Y = (v: number) => top + ch - ((v - lo) / (hi - lo)) * ch;
      const X = (i: number) => left + (i / 59) * cw;
      // grid and labels
      for (let k = 0; k <= 4; k++) {
        const v = lo + ((hi - lo) * k) / 4;
        line(ctx, [[left, Y(v)], [left + cw, Y(v)]], "rgba(58,38,24,0.12)", 1);
        text(ctx, app.money(v), left - 6, Y(v), { size: 11, weight: 700, align: "right" });
      }
      line(ctx, [[left, Y(0)], [left + cw, Y(0)]], C.ink, 1.6);
      const startYear = s.sheets[0]?.year ?? s.year;
      for (let k = 0; k <= 5; k++) {
        const xx = left + (k * 12 * cw) / 59;
        if (k < 5) text(ctx, String(startYear + k), xx + 4, top + ch + 14, { size: 11, weight: 800 });
        line(ctx, [[xx, top + ch], [xx, top + ch + 5]], C.ink, 1.4);
      }
      if (data.length) {
        ctx.beginPath();
        data.forEach((v, i) => (i ? ctx.lineTo(X(i), Y(v)) : ctx.moveTo(X(i), Y(v))));
        paint(ctx, null, 3, C.ketchup);
        data.forEach((v, i) => circle(ctx, X(i), Y(v), 3.2, v >= 0 ? C.mustard : C.ketchup, 1.4));
      } else text(ctx, app.t("report.empty"), left + cw / 2, top + ch / 2, { size: 15, align: "center" });
      win.hits = data.map((_, i) => ({ x: X(i) - x - 6, y: Y(data[i]!) - y - 6, w: 12, h: 12, hover: "sheet", run: () => app.open(sheetWindow(app, i)) }));
    },
    buttons: [{ label: app.t("btn.close"), run: () => app.close() }],
  };
  return win;
}

const MONTH_KEYS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
export const monthName = (app: App, m: number): string => app.t(`month.${MONTH_KEYS[m]!}`);

function lineLabel(app: App, label: string): string {
  if (label.startsWith("fine:")) return app.t("line.fine", { group: app.t(`group.${label.slice(5)}`) });
  if (label in app.game.config.campaignCost) return app.t(`camp.${label}`);
  return app.t(`line.${label}`);
}

/** one month's balance sheet; i indexes state.sheets (default: the latest) */
export function sheetWindow(app: App, index?: number): Win {
  const g = app.game;
  let i = index ?? g.state.sheets.length - 1;
  const win: Win = {
    title: app.t("report.sheet"),
    w: 480,
    h: 420,
    body: (ctx, x, y, w) => {
      const sh: BalanceSheet | undefined = g.state.sheets[i];
      if (!sh) {
        text(ctx, app.t("report.empty"), x + w / 2, y + 120, { size: 15, align: "center" });
        return;
      }
      text(ctx, `${monthName(app, sh.month)} ${sh.year}`, x + w / 2, y + 12, { size: 18, weight: 900, align: "center" });
      let yy = y + 40;
      const row = (label: string, v: number, bold = false, color: string = C.ink) => {
        text(ctx, label, x + 14, yy, { size: 14, weight: bold ? 900 : 700, max: w - 150 });
        text(ctx, app.money(v), x + w - 14, yy, { size: 14, weight: bold ? 900 : 700, align: "right", color });
        yy += 22;
      };
      row(app.t("sheet.income"), sh.income, true, C.good);
      line(ctx, [[x + 10, yy - 10], [x + w - 10, yy - 10]], "rgba(58,38,24,0.2)", 1);
      const lines = sh.lines.slice(0, 9);
      for (const l of lines) row(lineLabel(app, l.label), -l.amount);
      if (sh.lines.length > lines.length) row(app.t("sheet.other"), -sh.lines.slice(9).reduce((a, b) => a + b.amount, 0));
      line(ctx, [[x + 10, yy - 10], [x + w - 10, yy - 10]], "rgba(58,38,24,0.2)", 1);
      row(app.t("sheet.expenses"), -sh.expenses, true, C.bad);
      row(app.t("sheet.profit"), sh.profit, true, sh.profit >= 0 ? C.good : C.bad);
      row(app.t("sheet.money"), sh.money, true, sh.money >= 0 ? C.ink : C.bad);
    },
    buttons: [],
  };
  const refresh = () => {
    win.buttons = [
      { label: "◀", disabled: i <= 0, run: () => ((i = Math.max(0, i - 1)), refresh()) },
      { label: app.t("btn.close"), run: () => app.close() },
      { label: "▶", disabled: i >= g.state.sheets.length - 1, run: () => ((i = Math.min(g.state.sheets.length - 1, i + 1)), refresh()) },
    ];
  };
  refresh();
  return win;
}

export function opponentsWindow(app: App): Win {
  const g = app.game;
  return {
    title: app.t("report.opponents"),
    w: 560,
    h: 430,
    body: (ctx, x, y, w) => {
      const s = g.state;
      GROUPS.forEach((gr, k) => {
        const yy = y + 14 + k * 52;
        const v = s.dissent[gr];
        drawPerson(ctx, x + 30, yy + 38, { ...randomPerson(k * 11 + 3), shirt: GROUP_COLOR[gr] }, { scale: 0.62, mood: v >= 50 ? 1 : v >= 20 ? 2 : 3, pose: v >= 50 ? "wave" : "idle", t: app.now + k });
        text(ctx, app.t(`group.${gr}`), x + 62, yy + 6, { size: 15, weight: 900 });
        bar(ctx, x + 62, yy + 18, w - 150, 16, clamp(v, 0, 100) / 100, v >= 50 ? C.ketchup : v >= 20 ? C.mustard : C.lettuce);
        for (const m of [50]) {
          const mx = x + 62 + ((w - 150) * m) / 100;
          line(ctx, [[mx, yy + 15], [mx, yy + 37]], C.ink, 1.4);
        }
        text(ctx, String(Math.round(v)), x + w - 76, yy + 26, { size: 14, weight: 900 });
      });
      const notes: string[] = [];
      if (s.strikeMonths > 0) notes.push(app.t("opp.strike", { n: s.strikeMonths }));
      if (s.boycotts.length) notes.push(app.t("opp.boycott", { n: s.boycotts.length }));
      if (notes.length) text(ctx, notes.join(" · "), x + w / 2, y + 284, { size: 13, weight: 800, align: "center", color: C.ketchup });
    },
    buttons: [{ label: app.t("btn.close"), run: () => app.close() }],
  };
}

// ---- help

const HELP_ICONS = ["coin", "pasture", "cow", "burger", "chart", "opponents"];
export function helpWindow(app: App, page = 0): Win {
  let p = page;
  const n = HELP_ICONS.length;
  const win: Win = {
    title: app.t("help.title"),
    w: 600,
    h: 340,
    body: (ctx, x, y, w) => {
      circle(ctx, x + 60, y + 70, 50, C.paper, 2.5);
      drawIcon(ctx, HELP_ICONS[p]!, x + 60, y + 70, 64, app.now);
      text(ctx, `${p + 1} / ${n}`, x + 60, y + 150, { size: 13, weight: 800, align: "center", color: "#8d7a64" });
      text(ctx, app.t(`help.${p + 1}.title`), x + 130, y + 10, { size: 19, weight: 900, base: "top" });
      paragraph(ctx, app.t(`help.${p + 1}.text`), x + 130, y + 42, w - 140, { size: 15 });
    },
    buttons: [],
  };
  const refresh = () => {
    win.buttons = [
      { label: "◀", disabled: p === 0, run: () => ((p = Math.max(0, p - 1)), refresh()) },
      { label: app.t(p === n - 1 ? "btn.letsGo" : "btn.close"), run: () => app.close() },
      { label: "▶", disabled: p === n - 1, run: () => ((p = Math.min(n - 1, p + 1)), refresh()) },
    ];
  };
  refresh();
  return win;
}

/** the volume slider used by the pause window and the main menu; returns the track (x, w) */
export function volumeSlider(ctx: Ctx, app: App, x: number, y: number, w: number): [number, number] {
  circle(ctx, x + 14, y, 15, C.blue, 2);
  drawIcon(ctx, "sound", x + 14, y, 20);
  const v = app.sound.level;
  const sx = x + 44;
  const sw = w - 100;
  box(ctx, sx, y - 5, sw, 10, 5, "#e6d6b8", 2);
  rrect(ctx, sx + 2, y - 3, Math.max(6, (sw - 4) * v), 6, 3);
  paint(ctx, C.mustard, 0);
  circle(ctx, sx + sw * v, y, 10, C.cream, 2.5);
  text(ctx, `${Math.round(v * 100)}%`, x + w - 4, y + 1, { size: 14, weight: 900, align: "right" });
  return [sx, sw];
}

export function pauseWindow(app: App): Win {
  const win: Win = {
    id: "pause",
    title: app.t("pause.title"),
    w: 440,
    h: 240,
    body: (ctx, x, y, w) => {
      text(ctx, app.t("pause.volume"), x + 10, y + 16, { size: 15, weight: 900 });
      const [sx, sw] = volumeSlider(ctx, app, x + 10, y + 58, w - 20);
      win.hits = [{ x: sx - x - 10, y: 40, w: sw + 20, h: 36, drag: (f) => app.sound.setLevel((f * (sw + 20) - 10) / sw) }];
    },
    buttons: [
      { label: app.t("btn.resume"), color: C.lettuce, run: () => app.close() },
      { label: app.t("btn.help"), run: () => app.open(helpWindow(app)) },
      { label: app.t("btn.menu"), color: "#f19b8a", run: () => app.quit() },
    ],
  };
  return win;
}

export function gameOverWindow(app: App, months: number, best: number | null): Win {
  return {
    id: "gameover",
    title: app.t("over.title"),
    w: 520,
    h: 320,
    accent: C.ketchup,
    body: (ctx, x, y, w) => {
      // the board leaves the building
      for (let k = 0; k < 3; k++) drawPerson(ctx, x + 50 + k * 40, y + 150, { ...randomPerson(k + 200), shirt: "#3a3f4a", tie: C.ketchup }, { mood: 1, pose: "walk", t: app.now + k, facing: -1, scale: 0.9, holding: "paper" });
      poly(ctx, [[x + 20, y + 160], [x + 200, y + 160], [x + 200, y + 164], [x + 20, y + 164]], C.ink, 0);
      paragraph(ctx, app.t("over.text"), x + 220, y + 6, w - 230, { size: 15 });
      text(ctx, app.t("over.months", { n: months }), x + 220, y + 120, { size: 17, weight: 900, base: "top" });
      if (best !== null) text(ctx, app.t("over.best", { n: best }), x + 220, y + 146, { size: 14, weight: 800, base: "top", color: "#8d7a64" });
    },
    buttons: [
      { label: app.t("btn.newGame"), color: C.lettuce, run: () => app.newGame() },
      { label: app.t("btn.menu"), run: () => app.quit() },
    ],
  };
}
