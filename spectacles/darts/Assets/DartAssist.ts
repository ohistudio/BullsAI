/**
 * DartAssist.ts — AR Darts Coach
 * 
 * Modes:
 *   1. LEARN — introduces the dartboard zones step by step
 *   2. TECHNIQUE — posture and grip tips
 *   3. DRILL — guided target practice with accuracy feedback
 *   4. FREE — throw anywhere, builds heat map
 * 
 * Setup:
 *   1. Attach to TicTacToeContainer equivalent (DartAssistContainer)
 *   2. Assign DartBoard, dialogue text, target highlight prefab
 *   3. Assign Camera SceneObject for distance detection
 */

import { DartBoard, DartHit } from "./DartBoard";

// Standard dartboard proportions (fraction of board radius)
const BULL_INNER = 0.037;
const BULL_OUTER = 0.094;
const TRIPLE_INNER = 0.582;
const TRIPLE_OUTER = 0.629;
const DOUBLE_INNER = 0.953;
const DOUBLE_OUTER = 1.02;

// Segment order (clockwise from top)
const SEG = [20,1,18,4,13,6,10,15,2,17,3,19,7,16,8,11,14,9,12,5];

type CoachPhase = 'intro' | 'learn_board' | 'learn_technique' | 'drill' | 'free' | 'summary';

interface DrillTarget {
  zone: string;       // "Single 20", "Double 16", "Bullseye"
  description: string; // shown to player
}

@component
export class DartAssist extends BaseScriptComponent {

  @input dartBoard: DartBoard;

  @ui.group_start("UI")
  @input dialogueText: Text;
  @input @allowUndefined subText: Text;
  @input @allowUndefined statsText: Text;
  @ui.group_end

  @ui.group_start("Target")
  @input
  @hint("A disc/ring prefab to highlight target zone on the board")
  @allowUndefined
  targetHighlight: SceneObject;

  @input @allowUndefined hitMarkerPrefab: ObjectPrefab;
  @ui.group_end

  @ui.group_start("Distance")
  @input @allowUndefined cameraObject: SceneObject;
  @input ochiDistanceMeters: number = 2.37;
  @input distanceWarningEnabled: boolean = true;
  @ui.group_end

  // State
  private phase: CoachPhase = 'intro';
  private learnStep: number = 0;
  private drillIndex: number = 0;
  private throwHistory: { gridX: number, gridY: number, zone: string, hit: boolean }[] = [];
  private drillHits: number = 0;
  private drillTotal: number = 0;
  private currentTarget: DrillTarget = null;
  private hitMarkers: SceneObject[] = [];

  // Learn board content
  private boardLessons: { title: string, body: string }[] = [
    {
      title: "Welcome to Dart Assist!",
      body: "I'll teach you everything about darts.\nPinch to continue."
    },
    {
      title: "The Dartboard",
      body: "The board has 20 numbered segments.\nThe numbers look random but they're placed\nto punish inaccuracy — miss the 20\nand you hit 1 or 5."
    },
    {
      title: "Singles",
      body: "The large areas are SINGLES.\nHit Single 20 and score 20 points.\nThese are the easiest to hit."
    },
    {
      title: "Doubles Ring",
      body: "The thin OUTER ring is DOUBLES.\nHit Double 20 and score 40 points.\nYou must finish most games on a double!"
    },
    {
      title: "Triples Ring",
      body: "The thin INNER ring is TRIPLES.\nHit Triple 20 and score 60 points.\nThis is the highest scoring spot on the board!"
    },
    {
      title: "Bullseye",
      body: "The centre has two zones:\nOuter Bull = 25 points\nInner Bullseye = 50 points\nThe bullseye is worth less than Triple 20!"
    },
    {
      title: "Key Insight",
      body: "Triple 20 (60pts) beats Bullseye (50pts).\nPro players aim for Triple 20, not the middle.\nLet's learn how to throw properly."
    }
  ];

