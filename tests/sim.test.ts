import { describe, expect, it } from "vitest";
import { createGame, defaultConfig } from "../src/sim/index.ts";
import type { Config, Game, GameEvent, GameState } from "../src/sim/index.ts";

// no random illness unless a test asks for it
const quiet: Partial<Config> = { illnessBase: 1e9, bseBase: 1e9 };
const rich: Partial<Config> = { ...quiet, startMoney: 1e7 };

const run = (g: Game, n: number): GameEvent[] => {
  const out: GameEvent[] = [];
  for (let i = 0; i < n; i++) out.push(...g.tick());
  return out;
};
const months = (g: Game, n: number): GameEvent[] => run(g, n * 4);
const mut = (g: Game): GameState => g.state as GameState;
const ofType = <T extends GameEvent["type"]>(evs: GameEvent[], t: T) =>
  evs.filter((e): e is Extract<GameEvent, { type: T }> => e.type === t);
const line = (g: Game, label: string) => g.state.lines.find((l) => l.label === label)?.amount;

describe("initial state", () => {
  it("map, money, staff, fridge", () => {
    const g = createGame(undefined, 1);
    const s = g.state;
    expect(s.plots.map((p) => p.kind)).toEqual([
      "forest", "forest", "forest", "grain", "forest",
      "forest", "village", "empty", "grain", "forest",
      "forest", "empty", "empty", "grain", "empty",
      "empty", "empty", "empty", "grain", "empty",
    ]);
    expect(s.plots.every((p) => p.fertility === 180 && p.herd.length === 0 && !p.work)).toBe(true);
    expect(s.money).toBe(50000);
    expect(s.year).toBe(2000);
    expect(s.month).toBe(0);
    expect(s.week).toBe(1);
    expect(s.season).toBe("winter");
    expect(s.feed).toBe(1000);
    expect(s.patties).toBe(90);
    expect(s.burgers).toBe(40);
    expect(s.townMood).toBe("content");
    expect(s.footfall).toBe(1);
    expect(s.expectation).toBe(400);
    expect(s.stations.filter((x) => x.staffed).map((x) => x.id)).toEqual(["grill1", "register1"]);
    expect(s.stations.find((x) => x.id === "grill1")!.motivation).toBe(4);
    expect(s.cows).toHaveLength(0);
    expect(JSON.parse(JSON.stringify(s))).toEqual(s);
  });

  it("cows arrive in week 1 only", () => {
    const g = createGame(quiet, 2);
    const ev = g.tick();
    expect(ofType(ev, "cowArrived")).toHaveLength(3);
    expect(g.state.cows).toHaveLength(3);
    for (const c of g.state.cows) {
      expect(c.weight).toBe(480);
      expect([38, 50, 62]).toContain(c.gain);
      expect(defaultConfig.cowNames).toContain(c.name);
    }
    expect(new Set(g.state.cows.map((c) => c.id)).size).toBe(3);
    expect(ofType(g.tick(), "cowArrived")).toHaveLength(0);
  });

  it("cow names are used in turn", () => {
    const g = createGame({ ...quiet, cowNames: ["A", "B"] }, 1);
    g.tick();
    expect(g.state.cows.map((c) => c.name)).toEqual(["A", "B", "A"]);
  });
});

describe("calendar", () => {
  it("weeks, months, years", () => {
    const g = createGame(rich, 1);
    run(g, 3);
    expect(g.state.week).toBe(4);
    expect(g.state.month).toBe(0);
    const ev = g.tick();
    expect(g.state.week).toBe(1);
    expect(g.state.month).toBe(1);
    expect(g.state.weeks).toBe(4);
    expect(ofType(ev, "monthEnd")).toHaveLength(1);
    const ev2 = months(g, 11);
    expect(g.state.year).toBe(2001);
    expect(g.state.month).toBe(0);
    expect(ofType(ev2, "newYear")).toEqual([{ type: "newYear", year: 2001 }]);
  });

  it("seasons change in week 3 of March, June, September, December", () => {
    const g = createGame(rich, 1);
    run(g, 9);
    expect(g.state.season).toBe("winter");
    let ev = g.tick();
    expect(g.state.month).toBe(2);
    expect(g.state.week).toBe(3);
    expect(g.state.season).toBe("spring");
    expect(ofType(ev, "season")).toEqual([{ type: "season", season: "spring" }]);
    expect(ofType(ev, "harvest")).toHaveLength(1);
    run(g, 12);
    expect(g.state.season).toBe("summer");
    run(g, 12);
    expect(g.state.season).toBe("autumn");
    run(g, 11);
    expect(g.state.season).toBe("autumn");
    ev = g.tick();
    expect(g.state.season).toBe("winter");
    expect(g.state.month).toBe(11);
  });
});

