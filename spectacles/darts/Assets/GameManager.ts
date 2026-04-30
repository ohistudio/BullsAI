/**
 * GameManager.ts — Nested menu system
 * 
 * Menu structure:
 *   Main Menu
 *     ├── LEARN → LearnMenu
 *     │     ├── Learn the Board
 *     │     ├── Technique
 *     │     ├── Drills
 *     │     ├── Free Play
 *     │     └── Back
 *     └── PLAY → PlayMenu
 *           ├── Tic Tac Toe
 *           ├── (future games)
 *           └── Back
 * 
 * Setup:
 *   Each menu/game is a container SceneObject that gets shown/hidden.
 *   Wire button Interactables to the public methods below.
 * 
 * Scene hierarchy:
 *   GameRoot
 *     ├── DartBoard.ts
 *     ├── GameManager.ts
 *     ├── MainMenuContainer
 *     │     ├── Title "DARTSENSE AR"
 *     │     ├── LearnBtn → GameManager.showLearnMenu()
 *     │     └── PlayBtn → GameManager.showPlayMenu()
 *     ├── LearnMenuContainer
 *     │     ├── Title "LEARN"
 *     │     ├── BoardBtn → GameManager.startLearnBoard()
 *     │     ├── TechniqueBtn → GameManager.startTechnique()
 *     │     ├── DrillsBtn → GameManager.startDrills()
 *     │     ├── FreePlayBtn → GameManager.startFreePlay()
 *     │     └── BackBtn → GameManager.showMainMenu()
 *     ├── PlayMenuContainer
 *     │     ├── Title "PLAY"
 *     │     ├── TicTacToeBtn → GameManager.startTicTacToe()
 *     │     ├── (future game buttons)
 *     │     └── BackBtn → GameManager.showMainMenu()
 *     ├── DartAssistContainer (DartAssist.ts lives here)
 *     └── TicTacToeContainer (TicTacToeGame.ts lives here)
 */

import { DartBoard } from "./DartBoard";
import { DartAssist } from "./DartAssist";

@component
export class GameManager extends BaseScriptComponent {

  @input dartBoard: DartBoard;

  @ui.group_start("Menus")
  @input mainMenuContainer: SceneObject;
  @input learnMenuContainer: SceneObject;
  @input playMenuContainer: SceneObject;
  @ui.group_end

  @ui.group_start("Learn Modes")
  @input @allowUndefined dartAssistContainer: SceneObject;
  @input @allowUndefined dartAssistScript: DartAssist;
  @ui.group_end

  @ui.group_start("Play Modes")
  @input @allowUndefined ticTacToeContainer: SceneObject;
  // @input @allowUndefined battleshipsContainer: SceneObject;
  // @input @allowUndefined piercingContainer: SceneObject;
  // @input @allowUndefined appleContainer: SceneObject;
  // @input @allowUndefined zombieContainer: SceneObject;
  @ui.group_end

  private activeContainer: SceneObject = null;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
  }

  onStart() {
    this.showMainMenu();
    print("[GM] Game Manager ready");
  }

  // ─── Menus ───

  public showMainMenu() {
    this.hideAll();
    if (this.mainMenuContainer) this.mainMenuContainer.enabled = true;
    if (this.dartBoard) this.dartBoard.setStatus("DartSense AR");
    print("[GM] Main Menu");
  }

  public showLearnMenu() {
    this.hideAll();
    if (this.learnMenuContainer) this.learnMenuContainer.enabled = true;
    if (this.dartBoard) this.dartBoard.setStatus("Learn");
    print("[GM] Learn Menu");
  }

  public showPlayMenu() {
    this.hideAll();
    if (this.playMenuContainer) this.playMenuContainer.enabled = true;
    if (this.dartBoard) this.dartBoard.setStatus("Play");
    print("[GM] Play Menu");
  }

  // ─── Learn Modes ───

  public startLearnBoard() {
    this.launchMode(this.dartAssistContainer, "Learn the Board", 'learn_board');
  }

  public startTechnique() {
    this.launchMode(this.dartAssistContainer, "Technique", 'learn_technique');
  }

  public startDrills() {
    this.launchMode(this.dartAssistContainer, "Drills", 'drill');
  }

  public startFreePlay() {
    this.launchMode(this.dartAssistContainer, "Free Play", 'free');
  }

  // ─── Play Modes ───

  public startTicTacToe() {
    this.launchMode(this.ticTacToeContainer, "Tic Tac Toe");
  }

  // Future:
  // public startBattleships() { this.launchMode(this.battleshipsContainer, "Battleships"); }
  // public startPiercing() { this.launchMode(this.piercingContainer, "Piercing Shop"); }
  // public startApple() { this.launchMode(this.appleContainer, "Apple on Head"); }
  // public startZombies() { this.launchMode(this.zombieContainer, "Zombie Shooter"); }

  // ─── Back ───

  public backToMainMenu() {
    this.showMainMenu();
  }

  public backToLearnMenu() {
    this.showLearnMenu();
  }

  public backToPlayMenu() {
    this.showPlayMenu();
  }

  // ─── Internal ───

  private launchMode(container: SceneObject, name: string, subMode?: string) {
    if (!container) {
      print("[GM] ERROR: " + name + " container not assigned!");
      return;
    }

    this.hideAll();
    container.enabled = true;
    this.activeContainer = container;

    // If launching a DartAssist mode, set the phase
    if (subMode && this.dartAssistScript) {
      this.dartAssistScript.setPhase(subMode);
    }

    if (this.dartBoard) this.dartBoard.setStatus(name);
    print("[GM] Launched: " + name);
  }

  private hideAll() {
    const containers = [
      this.mainMenuContainer,
      this.learnMenuContainer,
      this.playMenuContainer,
      this.dartAssistContainer,
      this.ticTacToeContainer,
      // this.battleshipsContainer,
      // this.piercingContainer,
      // this.appleContainer,
      // this.zombieContainer,
    ];
    for (const c of containers) {
      if (c) c.enabled = false;
    }
    this.activeContainer = null;
  }
}