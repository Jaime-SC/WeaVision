import "@fontsource-variable/bricolage-grotesque";
import "./styles/app.css";
import { App as CapApp } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { store, type Channel, type Playlist } from "./core/store";
import { createPlayer, WeaPlayer, type PlayerState } from "./player/player";
import { icon } from "./ui/icons";
import { barChart, drawLogo, drawerMotion, drawerStep, enterView, hudMotion, holdToConfirm, moveTabIndicator, osd, revealTiles, shimmer, showToast, slapSticker, splitFlap, tuning } from "./ui/fx";
import { focusFirst, move } from "./ui/spatial";

type View = "home" | "live" | "favorites" | "recent" | "lists";
const VIEWS: { id: View; label: string; icon: string }[] = [
  { id: "home", label: "Inicio", icon: icon.home },
  { id: "live", label: "En vivo", icon: icon.live },
  { id: "favorites", label: "Favoritos", icon: icon.star },
  { id: "recent", label: "Recientes", icon: icon.clock },
  { id: "lists", label: "Listas", icon: icon.list },
];
const PAGE = 120;

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const esc = (s = "") => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const initials = (name: string) =>
  name.replace(/\(.*?\)|\[.*?\]/g, "").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "TV";

const ui = {
  view: "home" as View,
  query: "",
  category: undefined as string | undefined,
  /** Channels behind the visible grid, used for zapping with up/down. */
  context: [] as Channel[],
  rendered: 0,
  current: undefined as Channel | undefined,
  state: "idle" as PlayerState,
  osdTimer: 0,
  /** Category last opened in the in-player channel drawer ("" = all, "*" = favourites). */
  drawerCat: "",
  /** The drawer shows the categories first, then the channels of the one picked. */
  drawerLevel: "cats" as "cats" | "list",
};

/** Which controls make sense: a TV uses its remote for volume, a phone uses swipes. */
type Device = "desktop" | "phone" | "tv";
const device = { kind: "desktop" as Device, pip: !!document.pictureInPictureEnabled };

const main = $("main");
const video = $<HTMLVideoElement>("video");
const player = createPlayer(video, onPlayerState);
document.documentElement.dataset.platform = Capacitor.getPlatform();

/* ---------- helpers ---------- */

function toast(msg: string, error = false) {
  showToast($("toast"), msg, error ? "error" : "info");
}

/** Runs an action; with `loading`, one toast morphs from loading to done or error. */
async function guard<T>(fn: () => Promise<T>, busy?: HTMLButtonElement, loading?: string): Promise<T | undefined> {
  if (busy) busy.disabled = true;
  if (loading) showToast($("toast"), loading, "loading");
  try {
    return await fn();
  } catch (e) {
    toast(e instanceof Error ? e.message : String(e), true);
  } finally {
    if (busy) busy.disabled = false;
  }
}

function logo(ch: Channel, cls = "tile-logo") {
  const fallback = `<span class="${cls} logo-fallback" aria-hidden="true">${esc(initials(ch.name))}</span>`;
  return ch.logo
    ? `<img class="${cls}" src="${esc(ch.logo)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer" data-fallback="${esc(initials(ch.name))}">`
    : fallback;
}

// Broken third-party logos become initials; capture phase because error does not bubble.
document.addEventListener(
  "error",
  (e) => {
    const img = e.target as HTMLImageElement;
    if (img.tagName !== "IMG" || !img.dataset.fallback) return;
    const span = document.createElement("span");
    span.className = `${img.className} logo-fallback`;
    span.textContent = img.dataset.fallback;
    img.replaceWith(span);
  },
  true,
);

/** The channel's own number, identical on tiles, the resume card and the zap sticker. */
const chNumber = (ch: Channel) => ch.num || ch.chno || "";

function tile(ch: Channel, i: number) {
  const playing = ui.current?.url === ch.url ? " is-playing" : "";
  return `<button class="tile${playing}" data-i="${i}" title="${esc(ch.name)}">
    ${logo(ch)}
    ${chNumber(ch) ? `<span class="tile-num" aria-hidden="true">${esc(chNumber(ch))}</span>` : ""}
    <span class="tile-name">${esc(ch.name)}</span>
    <span class="tile-meta">${esc(ch.group ?? "")}</span>
    ${store.isFavorite(ch.url) ? `<span class="tile-fav" aria-label="Favorito">${icon.starFill}</span>` : ""}
  </button>`;
}