describe("money", () => {
  it("month-end charges belong to the new month, with labels", () => {
    const g = createGame(rich, 1);
    g.farm.makePasture(7);
    g.farm.makePasture(11);
    expect(line(g, "pasture")).toBe(9600);
    expect(g.state.lines.filter((l) => l.label === "pasture")).toHaveLength(1);
    expect(g.state.expenses).toBe(9600);
    g.restaurant.hire("grill2");
    g.office.setCampaign("toons", true);
    g.feedlot.setAdditive("hormones", true);
    months(g, 1);
    const sheet = g.state.sheets[0];
    expect(sheet.year).toBe(2000);
    expect(sheet.month).toBe(0);
    expect(sheet.expenses).toBe(9600);
    expect(sheet.lines).toEqual([{ label: "pasture", amount: 9600 }]);
    expect(sheet.profit).toBe(sheet.income - sheet.expenses);
    expect(line(g, "pastureUpkeep")).toBe(280);
    expect(line(g, "wages")).toBe(3 * 420);
    expect(line(g, "toons")).toBe(880);
    expect(line(g, "hormones")).toBe(15);
    expect(line(g, "pasture")).toBeUndefined();
    expect(g.state.expenses).toBe(280 + 1260 + 880 + 15);
    expect(g.state.income).toBe(0);
  });

  it("bankruptcy ends the game", () => {
    const g = createGame({ ...quiet, startMoney: -40000 }, 1);
    const ev = months(g, 1);
    expect(g.state.gameOver).toBe(true);
    expect(ofType(ev, "gameOver")).toHaveLength(1);
    expect(g.tick()).toEqual([]);
    expect(g.farm.makePasture(7)).toEqual({ ok: false, reason: "over" });
    expect(g.restaurant.hire("grill2")).toEqual({ ok: false, reason: "over" });
    expect(g.office.setCampaign("kids", true)).toEqual({ ok: false, reason: "over" });
    expect(g.feedlot.setAdditive("meal", true)).toEqual({ ok: false, reason: "over" });
  });

  it("red account warning below half the bankruptcy line", () => {
    const g = createGame({ ...quiet, startMoney: -20000 }, 1);
    const ev = months(g, 1);
    expect(g.state.gameOver).toBe(false);
    expect(ofType(ev, "redAccount")).toHaveLength(1);
  });
});

