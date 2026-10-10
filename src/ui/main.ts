// Burgrix: boots the game, runs the weekly clock, draws the screen and routes the
// pointer. Rules live in src/sim/, texts in public/game/<lang>.json, sounds in
// public/game/sounds.json.
import { createGame, type Game, type GameEvent, type Group } from "../sim/index.ts";
import { Sound } from "../audio/sound.ts";
import type { SynthSpec } from "../audio/synth.ts";
import { SECTORS, type Action, type App, type Floater, type Scene, type Sector, type Target, type Vars, type Win } from "./core.ts";
import { C, type Ctx, H, W, box, clamp, fmt, line, paint, rrect, text } from "./draw.ts";
import { BOTTOM, TOP, drawBottom, drawTop, type HudButton, type HudState, type Info } from "./hud.ts";
import { drawIcon } from "./icons.ts";
import { drawMenuArt } from "./menu.ts";
import { FarmScene } from "./scenes/farm.ts";
import { FeedlotScene } from "./scenes/feedlot.ts";
import { OfficeScene } from "./scenes/office.ts";
import { RestaurantScene } from "./scenes/restaurant.ts";
import { GROUP_COLOR, gameOverWindow, helpWindow, message, pauseWindow, volumeSlider } from "./windows.ts";
import { button, inside, panel, tile, type Rect } from "./widgets.ts";

const BASE = "./game/";
const LANGUAGES = ["tr", "en"];
const WEEK_MS = 1000;
const FAST_MS = 380;
const ROW_TILE = 48;
const BEST_KEY = "burgrix.best";
const HELPED_KEY = "burgrix.helped";
const LOADING: Record<string, string> = { tr: "Yükleniyor…", en: "Loading…" };

const store = {
  get(k: string): string | null {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k: string, v: string): void {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* storage blocked */
    }
  },
};

async function json<T>(name: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(BASE + name);
    return r.ok ? ((await r.json()) as T) : fallback;
  } catch {
    return fallback;
  }
}

async function loadFonts(): Promise<void> {
  if (typeof FontFace === "undefined") return;
  const files = [
    ["nunito-latin.woff2", "U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD"],
    ["nunito-latin-ext.woff2", "U+0100-02BA, U+02BD-02C5, U+02C7-02CC, U+02CE-02D7, U+02DD-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1E9F, U+1EF2-1EFF, U+2020, U+20A0-20AB, U+20AD-20C4, U+2113, U+2C60-2C7F, U+A720-A7FF"],
  ];
  await Promise.all(
    files.map(async ([file, range]) => {
      try {
        const face = new FontFace("Nunito", `url(${BASE}fonts/${file})`, { weight: "400 900", unicodeRange: range });
        await face.load();
        document.fonts.add(face);
      } catch {
        /* the fallback font is used */
      }
    }),
  );
}

interface Row {
  target: Target;
  /** frozen anchor so the row does not follow walking cows */
  at: [number, number];
}

class Burgrix implements App {
  game: Game = createGame();
  lang: string;
  texts: Record<string, string> = {};
  sound = new Sound();
  now = 0;
  sector: Sector = "farm";
  hoverId: string | null = null;
  paused = false;

  private ctx: Ctx;
  private screen: "menu" | "game" = "menu";
  private scenes: Record<Sector, Scene> = { farm: new FarmScene(), feedlot: new FeedlotScene(), restaurant: new RestaurantScene(), office: new OfficeScene() };
  private windows: Win[] = [];
  private floaters: Floater[] = [];
  private row: Row | null = null;
  private hud: HudState = { hover: null, fast: false };
  private hudButtons: HudButton[] = [];
  private menuButtons: (Rect & { id: string; run(): void })[] = [];
  private pointer: [number, number] = [-1, -1];
  private dragging: ((fx: number) => void) | null = null;
  private dragRect: Rect | null = null;
  private acc = 0;
  private last = 0;
  private view = { s: 1, x: 0, y: 0, dpr: 1 };
  private seen = new Set<Sector>();
  private alertsBefore = { feedlot: 0, restaurant: 0 };
  private boardShown = false;
  private redShown = false;
  private overShown = false;
  private hold = { hidden: document.hidden };