/** Renders a channel grid that grows as focus or scroll reaches its end. */
function grid(container: HTMLElement, list: Channel[], empty: string) {
  ui.context = list;
  ui.rendered = 0;
  container.innerHTML = list.length ? "" : `<p class="empty">${empty}</p>`;
  const more = () => {
    const first = ui.rendered === 0;
    const next = list.slice(ui.rendered, ui.rendered + PAGE).map((c, k) => tile(c, ui.rendered + k)).join("");
    ui.rendered += PAGE;
    container.insertAdjacentHTML("beforeend", next);
    if (first) revealTiles([...container.children]);
    if (ui.rendered < list.length) observer.observe(container.lastElementChild!);
  };
  const observer = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) {
      observer.disconnect();
      more();
    }
  }, { rootMargin: "600px" });
  if (list.length) more();
  container.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>(".tile");
    if (b) void play(list[Number(b.dataset.i)], list);
  };
}

/* ---------- navigation ---------- */

function renderNav() {
  const nav = $("nav");
  if (!nav.querySelector(".rail-item")) {
    nav.innerHTML = VIEWS.map((v) => `<button class="rail-item" data-view="${v.id}">${v.icon}<span>${v.label}</span></button>`).join("");
  }
  let active: HTMLElement | null = null;
  nav.querySelectorAll<HTMLElement>(".rail-item").forEach((b) => {
    const on = b.dataset.view === ui.view;
    b.classList.toggle("active", on);
    b.setAttribute("aria-current", on ? "page" : "false");
    if (on) active = b;
  });
  moveTabIndicator(nav, active);
}
// The rail turns into a bottom bar on phones: snap the pill to its new place.
addEventListener("resize", () => moveTabIndicator($("nav"), $("nav").querySelector(".rail-item.active"), true));
$("nav").addEventListener("click", (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>("[data-view]");
  if (b) go(b.dataset.view as View);
});

function go(view: View, focus = true) {
  ui.view = view;
  renderNav();
  render();
  main.scrollTop = 0;
  enterView(main);
  if (focus) focusFirst(main);
}

function render() {
  ({ home: renderHome, live: renderLive, favorites: renderFavorites, recent: renderRecent, lists: renderLists })[ui.view]();
}

/* ---------- views ---------- */

function renderHome() {
  if (!store.playlists.length) return renderWelcome();
  const last = store.history[0]?.channel;
  main.innerHTML = `
    <header class="page-head"><h1>¿Qué vemos hoy?</h1></header>
    ${last ? `<button class="resume" id="resume" data-autofocus aria-label="Seguir viendo ${esc(last.name)}">
        <span class="resume-art">${logo(last, "resume-logo")}${chNumber(last) ? `<span class="tile-num" aria-hidden="true">${esc(chNumber(last))}</span>` : ""}</span>
        <span class="resume-text"><strong>${esc(last.name)}</strong><span>${esc(last.group ?? "")}</span></span>
        <span class="resume-play">${icon.play}</span>
      </button>` : ""}
    ${weekShelf()}
    <section class="shelf"><h2>Favoritos</h2><div class="row" id="fav-row"></div></section>
    <section class="shelf"><h2>Recientes</h2><div class="row" id="recent-row"></div></section>
    <section class="shelf"><h2>Tus listas</h2><div class="lists-row" id="lists-row">${store.playlists
      .map((p) => `<button class="chip-list${p.id === store.active?.id ? " active" : ""}" data-id="${p.id}"><strong>${esc(p.name)}</strong><span>${p.count.toLocaleString("es-CL")} canales</span></button>`)
      .join("")}</div></section>`;
  const chart = document.getElementById("week-chart");
  if (chart) {
    const week = store.week();
    barChart(chart, week.map((d) => ({
      label: d.date.toLocaleDateString("es-CL", { weekday: "narrow" }).toUpperCase(),
      value: d.minutes,
      title: `${d.date.toLocaleDateString("es-CL", { weekday: "long", day: "numeric" })}: ${duration(d.minutes)}`,
    })), week.length - 1);
  }
  if (last) $("resume").onclick = () => void play(last, store.history.map((h) => h.channel));
  grid($("fav-row"), store.favorites.slice(0, 24), "Marca canales con la estrella y aparecen aquí.");
  grid($("recent-row"), store.history.slice(0, 24).map((h) => h.channel), "Lo que veas quedará aquí.");
  $("lists-row").onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-id]");
    if (b) void store.selectPlaylist(b.dataset.id).then(() => go("live"));
  };
}

function duration(min: number) {
  return min >= 60 ? `${Math.floor(min / 60)} h ${min % 60} min` : `${min} min`;
}

/** Bklit-style chart of the week, only once something has been watched. */
function weekShelf() {
  const total = store.week().reduce((a, d) => a + d.minutes, 0);
  if (!total) return "";
  return `<section class="shelf week"><h2>Tu semana: ${duration(total)} de tele</h2><div id="week-chart" class="week-chart"></div></section>`;
}

function brandMark(cls: string) {
  const svg = document.querySelector(".rail-logo")!.cloneNode(true) as SVGSVGElement;
  svg.setAttribute("class", cls);
  return svg.outerHTML;
}

