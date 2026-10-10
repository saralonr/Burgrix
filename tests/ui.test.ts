// Interface checks without a browser: every text and sound the screens use exists,
// every scene and window draws through a long game without throwing, and the
// published files carry no names from elsewhere.
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createGame, type Game } from "../src/sim/index.ts";
import type { App, Floater, Sector, Win } from "../src/ui/core.ts";
import { ICONS } from "../src/ui/icons.ts";
import { FarmScene } from "../src/ui/scenes/farm.ts";
import { FeedlotScene } from "../src/ui/scenes/feedlot.ts";
import { RestaurantScene } from "../src/ui/scenes/restaurant.ts";
import { OfficeScene } from "../src/ui/scenes/office.ts";
import { drawBottom, drawTop } from "../src/ui/hud.ts";
import { drawMenuArt } from "../src/ui/menu.ts";
import { ADVERTS, GROUPS, LOBBIES, campaignWindow, chartWindow, gameOverWindow, helpWindow, message, opponentsWindow, pauseWindow, sheetWindow } from "../src/ui/windows.ts";
import type { Ctx } from "../src/ui/draw.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (p: string) => readFileSync(join(root, p), "utf8");
const tr = JSON.parse(read("public/game/tr.json")) as Record<string, string>;
const en = JSON.parse(read("public/game/en.json")) as Record<string, string>;
const sounds = JSON.parse(read("public/game/sounds.json")) as Record<string, unknown>;

function files(dir: string, out: string[] = []): string[] {
  for (const f of readdirSync(join(root, dir))) {
    const p = join(dir, f);
    if (statSync(join(root, p)).isDirectory()) files(p, out);
    else out.push(p);
  }
  return out;
}
const uiSources = files("src/ui").map((f) => read(f));

/** keys built from parts at run time */
function dynamicKeys(): string[] {
  const k: string[] = [];
  const sectors = ["farm", "feedlot", "restaurant", "office"];
  for (const s of sectors) k.push(`tab.${s}`, `hint.${s}`, `intro.${s}.title`, `intro.${s}.text`);
  for (const m of ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"]) k.push(`month.${m}`);
  for (const s of ["winter", "spring", "summer", "autumn"]) k.push(`season.${s}`);
  for (const p of ["forest", "village", "empty", "grain", "pasture", "soy", "desert"]) k.push(`plot.${p}`, `plot.${p}.text`);
  for (const s of ["sowing", "growing", "harvested"]) k.push(`soy.${s}`);
  for (const w of ["clearing", "burning"]) k.push(`work.${w}`);
  for (const p of ["clear", "burn", "take", "to"]) k.push(`act.${p}Pasture`, `act.${p}Soy`);
  for (const m of ["content", "short", "hungry", "deserted"]) k.push(`town.${m}`);
  for (const g of GROUPS) k.push(`group.${g}`, `warn.${g}.title`, `warn.${g}.text`, `protest.${g}.title`, `protest.${g}.text`);
  for (const c of [...ADVERTS, ...LOBBIES]) k.push(`camp.${c}`, `camp.${c}.text`);
  for (const a of ["meal", "hormones", "waste"]) k.push(`additive.${a}`, `additive.${a}.text`);
  for (const a of ["crowded", "noCows", "lowFeed", "fullFeed", "illCow", "madCow"]) k.push(`alert.feedlot.${a}`);
  for (const a of ["lowMorale", "noPatties", "fridgeFull", "needGrills", "needRegisters"]) k.push(`alert.restaurant.${a}`);
  for (const l of ["pasture", "soy", "clearPasture", "clearSoy", "bribe", "gm", "pastureUpkeep", "soyUpkeep", "wages", "hormones"]) k.push(`line.${l}`);
  for (let n = 1; n <= 4; n++) k.push(`mood.${n}`);
  for (let n = 1; n <= 6; n++) k.push(`help.${n}.title`, `help.${n}.text`);
  for (const s of ["grill", "register"]) k.push(`station.${s}`);
  return k;
}

describe("texts", () => {
  it("has the same keys in Turkish and English, none empty", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(tr).sort());
    for (const [k, v] of [...Object.entries(tr), ...Object.entries(en)]) expect(v.trim(), k).not.toBe("");
  });

  it("covers every key the screens ask for", () => {
    const used = new Set<string>(dynamicKeys());
    for (const src of uiSources) for (const m of src.matchAll(/\bt\(\s*"([a-zA-Z]+\.[a-zA-Z0-9.]+)"/g)) used.add(m[1]!);
    for (const src of uiSources) for (const m of src.matchAll(/\? "([a-z]+\.[a-zA-Z0-9.]+)" : "([a-z]+\.[a-zA-Z0-9.]+)"/g)) used.add(m[1]!).add(m[2]!);
    const missing = [...used].filter((k) => !(k in tr) && !k.startsWith("burgrix."));
    expect(missing).toEqual([]);
  });

  it("keeps the same placeholders in both languages", () => {
    const vars = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
    for (const k of Object.keys(tr)) expect(vars(en[k]!), k).toEqual(vars(tr[k]!));
  });

  it("gives every cow a name in both languages", () => {
    expect(tr["cow.names"]!.split(",").length).toBeGreaterThanOrEqual(30);
    expect(en["cow.names"]!.split(",").length).toBeGreaterThanOrEqual(30);
  });
});