describe("farm actions", () => {
  it("empty plot: pasture and soy", () => {
    const g = createGame(rich, 1);
    expect(g.farm.cost(7, "pasture")).toBe(4800);
    expect(g.farm.cost(7, "soy")).toBe(9600);
    expect(g.farm.makePasture(7)).toEqual({ ok: true });
    expect(g.state.money).toBe(1e7 - 4800);
    expect(g.state.plots[7].kind).toBe("pasture");
    expect(g.state.plots[7].herd).toEqual([0, 0]);
    expect(g.state.plots[7].fertility).toBe(100);
    expect(g.farm.sowSoy(11)).toEqual({ ok: true });
    expect(g.state.plots[11].kind).toBe("soy");
    expect(g.state.plots[11].soyStage).toBe("sowing");
    expect(line(g, "soy")).toBe(9600);
    expect(ofType(g.tick(), "plotChanged").map((e) => e.plot)).toEqual([7, 11]);
  });

  it("forest clearing: cost, dissent, work weeks", () => {
    const g = createGame(rich, 1);
    expect(g.farm.cost(0, "pasture")).toBe(3200);
    expect(g.farm.cost(0, "soy")).toBe(7800);
    g.farm.makePasture(0);
    g.farm.sowSoy(1);
    expect(line(g, "clearPasture")).toBe(3200);
    expect(line(g, "clearSoy")).toBe(7800);
    expect(g.state.dissent.ecologists).toBe(80);
    expect(g.state.dissent.globalists).toBe(20);
    expect(g.state.plots[0].work).toEqual({ type: "clearing", target: "pasture", weeksLeft: 3 });
    expect(g.farm.sowSoy(0)).toEqual({ ok: false, reason: "busy" });
    expect(g.farm.sell(0)).toEqual({ ok: false, reason: "busy" });
    expect(g.farm.cost(0, "soy")).toBeNull();
    run(g, 2);
    expect(g.state.plots[0].kind).toBe("forest");
    const ev = g.tick();
    expect(ofType(ev, "workDone").map((e) => e.plot)).toEqual([0, 1]);
    expect(g.state.plots[0].kind).toBe("pasture");
    expect(g.state.plots[0].herd).toEqual([0, 0]);
    expect(g.state.plots[0].fertility).toBe(100);
    expect(g.state.plots[1].kind).toBe("soy");
    expect(g.state.plots[1].soyStage).toBe("sowing");
    expect(g.state.plots[0].work).toBeNull();
  });

  it("village burning", () => {
    const g = createGame(rich, 1);
    g.farm.makePasture(6);
    expect(g.state.dissent.globalists).toBe(45);
    expect(g.state.dissent.ecologists).toBe(0);
    expect(g.state.plots[6].work?.type).toBe("burning");
    expect(line(g, "clearPasture")).toBe(3200);
    run(g, 3);
    expect(g.state.plots[6].kind).toBe("pasture");
    const h = createGame(rich, 1);
    h.farm.sowSoy(6);
    expect(line(h, "clearSoy")).toBe(7800);
    run(h, 3);
    expect(h.state.plots[6].kind).toBe("soy");
  });

  it("grain plots need the bribe", () => {
    const g = createGame(rich, 1);
    expect(g.farm.makePasture(3)).toEqual({ ok: false, reason: "rule" });
    expect(g.farm.cost(3, "pasture")).toBeNull();
    expect(g.farm.bribeMayor()).toEqual({ ok: true });
    expect(line(g, "bribe")).toBe(9500);
    expect(g.farm.bribeMayor()).toEqual({ ok: false, reason: "rule" });
    expect(g.farm.cost(3, "pasture")).toBe(4800);
    expect(g.farm.sowSoy(3)).toEqual({ ok: true });
    expect(g.state.plots[3].kind).toBe("soy");
  });

  it("pasture herd, conversion and sale", () => {
    const g = createGame(rich, 1);
    g.farm.makePasture(7);
    expect(g.farm.addCow(7)).toEqual({ ok: true });
    expect(g.farm.addCow(7)).toEqual({ ok: false, reason: "rule" });
    expect(g.state.plots[7].herd).toHaveLength(3);
    for (let i = 0; i < 3; i++) expect(g.farm.removeCow(7)).toEqual({ ok: true });
    expect(g.farm.removeCow(7)).toEqual({ ok: false, reason: "rule" });
    expect(g.farm.makePasture(7)).toEqual({ ok: false, reason: "rule" });
    const before = g.state.money;
    expect(g.farm.sell(7)).toEqual({ ok: true });
    expect(g.state.money).toBe(before + 2400);
    expect(g.state.income).toBe(2400);
    expect(g.state.plots[7].kind).toBe("empty");
    g.farm.makePasture(7);
    expect(g.farm.sowSoy(7)).toEqual({ ok: true });
    expect(g.state.plots[7].kind).toBe("soy");
    expect(g.state.plots[7].herd).toEqual([]);
    expect(g.farm.addCow(7)).toEqual({ ok: false, reason: "rule" });
  });

  it("soy: gm, back to pasture, sale", () => {
    const g = createGame(rich, 1);
    g.farm.sowSoy(7);
    expect(g.farm.setGm(7, true)).toEqual({ ok: true });
    expect(g.state.plots[7].gm).toBe(true);
    expect(g.farm.setGm(11, true)).toEqual({ ok: false, reason: "rule" });
    months(g, 1);
    expect(line(g, "gm")).toBe(25);
    expect(line(g, "soyUpkeep")).toBe(140);
    expect(g.state.dissent.consumers).toBe(1);
    expect(g.farm.makePasture(7)).toEqual({ ok: true });
    expect(g.state.plots[7].kind).toBe("pasture");
    expect(g.state.plots[7].gm).toBe(false);
    expect(g.state.plots[7].herd).toEqual([0, 0]);
    g.farm.sowSoy(11);
    const before = g.state.money;
    expect(g.farm.sell(11)).toEqual({ ok: true });
    expect(g.state.money).toBe(before + 4800);
  });

  it("invalid plots and desert", () => {
    const g = createGame(rich, 1);
    expect(g.farm.makePasture(20)).toEqual({ ok: false, reason: "rule" });
    expect(g.farm.makePasture(-1)).toEqual({ ok: false, reason: "rule" });
    mut(g).plots[7].kind = "desert";
    expect(g.farm.makePasture(7)).toEqual({ ok: false, reason: "rule" });
    expect(g.farm.sowSoy(7)).toEqual({ ok: false, reason: "rule" });
    expect(g.farm.sell(7)).toEqual({ ok: false, reason: "rule" });
    expect(g.farm.cost(7, "pasture")).toBeNull();
  });
});