function renderWelcome() {
  main.innerHTML = `
    <section class="welcome">
      ${brandMark("welcome-logo")}
      <h1>Carga tu lista y a ver tele</h1>
      <p>WeaVision reproduce listas IPTV en formato M3U. Pega el enlace que te dio tu proveedor o elige un archivo.</p>
      ${addForm()}
    </section>`;
  bindAddForm();
  drawLogo(main.querySelector<SVGSVGElement>(".welcome-logo"), 150);
}

function addForm() {
  return `<form class="add" id="add-form" autocomplete="off">
    <label class="field"><span>Nombre</span><input id="add-name" placeholder="Mi lista" maxlength="60"></label>
    <label class="field grow"><span>Enlace M3U</span><input id="add-url" type="url" inputmode="url" placeholder="https://…/lista.m3u"></label>
    <div class="add-actions">
      <button class="btn primary" type="submit" id="add-submit">${icon.link}<span>Cargar enlace</span></button>
      <button class="btn" type="button" id="add-file-btn">${icon.file}<span>Elegir archivo</span></button>
      <button class="btn ghost" type="button" id="add-sample">Probar con lista de ejemplo</button>
      <input type="file" id="add-file" accept=".m3u,.m3u8,audio/x-mpegurl,application/x-mpegurl,text/plain" hidden>
    </div>
  </form>`;
}

function bindAddForm() {
  const name = () => $<HTMLInputElement>("add-name").value.trim();
  $("add-form").onsubmit = (e) => {
    e.preventDefault();
    const url = $<HTMLInputElement>("add-url").value.trim();
    if (!/^https?:\/\//i.test(url)) return toast("Pega un enlace que empiece con http:// o https://", true);
    void guard(async () => {
      const pl = await store.importUrl(name() || hostName(url), url);
      loaded(pl);
    }, $<HTMLButtonElement>("add-submit"), "Descargando la lista…");
  };
  $("add-file-btn").onclick = () => $("add-file").click();
  $<HTMLInputElement>("add-file").onchange = (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (f) void guard(async () => loaded(await store.importText(name() || f.name.replace(/\.m3u8?$/i, ""), f.name, false, await f.text())), undefined, "Leyendo el archivo…");
  };
  $("add-sample").onclick = () =>
    void guard(async () => loaded(await store.importText("Ejemplo", "sample.m3u", false, await (await fetch("./sample.m3u")).text())), undefined, "Cargando la lista de ejemplo…");
}

function hostName(url: string) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Mi lista"; }
}

function loaded(pl: Playlist) {
  showToast($("toast"), `Listo: «${pl.name}» con ${pl.count.toLocaleString("es-CL")} canales`, "success");
  go("live");
}

function renderLive() {
  const pl = store.active;
  if (!pl) return go("lists");
  const cats = store.categories();
  main.innerHTML = `
    <header class="page-head live-head">
      <h1>${esc(pl.name)}</h1>
      <label class="search">${icon.search}<input id="search" type="search" placeholder="Buscar canal" value="${esc(ui.query)}" aria-label="Buscar canal"></label>
    </header>
    <div class="live">
      <aside class="cats" aria-label="Categorías">
        <button class="cat${ui.category ? "" : " active"}" data-cat="">Todos <span>${pl.count.toLocaleString("es-CL")}</span></button>
        ${cats.map((c) => `<button class="cat${c.name === ui.category ? " active" : ""}" data-cat="${esc(c.name)}">${esc(c.name)} <span>${c.count.toLocaleString("es-CL")}</span></button>`).join("")}
      </aside>
      <div class="grid-wrap"><p class="count" id="count"></p><div class="grid" id="grid"></div></div>
    </div>`;
  const update = () => {
    const list = store.filter(ui.query, ui.category);
    $("count").textContent = `${list.length.toLocaleString("es-CL")} canales${ui.category ? ` en ${ui.category}` : ""}`;
    grid($("grid"), list, ui.query ? `Nada con «${esc(ui.query)}». Prueba otra palabra o cambia de categoría.` : "Esta categoría está vacía.");
  };
  update();
  let t = 0;
  $<HTMLInputElement>("search").oninput = (e) => {
    clearTimeout(t);
    t = window.setTimeout(() => { ui.query = (e.target as HTMLInputElement).value; update(); }, 180);
  };
  main.querySelector<HTMLElement>(".cats")!.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>("[data-cat]");
    if (!b) return;
    ui.category = b.dataset.cat || undefined;
    main.querySelectorAll(".cat").forEach((c) => c.classList.toggle("active", c === b));
    update();
  };
}

