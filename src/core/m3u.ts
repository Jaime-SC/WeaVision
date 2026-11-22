export interface Channel {
  /** Stable id inside its playlist: the stream URL. */
  url: string;
  name: string;
  logo?: string;
  group?: string;
  tvgId?: string;
  chno?: string;
  /** Number shown everywhere (tile badge, zap sticker): tvg-chno, else the position in its list. */
  num?: string;
  userAgent?: string;
  referrer?: string;
}

export interface ParseResult {
  channels: Channel[];
  epgUrl?: string;
  errors: number;
}

const ATTR_RE = /([a-zA-Z0-9_-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s,"']+))/g;
const EXTINF_RE = /^#EXTINF\s*:\s*(-?\d+(?:\.\d+)?)\s*(.*?)\s*,\s*(.*)$/is;
const URL_RE = /^(https?|rtmp|rtsp|udp|rtp|file):\/\//i;

export function parseAttributes(s: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of s.matchAll(ATTR_RE)) out[m[1].toLowerCase()] = (m[2] ?? m[3] ?? m[4] ?? "").trim();
  return out;
}

export function parseM3U(text: string): ParseResult {
  const channels: Channel[] = [];
  const seen = new Set<string>();
  let errors = 0;
  let epgUrl: string | undefined;
  let pending: Omit<Channel, "url"> | null = null;

  for (const raw of text.replace(/^﻿/, "").split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const upper = line.slice(0, 10).toUpperCase();
    if (upper.startsWith("#EXTM3U")) {
      const a = parseAttributes(line.slice(7));
      epgUrl = a["x-tvg-url"] || a["url-tvg"] || epgUrl;
      continue;
    }
    if (upper.startsWith("#EXTINF")) {
      if (pending) errors++; // previous entry never got its URL
      const m = EXTINF_RE.exec(line);
      if (!m) { errors++; pending = null; continue; }
      const a = parseAttributes(m[2] || "");
      pending = {
        name: m[3].trim() || a["tvg-name"] || "Canal sin nombre",
        logo: a["tvg-logo"] || undefined,
        group: a["group-title"] || undefined,
        tvgId: a["tvg-id"] || undefined,
        chno: a["tvg-chno"] || undefined,
      };
      continue;
    }
    if (line.startsWith("#")) {
      if (pending && /^#EXTVLCOPT:/i.test(line)) {
        const [k, ...v] = line.slice(11).split("=");
        const key = k.trim().toLowerCase();
        if (key === "http-user-agent") pending.userAgent = v.join("=").trim();
        if (key === "http-referrer" || key === "http-referer") pending.referrer = v.join("=").trim();
      } else if (pending && /^#EXTGRP:/i.test(line) && !pending.group) {
        pending.group = line.slice(8).trim() || undefined;
      }
      continue;
    }
    if (!pending || !URL_RE.test(line)) { errors++; pending = null; continue; }
    if (!seen.has(line)) {
      seen.add(line);
      channels.push({ ...pending, url: line, num: pending.chno || String(channels.length + 1).padStart(2, "0") });
    }
    pending = null;
  }
  if (pending) errors++;
  return { channels, epgUrl, errors };
}