describe("soil, calves, town, climate", () => {
  it("pasture fertility loss turns into desert", () => {
    const g = createGame({ ...rich, pastureStartLoss: 175 }, 1);
    g.farm.makePasture(7);
    g.farm.addCow(7);
    expect(g.state.plots[7].fertility).toBe(5);
    months(g, 1);
    expect(g.state.plots[7].fertility).toBe(3);
    expect(g.state.dissent.ecologists).toBe(1);
    months(g, 1);
    expect(g.state.plots[7].fertility).toBe(1);
    const ev = months(g, 1);
    expect(ofType(ev, "desert")).toEqual([{ type: "desert", plot: 7 }]);
    expect(g.state.plots[7].kind).toBe("desert");
    expect(g.state.plots[7].herd).toEqual([]);
  });

  it("one cow does not harm the soil; empty plots regrow", () => {
    const g = createGame(rich, 1);
    g.farm.makePasture(7);
    g.farm.removeCow(7);
    g.farm.makePasture(11);
    g.farm.sell(11);
    months(g, 2);
    expect(g.state.plots[7].fertility).toBe(100);
    expect(g.state.plots[11].fertility).toBe(104);
    expect(g.state.plots[12].fertility).toBe(180);
  });

  it("grown calves ship to the feedlot", () => {
    const g = createGame({ ...rich, calfMonths: 1 }, 1);
    g.farm.makePasture(7);
    const ev = months(g, 1);
    const shipped = ofType(ev, "calfShipped");
    expect(shipped).toHaveLength(2);
    expect(shipped[0].plot).toBe(7);
    expect(g.state.cows).toHaveLength(5);
    expect(g.state.cows.map((c) => c.id)).toContain(shipped[1].cowId);
    expect(g.state.plots[7].herd).toEqual([0, 0]);
  });

  it("calves wait when the feedlot is full", () => {
    const g = createGame({ ...rich, calfMonths: 1, maxCows: 3 }, 1);
    g.farm.makePasture(7);
    let ev = months(g, 1);
    expect(ofType(ev, "calfShipped")).toHaveLength(0);
    expect(g.state.plots[7].herd).toEqual([1, 1]);
    g.feedlot.destroy(g.state.cows[0].id);
    ev = months(g, 1);
    expect(ofType(ev, "calfShipped")).toHaveLength(1);
    expect(g.state.plots[7].herd).toEqual([0, 2]);
  });

  it("town mood follows the grain plots", () => {
    const g = createGame(rich, 1);
    g.farm.bribeMayor();
    g.farm.makePasture(3);
    g.farm.makePasture(8);
    let ev = months(g, 1);
    expect(g.state.townMood).toBe("short");
    expect(ofType(ev, "townMood")).toEqual([{ type: "townMood", mood: "short" }]);
    months(g, 1);
    expect(g.state.dissent.globalists).toBe(1);
    g.farm.makePasture(13);
    months(g, 1);
    expect(g.state.townMood).toBe("hungry");
    expect(g.state.dissent.globalists).toBe(2);
    g.farm.makePasture(18);
    ev = months(g, 1);
    expect(g.state.townMood).toBe("deserted");
    expect(g.state.dissent.globalists).toBe(4);
    months(g, 1);
    expect(g.state.dissent.globalists).toBe(7);
  });

  it("climate warms with fewer forests", () => {
    const g = createGame(rich, 1);
    months(g, 2);
    expect(g.state.warming).toBe(0);
    const one = createGame(rich, 1);
    one.farm.makePasture(0);
    months(one, 1);
    expect(one.state.warming).toBe(2);
    const three = createGame(rich, 1);
    [0, 1, 2].forEach((i) => three.farm.makePasture(i));
    months(three, 1);
    expect(three.state.warming).toBe(3);
    const five = createGame(rich, 1);
    [0, 1, 2, 4, 5].forEach((i) => five.farm.makePasture(i));
    months(five, 1);
    expect(five.state.warming).toBe(4);
    months(five, 24);
    expect(five.state.warming).toBe(100);
    expect(five.state.seaLevel).toBe(1);
    expect(five.state.polarIce).toBe(90);
  });
});

describe("soy cycle", () => {
  it("sowing waits for winter, harvested in spring, yields in summer", () => {
    const g = createGame({ ...rich, startCows: 0 }, 1);
    g.farm.sowSoy(7);
    g.farm.sowSoy(11);
    g.farm.setGm(11, true);
    run(g, 45); // up to December week 2
    expect(g.state.plots[7].soyStage).toBe("sowing");
    g.tick();
    expect(g.state.season).toBe("winter");
    expect(g.state.plots[7].soyStage).toBe("growing");
    run(g, 12);
    expect(g.state.season).toBe("spring");
    expect(g.state.plots[7].soyStage).toBe("harvested");
    run(g, 11);
    const feed = g.state.feed;
    const ev = g.tick();
    expect(g.state.season).toBe("summer");
    const y = ofType(ev, "soyYield");
    expect(y).toEqual([
      { type: "soyYield", plot: 7, amount: 300 },
      { type: "soyYield", plot: 11, amount: 420 },
    ]);
    expect(g.state.feed).toBe(feed + 720);
  });

  it("industrial waste raises the yield; the tank is capped", () => {
    const g = createGame({ ...rich, startCows: 0, feedStart: 2900 }, 1);
    g.feedlot.setAdditive("waste", true);
    g.farm.sowSoy(7);
    g.farm.setGm(7, true);
    mut(g).plots[7].soyStage = "harvested";
    const ev = run(g, 22);
    expect(ofType(ev, "soyYield")[0].amount).toBe(504);
    expect(g.state.feed).toBe(3000);
  });
});

