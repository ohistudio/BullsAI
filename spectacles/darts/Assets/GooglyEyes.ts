@component
export class SlimeFace extends BaseScriptComponent {

  @ui.group_start("Eyes")
  @input leftEye: SceneObject;
  @input rightEye: SceneObject;
  @input leftPupil: SceneObject;
  @input rightPupil: SceneObject;
  @ui.group_end

  @ui.group_start("Mouth")
  @input @allowUndefined mouthObj: SceneObject;
  @input @allowUndefined tongueObj: SceneObject;
  @input mouthOpenAmount: number = 0.6;
  @input tongueWiggle: boolean = true;
  @ui.group_end

  @ui.group_start("Look At")
  @input lookTarget: SceneObject;
  @input pupilRange: number = 0.3;
  @input lookSpeed: number = 8.0;
  @input leftPupilMax: vec4 = new vec4(0.3, -0.3, 0.3, -0.3);
  @input rightPupilMax: vec4 = new vec4(0.3, -0.3, 0.3, -0.3);
  @ui.group_end

  @ui.group_start("Blink")
  @input blinkMinInterval: number = 2.0;
  @input blinkMaxInterval: number = 6.0;
  @input blinkSpeed: number = 12.0;
  @ui.group_end

  @ui.group_start("Body")
  @input idleBreathing: boolean = true;
  @ui.group_end

  private leftPupilStart: vec3;
  private rightPupilStart: vec3;
  private leftEyeScale: vec3;
  private rightEyeScale: vec3;
  private mouthBaseScale: vec3;
  private tongueBasePos: vec3;
  private tongueBaseScale: vec3;
  private currentLeftOffset: vec3 = vec3.zero();
  private currentRightOffset: vec3 = vec3.zero();
  private nextBlinkTime: number = 0;
  private blinkProgress: number = 1.0;
  private blinkingClosed: boolean = false;
  private breathPhase: number = 0;
  private tonguePhase: number = 0;
  private currentMouthOpen: number = 0.6;
  private targetMouthOpen: number = 0.6;
  private expressionTimer: number = 0;

  onAwake() {
    this.createEvent("OnStartEvent").bind(() => this.onStart());
    this.createEvent("UpdateEvent").bind(() => this.onUpdate());
  }

  onStart() {
    if (!this.leftEye || !this.rightEye || !this.leftPupil || !this.rightPupil) {
      print("[Slime] ERROR: Assign all eye objects!");
      return;
    }

    this.leftPupilStart = this.leftPupil.getTransform().getLocalPosition();
    this.rightPupilStart = this.rightPupil.getTransform().getLocalPosition();
    this.leftEyeScale = this.leftEye.getTransform().getLocalScale();
    this.rightEyeScale = this.rightEye.getTransform().getLocalScale();

    if (this.mouthObj) {
      this.mouthBaseScale = this.mouthObj.getTransform().getLocalScale();
    }
    if (this.tongueObj) {
      this.tongueBasePos = this.tongueObj.getTransform().getLocalPosition();
      this.tongueBaseScale = this.tongueObj.getTransform().getLocalScale();
    }

    this.currentMouthOpen = this.mouthOpenAmount;
    this.targetMouthOpen = this.mouthOpenAmount;
    this.scheduleNextBlink();
    print("[Slime] Face ready!");
  }

  private onUpdate() {
    const dt = getDeltaTime();
    this.updateLookAt(dt);
    this.updateBlink(dt);
    this.updateMouth(dt);
    if (this.tongueWiggle && this.tongueObj) this.updateTongue(dt);
    if (this.idleBreathing) this.updateBreathing(dt);
    if (this.expressionTimer > 0) {
      this.expressionTimer -= dt;
      if (this.expressionTimer <= 0) this.resetExpression();
    }
  }

  // ─── Look At ───

  private updateLookAt(dt: number) {
    if (!this.lookTarget) return;
    const targetWorld = this.lookTarget.getTransform().getWorldPosition();
    this.updatePupil(this.leftEye, this.leftPupil, this.leftPupilStart, targetWorld, dt, true, this.leftPupilMax);
    this.updatePupil(this.rightEye, this.rightPupil, this.rightPupilStart, targetWorld, dt, false, this.rightPupilMax);
  }

  private updatePupil(eye: SceneObject, pupil: SceneObject, startPos: vec3, targetWorld: vec3, dt: number, isLeft: boolean, limits: vec4) {
    const eyeTransform = eye.getTransform();
    const eyeWorld = eyeTransform.getWorldPosition();
    const toTarget = targetWorld.sub(eyeWorld).normalize();
    const eyeRot = eyeTransform.getWorldRotation();
    const invRot = eyeRot.invert();
    const localDir = invRot.multiplyVec3(toTarget);

    const offsetX = Math.max(limits.y, Math.min(limits.x, localDir.x));
    const offsetY = Math.max(limits.w, Math.min(limits.z, localDir.y));

    const targetOffset = new vec3(offsetX, offsetY, localDir.z * this.pupilRange * 0.5);
    const current = isLeft ? this.currentLeftOffset : this.currentRightOffset;
    const smoothed = vec3.lerp(current, targetOffset, dt * this.lookSpeed);

    if (isLeft) this.currentLeftOffset = smoothed;
    else this.currentRightOffset = smoothed;

    pupil.getTransform().setLocalPosition(new vec3(
      startPos.x + smoothed.x,
      startPos.y + smoothed.y,
      startPos.z + smoothed.z
    ));
  }