  // Technique lessons
  private techniqueLessons: { title: string, body: string }[] = [
    {
      title: "Stance",
      body: "Stand with your dominant foot forward.\nLean slightly toward the board.\nKeep both feet behind the throw line."
    },
    {
      title: "The Oche Line",
      body: "The throw line (oche) is 7ft 9in\n(2.37m) from the board.\nI'll warn you if you're too close."
    },
    {
      title: "Grip",
      body: "Hold the dart like a pen.\nUse 3 or 4 fingers.\nFirm but relaxed — don't squeeze."
    },
    {
      title: "Aim & Throw",
      body: "Focus on your target.\nPower comes from your wrist, not shoulder.\nOne smooth motion — don't jerk."
    },
    {
      title: "Follow Through",
      body: "Your hand should point at the target\nafter releasing.\nDon't pull your arm back."
    },
    {
      title: "Ready to Practice!",
      body: "Let's start with some easy targets.\nPinch to begin your first drill."
    }
  ];

  // Drill sequence — progressively harder
  private drills: DrillTarget[] = [
    { zone: "Single 20", description: "Hit the big 20 segment (top)" },
    { zone: "Single 20", description: "Single 20 again — build consistency" },
    { zone: "Single 20", description: "One more Single 20 — find your rhythm" },
    { zone: "Single 1", description: "Now hit Single 1 (next to 20)" },
    { zone: "Single 18", description: "Hit Single 18 (other side of 20)" },
    { zone: "Single 5", description: "Single 5 (bottom of the board)" },
    { zone: "Single 12", description: "Single 12 (left side)" },
    { zone: "Single 6", description: "Single 6 (right side)" },
    { zone: "Double 20", description: "Now try Double 20 — the thin outer ring!" },
    { zone: "Double 20", description: "Double 20 again — this is how you finish games" },
    { zone: "Triple 20", description: "Triple 20 — the highest score on the board!" },
    { zone: "Bullseye", description: "Finally — aim for the Bullseye!" },
  ];

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  private isPlaying: boolean = false;

  onStart() {
    if (!this.dartBoard) { print("[Coach] ERROR: Assign DartBoard!"); return; }

    // Listen for darts — only respond when active
    this.dartBoard.onDartLanded((hit: DartHit) => {
      if (this.isPlaying) this.onDartHit(hit);
    });

    print("[Coach] Dart Assist ready — waiting for phase");
  }

  /** Called by lobby when leaving Dart Assist */
  public stop() {
    this.isPlaying = false;
    this.hideHighlight();
    print("[Coach] Stopped");
  }

  private onUpdate() {
    if (this.distanceWarningEnabled && this.cameraObject && this.dartBoard.boardDisc) {
      this.checkDistance();
    }
  }

  // ─── Distance Check ───

  private lastDistanceWarning: number = 0;

  private checkDistance() {
    const camPos = this.cameraObject.getTransform().getWorldPosition();
    const boardPos = this.dartBoard.boardDisc.getTransform().getWorldPosition();
    const dist = camPos.sub(boardPos).length;

    // Convert to approximate meters (Lens Studio units vary)
    // Only warn if they're significantly too close
    const tooClose = dist < this.ochiDistanceMeters * 0.7;
    const now = getTime();

    if (tooClose && now - this.lastDistanceWarning > 5.0) {
      this.lastDistanceWarning = now;
      if (this.subText) this.subText.text = "Too close! Step back behind the line.";
      print("[Coach] Distance warning: " + dist.toFixed(2) + " units");
    }
  }

  // ─── Navigation (pinch advances lessons) ───

  public advance() {
    if (this.phase === 'intro' || this.phase === 'learn_board') {
      this.learnStep++;
      if (this.learnStep >= this.boardLessons.length) {
        this.phase = 'learn_technique';
        this.learnStep = 0;
      }
      this.showLesson();
    } else if (this.phase === 'learn_technique') {
      this.learnStep++;
      if (this.learnStep >= this.techniqueLessons.length) {
        this.phase = 'drill';
        this.drillIndex = 0;
        this.drillHits = 0;
        this.drillTotal = 0;
        this.startDrill();
        return;
      }
      this.showLesson();
    } else if (this.phase === 'summary') {
      this.phase = 'free';
      this.showFreePlay();
    }
  }

  // ─── Lessons ───

