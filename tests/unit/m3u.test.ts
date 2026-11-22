import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAttributes, parseM3U } from "../../src/core/m3u";
import { normalize } from "../../src/core/store";
import { kindsFor, preferred, withRelay } from "../../src/player/player";

const sample = readFileSync(new URL("../fixtures/sample.m3u", import.meta.url), "utf8");

describe("parseM3U", () => {
  const r = parseM3U(sample);

  it("reads valid channels, skips duplicates and bad lines", () => {
    expect(r.channels.map((c) => c.name)).toEqual([
      "Canal Deportes HD", "Noticias 24", "Canal Nacional", "Canal Sin Atributos",
      "Duplicado A", "Película: El Niño & Co.", "Chile Señal 12",
    ]);
    expect(r.errors).toBe(3); // orphan URL, EXTINF without URL, invalid URL
    expect(r.epgUrl).toBe("http://example.com/epg.xml");
  });

  it("maps attributes", () => {
    expect(r.channels[0]).toMatchObject({ logo: "http://example.com/logo1.png", group: "Deportes", tvgId: "ch1" });
    expect(r.channels[6]).toMatchObject({ chno: "12", num: "12", url: "rtmp://live.example.com/app/stream12" });
    expect(r.channels[2].num).toBe("03");
    expect(r.channels[3].group).toBeUndefined();
  });

  it("handles BOM, CRLF, EXTVLCOPT headers and EXTGRP", () => {
    const t = '﻿#EXTM3U\r\n#EXTINF:-1,Uno\r\n#EXTVLCOPT:http-user-agent=Foo/1.0\r\n#EXTVLCOPT:http-referrer=https://a.b/\r\n#EXTGRP:Cine\r\nhttp://x/1.ts\r\n';
    expect(parseM3U(t).channels[0]).toMatchObject({ name: "Uno", userAgent: "Foo/1.0", referrer: "https://a.b/", group: "Cine" });
  });

  it("parses quoted and bare attribute values", () => {
    expect(parseAttributes(`tvg-id='a b' group-title="X, Y" radio=true`)).toEqual({ "tvg-id": "a b", "group-title": "X, Y", radio: "true" });
  });
});

describe("helpers", () => {
  it("normalizes accents for search", () => expect(normalize("  Señal Ñuble ")).toBe("senal nuble"));
  it("picks playback formats by URL", () => {
    expect(kindsFor("http://a/b/index.m3u8?token=1")).toEqual(["hls", "file"]);
    expect(kindsFor("http://a/movie.MP4")).toEqual(["file"]);
    expect(kindsFor("http://panel:8080/live/u/p/123")).toEqual(["mpegts", "hls", "file"]);
    expect(kindsFor("http://panel/play/abc.ts")).toEqual(["mpegts"]);
  });
  it("routes live TS through the FFmpeg relay first on Windows", () => {
    expect(withRelay(["mpegts"])).toEqual(["relay", "transcode", "mpegts"]);
    expect(withRelay(["hls", "file"])).toEqual(["hls", "file", "relay", "transcode"]);
    expect(preferred("http://never-played/x.ts", ["relay", "transcode"])).toEqual(["relay", "transcode"]);
  });
});

describe("watch stats", () => {
  it("keeps a rolling week in local days", async () => {
    const { store } = await import("../../src/core/store");
    (store as unknown as { save: () => Promise<void> }).save = async () => {};
    const now = new Date(2026, 10, 21, 22);
    await store.addWatch(999, new Date(2026, 9, 1)); // older than 14 days by now: dropped
    await store.addWatch(300, new Date(2026, 10, 19, 10));
    await store.addWatch(600, now);
    const week = store.week(now);
    expect(week).toHaveLength(7);
    expect(week.at(-1)!.minutes).toBe(10);
    expect(week.at(-3)!.minutes).toBe(5);
    expect(Object.keys(store.watched)).not.toContain("2026-10-01");
  });
});
