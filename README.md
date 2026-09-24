<h1 align="center">working-agents</h1>

<p align="center"><b>Your Claude Code sessions, alive in a pixel-art office.</b></p>

<p align="center">
  <img alt="Node.js >= 18" src="https://img.shields.io/badge/node-%3E%3D18-339933?logo=node.js&logoColor=white">
  <img alt="Status: personal project" src="https://img.shields.io/badge/status-personal%20project-blue">
  <img alt="Runs locally" src="https://img.shields.io/badge/runs-locally%2C%20no%20cloud-lightgrey">
  <img alt="Built for Claude Code" src="https://img.shields.io/badge/built%20for-Claude%20Code-d97757">
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#how-it-works">How it Works</a> •
  <a href="#the-daily-schedule">Daily Schedule</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#credits">Credits</a>
</p>

<br>

A small local web app that turns every active Claude Code session on your
machine into a character walking around a 6-room pixel office — working at
a desk, waiting on a permission prompt, or idle at the bar, the games room,
or asleep in the dorm — updated in real time from the actual session data
on disk, not a simulation.

<p align="center">
  <img src="docs/screenshot-office.png" alt="The office, live — six rooms, three agents, real-time status">
</p>

## Why

Running several Claude Code sessions in parallel across terminal tabs means
losing track of which one is actually doing something, which one is stuck
waiting for a permission prompt, and which one has been idle for twenty
minutes. `working-agents` answers that at a glance: a status board for your
own agents, styled as an office instead of a table.

It's in the same spirit as [pixel-agents](https://github.com/pablodelucca/pixel-agents)
and its forks — a small genre that's emerged specifically around
visualizing Claude Code activity — but built from scratch for this
workflow, with two things those don't do:

- **Real cost and token accounting.** Every character carries its session's
  actual `input`/`output`/`cache_read`/`cache_creation` token counts, read
  straight from the JSONL transcript and priced against current per-model
  rates. Click a character to see it.
- **A daily routine, not just a status dot.** Idle agents don't just stand
  around — they follow an actual schedule (coffee breaks, lunch, end of
  day, bed) instead of drifting to a random spot in the office.

## Features

- 🟢 Live status per session — **working** / **waiting** / **idle** —
  hook-precise when available, heuristic otherwise
- 💰 Real per-session cost and token usage, estimated from actual usage
  data against current model pricing
- 🔍 Click any character for a full detail panel: model, session duration,
  tokens, cost, tool calls, last activity, last message
- 🏢 A 6-room pixel office — work, meeting room, bathroom, bar, games room,
  dorm — each one labeled on the map
- 🧵 Subagents are tracked too, shown distinctly from top-level sessions
- 📅 A real daily schedule for idle agents instead of random wandering
- 📦 Zero runtime dependency on anything outside the repo — sprite sources
  are vendored under `assets-src/`, not fetched from elsewhere

<p align="center">
  <img src="docs/screenshot-detail.png" alt="Detail panel with real session data — model, duration, tokens, cost, tool calls" width="620">
</p>

## How it Works

```
~/.claude/projects/**/*.jsonl  →  sessionParser.js  →  status + usage + cost
                                        ↓
~/.claude/settings.json hooks  →  claude-hook.js  →  hookState.js  (overrides heuristic when fresh)
                                        ↓
                                   scanSessions.js  →  world.js (pathfinding, schedule)
                                        ↓
                              WebSocket  →  client/index.html (pixel office)
```

**Status detection is two-layered**, same idea as the rest of this genre of
tool:

1. **Hooks (precise).** `scripts/install-hooks.py` wires `SessionStart`,
   `PreToolUse`, `PostToolUse`, `PermissionRequest`, `Notification`,
   `Stop`, `SubagentStart`/`Stop` and `SessionEnd` in your Claude Code
   settings to POST to this server. A fresh hook event (< 20s old) wins.
2. **Heuristic (fallback).** With no recent hook event, `sessionParser.js`
   infers status from the JSONL transcript itself: a recent turn means
   *working*, a dangling `tool_use` with no matching `tool_result` means
   *waiting*, and silence past 5 minutes means *idle*.

**Movement** is a small waypoint graph, not a full pathfinding grid: every
room has a door connected to a central hallway hub, so a character visibly
walks out of one room, across the hallway, and into another. **The office
background and character sprites** are pre-rendered once by
`scripts/generate-office.py` from vendored CC0/CC-BY sprite packs (see
[Credits](#credits)) — the server itself only pushes positions and status
over WebSocket, it does no rendering.

## The Daily Schedule

Idle agents follow this routine (local time). Working/waiting agents always
stay at their desk regardless of the clock — this only governs what an idle
agent does with its downtime, it's not a claim about when real activity
happens:

| Time | Idle agents go to |
|---|---|
| 08:00 – 11:00 | free roam |
| 11:00 – 11:30 | ☕ bar (break) |
| 11:30 – 13:00 | free roam |
| 13:00 – 14:00 | 🍽️ bar (lunch) |
| 14:00 – 16:45 | free roam |
| 16:45 – 17:15 | ☕ bar (break) |
| 17:15 – 18:00 | free roam |
| 18:00 – 20:00 | 🎮 games room (end of day) |
| 20:00 – 21:00 | 🍽️ bar (dinner) |
| 21:00 – 00:00 | 🎮 games room |
| 00:00 – 08:00 | 🛏️ dorm (asleep) |

Tune it in `SCHEDULE` at the top of `server/world.js`.

## Quick Start

```bash
npm install
npm run dev
```

Then open **http://localhost:4242**.

### Optional: precise status via hooks

Without hooks, status is inferred from JSONL timestamps alone (still
accurate, just a bit less immediate). To wire up the real thing:

```bash
python3 scripts/install-hooks.py
```

This merges a `hooks` block into `~/.claude/settings.json` (backing it up
first) without touching anything else already there. It's idempotent —
safe to re-run. Restart any active Claude Code sessions (or open `/hooks`
once) for the config to take effect.

### Optional: regenerate the office background

The background and character sprites are pre-rendered PNGs, already
checked into `client/assets/`. You only need to regenerate them if you
change the layout in `scripts/generate-office.py`:

```bash
python3 -m venv .venv && .venv/bin/pip install pillow
.venv/bin/python scripts/generate-office.py
```

## Project Layout

```
server/
  index.js          HTTP + WebSocket server, hook endpoint, tick loop
  sessionParser.js   .jsonl → status, usage, cost (the heuristic layer)
  hookState.js       in-memory hook-driven status (the precise layer)
  scanSessions.js     finds active sessions, merges hook + heuristic
  world.js           pathfinding, seat assignment, the daily schedule
  pricing.js         per-model token pricing
  claude-hook.js      the script Claude Code itself invokes on hook events
client/
  index.html          the pixel office UI (vanilla JS + WebSocket)
  assets/             pre-rendered office background and character sprites
scripts/
  generate-office.py  builds office-bg.png + character sprites from assets-src/
  install-hooks.py    one-time, user-run installer for the Claude Code hooks
assets-src/           vendored sprite packs (see Credits below)
```

## Credits

| Pack | Author | License |
|---|---|---|
| MetroCity characters | JIK-A-4 | CC0 |
| Office Furniture Pixel Art | Antea | CC BY 4.0 — attribution required |
| Billiard Kit Pixel Art | Luca Pixel (OpenGameArt) | CC0 |
| Cute Cafe/Arcade Assets | Lumi | Informal permission |

Full attribution text in [CREDITS.md](CREDITS.md).

## Status

Personal project, running locally. Not published as a public repository.
