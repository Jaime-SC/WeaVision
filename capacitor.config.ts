import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "cl.loscarewea.weavision",
  appName: "WeaVision",
  webDir: "dist",
  backgroundColor: "#1B4532",
  android: {
    // Most IPTV lists and logos are plain http.
    allowMixedContent: true,
  },
  plugins: {
    // Native HTTP for playlist downloads: no CORS, follows redirects.
    CapacitorHttp: { enabled: true },
  },
};

export default config;
