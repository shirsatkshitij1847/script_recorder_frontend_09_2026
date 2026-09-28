# Building the Windows `.exe` — Step by Step

This app is an Electron + React (Vite) desktop app. Producing a distributable Windows
build is a two-stage process: build the React frontend, then package it with Electron.

## Prerequisites

- Node.js and npm installed.
- Dependencies installed: `npm install`.
- Stable internet access (electron-builder downloads Electron binaries from GitHub the
  first time it runs, or whenever the cache is missing/cleared).

## Step 1 — Build the React frontend

```powershell
npm run build
```

**What it does:** runs `vite build`, compiling `src/` into static, production-optimized
assets in `dist/` (minified JS/CSS, hashed filenames, `index.html`).

**Why it matters:** Electron's production window loads `dist/index.html` directly from
disk (see `electron/main.cjs`), not the Vite dev server. Without this step, packaging
would ship a stale or missing `dist/` folder and the app would show a blank window.

## Step 2 — Package the Electron app

```powershell
npm run dist
```

**What it does:** this script runs `npm run build` again and then `electron-builder --win`, which:

1. Copies `dist/**`, `electron/**`, and `package.json` (per the `"files"` list in
   `package.json`'s `"build"` config) into a staging folder.
2. Downloads/caches the matching Electron runtime binary for `win32/x64` (cached under
   `%LOCALAPPDATA%\electron-builder\Cache`).
3. Rebuilds native dependencies (e.g. `playwright`) for that Electron/Node ABI via
   `@electron/rebuild`.
4. Produces an unpacked app at `release/win-unpacked/` (a runnable folder containing
   `MES Core Testing Setup.exe` and all resources, including `resources/app.asar`).
5. Wraps that unpacked app into the installer formats declared in `package.json` →
   `build.win.target`: **NSIS** (`.exe` installer) and **portable** (single-file `.exe`).

**Why it matters:** this is the step that actually produces the shippable `.exe` files
in `release/`. `app.asar` bundles your app's source/assets into one archive so end
users don't see raw source files.

## Step 3 — Locate the output

After a successful run, check the `release/` folder:

- `release/win-unpacked/` — runnable folder version (useful for quick testing without
  installing).
- `release/*.exe` (NSIS installer) — what you hand to a teammate to install the app
  like a normal Windows program (Start Menu shortcut, uninstaller, etc.).
- `release/*Portable*.exe` — single executable, no installation required; good for
  quick sharing or running from a USB drive.

## Notes / troubleshooting

- If `npm run dist` fails with `ECONNRESET` while "downloading electron", it's a
  network interruption (proxy/firewall/VPN), not a code issue. Retry, or run on a
  network without SSL-inspecting proxies, or set `HTTPS_PROXY`/`HTTP_PROXY` so
  electron-builder can route the GitHub download correctly.
- You can run `npx electron-builder --win` on its own to retry packaging without
  re-running the Vite build if `dist/` is already up to date.
- Each teammate's backend `BASE_URL` is configured per machine via the **Team Setup**
  tile inside the app (or falls back to `.env`'s `BASE_URL`/`PORT`) — it is not baked
  into the `.exe`, so the same build works for everyone regardless of their backend.
