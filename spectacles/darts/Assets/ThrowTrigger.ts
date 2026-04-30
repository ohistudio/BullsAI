/**
 * ThrowTrigger.ts — Pinch/tap to trigger throw
 * 
 * Setup:
 *   1. Attach to SIK Interactable on the board
 *   2. Assign DartBoard reference
 *   3. Connect onThrow() to Interactable's onTriggerEnd
 */

import { DartBoard } from "./DartBoard";

@component
export class ThrowTrigger extends BaseScriptComponent {

  @input dartBoard: DartBoard;
  @input throwCooldown: number = 3.0;

  private lastThrowTime: number = 0;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => {
      if (!this.dartBoard) print("[Throw] ERROR: Assign DartBoard!");
      else print("[Throw] Ready");
    });
  }

  onThrow() {
    if (!this.dartBoard || !this.dartBoard.gameFound) return;

    const now = getTime();
    if (now - this.lastThrowTime < this.throwCooldown) return;

    this.lastThrowTime = now;
    print("[Throw] THROW! Player " + this.dartBoard.currentPlayer);
    this.dartBoard.triggerThrow(this.dartBoard.currentPlayer);
  }
}