  constructor(
    private canvas: HTMLCanvasElement,
    lang: string,
  ) {
    this.ctx = canvas.getContext("2d")!;
    this.lang = lang;
  }

  // ---- App

  t = (key: string, vars?: Vars): string => {
    let s = this.texts[key] ?? key;
    if (vars) for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(String(v));
    return s;
  };

  money = (n: number): string => fmt(n, this.lang);

  float(f: Omit<Floater, "born" | "sector"> & { sector?: Sector | null }): void {
    this.floaters.push({ ...f, sector: f.sector === undefined ? this.sector : f.sector, born: this.now });
    if (this.floaters.length > 40) this.floaters.shift();
  }

  open(w: Win): void {
    this.windows.push(w);
    this.row = null;
    this.sound.play("open", 0.5);
  }

  close(w?: Win): void {
    const top = w ?? this.windows[this.windows.length - 1];
    if (!top) return;
    this.windows = this.windows.filter((k) => k !== top);
    top.onClose?.();
    this.sound.play("close", 0.5);
  }

  setSector(s: Sector): void {
    if (s === this.sector && this.screen === "game") return;
    this.sector = s;
    this.row = null;
    this.sound.play("click", 0.6);
    this.scenes[s].enter?.(this);
    this.sound.setLoops(this.scenes[s].ambience, 0.8);
    if (!this.seen.has(s)) {
      this.seen.add(s);
      this.open(message(this, this.t(`intro.${s}.title`), this.t(`intro.${s}.text`), ["pasture", "cow", "burger", "chart"][SECTORS.indexOf(s)]!));
    }
  }

  quit(): void {
    this.windows = [];
    this.row = null;
    this.screen = "menu";
    this.sound.setLoops(["theme"], 0.7);
  }

  newGame(): void {
    this.game = createGame({ cowNames: this.cowNames() });
    this.scenes = { farm: new FarmScene(), feedlot: new FeedlotScene(), restaurant: new RestaurantScene(), office: new OfficeScene() };
    this.windows = [];
    this.floaters = [];
    this.row = null;
    this.paused = false;
    this.acc = 0;
    this.seen.clear();
    this.boardShown = this.redShown = this.overShown = false;
    this.alertsBefore = { feedlot: 0, restaurant: 0 };
    this.screen = "game";
    this.sector = "office";
    this.setSector("farm");
    if (!store.get(HELPED_KEY)) {
      store.set(HELPED_KEY, "1");
      this.open(helpWindow(this));
    }
  }

  private cowNames(): string[] {
    const list = this.texts["cow.names"];
    return list ? list.split(",").map((s) => s.trim()).filter(Boolean) : createGame().config.cowNames;
  }

  // ---- setup

  async setLanguage(lang: string): Promise<void> {
    this.lang = lang;
    document.documentElement.lang = lang;
    this.texts = await json<Record<string, string>>(`${lang}.json`, {});
  }

