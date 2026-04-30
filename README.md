<div align="center">

<img src="docs/images/Bullsai1.png" alt="BullsAI" width="280">

# BullsAI

**Snap Spectacles that watch your darts, coach your throw, and turn any dartboard into a smart training ground with games — throw, learn, and play.**

[![Watch the trailer](https://img.shields.io/badge/▶-Watch_the_trailer-purple?style=for-the-badge)](https://www.youtube.com/watch?v=wr63v62yR7k)
[![Try it now](https://img.shields.io/badge/▶-Try_the_phone_detector-orange?style=for-the-badge)](https://ohistudio.github.io/BullsAI/web/darts.html)

*Built for the XRCC 2026 Hackathon — "Kill The Manual" track.*

</div>

---

## Table of contents

- [Overview](#overview)
- [How it works](#how-it-works)
- [Game modes](#game-modes)
- [Repo structure](#repo-structure)
- [Tech stack](#tech-stack)
- [Run it locally](#run-it-locally)
- [Tutorial: setting up Supabase](#tutorial-setting-up-supabase)
- [Tutorial: adding a new game](#tutorial-adding-a-new-game)
- [What's next](#whats-next)

---

## Overview

BullsAI is an AR coaching and gaming platform for darts. A phone (mounted on a tripod) watches the board through computer vision and detects every dart in real time. Snap Spectacles overlay coaching prompts, target highlights, and games onto the real dartboard.

No manual. No screen. Just throw, learn, and play.

<div align="center">
<img src="docs/images/bullsai2.png" alt="In-game" width="700">
</div>

### Why

Anyone who's tried to learn darts knows the experience: throw a thousand darts at a wall, hope something improves. There's no instant feedback, no tracking, no progression. We've all rage-quit an IKEA manual or stared at a confusing new gadget — darts has the same problem.

BullsAI kills the manual for a hobby millions of people share. AR also opens darts to newcomers — augmenting a traditional game with social features and mini-games.

### Features

- **Real-time dart detection** — phone camera + OpenCV.js, every 200ms
- **AR target highlights** — glowing zones tell you exactly where to aim
- **Coaching mode** — structured lessons on board layout, technique, and progressive drills
- **Smart feedback** — "Pulled hard right — relax your grip" or "Right number, wrong ring" based on actual dart position
- **Four game modes** — Tic Tac Toe, Bubble Pop, Apple on Head, Free Throw
- **Multiplayer-ready** — multiple Spectacles join the same code and see darts in sync
- **Reactive character** — slime-face mascot that responds to every throw

<div align="center">
<img src="docs/images/bullasi3.png" alt="Game in action" width="600">
</div>

---

## How it works

```
┌──────────────┐         ┌──────────┐         ┌──────────────┐
│  PHONE       │ ─────►  │ SUPABASE │  ◄───── │  SPECTACLES  │
│  darts.html  │ writes  │ database │  reads  │  Lens Studio │
│  + OpenCV    │         │          │         │  (TypeScript)│
└──────────────┘         └──────────┘         └──────────────┘
```

The phone is the **input device** — pure dart detector, no game logic. Spectacles is the **display** — runs all the games and coaching. Supabase is the bridge.

<div align="center">
<img src="docs/images/bullasi4.png" alt="Phone detection" width="600">
</div>

### 4-dart calibration

Place darts at Double 20, 6, 3, and 11 (top, right, bottom, left). Four known points on a circle yield a perfect perspective transform from any camera angle.

### Detection pipeline

1. Phone camera frame goes through OpenCV.js
2. Red+green colour mask isolates the board
3. Yellow tape on the dart is found via HSV detection
4. Calibration matrix maps tape position → board coordinates
5. Distance from centre + segment angle = zone (e.g. "Triple 20")
6. Posted to Supabase `dart_throws` table
7. Spectacles polls the table, fires `onDartLanded()`, every game reacts

---

## Game modes

### Dart Assist — coaching mode

Three sub-phases:
- **Learn the Board** — 7 lessons explaining singles, doubles, triples, bullseye
- **Technique** — 6 lessons on stance, grip, oche line, follow-through
- **Drills** — 12 progressive targets with smart feedback after every throw

<div align="center">
<img src="docs/images/bullsai6.png" alt="Dart Assist" width="600">
</div>

### Bubble Pop

Puzzle Bobble style cluster popper. Bubbles spawn around the rim in three colours. Hit a matching colour bubble — it and all touching same-colour bubbles fall together with explosive physics.

<div align="center">
<img src="docs/images/bullasi7.png" alt="Bubble Pop" width="600">
</div>

### Apple on Head

William Tell style. A Bitmoji holds an apple — hit the apple to launch it, hit the face for a penalty.

<div align="center">
<img src="docs/images/bullsai8.png" alt="Apple on Head" width="600">
</div>

### Tic Tac Toe & Free Throw

<div align="center">
<img src="docs/images/bullsai9.png" alt="Tic Tac Toe" width="500">
<img src="docs/images/bullai10.png" alt="Free Throw heat map" width="500">
</div>

---

## Repo structure

```
BullsAI/
├── README.md
├── web/                 # Phone webapp — open on any phone in Safari/Chrome
│   ├── darts.html
│   └── assets/
└── spectacles/          # Lens Studio scripts (TypeScript)
    ├── DartBoard.ts         # Core input — polls Supabase, fires onDartLanded
    ├── BullsAILobby.ts      # Menu router (UIKit)
    ├── DartAssist.ts        # Coaching: lessons, drills, smart feedback
    ├── TicTacToeGame.ts     # Tic Tac Toe with cell takeover
    ├── BubblePopGame.ts     # Cluster bubble pop with physics
    ├── AppleOnHeadGame.ts   # William Tell apple-launch
    ├── SlimeFace.ts         # Reactive eye/face character
    └── ThrowDetector.ts     # (optional) hand-velocity throw detection
```

---

## Tech stack

- **Phone webapp** — HTML / JS / OpenCV.js
- **Spectacles** — TypeScript in Lens Studio 5
- **Sync** — Supabase (Snap Cloud) — `dart_games` + `dart_throws` tables
- **UI** — SpectaclesUIKit (RectangleButton, TextInputField), SIK (hand tracking, pinch)
- **Hosting** — phone webapp deployable as a static site (e.g. GitHub Pages)

---

## Run it locally

### Phone webapp

Live URL (GitHub Pages):
```
https://ohistudio.github.io/BullsAI/web/darts.html
```

Or run locally:
```bash
cd web
python3 -m http.server 8080
```
Then `http://localhost:8080/darts.html` in Chrome.

For mobile testing over a tunnel:
```bash
cloudflared tunnel --url http://localhost:8080
```

### Spectacles app

1. Open `spectacles/` in Lens Studio 5
2. Install **SpectaclesUIKit** and **SpectaclesInteractionKit** from the Asset Library
3. Install the **SupabaseClient** package
4. Set up your own Supabase project (see tutorial below)
5. Update credentials on the `DartBoard` component
6. Send to Spectacles via File → Send To → Spectacles

---

## Tutorial: setting up Supabase

BullsAI uses Supabase as a real-time bridge between phone and Spectacles. Forking? You'll need your own.

### 1. Create a Snap Cloud Supabase project

Snap provides free Supabase via Snap Cloud — go to [Snap Cloud Console](https://kit.snapchat.com/manage/snap-cloud) and create a new project. You'll get:

- Project URL (e.g. `https://your-id.snapcloud.dev`)
- Anon (public) API key

### 2. Create the tables

In the SQL editor, run:

```sql
create table dart_games (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  board integer[] default '{0,0,0,0,0,0,0,0,0}',
  current_player integer default 1,
  winner integer default 0,
  status text default 'playing',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table dart_throws (
  id uuid primary key default gen_random_uuid(),
  game_id uuid references dart_games(id) on delete cascade,
  player integer,
  trigger_type text,
  cell integer,
  zone text,
  status text default 'pending',
  created_at timestamptz default now()
);

create index idx_dart_throws_game on dart_throws(game_id, status, created_at desc);
create index idx_dart_games_code on dart_games(code, status);
```

### 3. Configure Row Level Security (optional but recommended)

```sql
alter table dart_games enable row level security;
alter table dart_throws enable row level security;

-- Public read/write — fine for hackathon, lock down for production
create policy "anyone can read games" on dart_games for select using (true);
create policy "anyone can write games" on dart_games for insert with check (true);
create policy "anyone can update games" on dart_games for update using (true);
create policy "anyone can read throws" on dart_throws for select using (true);
create policy "anyone can write throws" on dart_throws for insert with check (true);
```

### 4. Wire up your credentials

**Phone webapp** — top of `web/darts.html`:
```javascript
const SUPABASE_URL = 'https://YOUR-PROJECT.snapcloud.dev';
const SUPABASE_KEY = 'YOUR-ANON-KEY';
```

**Spectacles** — in Lens Studio, create a `Supabase Project` asset, paste your URL and anon key, then drag it into the `DartBoard` component's Inspector slot.

That's it. Phone writes to `dart_throws`, Spectacles polls and reacts.

---

## Tutorial: adding a new game

The architecture is designed to make this fast. Every game is a self-contained TypeScript file that listens to dart events.

### Step 1 — Create the game script

Create `spectacles/MyNewGame.ts`:

```typescript
import { DartBoard, DartHit } from "./DartBoard";

@component
export class MyNewGame extends BaseScriptComponent {

  @input dartBoard: DartBoard;
  @input @allowUndefined statusText: Text;

  private isPlaying: boolean = false;
  private score: number = 0;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
  }

  onStart() {
    if (!this.dartBoard) {
      print("[MyGame] ERROR: Assign DartBoard!");
      return;
    }

    // Listen for dart hits — only respond when active
    this.dartBoard.onDartLanded((hit: DartHit) => {
      if (this.isPlaying) this.handleDart(hit);
    });
  }

  /** Called by lobby when entering this game */
  public start() {
    this.isPlaying = true;
    this.score = 0;
    if (this.statusText) this.statusText.text = "Game started!";
    print("[MyGame] Started");
  }

  /** Called by lobby when leaving this game */
  public stop() {
    this.isPlaying = false;
    print("[MyGame] Stopped");
  }

  public reset() {
    this.score = 0;
    if (this.statusText) this.statusText.text = "Reset!";
  }

  private handleDart(hit: DartHit) {
    // hit.gridX, hit.gridY → 0-1 normalized board position
    // hit.zone → "Single 20", "Double 11", "Bullseye", etc.
    // hit.cell → 0-8 grid cell, or -1 if outside

    if (hit.zone.includes("Bullseye")) {
      this.score += 50;
    } else if (hit.zone.includes("Triple")) {
      this.score += 30;
    } else {
      this.score += 10;
    }

    if (this.statusText) this.statusText.text = "Score: " + this.score;
    print("[MyGame] Hit: " + hit.zone);
  }
}
```

### Step 2 — Add scene objects in Lens Studio

1. Create a container `SceneObject` named `MyNewGameContainer` (set it disabled)
2. Add your `MyNewGame.ts` as a Script Component on it
3. Drag `DartBoard` into the script's `dartBoard` input
4. Add a Text component for status, drag it into `statusText`
5. Add any visual prefabs your game needs as children of the container

### Step 3 — Wire it up to the lobby

In `BullsAILobby.ts`, add:

```typescript
@input @allowUndefined myNewGameContainer: SceneObject;
@input @allowUndefined myNewGameScript: any;
@input myNewGameButton: SceneObject;  // button in Play submenu
```

Hook the button:

```typescript
this.hookButton(this.myNewGameButton, () => this.launchMyNewGame());
```

Add the launch method:

```typescript
private launchMyNewGame() {
  this.showScreen('none');
  this.hidePanel();
  if (this.myNewGameContainer) this.myNewGameContainer.enabled = true;
  this.dartBoard.clearMarkers();
  if (this.myNewGameScript && this.myNewGameScript.start) {
    this.myNewGameScript.start();
  }
}
```

Add to `showScreen`'s cleanup:

```typescript
if (this.myNewGameScript && this.myNewGameScript.stop) this.myNewGameScript.stop();
if (this.myNewGameContainer) this.myNewGameContainer.enabled = false;
```

### Step 4 — Add a Back button

Drop a Back button inside your container, hook it to `() => this.showScreen('menu')`.

### Step 5 — Test

Send to Spectacles, join a game, pick your new game from the Play menu. Throw darts. Done.

### Useful APIs from DartBoard

```typescript
dartBoard.onDartLanded(callback)          // register hit listener
dartBoard.spawnAtPosition(gridX, gridY, prefab)   // spawn at exact spot
dartBoard.spawnAtCell(cellIndex, prefab)          // spawn in 3x3 grid cell
dartBoard.clearMarkers()                  // remove all spawned objects
dartBoard.setStatus(message)              // update status text
dartBoard.boardSize                       // disc size in scene units
dartBoard.boardDisc                       // the spatial anchor SceneObject
```

---

## What's next

- ElevenLabs voice coaching layer
- Form analysis using Spectacles forward camera (analyse the throw motion, not just the landing)
- LLM-powered personalized coaching that learns your weak zones
- More games — Battleships, Zombie Shooter, Around the World
- Tournament mode with proper Player 1 / Player 2 turn-locking
- Safety warning using Spectacles depth sensing

---

## Built by

[ohistudio](https://github.com/ohistudio) for **XRCC 2026** — Snap Spectacles Tech Layer × Training: Kill The Manual track.

## License

MIT — see [LICENSE](LICENSE) for details.

Mascot, custom fonts and bespoke assets in `assets/` are © ohistudio. Code is free to fork and remix.
