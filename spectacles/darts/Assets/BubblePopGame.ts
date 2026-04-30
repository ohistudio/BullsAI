/**
 * BubblePopGame.ts — Cluster pop game
 * 
 * 12-20 bubbles spawn in clusters around the dartboard. Hit a matching color
 * bubble — it AND all touching same-color bubbles in the cluster fall.
 * Goal: clear all bubbles in fewest darts.
 * 
 * Dart color is only chosen from colors that still exist on the board.
 * 
 * Setup:
 *   1. Create 3 bubble prefabs (red/green/blue)
 *   2. Assign DartBoard + prefabs + UI text
 */

import { DartBoard, DartHit } from "./DartBoard";

type BubbleColor = 'red' | 'green' | 'blue';

interface Bubble {
  obj: SceneObject;
  color: BubbleColor;
  gridX: number;
  gridY: number;
  falling: boolean;
  velX: number;
  velY: number;
  velZ: number;
  rotZ: number;
  rotSpeed: number;
}

@component
export class BubblePopGame extends BaseScriptComponent {

  @input dartBoard: DartBoard;

  @ui.group_start("Bubble Prefabs")
  @input redBubblePrefab: ObjectPrefab;
  @input greenBubblePrefab: ObjectPrefab;
  @input blueBubblePrefab: ObjectPrefab;
  @ui.group_end

  @ui.group_start("UI")
  @input @allowUndefined scoreText: Text;
  @input @allowUndefined colorText: Text;
  @input @allowUndefined statusText: Text;
  @ui.group_end

  @ui.group_start("Game Settings")
  @input minBubbles: number = 12;
  @input maxBubbles: number = 20;
  @input clusterCount: number = 4;
  @input hitRadius: number = 0.10;
  @input clusterRadius: number = 0.13;
  @input bubbleScale: number = 2.5;
  @input @hint("Min spacing — touching but not overlapping") bubbleSpacing: number = 0.12;
  @input @hint("Initial outward burst speed when popped") popForce: number = 1.0;
  @input @hint("Gravity pulling falling bubbles down") gravity: number = 2.5;
  @input @hint("Bubble spin speed when falling") spinSpeed: number = 360;
  @ui.group_end

  @ui.group_start("Sounds")
  @input @allowUndefined popSound: AudioTrackAsset;
  @input @allowUndefined missSound: AudioTrackAsset;
  @input @allowUndefined wrongColorSound: AudioTrackAsset;
  @input @allowUndefined clearedSound: AudioTrackAsset;
  @input @allowUndefined audioComponent: AudioComponent;
  @ui.group_end

  private bubbles: Bubble[] = [];
  private throwsTaken: number = 0;
  private startingBubbleCount: number = 0;
  private currentDartColor: BubbleColor = 'red';
  private active: boolean = false;
  private boardCleared: boolean = false;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  onStart() {
    if (!this.dartBoard) { print("[Bubble] ERROR: Assign DartBoard!"); return; }
    this.dartBoard.onDartLanded((hit: DartHit) => {
      if (this.active && !this.boardCleared) this.onDartHit(hit);
    });
  }

  public start() {
    this.active = true;
    this.boardCleared = false;
    this.throwsTaken = 0;
    this.clearBubbles();
    this.spawnClusters();
    this.startingBubbleCount = this.bubbles.length;
    this.rollNewDartColor();
    if (this.statusText) this.statusText.text = "Clear the board!";
    this.updateUI();
    print("[Bubble] Started, " + this.startingBubbleCount + " bubbles");
  }

  public stop() {
    this.active = false;
    this.clearBubbles();
  }

  public reset() {
    this.start();
  }

  // ─── Update Loop (gravity) ───

  private onUpdate() {
    if (!this.active) return;
    const dt = getDeltaTime();

    for (const b of this.bubbles) {
      if (!b.falling || !b.obj) continue;

      // Apply gravity
      b.velY += dt * this.gravity;

      // Update position
      b.gridX += b.velX * dt;
      b.gridY += b.velY * dt;

      // Update rotation
      b.rotZ += b.rotSpeed * dt;

      this.placeBubble(b);

      // Destroy when off the board
      if (b.gridY > 1.5 || b.gridX < -0.5 || b.gridX > 1.5) {
        b.obj.destroy();
        b.obj = null;
      }
    }

    const before = this.bubbles.length;
    this.bubbles = this.bubbles.filter(b => b.obj !== null);

    if (!this.boardCleared && this.bubbles.length === 0 && before > 0) {
      this.onBoardCleared();
    }
  }