  private showLesson() {
    if (this.phase === 'intro' || this.phase === 'learn_board') {
      const lesson = this.boardLessons[this.learnStep];
      if (this.dialogueText) this.dialogueText.text = lesson.title;
      if (this.subText) this.subText.text = lesson.body;
      this.phase = 'learn_board';

      // Highlight relevant zone during lessons
      if (this.learnStep === 2) this.highlightRing('single');       // Singles lesson
      else if (this.learnStep === 3) this.highlightRing('double');  // Doubles lesson
      else if (this.learnStep === 4) this.highlightRing('triple');  // Triples lesson
      else if (this.learnStep === 5) this.highlightRing('bullseye');// Bullseye lesson
      else if (this.learnStep === 6) this.highlightZone('Triple 20');// Key insight
      else this.hideHighlight();

    } else if (this.phase === 'learn_technique') {
      const lesson = this.techniqueLessons[this.learnStep];
      if (this.dialogueText) this.dialogueText.text = lesson.title;
      if (this.subText) this.subText.text = lesson.body;
      this.hideHighlight();
    }
    this.updateStats();
  }

  // ─── Drills ───

  private startDrill() {
    if (this.drillIndex >= this.drills.length) {
      this.showSummary();
      return;
    }

    this.currentTarget = this.drills[this.drillIndex];
    if (this.dialogueText) this.dialogueText.text = "" + this.currentTarget.zone;
    if (this.subText) this.subText.text = this.currentTarget.description + "\nThrow now!";
    this.updateStats();

    // Highlight target zone on board
    this.highlightZone(this.currentTarget.zone);

    print("[Coach] Drill " + (this.drillIndex + 1) + "/" + this.drills.length + ": " + this.currentTarget.zone);
  }

  private onDartHit(hit: DartHit) {
    // Store for heat map
    this.throwHistory.push({
      gridX: hit.gridX,
      gridY: hit.gridY,
      zone: hit.zone,
      hit: false
    });

    // Place heat map marker
    if (this.hitMarkerPrefab) {
      const marker = this.dartBoard.spawnAtPosition(hit.gridX, hit.gridY, this.hitMarkerPrefab);
      if (marker) this.hitMarkers.push(marker);
    }

    if (this.phase === 'drill') {
      this.handleDrillThrow(hit);
    } else if (this.phase === 'free') {
      this.handleFreeThrow(hit);
    }
    // During lessons, ignore throws (or could use them to demo)
  }

  private handleDrillThrow(hit: DartHit) {
    if (!this.currentTarget) return;

    this.drillTotal++;
    const targetZone = this.currentTarget.zone;
    const hitZone = hit.zone;

    // Check if they hit the target
    const isHit = this.zoneMatches(hitZone, targetZone);

    // Calculate how close they were
    const feedback = this.getFeedback(hit, targetZone, isHit);

    if (isHit) {
      this.drillHits++;
      this.throwHistory[this.throwHistory.length - 1].hit = true;

      if (this.dialogueText) this.dialogueText.text = "" + hitZone + "!";
      if (this.subText) this.subText.text = feedback;
      this.hideHighlight();

      // Move to next drill after a short delay
      this.drillIndex++;
      const evt = this.createEvent("DelayedCallbackEvent");
      evt.bind(() => this.startDrill());
      evt.reset(2.0);
    } else {
      // Miss — show feedback briefly, then restore target prompt
      if (this.dialogueText) this.dialogueText.text = "" + hitZone;
      if (this.subText) this.subText.text = feedback;

      // Keep highlight visible (target zone still glowing)
      // After 2.5s, restore the "Target" prompt so user knows where to aim
      const restoreEvt = this.createEvent("DelayedCallbackEvent");
      restoreEvt.bind(() => {
        // Only restore if still on this drill (hasn't advanced)
        if (this.phase === 'drill' && this.currentTarget &&
            this.currentTarget.zone === targetZone) {
          if (this.dialogueText) this.dialogueText.text = "" + targetZone;
          if (this.subText) this.subText.text = this.currentTarget.description + "\nThrow again!";
        }
      });
      restoreEvt.reset(2.5);
    }

    this.updateStats();
    print("[Coach] Target: " + targetZone + " Hit: " + hitZone + " Match: " + isHit);
  }

  private handleFreeThrow(hit: DartHit) {
    this.drillTotal++;
    if (this.dialogueText) this.dialogueText.text = hit.zone;
    if (this.subText) this.subText.text = "Score: " + this.getScore(hit.zone) + " pts";
    this.updateStats();
  }

  // ─── Feedback ───

