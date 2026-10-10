// Burgrix's people: round-headed staff, customers and managers drawn from a few
// parts. Moods 1..4 (angry, bored, calm, happy) plus "worried" (looks at the player).
import { C, type Ctx, circle, hash, line, oval, paint, path, rrect, shade, shadow } from "./draw.ts";

export type Mood = 1 | 2 | 3 | 4 | "worried" | "yawn" | "talk";
export type Pose = "idle" | "work" | "wave" | "yawn" | "talk" | "walk" | "sit";
export type Hair = "short" | "bun" | "curly" | "bald" | "pony" | "spiky" | "bob";
export type Hat = "none" | "chef" | "cap" | "headset" | "hardhat";

export interface Person {
  skin: string;
  hair: string;
  hairStyle: Hair;
  shirt: string;
  pants: string;
  hat?: Hat;
  hatColor?: string;
  apron?: boolean;
  tie?: string;
  glasses?: boolean;
}

export const SKINS = ["#f6d2b0", "#e9b48a", "#c98c5f", "#9a6440", "#6e452b", "#f1c7a1"];
const HAIRS = ["#3a2618", "#6b3f22", "#b5652d", "#e0b552", "#2b2b2b", "#8a8a8a", "#a33b2a"];
const SHIRTS = ["#5b9bd5", "#e57a44", "#7cc04b", "#c45b8f", "#f2c94c", "#56b5a6", "#9b7ad1", "#e0e0e0", "#d8432f"];
const STYLES: Hair[] = ["short", "bun", "curly", "bald", "pony", "spiky", "bob"];

/** a random looking but stable passer-by for an id */
export function randomPerson(id: number): Person {
  const r = (k: number) => hash(id * 7 + k);
  const pick = <T,>(a: T[], k: number) => a[Math.floor(r(k) * a.length) % a.length]!;
  return {
    skin: pick(SKINS, 1),
    hair: pick(HAIRS, 2),
    hairStyle: pick(STYLES, 3),
    shirt: pick(SHIRTS, 4),
    pants: pick(["#3d4f6b", "#5a4632", "#2f3a2f", "#6b6b6b"], 5),
    glasses: r(6) < 0.2,
  };
}

export interface DrawOpts {
  mood?: Mood;
  pose?: Pose;
  /** seconds, drives the animation */
  t?: number;
  facing?: 1 | -1;
  scale?: number;
  /** extra lift, e.g. a jump */
  lift?: number;
  /** hide the legs (behind a desk or counter) */
  seated?: boolean;
  /** what the hands hold while working */
  holding?: "spatula" | "tray" | "phone" | "paper" | null;
}

