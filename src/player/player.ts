import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type Hls from "hls.js";
import type Mpegts from "mpegts.js";
import type { Channel } from "../core/m3u";

export type PlayerState = "idle" | "loading" | "playing" | "paused" | "error";
type StateFn = (state: PlayerState, message?: string) => void;

export interface Player {
  readonly native: boolean;
  play(ch: Channel): Promise<void>;
  pause(): void;
  resume(): void;
  stop(): void;
  setVolume(volume: number, muted: boolean): void;
}

interface WeaPlayerPlugin {
  play(o: { url: string; title: string; userAgent?: string; referrer?: string }): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<void>;
  setVolume(o: { volume: number }): Promise<void>;
  syncLibrary(o: { favorites: Channel[]; recent: Channel[] }): Promise<void>;
  setFullscreen(o: { on: boolean }): Promise<void>;
  info(): Promise<{ tv: boolean; pip: boolean }>;
  levels(): Promise<{ volume: number; volumeSteps: number; brightness: number }>;
  setLevel(o: { kind: "volume" | "brightness"; value: number }): Promise<void>;
  enterPip(): Promise<void>;
  addListener(e: "state", fn: (d: { state: PlayerState; message?: string }) => void): Promise<PluginListenerHandle>;
  addListener(e: "pip", fn: (d: { on: boolean }) => void): Promise<PluginListenerHandle>;
}

export const WeaPlayer = registerPlugin<WeaPlayerPlugin>("WeaPlayer");

const ERR = "No se pudo reproducir este canal. Puede estar caído o usar un formato no compatible.";

/** Android: Media3/ExoPlayer drawn under the transparent WebView (all codecs, custom headers, no CORS). */
class NativePlayer implements Player {
  readonly native = true;
  constructor(onState: StateFn) {
    void WeaPlayer.addListener("state", (d) => onState(d.state, d.state === "error" ? ERR : d.message));
  }
  async play(ch: Channel) {
    await WeaPlayer.play({ url: ch.url, title: ch.name, userAgent: ch.userAgent, referrer: ch.referrer });
  }
  pause() { void WeaPlayer.pause(); }
  resume() { void WeaPlayer.resume(); }
  stop() { void WeaPlayer.stop(); }
  setVolume(v: number, muted: boolean) { void WeaPlayer.setVolume({ volume: muted ? 0 : v / 100 }); }
}

/** "relay": through FFmpeg with the video copied; "transcode": FFmpeg also re-encodes the video. */
type Kind = "hls" | "mpegts" | "file" | "relay" | "transcode";

type Headers = { userAgent?: string; referrer?: string };
/** Windows shell bridge (electron/preload.cjs); absent in browsers. */
interface Bridge {
  setStreamHeaders(h: Headers): void;
  relayUrl(url: string, h: Headers, transcode?: boolean): string;
}
const bridge = (): Bridge | undefined => (window as { weavision?: Bridge }).weavision;

/**
 * With the FFmpeg relay (Windows), live MPEG-TS goes through it first, like VLC: it fixes audio Chromium
 * can't decode (MP2, AC-3, E-AC-3) and channels without audio. Re-encoding the video is the next step,
 * for feeds Chromium refuses (interlaced 1080i). Other formats use the relay only as a last resort.
 */
export function withRelay(kinds: Kind[]): Kind[] {
  return kinds[0] === "mpegts" ? ["relay", "transcode", ...kinds] : [...kinds, "relay", "transcode"];
}

