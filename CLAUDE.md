# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repo contains two independent Node.js projects plus CLI wrapper scripts.

## Architecture

### Pomodoro (`pomodoro/`)
Electron desktop app — minimalist pomodoro timer with stats tracking.

- **main.js** — Electron main process: window creation, system tray, IPC handlers, JSON file store (`pomodoro-data.json` in userData)
- **preload.js** — contextBridge exposing `window.pomodoro` API (storeGet/storeSet/showNotification/flashWindow/minimizeWindow) to renderer
- **src/renderer.js** — UI logic: timer state machine (work→shortBreak→longBreak cycle), ring progress animation, weekly chart canvas
- **src/index.html** — frameless window with custom titlebar, tab navigation (timer/stats)
- **src/style.css** — CSS variables for light/dark theme via `prefers-color-scheme`

Timer cycle: 4× (25min work + 5min short break) → 15min long break → repeat.

### Proxy (`proxy/`)
Node.js HTTP proxy on port 8877 — converts Anthropic API format to OpenAI format, forwards to upstream endpoint.

- **server.js** — single-file proxy: `/v1/messages` (Anthropic→OpenAI conversion), `/v1/models`, `/health`; model mapping layer; non-streaming response conversion

### CLI Wrappers (root)
`claude`, `lark-cli`, `lark-channel-bridge`, `npm`, `npx` — shell/cmd/ps1 launchers for respective tools.

## Commands

```bash
# Pomodoro
cd pomodoro && npm start          # Launch Electron app

# Proxy
cd proxy && node server.js        # Start proxy on :8877
```
