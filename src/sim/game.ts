// Burgrix simulation (docs/rules.md). Plain-object state, seeded randomness, no browser code.
import { defaultConfig } from "./config.ts";
import { createRng } from "./rng.ts";
import type {
  Additive, CampaignId, Config, Cow, FeedlotAlert, Game, GameEvent, GameState, Group, Plot,
  PlotKind, RestaurantAlert, Result, Season, Station, StationId, TownMood,
} from "./types.ts";

export { defaultConfig };

const OK: Result = { ok: true };
const OVER: Result = { ok: false, reason: "over" };
const BUSY: Result = { ok: false, reason: "busy" };
const RULE: Result = { ok: false, reason: "rule" };

const MAP: PlotKind[] = [
  "forest", "forest", "forest", "grain", "forest",
  "forest", "village", "empty", "grain", "forest",
  "forest", "empty", "empty", "grain", "empty",
  "empty", "empty", "empty", "grain", "empty",
];

const STATION_IDS: StationId[] = ["grill1", "grill2", "grill3", "register1", "register2", "register3"];
const GRILLS: StationId[] = ["grill1", "grill2", "grill3"];
const REGISTERS: StationId[] = ["register1", "register2", "register3"];
const CAMPAIGNS: CampaignId[] = ["kids", "pyramid", "charity", "toons", "politician", "climatologist", "nutritionist", "inspector"];
const ADVERT_FOOTFALL: Partial<Record<CampaignId, number>> = { kids: 1, pyramid: 1, charity: 1, toons: 2 };
const GROUPS: Group[] = ["ecologists", "globalists", "consumers", "unions", "obesity"];
/** month index (0 = January) whose week 3 starts a season */
const SEASON_MONTHS: Record<number, Season> = { 2: "spring", 5: "summer", 8: "autumn", 11: "winter" };

function initialState(cfg: Config): GameState {
  const plots: Plot[] = MAP.map((kind) => ({
    kind, fertility: cfg.fertilityMax, herd: [], gm: false, soyStage: null, work: null,
  }));
  const stations: Station[] = STATION_IDS.map((id) => {
    const staffed = id === "grill1" || id === "register1";
    return { id, staffed, motivation: staffed ? cfg.maxMotivation : 0, badge: false, warned: false };
  });
  const campaigns = {} as Record<CampaignId, boolean>;
  for (const c of CAMPAIGNS) campaigns[c] = false;
  const zero = (): Record<Group, number> => ({ ecologists: 0, globalists: 0, consumers: 0, unions: 0, obesity: 0 });
  return {
    year: cfg.startYear, month: 0, week: 1, season: "winter", weeks: 0,
    money: cfg.startMoney, income: 0, expenses: 0, lines: [],
    plots, townMood: "content", mayorBribed: false, warming: 0, seaLevel: 0, polarIce: 100,
    feed: cfg.feedStart, cows: [], additives: { meal: false, hormones: false, waste: false },
    pattiesQueued: 0, inTransit: 0,
    patties: cfg.fridgeStart, burgers: cfg.burgersStart, stations, queues: [0, 0, 0], footfall: 1,
    campaigns, expectation: cfg.expectStart, boardAlarm: 0, lastProfitable: false, chart: [], sheets: [],
    dissent: zero(),
    warned: { ecologists: false, globalists: false, consumers: false, unions: false, obesity: false },
    strikeMonths: 0, boycotts: [],
    gameOver: false,
  };
}

