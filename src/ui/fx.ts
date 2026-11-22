// Motion layer. Roles: anime.js draws the brand moments (logo, zap sticker, tuning signal);
// Motion (motion.dev) runs interface transitions and the ported KokonutUI / Bklit UI components.
import { animate as tween, createTimeline, stagger as aStagger, svg, type JSAnimation } from "animejs";
import { animate, stagger } from "motion";

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/* ---------- Motion: interface transitions ---------- */

/** New view slides up into place, children one after another. */
export function enterView(root: HTMLElement) {
  if (reduced()) return;
  animate([...root.children].slice(0, 6), { opacity: [0, 1], y: [18, 0] }, { duration: 0.5, delay: stagger(0.06), ease: EASE_OUT });
}

/** First tiles of a grid pop in; later pages appear instantly so long lists stay fast on TV boxes. */
export function revealTiles(tiles: Element[]) {
  if (reduced() || !tiles.length) return;
  animate(tiles.slice(0, 24), { opacity: [0, 1], scale: [0.9, 1], y: [14, 0] }, { duration: 0.45, delay: stagger(0.025), ease: EASE_OUT });
}

/** OSD fades with a short lift, instead of a hard CSS cut. */
export function osd(el: HTMLElement, show: boolean) {
  if (reduced()) return;
  const bar = el.querySelector(".osd-bar");
  if (bar) animate(bar, show ? { y: [24, 0], opacity: [0, 1] } : { y: 24, opacity: 0 }, { type: "spring", stiffness: 380, damping: 30 });
}

/** Channel drawer: a side panel on wide screens, a bottom sheet on a phone held upright. */
export function drawerMotion(el: HTMLElement, open: boolean): Promise<unknown> {
  if (reduced()) return Promise.resolve();
  const sheet = matchMedia("(max-width: 720px) and (orientation: portrait)").matches;
  // Set both axes every time: Motion remembers the last value of each, so a sheet closed
  // upright would otherwise reopen pushed off-screen after the phone is turned sideways.
  const off = sheet ? { x: "0%", y: "100%" } : { x: "-100%", y: "0%" };
  const on = { x: "0%", y: "0%" };
  return open
    ? animate(el, { ...on, opacity: [0.6, 1] }, { type: "spring", stiffness: 360, damping: 34 }).finished
    : animate(el, { ...off, opacity: 0.6 }, { duration: 0.22, ease: "easeIn" }).finished;
}

/* ---------- KokonutUI "Smooth Tab" (MIT, kokonutui.com) ported: sliding active pill ---------- */

export function moveTabIndicator(items: HTMLElement, active: HTMLElement | null, instant = false) {
  let pill = items.querySelector<HTMLElement>(".tab-pill");
  if (!pill) {
    pill = document.createElement("span");
    pill.className = "tab-pill";
    pill.setAttribute("aria-hidden", "true");
    items.prepend(pill);
  }
  if (!active) return;
  const box = { x: active.offsetLeft, y: active.offsetTop, width: active.offsetWidth, height: active.offsetHeight };
  if (instant || reduced() || !pill.dataset.ready) {
    Object.assign(pill.style, { transform: `translate(${box.x}px, ${box.y}px)`, width: `${box.width}px`, height: `${box.height}px` });
    pill.dataset.ready = "1";
    return;
  }
  animate(pill, { x: box.x, y: box.y, width: box.width, height: box.height }, { type: "spring", stiffness: 420, damping: 34 });
}

/* ---------- KokonutUI "Promise Toast" (MIT) ported: one toast that morphs loading → done ---------- */

type ToastKind = "info" | "error" | "loading" | "success";
const TOAST_ICON: Record<ToastKind, string> = {
  info: "",
  loading: '<span class="toast-spin" aria-hidden="true"></span>',
  success: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5 9-10"/></svg>',
  error: '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 7v6M12 17v.5"/></svg>',
};