export function drawPerson(ctx: Ctx, x: number, y: number, p: Person, o: DrawOpts = {}): void {
  const s = o.scale ?? 1;
  const t = o.t ?? 0;
  const f = o.facing ?? 1;
  const pose = o.pose ?? "idle";
  const jump = pose === "wave" ? Math.abs(Math.sin(t * 7)) * 9 : 0;
  const bob = pose === "walk" ? Math.abs(Math.sin(t * 9)) * 2 : pose === "idle" || pose === "sit" ? Math.sin(t * 2 + x) * 0.6 : 0;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  if (!o.seated) shadow(ctx, 0, 0, 11 - jump * 0.3, 4);
  ctx.translate(0, -(o.lift ?? 0) - jump - bob);

  // legs
  if (!o.seated) {
    const step = pose === "walk" ? Math.sin(t * 9) * 3 : 0;
    rrect(ctx, -7 + step, -12, 6, 12, 2.5);
    paint(ctx, p.pants, 1.6);
    rrect(ctx, 1 - step, -12, 6, 12, 2.5);
    paint(ctx, p.pants, 1.6);
    oval(ctx, -4 + step + f, -0.5, 4.2, 2.2, C.ink, 0);
    oval(ctx, 4 - step + f, -0.5, 4.2, 2.2, C.ink, 0);
  }

  // arms behind the body when waving
  const arm = (side: 1 | -1, ang: number) => {
    const sx = side * 9;
    const sy = -27;
    const ex = sx + Math.sin(ang) * 12 * side;
    const ey = sy + Math.cos(ang) * 12;
    line(ctx, [[sx, sy], [ex, ey]], C.ink, 6.4);
    line(ctx, [[sx, sy], [ex, ey]], p.shirt, 4);
    circle(ctx, ex, ey, 2.8, p.skin, 1.5);
    return [ex, ey] as const;
  };
  let hands: (readonly [number, number])[] = [];
  const armsFirst = pose === "wave";
  const doArms = () => {
    if (pose === "wave") {
      const w = Math.sin(t * 14) * 0.35;
      hands = [arm(-1, Math.PI * 0.86 + w), arm(1, Math.PI * 0.86 - w)];
    } else if (pose === "work") {
      const w = Math.sin(t * 8) * 0.5;
      hands = [arm(-1, 0.25), arm(1, 1.1 + w)];
    } else if (pose === "yawn") hands = [arm(-1, 0.2), arm(f > 0 ? 1 : 1, 2.7)];
    else if (pose === "talk") hands = [arm(-1, 0.2), arm(1, 1.4 + Math.sin(t * 5) * 0.4)];
    else if (pose === "sit") hands = [arm(-1, 0.9), arm(1, 0.9)];
    else hands = [arm(-1, 0.18 + Math.sin(t * 2) * 0.03), arm(1, 0.18 - Math.sin(t * 2) * 0.03)];
  };
  if (armsFirst) doArms();

  // body
  path(ctx, [
    [-10, -12],
    [10, -12],
    [9, -28],
    [5, -31],
    [-5, -31],
    [-9, -28],
  ]);
  paint(ctx, p.shirt, 2);
  if (p.apron) {
    rrect(ctx, -6.5, -26, 13, 15, 2.5);
    paint(ctx, "#fbfbf7", 1.4);
  }
  if (p.tie) {
    path(ctx, [
      [0, -30],
      [2, -27],
      [0.8, -18],
      [0, -16.5],
      [-0.8, -18],
      [-2, -27],
    ]);
    paint(ctx, p.tie, 1.2);
  }
  if (!armsFirst) doArms();

  // held things
  const h = hands[1];
  if (h && o.holding === "spatula") {
    line(ctx, [[h[0], h[1]], [h[0] + 7, h[1] - 7]], C.ink, 2.2);
    rrect(ctx, h[0] + 6, h[1] - 12, 6, 5, 1);
    paint(ctx, C.steel, 1.4);
  } else if (h && o.holding === "phone") {
    rrect(ctx, h[0] - 2, h[1] - 6, 4, 7, 1);
    paint(ctx, C.night, 1);
  } else if (h && o.holding === "paper") {
    rrect(ctx, h[0] - 4, h[1] - 8, 8, 10, 1);
    paint(ctx, C.white, 1.2);
  } else if (h && o.holding === "tray") {
    oval(ctx, h[0], h[1] - 2, 8, 2.5, C.ketchup, 1.4);
  }

  drawHead(ctx, 0, -42, p, o.mood ?? 3, f, t);
  ctx.restore();
}

