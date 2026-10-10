// Shared interface types: what scenes, the HUD and windows can see and do.
import type { Game, GameEvent } from "../sim/index.ts";
import type { Sound } from "../audio/sound.ts";
import type { Ctx } from "./draw.ts";

export type Sector = "farm" | "feedlot" | "restaurant" | "office";
export const SECTORS: Sector[] = ["farm", "feedlot", "restaurant", "office"];

export type Vars = Record<string, string | number>;
export type T = (key: string, vars?: Vars) => string;

/** a button in the context row opened by clicking something */
export interface Action {
  icon: string;
  label: string;
  /** what it costs (shown in the info bar) */
  cost?: number;
  /** what it earns */
  earn?: number;
  /** a switch: shows its state with a lamp */
  on?: boolean;
  disabled?: boolean;
  /** extra line under the label */
  note?: string;
  run(): void;
  /** keep the row open after running (switches, +/-) */
  keep?: boolean;
}

/** something on screen the pointer can point at */
export interface Target {
  id: string;
  hit(x: number, y: number): boolean;
  /** title and details for the info bar */
  info(): { title: string; text?: string };
  actions?(): Action[];
  /** where the action row opens */
  anchor(): [number, number];
  /** a click without actions */
  click?(): void;
}

export interface Floater {
  sector: Sector | null;
  x: number;
  y: number;
  text: string;
  color: string;
  born: number;
  icon?: string;
}

export interface App {
  game: Game;
  t: T;
  lang: string;
  sound: Sound;
  /** seconds since start */
  now: number;
  sector: Sector;
  hoverId: string | null;
  float(f: Omit<Floater, "born" | "sector"> & { sector?: Sector | null }): void;
  open(w: Win): void;
  money(n: number): string;
  setSector(s: Sector): void;
  close(w?: Win): void;
  /** back to the main menu */
  quit(): void;
  newGame(): void;
  paused: boolean;
}

export interface Scene {
  ambience: string[];
  draw(ctx: Ctx, app: App): void;
  /** hit order: last drawn first */
  targets(app: App): Target[];
  event?(e: GameEvent, app: App): void;
  /** called when the sector is shown */
  enter?(app: App): void;
}

export interface WinButton {
  label: string;
  icon?: string;
  color?: string;
  disabled?: boolean;
  run(): void;
}

export interface Win {
  id?: string;
  title: string;
  w: number;
  h: number;
  /** draws the body inside (x, y, w, h) */
  body(ctx: Ctx, x: number, y: number, w: number, h: number, app: App): void;
  buttons: WinButton[];
  /** clickable areas inside the body, relative to the body origin */
  hits?: { x: number; y: number; w: number; h: number; run?(): void; hover?: string; drag?(fx: number): void }[];
  onClose?(): void;
  /** the clock keeps running behind it */
  live?: boolean;
  accent?: string;
}
