/**
 * TicTacToeGame.ts — Tic Tac Toe using DartBoard
 * 
 * Setup:
 *   1. Attach to same SceneObject or sibling of DartBoard
 *   2. Assign DartBoard reference, X/O prefabs
 *   3. DartBoard handles detection, this handles game rules
 */

import { DartBoard, DartHit } from "./DartBoard";

const WINS = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];

@component
export class TicTacToeGame extends BaseScriptComponent {

  @input dartBoard: DartBoard;
  @input xPrefab: ObjectPrefab;
  @input oPrefab: ObjectPrefab;
  @input @allowUndefined turnText: Text;

  private board: number[] = [0,0,0,0,0,0,0,0,0];
  private cellMarkers: SceneObject[] = [];
  private currentPlayer: number = 1;
  private winner: number = 0;
  private gameActive: boolean = false;
  private isPlaying: boolean = false;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
  }

  onStart() {
    if (!this.dartBoard) {
      print("[TTT] ERROR: Assign DartBoard!");
      return;
    }

    for (let i = 0; i < 9; i++) this.cellMarkers.push(null);

    // Listen for dart hits — only respond when active
    this.dartBoard.onDartLanded((hit: DartHit) => {
      if (this.isPlaying) this.onDartHit(hit);
    });

    print("[TTT] Tic Tac Toe ready (waiting for start)");
  }

  /** Called by lobby when entering Tic Tac Toe */
  public start() {
    this.isPlaying = true;
    this.resetGame();
    print("[TTT] Started");
  }

  /** Called by lobby when leaving Tic Tac Toe */
  public stop() {
    this.isPlaying = false;
    // Clean up markers so they don't linger on the next mode
    for (let i = 0; i < 9; i++) {
      if (this.cellMarkers[i]) {
        this.cellMarkers[i].destroy();
        this.cellMarkers[i] = null;
      }
    }
    this.board = [0,0,0,0,0,0,0,0,0];
    this.gameActive = false;
    print("[TTT] Stopped");
  }

  private onDartHit(hit: DartHit) {
    if (!this.gameActive) return;

    const cell = hit.cell;

    // Check valid cell
    if (cell < 0 || cell >= 9) {
      this.dartBoard.setStatus("Off the grid! Try again.");
      return;
    }

    // Check if cell is already yours
    if (this.board[cell] === this.currentPlayer) {
      this.dartBoard.setStatus("Already yours! Try again.");
      return;
    }

    // Takeover: destroy opponent's marker if present
    const existingMarker = this.cellMarkers[cell];
    const wasTakeover = existingMarker !== null && existingMarker !== undefined;

    if (wasTakeover) {
      print("[TTT] Takeover at cell " + cell + " — destroying old marker");
      try {
        existingMarker.destroy();
      } catch(e) {
        print("[TTT] Destroy error: " + e);
      }
      this.cellMarkers[cell] = null;
    }

    // Place new marker
    this.board[cell] = this.currentPlayer;
    const prefab = this.currentPlayer === 1 ? this.xPrefab : this.oPrefab;
    const marker = this.dartBoard.spawnAtCell(cell, prefab);
    this.cellMarkers[cell] = marker;

    const mark = this.currentPlayer === 1 ? "X" : "O";
    print("[TTT] " + mark + " placed at cell " + cell + (wasTakeover ? " (TAKEOVER!)" : ""));

    if (wasTakeover) {
      this.dartBoard.setStatus("Takeover! " + mark + " on cell " + cell);
    }

    // Check win
    this.winner = this.checkWin();
    if (this.winner > 0) {
      this.gameActive = false;
      const winMark = this.winner === 1 ? "X" : "O";
      this.dartBoard.setStatus("" + winMark + " WINS! ");
      print("[TTT] " + winMark + " wins!");
      this.updateSupabase();
      this.scheduleReset(4.0);
      return;
    }

    // Check draw
    if (this.board.every(c => c !== 0)) {
      this.gameActive = false;
      this.dartBoard.setStatus("DRAW!");
      print("[TTT] Draw!");
      this.updateSupabase();
      this.scheduleReset(3.0);
      return;
    }

    // Next player
    this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;
    this.setTurn();
    this.updateSupabase();
  }

  private checkWin(): number {
    for (const [a, b, c] of WINS) {
      if (this.board[a] && this.board[a] === this.board[b] && this.board[a] === this.board[c]) {
        return this.board[a];
      }
    }
    return 0;
  }

  private setTurn() {
    const mark = this.currentPlayer === 1 ? "X" : "O";
    this.dartBoard.setStatus(mark + "'s turn — throw!");
    if (this.turnText) {
      this.turnText.text = mark + "'s TURN";
    }
  }

  private async updateSupabase() {
    const w = this.checkWin();
    await this.dartBoard.updateGame({
      board: this.board,
      current_player: this.currentPlayer,
      winner: w || 0,
      status: w || this.board.every(c => c !== 0) ? 'finished' : 'playing',
      updated_at: new Date().toISOString()
    });
  }

  /** Reset the game for a new round */
  public resetGame() {
    this.board = [0,0,0,0,0,0,0,0,0];
    this.currentPlayer = 1;
    this.winner = 0;
    this.gameActive = true;

    for (let i = 0; i < 9; i++) {
      if (this.cellMarkers[i]) {
        this.cellMarkers[i].destroy();
        this.cellMarkers[i] = null;
      }
    }

    this.setTurn();
    this.updateSupabase();
    print("[TTT] Game reset!");
  }

  private scheduleReset(delay: number) {
    const evt = this.createEvent("DelayedCallbackEvent");
    evt.bind(() => {
      print("[TTT] Auto-reset after " + delay + "s");
      this.resetGame();
    });
    evt.reset(delay);
  }
}