export function drawHead(ctx: Ctx, x: number, y: number, p: Person, mood: Mood, f: 1 | -1, t: number): void {
  const r = 11;
  ctx.save();
  ctx.translate(x, y);
  // hair at the back
  if (p.hairStyle === "pony") oval(ctx, -f * 10, 3, 4, 7, p.hair, 1.6);
  if (p.hairStyle === "bob") {
    rrect(ctx, -12.5, -6, 25, 18, 7);
    paint(ctx, p.hair, 1.8);
  }
  // ears and face
  circle(ctx, -10.5, 1, 3, p.skin, 1.6);
  circle(ctx, 10.5, 1, 3, p.skin, 1.6);
  circle(ctx, 0, 0, r, p.skin, 2);

  // hair on top
  const hair = p.hair;
  switch (p.hairStyle) {
    case "short":
    case "pony":
    case "bob":
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 1.02, Math.PI * 1.98);
      ctx.quadraticCurveTo(4 * f, -4, -2 * f, -5);
      ctx.quadraticCurveTo(-7 * f, -3, -r, -1);
      ctx.closePath();
      paint(ctx, hair, 1.8);
      break;
    case "bun":
      circle(ctx, 0, -12, 4.5, hair, 1.8);
      ctx.beginPath();
      ctx.arc(0, 0, r, Math.PI * 1.05, Math.PI * 1.95);
      ctx.quadraticCurveTo(0, -5, -r * 0.98, -2.5);
      ctx.closePath();
      paint(ctx, hair, 1.8);
      break;
    case "curly":
      for (let k = 0; k < 7; k++) {
        const a = Math.PI * (1.0 + (k / 6) * 1.0);
        circle(ctx, Math.cos(a) * 9.5, Math.sin(a) * 9.5 - 1, 4.2, hair, 1.4);
      }
      break;
    case "spiky":
      path(ctx, [
        [-10, -3],
        [-9, -11],
        [-5, -8],
        [-2, -14],
        [1, -9],
        [5, -13],
        [6, -8],
        [10, -9],
        [10, -3],
        [0, -6],
      ]);
      paint(ctx, hair, 1.6);
      break;
    case "bald":
      oval(ctx, -3, -6, 3, 1.6, "rgba(255,255,255,0.35)", 0);
      break;
  }

  drawFace(ctx, p, mood, f, t);

  // hats
  const hat = p.hat ?? "none";
  if (hat === "chef") {
    rrect(ctx, -8.5, -14, 17, 6, 2);
    paint(ctx, C.white, 1.8);
    ctx.beginPath();
    ctx.arc(-5, -17, 5, Math.PI * 0.7, Math.PI * 1.9);
    ctx.arc(0, -20, 5.5, Math.PI * 1.1, Math.PI * 1.9);
    ctx.arc(5, -17, 5, Math.PI * 1.1, Math.PI * 2.3);
    ctx.lineTo(8.5, -13.5);
    ctx.lineTo(-8.5, -13.5);
    ctx.closePath();
    paint(ctx, C.white, 1.8);
  } else if (hat === "cap") {
    ctx.beginPath();
    ctx.arc(0, -3, r * 0.98, Math.PI, 0);
    ctx.closePath();
    paint(ctx, p.hatColor ?? C.ketchup, 1.8);
    path(ctx, [
      [3 * f, -4],
      [15 * f, -3],
      [15 * f, -1],
      [3 * f, -1.5],
    ]);
    paint(ctx, shade(p.hatColor ?? C.ketchup, -0.2), 1.6);
    circle(ctx, 0, -13.5, 1.6, shade(p.hatColor ?? C.ketchup, -0.2), 1);
  } else if (hat === "headset") {
    ctx.beginPath();
    ctx.arc(0, 0, r + 1.5, Math.PI * 1.08, Math.PI * 1.92);
    paint(ctx, null, 2.2, C.night);
    rrect(ctx, -13.5, -2, 4, 7, 1.5);
    paint(ctx, p.hatColor ?? C.night, 1.2);
    line(ctx, [[-11.5, 4], [-7, 9], [-2, 8.5]], C.night, 1.5);
    circle(ctx, -2, 8.5, 1.3, p.hatColor ?? C.ketchup, 0.8);
  } else if (hat === "hardhat") {
    ctx.beginPath();
    ctx.arc(0, -2, r + 0.5, Math.PI, 0);
    ctx.closePath();
    paint(ctx, p.hatColor ?? C.mustard, 1.8);
    rrect(ctx, -14, -3.5, 28, 3.5, 1.5);
    paint(ctx, p.hatColor ?? C.mustard, 1.6);
  }
  ctx.restore();
}

