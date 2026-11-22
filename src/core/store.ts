import { kv } from "./db";
import { parseM3U, type Channel } from "./m3u";

export type { Channel };

export interface Playlist {
  id: string;
  name: string;
  /** URL for remote lists; file name for local ones (cannot be refreshed). */
  source: string;
  remote: boolean;
  count: number;
  updatedAt: number;
}

export interface HistoryEntry { channel: Channel; at: number }

export interface Settings { volume: number; muted: boolean; activePlaylist?: string; lastUrl?: string }

interface Persisted { playlists: Playlist[]; favorites: Channel[]; history: HistoryEntry[]; settings: Settings; watched?: Record<string, number> }

const HISTORY_MAX = 40;
type Listener = () => void;

class Store {
  playlists: Playlist[] = [];
  favorites: Channel[] = [];
  history: HistoryEntry[] = [];
  settings: Settings = { volume: 80, muted: false };
  /** Seconds watched per local day (YYYY-MM-DD), last 14 days. */
  watched: Record<string, number> = {};
  /** Channels of the active playlist, loaded in memory for instant search. */
  channels: Channel[] = [];
  private listeners = new Set<Listener>();

  async load(): Promise<void> {
    const s = await kv.get<Persisted>("state");
    if (s) Object.assign(this, s);
    await this.selectPlaylist(this.settings.activePlaylist ?? this.playlists[0]?.id);
  }

  on(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private async save(notify = true): Promise<void> {
    const { playlists, favorites, history, settings, watched } = this;
    await kv.set("state", { playlists, favorites, history, settings, watched } satisfies Persisted);
    if (notify) this.listeners.forEach((fn) => fn());
  }

  async addWatch(seconds: number, now = new Date()): Promise<void> {
    const key = dayKey(now);
    this.watched[key] = (this.watched[key] ?? 0) + seconds;
    const keep = new Set(lastDays(14, now).map(dayKey));
    for (const k of Object.keys(this.watched)) if (!keep.has(k)) delete this.watched[k];
    await this.save(false);
  }

  /** Minutes watched on each of the last 7 days, oldest first. */
  week(now = new Date()): { date: Date; minutes: number }[] {
    return lastDays(7, now).reverse().map((date) => ({ date, minutes: Math.round((this.watched[dayKey(date)] ?? 0) / 60) }));
  }

  get active(): Playlist | undefined {
    return this.playlists.find((p) => p.id === this.settings.activePlaylist);
  }

  async selectPlaylist(id: string | undefined): Promise<void> {
    this.settings.activePlaylist = id;
    this.channels = id ? ((await kv.get<Channel[]>(`ch:${id}`)) ?? []) : [];
    await this.save();
  }

  /** Imports a playlist from M3U text. Throws when the list has no playable channel. */
  async importText(name: string, source: string, remote: boolean, text: string, id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8)): Promise<Playlist> {
    const { channels } = parseM3U(text);
    if (!channels.length) throw new Error("La lista no tiene canales válidos. ¿Es un archivo M3U?");
    await kv.set(`ch:${id}`, channels);
    const pl: Playlist = { id, name, source, remote, count: channels.length, updatedAt: Date.now() };
    const i = this.playlists.findIndex((p) => p.id === id);
    if (i >= 0) this.playlists[i] = pl;
    else this.playlists.push(pl);
    await this.selectPlaylist(id);
    return pl;
  }

  async importUrl(name: string, url: string, id?: string): Promise<Playlist> {
    let res: Response;
    try {
      res = await fetch(url, { cache: "no-store" });
    } catch {
      throw new Error("No pudimos conectar con esa URL. Revisa la dirección o tu internet.");
    }
    if (!res.ok) throw new Error(`El servidor respondió ${res.status}. Revisa usuario, clave o URL.`);
    return this.importText(name, url, true, await res.text(), id);
  }

  async refresh(pl: Playlist): Promise<Playlist> {
    if (!pl.remote) throw new Error("Las listas desde archivo no se pueden actualizar; vuelve a importarla.");
    return this.importUrl(pl.name, pl.source, pl.id);
  }

  async remove(id: string): Promise<void> {
    this.playlists = this.playlists.filter((p) => p.id !== id);
    await kv.del(`ch:${id}`);
    await this.selectPlaylist(this.playlists[0]?.id);
  }

  categories(): { name: string; count: number }[] {
    const counts = new Map<string, number>();
    for (const c of this.channels) counts.set(c.group ?? "Sin categoría", (counts.get(c.group ?? "Sin categoría") ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }

  filter(query: string, category?: string): Channel[] {
    const q = normalize(query);
    return this.channels.filter(
      (c) => (!category || (c.group ?? "Sin categoría") === category) && (!q || normalize(c.name).includes(q)),
    );
  }

  isFavorite(url: string): boolean {
    return this.favorites.some((f) => f.url === url);
  }

  async toggleFavorite(ch: Channel): Promise<boolean> {
    const fav = this.isFavorite(ch.url);
    this.favorites = fav ? this.favorites.filter((f) => f.url !== ch.url) : [ch, ...this.favorites];
    await this.save();
    return !fav;
  }

  async recordPlay(ch: Channel): Promise<void> {
    this.history = [{ channel: ch, at: Date.now() }, ...this.history.filter((h) => h.channel.url !== ch.url)].slice(0, HISTORY_MAX);
    this.settings.lastUrl = ch.url;
    await this.save();
  }

  async setSettings(patch: Partial<Settings>): Promise<void> {
    Object.assign(this.settings, patch);
    await this.save();
  }
}

export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function lastDays(n: number, now: Date): Date[] {
  return Array.from({ length: n }, (_, i) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - i));
}

export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
}

export const store = new Store();