  private getFeedback(hit: DartHit, targetZone: string, isHit: boolean): string {
    if (isHit) {
      const messages = [
        "Perfect throw — repeat that motion.",
        "Nailed it. Smooth release.",
        "Right on target. Lock that grip in.",
        "Excellent. Same arm angle next time.",
        "Clean throw. Keep that follow-through.",
        "Spot on. You found your line."
      ];
      return messages[Math.floor(Math.random() * messages.length)];
    }

    // Calculate the drift vector from target to where the dart actually landed
    // (in normalized board coords)
    const targetPos = this.getZonePosition(targetZone);
    const dx = hit.gridX - targetPos.x;
    const dy = hit.gridY - targetPos.y;
    const drift = Math.sqrt(dx * dx + dy * dy);

    // Distance from board center
    const targetDist = Math.sqrt(
      Math.pow(targetPos.x - 0.5, 2) + Math.pow(targetPos.y - 0.5, 2)
    );
    const hitDist = Math.sqrt(
      Math.pow(hit.gridX - 0.5, 2) + Math.pow(hit.gridY - 0.5, 2)
    );

    // Off the board entirely
    if (hit.zone.includes("Miss")) {
      if (Math.abs(dx) > Math.abs(dy) * 1.5) {
        return dx > 0
          ? "Pulled hard right — relax your grip and throw straighter."
          : "Pulled hard left — keep your elbow tucked in.";
      }
      if (dy < -0.2) return "Throw went high — release a bit later.";
      if (dy > 0.2) return "Dropped low — more wrist snap on release.";
      return "Off the board. Steady your stance and try again.";
    }

    // Right segment, wrong ring — give precise technique feedback
    const targetNum = this.getSegmentNumber(targetZone);
    const hitNum = this.getSegmentNumber(hit.zone);

    if (targetNum === hitNum) {
      if (targetZone.includes("Double") && (hit.zone.includes("Single") || hit.zone.includes("Triple"))) {
        return hitDist < targetDist
          ? "Right number — pulled inside. Trust the throw, aim slightly outward."
          : "Right number — overcooked it. Ease back on power.";
      }
      if (targetZone.includes("Triple") && hit.zone.includes("Single")) {
        return hitDist < targetDist
          ? "Right number — short of the triple. Aim a touch higher."
          : "Right number — past the triple. Pull back slightly.";
      }
      if (targetZone.includes("Single") && hit.zone.includes("Triple")) {
        return "Right number — landed in the triple ring. Worse miss is no miss!";
      }
      if (targetZone.includes("Single") && hit.zone.includes("Double")) {
        return "Right number — too far out. Aim for the middle of the segment.";
      }
      if (hit.zone.includes("Bull") && !targetZone.includes("Bull")) {
        return "You hit the bull instead. Strong throw, just adjust your aim point.";
      }
      return "Right number, wrong ring. Tighten your aim.";
    }

    // Different segment — directional feedback using actual position vectors
    // Convert clockwise/counter-clockwise into "left/right of target"
    const targetIdx = SEG.indexOf(targetNum);
    const hitIdx = SEG.indexOf(hitNum);
    if (targetIdx >= 0 && hitIdx >= 0) {
      const diff = ((hitIdx - targetIdx) + 20) % 20;

      // Use the actual horizontal pixel drift to decide left/right phrasing
      const driftedRight = dx > 0.05;
      const driftedLeft = dx < -0.05;

      // Close miss (within 1-2 segments)
      if (diff === 1) {
        return "Just one segment off. Tiny grip adjustment, you're nearly there.";
      }
      if (diff === 19) {
        return "One segment off the other way. You've got the line, just settle.";
      }
      if (diff <= 3) {
        return driftedRight
          ? "Drifting right — tighten your wrist on release."
          : "A few segments off. Smooth release, don't snap it.";
      }
      if (diff >= 17) {
        return driftedLeft
          ? "Pulling left — check your stance, dominant foot forward."
          : "A few segments off. Slow your throw down by 10%.";
      }

      // Wider misses
      if (diff > 3 && diff < 10) {
        if (driftedRight) return "Pulling right — your release is rotating outward. Square up.";
        if (hitDist > targetDist) return "Throw is going long and right. Less power, more focus.";
        return "Off to the right side. Reset stance, breathe, throw again.";
      }
      // diff > 10 = far counter-clockwise
      if (driftedLeft) return "Pulling left — relax your fingers, don't squeeze the dart.";
      if (hitDist > targetDist) return "Going long and left. Slow the swing, focus on the target.";
      return "Off to the left. Aim point should be the segment's middle, not its edge.";
    }

    // Bullseye area when not aiming there
    if (hit.zone.includes("Bull")) {
      return "Strong centered throw — but the target was " + targetZone + ".";
    }

    return "Reset your stance. Aim for " + targetZone + " and throw smooth.";
  }

