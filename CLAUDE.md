# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SPEDSafe (特教安全教育资源仪) — an offline Electron desktop app for special education safety teaching. Plays video (`.mdat` disguised MP4) and H5 interactive courseware (`.hdat` disguised HTML) with learning record management. Contains 221 resources across 7 safety categories. Chinese-language UI.

## Tech Stack

- Electron 23.3.13 + Vue 3 (Composition API, `<script setup>`) + Vite 5
- electron-store for persistence, node-machine-id for fingerprinting, crypto-js for encryption
- Font Awesome 6.5.1 via CDN
- No TypeScript, no router library, no state management library, no test framework, no linter

## Commands

```bash
npm run electron          # Dev mode: Vite dev server + Electron concurrently
npm run dev               # Vite dev server only (port 5173)
npm run electron:dev      # Run Electron against existing build
npm run build             # Vite frontend build only
npm run electron:build    # Production build (vite build + electron-builder)
```

No test runner configured.

## Architecture

### Process Model

**Main process** (`main.js`, ~540 lines): Window creation, custom protocol registration, local HTTP server, IPC handlers, two electron-store instances (`learning-history`, `app-config`).

**Preload** (`preload.js`): `contextBridge.exposeInMainWorld` exposes `window.electronAPI` with all IPC methods.

**Renderer** (Vue 3 SPA): No vue-router — `App.vue` uses a `currentView` ref to switch between `home`, `dashboard`, and `player` views. All state is component-local.

### Resource Protection

- Videos: MP4 files renamed to `.mdat`, served via custom `local://` protocol which maps them to `video/mp4`
- H5 courseware: HTML directories renamed, `index.html` → `index.hdat`, served via local HTTP server on random port which maps `.hdat` → `text/html`
- Utility scripts: `rename-to-mdat.js`, `rename-h5-resources.js`, `protect-h5-resources.js`

### IPC Channels

All IPC is promise-based (`ipcMain.handle` / `ipcRenderer.invoke`):

- **Resources:** `load-resources`, `get-video-path`, `read-video-file`, `get-h5-path`, `get-http-server-port`, `get-cover-path`
- **Learning records:** `get-learning-record`, `get-all-learning-records`, `save-learning-record`, `get-learning-statistics`, `clear-learning-records`
- **Activation:** `get-machine-id`, `verify-license`, `get-activation-status`, `reset-activation`
- **App config:** `get-app-config`, `update-app-config`, `upload-logo`, `reset-logo`, `verify-admin-password`

### License System

RSA-2048 signatures + AES-256 encrypted local storage. Flow: machine fingerprint (node-machine-id) → admin generates license via `generate-license.js` or Python tools → user enters `SPED-XXXXX-XXXXX...` key → client verifies with `public-key.pem`. 7-day trial from first run. See `license-manager.js` for client verification, `generate-license.js` for server-side generation.

### Key Paths

- `main.js` — Electron main process (window, protocols, IPC, HTTP server)
- `preload.js` — Context bridge API
- `src/App.vue` — Root component, view routing
- `src/components/` — All Vue components (Player.vue, ResourceGrid.vue, LearningDashboard.vue, etc.)
- `src/resources.json` — Resource manifest (221 entries)
- `src/assets/covers/` — Cover thumbnails
- `src/assets/vdat/` — Video files (.mdat)
- `license-manager.js` — License verification module

### Build

electron-builder config is in `package.json` → `build` key. Targets Windows NSIS installer. Custom NSIS script (`installer.nsh`) sets default install path to `D:\Program Files\SpedSafe`. Extra resources (covers, resources.json, icons) are copied alongside the exe.

### Empty Directories

`src/services/`, `src/store/`, `src/utils/`, `src/router/`, `src/css/`, `src/electron/` exist but are unused.