  // ─── Blink ───

  private scheduleNextBlink() {
    this.nextBlinkTime = getTime() + this.blinkMinInterval +
      Math.random() * (this.blinkMaxInterval - this.blinkMinInterval);
  }

  private updateBlink(dt: number) {
    const now = getTime();
    if (now >= this.nextBlinkTime && this.blinkProgress >= 1.0) {
      this.blinkingClosed = true;
    }
    if (this.blinkingClosed) {
      this.blinkProgress -= dt * this.blinkSpeed;
      if (this.blinkProgress <= 0.0) { this.blinkProgress = 0.0; this.blinkingClosed = false; }
    } else if (this.blinkProgress < 1.0) {
      this.blinkProgress += dt * this.blinkSpeed;
      if (this.blinkProgress >= 1.0) { this.blinkProgress = 1.0; this.scheduleNextBlink(); }
    }

    const b = Math.max(0.05, this.blinkProgress);
    this.leftEye.getTransform().setLocalScale(new vec3(this.leftEyeScale.x, this.leftEyeScale.y * b, this.leftEyeScale.z));
    this.rightEye.getTransform().setLocalScale(new vec3(this.rightEyeScale.x, this.rightEyeScale.y * b, this.rightEyeScale.z));
  }

  // ─── Mouth ───

  private updateMouth(dt: number) {
    this.currentMouthOpen += (this.targetMouthOpen - this.currentMouthOpen) * dt * 8.0;
    if (this.mouthObj && this.mouthBaseScale) {
      const openScale = 0.3 + this.currentMouthOpen * 0.7;
      this.mouthObj.getTransform().setLocalScale(new vec3(
        this.mouthBaseScale.x,
        this.mouthBaseScale.y * openScale,
        this.mouthBaseScale.z
      ));
    }
  }

  // ─── Tongue ───

  private updateTongue(dt: number) {
    this.tonguePhase += dt * 2.5;
    const wiggleX = Math.sin(this.tonguePhase) * 0.03;
    const tongueOut = this.currentMouthOpen * 0.15;

    this.tongueObj.getTransform().setLocalPosition(new vec3(
      this.tongueBasePos.x + wiggleX,
      this.tongueBasePos.y,
      this.tongueBasePos.z + tongueOut
    ));

    const s = 0.7 + this.currentMouthOpen * 0.3;
    this.tongueObj.getTransform().setLocalScale(new vec3(
      this.tongueBaseScale.x * s,
      this.tongueBaseScale.y * s,
      this.tongueBaseScale.z
    ));
  }

  // ─── Breathing ───

  private updateBreathing(dt: number) {
    this.breathPhase += dt * 1.5;
    const b = Math.sin(this.breathPhase) * 0.03;
    this.getSceneObject().getTransform().setLocalScale(new vec3(1 + b, 1 - b * 0.5, 1 + b));
  }

  // ─── Expressions ───

  private resetExpression() {
    this.leftEye.getTransform().setLocalRotation(quat.quatIdentity());
    this.rightEye.getTransform().setLocalRotation(quat.quatIdentity());
    this.targetMouthOpen = this.mouthOpenAmount;
  }

  public doBlink() { this.blinkingClosed = true; }

  public surprise() {
    this.expressionTimer = 1.0;
    this.targetMouthOpen = 1.0;
    const s = 1.3;
    this.leftEye.getTransform().setLocalScale(new vec3(this.leftEyeScale.x * s, this.leftEyeScale.y * s, this.leftEyeScale.z * s));
    this.rightEye.getTransform().setLocalScale(new vec3(this.rightEyeScale.x * s, this.rightEyeScale.y * s, this.rightEyeScale.z * s));
  }

  public sad() {
    this.expressionTimer = 2.0;
    this.targetMouthOpen = 0.2;
    this.leftEye.getTransform().setLocalScale(new vec3(this.leftEyeScale.x, this.leftEyeScale.y * 0.7, this.leftEyeScale.z));
    this.rightEye.getTransform().setLocalScale(new vec3(this.rightEyeScale.x, this.rightEyeScale.y * 0.7, this.rightEyeScale.z));
  }

  public angry() {
    this.expressionTimer = 1.5;
    this.targetMouthOpen = 0.8;
    this.leftEye.getTransform().setLocalScale(new vec3(this.leftEyeScale.x * 1.1, this.leftEyeScale.y * 0.5, this.leftEyeScale.z));
    this.rightEye.getTransform().setLocalScale(new vec3(this.rightEyeScale.x * 1.1, this.rightEyeScale.y * 0.5, this.rightEyeScale.z));
    this.leftEye.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, -15 * Math.PI / 180));
    this.rightEye.getTransform().setLocalRotation(quat.fromEulerAngles(0, 0, 15 * Math.PI / 180));
  }

  public dartHitReaction(zone: string) {
    if (zone.includes('Bullseye') || zone.includes('Double') || zone.includes('Triple')) {
      this.surprise();
    } else if (zone.includes('Miss')) {
      this.sad();
    } else {
      this.doBlink();
    }
  }
}