  /** Approximate normalized (x,y) of a zone's center — for drift analysis */
  private getZonePosition(zone: string): { x: number, y: number } {
    if (zone.includes("Bullseye") || zone.includes("Bull")) {
      return { x: 0.5, y: 0.5 };
    }
    const segNum = this.getSegmentNumber(zone);
    const segIdx = SEG.indexOf(segNum);
    if (segIdx < 0) return { x: 0.5, y: 0.5 };

    const angleRad = (90 - segIdx * 18) * Math.PI / 180;
    let dist = 0.45;
    if (zone.includes("Double")) dist = 0.485;
    else if (zone.includes("Triple")) dist = 0.30;
    else if (zone.includes("Single")) dist = 0.40;

    return {
      x: 0.5 + Math.cos(angleRad) * dist,
      y: 0.5 - Math.sin(angleRad) * dist
    };
  }

  // ─── Summary ───

  private showSummary() {
    this.phase = 'summary';
    this.hideHighlight();
    const pct = this.drillTotal > 0 ? Math.round(this.drillHits / this.drillTotal * 100) : 0;
    const total = this.throwHistory.length;

    if (this.dialogueText) this.dialogueText.text = "Session Complete!";

    let summary = "Drills completed: " + this.drills.length + "\n";
    summary += "Throws: " + this.drillTotal + "\n";
    summary += "Hits: " + this.drillHits + " (" + pct + "%)\n";
    summary += "\nPinch to enter Free Play.";

    if (this.subText) this.subText.text = summary;
    print("[Coach] Session done: " + this.drillHits + "/" + this.drillTotal + " (" + pct + "%)");
  }

  private showFreePlay() {
    this.hideHighlight();
    if (this.dialogueText) this.dialogueText.text = "Free Play";
    if (this.subText) this.subText.text = "Throw anywhere!\nYour heat map is building.";
    this.drillTotal = 0;
  }

  // ─── Stats ───

  private updateStats() {
    if (!this.statsText) return;

    if (this.phase === 'drill') {
      const drillNum = Math.min(this.drillIndex + 1, this.drills.length);
      const pct = this.drillTotal > 0 ? Math.round(this.drillHits / this.drillTotal * 100) : 0;
      const remaining = this.drills.length - this.drillIndex;

      let txt = "DRILL " + drillNum + " / " + this.drills.length + "\n";
      txt += "Hit rate: " + this.drillHits + "/" + this.drillTotal;
      if (this.drillTotal > 0) txt += "  (" + pct + "%)";
      txt += "\n" + remaining + " drill" + (remaining !== 1 ? "s" : "") + " remaining";
      this.statsText.text = txt;
    } else if (this.phase === 'free') {
      const total = this.throwHistory.length;
      this.statsText.text = "Free Play\nTotal throws: " + total;
    } else if (this.phase === 'learn_board' || this.phase === 'learn_technique') {
      const totalLessons = this.phase === 'learn_board'
        ? this.boardLessons.length
        : this.techniqueLessons.length;
      this.statsText.text = "Lesson " + (this.learnStep + 1) + " / " + totalLessons;
    } else {
      this.statsText.text = "";
    }
  }

  // ─── Helpers ───

  private zoneMatches(hitZone: string, targetZone: string): boolean {
    // Normalize and compare
    const h = hitZone.trim().toLowerCase();
    const t = targetZone.trim().toLowerCase();
    return h === t;
  }

  private getSegmentNumber(zone: string): number {
    const match = zone.match(/\d+/);
    return match ? parseInt(match[0]) : 0;
  }

  private getScore(zone: string): number {
    if (zone.includes("Bullseye")) return 50;
    if (zone.includes("Outer Bull")) return 25;
    if (zone.includes("Miss")) return 0;
    const num = this.getSegmentNumber(zone);
    if (zone.includes("Triple")) return num * 3;
    if (zone.includes("Double")) return num * 2;
    return num;
  }