describe("sounds and icons", () => {
  it("plays only sounds that are defined", () => {
    const used = new Set<string>();
    for (const src of uiSources) {
      for (const m of src.matchAll(/sound\.play\(\s*"(\w+)"\s*[,)]/g)) used.add(m[1]!);
      for (const m of src.matchAll(/setLoops\(\[([^\]]*)\]/g)) for (const n of m[1]!.matchAll(/"(\w+)"/g)) used.add(n[1]!);
      for (const m of src.matchAll(/ambience = \[([^\]]*)\]/g)) for (const n of m[1]!.matchAll(/"(\w+)"/g)) used.add(n[1]!);
    }
    for (const n of ["moo1", "moo2", "moo3", "phone1", "phone2", "voice1", "voice6"]) used.add(n);
    expect([...used].filter((n) => !(n in sounds))).toEqual([]);
  });

  it("draws every icon an action, a campaign or an additive names", () => {
    const names = new Set<string>([...ADVERTS, ...LOBBIES, "meal", "hormones", "waste"]);
    for (const src of uiSources) for (const m of src.matchAll(/icon: "(\w+)"/g)) names.add(m[1]!);
    for (const src of uiSources) for (const m of src.matchAll(/drawIcon\(ctx, "(\w+)"/g)) names.add(m[1]!);
    expect([...names].filter((n) => !ICONS[n])).toEqual([]);
  });
});

// ---- drawing smoke test on a recording canvas

function fakeCtx(): Ctx & { calls: number } {
  const gradient = { addColorStop: () => {} };
  const state = { calls: 0 };
  const target: Record<string, unknown> = {
    measureText: (s: string) => ({ width: s.length * 7 }),
    createLinearGradient: () => gradient,
    createRadialGradient: () => gradient,
    setLineDash: () => {},
  };
  return new Proxy(target, {
    get(t, k) {
      if (k === "calls") return state.calls;
      if (k in t) return t[k as string];
      return (...args: unknown[]) => {
        state.calls++;
        for (const a of args) if (typeof a === "number" && !Number.isFinite(a)) throw new Error(`${String(k)} got ${a}`);
      };
    },
    set(t, k, v) {
      t[k as string] = v;
      return true;
    },
  }) as unknown as Ctx & { calls: number };
}

function fakeApp(game: Game): App & { wins: Win[] } {
  const wins: Win[] = [];
  const app = {
    game,
    t: (k: string, v?: Record<string, string | number>) => {
      let s = tr[k] ?? k;
      for (const [a, b] of Object.entries(v ?? {})) s = s.split(`{${a}}`).join(String(b));
      return s;
    },
    lang: "tr",
    sound: { play: () => {}, setLoops: () => {}, level: 0.2, setLevel: () => {} },
    now: 0,
    sector: "farm" as Sector,
    hoverId: null,
    paused: false,
    float: (_f: Partial<Floater>) => {},
    open: (w: Win) => void wins.push(w),
    close: () => void wins.pop(),
    money: (n: number) => String(Math.round(n)),
    setSector: (s: Sector) => void (app.sector = s),
    quit: () => {},
    newGame: () => {},
    wins,
  };
  return app as unknown as App & { wins: Win[] };
}