function renderFavorites() {
  main.innerHTML = `<header class="page-head"><h1>Favoritos</h1></header><div class="grid" id="grid"></div>`;
  grid($("grid"), store.favorites, "Aún no tienes favoritos. Mientras ves un canal, presiona la estrella.");
}

function renderRecent() {
  main.innerHTML = `<header class="page-head"><h1>Recientes</h1></header><div class="grid" id="grid"></div>`;
  grid($("grid"), store.history.map((h) => h.channel), "Todavía no has visto nada. Los canales que abras aparecerán aquí.");
}

function renderLists() {
  main.innerHTML = `
    <header class="page-head"><h1>Tus listas</h1></header>
    <div class="playlists">${store.playlists
      .map((p) => `<article class="pl${p.id === store.active?.id ? " active" : ""}" data-id="${p.id}">
        <button class="pl-main" data-act="open"><strong>${esc(p.name)}</strong><span>${p.count.toLocaleString("es-CL")} canales · ${p.remote ? "enlace" : "archivo"} · ${new Date(p.updatedAt).toLocaleDateString("es-CL")}</span></button>
        ${p.remote ? `<button class="btn icon" data-act="refresh" aria-label="Actualizar ${esc(p.name)}" title="Actualizar">${icon.refresh}</button>` : ""}
        <button class="btn hold danger" data-act="delete" aria-label="Mantén presionado para eliminar ${esc(p.name)}" title="Mantén presionado para eliminar"><span class="hold-fill" aria-hidden="true"></span>${icon.trash}<span>Mantener</span></button>
      </article>`)
      .join("") || `<p class="empty">No tienes listas todavía.</p>`}</div>
    <section class="shelf"><h2>Agregar lista</h2>${addForm()}</section>`;
  bindAddForm();
  main.querySelector<HTMLElement>(".playlists")!.onclick = (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("[data-act]");
    const id = b?.closest<HTMLElement>("[data-id]")?.dataset.id;
    const pl = store.playlists.find((p) => p.id === id);
    if (!b || !pl) return;
    if (b.dataset.act === "open") void store.selectPlaylist(pl.id).then(() => go("live"));
    if (b.dataset.act === "refresh") void guard(async () => { await store.refresh(pl); showToast($("toast"), "Lista actualizada", "success"); renderLists(); }, b, "Actualizando la lista…");
  };
  // Deleting needs a deliberate hold (mouse, touch or the remote's OK), no second dialog.
  main.querySelectorAll<HTMLElement>("[data-act=delete]").forEach((b) => {
    const pl = store.playlists.find((p) => p.id === b.closest<HTMLElement>("[data-id]")?.dataset.id)!;
    holdToConfirm(b, () => void store.remove(pl.id).then(() => { showToast($("toast"), `Eliminamos «${pl.name}»`, "success"); renderLists(); focusFirst(main); }));
  });
}

/* ---------- player ---------- */

function renderBar() {
  const ch = ui.current;
  const fav = !!ch && store.isFavorite(ch.url);
  const paused = ui.state === "paused";
  const { volume, muted } = store.settings;
  // Favourite lives in the top corner, apart from the transport controls.
  const f = $("osd-fav");
  f.classList.toggle("on", fav);
  f.setAttribute("aria-pressed", String(fav));
  f.setAttribute("aria-label", fav ? "Quitar de favoritos" : "Agregar a favoritos");
  f.innerHTML = `${fav ? icon.starFill : icon.star}<span>${fav ? "En favoritos" : "Favorito"}</span>`;
  // Volume only on Windows: the TV has its remote, the phone a swipe on the right half.
  const volumeControls = device.kind === "desktop" ? `
    <span class="bar-gap"></span>
    <button class="pbtn" data-act="mute" aria-label="${muted ? "Activar sonido" : "Silenciar"}">${muted ? icon.mute : icon.volume}</button>
    <input class="vol" type="range" min="0" max="100" value="${volume}" aria-label="Volumen" data-act="vol">
    <button class="pbtn desktop-only" data-act="full" aria-label="Pantalla completa">${icon.full}</button>` : "";
  $("osd-bar").innerHTML = `
    <button class="pbtn" data-act="channels" aria-label="Lista de canales" aria-expanded="${!$("drawer").hidden}">${icon.list}</button>
    <button class="pbtn" data-act="prev" aria-label="Canal anterior">${icon.up}</button>
    <button class="pbtn big" data-act="toggle" aria-label="${paused ? "Reproducir" : "Pausa"}" data-autofocus>${paused ? icon.play : icon.pause}</button>
    <button class="pbtn" data-act="next" aria-label="Canal siguiente">${icon.down}</button>
    ${device.pip ? `<button class="pbtn" data-act="pip" aria-label="Imagen en imagen">${icon.pip}</button>` : ""}
    ${volumeControls}
    <span class="bar-gap"></span>
    <button class="pbtn" data-act="close" aria-label="Cerrar reproductor">${icon.close}</button>`;
}
$("osd").addEventListener("click", (e) => {
  const act = (e.target as HTMLElement).closest<HTMLElement>("[data-act]")?.dataset.act;
  if (act) action(act);
});
$("osd-bar").addEventListener("input", (e) => {
  const el = e.target as HTMLInputElement;
  if (el.dataset.act === "vol") void setVolume(Number(el.value), false);
});