  bind(): void {
    const c = this.canvas;
    const pos = (e: PointerEvent | MouseEvent): [number, number] => {
      const r = c.getBoundingClientRect();
      return [(e.clientX - r.left - this.view.x) / this.view.s, (e.clientY - r.top - this.view.y) / this.view.s];
    };
    c.addEventListener("pointermove", (e) => {
      this.pointer = pos(e);
      if (this.dragging && this.dragRect) this.dragging(clamp((this.pointer[0] - this.dragRect.x) / this.dragRect.w, 0, 1));
    });
    c.addEventListener("pointerdown", (e) => {
      this.sound.unlock();
      this.pointer = pos(e);
      c.setPointerCapture?.(e.pointerId);
      this.press(this.pointer[0], this.pointer[1]);
    });
    c.addEventListener("pointerup", (e) => {
      this.pointer = pos(e);
      if (this.dragging) {
        this.dragging = null;
        this.dragRect = null;
        return;
      }
      this.click(this.pointer[0], this.pointer[1]);
      if (e.pointerType !== "mouse") this.pointer = [-1, -1];
    });
    c.addEventListener("pointerleave", () => (this.pointer = [-1, -1]));
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const top = this.windows[this.windows.length - 1];
        if (top && top.id !== "gameover") this.close();
        else if (this.row) this.row = null;
        else if (this.screen === "game") this.open(pauseWindow(this));
      } else if (e.key === " " && this.screen === "game" && !this.windows.length) {
        this.paused = !this.paused;
        e.preventDefault();
      } else if (this.screen === "game" && !this.windows.length && ["1", "2", "3", "4"].includes(e.key)) this.setSector(SECTORS[Number(e.key) - 1]!);
    });
    // a hidden tab stops the clock and the sound
    document.addEventListener("visibilitychange", () => {
      this.hold.hidden = document.hidden;
      this.sound.setMuted(document.hidden);
    });
    window.addEventListener("resize", () => this.resize());
    this.resize();
  }

  resize(): void {
    const dpr = Math.min(2.5, window.devicePixelRatio || 1);
    const cw = this.canvas.clientWidth || window.innerWidth;
    const ch = this.canvas.clientHeight || window.innerHeight;
    this.canvas.width = Math.round(cw * dpr);
    this.canvas.height = Math.round(ch * dpr);
    const s = Math.min(cw / W, ch / H);
    this.view = { s, x: (cw - W * s) / 2, y: (ch - H * s) / 2, dpr };
  }

  start(): void {
    this.sound.setLoops(["theme"], 0.7);
    const frame = (ms: number) => {
      this.step(ms / 1000);
      this.render();
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  // ---- clock

  private modal(): boolean {
    return this.windows.some((w) => !w.live);
  }

  private running(): boolean {
    return this.screen === "game" && !this.game.state.gameOver && !this.paused && !this.modal() && !this.hold.hidden;
  }

  private step(now: number): void {
    const dt = this.last ? Math.min(0.25, now - this.last) : 0;
    this.last = now;
    this.now = now;
    if (this.running()) {
      this.acc += dt * 1000;
      const ms = this.hud.fast ? FAST_MS : WEEK_MS;
      while (this.acc >= ms && !this.modal()) {
        this.acc -= ms;
        this.handle(this.game.tick());
      }
    }
  }

  private handle(events: GameEvent[]): void {
    for (const e of events) {
      for (const s of SECTORS) this.scenes[s].event?.(e, this);
      this.react(e);
    }
    // a new alert in a sector rings the bell
    for (const k of ["feedlot", "restaurant"] as const) {
      const n = k === "feedlot" ? this.game.feedlotAlerts().length : this.game.restaurantAlerts().length;
      if (n > 0 && this.alertsBefore[k] === 0) {
        this.sound.play("alarm", 0.5);
        if (this.sector === k) this.sound.play("hey", 0.5);
      }
      this.alertsBefore[k] = n;
    }
  }

  private react(e: GameEvent): void {
    const s = this.game.state;
    const groupWin = (key: string, group: Group, vars: Vars = {}) =>
      this.open(message(this, this.t(`${key}.${group}.title`), this.t(`${key}.${group}.text`, vars), "opponents", GROUP_COLOR[group]));
    switch (e.type) {
      case "warning":
        groupWin("warn", e.group);
        break;
      case "protest":
        groupWin("protest", e.group, {
          n: e.group === "unions" ? this.game.config.strikeMonths : this.game.config.boycottMonths,
          fine: this.money(e.group === "obesity" ? this.game.config.obesityFine : this.game.config.consumerFine),
        });
        this.sound.play("voice" + (1 + Math.floor(Math.random() * 6)), 0.6);
        break;
      case "fine":
        this.float({ sector: null, x: 120, y: 74, text: "−" + this.money(e.amount), color: C.bad });
        break;
      case "monthEnd":
        this.sound.play("tick", 0.4);
        this.float({ sector: null, x: 120, y: 74, text: (e.profit >= 0 ? "+" : "−") + this.money(Math.abs(e.profit)), color: e.profit >= 0 ? C.good : C.bad });
        break;
      case "newYear":
        this.float({ sector: null, x: 698, y: 78, text: String(e.year), color: C.mustard });
        break;
      case "boardAlarm":
        if (e.level >= 10 && !this.boardShown) {
          this.boardShown = true;
          this.open(message(this, this.t("board.title"), this.t("board.text", { n: this.money(s.expectation) }), "chart", C.ketchup));
        } else if (e.level < 7) this.boardShown = false;
        break;
      case "redAccount":
        if (!this.redShown) {
          this.redShown = true;
          this.open(message(this, this.t("red.title"), this.t("red.text", { n: this.money(this.game.config.bankruptcy) }), "coin", C.ketchup));
        }
        break;
      case "townMood":
        if (e.mood === "deserted") this.open(message(this, this.t("town.deserted.title"), this.t("town.deserted.text"), "pasture", C.ketchup));
        else this.float({ sector: "farm", x: 760, y: 120, text: this.t(`town.${e.mood}`), color: e.mood === "content" ? C.good : C.ketchup });
        break;
      case "gameOver":
        this.over();
        break;
    }
    if (s.money >= this.game.config.bankruptcy / 2) this.redShown = false;
  }

  private over(): void {
    if (this.overShown) return;
    this.overShown = true;
    const months = Math.floor(this.game.state.weeks / 4);
    const best = Number(store.get(BEST_KEY) ?? 0) || 0;
    if (months > best) store.set(BEST_KEY, String(months));
    this.windows = [];
    this.row = null;
    this.sound.setLoops([]);
    this.sound.play("gameOver", 0.8);
    this.open(gameOverWindow(this, months, Math.max(best, months)));
  }

  // ---- input

  private winLayout(w: Win): { box: Rect; body: Rect; buttons: (Rect & { b: Win["buttons"][number] })[] } {
    const x = (W - w.w) / 2;
    const y = Math.max(TOP + 8, (TOP + BOTTOM - w.h) / 2);
    const body = { x: x + 24, y: y + 58, w: w.w - 48, h: w.h - 58 - 74 };
    const n = w.buttons.length;
    const bw = Math.min(170, (w.w - 48 - (n - 1) * 12) / Math.max(1, n));
    const total = n * bw + (n - 1) * 12;
    const buttons = w.buttons.map((b, i) => ({ x: x + (w.w - total) / 2 + i * (bw + 12), y: y + w.h - 62, w: bw, h: 44, b }));
    return { box: { x, y, w: w.w, h: w.h }, body, buttons };
  }

  private rowTiles(): (Rect & { a: Action })[] {
    if (!this.row) return [];
    const acts = this.row.target.actions?.() ?? [];
    if (!acts.length) return [];
    const n = acts.length;
    const gap = 10;
    const total = n * ROW_TILE + (n - 1) * gap;
    const x0 = clamp(this.row.at[0] - total / 2, 14, W - total - 14);
    const y = clamp(this.row.at[1] - 34, TOP + 40, BOTTOM - 44);
    return acts.map((a, i) => ({ x: x0 + i * (ROW_TILE + gap), y: y - ROW_TILE / 2, w: ROW_TILE, h: ROW_TILE, a }));
  }

  private sceneTarget(x: number, y: number): Target | null {
    if (y < TOP || y > BOTTOM) return null;
    const list = this.scenes[this.sector].targets(this);
    for (let i = list.length - 1; i >= 0; i--) if (list[i]!.hit(x, y)) return list[i]!;
    return null;
  }

  private press(x: number, y: number): void {
    const top = this.windows[this.windows.length - 1];
    if (!top) {
      this.pressMenu(x, y);
      return;
    }
    const { body } = this.winLayout(top);
    for (const h of top.hits ?? []) {
      const r = { x: body.x + h.x, y: body.y + h.y, w: h.w, h: h.h };
      if (h.drag && inside(r, x, y)) {
        this.dragging = h.drag;
        this.dragRect = r;
        h.drag(clamp((x - r.x) / r.w, 0, 1));
      }
    }
  }

  private click(x: number, y: number): void {
    const top = this.windows[this.windows.length - 1];
    if (top) {
      const L = this.winLayout(top);
      for (const b of L.buttons)
        if (inside(b, x, y) && !b.b.disabled) {
          this.sound.play("click", 0.6);
          b.b.run();
          return;
        }
      for (const h of top.hits ?? []) {
        const r = { x: L.body.x + h.x, y: L.body.y + h.y, w: h.w, h: h.h };
        if (inside(r, x, y) && h.run) {
          this.sound.play("click", 0.6);
          h.run();
          return;
        }
      }
      return;
    }
    if (this.screen === "menu") {
      for (const b of this.menuButtons)
        if (inside(b, x, y)) {
          this.sound.play("click", 0.6);
          b.run();
          return;
        }
      return;
    }
    for (const b of this.hudButtons)
      if (inside(b, x, y)) {
        if (b.id === "menu") this.open(pauseWindow(this));
        else {
          this.sound.play("click", 0.6);
          b.run();
        }
        return;
      }
    for (const tl of this.rowTiles())
      if (inside(tl, x, y)) {
        if (tl.a.disabled) return;
        this.sound.play("click", 0.7);
        tl.a.run();
        if (!tl.a.keep) this.row = null;
        return;
      }
    const t = this.sceneTarget(x, y);
    if (t && t.actions && t.actions().length) {
      if (this.row?.target.id === t.id) this.row = null;
      else {
        this.row = { target: t, at: t.anchor() };
        this.sound.play("tick", 0.5);
      }
      return;
    }
    if (t?.click) t.click();
    this.row = null;
  }

  // ---- drawing

  render(): void {
    const ctx = this.ctx;
    const v = this.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = "#1a120c";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.setTransform(v.s * v.dpr, 0, 0, v.s * v.dpr, v.x * v.dpr, v.y * v.dpr);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, W, H);
    ctx.clip();
    const [px, py] = this.pointer;
    let info: Info | null = null;
    const top = this.windows[this.windows.length - 1];

    if (this.screen === "menu") this.drawMenu(px, py, !top);
    else {
      // hover: action row first, then the scene
      const tiles = this.rowTiles();
      const overTile = !top ? tiles.find((r) => inside(r, px, py)) : undefined;
      const hudHover = !top ? this.hudButtons.find((b) => inside(b, px, py)) : undefined;
      const target = !top && !overTile && !hudHover ? this.sceneTarget(px, py) : null;
      this.hoverId = target?.id ?? this.row?.target.id ?? null;
      this.hud.hover = hudHover?.id ?? null;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, TOP, W, BOTTOM - TOP);
      ctx.clip();
      this.scenes[this.sector].draw(ctx, this);
      this.drawFloaters(ctx, this.sector);
      if (this.paused) this.drawPausedBanner(ctx);
      ctx.restore();
      this.drawRow(ctx, tiles, overTile);
      this.hudButtons = drawTop(ctx, this, this.hud);
      this.drawFloaters(ctx, null);
      if (overTile) info = { title: overTile.a.label, cost: overTile.a.cost, earn: overTile.a.earn, note: overTile.a.note };
      else if (hudHover) info = { title: hudHover.hint };
      else if (target) info = target.info();
      else if (this.row) info = this.row.target.info();
      drawBottom(ctx, this, info);
      this.canvas.style.cursor = overTile || hudHover || target ? "pointer" : "default";
    }
    if (top) {
      ctx.fillStyle = "rgba(26,18,12,0.5)";
      ctx.fillRect(0, 0, W, H);
      for (const w of this.windows) this.drawWindow(ctx, w, w === top ? [px, py] : [-1, -1]);
    }
    ctx.restore();
  }

  private drawPausedBanner(ctx: Ctx): void {
    const pulse = 0.75 + Math.sin(this.now * 3) * 0.25;
    ctx.save();
    ctx.globalAlpha = pulse;
    box(ctx, W / 2 - 90, BOTTOM - 50, 180, 36, 18, C.cream, 2.5);
    text(ctx, this.t("hud.paused"), W / 2, BOTTOM - 31, { size: 16, weight: 900, align: "center" });
    ctx.restore();
  }

  private drawFloaters(ctx: Ctx, sector: Sector | null): void {
    this.floaters = this.floaters.filter((f) => this.now - f.born < 1.8);
    for (const f of this.floaters) {
      if (f.sector !== sector) continue;
      const k = (this.now - f.born) / 1.8;
      ctx.save();
      ctx.globalAlpha = 1 - k * k;
      const y = f.y - k * 40;
      if (f.icon) drawIcon(ctx, f.icon, f.x - 22, y, 18);
      text(ctx, f.text, f.x, y, { size: 15, weight: 900, color: f.color, outline: C.white, outlineWidth: 4, align: "center" });
      ctx.restore();
    }
  }

  private drawRow(ctx: Ctx, tiles: (Rect & { a: Action })[], over?: Rect & { a: Action }): void {
    if (!tiles.length || !this.row) return;
    const x0 = tiles[0]!.x - 10;
    const x1 = tiles[tiles.length - 1]!.x + ROW_TILE + 10;
    const y0 = tiles[0]!.y - 10;
    // a pointer from the row to the thing it belongs to
    const [ax, ay] = this.row.at;
    const tipX = clamp(ax, x0 + 16, x1 - 16);
    ctx.beginPath();
    ctx.moveTo(tipX - 10, y0 + ROW_TILE + 18);
    ctx.lineTo(clamp(ax, x0, x1), Math.min(ay + 14, y0 + ROW_TILE + 40));
    ctx.lineTo(tipX + 10, y0 + ROW_TILE + 18);
    paint(ctx, "#4a3426", 2);
    box(ctx, x0, y0, x1 - x0, ROW_TILE + 20, 16, "#4a3426", 2.5);
    for (const tl of tiles) tile(ctx, tl.x + ROW_TILE / 2, tl.y + ROW_TILE / 2, ROW_TILE, tl.a.icon, { hover: tl === over, on: tl.a.on, disabled: tl.a.disabled, t: this.now });
    // the label of the hovered button above the row
    if (over) {
      const label = over.a.label;
      ctx.font = "800 13px Nunito, Arial";
      const w = ctx.measureText(label).width + 20;
      const lx = clamp(over.x + ROW_TILE / 2 - w / 2, 6, W - w - 6);
      box(ctx, lx, y0 - 30, w, 24, 10, C.cream, 2);
      text(ctx, label, lx + w / 2, y0 - 17.5, { size: 13, weight: 800, align: "center" });
    }
  }

  private drawWindow(ctx: Ctx, w: Win, [px, py]: [number, number]): void {
    const L = this.winLayout(w);
    const { x, y } = L.box;
    panel(ctx, x, y, w.w, w.h, C.cream, 16);
    rrect(ctx, x, y, w.w, 46, 16);
    ctx.save();
    ctx.clip();
    ctx.fillStyle = w.accent ?? C.mustard;
    ctx.fillRect(x, y, w.w, 46);
    ctx.restore();
    line(ctx, [[x, y + 46], [x + w.w, y + 46]], C.ink, 2.5);
    box(ctx, x, y, w.w, w.h, 16, null, 2.5);
    text(ctx, w.title, x + w.w / 2, y + 24, { size: 19, weight: 900, align: "center", color: w.accent && w.accent !== C.mustard ? C.white : C.ink, outline: w.accent && w.accent !== C.mustard ? C.ink : undefined, outlineWidth: 4, max: w.w - 40 });
    ctx.save();
    ctx.beginPath();
    ctx.rect(L.body.x - 8, L.body.y - 8, L.body.w + 16, L.body.h + 16);
    ctx.clip();
    w.body(ctx, L.body.x, L.body.y, L.body.w, L.body.h, this);
    ctx.restore();
    for (const b of L.buttons) button(ctx, b, b.b.label, { hover: inside(b, px, py), color: b.b.color, disabled: b.b.disabled, icon: b.b.icon });
    const overHit = (w.hits ?? []).some((h) => h.run && inside({ x: L.body.x + h.x, y: L.body.y + h.y, w: h.w, h: h.h }, px, py));
    if (overHit || L.buttons.some((b) => inside(b, px, py))) this.canvas.style.cursor = "pointer";
  }

  private drawMenu(px: number, py: number, active: boolean): void {
    const ctx = this.ctx;
    drawMenuArt(ctx, this);
    const play: Rect = { x: 580, y: 432, w: 240, h: 56 };
    const help: Rect = { x: 580, y: 500, w: 240, h: 44 };
    button(ctx, play, this.t("menu.play"), { hover: active && inside(play, px, py), color: C.mustard, size: 22, icon: "play" });
    button(ctx, help, this.t("menu.help"), { hover: active && inside(help, px, py), color: C.cream, size: 16 });
    // volume
    box(ctx, 40, 512, 300, 44, 22, "rgba(255,244,221,0.92)", 2);
    const [sx, sw] = volumeSlider(ctx, this, 50, 534, 280);
    this.menuButtons = [
      { ...play, id: "play", run: () => this.newGame() },
      { ...help, id: "help", run: () => this.open(helpWindow(this)) },
    ];
    // the slider is dragged directly on the menu
    if (this.dragging === null && active) this.menuSlider = { x: sx - 10, y: 514, w: sw + 20, h: 40, sw };
    this.canvas.style.cursor = active && (inside(play, px, py) || inside(help, px, py)) ? "pointer" : "default";
    const best = Number(store.get(BEST_KEY) ?? 0);
    if (best > 0) text(ctx, this.t("menu.best", { n: best }), 700, 420, { size: 13, weight: 800, color: "rgba(255,244,221,0.85)", align: "center" });
  }

  menuSlider: (Rect & { sw: number }) | null = null;

  /** pointer down on the menu's volume slider */
  pressMenu(x: number, y: number): boolean {
    const r = this.menuSlider;
    if (this.screen !== "menu" || this.windows.length || !r || !inside(r, x, y)) return false;
    const set = (f: number) => this.sound.setLevel((f * r.w - 10) / r.sw);
    this.dragging = set;
    this.dragRect = r;
    set(clamp((x - r.x) / r.w, 0, 1));
    return true;
  }
}

/** ?lang= first, then the browser's languages, then Turkish */
function pickLanguage(): string {
  const wanted = [new URLSearchParams(location.search).get("lang"), ...(navigator.languages ?? [navigator.language])];
  for (const l of wanted) {
    const base = l?.toLowerCase().slice(0, 2);
    if (base && LANGUAGES.includes(base)) return base;
  }
  return "tr";
}

async function boot(): Promise<void> {
  const lang = pickLanguage();
  const loading = document.getElementById("loading");
  if (loading) loading.textContent = LOADING[lang] ?? LOADING.tr!;
  const canvas = document.getElementById("stage") as HTMLCanvasElement;
  const app = new Burgrix(canvas, lang);
  await Promise.all([app.setLanguage(lang), loadFonts()]);
  app.sound.setSpecs(await json<Record<string, SynthSpec>>("sounds.json", {}));
  app.bind();
  app.start();
  loading?.remove();
  if (import.meta.env.DEV) (window as unknown as { burgrix: Burgrix }).burgrix = app;
}

void boot();
