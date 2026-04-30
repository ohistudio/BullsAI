/**
 * BullsAILobby.ts — UIKit lobby for BullsAI
 * 
 * Flow:
 *   Screen 1: MAIN MENU
 *     [LEARN]    [PLAY]    [FREE THROW]
 *
 *   Screen 2: LOBBY (for multiplayer games)
 *     [Create Game]   [Join Game]
 *     [__code input__]
 *     "Game: ABCD — Waiting..."
 *
 *   Screen 3: GAME (shows active game container)
 *
 * Free Throw mode skips lobby — just shows where darts land.
 *
 * Setup:
 *   1. Install SpectaclesUIKit from Asset Library
 *   2. Attach to UI root SceneObject
 *   3. Create buttons as SUIK RectangleButton prefabs
 *   4. Create text input as SUIK TextInputField prefab
 *   5. Wire up references in Inspector
 */

import { TextInputField } from 'SpectaclesUIKit.lspkg/Scripts/Components/TextInputField/TextInputField';
import { RectangleButton } from 'SpectaclesUIKit.lspkg/Scripts/Components/Button/RectangleButton';
import { Interactable } from 'SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable';
import { DartBoard } from "./DartBoard";

@component
export class BullsAILobby extends BaseScriptComponent {

  @ui.group_start("Core")
  @input dartBoard: DartBoard;
  @input @allowUndefined uiPanel: SceneObject;
  @input @allowUndefined slimeFace: SceneObject;
  @ui.group_end

  @ui.group_start("Screens")
  @input mainMenuScreen: SceneObject;
  @input lobbyScreen: SceneObject;
  @input learnMenuScreen: SceneObject;
  @input playMenuScreen: SceneObject;
  @ui.group_end

  @ui.group_start("Main Menu Buttons")
  @input learnButton: SceneObject;
  @input playButton: SceneObject;
  @input freeThrowButton: SceneObject;
  @ui.group_end

  @ui.group_start("Learn Menu Buttons")
  @input learnBoardButton: SceneObject;
  @input learnTechniqueButton: SceneObject;
  @input learnDrillsButton: SceneObject;
  @input learnBackButton: SceneObject;
  @ui.group_end

  @ui.group_start("Play Menu Buttons")
  @input ticTacToeButton: SceneObject;
  @input bubblePopButton: SceneObject;
  @input appleButton: SceneObject;
  @input playBackButton: SceneObject;
  @ui.group_end

  @ui.group_start("Lobby")
  @input joinButton: SceneObject;
  @input backButton: SceneObject;
  @input codeInput: SceneObject;
  @input @allowUndefined statusText: Text;
  @ui.group_end

  @ui.group_start("Game Containers")
  @input @allowUndefined learnContainer: SceneObject;
  @input @allowUndefined dartAssistScript: any;
  @input @allowUndefined ticTacToeContainer: SceneObject;
  @input @allowUndefined ticTacToeScript: any;
  @input @allowUndefined bubblePopContainer: SceneObject;
  @input @allowUndefined bubblePopScript: any;
  @input @allowUndefined appleContainer: SceneObject;
  @input @allowUndefined appleScript: any;
  @input @allowUndefined freeThrowContainer: SceneObject;
  @ui.group_end

  @ui.group_start("In-Game Buttons (each container has back + reset)")
  @input @allowUndefined learnBackInGameButton: SceneObject;
  @input @allowUndefined learnResetButton: SceneObject;
  @input @allowUndefined ticTacToeBackButton: SceneObject;
  @input @allowUndefined ticTacToeResetButton: SceneObject;
  @input @allowUndefined bubblePopBackButton: SceneObject;
  @input @allowUndefined bubblePopResetButton: SceneObject;
  @input @allowUndefined appleBackButton: SceneObject;
  @input @allowUndefined appleResetButton: SceneObject;
  @input @allowUndefined freeThrowBackButton: SceneObject;
  @input @allowUndefined freeThrowResetButton: SceneObject;
  @ui.group_end

  @ui.group_start("Free Throw")
  @input @allowUndefined dartMarkerPrefab: ObjectPrefab;
  @input @allowUndefined freeThrowText: Text;
  @ui.group_end