function action(act: string) {
  showOsd();
  if (act === "prev") zap(-1);
  if (act === "next") zap(1);
  if (act === "toggle") ui.state === "paused" ? player.resume() : player.pause();
  if (act === "close") closePlayer();
  if (act === "pip") void pictureInPicture();
  if (act === "mute") void setVolume(store.settings.volume, !store.settings.muted);
  if (act === "full") document.fullscreenElement ? void document.exitFullscreen() : void $("player").requestFullscreen?.();
  if (act === "retry" && ui.current) void play(ui.current, ui.context);
  if (act === "channels") $("drawer").hidden ? openDrawer() : closeDrawer();
  if (act === "fav" && ui.current) {
    const ch = ui.current;
    void store.toggleFavorite(ch).then((on) => { toast(on ? "Agregado a favoritos" : "Quitado de favoritos"); renderBar(); keepFocus("fav"); });
  }
}

async function pictureInPicture() {
  if (player.native) {
    // Only the picture goes into the floating window: hide every overlay first.
    void closeDrawer(true);
    hideOsd();
    document.documentElement.classList.add("pip");
    await WeaPlayer.enterPip().catch((e: Error) => {
      document.documentElement.classList.remove("pip");
      toast(e.message || "No se pudo abrir imagen en imagen", true);
    });
    return;
  }
  try {
    if (document.pictureInPictureElement) await document.exitPictureInPicture();
    else await video.requestPictureInPicture();
  } catch {
    toast("Imagen en imagen necesita que el canal esté reproduciéndose", true);
  }
}

function keepFocus(act: string) {
  $("osd").querySelector<HTMLElement>(`[data-act="${act}"]`)?.focus();
}

async function setVolume(volume: number, muted: boolean) {
  player.setVolume(volume, muted);
  const wasMute = store.settings.muted !== muted;
  await store.setSettings({ volume, muted });
  if (wasMute) { renderBar(); keepFocus("mute"); }
}

async function play(ch: Channel, context: Channel[]) {
  ui.current = ch;
  ui.context = context.length ? context : [ch];
  const p = $("player");
  if (p.hidden && player.native) void WeaPlayer.setFullscreen({ on: true });
  p.hidden = false;
  document.documentElement.classList.toggle("native-video", player.native);
  splitFlap($("zap-num"), chNumber(ch) || "TV");
  $("zap-name").textContent = ch.name;
  $("zap-cat").textContent = ch.group ?? "";
  slapSticker($("zap"));
  renderBar();
  const drawerOpen = !$("drawer").hidden;
  showOsd(!drawerOpen); // while browsing the drawer, keep focus in the list
  if (drawerOpen) markPlaying();
  // Android: the system volume (remote, side keys, swipe) is the only volume; the player stays at full.
  if (device.kind === "desktop") player.setVolume(store.settings.volume, store.settings.muted);
  else player.setVolume(100, false);
  void store.recordPlay(ch);
  await player.play(ch);
}

function zap(step: number) {
  if (!ui.current || ui.context.length < 2) return;
  const i = ui.context.findIndex((c) => c.url === ui.current!.url);
  const next = ui.context[(i + step + ui.context.length) % ui.context.length];
  void play(next, ui.context);
}

function closePlayer() {
  player.stop();
  tuning(null);
  $("drawer").hidden = true;
  $("drawer").removeAttribute("data-layer");
  if (player.native) void WeaPlayer.setFullscreen({ on: false });
  // Brightness set with a swipe belongs to the player; the rest of the app follows the system.
  if (device.kind === "phone") void WeaPlayer.setLevel({ kind: "brightness", value: -1 }).catch(() => {});
  $("player").hidden = true;
  document.documentElement.classList.remove("native-video");
  const url = ui.current?.url;
  ui.current = undefined;
  render();
  const back = [...main.querySelectorAll<HTMLElement>(".tile")].find((t) => ui.context[Number(t.dataset.i)]?.url === url);
  back ? back.focus() : focusFirst(main);
}