export function createGame(config?: Partial<Config>, seed?: number): Game {
  const cfg: Config = {
    ...defaultConfig,
    ...config,
    campaignCost: { ...defaultConfig.campaignCost, ...(config?.campaignCost ?? {}) },
    cowNames: [...(config?.cowNames ?? defaultConfig.cowNames)],
  };
  const rng = createRng(seed ?? Math.floor(Math.random() * 4294967296));
  const st = initialState(cfg);
  /** events of the running week, including those caused by commands */
  let ev: GameEvent[] = [];
  let nextCowId = 1;
  let nameIndex = 0;

  // --- ledger (section 2) ---
  const spend = (amount: number, label: string): void => {
    if (amount <= 0) return;
    st.money -= amount;
    st.expenses += amount;
    const line = st.lines.find((l) => l.label === label);
    if (line) line.amount += amount;
    else st.lines.push({ label, amount });
  };
  const earn = (amount: number): void => {
    st.money += amount;
    st.income += amount;
  };

  // --- helpers ---
  // no upper clamp here: a level may pass 100 until the month-end check turns it into a protest
  const addDissent = (g: Group, n: number): void => {
    st.dissent[g] = Math.max(0, st.dissent[g] + n);
  };
  const station = (id: StationId): Station => st.stations.find((s) => s.id === id)!;
  const validPlot = (i: number): boolean => Number.isInteger(i) && i >= 0 && i < st.plots.length;
  const gmFields = (): number => st.plots.filter((p) => p.kind === "soy" && p.gm).length;

  const newCow = (): Cow => {
    const gains = [cfg.gain1, cfg.gain2, cfg.gain3];
    const id = nextCowId++;
    const name = cfg.cowNames.length ? cfg.cowNames[nameIndex++ % cfg.cowNames.length] : `#${id}`;
    const cow: Cow = { id, name, weight: cfg.startWeight, gain: gains[rng.int(3)], ill: false, mad: false };
    st.cows.push(cow);
    ev.push({ type: "cowArrived", cowId: id });
    return cow;
  };

  const checkDesert = (i: number): void => {
    const p = st.plots[i];
    if (p.kind !== "desert" && p.fertility <= 0) {
      p.kind = "desert";
      p.herd = [];
      p.gm = false;
      p.soyStage = null;
      ev.push({ type: "desert", plot: i }, { type: "plotChanged", plot: i });
    }
  };

  const toPasture = (i: number): void => {
    const p = st.plots[i];
    p.kind = "pasture";
    p.herd = [0, 0];
    p.gm = false;
    p.soyStage = null;
    p.fertility -= cfg.pastureStartLoss;
    checkDesert(i);
  };
  const toSoy = (i: number): void => {
    const p = st.plots[i];
    p.kind = "soy";
    p.herd = [];
    p.gm = false;
    p.soyStage = "sowing";
  };

  // --- farm actions (section 3.2) ---
  type Plan = { cost: number; label: string; apply: () => void };
  const plan = (i: number, action: "pasture" | "soy"): Plan | null => {
    const p = st.plots[i];
    const pasture = action === "pasture";
    const direct = (): Plan => pasture
      ? { cost: cfg.pastureCost, label: "pasture", apply: () => toPasture(i) }
      : { cost: cfg.soyCost, label: "soy", apply: () => toSoy(i) };
    switch (p.kind) {
      case "empty":
        return direct();
      case "grain":
        return st.mayorBribed ? direct() : null;
      case "pasture":
        return pasture ? null : direct();
      case "soy":
        return pasture ? direct() : null;
      case "forest":
        return {
          cost: pasture ? cfg.clearPastureCost : cfg.clearSoyCost,
          label: pasture ? "clearPasture" : "clearSoy",
          apply: () => {
            addDissent("ecologists", cfg.ecoForest);
            addDissent("globalists", cfg.globalForest);
            p.work = { type: "clearing", target: action, weeksLeft: cfg.clearWeeks };
          },
        };
      case "village":
        return {
          cost: pasture ? cfg.clearPastureCost : cfg.clearSoyCost,
          label: pasture ? "clearPasture" : "clearSoy",
          apply: () => {
            addDissent("globalists", cfg.globalVillage);
            p.work = { type: "burning", target: action, weeksLeft: cfg.clearWeeks };
          },
        };
      default:
        return null;
    }
  };

  /** common guard: over / invalid / busy */
  const guard = (i: number): Result | null => {
    if (st.gameOver) return OVER;
    if (!validPlot(i)) return RULE;
    if (st.plots[i].work) return BUSY;
    return null;
  };

  const doPlan = (i: number, action: "pasture" | "soy"): Result => {
    const g = guard(i);
    if (g) return g;
    const pl = plan(i, action);
    if (!pl) return RULE;
    spend(pl.cost, pl.label);
    pl.apply();
    ev.push({ type: "plotChanged", plot: i });
    return OK;
  };

  const farm: Game["farm"] = {
    makePasture: (i) => doPlan(i, "pasture"),
    sowSoy: (i) => doPlan(i, "soy"),
    addCow(i) {
      const g = guard(i);
      if (g) return g;
      const p = st.plots[i];
      if (p.kind !== "pasture" || p.herd.length >= 3) return RULE;
      p.herd.push(0);
      ev.push({ type: "plotChanged", plot: i });
      return OK;
    },
    removeCow(i) {
      const g = guard(i);
      if (g) return g;
      const p = st.plots[i];
      if (p.kind !== "pasture" || p.herd.length === 0) return RULE;
      p.herd.pop();
      ev.push({ type: "plotChanged", plot: i });
      return OK;
    },
    sell(i) {
      const g = guard(i);
      if (g) return g;
      const p = st.plots[i];
      if (p.kind === "pasture") earn(cfg.pastureCost / 2);
      else if (p.kind === "soy") earn(cfg.soyCost / 2);
      else return RULE;
      p.kind = "empty";
      p.herd = [];
      p.gm = false;
      p.soyStage = null;
      ev.push({ type: "plotChanged", plot: i });
      return OK;
    },
    setGm(i, on) {
      const g = guard(i);
      if (g) return g;
      const p = st.plots[i];
      if (p.kind !== "soy") return RULE;
      p.gm = on;
      ev.push({ type: "plotChanged", plot: i });
      return OK;
    },
    bribeMayor() {
      if (st.gameOver) return OVER;
      if (st.mayorBribed) return RULE;
      spend(cfg.bribeCost, "bribe");
      st.mayorBribed = true;
      return OK;
    },
    cost(i, action) {
      if (st.gameOver || !validPlot(i) || st.plots[i].work) return null;
      return plan(i, action)?.cost ?? null;
    },
  };

  // --- feedlot commands (section 4) ---
  const feedlot: Game["feedlot"] = {
    setAdditive(kind: Additive, on: boolean) {
      if (st.gameOver) return OVER;
      st.additives[kind] = on;
      return OK;
    },
    destroy(cowId: number) {
      if (st.gameOver) return OVER;
      const idx = st.cows.findIndex((c) => c.id === cowId);
      // a cow at slaughter weight is on its way to the line
      if (idx < 0 || st.cows[idx].weight >= cfg.slaughterWeight) return RULE;
      st.cows.splice(idx, 1);
      ev.push({ type: "cowDestroyed", cowId });
      return OK;
    },
  };

  // --- restaurant commands (section 5.1) ---
  const restaurant: Game["restaurant"] = {
    hire(id) {
      if (st.gameOver) return OVER;
      const s = station(id);
      if (!s || s.staffed) return RULE;
      Object.assign(s, { staffed: true, motivation: cfg.maxMotivation, badge: false, warned: false });
      ev.push({ type: "morale", station: id, motivation: s.motivation });
      return OK;
    },
    fire(id) {
      if (st.gameOver) return OVER;
      const s = station(id);
      if (!s || !s.staffed) return RULE;
      Object.assign(s, { staffed: false, motivation: 0, badge: false, warned: false });
      addDissent("unions", cfg.unionFire);
      const q = REGISTERS.indexOf(id);
      if (q >= 0) {
        for (let k = 0; k < st.queues[q]; k++) ev.push({ type: "customerLeft", queue: q });
        st.queues[q] = 0;
      }
      return OK;
    },
    badge(id) {
      if (st.gameOver) return OVER;
      const s = station(id);
      if (!s || !s.staffed || s.badge) return RULE;
      s.badge = true;
      if (rng.chance(cfg.badgeLuck)) s.motivation = cfg.maxMotivation;
      ev.push({ type: "morale", station: id, motivation: s.motivation });
      return OK;
    },
    warn(id) {
      if (st.gameOver) return OVER;
      const s = station(id);
      if (!s || !s.staffed || s.warned) return RULE;
      s.warned = true;
      addDissent("unions", cfg.unionWarn);
      if (rng.chance(cfg.warnLuck)) s.motivation = cfg.maxMotivation;
      ev.push({ type: "morale", station: id, motivation: s.motivation });
      return OK;
    },
  };

  const office: Game["office"] = {
    setCampaign(id, on) {
      if (st.gameOver) return OVER;
      if (!(id in st.campaigns)) return RULE;
      st.campaigns[id] = on;
      return OK;
    },
  };

  // --- restaurant week (section 5.2) ---
  const restaurantWeek = (): void => {
    if (st.inTransit > 0) {
      const room = Math.max(0, cfg.fridgeMax - st.patties);
      const stored = Math.min(room, st.inTransit);
      const lost = st.inTransit - stored;
      st.patties += stored;
      ev.push({ type: "pattiesArrived", count: stored, lost });
      st.inTransit = 0;
    }
    for (const id of GRILLS) {
      const s = station(id);
      if (!s.staffed || st.patties <= 0) continue;
      if (!rng.chance(s.motivation * 10)) {
        st.patties--;
        st.burgers++;
        ev.push({ type: "burgerCooked", station: id });
      } else ev.push({ type: "cookYawned", station: id });
    }
    for (let c = 0; c < st.footfall; c++) {
      let best = -1;
      for (let q = 0; q < 3; q++) {
        if (!station(REGISTERS[q]).staffed || st.queues[q] >= cfg.queueMax) continue;
        if (best < 0 || st.queues[q] < st.queues[best]) best = q;
      }
      if (best >= 0) {
        st.queues[best]++;
        ev.push({ type: "customerJoined", queue: best });
      } else ev.push({ type: "customerLeft", queue: null });
    }
    for (let q = 0; q < 3; q++) {
      const s = station(REGISTERS[q]);
      if (!s.staffed || st.queues[q] <= 0 || st.burgers <= 0) continue;
      if (!rng.chance(s.motivation * 10)) {
        st.burgers--;
        st.queues[q]--;
        earn(cfg.burgerPrice);
        ev.push({ type: "customerServed", queue: q });
      } else ev.push({ type: "cashierYawned", station: s.id });
    }
  };

  // --- feedlot week (sections 4.4, 4.5) ---
  const healthCheck = (): void => {
    let s = cfg.illnessBase - st.cows.length;
    if (st.additives.waste) s -= cfg.wasteRisk;
    if (st.additives.hormones) s -= cfg.hormoneRisk;
    s -= cfg.gmRisk * gmFields();
    s = Math.max(10, s);
    // mad cows still present stand for "mad at the previous check"
    const bseOn = st.additives.meal && st.feed > 0;
    const b = Math.max(10, cfg.bseBase - cfg.bseSpread * st.cows.filter((c) => c.mad).length);
    for (const cow of st.cows) {
      if (cow.ill || cow.mad) continue;
      if (rng.chance(s)) {
        cow.ill = true;
        ev.push({ type: "cowIll", cowId: cow.id });
      } else if (bseOn && rng.chance(b)) {
        cow.mad = true;
        ev.push({ type: "cowMad", cowId: cow.id });
      }
    }
  };

  const slaughterLine = (): void => {
    // every cow at slaughter weight goes in the same week
    const ready = st.cows.filter((c) => c.weight >= cfg.slaughterWeight);
    for (const cow of ready) {
      st.cows.splice(st.cows.indexOf(cow), 1);
      st.pattiesQueued += cfg.pattiesPerCow;
      if (cow.ill) addDissent("consumers", cfg.consumerIll);
      if (cow.mad) addDissent("consumers", cfg.consumerMad);
      if (st.additives.meal) st.feed = Math.min(cfg.feedMax, st.feed + cfg.mealFeed);
      ev.push({ type: "cowSlaughtered", cowId: cow.id, ill: cow.ill, mad: cow.mad });
    }
    const n = Math.min(st.pattiesQueued, cfg.beltPerWeek);
    if (n > 0) {
      st.pattiesQueued -= n;
      st.inTransit += n;
      ev.push({ type: "pattyTrip", count: n });
    }
  };

  // --- seasons (section 3.4) ---
  const changeSeason = (season: Season): void => {
    st.season = season;
    ev.push({ type: "season", season });
    st.plots.forEach((p, i) => {
      if (p.kind !== "soy") return;
      if (season === "summer" && p.soyStage === "harvested") {
        const amount = Math.round((cfg.soyBaseYield + p.fertility / 2) * (p.gm ? cfg.gmYield : 1) *
          (st.additives.waste ? cfg.wasteYield : 1));
        st.feed = Math.min(cfg.feedMax, st.feed + amount);
        ev.push({ type: "soyYield", plot: i, amount });
        return;
      }
      const next = season === "winter" && p.soyStage !== "growing" ? "growing"
        : season === "spring" && p.soyStage === "growing" ? "harvested" : null;
      if (next) {
        p.soyStage = next;
        ev.push({ type: "plotChanged", plot: i });
      }
    });
    if (season === "spring") ev.push({ type: "harvest" });
  };

  const progressWork = (): void => {
    st.plots.forEach((p, i) => {
      if (!p.work) return;
      p.work.weeksLeft--;
      if (p.work.weeksLeft > 0) return;
      const target = p.work.target;
      p.work = null;
      if (target === "pasture") toPasture(i);
      else toSoy(i);
      ev.push({ type: "workDone", plot: i }, { type: "plotChanged", plot: i });
    });
  };

  // --- month end parts ---
  const moodOf = (grain: number): TownMood => (grain > 2 ? "content" : grain === 2 ? "short" : grain === 1 ? "hungry" : "deserted");

  const dissentMonth = (): void => {
    const d: Record<Group, number> = { ...st.dissent };
    d.ecologists += st.plots.filter((p) => p.fertility < cfg.fertilityAlarm).length; // desert plots count as poor soil
    d.consumers += gmFields();
    d.globalists += { deserted: 3, hungry: 2, short: 1, content: 0 }[st.townMood];
    const c = st.campaigns;
    if (c.kids) d.globalists += cfg.kidsGlobal;
    d.obesity += st.footfall >= 2 ? 2 : -1;
    if (c.pyramid) d.obesity -= 2;
    if (c.charity) d.globalists -= 2;
    if (c.politician) { d.globalists -= 2; d.unions -= 2; }
    if (c.climatologist) d.ecologists -= 2;
    if (c.nutritionist) d.obesity -= 6;
    if (c.inspector) d.consumers -= 6;
    d.unions -= 1;
    for (const g of GROUPS) st.dissent[g] = Math.max(0, d[g]);

    for (const g of GROUPS) {
      const v = st.dissent[g];
      if (v < 20) st.warned[g] = false;
      else if (v >= 100) protest(g);
      else if (v >= 50 && !st.warned[g]) {
        st.warned[g] = true;
        ev.push({ type: "warning", group: g });
      }
    }
  };

  const protest = (g: Group): void => {
    ev.push({ type: "protest", group: g });
    const fine = (amount: number): void => {
      spend(amount, `fine:${g}`);
      ev.push({ type: "fine", group: g, amount });
    };
    switch (g) {
      case "unions": st.strikeMonths = cfg.strikeMonths; st.dissent[g] = 19; break;
      case "obesity": fine(cfg.obesityFine); st.dissent[g] = 0; break;
      case "ecologists": st.boycotts.push(cfg.boycottMonths); st.dissent[g] = 19; break;
      case "globalists": st.boycotts.push(cfg.boycottMonths); st.dissent[g] = 10; break;
      case "consumers": fine(cfg.consumerFine); st.dissent[g] = 0; break;
    }
    st.warned[g] = false; // level is below 20 again
  };

  const computeFootfall = (): void => {
    let f = 1;
    for (const c of CAMPAIGNS) if (st.campaigns[c]) f += ADVERT_FOOTFALL[c] ?? 0;
    if (st.strikeMonths > 0) f = 0;
    f -= st.boycotts.length;
    st.footfall = Math.max(0, f);
  };

  const soilMonth = (): void => {
    st.plots.forEach((p, i) => {
      if (p.kind === "pasture") {
        p.fertility -= Math.max(0, p.herd.length - 1);
        checkDesert(i);
      } else if (p.kind === "empty") {
        p.fertility = Math.min(cfg.fertilityMax, p.fertility + cfg.fertilityRegrow);
      }
    });
  };

  const climateMonth = (): void => {
    const forests = st.plots.filter((p) => p.kind === "forest").length;
    st.warming += forests >= 7 ? 0 : forests >= 5 ? 2 : forests >= 3 ? 3 : 4;
    st.seaLevel = Math.min(10, Math.round(st.warming / 100));
    st.polarIce = 100 - 10 * st.seaLevel;
  };

  const townMonth = (): void => {
    if (st.townMood === "deserted") return; // empties for good
    const mood = moodOf(st.plots.filter((p) => p.kind === "grain").length);
    if (mood !== st.townMood) {
      st.townMood = mood;
      ev.push({ type: "townMood", mood });
    }
  };

  const feedMonth = (): void => {
    const extra = st.additives.hormones ? cfg.hormoneGain : 0;
    for (const cow of [...st.cows]) {
      if (st.feed > 0) {
        cow.weight += cow.gain + extra;
        st.feed = Math.max(0, st.feed - cfg.feedPerCow);
      } else {
        cow.weight -= cow.gain;
        if (cow.weight < cfg.minWeight) {
          st.cows.splice(st.cows.indexOf(cow), 1);
          ev.push({ type: "cowDied", cowId: cow.id });
        }
      }
    }
  };

  const moraleMonth = (): void => {
    if (rng.int(cfg.moraleDice) >= 6) return;
    const s = st.stations[rng.int(6)];
    if (s.staffed && s.motivation > 1) {
      s.motivation--;
      ev.push({ type: "morale", station: s.id, motivation: s.motivation });
    }
  };

  const grazingMonth = (): void => {
    st.plots.forEach((p, i) => {
      if (p.kind !== "pasture") return;
      for (let k = 0; k < p.herd.length; k++) {
        p.herd[k]++;
        if (p.herd[k] >= cfg.calfMonths && st.cows.length < cfg.maxCows) {
          const cow = newCow();
          p.herd[k] = 0;
          ev.push({ type: "calfShipped", plot: i, cowId: cow.id });
        }
      }
    });
  };

  // --- month end (section 8) ---
  const monthEnd = (): void => {
    const closedYear = st.year;
    const closedMonth = st.month;
    st.month++;
    if (st.month >= 12) {
      st.month = 0;
      st.year++;
      st.expectation = Math.min(cfg.expectMax, st.expectation + cfg.expectStep);
      ev.push({ type: "newYear", year: st.year });
      if ((st.year - cfg.startYear) % 5 === 0) {
        st.chart = [];
        st.sheets = [];
      }
    }

    const profit = st.income - st.expenses;
    st.sheets.push({
      year: closedYear, month: closedMonth, income: st.income, expenses: st.expenses, profit,
      money: st.money, lines: st.lines.map((l) => ({ ...l })),
    });
    if (st.sheets.length > 60) st.sheets.shift();
    st.lastProfitable = profit > 0;
    const before = st.boardAlarm;
    if (profit < 0) st.boardAlarm += 2;
    else if (profit < st.expectation) st.boardAlarm += 1;
    else st.boardAlarm -= 1;
    st.boardAlarm = Math.min(10, Math.max(0, st.boardAlarm));
    ev.push({ type: "monthEnd", profit });
    // reported on change and every month at the cap (the board complains)
    if (st.boardAlarm !== before || st.boardAlarm >= 10) ev.push({ type: "boardAlarm", level: st.boardAlarm });
    if (st.money <= cfg.bankruptcy) {
      st.gameOver = true;
      ev.push({ type: "gameOver" });
      return;
    }
    if (st.money < cfg.bankruptcy / 2) ev.push({ type: "redAccount" });

    st.income = 0;
    st.expenses = 0;
    st.lines = [];
    const plots = st.plots;
    spend(cfg.gmCost * gmFields(), "gm");
    spend(cfg.pastureUpkeep * plots.filter((p) => p.kind === "pasture").length, "pastureUpkeep");
    spend(cfg.soyUpkeep * plots.filter((p) => p.kind === "soy").length, "soyUpkeep");
    for (const c of CAMPAIGNS) if (st.campaigns[c]) spend(cfg.campaignCost[c], c);
    spend(cfg.crewWage * st.stations.filter((s) => s.staffed).length, "wages");
    if (st.additives.hormones) spend(cfg.hormoneCost, "hormones");

    st.chart.push(st.money);
    if (st.chart.length > 60) st.chart.shift();

    st.strikeMonths = Math.max(0, st.strikeMonths - 1);
    st.boycotts = st.boycotts.map((m) => m - 1).filter((m) => m > 0);

    dissentMonth();
    computeFootfall();
    soilMonth();
    climateMonth();
    townMonth();
    feedMonth();
    moraleMonth();
    grazingMonth();
  };

  // --- one week (section 1) ---
  const tick = (): GameEvent[] => {
    if (st.gameOver) return [];
    if (st.weeks === 0) for (let k = 0; k < cfg.startCows && st.cows.length < cfg.maxCows; k++) newCow();
    restaurantWeek();
    st.weeks++;
    st.week++;
    if (st.week > cfg.weeksPerMonth) {
      st.week = 1;
      monthEnd();
    }
    if (!st.gameOver) {
      const season = SEASON_MONTHS[st.month];
      if (st.week === 3 && season) changeSeason(season);
      progressWork(); // works advance once per week
      healthCheck();
      slaughterLine();
    }
    const out = ev;
    ev = [];
    return out;
  };

  const feedlotAlerts = (): FeedlotAlert[] => {
    const a: FeedlotAlert[] = [];
    if (st.cows.length >= cfg.maxCows - 3) a.push("crowded");
    if (st.cows.length === 0) a.push("noCows");
    if (st.feed < 200) a.push("lowFeed");
    if (st.feed >= cfg.feedMax) a.push("fullFeed");
    if (st.cows.some((c) => c.ill)) a.push("illCow");
    if (st.cows.some((c) => c.mad)) a.push("madCow");
    return a;
  };

  const restaurantAlerts = (): RestaurantAlert[] => {
    const a: RestaurantAlert[] = [];
    const staffed = st.stations.filter((s) => s.staffed);
    if (staffed.length > 2 && staffed.reduce((t, s) => t + s.motivation, 0) / staffed.length < 2.5) a.push("lowMorale");
    if (st.patties < 3) a.push("noPatties");
    if (st.patties > cfg.fridgeMax - 10) a.push("fridgeFull");
    const regs = REGISTERS.map((id, q) => ({ s: station(id), q })).filter((r) => r.s.staffed);
    if (regs.length > 0 && regs.every((r) => st.queues[r.q] >= cfg.queueMax - 1)) {
      a.push(st.burgers < 3 ? "needGrills" : "needRegisters");
    }
    return a;
  };

  return {
    get state() { return st; },
    config: cfg,
    tick,
    farm,
    feedlot,
    restaurant,
    office,
    feedlotAlerts,
    restaurantAlerts,
  };
}