  // ─── Game Logic ───

  private onDartHit(hit: DartHit) {
    this.throwsTaken++;

    let hitBubble: Bubble = null;
    let minDist = 999;
    for (const b of this.bubbles) {
      if (b.falling) continue;
      const dist = Math.sqrt(
        Math.pow(hit.gridX - b.gridX, 2) +
        Math.pow(hit.gridY - b.gridY, 2)
      );
      if (dist < this.hitRadius && dist < minDist) {
        minDist = dist;
        hitBubble = b;
      }
    }

    if (!hitBubble) {
      if (this.statusText) this.statusText.text = "Miss! (Throws: " + this.throwsTaken + ")";
      this.playSound(this.missSound);
      this.rollNewDartColor();
      this.updateUI();
      return;
    }

    if (hitBubble.color !== this.currentDartColor) {
      if (this.statusText) {
        this.statusText.text = "Wrong color! Bubble is " + hitBubble.color.toUpperCase();
      }
      this.playSound(this.wrongColorSound);
      this.rollNewDartColor();
      this.updateUI();
      return;
    }

    // POP cluster — flood fill from this bubble to all connected same-color
    const cluster = this.findCluster(hitBubble);

    // Compute cluster center for explosion direction
    let cx = 0, cy = 0;
    for (const b of cluster) { cx += b.gridX; cy += b.gridY; }
    cx /= cluster.length;
    cy /= cluster.length;

    for (const b of cluster) {
      b.falling = true;

      // Explosive outward burst from cluster center
      const dx = b.gridX - cx;
      const dy = b.gridY - cy;
      const dist = Math.max(0.001, Math.sqrt(dx * dx + dy * dy));

      // Add outward burst + random spread
      b.velX = (dx / dist) * this.popForce + (Math.random() - 0.5) * 0.5;
      b.velY = (dy / dist) * this.popForce - 0.8;  // upward kick
      b.velZ = -Math.random() * 0.5;
      b.rotSpeed = (Math.random() - 0.5) * this.spinSpeed * Math.PI / 180;
    }

    if (this.statusText) {
      if (cluster.length > 1) {
        this.statusText.text = "POP! Cluster of " + cluster.length + "!";
      } else {
        this.statusText.text = "POP!";
      }
    }
    this.playSound(this.popSound);

    this.rollNewDartColor();
    this.updateUI();
  }

  /** Flood fill: find all same-color bubbles connected to start */
  private findCluster(start: Bubble): Bubble[] {
    const cluster: Bubble[] = [start];
    const visited = new Set<Bubble>([start]);
    const queue: Bubble[] = [start];

    while (queue.length > 0) {
      const current = queue.shift();
      for (const other of this.bubbles) {
        if (visited.has(other) || other.falling || other.color !== start.color) continue;
        const d = Math.sqrt(
          Math.pow(current.gridX - other.gridX, 2) +
          Math.pow(current.gridY - other.gridY, 2)
        );
        if (d < this.clusterRadius) {
          visited.add(other);
          cluster.push(other);
          queue.push(other);
        }
      }
    }

    return cluster;
  }

  // ─── Spawning ───

  private spawnClusters() {
    const totalBubbles = this.minBubbles + Math.floor(Math.random() * (this.maxBubbles - this.minBubbles + 1));
    const perCluster = Math.ceil(totalBubbles / this.clusterCount);
    let spawned = 0;

    for (let c = 0; c < this.clusterCount && spawned < totalBubbles; c++) {
      const clusterAngle = (c / this.clusterCount) * Math.PI * 2 + (Math.random() - 0.5) * 0.4;
      const clusterRadius = 0.38 + Math.random() * 0.08;
      const cx = 0.5 + Math.cos(clusterAngle) * clusterRadius;
      const cy = 0.5 + Math.sin(clusterAngle) * clusterRadius;

      let attempts = 0;
      let placed = 0;
      while (placed < perCluster && attempts < 50 && spawned < totalBubbles) {
        attempts++;
        const localAngle = Math.random() * Math.PI * 2;
        const localR = Math.random() * 0.13;
        const nx = cx + Math.cos(localAngle) * localR;
        const ny = cy + Math.sin(localAngle) * localR;

        // Touching but not overlapping — use bubbleSpacing setting
        let tooClose = false;
        for (const existing of this.bubbles) {
          const d = Math.sqrt(
            Math.pow(nx - existing.gridX, 2) +
            Math.pow(ny - existing.gridY, 2)
          );
          if (d < this.bubbleSpacing) { tooClose = true; break; }
        }
        if (tooClose) continue;

        this.spawnBubbleAt(nx, ny);
        placed++;
        spawned++;
      }
    }
    print("[Bubble] Spawned " + spawned + " bubbles");
  }

