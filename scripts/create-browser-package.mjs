import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync, chmodSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(repoRoot, "dist");
const packageDir = path.join(repoRoot, "release", "recipe-ingredient-manager-browser");

const serverScript = String.raw`import { createServer } from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
const preferredPort = Number(process.env.PORT) || 4173;
const shouldOpenBrowser = process.env.NO_OPEN !== "1" && !process.argv.includes("--no-open");
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
]);

const server = createServer((request, response) => {
  try {
    const requestUrl = new URL(request.url ?? "/", "http://localhost");
    const relativePath = path.normalize(decodeURIComponent(requestUrl.pathname).replace(/^\/+/, ""));

    if (relativePath.startsWith("..") || path.isAbsolute(relativePath)) {
      response.writeHead(403);
      response.end("Forbidden");
      return;
    }

    let filePath = path.join(root, relativePath || "index.html");

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }

    if (!existsSync(filePath)) {
      filePath = path.join(root, "index.html");
    }

    const extension = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(extension) ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(filePath).pipe(response);
  } catch (error) {
    response.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    response.end(error instanceof Error ? error.message : "Server error");
  }
});

listen(preferredPort);

function listen(port) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      listen(port + 1);
      return;
    }

    console.error(error);
    process.exit(1);
  });

  server.listen(port, "127.0.0.1", () => {
    const url = "http://127.0.0.1:" + port + "/";
    console.log("Recipe Ingredient Manager is running at " + url);
    console.log("Close this window to stop the app.");
    if (shouldOpenBrowser) {
      openBrowser(url);
    }
  });
}

function openBrowser(url) {
  const command =
    process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args =
    process.platform === "win32" ? ["/c", "start", "", url] : [url];

  const child = spawn(command, args, {
    detached: true,
    stdio: "ignore",
  });
  child.unref();
}
`;

const windowsLauncher = String.raw`@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to launch this browser package.
  echo Install Node.js from https://nodejs.org/ and run this file again.
  pause
  exit /b 1
)
node server.mjs
pause
`;

const unixLauncher = String.raw`#!/usr/bin/env sh
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is required to launch this browser package."
  echo "Install Node.js from https://nodejs.org/ and run this file again."
  exit 1
fi
node server.mjs
`;

const packageReadme = String.raw`Recipe Ingredient Manager - Browser Package

This folder contains the built app and a tiny local server launcher.

Windows:
  Double-click launch-windows.cmd.

macOS/Linux:
  Run ./launch-mac-linux.sh from a terminal.

The launcher opens the app in your browser at http://127.0.0.1:4173/ or the next available port.
Keep the launcher window open while using the app.

Node.js is required for the local launcher: https://nodejs.org/

Your recipe data is stored by the browser on this local address. Use the app's backup/export feature before moving computers, switching browsers, or changing how the app is hosted.
`;

if (!existsSync(distDir)) {
  throw new Error("Missing dist folder. Run npm run build before packaging.");
}

rmSync(packageDir, { recursive: true, force: true });
mkdirSync(packageDir, { recursive: true });
cpSync(distDir, packageDir, { recursive: true });

writeFileSync(path.join(packageDir, "server.mjs"), serverScript);
writeFileSync(path.join(packageDir, "launch-windows.cmd"), windowsLauncher);
writeFileSync(path.join(packageDir, "launch-mac-linux.sh"), unixLauncher);
writeFileSync(path.join(packageDir, "README.txt"), packageReadme);

chmodSync(path.join(packageDir, "launch-mac-linux.sh"), 0o755);

console.log(`Browser package created at ${path.relative(repoRoot, packageDir)}`);
console.log("Launch with launch-windows.cmd on Windows, or launch-mac-linux.sh on macOS/Linux.");