  private textInput: TextInputField = null;
  private pendingMode: string = '';
  private throwCount: number = 0;
  private dartMarkers: SceneObject[] = [];

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
  }

  onStart() {
    this.showScreen('lobby');
    this.showFace();
    this.setStatus('Enter game code from phone');

    // ─── Lobby (shown first) ───
    if (this.codeInput) {
      this.textInput = this.codeInput.getComponent(
        TextInputField.getTypeName()
      ) as TextInputField;
    }

    this.hookButton(this.joinButton, () => {
      let code = '';
      if (this.textInput) code = this.textInput.text.trim().toUpperCase();
      if (code.length < 2) {
        this.setStatus('Enter a game code!');
        return;
      }
      this.setStatus('Joining: ' + code + '...');
      this.dartBoard.joinGame(code);

      // DartBoard handles find + retry. Wait briefly then show menu if game found.
      const evt = this.createEvent("DelayedCallbackEvent");
      evt.bind(() => {
        if (this.dartBoard.gameFound) {
          this.setStatus('Connected: ' + code + '\nPick a mode');
          this.showScreen('menu');
        } else {
          this.setStatus('Game not found!\nCheck code on phone');
        }
      });
      evt.reset(1.5);
    });

    // ─── Main Menu ───
    this.hookButton(this.learnButton, () => {
      this.showScreen('learnMenu');
      this.setStatus('LEARN\nPick a topic');
    });

    this.hookButton(this.playButton, () => {
      this.showScreen('playMenu');
      this.setStatus('PLAY\nPick a game');
    });

    this.hookButton(this.freeThrowButton, () => {
      print('[Lobby] Free Throw button pressed!');
      this.pendingMode = 'free';
      this.startFreeThrow();
    });

    // ─── Learn Submenu ───
    this.hookButton(this.learnBoardButton, () => {
      this.pendingMode = 'learn_board';
      this.launchLearn('learn_board');
    });

    this.hookButton(this.learnTechniqueButton, () => {
      this.pendingMode = 'learn_technique';
      this.launchLearn('learn_technique');
    });

    this.hookButton(this.learnDrillsButton, () => {
      this.pendingMode = 'drill';
      this.launchLearn('drill');
    });

    this.hookButton(this.learnBackButton, () => this.showScreen('menu'));

    // ─── Play Submenu ───
    this.hookButton(this.ticTacToeButton, () => this.launchTicTacToe());
    this.hookButton(this.bubblePopButton, () => this.launchBubblePop());
    this.hookButton(this.appleButton, () => this.launchApple());
    this.hookButton(this.playBackButton, () => this.showScreen('menu'));

    // ─── In-Game Back Buttons (all go to main menu) ───
    this.hookButton(this.learnBackInGameButton, () => { this.showPanel(); this.showScreen('menu'); });
    this.hookButton(this.ticTacToeBackButton, () => { this.showPanel(); this.showScreen('menu'); });
    this.hookButton(this.bubblePopBackButton, () => { this.showPanel(); this.showScreen('menu'); });
    this.hookButton(this.appleBackButton, () => { this.showPanel(); this.showScreen('menu'); });
    this.hookButton(this.freeThrowBackButton, () => { this.showPanel(); this.showScreen('menu'); });

    // ─── In-Game Reset Buttons ───
    this.hookButton(this.learnResetButton, () => {
      if (this.dartAssistScript && this.dartAssistScript.resetSession) {
        this.dartAssistScript.resetSession();
      }
    });
    this.hookButton(this.ticTacToeResetButton, () => {
      if (this.ticTacToeScript && this.ticTacToeScript.resetGame) {
        this.ticTacToeScript.resetGame();
      }
      this.dartBoard.clearMarkers();
    });
    this.hookButton(this.bubblePopResetButton, () => {
      if (this.bubblePopScript && this.bubblePopScript.reset) this.bubblePopScript.reset();
    });
    this.hookButton(this.appleResetButton, () => {
      if (this.appleScript && this.appleScript.reset) this.appleScript.reset();
    });
    this.hookButton(this.freeThrowResetButton, () => {
      // Clear markers and counter
      for (const m of this.dartMarkers) { if (m) m.destroy(); }
      this.dartMarkers = [];
      this.throwCount = 0;
      if (this.freeThrowText) this.freeThrowText.text = 'FREE THROW\nThrow anywhere!';
      this.dartBoard.clearMarkers();
    });

    // ─── Free Throw: listen for darts ───
    this.dartBoard.onDartLanded((hit) => {
      if (this.pendingMode === 'free') {
        this.onFreeThrowHit(hit);
      }
    });

    print('[Lobby] BullsAI ready!');
  }

  // ─── Screen Management ───

  private showScreen(screen: string) {
    if (this.mainMenuScreen) this.mainMenuScreen.enabled = (screen === 'menu');
    if (this.lobbyScreen) this.lobbyScreen.enabled = (screen === 'lobby');
    if (this.learnMenuScreen) this.learnMenuScreen.enabled = (screen === 'learnMenu');
    if (this.playMenuScreen) this.playMenuScreen.enabled = (screen === 'playMenu');

    // Stop any active games so they stop responding to dart hits
    this.pendingMode = '';
    if (this.dartAssistScript && this.dartAssistScript.stop) this.dartAssistScript.stop();
    if (this.ticTacToeScript && this.ticTacToeScript.stop) this.ticTacToeScript.stop();
    if (this.bubblePopScript && this.bubblePopScript.stop) this.bubblePopScript.stop();
    if (this.appleScript && this.appleScript.stop) this.appleScript.stop();

    // Hide all game containers
    if (this.learnContainer) this.learnContainer.enabled = false;
    if (this.ticTacToeContainer) this.ticTacToeContainer.enabled = false;
    if (this.bubblePopContainer) this.bubblePopContainer.enabled = false;
    if (this.appleContainer) this.appleContainer.enabled = false;
    if (this.freeThrowContainer) this.freeThrowContainer.enabled = false;
  }

  // ─── Game Launch ───

  private launchLearn(phase: string) {
    this.showScreen('none');
    this.hidePanel();
    if (this.learnContainer) this.learnContainer.enabled = true;
    if (this.dartAssistScript && this.dartAssistScript.setPhase) {
      this.dartAssistScript.setPhase(phase);
    }
    print('[Lobby] Launched Learn: ' + phase);
  }

  private launchTicTacToe() {
    this.showScreen('none');
    this.hidePanel();
    if (this.ticTacToeContainer) this.ticTacToeContainer.enabled = true;
    this.dartBoard.clearMarkers();
    if (this.ticTacToeScript && this.ticTacToeScript.start) {
      this.ticTacToeScript.start();
    }
    print('[Lobby] Launched Tic Tac Toe');
  }

  private launchBubblePop() {
    this.showScreen('none');
    this.hidePanel();
    if (this.bubblePopContainer) this.bubblePopContainer.enabled = true;
    this.dartBoard.clearMarkers();
    if (this.bubblePopScript && this.bubblePopScript.start) {
      this.bubblePopScript.start();
    }
    print('[Lobby] Launched Bubble Pop');
  }

  private launchApple() {
    this.showScreen('none');
    this.hidePanel();
    if (this.appleContainer) this.appleContainer.enabled = true;
    this.dartBoard.clearMarkers();
    if (this.appleScript && this.appleScript.start) {
      this.appleScript.start();
    }
    print('[Lobby] Launched Apple on Head');
  }

  private launchMode() {
    this.showScreen('none');
  }

  private hidePanel() {
    if (this.uiPanel) this.uiPanel.enabled = false;
    this.hideFace();
  }

  private showPanel() {
    if (this.uiPanel) this.uiPanel.enabled = true;
    this.showFace();
  }

  private showFace() {
    if (this.slimeFace) this.slimeFace.enabled = true;
  }

  private hideFace() {
    if (this.slimeFace) this.slimeFace.enabled = false;
  }

  // ─── Free Throw Mode ───

  private startFreeThrow() {
    this.showScreen('none');
    this.hidePanel();
    if (this.freeThrowContainer) this.freeThrowContainer.enabled = true;

    // Clear old markers
    for (const m of this.dartMarkers) { if (m) m.destroy(); }
    this.dartMarkers = [];
    this.throwCount = 0;

    if (this.freeThrowText) this.freeThrowText.text = 'FREE THROW\nThrow anywhere!';
    print('[Lobby] Free Throw started');
  }

  private onFreeThrowHit(hit: any) {
    this.throwCount++;

    // Spawn marker at hit position
    if (this.dartMarkerPrefab) {
      const marker = this.dartBoard.spawnAtPosition(hit.gridX, hit.gridY, this.dartMarkerPrefab);
      if (marker) this.dartMarkers.push(marker);
    }

    // Show zone info
    if (this.freeThrowText) {
      this.freeThrowText.text = hit.zone + '\nThrows: ' + this.throwCount;
    }

    print('[Free] #' + this.throwCount + ' ' + hit.zone);
  }

  // ─── Helpers ───

  private hookButton(obj: SceneObject, callback: () => void) {
    if (!obj) return;
    const delayed = this.createEvent("DelayedCallbackEvent");
    delayed.bind(() => {
      // Try UIKit RectangleButton first
      const rectBtn = obj.getComponent(RectangleButton.getTypeName()) as RectangleButton;
      if (rectBtn) {
        (rectBtn as any).onTriggerDown.add(callback);
        print('[Lobby] Hooked RectangleButton: ' + obj.name);
        return;
      }

      // Fall back to SIK Interactable
      const interactable = this.findInteractable(obj);
      if (interactable) {
        interactable.onTriggerEnd.add(callback);
        print('[Lobby] Hooked Interactable: ' + obj.name);
        return;
      }

      print('[Lobby] WARN: No button found on ' + obj.name);
    });
    delayed.reset(0.5);
  }

  private findInteractable(obj: SceneObject): Interactable {
    const direct = obj.getComponent(Interactable.getTypeName()) as Interactable;
    if (direct) return direct;
    for (let i = 0; i < obj.getChildrenCount(); i++) {
      const found = this.findInteractable(obj.getChild(i));
      if (found) return found;
    }
    return null;
  }

  private setStatus(msg: string) {
    print('[Lobby] ' + msg);
    if (this.statusText) this.statusText.text = msg;
  }
}