function onPlayerState(state: PlayerState, message?: string) {
  ui.state = state;
  $("player").dataset.state = state;
  const s = $("player-status");
  s.className = `player-status ${state}`;
  s.innerHTML =
    state === "loading" ? `${brandMark("tuning-logo")}<span class="tuning-text">Sintonizando…</span>` :
    state === "error" ? `${icon.alert}<span>${esc(message)}</span><button class="btn primary" data-act="retry">Reintentar</button>` : "";
  tuning(state === "loading" ? s.querySelector<HTMLElement>(".tuning-logo") : null);
  if (state === "loading") shimmer(s.querySelector(".tuning-text"));
  if (state === "error") {
    s.querySelector<HTMLElement>("[data-act=retry]")!.onclick = () => action("retry");
    showOsd(true);
  }
  if (!$("player").hidden && (state === "paused" || state === "playing")) {
    const focused = (document.activeElement as HTMLElement | null)?.dataset.act;
    renderBar();
    if (focused) keepFocus(focused);
  }
}

function showOsd(focus = false) {
  const p = $("player");
  if (!p.classList.contains("osd-on")) osd(p, true);
  p.classList.add("osd-on");
  if (focus) focusFirst($("osd-bar"));
  clearTimeout(ui.osdTimer);
  ui.osdTimer = window.setTimeout(() => {
    if (ui.state === "playing") hideOsd();
  }, 4500);
}

function hideOsd() {
  const p = $("player");
  if (p.classList.contains("osd-on")) osd(p, false);
  p.classList.remove("osd-on");
}

/* ---------- quick channel drawer (inside the player) ---------- */

const listButton = () => $("osd-bar").querySelector<HTMLElement>("[data-act=channels]");
/** The category of the channel on screen, marked in the drawer ("" when it isn't in the active list). */
const playingCat = () => {
  const ch = ui.current;
  return ch && store.channels.some((c) => c.url === ch.url) ? (ch.group ?? "Sin categoría") : "";
};

function openDrawer() {
  const d = $("drawer");
  if (!d.hidden) return;
  ui.drawerCat = playingCat();
  d.hidden = false;
  d.setAttribute("data-layer", "");
  listButton()?.setAttribute("aria-expanded", "true");
  showCats(false);
  void drawerMotion(d, true);
  hideOsd();
}

async function closeDrawer(instant = false) {
  const d = $("drawer");
  if (d.hidden) return;
  d.removeAttribute("data-layer");
  if (!instant) await drawerMotion(d, false);
  d.hidden = true;
  d.style.transform = d.style.opacity = "";
  listButton()?.setAttribute("aria-expanded", "false");
  if (instant) return;
  showOsd(true);
  keepFocus("channels");
}

function drawerList() {
  if (ui.drawerCat === "*") return store.favorites;
  return store.filter("", ui.drawerCat || undefined);
}

/** Level 1: the categories, with the one on screen marked and the last one opened focused. */
function showCats(animated: boolean) {
  ui.drawerLevel = "cats";
  const cats = $("drawer-cats");
  $("drawer-list").hidden = true;
  $("drawer-list").innerHTML = "";
  cats.hidden = false;
  const live = playingCat();
  cats.innerHTML = [
    { id: "", name: "Todos", count: store.channels.length },
    { id: "*", name: "Favoritos", count: store.favorites.length },
    ...store.categories().map((c) => ({ id: c.name, ...c })),
  ].map((c) => `<button class="dcat${c.id === live && ui.current ? " live" : ""}" data-cat="${esc(c.id)}">
      <span class="dcat-name">${esc(c.name)}</span><span class="dcat-count">${c.count.toLocaleString("es-CL")}</span>${icon.next}
    </button>`).join("");
  $("drawer-back").hidden = true;
  $("drawer-kicker").textContent = "Categorías";
  $("drawer-title").textContent = store.active?.name ?? "Canales";
  if (animated) drawerStep(cats, $("drawer-head"), false, true);
  const target = [...cats.querySelectorAll<HTMLElement>(".dcat")].find((b) => b.dataset.cat === ui.drawerCat) ?? cats.querySelector<HTMLElement>(".dcat");
  target?.focus({ preventScroll: true });
  target?.scrollIntoView({ block: "center" });
}

/** Level 2: the channels of one category; Back (or Left on the remote) returns to the categories. */
function showList(cat: string) {
  ui.drawerLevel = "list";
  ui.drawerCat = cat;
  const list = $("drawer-list");
  $("drawer-cats").hidden = true;
  list.hidden = false;
  list.scrollTop = 0;
  $("drawer-back").hidden = false;
  $("drawer-kicker").textContent = store.active?.name ?? "Canales";
  $("drawer-title").textContent = cat === "*" ? "Favoritos" : cat || "Todos";
  // Browsing a category must not change what Up/Down zaps through until a channel is picked.
  const zapping = ui.context;
  grid(list, drawerList(), cat === "*" ? "Aún no tienes favoritos." : "No hay canales aquí.");
  ui.context = zapping;
  drawerStep(list, $("drawer-head"), true);
  const playing = list.querySelector<HTMLElement>(".tile.is-playing");
  (playing ?? list.querySelector<HTMLElement>(".tile") ?? $("drawer-back")).focus({ preventScroll: true });
  playing?.scrollIntoView({ block: "center" });
}