  // ─── Zone Highlighting ───

  /**
   * Move the highlight object to a target zone on the board.
   * Create a glowing disc/sphere prefab and assign as targetHighlight.
   * 
   * Board layout (fraction of radius from center):
   *   Bullseye: 0, Single: ~45%, Triple: ~60%, Double: ~97%
   */
  private highlightZone(zone: string) {
    if (!this.targetHighlight) return;
    this.targetHighlight.enabled = true;

    const r = this.dartBoard.boardSize / 2;

    if (zone.includes("Bullseye") || zone.includes("Bull")) {
      this.targetHighlight.getTransform().setLocalPosition(new vec3(0, 0, 0.6));
      this.targetHighlight.getTransform().setLocalScale(new vec3(2, 2, 0.5));
      return;
    }

    const segNum = this.getSegmentNumber(zone);
    const segIdx = SEG.indexOf(segNum);
    if (segIdx < 0) { this.hideHighlight(); return; }

    // Angle: segment 0 (20) is at top, 18° each clockwise
    const angleRad = (90 - segIdx * 18) * Math.PI / 180;

    // Distance from center
    let dist = 0.45;
    let scale = 3.0;
    if (zone.includes("Double")) { dist = 0.97; scale = 1.5; }
    else if (zone.includes("Triple")) { dist = 0.60; scale = 1.5; }

    const x = Math.cos(angleRad) * dist * r;
    const y = Math.sin(angleRad) * dist * r;
    this.targetHighlight.getTransform().setLocalPosition(new vec3(x, y, 0.6));
    this.targetHighlight.getTransform().setLocalScale(new vec3(scale, scale, 0.5));
  }

  /** Highlight a ring during Learn Board lessons */
  private highlightRing(ring: string) {
    if (!this.targetHighlight) return;
    this.targetHighlight.enabled = true;
    const r = this.dartBoard.boardSize / 2;

    if (ring === 'bullseye') {
      this.targetHighlight.getTransform().setLocalPosition(new vec3(0, 0, 0.6));
      this.targetHighlight.getTransform().setLocalScale(new vec3(2, 2, 0.5));
    } else if (ring === 'double') {
      this.targetHighlight.getTransform().setLocalPosition(new vec3(0, 0.97 * r, 0.6));
      this.targetHighlight.getTransform().setLocalScale(new vec3(2, 2, 0.5));
    } else if (ring === 'triple') {
      this.targetHighlight.getTransform().setLocalPosition(new vec3(0, 0.60 * r, 0.6));
      this.targetHighlight.getTransform().setLocalScale(new vec3(2, 2, 0.5));
    } else if (ring === 'single') {
      this.targetHighlight.getTransform().setLocalPosition(new vec3(0, 0.45 * r, 0.6));
      this.targetHighlight.getTransform().setLocalScale(new vec3(3, 3, 0.5));
    } else {
      this.hideHighlight();
    }
  }

  private hideHighlight() {
    if (this.targetHighlight) this.targetHighlight.enabled = false;
  }

  // ─── Clear ───

  public clearHeatMap() {
    for (const m of this.hitMarkers) {
      if (m) m.destroy();
    }
    this.hitMarkers = [];
    this.throwHistory = [];
    print("[Coach] Heat map cleared");
  }

  public resetSession() {
    this.clearHeatMap();
    this.phase = 'intro';
    this.learnStep = 0;
    this.drillIndex = 0;
    this.drillHits = 0;
    this.drillTotal = 0;
    this.showLesson();
    print("[Coach] Session reset");
  }

  /** Called by GameManager to jump to a specific phase */
  public setPhase(phase: string) {
    this.isPlaying = true;
    this.learnStep = 0;
    this.drillIndex = 0;
    this.drillHits = 0;
    this.drillTotal = 0;

    if (phase === 'learn_board') {
      this.phase = 'learn_board';
      this.showLesson();
    } else if (phase === 'learn_technique') {
      this.phase = 'learn_technique';
      this.showLesson();
    } else if (phase === 'drill') {
      this.phase = 'drill';
      this.startDrill();
    } else if (phase === 'free') {
      this.phase = 'free';
      this.showFreePlay();
    }
    print("[Coach] Phase set to: " + phase);
  }
}