/**
 * DartBoard.ts — Core dart detection and display
 * 
 * Handles:
 *   - Supabase connection and polling
 *   - Finding/joining games
 *   - Detecting new throws (polls dart_throws)
 *   - Spawning markers at dart positions or grid cells
 *   - Grid creation on board disc
 * 
 * Game scripts (TicTacToe, Battleships, etc.) reference this
 * and read dart events from it.
 */

import {
  createClient,
  SupabaseClient,
} from 'SupabaseClient.lspkg/supabase-snapcloud';

export interface DartHit {
  cell: number;       // 0-8 grid cell (-1 if outside grid)
  gridX: number;      // 0-1 normalized X position
  gridY: number;      // 0-1 normalized Y position
  zone: string;       // "Single 20", "Double 11", etc
  player: number;     // 1 or 2
  throwId: string;    // Supabase throw ID
}

@component
export class DartBoard extends BaseScriptComponent {

  @ui.group_start("Supabase")
  @input supabaseProject: SupabaseProject;
  @input gameCode: string = '';
  @ui.group_end

  @ui.group_start("Board")
  @input boardDisc: SceneObject;
  @input boardSize: number = 25;
  @input markerScale: number = 3.0;
  @input dartMarkerPrefab: ObjectPrefab;
  @ui.group_end

  @ui.group_start("Polling")
  @input pollInterval: number = 0.3;
  @ui.group_end

  @ui.group_start("UI")
  @input @allowUndefined statusText: Text;
  @ui.group_end

  // Public state — games read these
  public client: SupabaseClient;
  public gameId: string = '';
  public gameFound: boolean = false;
  public cells: SceneObject[] = [];
  public currentPlayer: number = 1;
  public lastHit: DartHit = null;

  // Callbacks — games register here
  private dartCallbacks: ((hit: DartHit) => void)[] = [];

  // Internal
  private pollTimer: number = 0;
  private isPolling: boolean = false;
  private lastProcessedThrowId: string = '';
  private dartMarkers: SceneObject[] = [];

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  async onStart() {
    if (!this.supabaseProject) { this.log("ERROR: Assign Supabase Project!"); return; }
    if (!this.boardDisc) { this.log("ERROR: Assign board disc!"); return; }

    this.createGrid();

    this.client = createClient(this.supabaseProject.url, this.supabaseProject.publicToken, {});
    if (!this.client) { this.log("ERROR: Supabase client failed!"); return; }

    try {
      await this.client.auth.signInWithIdToken({ provider: 'snapchat', token: '' });
      this.log("Authenticated");
    } catch(e) {
      this.log("Auth skipped: " + e);
    }

    // If a code was set in the Inspector, auto-join
    // Otherwise BullsAILobby will call joinGame(code) when user enters one
    if (this.gameCode && this.gameCode.length >= 2) {
      this.setStatus("Finding game...");
      this.findGame();
    } else {
      this.setStatus("Waiting for game code...");
    }
  }

  /** Public: called by BullsAILobby after user enters code */
  public joinGame(code: string) {
    this.gameCode = code;
    this.gameFound = false;
    this.setStatus("Finding game: " + code);
    this.findGame();
  }

  private onUpdate() {
    if (!this.gameFound || this.isPolling) return;
    this.pollTimer += getDeltaTime();
    if (this.pollTimer >= this.pollInterval) {
      this.pollTimer = 0;
      this.pollForDarts();
    }
  }

  // ─── Public API ───

  /** Register a callback for when a dart lands */
  public onDartLanded(callback: (hit: DartHit) => void) {
    this.dartCallbacks.push(callback);
  }

  /** Send a throw trigger to Supabase */
  public async triggerThrow(player: number) {
    this.log("Throw trigger for player " + player);
    try {
      const { error } = await this.client.from('dart_throws').insert({
        game_id: this.gameId, player: player, trigger_type: 'detect', status: 'pending'
      });
      if (error) this.log("Throw error: " + JSON.stringify(error));
      else this.log("Throw sent!");
    } catch(e) {
      this.log("Throw error: " + e);
    }
  }

  /** Update the game state in Supabase */
  public async updateGame(updates: any) {
    try {
      await this.client.from('dart_games').update(updates).eq('id', this.gameId);
    } catch(e) {
      this.log("Update error: " + e);
    }
  }

  /** Spawn a marker at a grid cell */
  public spawnAtCell(cell: number, prefab: ObjectPrefab): SceneObject {
    if (cell < 0 || cell >= 9 || !this.cells[cell] || !prefab) return null;
    const marker = prefab.instantiate(this.cells[cell]);
    marker.getTransform().setLocalPosition(vec3.zero());
    marker.getTransform().setLocalRotation(quat.quatIdentity());
    marker.getTransform().setLocalScale(new vec3(this.markerScale, this.markerScale, this.markerScale));
    this.dartMarkers.push(marker);
    return marker;
  }

