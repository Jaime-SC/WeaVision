// WeaVision for Windows: Electron shell around the shared web app in dist/.
const { app, BrowserWindow, ipcMain, session, shell } = require("electron");
const path = require("node:path");

// IPTV panels often refuse browsers; present ourselves like VLC does, unless the list asks for another UA.
const PLAYER_UA = "VLC/3.0.21 LibVLC/3.0.21";
let stream = { userAgent: "", referrer: "" };
ipcMain.on("stream-headers", (_e, h) => { stream = { userAgent: String(h.userAgent || ""), referrer: String(h.referrer || "") }; });

// FFmpeg ships next to the app (extraResources); in development it comes from the ffmpeg-static package.
const { startProxy, stopCurrent } = require("./ffmpeg-proxy.cjs");
function findFfmpeg() {
  const bundled = path.join(process.resourcesPath, "ffmpeg.exe");
  if (require("node:fs").existsSync(bundled)) return bundled;
  try { return require("ffmpeg-static"); } catch { return null; } // no FFmpeg: play streams directly
}
const ffmpegPath = findFfmpeg();
let proxyPort = 0;
ipcMain.on("proxy-port", (e) => { e.returnValue = proxyPort; });
ipcMain.on("proxy-stop", () => stopCurrent());

app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 360,
    minHeight: 480,
    backgroundColor: "#1B4532",
    title: "WeaVision",
    icon: path.join(__dirname, "..", "dist", "icon-192.png"),
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(__dirname, "preload.cjs") },
  });
  win.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  // External links open in the browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("before-input-event", (_e, input) => {
    if (input.type === "keyDown" && input.key === "F11") win.setFullScreen(!win.isFullScreen());
  });
}

app.whenReady().then(async () => {
  if (ffmpegPath) proxyPort = await startProxy(ffmpegPath, PLAYER_UA).catch(() => 0);
  // Requests to the internet look like a media player's: no Origin/Sec-Fetch (servers reject file://), player UA.
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls: ["http://*/*", "https://*/*"] }, (details, done) => {
    const headers = {};
    for (const [k, v] of Object.entries(details.requestHeaders)) if (!/^(origin|referer|sec-fetch-.*|sec-ch-.*)$/i.test(k)) headers[k] = v;
    headers["User-Agent"] = stream.userAgent || PLAYER_UA;
    if (stream.referrer) headers["Referer"] = stream.referrer;
    done({ requestHeaders: headers });
  });
  // IPTV servers rarely send CORS headers; the app is the only page loaded, so allow its requests.
  session.defaultSession.webRequest.onHeadersReceived((details, done) => {
    const headers = { ...details.responseHeaders };
    for (const k of Object.keys(headers)) if (/^access-control-allow-(origin|headers|methods)$/i.test(k)) delete headers[k];
    headers["Access-Control-Allow-Origin"] = ["*"];
    headers["Access-Control-Allow-Headers"] = ["*"];
    headers["Access-Control-Allow-Methods"] = ["GET, HEAD, OPTIONS"];
    done({ responseHeaders: headers });
  });
  createWindow();
  app.on("activate", () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on("window-all-closed", () => { stopCurrent(); app.quit(); });
