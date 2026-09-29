import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "io.github.shepard498.rcpbook",
  appName: "Recipe Manager",
  webDir: "dist",
  plugins: {
    SystemBars: {
      initialViewportFitValueHint: "cover",
    },
  },
};

export default config;