describe("feedlot", () => {
  const steady: Partial<Config> = { ...rich, startCows: 1, gain1: 40, gain2: 40, gain3: 40 };

  it("feeding and hormones", () => {
    const g = createGame(steady, 1);
    months(g, 1);
    expect(g.state.cows[0].weight).toBe(520);
    expect(g.state.feed).toBe(970);
    g.feedlot.setAdditive("hormones", true);
    expect(g.state.additives.hormones).toBe(true);
    months(g, 1);
    expect(g.state.cows[0].weight).toBe(615);
    expect(line(g, "hormones")).toBe(15);
  });

  it("starving cows lose weight and die", () => {
    const g = createGame({ ...rich, startCows: 1, gain1: 62, gain2: 62, gain3: 62, feedStart: 0 }, 1);
    months(g, 2);
    expect(g.state.cows[0].weight).toBe(356);
    const ev = months(g, 1);
    expect(ofType(ev, "cowDied")).toHaveLength(1);
    expect(g.state.cows).toHaveLength(0);
    expect(g.feedlotAlerts()).toContain("noCows");
  });

  it("slaughter, belt and fridge", () => {
    const g = createGame({ ...steady, slaughterWeight: 500 }, 1);
    g.restaurant.fire("grill1");
    let ev = run(g, 4);
    const sl = ofType(ev, "cowSlaughtered");
    expect(sl).toHaveLength(1);
    expect(sl[0].ill).toBe(false);
    expect(ofType(ev, "pattyTrip")).toEqual([{ type: "pattyTrip", count: 24 }]);
    expect(g.state.cows).toHaveLength(0);
    expect(g.state.pattiesQueued).toBe(8);
    expect(g.state.inTransit).toBe(24);
    expect(g.state.patties).toBe(90);
    ev = g.tick();
    expect(ofType(ev, "pattiesArrived")).toEqual([{ type: "pattiesArrived", count: 24, lost: 0 }]);
    expect(g.state.patties).toBe(114);
    expect(g.state.inTransit).toBe(8);
    g.tick();
    expect(g.state.patties).toBe(122);
    expect(g.state.inTransit).toBe(0);
  });

  it("fridge cap loses patties", () => {
    const g = createGame({ ...steady, slaughterWeight: 500, fridgeStart: 490 }, 1);
    g.restaurant.fire("grill1");
    run(g, 4);
    const ev = g.tick();
    expect(ofType(ev, "pattiesArrived")).toEqual([{ type: "pattiesArrived", count: 10, lost: 14 }]);
    expect(g.state.patties).toBe(500);
  });

  it("animal meal returns feed per slaughtered cow", () => {
    const g = createGame({ ...steady, slaughterWeight: 500 }, 1);
    g.feedlot.setAdditive("meal", true);
    run(g, 4);
    expect(g.state.feed).toBe(1000);
  });

  it("ill and mad cows raise consumer dissent at slaughter", () => {
    const g = createGame({ ...steady, startCows: 2, slaughterWeight: 500 }, 1);
    g.tick();
    mut(g).cows[0].ill = true;
    mut(g).cows[1].mad = true;
    expect(g.feedlotAlerts()).toEqual(expect.arrayContaining(["illCow", "madCow"]));
    const ev = run(g, 3);
    expect(ofType(ev, "cowSlaughtered").map((e) => [e.ill, e.mad])).toEqual([[true, false], [false, true]]);
    expect(g.state.dissent.consumers).toBe(50);
  });

  it("illness strikes at the minimum safety", () => {
    const g = createGame({ startMoney: 1e7, illnessBase: 0, bseBase: 1e9, startCows: 10 }, 3);
    const ev = run(g, 20);
    expect(ofType(ev, "cowIll").length).toBeGreaterThan(0);
    expect(g.state.cows.some((c) => c.ill)).toBe(true);
  });

  it("mad cow needs animal meal and feed", () => {
    const cfg: Partial<Config> = { startMoney: 1e7, illnessBase: 1e9, bseBase: 0, startCows: 10 };
    const off = createGame(cfg, 3);
    expect(ofType(run(off, 20), "cowMad")).toHaveLength(0);
    const on = createGame(cfg, 3);
    on.feedlot.setAdditive("meal", true);
    expect(ofType(run(on, 20), "cowMad").length).toBeGreaterThan(0);
    const empty = createGame({ ...cfg, feedStart: 0 }, 3);
    empty.feedlot.setAdditive("meal", true);
    expect(ofType(run(empty, 8), "cowMad")).toHaveLength(0);
  });

  it("destroy a cow", () => {
    const g = createGame(rich, 1);
    g.tick();
    const id = g.state.cows[0].id;
    expect(g.feedlot.destroy(999)).toEqual({ ok: false, reason: "rule" });
    expect(g.feedlot.destroy(id)).toEqual({ ok: true });
    expect(g.state.cows).toHaveLength(2);
    expect(ofType(g.tick(), "cowDestroyed")).toEqual([{ type: "cowDestroyed", cowId: id }]);
    mut(g).cows[0].weight = 2000;
    expect(g.feedlot.destroy(g.state.cows[0].id)).toEqual({ ok: false, reason: "rule" });
  });

  it("feedlot alerts", () => {
    expect(createGame({ ...quiet, startCows: 0 }, 1).feedlotAlerts()).toEqual(["noCows"]);
    const crowded = createGame({ ...quiet, startCows: 17 }, 1);
    crowded.tick();
    expect(crowded.feedlotAlerts()).toEqual(["crowded"]);
    const low = createGame({ ...quiet, feedStart: 100 }, 1);
    low.tick();
    expect(low.feedlotAlerts()).toEqual(["lowFeed"]);
    const full = createGame({ ...quiet, feedStart: 3000 }, 1);
    full.tick();
    expect(full.feedlotAlerts()).toEqual(["fullFeed"]);
  });
});