describe("drawing", () => {
  it("draws the menu, every scene, the bars and every window through ten busy years", () => {
    const game = createGame({}, 7);
    const app = fakeApp(game);
    const ctx = fakeCtx();
    const scenes = { farm: new FarmScene(), feedlot: new FeedlotScene(), restaurant: new RestaurantScene(), office: new OfficeScene() };
    drawMenuArt(ctx, app);
    const g = game;
    g.farm.bribeMayor();
    [0, 6, 7, 11, 16].forEach((i) => g.farm.makePasture(i));
    [2, 3, 8, 12].forEach((i) => g.farm.sowSoy(i));
    g.farm.setGm(12, true);
    g.feedlot.setAdditive("meal", true);
    g.feedlot.setAdditive("hormones", true);
    g.restaurant.hire("grill2");
    g.restaurant.hire("register2");
    for (const c of [...ADVERTS, ...LOBBIES]) g.office.setCampaign(c, true);
    for (let w = 0; w < 520 && !g.state.gameOver; w++) {
      app.now = w * 0.7;
      const events = g.tick();
      for (const s of Object.values(scenes)) for (const e of events) s.event?.(e, app);
      if (w % 13 === 0) {
        for (const [name, s] of Object.entries(scenes)) {
          app.sector = name as Sector;
          s.draw(ctx, app);
          for (const t of s.targets(app)) {
            t.info();
            t.anchor();
            t.hit(480, 300);
            for (const a of t.actions?.() ?? []) expect(a.label).not.toMatch(/^act\./);
          }
          drawTop(ctx, app, { hover: null, fast: false });
          drawBottom(ctx, app, { title: "x", cost: 10, earn: 5, note: "n", text: "t" });
        }
      }
    }
    const wins = [
      message(app, "a", "b"),
      campaignWindow(app, "toons"),
      chartWindow(app),
      sheetWindow(app),
      sheetWindow(app, 0),
      opponentsWindow(app),
      helpWindow(app, 5),
      pauseWindow(app),
      gameOverWindow(app, 12, 30),
    ];
    for (const w of wins) {
      w.body(ctx, 100, 100, w.w - 48, w.h - 132, app);
      expect(w.w).toBeLessThanOrEqual(960);
      expect(w.h).toBeLessThanOrEqual(480);
      for (const b of w.buttons) expect(b.label).not.toMatch(/^btn\./);
    }
    expect(ctx.calls).toBeGreaterThan(10000);
  });
});

describe("clean repository", () => {
  const namesFile = join(root, "assets-src", "clean-names.json");
  it.skipIf(!existsSync(namesFile))("ships no names, brands or studios from other games", () => {
    const check = new RegExp((JSON.parse(readFileSync(namesFile, "utf8")) as { check: string }).check, "i");
    const tracked = [
      ...files("src"),
      ...files("public"),
      ...files("tests").filter((f) => !f.endsWith("ui.test.ts")),
      ...files("docs"),
      "index.html",
      "README.md",
      "GDD.md",
      "package.json",
      ".gitignore",
    ].filter((f) => !/\.(woff2|jpg|png)$/.test(f));
    const hits = tracked.filter((f) => check.test(read(f)));
    expect(hits).toEqual([]);
  });

  it("loads nothing from other servers and runs no dynamic code", () => {
    const code = [...files("src"), "index.html"].map((f) => [f, read(f)] as const);
    for (const [f, src] of code) {
      expect(src, f).not.toMatch(/https?:\/\//);
      expect(src, f).not.toMatch(/eval\(|new Function\(|innerHTML|document\.write/);
    }
    expect(read("index.html")).toContain("Content-Security-Policy");
  });

  it("publishes no converted game data", () => {
    const pub = files("public");
    expect(pub.filter((f) => /swf|visuals|patches|overrides/i.test(f))).toEqual([]);
    expect(existsSync(join(root, "src", "flash"))).toBe(false);
  });
});
