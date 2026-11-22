// Local FFmpeg relay, the same trick VLC relies on: Chromium can't decode MP2 / AC-3 / E-AC-3 audio and
// stalls on streams without audio. FFmpeg copies the video untouched, re-encodes only the audio to AAC
// (cheap) and adds a silent track when there is none, then hands mpegts.js a stream it can always play.
const http = require("node:http");
const { spawn } = require("node:child_process");

let current = null; // one stream at a time: IPTV accounts limit simultaneous connections

function stopCurrent() {
  if (current && current.exitCode === null) current.kill("SIGKILL");
  current = null;
}

function args(url, userAgent, referrer, transcode) {
  return [
    "-hide_banner", "-loglevel", "error", "-nostdin",
    "-user_agent", userAgent,
    ...(referrer ? ["-headers", `Referer: ${referrer}\r\n`] : []),
    "-reconnect", "1", "-reconnect_streamed", "1", "-reconnect_on_network_error", "1", "-reconnect_delay_max", "4",
    "-fflags", "+genpts+discardcorrupt",
    "-probesize", "1000000", "-analyzeduration", "1500000",
    "-i", url,
    "-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo",
    // Real audio first (<video> plays the first audio track), silence second for channels without audio.
    "-map", "0:v:0", "-map", "0:a:0?", "-map", "1:a:0",
    // "copy" costs nothing; transcoding is for video Chromium refuses to decode (interlaced 1080i sports feeds).
    ...(transcode
      ? ["-vf", "yadif=0:-1:1,format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-tune", "zerolatency", "-crf", "20", "-g", "60"] // local pipe: bitrate is free, CPU isn't
      : ["-c:v", "copy"]),
    "-c:a", "aac", "-b:a", "160k", "-ac", "2", "-ar", "48000",
    // Fragmented MP4 that <video> plays directly. FFmpeg pairs interlaced H.264 fields into whole frames,
    // which mpegts.js gets wrong (PIPELINE_ERROR_DECODE on 1080i sports channels).
    "-f", "mp4", "-movflags", "frag_keyframe+empty_moov+default_base_moof", "-frag_duration", "500000", "pipe:1",
  ];
}

/** Starts the relay on 127.0.0.1 and resolves with its port. GET /live?u=<url>&ua=<ua>&ref=<referrer>[&tx=1] */
function startProxy(ffmpegPath, defaultUA) {
  const server = http.createServer((req, res) => {
    const q = new URL(req.url, "http://127.0.0.1");
    const url = q.searchParams.get("u");
    if (q.pathname !== "/live" || !url || !/^https?:\/\//i.test(url)) { res.writeHead(400).end(); return; }
    stopCurrent();
    const ff = spawn(ffmpegPath, args(url, q.searchParams.get("ua") || defaultUA, q.searchParams.get("ref") || "", q.searchParams.get("tx") === "1"), { windowsHide: true });
    current = ff;
    let started = false;
    ff.stdout.once("data", () => {
      started = true;
      res.writeHead(200, { "Content-Type": "video/mp4", "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*" });
    });
    ff.stdout.on("data", (chunk) => res.write(chunk));
    ff.stderr.on("data", () => {}); // drain so FFmpeg never blocks on a full pipe
    ff.on("close", () => { if (!started) res.writeHead(502); res.end(); });
    ff.on("error", () => { if (!started) res.writeHead(502); res.end(); });
    res.on("close", () => { if (ff.exitCode === null) ff.kill("SIGKILL"); if (current === ff) current = null; });
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => resolve(server.address().port));
  });
}

module.exports = { startProxy, stopCurrent };