describe("restaurant", () => {
  it("cooking and serving keep the books", () => {
    const g = createGame(quiet, 5);
    const ev = g.tick();
    const cooked = ofType(ev, "burgerCooked").length;
    expect(cooked + ofType(ev, "cookYawned").length).toBe(1);
    expect(g.state.patties).toBe(90 - cooked);
    expect(ofType(ev, "customerJoined")).toEqual([{ type: "customerJoined", queue: 0 }]);
    const served = ofType(ev, "customerServed").length;
    expect(served + ofType(ev, "cashierYawned").length).toBe(1);
    expect(g.state.income).toBe(served * 550);
    expect(g.state.burgers).toBe(40 + cooked - served);
    expect(g.state.queues[0]).toBe(1 - served);
  });

  it("long run: patties, burgers and income stay consistent", () => {
    const g = createGame(quiet, 9);
    const ev = run(g, 40);
    const cooked = ofType(ev, "burgerCooked").length;
    const served = ofType(ev, "customerServed").length;
    expect(cooked).toBeGreaterThan(30);
    expect(served).toBeGreaterThan(30);
    expect(g.state.burgers).toBe(40 + cooked - served);
  });

  it("no cooking without patties, no serving without burgers", () => {
    const g = createGame({ ...quiet, fridgeStart: 0, burgersStart: 0 }, 1);
    const ev = g.tick();
    expect(ofType(ev, "burgerCooked")).toHaveLength(0);
    expect(ofType(ev, "cookYawned")).toHaveLength(0);
    expect(ofType(ev, "customerServed")).toHaveLength(0);
    expect(g.state.queues[0]).toBe(1);
    expect(g.restaurantAlerts()).toContain("noPatties");
  });

  it("customers pick the shortest staffed queue; the rest walk away", () => {
    const g = createGame({ ...quiet, burgersStart: 0 }, 1);
    g.restaurant.fire("grill1");
    g.restaurant.hire("register2");
    g.restaurant.hire("register3");
    mut(g).footfall = 5;
    g.tick();
    expect(g.state.queues).toEqual([2, 2, 1]);
    const h = createGame({ ...quiet, burgersStart: 0 }, 1);
    h.restaurant.fire("grill1");
    mut(h).footfall = 30;
    const ev = h.tick();
    expect(h.state.queues).toEqual([8, 0, 0]);
    expect(ofType(ev, "customerLeft").filter((e) => e.queue === null)).toHaveLength(22);
    expect(h.restaurantAlerts()).toContain("needGrills");
  });

  it("firing a cashier sends the queue away", () => {
    const g = createGame({ ...quiet, burgersStart: 0 }, 1);
    mut(g).footfall = 3;
    g.restaurant.fire("grill1");
    g.tick();
    expect(g.restaurant.fire("register1")).toEqual({ ok: true });
    expect(g.state.queues[0]).toBe(0);
    expect(g.state.dissent.unions).toBe(40);
    expect(ofType(g.tick(), "customerLeft").filter((e) => e.queue === 0)).toHaveLength(3);
  });

  it("hire, fire, badge, warn", () => {
    const g = createGame({ ...quiet, badgeLuck: 1, warnLuck: 1 }, 1);
    expect(g.restaurant.hire("grill1")).toEqual({ ok: false, reason: "rule" });
    expect(g.restaurant.fire("grill2")).toEqual({ ok: false, reason: "rule" });
    expect(g.restaurant.badge("grill2")).toEqual({ ok: false, reason: "rule" });
    expect(g.restaurant.hire("grill2")).toEqual({ ok: true });
    const s = mut(g).stations.find((x) => x.id === "grill2")!;
    expect(s).toMatchObject({ staffed: true, motivation: 4, badge: false, warned: false });
    s.motivation = 1;
    expect(g.restaurant.badge("grill2")).toEqual({ ok: true });
    expect(s.motivation).toBe(4);
    expect(g.restaurant.badge("grill2")).toEqual({ ok: false, reason: "rule" });
    s.motivation = 2;
    expect(g.restaurant.warn("grill2")).toEqual({ ok: true });
    expect(s.motivation).toBe(4);
    expect(g.state.dissent.unions).toBe(10);
    expect(g.restaurant.warn("grill2")).toEqual({ ok: false, reason: "rule" });
    expect(g.restaurant.fire("grill2")).toEqual({ ok: true });
    expect(g.state.dissent.unions).toBe(30);
    g.restaurant.hire("grill2");
    expect(s).toMatchObject({ badge: false, warned: false, motivation: 4 });
  });

  it("badge and warning can fail", () => {
    const g = createGame({ ...quiet, badgeLuck: 1e9, warnLuck: 1e9 }, 1);
    const s = mut(g).stations.find((x) => x.id === "grill1")!;
    s.motivation = 2;
    g.restaurant.badge("grill1");
    g.restaurant.warn("grill1");
    expect(s.motivation).toBe(2);
    expect(s.badge && s.warned).toBe(true);
  });

  it("morale drops once a month at most", () => {
    const g = createGame({ ...rich, moraleDice: 1 }, 4);
    for (const id of ["grill2", "grill3", "register2", "register3"] as const) g.restaurant.hire(id);
    const ev = months(g, 3);
    expect(ofType(ev, "morale").length).toBeGreaterThanOrEqual(3);
    expect(g.state.stations.reduce((t, s) => t + s.motivation, 0)).toBe(21);
    const never = createGame({ ...rich, moraleDice: 1e9 }, 4);
    months(never, 3);
    expect(never.state.stations.filter((s) => s.staffed).every((s) => s.motivation === 4)).toBe(true);
  });

  it("restaurant alerts", () => {
    const g = createGame(quiet, 1);
    expect(g.restaurantAlerts()).toEqual([]);
    for (const id of ["grill2", "register2"] as const) g.restaurant.hire(id);
    for (const s of mut(g).stations) if (s.staffed) s.motivation = 2;
    expect(g.restaurantAlerts()).toEqual(["lowMorale"]);
    const full = createGame({ ...quiet, fridgeStart: 495 }, 1);
    expect(full.restaurantAlerts()).toEqual(["fridgeFull"]);
    const q = createGame(quiet, 1);
    mut(q).queues = [7, 0, 0];
    expect(q.restaurantAlerts()).toEqual(["needRegisters"]);
    mut(q).burgers = 2;
    expect(q.restaurantAlerts()).toEqual(["needGrills"]);
    q.restaurant.hire("register2");
    expect(q.restaurantAlerts()).toEqual([]);
    q.restaurant.fire("register1");
    q.restaurant.fire("register2");
    expect(q.restaurantAlerts()).toEqual([]);
  });
});

