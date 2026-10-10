// The main menu: a planet with a bite out of it, a burger moon and the title.
import type { App } from "./core.ts";
import { C, type Ctx, H, W, circle, hash, oval, paint, rrect, text } from "./draw.ts";
import { drawIcon } from "./icons.ts";
import { drawPerson, randomPerson } from "./people.ts";

export function drawMenuArt(ctx: Ctx, app: App): void {
  const t = app.now;
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, "#22304a");
  g.addColorStop(1, "#5a3a4a");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  for (let k = 0; k < 70; k++) {
    const tw = 0.5 + Math.sin(t * 2 + k) * 0.5;
    circle(ctx, hash(k) * W, hash(k + 99) * H * 0.8, 1 + hash(k + 7) * 1.4, `rgba(255,255,230,${0.3 + tw * 0.6})`, 0);
  }
  // the planet, bitten
  const px = 250;
  const py = 330;
  const r = 170;
  const BITES: [number, number, number][] = [[px + 128, py - 120, 46], [px + 160, py - 62, 40], [px + 82, py - 158, 38]];
  ctx.save();
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.clip();
  // the bite: three circles cut from the upper right
  ctx.beginPath();
  ctx.rect(0, 0, W, H);
  for (const [bx, by, br] of BITES) {
    ctx.moveTo(bx + br, by);
    ctx.arc(bx, by, br, 0, Math.PI * 2);
  }
  ctx.clip("evenodd");
  const sea = ctx.createRadialGradient(px - 60, py - 60, 20, px, py, r);
  sea.addColorStop(0, "#5cc3e3");
  sea.addColorStop(1, "#1f6f99");
  ctx.fillStyle = sea;
  ctx.fillRect(px - r, py - r, r * 2, r * 2);
  // continents drift slowly
  const drift = (t * 6) % 120;
  for (const [cx, cy, rx, ry] of [[px - 70, py - 40, 60, 40], [px + 40, py + 50, 70, 46], [px - 30, py + 110, 40, 22], [px + 80, py - 40, 30, 50]] as [number, number, number, number][]) {
    for (const off of [0, -240]) {
      const x = cx + drift + off;
      oval(ctx, x, cy, rx, ry, "#7cc04b", 2);
      oval(ctx, x - rx * 0.3, cy - ry * 0.2, rx * 0.45, ry * 0.4, "#5aa646", 0);
    }
  }
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  paint(ctx, null, 6);
  // the inside of the bite shows the patty layers
  ctx.restore();
  for (const [bx, by, br] of BITES) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    paint(ctx, null, 7, "#7a3b20");
    ctx.beginPath();
    ctx.arc(bx, by, br + 4, 0, Math.PI * 2);
    paint(ctx, null, 3, "#e7a24f");
    ctx.restore();
  }
  // crumbs floating off
  for (let k = 0; k < 7; k++) {
    const q = (t * 0.05 + k / 7) % 1;
    circle(ctx, px + 150 + q * 160, py - 120 - q * 90 + Math.sin(q * 9 + k) * 12, 3 + (k % 3), k % 2 ? "#e7a24f" : "#7cc04b", 1.4);
  }
  // a burger moon
  const bob = Math.sin(t * 1.4) * 6;
  ctx.save();
  ctx.translate(560, 190 + bob);
  ctx.rotate(Math.sin(t * 0.7) * 0.08);
  drawIcon(ctx, "burger", 0, 0, 120, t);
  ctx.restore();
  // a tiny crowd queuing on the planet's rim
  for (let k = 0; k < 5; k++) {
    const a = -Math.PI * 0.95 + k * 0.15;
    const x = px + Math.cos(a) * (r + 2);
    const y = py + Math.sin(a) * (r + 2);
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(a + Math.PI / 2);
    drawPerson(ctx, 0, 0, randomPerson(k + 300), { scale: 0.6, pose: "idle", t: t + k, mood: 3 });
    ctx.restore();
  }
  // title
  ctx.save();
  ctx.translate(700, 340);
  ctx.rotate(-0.05);
  text(ctx, "Burgrix", 0, 0, { size: 86, weight: 900, color: C.mustard, outline: C.ink, outlineWidth: 14, align: "center" });
  text(ctx, "Burgrix", 0, -2, { size: 86, weight: 900, color: C.mustard, align: "center" });
  ctx.restore();
  text(ctx, app.t("menu.tagline"), 700, 398, { size: 17, weight: 800, color: C.cream, align: "center", max: 440 });
  rrect(ctx, 0, H - 26, W, 26, 0);
  paint(ctx, "rgba(0,0,0,0.25)", 0);
  text(ctx, app.t("menu.footer"), W / 2, H - 13, { size: 11, weight: 700, color: "rgba(255,244,221,0.75)", align: "center", max: W - 40 });
}