function drawFace(ctx: Ctx, p: Person, mood: Mood, f: 1 | -1, t: number): void {
  // the worried face looks straight at the player
  const dx = mood === "worried" ? 0 : f * 2.2;
  const ey = 0;
  const blink = Math.sin(t * 1.3 + p.skin.length) > 0.985;
  const eye = (x: number) => {
    if (mood === "yawn" || blink) line(ctx, [[x - 2, ey], [x + 2, ey]], C.ink, 1.6);
    else if (mood === "worried") {
      circle(ctx, x, ey, 2.6, C.white, 1.2);
      circle(ctx, x, ey + 0.3, 1.3, C.ink, 0);
    } else circle(ctx, x, ey, 1.6, C.ink, 0);
  };
  eye(dx - 4.2);
  eye(dx + 4.2);
  if (p.glasses) {
    circle(ctx, dx - 4.2, ey, 3.4, null, 1.2);
    circle(ctx, dx + 4.2, ey, 3.4, null, 1.2);
    line(ctx, [[dx - 0.8, ey], [dx + 0.8, ey]], C.ink, 1.2);
  }
  // brows
  if (mood === 1) {
    line(ctx, [[dx - 7, -5], [dx - 2, -3]], C.ink, 1.8);
    line(ctx, [[dx + 7, -5], [dx + 2, -3]], C.ink, 1.8);
  } else if (mood === "worried") {
    line(ctx, [[dx - 7, -4], [dx - 2.5, -6]], C.ink, 1.6);
    line(ctx, [[dx + 7, -4], [dx + 2.5, -6]], C.ink, 1.6);
  } else if (mood === 2) {
    // heavy lids
    line(ctx, [[dx - 6.2, -1.3], [dx - 2.2, -1.3]], C.ink, 1.4);
    line(ctx, [[dx + 2.2, -1.3], [dx + 6.2, -1.3]], C.ink, 1.4);
  }
  // cheeks
  if (mood === 4) {
    oval(ctx, dx - 6.5, 4, 2.2, 1.3, "rgba(232,104,104,0.45)", 0);
    oval(ctx, dx + 6.5, 4, 2.2, 1.3, "rgba(232,104,104,0.45)", 0);
  }
  // mouth
  const mx = dx;
  const my = 5.5;
  ctx.beginPath();
  switch (mood) {
    case 4:
      ctx.moveTo(mx - 4, my - 0.5);
      ctx.quadraticCurveTo(mx, my + 5, mx + 4, my - 0.5);
      ctx.closePath();
      paint(ctx, "#8c2f22", 1.4);
      break;
    case 3:
      ctx.moveTo(mx - 3, my);
      ctx.quadraticCurveTo(mx, my + 2.5, mx + 3, my);
      paint(ctx, null, 1.6);
      break;
    case 2:
      ctx.moveTo(mx - 3, my + 1);
      ctx.lineTo(mx + 3, my + 0.5);
      paint(ctx, null, 1.6);
      break;
    case 1:
      ctx.moveTo(mx - 3.5, my + 2);
      ctx.quadraticCurveTo(mx, my - 1.5, mx + 3.5, my + 2);
      paint(ctx, null, 1.8);
      break;
    case "worried": {
      const w = Math.sin(t * 20) * 0.6;
      ctx.moveTo(mx - 3.5, my + 2);
      ctx.quadraticCurveTo(mx - 1.5, my + w, mx, my + 1.5);
      ctx.quadraticCurveTo(mx + 1.5, my + 3 - w, mx + 3.5, my + 1);
      paint(ctx, null, 1.6);
      // a drop of sweat
      ctx.beginPath();
      ctx.moveTo(9, -8);
      ctx.quadraticCurveTo(12, -3, 9.5, -2);
      ctx.quadraticCurveTo(7, -3, 9, -8);
      paint(ctx, "#bfe9ff", 1.1);
      break;
    }
    case "yawn":
      oval(ctx, mx, my + 1, 2.6, 3.6, "#8c2f22", 1.4);
      break;
    case "talk": {
      const o = Math.abs(Math.sin(t * 12)) * 2.2;
      oval(ctx, mx, my + 0.5, 2.8, 0.8 + o, "#8c2f22", 1.4);
      break;
    }
  }
}

/** z z z above a yawning head */
export function drawZzz(ctx: Ctx, x: number, y: number, t: number): void {
  for (let k = 0; k < 3; k++) {
    const ph = (t * 0.8 + k / 3) % 1;
    ctx.globalAlpha = 1 - ph;
    ctx.font = `800 ${9 + k * 2}px Nunito, Arial`;
    ctx.fillStyle = C.blue;
    ctx.fillText("z", x + ph * 10 + k * 3, y - ph * 18);
  }
  ctx.globalAlpha = 1;
}