  /** Spawn a marker at a normalized position on the board */
  public spawnAtPosition(nx: number, ny: number, prefab: ObjectPrefab): SceneObject {
    if (!prefab) return null;
    const localX = (nx - 0.5) * this.boardSize;
    const localY = (0.5 - ny) * this.boardSize;
    const marker = prefab.instantiate(this.boardDisc);
    marker.getTransform().setLocalPosition(new vec3(localX, localY, 0.5));
    marker.getTransform().setLocalScale(new vec3(this.markerScale, this.markerScale, this.markerScale));
    this.dartMarkers.push(marker);
    return marker;
  }

  /** Clear all spawned dart markers */
  public clearMarkers() {
    for (const m of this.dartMarkers) {
      if (m) m.destroy();
    }
    this.dartMarkers = [];
  }

  /** Update status text */
  public setStatus(msg: string) {
    this.log(msg);
    if (this.statusText) this.statusText.text = msg;
  }

  // ─── Game Finding ───

  private async findGame() {
    try {
      const { data, error } = await this.client.from('dart_games').select('*')
        .eq('code', this.gameCode).eq('status', 'playing')
        .order('created_at', { ascending: false }).limit(1);

      if (error) { this.setStatus("Error — retrying..."); this.retryFind(); return; }

      if (data && data.length > 0) {
        this.gameId = data[0].id;
        this.currentPlayer = data[0].current_player;
        this.gameFound = true;

        // Clean stale throws
        try {
          await this.client.from('dart_throws')
            .update({ status: 'expired' })
            .eq('game_id', this.gameId)
            .eq('status', 'pending');
        } catch(e) {}

        this.setStatus("Game joined!");
        this.log("Joined: " + this.gameId);
      } else {
        this.setStatus("Game not found — retrying...");
        this.retryFind();
      }
    } catch(e) {
      this.setStatus("Connection error — retrying...");
      this.retryFind();
    }
  }

  private retryFind() {
    const evt = this.createEvent("DelayedCallbackEvent");
    evt.bind(() => this.findGame());
    evt.reset(3.0);
  }

  // ─── Dart Polling ───

  private async pollForDarts() {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      const { data, error } = await this.client.from('dart_throws').select('*')
        .eq('game_id', this.gameId).eq('status', 'done')
        .order('created_at', { ascending: false }).limit(1);

      if (!error && data && data.length > 0 && data[0].id !== this.lastProcessedThrowId) {
        this.lastProcessedThrowId = data[0].id;
        const t = data[0];

        // Handle reset signal — clear all markers and skip
        if (t.trigger_type === 'reset' || (t.zone && t.zone.indexOf('RESET') === 0)) {
          this.log("Reset received — clearing markers");
          this.clearMarkers();
          this.isPolling = false;
          return;
        }

        // Parse position from zone field
        const zone = t.zone || '';
        const parts = zone.split(',');
        let gridX = 0.5, gridY = 0.5;

        if (parts.length >= 3) {
          const px = parseFloat(parts[parts.length - 2]);
          const py = parseFloat(parts[parts.length - 1]);
          if (!isNaN(px) && !isNaN(py)) { gridX = px; gridY = py; }
        } else if (parts.length === 2) {
          const px = parseFloat(parts[0]);
          const py = parseFloat(parts[1]);
          if (!isNaN(px) && !isNaN(py)) { gridX = px; gridY = py; }
        }

        // Extract zone name (everything before the last two comma-separated numbers)
        let zoneName = zone;
        if (parts.length >= 3) {
          zoneName = parts.slice(0, parts.length - 2).join(',');
        }

        const hit: DartHit = {
          cell: t.cell,
          gridX: gridX,
          gridY: gridY,
          zone: zoneName,
          player: t.player,
          throwId: t.id
        };

        this.lastHit = hit;
        this.currentPlayer = t.player === 1 ? 2 : 1;
        this.log("Dart landed: cell=" + hit.cell + " zone=" + hit.zone + " pos(" + gridX.toFixed(3) + "," + gridY.toFixed(3) + ") p=" + hit.player);

        // Auto-spawn marker if prefab assigned on DartBoard (shows in any mode)
        if (this.dartMarkerPrefab) {
          this.spawnAtPosition(gridX, gridY, this.dartMarkerPrefab);
        }

        // Notify all registered game callbacks
        for (const cb of this.dartCallbacks) {
          cb(hit);
        }
      }
    } catch(e) {
      this.log("Poll error: " + e);
    }

    this.isPolling = false;
  }

  // ─── Grid ───

  private createGrid() {
    const cs = this.boardSize / 3;
    const off = this.boardSize / 2 - cs / 2;

    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        const idx = row * 3 + col;
        const cell = global.scene.createSceneObject("Cell_" + idx);
        cell.setParent(this.boardDisc);
        const x = -off + col * cs;
        const y = off - row * cs;
        cell.getTransform().setLocalPosition(new vec3(x, y, 0.5));
        cell.getTransform().setLocalScale(vec3.one());
        this.cells.push(cell);
      }
    }
    this.log("Grid created: 9 cells");
  }

  private log(msg: string) {
    print("[DartBoard] " + msg);
  }
}