function markPlaying() {
  $("drawer-list").querySelectorAll<HTMLElement>(".tile").forEach((t) => t.classList.toggle("is-playing", ui.context[Number(t.dataset.i)]?.url === ui.current?.url));
}

$("drawer").querySelector<HTMLElement>("[data-act=drawer-close]")!.innerHTML = icon.close;
$("drawer-back").innerHTML = icon.back;
$("drawer").addEventListener("click", (e) => {
  const el = e.target as HTMLElement;
  if (el.closest("[data-act=drawer-close]")) return void closeDrawer();
  if (el.closest("[data-act=drawer-back]")) return showCats(true);
  const cat = el.closest<HTMLElement>("[data-cat]");
  if (cat) showList(cat.dataset.cat ?? "");
});

/* ---------- phone gestures: swipe up/down, right half volume, left half brightness ---------- */

type Levels = { volume: number; volumeSteps: number; brightness: number };
const swipe = {
  id: -1, x: 0, y: 0, kind: "" as "" | "volume" | "brightness",
  base: 0, baseY: 0, value: 0, levels: undefined as Levels | undefined,
  sent: true, used: false, hudTimer: 0,
};

$("player").addEventListener("pointerdown", (e) => {
  swipe.used = false;
  if (device.kind !== "phone" || !$("drawer").hidden || (e.target as HTMLElement).closest("button, input")) return;
  Object.assign(swipe, { id: e.pointerId, x: e.clientX, y: e.clientY, kind: "", levels: undefined, used: false });
  void WeaPlayer.levels().then((l) => { if (swipe.id === e.pointerId) swipe.levels = l; }).catch(() => {});
});

$("player").addEventListener("pointermove", (e) => {
  if (e.pointerId !== swipe.id) {
    if (e.pointerType === "mouse") showOsd();
    return;
  }
  if (!swipe.kind) {
    const dx = e.clientX - swipe.x, dy = e.clientY - swipe.y;
    if (!swipe.levels || Math.abs(dy) < 14 || Math.abs(dy) < Math.abs(dx) * 1.4) return;
    swipe.kind = swipe.x > innerWidth / 2 ? "volume" : "brightness";
    swipe.base = swipe.kind === "volume" ? swipe.levels.volume : swipe.levels.brightness;
    swipe.baseY = e.clientY;
    swipe.used = true;
    hideOsd();
  }
  // A full swipe over ~60% of the screen height goes from 0 to 100%.
  let v = Math.min(1, Math.max(0, swipe.base - (e.clientY - swipe.baseY) / (innerHeight * 0.6)));
  if (swipe.kind === "volume") v = Math.round(v * swipe.levels!.volumeSteps) / swipe.levels!.volumeSteps;
  if (v === swipe.value && !swipe.sent) return;
  swipe.value = v;
  showHud(swipe.kind, v);
  if (swipe.sent) {
    swipe.sent = false;
    requestAnimationFrame(() => {
      swipe.sent = true;
      void WeaPlayer.setLevel({ kind: swipe.kind || "volume", value: swipe.value }).catch(() => {});
    });
  }
});

const endSwipe = (e: PointerEvent) => {
  if (e.pointerId !== swipe.id) return;
  swipe.id = -1;
  if (swipe.used) hideHud();
};
$("player").addEventListener("pointerup", endSwipe);
$("player").addEventListener("pointercancel", endSwipe);

function showHud(kind: "volume" | "brightness", v: number) {
  const hud = $("hud");
  clearTimeout(swipe.hudTimer);
  hud.dataset.side = kind === "volume" ? "right" : "left";
  hud.querySelector(".hud-icon")!.innerHTML = kind === "brightness" ? icon.sun : v === 0 ? icon.mute : icon.volume;
  hud.querySelector<HTMLElement>(".hud-fill")!.style.transform = `scaleY(${v})`;
  hud.querySelector(".hud-val")!.textContent = String(Math.round(v * 100));
  if (hud.hidden) {
    hud.hidden = false;
    void hudMotion(hud, true);
  }
}

function hideHud() {
  clearTimeout(swipe.hudTimer);
  swipe.hudTimer = window.setTimeout(async () => {
    await hudMotion($("hud"), false);
    if (swipe.id === -1) $("hud").hidden = true;
  }, 650);
}

/* ---------- input: remote, keyboard, back button ---------- */

