import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const siblingMatzUi = path.resolve(__dirname, "../matz-ui/src");
const installedMatzUi = path.resolve(__dirname, "node_modules/@matz/ui/src");
const matzUiSrc = fs.existsSync(siblingMatzUi) ? siblingMatzUi : installedMatzUi;

const localXterm = path.resolve(__dirname, "node_modules/@xterm/xterm");
const siblingXterm = path.resolve(__dirname, "../writtt/frontend/node_modules/@xterm/xterm");
const xtermDir = fs.existsSync(localXterm) ? localXterm : siblingXterm;

const localXtermFit = path.resolve(__dirname, "node_modules/@xterm/addon-fit");
const siblingXtermFit = path.resolve(__dirname, "../writtt/frontend/node_modules/@xterm/addon-fit");
const xtermFitDir = fs.existsSync(localXtermFit) ? localXtermFit : siblingXtermFit;

export default defineConfig({
  resolve: {
    alias: {
      "@matz/ui/styles.css": path.resolve(matzUiSrc, "styles/matz-ui.css"),
      "@matz/ui/web": path.resolve(matzUiSrc, "web/WebShell.ts"),
      "@matz/ui/analytics": path.resolve(matzUiSrc, "analytics/ChartsAndGauges.ts"),
      "@matz/ui/icons": path.resolve(matzUiSrc, "icons/Icons.ts"),
      "@matz/ui": path.resolve(matzUiSrc, "index.ts"),
      "@xterm/xterm": xtermDir,
      "@xterm/addon-fit": xtermFitDir,
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "esnext",
  },
});