describe("head office", () => {
  it("campaigns change footfall at month end", () => {
    const g = createGame(rich, 1);
    g.office.setCampaign("toons", true);
    g.office.setCampaign("kids", true);
    expect(g.state.footfall).toBe(1);
    months(g, 1);
    expect(g.state.footfall).toBe(4);
    expect(g.state.dissent.globalists).toBe(0.5);
    expect(line(g, "kids")).toBe(520);
    g.office.setCampaign("toons", false);
    months(g, 1);
    expect(g.state.footfall).toBe(2);
    expect(g.state.dissent.obesity).toBe(2);
  });

  it("lobbies lower dissent", () => {
    const g = createGame(rich, 1);
    const d = mut(g).dissent;
    Object.assign(d, { ecologists: 30, globalists: 30, consumers: 30, unions: 30, obesity: 30 });
    mut(g).warned = { ecologists: true, globalists: true, consumers: true, unions: true, obesity: true };
    for (const c of ["politician", "climatologist", "nutritionist", "inspector", "pyramid", "charity"] as const) {
      g.office.setCampaign(c, true);
    }
    months(g, 1);
    // footfall was 1 during the closed month: obesity −1 −2 −6
    expect(g.state.dissent).toEqual({ ecologists: 28, globalists: 26, consumers: 24, unions: 27, obesity: 21 });
  });

  it("board alarm and expectation", () => {
    const g = createGame({ ...rich, burgerPrice: 0 }, 1);
    months(g, 1);
    expect(g.state.boardAlarm).toBe(1);
    expect(g.state.lastProfitable).toBe(false);
    months(g, 1);
    expect(g.state.boardAlarm).toBe(3);
    const ev = months(g, 4);
    expect(g.state.boardAlarm).toBe(10);
    expect(ofType(ev, "boardAlarm").at(-1)).toEqual({ type: "boardAlarm", level: 10 });
    const ok = createGame(rich, 1);
    mut(ok).boardAlarm = 3;
    mut(ok).income = 5000;
    months(ok, 1);
    expect(ok.state.boardAlarm).toBe(2);
    expect(ok.state.lastProfitable).toBe(true);
    months(ok, 11);
    expect(ok.state.expectation).toBe(480);
    const capped = createGame({ ...rich, expectStep: 5000 }, 1);
    months(capped, 12);
    expect(capped.state.expectation).toBe(2500);
  });

  it("chart and sheets restart every 5 years", () => {
    const g = createGame(rich, 1);
    months(g, 3);
    expect(g.state.chart).toHaveLength(3);
    // chart: money after the new month's charges; sheet: money at the close
    expect(g.state.chart[2]).toBe(g.state.money);
    expect(g.state.sheets[2].money).toBe(g.state.money + g.state.expenses);
    expect(g.state.sheets.map((s) => s.month)).toEqual([0, 1, 2]);
    months(g, 56);
    expect(g.state.chart).toHaveLength(59);
    months(g, 1);
    expect(g.state.year).toBe(2005);
    expect(g.state.chart).toHaveLength(1);
    expect(g.state.sheets).toHaveLength(1);
    expect(g.state.sheets[0]).toMatchObject({ year: 2004, month: 11 });
  });
});

