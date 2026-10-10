// The contract between the simulation (src/sim/) and the interface (src/ui/).
// Behaviour: docs/rules.md. The simulation has no drawing or browser code.

export type PlotKind = "forest" | "village" | "empty" | "grain" | "pasture" | "soy" | "desert";
export type SoyStage = "sowing" | "growing" | "harvested";
export type Season = "winter" | "spring" | "summer" | "autumn";
export type TownMood = "content" | "short" | "hungry" | "deserted";
export type Additive = "meal" | "hormones" | "waste";
export type StationId = "grill1" | "grill2" | "grill3" | "register1" | "register2" | "register3";
export type CampaignId = "kids" | "pyramid" | "charity" | "toons" | "politician" | "climatologist" | "nutritionist" | "inspector";
export type Group = "ecologists" | "globalists" | "consumers" | "unions" | "obesity";
export type FeedlotAlert = "crowded" | "noCows" | "lowFeed" | "fullFeed" | "illCow" | "madCow";
export type RestaurantAlert = "lowMorale" | "noPatties" | "fridgeFull" | "needGrills" | "needRegisters";

export interface Work {
  type: "clearing" | "burning";
  target: "pasture" | "soy";
  weeksLeft: number;
}

export interface Plot {
  kind: PlotKind;
  fertility: number;
  /** pastures: one growth counter (months) per grazing cow, 0..3 entries */
  herd: number[];
  /** soy: genetically modified seed */
  gm: boolean;
  /** soy only, otherwise null */
  soyStage: SoyStage | null;
  work: Work | null;
}

export interface Cow {
  id: number;
  name: string;
  weight: number;
  /** kg gained per fed month (without hormones) */
  gain: number;
  ill: boolean;
  mad: boolean;
}

export interface Station {
  id: StationId;
  staffed: boolean;
  motivation: number;
  badge: boolean;
  warned: boolean;
}

export interface BalanceSheet {
  year: number;
  /** 0 = January */
  month: number;
  income: number;
  expenses: number;
  profit: number;
  money: number;
  lines: { label: string; amount: number }[];
}

export interface GameState {
  // time (section 1)
  year: number;
  /** 0 = January .. 11 = December */
  month: number;
  /** 1..4 */
  week: number;
  season: Season;
  /** weeks played since the start */
  weeks: number;

  // money (section 2)
  money: number;
  /** of the running month */
  income: number;
  expenses: number;
  /** expense lines of the running month */
  lines: { label: string; amount: number }[];

  // farm (section 3)
  plots: Plot[];
  townMood: TownMood;
  mayorBribed: boolean;
  warming: number;
  /** 0..10 */
  seaLevel: number;
  /** percent */
  polarIce: number;

  // feedlot (section 4)
  feed: number;
  cows: Cow[];
  additives: Record<Additive, boolean>;
  pattiesQueued: number;
  inTransit: number;

  // restaurant (section 5)
  patties: number;
  burgers: number;
  stations: Station[];
  /** customers waiting at register1..3 */
  queues: [number, number, number];
  footfall: number;

  // head office (section 6)
  campaigns: Record<CampaignId, boolean>;
  expectation: number;
  boardAlarm: number;
  /** the last closed month made a profit */
  lastProfitable: boolean;
  /** money at each month end of the current 5-year period, at most 60 */
  chart: number[];
  /** closed months of the current period, oldest first */
  sheets: BalanceSheet[];

  // dissent (section 7)
  dissent: Record<Group, number>;
  /** a 50..99 warning was shown and the level has not dropped below 20 since */
  warned: Record<Group, boolean>;
  strikeMonths: number;
  /** remaining months per running boycott */
  boycotts: number[];

  gameOver: boolean;
}