export function kindsFor(url: string): Kind[] {
  const path = url.split(/[?#]/)[0].toLowerCase();
  if (path.endsWith(".m3u8") || path.includes("/hls/")) return ["hls", "file"];
  if (/\.(mp4|m4v|webm|mkv|mov|mp3|aac)$/.test(path)) return ["file"];
  // Xtream-style live channels: MPEG-TS only; trying HLS/file on them just adds dead waits.
  if (path.endsWith(".ts")) return ["mpegts"];
  // IPTV panels often serve MPEG-TS with no extension.
  return ["mpegts", "hls", "file"];
}

// The format that last worked for each channel is tried first next time (e.g. straight to "transcode").
const WORKED_KEY = "weavision.worked";
let worked: Record<string, Kind> = {};
try { worked = JSON.parse(localStorage.getItem(WORKED_KEY) ?? "{}"); } catch { /* storage unavailable */ }

function remember(url: string, kind: Kind) {
  if (worked[url] === kind) return;
  worked[url] = kind;
  try { localStorage.setItem(WORKED_KEY, JSON.stringify(worked)); } catch { /* storage unavailable */ }
}

export function preferred(url: string, kinds: Kind[]): Kind[] {
  const k = worked[url];
  return k && kinds.includes(k) ? [k, ...kinds.filter((x) => x !== k)] : kinds;
}

/** Windows (Electron) and browsers: hls.js / mpegts.js over <video>, trying formats in order. */
class WebPlayer implements Player {
  readonly native = false;
  private hls?: Hls;
  private ts?: Mpegts.Player;
  private token = 0;

  constructor(private video: HTMLVideoElement, private onState: StateFn) {
    video.addEventListener("playing", () => this.onState("playing"));
    video.addEventListener("waiting", () => this.onState("loading"));
    video.addEventListener("pause", () => !video.ended && video.src && this.onState("paused"));
  }

  async play(ch: Channel) {
    const token = ++this.token;
    this.onState("loading");
    // Windows: the Electron shell sends these headers on the stream's requests (see electron/preload.cjs).
    const headers = { userAgent: ch.userAgent, referrer: ch.referrer };
    const b = bridge();
    b?.setStreamHeaders(headers);
    const relay = b?.relayUrl(ch.url, headers);
    let slow = false; // a timeout is the network, not the format: don't pin the channel to a costlier mode
    for (const kind of preferred(ch.url, relay ? withRelay(kindsFor(ch.url)) : kindsFor(ch.url))) {
      if (token !== this.token) return;
      this.teardown();
      const url = kind === "relay" ? relay! : kind === "transcode" ? b!.relayUrl(ch.url, headers, true) : ch.url;
      try {
        await this.attempt(kind, url, token);
        if (!slow) remember(ch.url, kind);
        return;
      } catch (e) {
        slow ||= (e as Error).message === "timeout";
      }
    }
    if (token === this.token) { this.teardown(); this.onState("error", ERR); }
  }

  private async attempt(kind: Kind, url: string, token: number): Promise<void> {
    const v = this.video;
    const failed = new Promise<never>((_, reject) => {
      v.onerror = () => reject(new Error("media"));
      // The relay starts in 2-3 s when it works; a stalled copy should hand over to "transcode" quickly.
      setTimeout(() => reject(new Error("timeout")), kind === "relay" ? 8000 : 15000);
    });
    failed.catch(() => {}); // the timeout outlives a successful attempt
    if (kind === "hls") {
      const { default: H } = await import("hls.js");
      if (!H.isSupported()) {
        if (!v.canPlayType("application/vnd.apple.mpegurl")) throw new Error("hls unsupported");
        v.src = url;
      } else {
        // IPTV over the internet jitters: favour a few seconds of buffer over low latency.
        const hls = (this.hls = new H({ lowLatencyMode: false, backBufferLength: 30, maxBufferLength: 30, liveSyncDurationCount: 4 }));
        const fatal = new Promise<never>((_, reject) =>
          hls.on(H.Events.ERROR, (_e, d) => d.fatal && reject(new Error(d.details))),
        );
        hls.loadSource(url);
        hls.attachMedia(v);
        await Promise.race([new Promise((r) => hls.on(H.Events.MANIFEST_PARSED, r)), fatal, failed]);
        void fatal.catch(() => token === this.token && this.onState("error", ERR));
      }
    } else if (kind === "mpegts") {
      const { default: M } = await import("mpegts.js");
      if (!M.isSupported()) throw new Error("mse unsupported");
      const p = (this.ts = M.createPlayer({ type: "mpegts", isLive: true, url }, {
        enableStashBuffer: true, // without it every network hiccup freezes the picture
        stashInitialSize: 1024 * 1024,
        liveBufferLatencyChasing: false, // chasing the live edge drains the buffer and causes stalls
        autoCleanupSourceBuffer: true, // long sessions otherwise fill the buffer and stop
        lazyLoad: false,
      }));
      const fatal = new Promise<never>((_, reject) => p.on(M.Events.ERROR, () => reject(new Error("ts"))));
      p.attachMediaElement(v);
      p.load();
      await Promise.race([new Promise((r) => p.on(M.Events.MEDIA_INFO, r)), fatal, failed]);
      void fatal.catch(() => token === this.token && this.onState("error", ERR));
    } else {
      v.src = url;
    }
    // Success is the first decoded frame. play() can reject spuriously (e.g. interrupted by MSE),
    // and treating that as failure used to tear down a channel that was already showing.
    const frame = new Promise<void>((r) => v.addEventListener("loadeddata", () => r(), { once: true }));
    void v.play().catch(() => {});
    await Promise.race([frame, failed]);
    // Decoders reject unsupported video a few frames in (PIPELINE_ERROR_DECODE); give it a moment
    // so that case still moves on to the next format instead of ending in an error.
    await Promise.race([new Promise((r) => setTimeout(r, 2000)), failed]);
    if (token !== this.token) return;
    void v.play().catch(() => {});
    v.onerror = () => token === this.token && this.onState("error", ERR);
  }

  private teardown() {
    this.hls?.destroy();
    this.hls = undefined;
    this.ts?.destroy();
    this.ts = undefined;
    this.video.onerror = null;
    this.video.removeAttribute("src");
    this.video.load();
  }

  pause() { this.video.pause(); }
  resume() { void this.video.play(); }
  stop() { this.token++; this.teardown(); this.onState("idle"); }
  setVolume(v: number, muted: boolean) { this.video.volume = v / 100; this.video.muted = muted; }
}

export function createPlayer(video: HTMLVideoElement, onState: StateFn): Player {
  return Capacitor.isNativePlatform() && Capacitor.isPluginAvailable("WeaPlayer")
    ? new NativePlayer(onState)
    : new WebPlayer(video, onState);
}