  private spawnBubbleAt(nx: number, ny: number) {
    const colors: BubbleColor[] = ['red', 'green', 'blue'];
    const color = colors[Math.floor(Math.random() * colors.length)];

    let prefab: ObjectPrefab = null;
    if (color === 'red') prefab = this.redBubblePrefab;
    else if (color === 'green') prefab = this.greenBubblePrefab;
    else prefab = this.blueBubblePrefab;

    if (!prefab) return;

    const obj = this.dartBoard.spawnAtPosition(nx, ny, prefab);
    if (!obj) return;

    obj.getTransform().setLocalScale(new vec3(this.bubbleScale, this.bubbleScale, this.bubbleScale));

    this.bubbles.push({
      obj, color, gridX: nx, gridY: ny,
      falling: false, velX: 0, velY: 0, velZ: 0,
      rotZ: 0, rotSpeed: 0
    });
  }

  private placeBubble(b: Bubble) {
    if (!b.obj || !this.dartBoard.boardDisc) return;
    const localX = (b.gridX - 0.5) * this.dartBoard.boardSize;
    const localY = (0.5 - b.gridY) * this.dartBoard.boardSize;
    const localZ = b.falling ? 0.5 + b.velZ * 5 : 0.5;
    b.obj.getTransform().setLocalPosition(new vec3(localX, localY, localZ));

    // Spin while falling
    if (b.falling && b.rotSpeed !== 0) {
      const rot = quat.fromEulerAngles(0, 0, b.rotZ);
      b.obj.getTransform().setLocalRotation(rot);
    }
  }

  private clearBubbles() {
    for (const b of this.bubbles) {
      if (b.obj) b.obj.destroy();
    }
    this.bubbles = [];
  }

  // ─── Game End ───

  private onBoardCleared() {
    this.boardCleared = true;
    const efficiency = (this.startingBubbleCount / this.throwsTaken).toFixed(1);
    if (this.statusText) {
      this.statusText.text = "CLEARED!\n" + this.startingBubbleCount + " bubbles in " + this.throwsTaken + " darts\n(" + efficiency + " bubbles/dart)";
    }
    this.playSound(this.clearedSound);
    print("[Bubble] Cleared in " + this.throwsTaken + " darts");
  }

  // ─── Helpers ───

  private rollNewDartColor() {
    // Only pick from colors that still have non-falling bubbles
    const available = this.getAvailableColors();
    if (available.length === 0) {
      // No bubbles left, default
      this.currentDartColor = 'red';
      return;
    }
    this.currentDartColor = available[Math.floor(Math.random() * available.length)];
  }

  private getAvailableColors(): BubbleColor[] {
    const set = new Set<BubbleColor>();
    for (const b of this.bubbles) {
      if (!b.falling) set.add(b.color);
    }
    const arr: BubbleColor[] = [];
    set.forEach(c => arr.push(c));
    return arr;
  }

  private updateUI() {
    const remaining = this.bubbles.filter(b => !b.falling).length;
    if (this.scoreText) {
      this.scoreText.text = "Bubbles: " + remaining + " / " + this.startingBubbleCount + "  |  Throws: " + this.throwsTaken;
    }
    if (this.colorText) this.colorText.text = "Dart: " + this.currentDartColor.toUpperCase();
  }

  // ─── Sound ───

  private playSound(track: AudioTrackAsset) {
    try {
      if (!track) return;
      if (!this.audioComponent) return;
      this.audioComponent.audioTrack = track;
      this.audioComponent.play(1);
    } catch(e) {
      print("[Bubble] Sound error: " + e);
    }
  }
}