// Renders every platform icon from public/brand.svg: `node scripts/icons.mjs` (needs Playwright's Chromium).
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";

const GREEN = "#1B4532";
const mark = readFileSync("public/brand.svg", "utf8").replace(/<title>.*?<\/title>/, "");
const font = readFileSync("node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2").toString("base64");
const res = "android/app/src/main/res";
const DENSITY = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const page = (w, h, body) => `<html><head><style>
@font-face{font-family:B;src:url(data:font/woff2;base64,${font})}
html,body{margin:0;width:${w}px;height:${h}px;overflow:hidden;background:transparent}
.c{width:100%;height:100%;display:grid;place-items:center;box-sizing:border-box}
svg{display:block}</style></head><body>${body}</body></html>`;

const markAt = (size) => mark.replace("<svg ", `<svg width="${size}" height="${size}" `);
const shapes = {
  // Full icon: rounded green tile (Windows, favicon, legacy launcher).
  full: (s) => `<div class="c" style="background:${GREEN};border-radius:${s * 0.22}px">${markAt(s * 0.74)}</div>`,
  round: (s) => `<div class="c" style="background:${GREEN};border-radius:50%">${markAt(s * 0.66)}</div>`,
  // Adaptive foreground: mark inside the 66/108 safe zone, transparent.
  fg: (s) => `<div class="c">${markAt(s * 0.56)}</div>`,
  splash: (w, h) => `<div class="c" style="background:${GREEN}">${markAt(Math.min(w, h) * 0.32)}</div>`,
  banner: (w, h) => `<div class="c" style="background:${GREEN};grid-auto-flow:column;gap:${w * 0.03}px;justify-content:center">${markAt(h * 0.5)}<span style="font:800 ${h * 0.2}px B;letter-spacing:-0.03em;color:#e3e4e5">Wea<span style="color:#ee4129">Vision</span></span></div>`,
};

const browser = await chromium.launch();
const ctx = await browser.newContext({ deviceScaleFactor: 1 });
const p = await ctx.newPage();
async function shot(file, w, h, html) {
  mkdirSync(dirname(file), { recursive: true });
  await p.setViewportSize({ width: Math.round(w), height: Math.round(h) });
  await p.setContent(page(Math.round(w), Math.round(h), html));
  await p.evaluate(() => document.fonts.ready);
  writeFileSync(file, await p.screenshot({ omitBackground: true }));
}

for (const [d, k] of Object.entries(DENSITY)) {
  await shot(`${res}/mipmap-${d}/ic_launcher.png`, 48 * k, 48 * k, shapes.full(48 * k));
  await shot(`${res}/mipmap-${d}/ic_launcher_round.png`, 48 * k, 48 * k, shapes.round(48 * k));
  await shot(`${res}/mipmap-${d}/ic_launcher_foreground.png`, 108 * k, 108 * k, shapes.fg(108 * k));
}
await shot(`${res}/drawable-xhdpi/banner.png`, 320, 180, shapes.banner(320, 180));
// Capacitor's splash drawables: keep every existing size, repaint in the brand.
for (const dir of readdirSync(res).filter((n) => n.startsWith("drawable"))) {
  for (const f of readdirSync(join(res, dir)).filter((f) => f === "splash.png")) {
    const file = join(res, dir, f);
    const { width, height } = await p.evaluate(async (src) => {
      const img = new Image(); img.src = src; await img.decode(); return { width: img.width, height: img.height };
    }, `data:image/png;base64,${readFileSync(file).toString("base64")}`);
    await shot(file, width, height, shapes.splash(width, height));
  }
}
await shot("build/icon.png", 512, 512, shapes.full(512));
await shot("public/icon-192.png", 192, 192, shapes.full(192));
// Windows .ico with PNG-compressed entries.
const sizes = [16, 24, 32, 48, 64, 128, 256];
const pngs = [];
for (const s of sizes) {
  await p.setViewportSize({ width: s, height: s });
  await p.setContent(page(s, s, shapes.full(s)));
  pngs.push(await p.screenshot({ omitBackground: true }));
}
const header = Buffer.alloc(6 + 16 * sizes.length);
header.writeUInt16LE(1, 2);
header.writeUInt16LE(sizes.length, 4);
let offset = header.length;
sizes.forEach((s, i) => {
  const e = 6 + 16 * i;
  header[e] = s >= 256 ? 0 : s;
  header[e + 1] = s >= 256 ? 0 : s;
  header.writeUInt16LE(1, e + 4);
  header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(pngs[i].length, e + 8);
  header.writeUInt32LE(offset, e + 12);
  offset += pngs[i].length;
});
writeFileSync("build/icon.ico", Buffer.concat([header, ...pngs]));
await browser.close();
console.log("icons written");
