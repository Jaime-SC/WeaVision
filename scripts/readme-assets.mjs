// Regenerates the README images in docs/: the brand banner and app screenshots.
// Usage: npm run build && npx vite preview --port 4173 --strictPort   (in another terminal)
//        node scripts/readme-assets.mjs
import { chromium, devices } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = `${root}docs/`;
mkdirSync(out, { recursive: true });
const base = process.env.WEAVISION_URL ?? "http://localhost:4173";

const font = readFileSync(`${root}node_modules/@fontsource-variable/bricolage-grotesque/files/bricolage-grotesque-latin-wght-normal.woff2`).toString("base64");
const mark = readFileSync(`${root}public/brand.svg`, "utf8").replace(/<title>.*?<\/title>/, "");

const banner = `<!doctype html><html><head><style>
  @font-face { font-family: Bricolage; src: url(data:font/woff2;base64,${font}) format("woff2"); font-weight: 200 800; }
  html, body { margin: 0; }
  body { width: 1280px; height: 400px; background: #1B4532; display: grid; place-items: center; font-family: Bricolage, sans-serif; }
  .lockup { display: flex; align-items: center; gap: 36px; }
  .lockup svg { width: 210px; height: 210px; }
  h1 { margin: 0; font-size: 132px; font-weight: 800; letter-spacing: -0.03em; line-height: 1; }
  h1 .a { color: #E3E4E5; } h1 .b { color: #EE4129; }
  p { margin: 18px 0 0; color: #E3E4E5; opacity: .82; font-size: 30px; font-weight: 500; letter-spacing: -0.01em; }
</style></head><body><div class="lockup">${mark}<div><h1><span class="a">Wea</span><span class="b">Vision</span></h1>
  <p>Tu lista IPTV en Windows, Android, Android TV y Android Auto</p></div></div></body></html>`;

const browser = await chromium.launch();

// Banner (rendered at 2x for sharp text on high-DPI screens).
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 400 }, deviceScaleFactor: 2 });
  await page.setContent(banner, { waitUntil: "load" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${out}banner.png` });
  await page.close();
}

async function loadSample(page) {
  await page.goto(base);
  await page.getByRole("button", { name: "Probar con lista de ejemplo" }).click();
  await page.locator("#grid .tile").first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(1500); // let entrance animations settle
  await page.locator("#toast").evaluate((el) => { el.hidden = true; }); // the "list loaded" notice
}

// TV / desktop layout.
{
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1.5, reducedMotion: "reduce" });
  await loadSample(page);
  await page.screenshot({ path: `${out}screenshot-tv.png` });
  // Player: Big Buck Bunny (Blender Foundation, CC BY 3.0) from the sample list.
  await page.locator("#grid .tile").first().click();
  await page.waitForFunction(() => { const v = document.querySelector("video"); return v && v.currentTime > 1; }, null, { timeout: 60000 });
  await page.evaluate(() => { document.querySelector("video").currentTime = 112; }); // a scene with the bunny
  await page.waitForFunction(() => { const v = document.querySelector("video"); return v.currentTime > 114 && v.readyState >= 3; }, null, { timeout: 60000 });
  await page.mouse.move(640, 360); // show the on-screen controls
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${out}screenshot-player.jpg`, type: "jpeg", quality: 85 });
  await page.close();
}

// Phone layout.
{
  const ctx = await browser.newContext({ ...devices["Pixel 7"], reducedMotion: "reduce" });
  const page = await ctx.newPage();
  await loadSample(page);
  await page.screenshot({ path: `${out}screenshot-phone.png` });
  await ctx.close();
}

await browser.close();
console.log("README assets written to docs/");
