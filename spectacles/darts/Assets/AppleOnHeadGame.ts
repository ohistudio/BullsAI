/**
 * AppleOnHeadGame.ts — William Tell style game
 * 
 * Place an apple on top of a Bitmoji head. Hit the bullseye (or near the
 * apple's board position) to knock it off. Hit the face = penalty.
 * 
 * Setup:
 *   1. Place Bitmoji model in scene (positioned in front of board)
 *   2. Create an apple prefab with Physics Body + Collider
 *   3. Assign headObject (where apple sits) and appleSpawnPoint
 *   4. Map board zones: Bullseye/Triple20 = apple hit, Inner rings = face hit
 */

import { DartBoard, DartHit } from "./DartBoard";

@component
export class AppleOnHeadGame extends BaseScriptComponent {

  @input dartBoard: DartBoard;

  @ui.group_start("Scene")
  @input
  @hint("Spawn point for the apple (on top of head)")
  appleSpawnPoint: SceneObject;

  @input applePrefab: ObjectPrefab;

  @input
  @hint("The Bitmoji head/face to react on misses")
  @allowUndefined
  headObject: SceneObject;
  @ui.group_end

  @ui.group_start("Physics")
  @input launchForce: number = 200;
  @input launchUp: number = 100;
  @ui.group_end

  @ui.group_start("UI")
  @input @allowUndefined scoreText: Text;
  @input @allowUndefined statusText: Text;
  @ui.group_end

