# CLAUDE.md

Guidance for Claude (and other AI assistants) when working on BullsAI.

## Project at a glance

BullsAI is an AR coaching and gaming platform for darts, built for the **XRCC 2026 Hackathon**. It pairs:

- A **phone webapp** (`web/darts.html`) that watches a dartboard with the camera and detects darts via OpenCV.js
- A **Snap Spectacles app** (`spectacles/`) written in TypeScript on Lens Studio 5 that displays AR coaching, target highlights, and games
- A **Supabase backend** (Snap Cloud) that bridges the two

The phone is the input device. Spectacles is the display. Phone is dumb (no game logic). Spectacles holds all the games.

## Repo layout

```
BullsAI/
├── web/                          # Phone webapp
│   ├── darts.html                # Single-file HTML/JS/CSS app
│   ├── config.js                 # Supabase credentials (gitignored)
│   ├── config.example.js         # Placeholder template
│   └── assets/                   # Mascot, font, dart marker
└── spectacles/darts/             # Lens Studio project
    └── Assets/                   # All TypeScript scripts live here
        ├── DartBoard.ts
        ├── BullsAILobby.ts
        ├── DartAssist.ts
        ├── TicTacToeGame.ts
        ├── BubblePopGame.ts
        ├── AppleOnHeadGame.ts
        ├── SlimeFace.ts
        └── ThrowDetector.ts
```

## Architecture rules

- **DartBoard.ts is the single source of truth for darts.** Every game registers a callback via `dartBoard.onDartLanded(cb)` and reacts to the `DartHit` it receives.
- **Phone never decides game logic.** It detects darts, scores zones, writes to `dart_throws` Supabase table. That's it.
- **Each game has `start()` and `stop()` methods** plus an `isPlaying` flag that gates dart handling. Without this, leaving Tic Tac Toe doesn't actually stop it from placing X's during Bubble Pop.
- **BullsAILobby.ts is the menu router.** It enables/disables game containers, calls start/stop, hides UI panel and slime face when entering games.
- **Adding a new game = one new TypeScript file + a button.** The pipeline is the hard part; games are easy.

## Common code patterns

### Adding a new game

```typescript
import { DartBoard, DartHit } from "./DartBoard";

@component
export class MyGame extends BaseScriptComponent {
  @input dartBoard: DartBoard;
  private isPlaying: boolean = false;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
  }

  onStart() {
    this.dartBoard.onDartLanded((hit: DartHit) => {
      if (this.isPlaying) this.handleDart(hit);
    });
  }

  public start() { this.isPlaying = true; /* reset state */ }
  public stop()  { this.isPlaying = false; /* clean up scene */ }

  private handleDart(hit: DartHit) {
    // hit.gridX, hit.gridY → 0-1 normalized board position
    // hit.zone → "Single 20", "Double 11", "Bullseye", "Miss", etc.
    // hit.cell → 0-8 grid cell, or -1 if outside
  }
}
```

### Spawning prefabs on the board

```typescript
// At normalized position (0-1)
this.dartBoard.spawnAtPosition(gridX, gridY, prefab);

// At a 3x3 grid cell (0-8)
this.dartBoard.spawnAtCell(cell, prefab);

// Clear all spawned objects
this.dartBoard.clearMarkers();
```

## Computer vision notes (phone)

- **HSV detection** — uses Hue/Saturation thresholds. Yellow tape on darts = `H 15-45, S 80+`.
- **Board mask** — red+green channels combined, ellipse-fitted to find centre and orientation.
- **4-dart calibration** — the player places darts at Double 20, 6, 3, 11. Yellow tape positions form 4 known points, gives a perfect perspective transform from any camera angle. After calibration, raw tape position goes through the matrix unchanged (no tip-offset correction needed because calibration learned from tape positions directly).
- **Auto detection** runs every 200ms. Sends a new dart to Supabase only when position has moved more than 4% of board from last sent position. No time-based resending.
- **`runDetection()`** returns `{cell, zone, reason}` where zone is `"Single 20,0.42,0.31"` (zone, gridX, gridY).

## Supabase schema

```sql
dart_games:    id, code, board[9], current_player, winner, status, created_at, updated_at
dart_throws:   id, game_id, player, trigger_type, cell, zone, status, created_at
```

Phone writes throws as `status='done'`. Spectacles polls every 300ms via DartBoard.

## Don't break these

- **The 4-dart calibration math** — went through many iterations to land on this. Tip offset is only applied when NOT calibrated. Don't change the order: srcPts = [D20, D6, D3, D11], dstPts = [(100,0), (200,100), (100,200), (0,100)].
- **The dedup logic in autoDetectAndSend** — must be position-only (no time-based resending) or it spams duplicate darts.
- **DartAssist's `getZonePosition()` and drift analysis** — the smart feedback uses pixel drift to give technique advice. Don't simplify.
- **start()/stop() pattern** — every game must implement both. Without stop(), the previous game keeps reacting to dart hits.
- **No emojis in user-facing strings** — design choice. Keep it clean.

## Style preferences

- **Concise, no waffle.** When the user asks "fix X", fix X. Don't explain everything that's possibly relevant.
- **No bullet-point dumps** unless the user wants a list.
- **No corporate writing.** "Pulled hard right — relax your grip" not "Your throw exhibited a rightward deviation pattern."
- **Brand colours**: purple `#C09BFF`, orange `#F18B5C`, yellow `#F0DB7A`. SuperFortrees font for big headings, DM Sans for body, Space Mono for code/codes/badges.

## Current state of the project

Submitted to XRCC 2026 on April 30, 2026. Phone webapp deployed via GitHub Pages at `https://ohistudio.github.io/BullsAI/web/darts.html`. All games working. Multiplayer is "view only" — multiple Spectacles see the same darts but each runs its own game state, no proper Player 1 / Player 2 turn-locking yet.

## Useful entry points by task

| Task | Start here |
|------|-----------|
| Improve dart detection | `web/darts.html` → `runDetection()` |
| Add new coaching feedback | `spectacles/darts/Assets/DartAssist.ts` → `getFeedback()` |
| New game mode | New script in `spectacles/darts/Assets/` + wire in `BullsAILobby.ts` |
| UI/menu changes | `BullsAILobby.ts` and Lens Studio scene |
| Slime face reactions | `SlimeFace.ts` → has `surprise()`, `sad()`, `angry()`, `dartHitReaction(zone)` |
| Calibration tweaks | `web/darts.html` → `detectCalibrationDart()` and around line 565 |

## Things people commonly want to add

- **Voice coaching (ElevenLabs)** — would go in `DartAssist.ts`, hook into `getFeedback()` to also play audio
- **Form analysis** — Spectacles forward camera + ML model to grade throw motion
- **More games** — Battleships, Around the World, Zombies. Use the template above.
- **Real multiplayer with turns** — needs role assignment in BullsAILobby (first to join = P1, second = P2), each Spectacles only acts when `currentPlayer === myPlayer`.
- **Sound design** — `BubblePopGame` already has audio inputs (popSound, missSound, etc.) but most games don't yet.

## Hackathon context

- **Track**: Snap Spectacles Tech Layer × Training: Kill The Manual
- **Side quests**: Best Trailer, Most Viral, Community Voting
- **Trailer**: https://www.youtube.com/watch?v=wr63v62yR7k
- **Submission**: April 30, 2026
