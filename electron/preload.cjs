// Bridge between the page and the Windows shell: per-channel headers and the local FFmpeg relay.
const { contextBridge, ipcRenderer } = require("electron");

const port = ipcRenderer.sendSync("proxy-port");

contextBridge.exposeInMainWorld("weavision", {
  setStreamHeaders: (h) => ipcRenderer.send("stream-headers", { userAgent: h?.userAgent || "", referrer: h?.referrer || "" }),
  /** URL of the channel relayed through FFmpeg, or "" when the relay isn't available. */
  relayUrl: (url, h, transcode) => {
    if (!port) return "";
    const q = new URLSearchParams({ u: url });
    if (h?.userAgent) q.set("ua", h.userAgent);
    if (h?.referrer) q.set("ref", h.referrer);
    if (transcode) q.set("tx", "1");
    return `http://127.0.0.1:${port}/live?${q}`;
  },
  stopRelay: () => ipcRenderer.send("proxy-stop"),
});
