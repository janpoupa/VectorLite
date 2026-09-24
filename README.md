# VectorLite

> Hyper-lightweight, blazing-fast native desktop vector viewer — built with Tauri v2, Rust, React, and Tailwind CSS.

![VectorLite](https://img.shields.io/badge/Tauri-v2-blue?logo=tauri) ![React](https://img.shields.io/badge/React-18-61DAFB?logo=react) ![Rust](https://img.shields.io/badge/Rust-Edition_2021-orange?logo=rust)

---

## Features

- **Instant vector & document previews** — support for `.svg` and `.pdf`
- **Folder snapping** — ← / → arrow keys navigate through every supported vector file in the directory
- **Background cycling** — Transparent checkerboard → White → Black (press `B` or toggle button)
- **Quick Export** — PNG, JPEG, WebP at 500 px, 1500 px, or custom width, preserving aspect ratio across all supported formats
- **Custom frameless titlebar** — Windows-style controls (minimize/maximize/close on the right)
- **Auto-hiding floating action bar** — fades away smoothly after inactivity
- **Tiny footprint** — no Chromium, no Electron, zero bloat, runs on native OS WebView

---

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Rust | stable (≥ 1.77) | `rustup update stable` |
| Node.js | ≥ 18 | [nodejs.org](https://nodejs.org) |
| Tauri CLI | v2 | bundled in `devDependencies` |
| WebView2 (Windows) | latest | auto-installed by Windows Update |

---

## Setup

### 1 — Generate app icons

Tauri needs icons in `src-tauri/icons/`. Create a 1024×1024 PNG then run:

```bash
# Requires the Tauri CLI (installed below)
npx tauri icon path/to/your-icon.png
```

This generates all required sizes automatically.
If you don't have an icon yet, copy the placeholder from the Tauri template:

```bash
# Quick placeholder (Tauri default icon)
npx create-tauri-app --template react-ts placeholder-icons
cp -r placeholder-icons/src-tauri/icons src-tauri/icons
```

### 2 — Install Node dependencies

```bash
npm install
```

### 3 — Run in development mode

```bash
npm run tauri dev
```

The app opens in a frameless window. Pass an SVG path as a CLI argument to open it directly:

```bash
# Windows PowerShell
npm run tauri dev -- -- path\to\file.svg
```

### 4 — Build for production

```bash
npm run tauri build
```

The installer is written to `src-tauri/target/release/bundle/`.

---

## File Association (Windows)

After installing the built app, right-click any `.svg` file → **Open with** → **Choose another app** → browse to `VectorLite.exe` → tick **Always use this app**.

The `tauri.conf.json` declares `fileAssociations` so the bundled installer can register VectorLite automatically with the OS during installation.

---

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `←` / `→` | Previous / next file in folder |
| `B` | Cycle background mode |
| `Ctrl+O` | Open file dialog |
| `Ctrl+0` | Reset zoom and pan |
| `Double-click canvas` | Reset zoom and pan |
| `Mouse wheel` | Zoom in/out |
| `Middle mouse drag` | Pan |
| `Alt + left drag` | Pan |
| `Escape` | Close open dialog |

---

## Troubleshooting

### Rust crate version mismatch
If `resvg = "0.44"` is not found on crates.io, change it in `src-tauri/Cargo.toml`:
```toml
resvg = "0.42"   # or whatever the latest 0.x is
tiny-skia = "0.11"
```

### Window appears all black / transparent issues
On some Windows configurations, `transparent: true` requires a compositor. Add this to the `windows` array in `tauri.conf.json`:
```json
"vibrancy": null,
"transparent": false
```
and remove the `rounded-xl` class from the root `<div>` in `App.tsx`.

---

## Anti-features (by design)

- ❌ No heavy vector editor bloat (no path/anchor/node manipulation)
- ❌ No complex layer trees or timeline panes
- ❌ No Electron / no bundled Chromium
- ❌ No accounts, telemetry, or cloud sync
- ❌ Zero background bloat — opens instantly as a default file viewer