  private score: number = 0;
  private misses: number = 0;
  private appleObject: SceneObject = null;
  private active: boolean = false;
  private appleInFlight: boolean = false;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
  }

  onStart() {
    if (!this.dartBoard) { print("[Apple] ERROR: Assign DartBoard!"); return; }

    this.dartBoard.onDartLanded((hit: DartHit) => {
      if (this.active) this.onDartHit(hit);
    });
  }

  public start() {
    this.active = true;
    this.score = 0;
    this.misses = 0;
    this.spawnApple();
    if (this.statusText) this.statusText.text = "Hit the apple!";
    this.updateUI();
    print("[Apple] Game started");
  }

  public stop() {
    this.active = false;
    if (this.appleObject) {
      this.appleObject.destroy();
      this.appleObject = null;
    }
  }

  public reset() {
    this.score = 0;
    this.misses = 0;
    if (this.appleObject) { this.appleObject.destroy(); this.appleObject = null; }
    this.spawnApple();
    if (this.statusText) this.statusText.text = "Reset! Hit the apple!";
    this.updateUI();
  }

  // ─── Game Logic ───

  private onDartHit(hit: DartHit) {
    if (this.appleInFlight) return; // ignore while apple is flying

    const zone = hit.zone || '';

    // Apple covers the center area — hit if dart lands in center
    // Use distance from center rather than specific zones
    const dist = Math.sqrt(
      Math.pow(hit.gridX - 0.5, 2) + Math.pow(hit.gridY - 0.5, 2)
    );

    // Apple hit zone: center 20% of board (covers bullseye, outer bull, and some triple ring)
    if (dist < 0.10) {
      this.hitApple();
      return;
    }

    // Face hit zone: 10-35% from center (around the apple area)
    if (dist < 0.35) {
      this.hitFace();
      return;
    }

    // Everything else → miss
    if (this.statusText) this.statusText.text = "Miss! Aim for the apple";
  }

  private hitApple() {
    this.score++;
    this.appleInFlight = true;
    if (this.statusText) this.statusText.text = "APPLE HIT!";

    // Launch with physics if prefab has PhysicsBody
    if (this.appleObject) {
      const body = this.appleObject.getComponent('Physics.BodyComponent') as any;
      if (body) {
        body.dynamic = true;

        // Strong left/right push + small up/back so it arcs sideways
        const dir = Math.random() < 0.5 ? -1 : 1;
        const force = new vec3(
          dir * this.launchForce * 3,   // big sideways push
          this.launchUp,                 // small up pop
          -this.launchForce * 0.2        // tiny backward
        );
        if (body.addForce) body.addForce(force, 0);

        // Also set velocity directly (more reliable than force for instant launch)
        if (body.velocity !== undefined) {
          body.velocity = new vec3(dir * 150, 50, -20);
        }

        // Add spin
        const torque = new vec3(
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100,
          (Math.random() - 0.5) * 100
        );
        if (body.addTorque) body.addTorque(torque, 0);

        print("[Apple] Launched with force " + force.x.toFixed(0) + "," + force.y.toFixed(0) + "," + force.z.toFixed(0));

        // Debug: log position over the next second
        const startPos = this.appleObject.getTransform().getWorldPosition();
        print("[Apple] Start pos: " + startPos.x.toFixed(1) + "," + startPos.y.toFixed(1) + "," + startPos.z.toFixed(1));

        const debugEvt = this.createEvent("DelayedCallbackEvent");
        debugEvt.bind(() => {
          if (this.appleObject) {
            const p = this.appleObject.getTransform().getWorldPosition();
            print("[Apple] After 0.5s: " + p.x.toFixed(1) + "," + p.y.toFixed(1) + "," + p.z.toFixed(1));
          } else {
            print("[Apple] Apple is null after 0.5s!");
          }
        });
        debugEvt.reset(0.5);
      } else {
        print("[Apple] WARN: No Physics.BodyComponent on apple!");
      }
    }

    // Keep apple visible longer so you see it fall (4s)
    const evt = this.createEvent("DelayedCallbackEvent");
    evt.bind(() => {
      if (this.appleObject) { this.appleObject.destroy(); this.appleObject = null; }
      this.appleInFlight = false;
      this.spawnApple();
      if (this.active && this.statusText) this.statusText.text = "Hit the apple!";
    });
    evt.reset(4.0);

    this.updateUI();
  }

  private isShaking: boolean = false;
  private shakeStartTime: number = 0;
  private shakeOriginalPos: vec3 = null;
  private shakeEvent: any = null;

  private hitFace() {
    this.misses++;
    if (this.statusText) this.statusText.text = "Ouch! Watch out for the face!";
    print("[Apple] Face hit! Misses now: " + this.misses);

    this.updateUI();

    // Head shake (skip if already shaking)
    if (!this.headObject || this.isShaking) return;

    this.isShaking = true;
    this.shakeOriginalPos = this.headObject.getTransform().getLocalPosition();
    this.shakeStartTime = getTime();

    if (this.shakeEvent) this.removeEvent(this.shakeEvent);
    this.shakeEvent = this.createEvent("UpdateEvent");
    this.shakeEvent.bind(() => {
      const elapsed = getTime() - this.shakeStartTime;
      if (elapsed > 0.5) {
        // Done shaking
        this.headObject.getTransform().setLocalPosition(this.shakeOriginalPos);
        this.removeEvent(this.shakeEvent);
        this.shakeEvent = null;
        this.isShaking = false;
        return;
      }
      // Shake
      const offset = (Math.random() - 0.5) * 2.0;
      const newPos = new vec3(
        this.shakeOriginalPos.x + offset,
        this.shakeOriginalPos.y,
        this.shakeOriginalPos.z
      );
      this.headObject.getTransform().setLocalPosition(newPos);
    });
  }

  private spawnApple() {
    if (!this.applePrefab || !this.appleSpawnPoint) return;
    this.appleObject = this.applePrefab.instantiate(this.appleSpawnPoint);
    this.appleObject.getTransform().setLocalPosition(vec3.zero());

    // Make physics body kinematic so apple stays put until hit
    const body = this.appleObject.getComponent('Physics.BodyComponent') as any;
    if (body) {
      body.dynamic = false; // kinematic — no gravity, no forces
    }
  }

  private updateUI() {
    if (this.scoreText) this.scoreText.text = "Score: " + this.score + "  |  Misses: " + this.misses;
  }
}