function back(): boolean {
  if (!$("drawer").hidden) {
    if (ui.drawerLevel === "list") showCats(true);
    else void closeDrawer();
    return true;
  }
  if (!$("player").hidden) {
    if ($("player").classList.contains("osd-on") && ui.state === "playing") {
      hideOsd();
      (document.activeElement as HTMLElement | null)?.blur();
    } else closePlayer();
    return true;
  }
  if (ui.view !== "home") { go("home"); return true; }
  return false;
}

document.addEventListener("keydown", (e) => {
  const playerOpen = !$("player").hidden;
  const osdOn = $("player").classList.contains("osd-on");
  const typing = (e.target as HTMLElement).matches?.("input:not([type=range]), textarea");

  if (e.key === "Escape" || e.key === "GoBack" || e.key === "BrowserBack" || (e.key === "Backspace" && !typing)) {
    if (back()) e.preventDefault();
    return;
  }
  if (typing && (e.key === "ArrowLeft" || e.key === "ArrowRight")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "f") {
    e.preventDefault();
    if (playerOpen) closePlayer();
    if (ui.view !== "live") go("live", false);
    $("search")?.focus();
    return;
  }

  if (playerOpen && !$("drawer").hidden) {
    const onCat = (e.target as HTMLElement).matches?.(".dcat");
    // Remote: Right opens the focused category, Left from the channels goes back to the categories.
    if (e.key === "ArrowRight" && onCat) { e.preventDefault(); return (e.target as HTMLElement).click(); }
    if (e.key === "ArrowLeft" && ui.drawerLevel === "list" && (e.target as HTMLElement).closest(".tile")) { e.preventDefault(); return showCats(true); }
  }

  if (playerOpen && $("drawer").hidden) {
    const k = e.key;
    // Quick list: Left on the remote while watching, or L on a keyboard.
    if ((!osdOn && k === "ArrowLeft") || (k.toLowerCase() === "l" && !typing)) { e.preventDefault(); return openDrawer(); }
    if (k === "ChannelUp" || k === "PageUp" || (!osdOn && k === "ArrowUp")) { e.preventDefault(); return zap(-1); }
    if (k === "ChannelDown" || k === "PageDown" || (!osdOn && k === "ArrowDown")) { e.preventDefault(); return zap(1); }
    if (k === "MediaPlayPause" || (k === " " && !(e.target as HTMLElement).closest("button"))) { e.preventDefault(); return action("toggle"); }
    if (k.toLowerCase() === "m" && !typing && device.kind === "desktop") return action("mute");
    if (k.toLowerCase() === "f" && !typing) return action("full");
    if (!osdOn && (k === "Enter" || k.startsWith("Arrow"))) { e.preventDefault(); return showOsd(true); }
    showOsd();
  }

  if (e.key.startsWith("Arrow") && (e.target as HTMLInputElement).type !== "range") {
    if (move(e.key as "ArrowUp")) e.preventDefault();
  }
});

$("player").addEventListener("click", (e) => {
  // The tap that ends a volume/brightness swipe is not a tap on the picture.
  if (swipe.used) { swipe.used = false; return; }
  // Tapping the picture beside the open drawer closes it.
  const onPicture = e.target === video || e.target === $("player") || e.target === $("osd");
  if (!$("drawer").hidden) { if (onPicture) void closeDrawer(); return; }
  if (onPicture) {
    $("player").classList.contains("osd-on") && ui.state === "playing" ? hideOsd() : showOsd();
  }
});
video.addEventListener("dblclick", () => action("full"));

video.addEventListener("enterpictureinpicture", () => hideOsd());
video.addEventListener("leavepictureinpicture", () => showOsd());

if (Capacitor.isNativePlatform()) {
  void WeaPlayer.addListener("pip", ({ on }) => {
    document.documentElement.classList.toggle("pip", on);
    if (!on && !$("player").hidden) showOsd(true);
  });
  void CapApp.addListener("backButton", () => { if (!back()) void CapApp.minimizeApp(); });
  // Android Auto reads favourites and recents from the native side.
  const sync = () => void WeaPlayer.syncLibrary({ favorites: store.favorites, recent: store.history.map((h) => h.channel) }).catch(() => {});
  store.on(sync);
}

// Feeds "Tu semana": count time only while a picture is actually playing.
const WATCH_TICK = 15;
setInterval(() => { if (ui.state === "playing" && !$("player").hidden) void store.addWatch(WATCH_TICK); }, WATCH_TICK * 1000);

/* ---------- boot ---------- */

if (player.native) {
  const info = await WeaPlayer.info().catch(() => ({ tv: false, pip: false }));
  device.kind = info.tv ? "tv" : "phone";
  device.pip = info.pip;
}
document.documentElement.dataset.device = device.kind;

await store.load();
go("home");
drawLogo(document.querySelector<SVGSVGElement>(".rail-logo"), 100);