export type GameEvent =
  | { type: "cowArrived"; cowId: number }
  | { type: "cowSlaughtered"; cowId: number; ill: boolean; mad: boolean }
  | { type: "cowDied"; cowId: number }
  | { type: "cowDestroyed"; cowId: number }
  | { type: "cowIll"; cowId: number }
  | { type: "cowMad"; cowId: number }
  | { type: "pattyTrip"; count: number }
  | { type: "pattiesArrived"; count: number; lost: number }
  | { type: "burgerCooked"; station: StationId }
  | { type: "cookYawned"; station: StationId }
  | { type: "customerJoined"; queue: number }
  | { type: "customerLeft"; queue: number | null }
  | { type: "customerServed"; queue: number }
  | { type: "cashierYawned"; station: StationId }
  | { type: "morale"; station: StationId; motivation: number }
  | { type: "season"; season: Season }
  | { type: "harvest" }
  | { type: "soyYield"; plot: number; amount: number }
  | { type: "plotChanged"; plot: number }
  | { type: "workDone"; plot: number }
  | { type: "desert"; plot: number }
  | { type: "calfShipped"; plot: number; cowId: number }
  | { type: "townMood"; mood: TownMood }
  | { type: "warning"; group: Group }
  | { type: "protest"; group: Group }
  | { type: "fine"; group: Group; amount: number }
  | { type: "monthEnd"; profit: number }
  | { type: "newYear"; year: number }
  | { type: "boardAlarm"; level: number }
  | { type: "redAccount" }
  | { type: "gameOver" };

export type Result = { ok: true } | { ok: false; reason: "busy" | "rule" | "over" };

export interface Config {
  startYear: number;
  startMoney: number;
  bankruptcy: number;
  weeksPerMonth: number;
  // farm
  fertilityMax: number;
  fertilityAlarm: number;
  fertilityRegrow: number;
  pastureStartLoss: number;
  pastureCost: number;
  soyCost: number;
  clearPastureCost: number;
  clearSoyCost: number;
  clearWeeks: number;
  bribeCost: number;
  gmCost: number;
  gmYield: number;
  wasteYield: number;
  soyBaseYield: number;
  calfMonths: number;
  pastureUpkeep: number;
  soyUpkeep: number;
  // feedlot
  maxCows: number;
  startCows: number;
  startWeight: number;
  gain1: number;
  gain2: number;
  gain3: number;
  hormoneGain: number;
  hormoneCost: number;
  minWeight: number;
  slaughterWeight: number;
  feedMax: number;
  feedStart: number;
  feedPerCow: number;
  mealFeed: number;
  illnessBase: number;
  wasteRisk: number;
  hormoneRisk: number;
  gmRisk: number;
  bseBase: number;
  bseSpread: number;
  pattiesPerCow: number;
  beltPerWeek: number;
  // restaurant
  fridgeMax: number;
  fridgeStart: number;
  burgersStart: number;
  crewWage: number;
  maxMotivation: number;
  moraleDice: number;
  badgeLuck: number;
  warnLuck: number;
  queueMax: number;
  burgerPrice: number;
  // office
  campaignCost: Record<CampaignId, number>;
  expectStart: number;
  expectStep: number;
  expectMax: number;
  // dissent
  ecoForest: number;
  globalForest: number;
  globalVillage: number;
  kidsGlobal: number;
  consumerIll: number;
  consumerMad: number;
  unionWarn: number;
  unionFire: number;
  strikeMonths: number;
  boycottMonths: number;
  obesityFine: number;
  consumerFine: number;
  /** names given to arriving cows, used in turn */
  cowNames: string[];
}

export interface Game {
  readonly state: Readonly<GameState>;
  readonly config: Readonly<Config>;
  /** advances one week (docs/rules.md section 1) */
  tick(): GameEvent[];
  farm: {
    /** empty, forest, village, grain (after the bribe) or soy plot → pasture */
    makePasture(plot: number): Result;
    /** empty, forest, village, grain (after the bribe) or pasture plot → soy */
    sowSoy(plot: number): Result;
    addCow(plot: number): Result;
    removeCow(plot: number): Result;
    sell(plot: number): Result;
    setGm(plot: number, on: boolean): Result;
    bribeMayor(): Result;
    /** cost of makePasture / sowSoy on this plot, null when not allowed */
    cost(plot: number, action: "pasture" | "soy"): number | null;
  };
  feedlot: {
    setAdditive(kind: Additive, on: boolean): Result;
    destroy(cowId: number): Result;
  };
  restaurant: {
    hire(station: StationId): Result;
    fire(station: StationId): Result;
    badge(station: StationId): Result;
    warn(station: StationId): Result;
  };
  office: {
    setCampaign(id: CampaignId, on: boolean): Result;
  };
  feedlotAlerts(): FeedlotAlert[];
  restaurantAlerts(): RestaurantAlert[];
}