export function showToast(el: HTMLElement, msg: string, kind: ToastKind = "info") {
  const wasHidden = el.hidden;
  el.hidden = false;
  el.className = `toast ${kind}`;
  el.innerHTML = `${TOAST_ICON[kind]}<span>${msg.replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`)}</span>`;
  clearTimeout(Number(el.dataset.timer));
  if (!reduced()) {
    if (wasHidden) animate(el, { y: [28, 0], scale: [0.94, 1], opacity: [0, 1] }, { type: "spring", stiffness: 500, damping: 30 });
    else animate(el, { scale: [0.97, 1] }, { type: "spring", stiffness: 600, damping: 20 });
  }
  if (kind === "loading") return;
  el.dataset.timer = String(
    setTimeout(async () => {
      if (!reduced()) await animate(el, { y: 16, opacity: 0 }, { duration: 0.25, ease: "easeIn" }).finished;
      el.hidden = true;
      el.style.opacity = "";
      el.style.transform = "";
    }, kind === "error" ? 6000 : 3800),
  );
}

/* ---------- KokonutUI "Hold Button" (MIT) ported: hold to confirm (works with OK on a remote) ---------- */

export function holdToConfirm(btn: HTMLElement, onDone: () => void, ms = 1100) {
  let anim: ReturnType<typeof animate> | null = null;
  let progress = 0;
  const set = (p: number) => { progress = p; btn.style.setProperty("--hold", String(p)); };
  const start = () => {
    if (anim || btn.dataset.done) return;
    btn.classList.add("holding");
    anim = animate(progress, 1, { duration: ((1 - progress) * ms) / 1000, ease: "linear", onUpdate: set });
    anim.then(() => {
      if (progress < 1) return;
      btn.dataset.done = "1";
      btn.classList.add("done");
      onDone();
    });
  };
  const stop = () => {
    if (!anim || btn.dataset.done) return;
    anim.stop();
    anim = null;
    btn.classList.remove("holding");
    animate(progress, 0, { duration: reduced() ? 0 : progress * 0.35, ease: "easeOut", onUpdate: set });
  };
  btn.addEventListener("pointerdown", start);
  ["pointerup", "pointerleave", "pointercancel", "blur"].forEach((e) => btn.addEventListener(e, stop));
  btn.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); start(); } });
  btn.addEventListener("keyup", (e) => { if (e.key === "Enter" || e.key === " ") stop(); });
  btn.addEventListener("click", (e) => e.preventDefault());
}

/* ---------- KokonutUI "Split Flap Text" (MIT) ported: channel number flips like a station board ---------- */

const FLAP_SET = " 0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ-";
const FLIP_MS = 56;

function half(char: string, side: "top" | "bottom") {
  return `<span class="flap-half ${side}"><span>${char === " " ? "&nbsp;" : char}</span></span>`;
}

export function splitFlap(el: HTMLElement, text: string) {
  const value = [...text.toUpperCase()].map((c) => (FLAP_SET.includes(c) ? c : " "));
  el.setAttribute("aria-label", text);
  if (reduced() || el.childElementCount !== value.length) {
    // New width: start blank and flip forward, or land directly when motion is reduced.
    el.innerHTML = value.map((c) => { const v = reduced() ? c : " "; return `<span class="flap" data-c="${v}">${half(v, "top")}${half(v, "bottom")}</span>`; }).join("");
    if (reduced()) return;
  }
  [...el.children].forEach((tileEl, i) => {
    const tile = tileEl as HTMLElement;
    const target = value[i];
    const token = String(Math.random());
    tile.dataset.token = token;
    const step = () => {
      if (tile.dataset.token !== token) return;
      const from = tile.dataset.c ?? " ";
      if (from === target) return;
      const to = FLAP_SET[(FLAP_SET.indexOf(from) + 1) % FLAP_SET.length];
      tile.dataset.c = to;
      tile.innerHTML = `${half(to, "top")}${half(from, "bottom")}${half(from, "top")}${half(to, "bottom")}`;
      const [, , falling, landing] = tile.children as unknown as HTMLElement[];
      falling.classList.add("flip");
      landing.classList.add("flip");
      animate(falling, { rotateX: [0, -90] }, { duration: FLIP_MS / 2000, ease: [0.5, 0, 0.9, 0.6] });
      animate(landing, { rotateX: [90, 0] }, { duration: FLIP_MS / 2000, delay: FLIP_MS / 2000, ease: [0.2, 0.6, 0.3, 1] });
      setTimeout(step, FLIP_MS);
    };
    setTimeout(step, i * 40);
  });
}

/* ---------- anime.js: brand moments ---------- */

/** The W antenna logo draws itself, then both antenna tips pop on. */
export function drawLogo(svgEl: SVGSVGElement | null, delay = 0) {
  if (!svgEl || reduced()) return;
  const path = svgEl.querySelector("path");
  const balls = svgEl.querySelectorAll("circle");
  if (!path) return;
  const [w] = svg.createDrawable(path);
  createTimeline({ delay })
    .add(w, { draw: ["0 0", "0 1"], duration: 900, ease: "inOutQuart" })
    .add(balls, { scale: [0, 1], duration: 800, ease: "outElastic(1, .5)", delay: aStagger(110) }, "-=250");
}

/** Signature: the zap sticker slaps onto the screen on every channel change. */
export function slapSticker(sticker: HTMLElement) {
  if (reduced()) return;
  const plate = sticker.querySelector(".zap-text");
  createTimeline()
    .add(sticker, { translateY: [-34, 0], rotate: [-9, -1.2], scale: [1.18, 1], opacity: [0, 1], duration: 620, ease: "outBack(1.7)" })
    .add(plate!, { translateX: [-14, 0], opacity: [0, 1], duration: 360, ease: "outQuart" }, "-=420");
}

let signal: JSAnimation[] = [];
/** Tuning: antenna tips bob like they are searching for signal. */
export function tuning(container: HTMLElement | null) {
  signal.forEach((a) => a.pause());
  signal = [];
  if (!container || reduced()) return;
  const balls = container.querySelectorAll("circle");
  const [w] = svg.createDrawable(container.querySelector("path")!);
  signal = [
    tween(balls, { translateY: [0, -26], duration: 420, ease: "outQuad", alternate: true, loop: true, delay: aStagger(180) }),
    tween(w, { draw: ["0 1", "0.15 0.85", "0 1"], duration: 1400, ease: "inOutSine", loop: true }),
  ];
}

/* ---------- Bklit UI "Shimmering Text" (MIT, ui.bklit.com) ported ---------- */

export function shimmer(el: HTMLElement | null) {
  if (!el || reduced()) return;
  el.classList.add("shimmer");
  el.animate([{ maskPosition: "100% 0%", webkitMaskPosition: "100% 0%" }, { maskPosition: "0% 0%", webkitMaskPosition: "0% 0%" }], { duration: 1500, iterations: Infinity });
}

/* ---------- Bklit UI bar chart (MIT) ported to plain SVG ---------- */

/** Bklit's cartesian reveal easing and timing. */
const BKLIT_EASE = [0.85, 0, 0.15, 1] as const;

export function barChart(host: HTMLElement, data: { label: string; value: number; title: string }[], highlight: number) {
  const W = 420, H = 150, top = 24, bottom = 26;
  const max = Math.max(1, ...data.map((d) => d.value));
  const slot = W / data.length;
  const bw = Math.min(34, slot * 0.58);
  const y = (v: number) => H - bottom - (v / max) * (H - top - bottom);
  const grid = [0.5, 1].map((f) => `<line class="chart-grid" x1="0" x2="${W}" y1="${y(max * f)}" y2="${y(max * f)}"/>`).join("");
  const bars = data
    .map((d, i) => {
      const x = i * slot + (slot - bw) / 2;
      const yy = y(d.value);
      const h = Math.max(2, H - bottom - yy);
      const r = Math.min(9, bw / 2, h);
      const path = `M${x},${H - bottom} V${H - bottom - h + r} Q${x},${H - bottom - h} ${x + r},${H - bottom - h} H${x + bw - r} Q${x + bw},${H - bottom - h} ${x + bw},${H - bottom - h + r} V${H - bottom} Z`;
      const on = i === highlight ? " on" : "";
      return `<g class="bar${on}"><title>${d.title}</title><path d="${path}"/>${i === highlight && d.value ? `<text class="chart-value" x="${x + bw / 2}" y="${yy - 8}">${d.title.split(": ")[1]}</text>` : ""}<text class="chart-label" x="${x + bw / 2}" y="${H - 6}">${d.label}</text></g>`;
    })
    .join("");
  host.innerHTML = `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Minutos vistos por día">${grid}${bars}</svg>`;
  if (reduced()) return;
  const paths = host.querySelectorAll<SVGPathElement>(".bar path");
  paths.forEach((p) => { p.style.transformBox = "fill-box"; p.style.transformOrigin = "50% 100%"; });
  animate(paths, { scaleY: [0, 1] }, { duration: 1.1, delay: stagger(0.06), ease: BKLIT_EASE });
  animate(host.querySelectorAll(".chart-value"), { opacity: [0, 1], y: [6, 0] }, { duration: 0.4, delay: 0.9 });
}