describe("dissent", () => {
  it("warning once until the level drops below 20", () => {
    const g = createGame(rich, 1);
    mut(g).dissent.globalists = 60;
    let ev = months(g, 1);
    expect(ofType(ev, "warning")).toEqual([{ type: "warning", group: "globalists" }]);
    expect(g.state.warned.globalists).toBe(true);
    ev = months(g, 1);
    expect(ofType(ev, "warning")).toHaveLength(0);
    mut(g).dissent.globalists = 10;
    months(g, 1);
    expect(g.state.warned.globalists).toBe(false);
    mut(g).dissent.globalists = 70;
    ev = months(g, 1);
    expect(ofType(ev, "warning")).toHaveLength(1);
  });

  it("union strike stops customers for 6 months", () => {
    const g = createGame(rich, 1);
    g.restaurant.hire("grill2");
    for (let i = 0; i < 6; i++) {
      g.restaurant.fire("grill2");
      g.restaurant.hire("grill2");
    }
    expect(g.state.dissent.unions).toBe(120);
    const ev = months(g, 1);
    expect(ofType(ev, "protest")).toEqual([{ type: "protest", group: "unions" }]);
    expect(g.state.dissent.unions).toBe(19);
    expect(g.state.strikeMonths).toBe(6);
    expect(g.state.footfall).toBe(0);
    months(g, 5);
    expect(g.state.footfall).toBe(0);
    months(g, 1);
    expect(g.state.footfall).toBe(1);
  });

  it("boycotts take one customer each for 12 months", () => {
    const g = createGame(rich, 1);
    g.office.setCampaign("toons", true);
    [0, 1, 2].forEach((i) => g.farm.makePasture(i));
    mut(g).dissent.globalists = 150;
    const ev = months(g, 1);
    expect(ofType(ev, "protest").map((e) => e.group)).toEqual(["ecologists", "globalists"]);
    expect(g.state.dissent.ecologists).toBe(19);
    expect(g.state.dissent.globalists).toBe(10);
    expect(g.state.boycotts).toEqual([12, 12]);
    expect(g.state.footfall).toBe(1);
    months(g, 11);
    expect(g.state.footfall).toBe(1);
    months(g, 1);
    expect(g.state.boycotts).toEqual([]);
    expect(g.state.footfall).toBe(3);
  });

  it("lawsuits and poisoning cases are fined", () => {
    const g = createGame(rich, 1);
    mut(g).dissent.obesity = 110;
    mut(g).dissent.consumers = 100;
    const ev = months(g, 1);
    expect(ofType(ev, "fine")).toEqual([
      { type: "fine", group: "consumers", amount: 6000 },
      { type: "fine", group: "obesity", amount: 9000 },
    ]);
    expect(line(g, "fine:obesity")).toBe(9000);
    expect(line(g, "fine:consumers")).toBe(6000);
    expect(g.state.dissent.obesity).toBe(0);
    expect(g.state.dissent.consumers).toBe(0);
  });

  it("levels never go below 0", () => {
    const g = createGame(rich, 1);
    g.office.setCampaign("inspector", true);
    months(g, 3);
    expect(Object.values(g.state.dissent).every((v) => v === 0)).toBe(true);
  });
});

describe("determinism", () => {
  it("same seed, same game", () => {
    const play = (seed: number) => {
      const g = createGame({ illnessBase: 50, bseBase: 50, moraleDice: 3 }, seed);
      g.feedlot.setAdditive("meal", true);
      g.farm.makePasture(7);
      g.office.setCampaign("toons", true);
      const ev = run(g, 200);
      return JSON.stringify({ ev, s: g.state });
    };
    expect(play(42)).toBe(play(42));
    expect(play(42)).not.toBe(play(43));
  });
});
