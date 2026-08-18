/* GRID GUARDIAN ------------------------------------------------------------
   Version 1 is deliberately procedural. Future GLB loading belongs at the
   marked replacement point in ControlRoomEngine.createRobot(), while plant,
   fault, SCADA, camera, and interaction logic remain unchanged. */
window.ControlRoom = (() => {
  const THREE_URL = "https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js";
  const GLTF_LOADER_URL = "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/loaders/GLTFLoader.js";
  const ROOM_ENVIRONMENT_URL = "https://cdn.jsdelivr.net/npm/three@0.165.0/examples/jsm/environments/RoomEnvironment.js";
  const WEB_LITE_MODEL_URL = "assets/models/CatBot_Control_Room_WEB_LITE.glb";
  // WEB_LITE is the validated production asset. The editable Blender master is
  // retained locally but deliberately excluded from the published site.
  const MODEL_URL = WEB_LITE_MODEL_URL;
  const GRID_HASH = "#grid-guardian";
  const QUALITY_PRESETS = Object.freeze({
    HIGH: { pixelRatio: 1.5, anisotropy: 8, shadowMapSize: 1024, shadowRefreshInterval: .033, environmentIntensity: .34, environmentMapIntensity: .55, shadowCasters: /catbot|console|generator|transformer|switchgear|hvac|chair/i },
    BALANCED: { pixelRatio: 1.25, anisotropy: 4, shadowMapSize: 768, shadowRefreshInterval: .066, environmentIntensity: .3, environmentMapIntensity: .38, shadowCasters: /catbot|console|generator|transformer|switchgear|hvac/i },
    LOW: { pixelRatio: .85, anisotropy: 2, shadowMapSize: 512, shadowRefreshInterval: .12, environmentIntensity: .25, environmentMapIntensity: .25, shadowCasters: /catbot|console/i },
    MOBILE: { pixelRatio: 1.1, anisotropy: 2, shadowMapSize: 0, shadowRefreshInterval: Infinity, environmentIntensity: .24, environmentMapIntensity: .22, shadowCasters: /$^/ },
    MOBILE_LOW: { pixelRatio: .9, anisotropy: 1, shadowMapSize: 0, shadowRefreshInterval: Infinity, environmentIntensity: .22, environmentMapIntensity: .18, shadowCasters: /$^/ }
  });
  let importPromise;
  let gltfLoaderPromise;
  let presentationPromise;
  let active = false;
  let engine;
  let returnFocus;

  const navigationTargetNames = Object.freeze({ generator: "NAV_CatBot_GENERATOR", breaker: "NAV_CatBot_SWITCHGEAR", cooling: "NAV_CatBot_HVAC", demand: "NAV_CatBot_TRANSFORMER", master: "NAV_CatBot_HOME" });

  function shell() { return document.getElementById("controlRoomShell"); }
  function roomRoot() { return document.getElementById("controlRoom"); }
  function loadThree() { return importPromise || (importPromise = import(THREE_URL)); }
  function loadGltfLoader() { return gltfLoaderPromise || (gltfLoaderPromise = import(GLTF_LOADER_URL)); }
  function loadPresentationModules() {
    return presentationPromise || (presentationPromise = import(ROOM_ENVIRONMENT_URL).then((roomEnvironment) => ({ RoomEnvironment: roomEnvironment.RoomEnvironment })));
  }

  function createShell() {
    const root = shell();
    root.replaceChildren();
    root.innerHTML = `
      <div class="cr-canvas" data-cr-canvas aria-label="Interactive 3D grid control room"></div>
      <header class="cr-topbar"><div><p class="cr-kicker">ENTERTAINMENT MODULE // FINAL BLENDER CONTROL ROOM</p><h2>GRID <span>GUARDIAN</span></h2></div><div class="cr-topbar-actions"><button class="cr-reset" type="button" data-cr-reset>Reset View</button><button class="cr-sound" type="button" data-cr-sound aria-pressed="false">Sound off</button><button class="cr-exit" type="button" data-cr-exit>Exit Control Room</button></div></header>
      <aside class="cr-scada" aria-live="polite"><div class="cr-panel-title">Ontario Smart Grid <span>SCADA LIVE</span></div><dl class="cr-metrics"><div><dt>GENERATION</dt><dd data-cr-generation>842 MW</dd></div><div><dt>DEMAND</dt><dd data-cr-demand>791 MW</dd></div><div><dt>FREQUENCY</dt><dd data-cr-frequency>60.0 Hz</dd></div><div><dt>TEMPERATURE</dt><dd data-cr-temperature>24 C</dd></div><div class="cr-status-cell"><dt>GRID STATUS</dt><dd data-cr-status>STABLE</dd></div></dl><p class="cr-alarm" data-cr-alarm>ACTIVE ALARM: NONE</p></aside>
      <section class="cr-robot-readout" aria-live="polite"><p>GRID GUARDIAN // ROBO PET</p><strong data-cr-robot>PEACEFUL IDLE</strong><span data-cr-irritation>VISITOR IRRITATION: 0 / 8</span></section>
      <p class="cr-help">Drag to look around. Click 3D controls or use the control strip.</p>
      <nav class="cr-control-dock" aria-label="Control room fault simulations"><button class="cr-control-button" type="button" data-cr-fault="generator">Stop generator</button><button class="cr-control-button" type="button" data-cr-fault="breaker">Open breaker</button><button class="cr-control-button" type="button" data-cr-fault="cooling">Cooling off</button><button class="cr-control-button" type="button" data-cr-fault="demand">Increase demand</button><button class="cr-control-button is-danger" type="button" data-cr-fault="master">Master power</button></nav>
      <div class="cr-loading"><div><strong data-cr-loading-title>Loading Control Room... <span data-cr-loading-progress>0%</span></strong><p data-cr-loading-detail>Streaming the optimized Blender control room and CatBot assets.</p></div></div>`;
    root.querySelector("[data-cr-exit]").addEventListener("click", exit);
    root.querySelector("[data-cr-sound]").addEventListener("click", () => engine?.toggleSound());
    root.querySelector("[data-cr-reset]").addEventListener("click", () => engine?.resetView());
    root.querySelectorAll("[data-cr-fault]").forEach((button) => button.addEventListener("click", () => engine?.triggerFault(button.dataset.crFault)));
    return root;
  }

  function setFallback(message) {
    const root = shell();
    root.querySelector(".cr-loading")?.remove();
    const fallback = document.createElement("div");
    fallback.className = "cr-fallback";
    fallback.innerHTML = `<div><h3>3D graphics unavailable</h3><p>${message}</p><button type="button">Return to portfolio</button></div>`;
    fallback.querySelector("button").addEventListener("click", exit);
    root.append(fallback);
  }

  function updateHud(plant, robot, busy) {
    const root = shell();
    if (!root) return;
    const set = (name, value) => { const node = root.querySelector(`[data-cr-${name}]`); if (node) node.textContent = value; };
    set("generation", `${Math.round(plant.generation)} MW`);
    set("demand", `${Math.round(plant.demand)} MW`);
    set("frequency", `${plant.frequency.toFixed(1)} Hz`);
    set("temperature", `${Math.round(plant.temperature)} C`);
    const status = root.querySelector("[data-cr-status]");
    if (status) { status.textContent = plant.gridStatus; status.className = plant.gridStatus === "STABLE" ? "" : plant.masterPower ? "is-warning" : "is-alarm"; }
    const alarm = root.querySelector("[data-cr-alarm]");
    if (alarm) { alarm.textContent = `ACTIVE ALARM: ${plant.activeAlarm || "NONE"}`; alarm.classList.toggle("is-active", Boolean(plant.activeAlarm)); }
    set("robot", robot.readout());
    set("irritation", `VISITOR IRRITATION: ${robot.irritation} / 8`);
    root.querySelectorAll("[data-cr-fault]").forEach((button) => { button.disabled = busy; });
  }

  class PlantState {
    constructor() { this.reset(); }
    reset() { Object.assign(this, { generation: 842, demand: 791, frequency: 60, temperature: 24, generatorOnline: true, breakerClosed: true, coolingOnline: true, gridStatus: "STABLE", activeAlarm: "", masterPower: true, powerLevel: 1, scenario: "", busy: false, recoveryMode: "", recoveryElapsed: 0, recoveryDuration: 0, recoveryComplete: false }); }
    begin(type) {
      if (this.busy) return false;
      this.busy = true; this.scenario = type;
      if (type === "generator") Object.assign(this, { generatorOnline: false, generation: 320, frequency: 59.3, gridStatus: "WARNING", activeAlarm: "GENERATOR OFFLINE" });
      if (type === "breaker") Object.assign(this, { breakerClosed: false, gridStatus: "UNSTABLE", activeAlarm: "GRID BREAKER OPEN" });
      if (type === "cooling") Object.assign(this, { coolingOnline: false, temperature: 30, gridStatus: "WARNING", activeAlarm: "COOLING SYSTEM OFFLINE" });
      if (type === "demand") Object.assign(this, { demand: 968, frequency: 59.2, gridStatus: "AI LOAD BALANCING", activeAlarm: "DEMAND SURGE" });
      if (type === "master") Object.assign(this, { masterPower: false, powerLevel: 0, generatorOnline: false, generation: 0, frequency: 0, gridStatus: "EMERGENCY MODE", activeAlarm: "MASTER POWER OFF" });
      return true;
    }
    startSpecialRecovery(type) {
      if (!this.busy || this.scenario !== type || (type !== "master" && type !== "demand")) return false;
      this.recoveryMode = type;
      this.recoveryElapsed = 0;
      this.recoveryDuration = type === "master" ? 3.2 : 2.7;
      this.recoveryComplete = false;
      if (type === "master") Object.assign(this, { masterPower: true, powerLevel: .12, gridStatus: "SYSTEM RECOVERY", activeAlarm: "RESTORING BUS" });
      if (type === "demand") Object.assign(this, { gridStatus: "AI LOAD BALANCING", activeAlarm: "OPTIMIZING DISTRIBUTION" });
      console.info(`Plant ${type} recovery started.`, { duration: this.recoveryDuration });
      return true;
    }
    isSpecialRecoveryComplete(type) { return this.recoveryComplete && this.scenario === type; }
    update(delta) {
      if (this.scenario === "cooling" && !this.coolingOnline) this.temperature = Math.min(39, this.temperature + delta * 1.9);
      if (!this.recoveryMode || this.recoveryComplete) return;
      this.recoveryElapsed = Math.min(this.recoveryDuration, this.recoveryElapsed + delta);
      const progress = this.recoveryDuration ? this.recoveryElapsed / this.recoveryDuration : 1;
      if (this.recoveryMode === "master") {
        this.powerLevel = .12 + progress * .88;
        this.generation = 842 * progress;
        this.frequency = 60 * progress;
        this.generatorOnline = progress > .56;
        this.gridStatus = "SYSTEM RECOVERY";
        this.activeAlarm = progress < .72 ? "RESTORING BUS" : "SYSTEM RECOVERY";
      }
      if (this.recoveryMode === "demand") {
        this.demand = 968 + (791 - 968) * progress;
        this.frequency = 59.2 + (.8 * progress);
        this.gridStatus = progress < .46 ? "AI LOAD BALANCING" : "STABILIZING GRID";
        this.activeAlarm = progress < .64 ? "OPTIMIZING DISTRIBUTION" : "DEMAND SURGE CONTAINED";
      }
      if (progress >= 1) {
        this.recoveryComplete = true;
        this.recoveryMode = "";
        if (this.scenario === "master") Object.assign(this, { generation: 842, demand: 791, frequency: 60, generatorOnline: true, gridStatus: "SYSTEM RECOVERY", activeAlarm: "SYSTEM RECOVERY" });
        if (this.scenario === "demand") Object.assign(this, { demand: 791, frequency: 60, gridStatus: "STABILIZING GRID", activeAlarm: "DEMAND BALANCED" });
      }
    }
    recover() { this.reset(); }
  }

  class ToneManager {
    constructor() { this.enabled = false; this.context = null; }
    toggle() { this.enabled = !this.enabled; if (this.enabled && !this.context) this.context = new (window.AudioContext || window.webkitAudioContext)(); if (this.enabled) this.context?.resume(); return this.enabled; }
    play(kind) { if (!this.enabled || !this.context) return; const oscillator = this.context.createOscillator(); const gain = this.context.createGain(); const map = { click: [440, .05], alarm: [170, .16], repair: [650, .09], power: [90, .24] }; const [frequency, length] = map[kind] || map.click; oscillator.frequency.value = frequency; oscillator.type = kind === "alarm" ? "square" : "sine"; gain.gain.setValueAtTime(.035, this.context.currentTime); gain.gain.exponentialRampToValueAtTime(.0001, this.context.currentTime + length); oscillator.connect(gain).connect(this.context.destination); oscillator.start(); oscillator.stop(this.context.currentTime + length); }
  }

  class RobotFace {
    constructor(THREE) { this.THREE = THREE; this.canvas = document.createElement("canvas"); this.canvas.width = 512; this.canvas.height = 256; this.texture = new THREE.CanvasTexture(this.canvas); this.expression = "happy"; this.blink = false; this.timer = 1.8; this.draw(); }
    set(expression) { if (this.expression !== expression) { this.expression = expression; this.draw(); } }
    update(delta) { this.timer -= delta; if (this.timer <= 0) { this.blink = !this.blink; this.timer = this.blink ? .11 : 2.2 + Math.random() * 1.8; this.draw(); } }
    draw() {
      const ctx = this.canvas.getContext("2d"); const { expression, blink } = this;
      ctx.fillStyle = "#030a11"; ctx.fillRect(0, 0, 512, 256); ctx.strokeStyle = "rgba(77,222,255,.14)"; ctx.lineWidth = 1;
      for (let x = 0; x < 512; x += 32) ctx.strokeRect(x, 0, 1, 256);
      const eye = (x, y, tilt = 0, scale = 1) => { ctx.save(); ctx.translate(x, y); ctx.rotate(tilt); ctx.fillStyle = "#91f1ff"; ctx.shadowColor = "#40d9ff"; ctx.shadowBlur = 20; if (blink || expression === "exhausted") { ctx.fillRect(-42 * scale, -4, 84 * scale, 8); } else { ctx.beginPath(); ctx.ellipse(0, 0, 37 * scale, 29 * scale, 0, 0, Math.PI * 2); ctx.fill(); ctx.fillStyle = "#062037"; ctx.beginPath(); ctx.arc(expression === "suspicious" ? 10 : 0, 2, 10, 0, Math.PI * 2); ctx.fill(); } ctx.restore(); };
      const leftTilt = expression === "angry" ? -.32 : expression === "suspicious" ? .16 : 0; const rightTilt = expression === "angry" ? .32 : expression === "suspicious" ? -.16 : 0;
      eye(170, 105, leftTilt, expression === "surprised" || expression === "panic" ? 1.18 : 1); eye(342, 105, rightTilt, expression === "surprised" || expression === "panic" ? 1.18 : 1);
      ctx.strokeStyle = "#91f1ff"; ctx.lineWidth = 12; ctx.lineCap = "round"; ctx.shadowColor = "#40d9ff"; ctx.shadowBlur = 15; ctx.beginPath();
      if (expression === "happy" || expression === "proud") ctx.arc(256, 145, 42, .14, Math.PI - .14); else if (expression === "panic" || expression === "surprised") ctx.arc(256, 165, 14, 0, Math.PI * 2); else if (expression === "angry") { ctx.moveTo(215, 175); ctx.lineTo(297, 175); } else if (expression === "exhausted") { ctx.moveTo(220, 165); ctx.quadraticCurveTo(256, 153, 292, 165); } else { ctx.moveTo(222, 164); ctx.quadraticCurveTo(256, 174, 290, 164); } ctx.stroke();
      if (expression === "angry" || expression === "suspicious") { ctx.lineWidth = 10; ctx.beginPath(); ctx.moveTo(130, 61); ctx.lineTo(205, expression === "angry" ? 77 : 56); ctx.moveTo(307, expression === "angry" ? 77 : 56); ctx.lineTo(382, 61); ctx.stroke(); }
      this.texture.needsUpdate = true;
    }
    dispose() { this.texture.dispose(); }
  }

  class RobotController {
    constructor(THREE, scene) { this.THREE = THREE; this.scene = scene; this.irritation = 0; this.state = "IDLE"; this.stateTime = 0; this.plan = null; this.workstation = new THREE.Vector3(-1.8, 0, -1.1); this.face = new RobotFace(THREE); this.group = this.createProceduralRobot(); this.group.position.copy(this.workstation); scene.add(this.group); }
    /* Future GLB replacement point: return a loaded grid-guardian-robot.glb
       group here. Keep face/state methods on this controller so the rest of
       the control room does not depend on the temporary geometry. */
    createProceduralRobot() {
      const T = this.THREE; const group = new T.Group(); const white = new T.MeshStandardMaterial({ color: 0xd8edf3, metalness: .62, roughness: .28 }); const dark = new T.MeshStandardMaterial({ color: 0x07101a, metalness: .78, roughness: .18 }); const cyan = new T.MeshStandardMaterial({ color: 0x2bcfff, emissive: 0x087daa, emissiveIntensity: 1.1 });
      const body = new T.Mesh(new T.SphereGeometry(.56, 24, 18), white); body.scale.set(1, 1.12, .76); body.position.y = 1.12; group.add(body);
      const head = new T.Group(); head.position.y = 1.92; const headShell = new T.Mesh(new T.SphereGeometry(.78, 28, 20), white); headShell.scale.set(1.12, .82, .72); head.add(headShell); const face = new T.Mesh(new T.PlaneGeometry(1.25, .63), new T.MeshBasicMaterial({ map: this.face.texture })); face.position.z = .59; head.add(face); const hat = new T.Mesh(new T.CylinderGeometry(.49, .6, .18, 20), white); hat.position.y = .63; head.add(hat); group.add(head);
      const armL = new T.Group(); const armR = new T.Group(); [[armL, -.66], [armR, .66]].forEach(([arm, x]) => { arm.position.set(x, 1.25, 0); const part = new T.Mesh(new T.CapsuleGeometry(.13, .38, 6, 12), white); part.rotation.z = x < 0 ? .28 : -.28; part.position.y = -.26; arm.add(part); group.add(arm); });
      const legL = new T.Group(); const legR = new T.Group(); [[legL, -.25], [legR, .25]].forEach(([leg, x]) => { leg.position.set(x, .63, 0); const part = new T.Mesh(new T.CapsuleGeometry(.15, .34, 5, 12), dark); part.position.y = -.26; leg.add(part); group.add(leg); });
      const belt = new T.Mesh(new T.TorusGeometry(.48, .06, 8, 20), cyan); belt.rotation.x = Math.PI / 2; belt.position.set(0, 1.05, .48); group.add(belt); const badge = new T.Mesh(new T.CircleGeometry(.12, 16), cyan); badge.position.set(.27, 1.23, .55); group.add(badge);
      this.parts = { body, head, armL, armR, legL, legR }; return group;
    }
    setRobotExpression(expression) { this.face.set(expression); }
    setState(state, expression) { this.state = state; this.stateTime = 0; if (expression) this.setRobotExpression(expression); }
    beginRecovery(type, target, repair) { this.irritation = Math.min(8, this.irritation + 1); this.plan = { type, target: new this.THREE.Vector3(...target), repair, repaired: false }; const angry = this.irritation >= 5 || type === "master"; this.setState("NOTICE_FAULT", angry ? "angry" : "surprised"); }
    moveToward(target, speed, delta) { const direction = target.clone().sub(this.group.position); direction.y = 0; const distance = direction.length(); if (distance < .12) return true; direction.normalize(); this.group.position.addScaledVector(direction, Math.min(distance, speed * delta)); const desired = Math.atan2(direction.x, direction.z); this.group.rotation.y += Math.atan2(Math.sin(desired - this.group.rotation.y), Math.cos(desired - this.group.rotation.y)) * Math.min(1, delta * 8); return false; }
    update(delta, elapsed) {
      this.stateTime += delta; this.face.update(delta); const moving = this.state === "RUNNING_TO_PANEL" || this.state === "RETURNING"; const pulse = Math.sin(elapsed * (moving ? 13 : 3)); this.parts.body.position.y = 1.12 + (moving ? Math.abs(pulse) * .1 : pulse * .025); this.parts.armL.rotation.z = moving ? .55 * pulse : .08 * pulse; this.parts.armR.rotation.z = moving ? -.55 * pulse : -.08 * pulse; this.parts.legL.rotation.x = moving ? -.6 * pulse : 0; this.parts.legR.rotation.x = moving ? .6 * pulse : 0; this.parts.head.rotation.y = moving ? 0 : Math.sin(elapsed * .9) * .12;
      if (this.state === "IDLE") { this.setRobotExpression(this.irritation >= 7 ? "exhausted" : this.irritation >= 3 ? "suspicious" : "happy"); return; }
      if (this.state === "NOTICE_FAULT" && this.stateTime > (this.plan.type === "master" ? 1.05 : .65)) this.setState("RUNNING_TO_PANEL", this.irritation >= 5 ? "angry" : "panic");
      if (this.state === "RUNNING_TO_PANEL" && this.moveToward(this.plan.target, 3.3, delta)) this.setState("REPAIRING", "suspicious");
      if (this.state === "REPAIRING") { this.parts.armR.rotation.z = -.9 + Math.sin(elapsed * 12) * .24; if (!this.plan.repaired && this.stateTime > 1.55) { this.plan.repaired = true; this.plan.repair(); } if (this.stateTime > 2.15) this.setState("VERIFYING", "proud"); }
      if (this.state === "VERIFYING" && this.stateTime > .8) this.setState("ANGRY", this.irritation >= 7 ? "exhausted" : "suspicious");
      if (this.state === "ANGRY" && this.stateTime > 1.25) this.setState("RETURNING", this.irritation >= 7 ? "exhausted" : "angry");
      if (this.state === "RETURNING" && this.moveToward(this.workstation, 1.8, delta)) this.setState("IDLE");
    }
    readout() { return this.state.replaceAll("_", " "); }
    dispose() { this.face.dispose(); }
  }

  /* The Blender CatBot controller owns the real AnimationMixer and exported
     navigation targets. Only the first HOME -> GENERATOR -> HOME route is
     implemented here; the remaining equipment stays simulation-only. */
  class CatBotController {
    constructor(THREE, root, clips, navigationTargets, inspection) {
      this.THREE = THREE;
      this.group = root;
      this.clips = clips;
      this.navigationTargets = navigationTargets;
      this.inspection = inspection;
      this.irritation = 0;
      this.state = "IDLE";
      this.stateTime = 0;
      this.plan = null;
      this.mixer = new THREE.AnimationMixer(root);
      this.fadeDuration = .32;
      this.walkSpeed = 1.35;
      this.arrivalTolerance = .035;
      this.turnRate = 6.5;
      this.turnTolerance = .025;
      this.pendingStops = [];
      this.travelY = null;
      this.walkTimeScale = 1;
      this.walkLoopBlendDuration = .16;
      this.walkLoopLeadTime = .05;
      this.walkCycleCount = 0;
      this.walkIsActive = false;
      this.idleClip = clips.find((clip) => clip.name === "CatBot_IDLE_Action") || clips.find((clip) => /idle/i.test(clip.name));
      this.walkClip = clips.find((clip) => clip.name === "CatBot_WALK_Action_FINAL");
      this.repairClip = clips.find((clip) => clip.name === "CatBot_REPAIR_Action");
      this.idleAction = this.idleClip ? this.mixer.clipAction(this.idleClip) : null;
      this.walkActions = this.createSeamlessWalkActions();
      this.walkAction = this.walkActions[0] || null;
      this.repairAction = this.repairClip ? this.mixer.clipAction(this.repairClip) : null;
      this.currentAction = null;
      this.homeLocalQuaternion = root.quaternion.clone();
      this.homeLocalPosition = root.position.clone();
      this.onAnimationFinished = (event) => {
        if (event.action !== this.repairAction || this.state !== "REPAIRING" || !this.plan) return;
        console.info(`CatBot ${this.plan.equipmentName || "GENERATOR"} repair completed.`);
        this.plan.repaired = true;
        this.plan.repair();
        if (this.plan.specialConsole) {
          this.state = "SPECIAL_SYSTEM_RECOVERY";
          this.stateTime = 0;
          console.info(`CatBot ${this.plan.type} special recovery is waiting for plant stabilization.`);
          return;
        }
        if (this.plan.generalizedRoute) this.startGenericReturnRotation();
        else this.startReturnRotation();
      };
      this.mixer.addEventListener("finished", this.onAnimationFinished);
      this.configureActions();
      this.restoreIdle(false);
    }
    configureActions() {
      const T = this.THREE;
      if (this.idleAction) { this.idleAction.setLoop(T.LoopRepeat, Infinity); this.idleAction.clampWhenFinished = false; }
      this.walkActions.forEach((action) => { action.setLoop(T.LoopRepeat, Infinity); action.clampWhenFinished = false; action.setEffectiveTimeScale(this.walkTimeScale); action.setEffectiveWeight(1); });
      if (this.repairAction) { this.repairAction.setLoop(T.LoopOnce, 1); this.repairAction.clampWhenFinished = true; }
    }
    createSeamlessWalkActions() {
      if (!this.walkClip) return [];
      const T = this.THREE;
      const rootMotionTrack = this.walkClip.tracks.find((track) => /(^|[./])Hips\.position$/i.test(track.name));
      const makeRuntimeClip = (suffix) => {
        const tracks = this.walkClip.tracks.map((track) => {
          if (track !== rootMotionTrack) return track.clone();
          const valueSize = track.getValueSize();
          const firstValue = Array.from(track.values.slice(0, valueSize));
          return new T.VectorKeyframeTrack(track.name, [0, this.walkClip.duration], [...firstValue, ...firstValue]);
        });
        return new T.AnimationClip(`${this.walkClip.name}_SEAMLESS_${suffix}`, this.walkClip.duration, tracks, this.walkClip.blendMode);
      };
      const actions = ["A", "B"].map((suffix) => this.mixer.clipAction(makeRuntimeClip(suffix)));
      console.info("CatBot seamless WALK runtime prepared:", { clip: this.walkClip.name, duration: this.walkClip.duration, rootMotionAnchored: Boolean(rootMotionTrack), loopBlend: this.walkLoopBlendDuration });
      return actions;
    }
    isBusy() { return Boolean(this.plan) || this.state !== "IDLE"; }
    prepareAction(action, timeScale = 1) {
      if (!action) return null;
      this.pendingStops = this.pendingStops.filter((pending) => pending.action !== action);
      action.enabled = true;
      action.setEffectiveTimeScale(timeScale);
      action.setEffectiveWeight(1);
      return action;
    }
    fadeOutAndStop(action, duration = this.fadeDuration) {
      if (!action) return;
      action.fadeOut(duration);
      this.pendingStops.push({ action, remaining: duration + .04 });
    }
    fadeTo(action, timeScale = 1) {
      if (!action) return false;
      if (this.currentAction === action && action.isRunning()) return true;
      const previous = this.currentAction;
      this.prepareAction(action, timeScale).reset().fadeIn(this.fadeDuration).play();
      if (previous && previous !== action) this.fadeOutAndStop(previous);
      this.currentAction = action;
      return true;
    }
    stopCurrentAction() {
      if (!this.currentAction) return;
      this.fadeOutAndStop(this.currentAction);
      this.currentAction = null;
    }
    updatePendingStops(delta) {
      this.pendingStops = this.pendingStops.filter((pending) => {
        pending.remaining -= delta;
        if (pending.remaining > 0 || pending.action === this.currentAction) return true;
        pending.action.stop();
        return false;
      });
    }
    activeWalkTime() { return Number((this.walkAction?.time || 0).toFixed(3)); }
    startContinuousWalk(label) {
      const next = this.walkActions[(this.walkCycleCount + 1) % this.walkActions.length];
      if (!next) return false;
      this.walkCycleCount = 0;
      this.walkIsActive = true;
      this.walkAction = next;
      this.fadeTo(next, this.walkTimeScale);
      console.info("CatBot WALK started:", { label, timeScale: this.walkTimeScale, action: next.getClip().name });
      return true;
    }
    updateSeamlessWalkLoop() {
      if (!this.walkIsActive || !this.walkAction?.isRunning() || this.walkActions.length < 2) return;
      const handoffTime = this.walkClip.duration - this.walkLoopBlendDuration - this.walkLoopLeadTime;
      if (this.walkAction.time < handoffTime) return;
      const previous = this.walkAction;
      const next = this.walkActions.find((action) => action !== previous);
      if (!next) return;
      this.prepareAction(next, this.walkTimeScale).reset().fadeIn(this.walkLoopBlendDuration).play();
      this.fadeOutAndStop(previous, this.walkLoopBlendDuration);
      this.walkAction = next;
      this.currentAction = next;
      this.walkCycleCount += 1;
    }
    stopContinuousWalk(label) {
      if (!this.walkIsActive) return;
      console.info("CatBot WALK stopped:", { label, time: this.activeWalkTime(), cycles: this.walkCycleCount });
      this.walkIsActive = false;
    }
    rootWorldPosition() {
      this.group.updateMatrixWorld(true);
      return this.group.getWorldPosition(new this.THREE.Vector3());
    }
    markerWorldPosition(marker) { return marker.getWorldPosition(new this.THREE.Vector3()); }
    setRootWorldPosition(position) {
      const local = position.clone();
      if (this.group.parent) this.group.parent.worldToLocal(local);
      this.group.position.copy(local);
      this.group.updateMatrixWorld(true);
    }
    rotateTowardWorldPosition(destination, delta) {
      const current = this.rootWorldPosition();
      const direction = destination.clone().sub(current);
      direction.y = 0;
      if (direction.lengthSq() < 1e-8) return true;
      direction.normalize();
      const desiredWorld = new this.THREE.Quaternion().setFromAxisAngle(new this.THREE.Vector3(0, 1, 0), Math.atan2(direction.x, direction.z));
      const desiredLocal = desiredWorld.clone();
      if (this.group.parent) {
        const parentWorld = this.group.parent.getWorldQuaternion(new this.THREE.Quaternion());
        desiredLocal.premultiply(parentWorld.invert());
      }
      this.group.quaternion.slerp(desiredLocal, 1 - Math.exp(-this.turnRate * delta));
      this.group.updateMatrixWorld(true);
      return this.group.quaternion.angleTo(desiredLocal) <= this.turnTolerance;
    }
    rotateToHomeOrientation(delta) {
      this.group.quaternion.slerp(this.homeLocalQuaternion, 1 - Math.exp(-this.turnRate * delta));
      this.group.updateMatrixWorld(true);
      return this.group.quaternion.angleTo(this.homeLocalQuaternion) <= this.turnTolerance;
    }
    moveTowardMarker(marker, delta) {
      const current = this.rootWorldPosition();
      const destination = this.markerWorldPosition(marker);
      destination.y = this.travelY;
      const direction = destination.clone().sub(current);
      direction.y = 0;
      const distance = direction.length();
      if (distance <= this.arrivalTolerance) {
        if (distance > 0) this.setRootWorldPosition(destination);
        return true;
      }
      const step = Math.min(distance, this.walkSpeed * delta);
      direction.multiplyScalar(1 / distance);
      const next = current.addScaledVector(direction, step);
      next.y = this.travelY;
      this.setRootWorldPosition(next);
      return step === distance;
    }
    isAtMarker(marker) {
      if (!marker) return false;
      const current = this.rootWorldPosition();
      const destination = this.markerWorldPosition(marker);
      destination.y = current.y;
      return current.distanceTo(destination) <= this.arrivalTolerance * 1.5;
    }
    segmentClearsPlanar(start, end, obstacleBoxes, clearance) {
      const distance = start.distanceTo(end);
      const samples = Math.max(2, Math.ceil(distance / .05));
      for (const { name, box } of obstacleBoxes) {
        const expanded = box.clone().expandByScalar(clearance);
        for (let index = 0; index <= samples; index += 1) {
          const point = start.clone().lerp(end, index / samples);
          if (point.x > expanded.min.x && point.x < expanded.max.x && point.z > expanded.min.z && point.z < expanded.max.z) {
            return { clear: false, obstacle: name };
          }
        }
      }
      return { clear: true };
    }
    getRouteDefinition(type) {
      return {
        generator: { equipmentName: "GENERATOR", assetName: "Asset_Generator", side: "right", waypointName: "GENERATOR_ROUTE_WAYPOINT_RIGHT" },
        demand: { equipmentName: "TRANSFORMER", assetName: "Asset_Transformer", side: "left", waypointName: "TRANSFORMER_ROUTE_WAYPOINT_LEFT" },
        breaker: { equipmentName: "SWITCHGEAR", assetName: "Asset_switchgear", side: "left", waypointName: "SWITCHGEAR_ROUTE_WAYPOINT_LEFT", aisleMarkerName: "NAV_CatBot_TRANSFORMER" },
        cooling: { equipmentName: "HVAC", assetName: "Asset_HVAC", side: "right", waypointName: "HVAC_ROUTE_WAYPOINT_RIGHT", aisleMarkerName: "NAV_CatBot_GENERATOR" }
      }[type] || null;
    }
    createSafeAisleWaypoint(route, homeTarget, destinationTarget) {
      const T = this.THREE;
      const sceneRoot = this.group.parent;
      const consoleObject = sceneRoot?.getObjectByName("Asset_ControlConsole");
      if (!sceneRoot || !consoleObject) {
        console.warn(`CatBot ${route.equipmentName} route could not inspect the control console.`);
        return null;
      }
      sceneRoot.updateMatrixWorld(true);
      const consoleBox = new T.Box3().setFromObject(consoleObject);
      const robotSize = new T.Box3().setFromObject(this.group).getSize(new T.Vector3());
      // HOME is intentionally close behind the console; use CatBot's measured half-width plus a visual buffer,
      // rather than a broad whole-robot radius that would reject its valid starting position.
      const clearance = Math.max(.46, Math.min(.5, Math.max(robotSize.x, robotSize.z) * .44));
      const home = this.markerWorldPosition(homeTarget);
      const destination = this.markerWorldPosition(destinationTarget);
      const aisleReferenceTarget = route.aisleMarkerName ? this.navigationTargets[route.aisleMarkerName] || destinationTarget : destinationTarget;
      const aisleReference = this.markerWorldPosition(aisleReferenceTarget);
      const obstacleNames = ["Asset_ControlConsole", "Asset_Generator", "Asset_HVAC", "Asset_switchgear", "Asset_Transformer"];
      const obstacles = obstacleNames
        .map((name) => ({ name, object: sceneRoot.getObjectByName(name) }))
        .filter(({ object }) => object)
        .map(({ name, object }) => ({ name, box: new T.Box3().setFromObject(object) }));
      const destinationLegObstacles = obstacles.filter(({ name }) => name !== route.assetName);
      const direction = route.side === "right" ? 1 : -1;
      const consoleEdge = route.side === "right" ? consoleBox.max.x : consoleBox.min.x;
      const destinationOffset = aisleReference.x + direction * clearance * .75;
      const baseX = route.side === "right" ? Math.max(consoleEdge + clearance, destinationOffset) : Math.min(consoleEdge - clearance, destinationOffset);
      const baseZ = Math.max(home.z + clearance * .55, consoleBox.max.z + clearance);
      let selected = null;
      for (let attempt = 0; attempt < 18 && !selected; attempt += 1) {
        const candidate = new T.Vector3(baseX + direction * attempt * .28, this.travelY, baseZ + Math.floor(attempt / 6) * .45);
        const homeLeg = this.segmentClearsPlanar(home, candidate, obstacles, clearance);
        const destinationLeg = this.segmentClearsPlanar(candidate, destination, destinationLegObstacles, clearance);
        if (homeLeg.clear && destinationLeg.clear) selected = candidate;
      }
      if (!selected) {
        console.warn(`CatBot ${route.equipmentName} route could not find a clear ${route.side}-side aisle.`, JSON.stringify({ clearance, home: home.toArray(), destination: destination.toArray() }));
        return null;
      }
      let waypoint = sceneRoot.getObjectByName(route.waypointName);
      if (!waypoint) {
        waypoint = new T.Object3D();
        waypoint.name = route.waypointName;
        sceneRoot.add(waypoint);
      }
      const local = selected.clone();
      sceneRoot.worldToLocal(local);
      waypoint.position.copy(local);
      waypoint.updateMatrixWorld(true);
      console.info(`CatBot ${route.equipmentName} aisle waypoint selected:`, {
        name: waypoint.name,
        side: route.side,
        position: selected.toArray().map((value) => Number(value.toFixed(3))),
        clearance: Number(clearance.toFixed(3))
      });
      return waypoint;
    }
    restoreIdle(announce = true) {
      if (!this.idleAction) {
        console.info("CatBot idle animation not selected: no confidently named idle clip was found.");
        return;
      }
      this.idleAction.setLoop(this.THREE.LoopRepeat, Infinity);
      this.fadeTo(this.idleAction);
      if (announce) console.info("CatBot idle restored:", this.idleClip.name);
      else console.info("CatBot idle animation started:", this.idleClip.name);
    }
    buildPhysicalRoute(type, destinationTarget) {
      const route = this.getRouteDefinition(type);
      const homeTarget = this.navigationTargets.NAV_CatBot_HOME;
      if (!route || !homeTarget || !destinationTarget || !this.walkAction || !this.repairAction) return null;
      const aisleWaypoint = this.createSafeAisleWaypoint(route, homeTarget, destinationTarget);
      if (!aisleWaypoint) return null;
      return { ...route, homeTarget, destinationTarget, outboundWaypoints: [aisleWaypoint], returnWaypoints: [aisleWaypoint] };
    }
    startOutboundWalk() {
      this.startContinuousWalk(`HOME to ${this.plan.equipmentName}`);
      this.state = "WALKING_OUTBOUND_WAYPOINT";
      this.stateTime = 0;
    }
    reachOutboundWaypoint() {
      const waypoint = this.plan.outboundWaypoints[this.plan.outboundIndex];
      console.info(`CatBot reached outbound waypoint ${waypoint.name}:`, { walkTime: this.activeWalkTime() });
      this.plan.outboundIndex += 1;
      this.state = this.plan.outboundIndex < this.plan.outboundWaypoints.length ? "ROTATING_TO_OUTBOUND_WAYPOINT" : "ROTATING_TO_DESTINATION";
      this.stateTime = 0;
    }
    startDestinationWalk() {
      if (!this.walkIsActive) this.startContinuousWalk(`aisle to ${this.plan.equipmentName}`);
      console.info(`CatBot WALK continues toward ${this.plan.equipmentName}:`, this.activeWalkTime());
      this.state = "WALKING_TO_DESTINATION";
      this.stateTime = 0;
    }
    startGenericRepair() {
      console.info(`CatBot ${this.plan.equipmentName} destination reached.`);
      this.stopContinuousWalk(this.plan.equipmentName);
      console.info(`CatBot ${this.plan.equipmentName} repair started:`, this.repairClip.name);
      this.repairAction.setLoop(this.THREE.LoopOnce, 1);
      this.repairAction.clampWhenFinished = true;
      this.fadeTo(this.repairAction);
      this.state = "REPAIRING";
      this.stateTime = 0;
    }
    startGenericReturnRotation() {
      this.stopCurrentAction();
      this.plan.returnIndex = 0;
      this.state = this.plan.returnWaypoints.length ? "ROTATING_TO_RETURN_WAYPOINT" : "ROTATING_TO_HOME";
      this.stateTime = 0;
      console.info(`CatBot ${this.plan.equipmentName} return route started.`);
    }
    startReturnWalk() {
      this.startContinuousWalk(`${this.plan.equipmentName} to HOME`);
      this.state = "WALKING_RETURN_WAYPOINT";
      this.stateTime = 0;
    }
    reachReturnWaypoint() {
      const waypoint = this.plan.returnWaypoints[this.plan.returnIndex];
      console.info(`CatBot reached return waypoint ${waypoint.name}:`, { walkTime: this.activeWalkTime() });
      this.plan.returnIndex += 1;
      this.state = this.plan.returnIndex < this.plan.returnWaypoints.length ? "ROTATING_TO_RETURN_WAYPOINT" : "ROTATING_TO_HOME";
      this.stateTime = 0;
    }
    startHomeWalk() {
      if (!this.walkIsActive) this.startContinuousWalk(`${this.plan.equipmentName} to HOME`);
      console.info("CatBot WALK continues toward HOME:", this.activeWalkTime());
      this.state = "RETURNING_HOME";
      this.stateTime = 0;
    }
    startConsoleRepair() {
      this.stopContinuousWalk("MAIN CONSOLE");
      console.info(`CatBot ${this.plan.type} console repair started:`, this.repairClip.name);
      this.repairAction.setLoop(this.THREE.LoopOnce, 1);
      this.repairAction.clampWhenFinished = true;
      this.fadeTo(this.repairAction);
      this.state = "REPAIRING";
      this.stateTime = 0;
    }
    completeConsoleRecovery() {
      const { type, complete } = this.plan;
      this.group.position.copy(this.homeLocalPosition);
      this.group.quaternion.copy(this.homeLocalQuaternion);
      this.group.updateMatrixWorld(true);
      complete?.();
      this.state = "IDLE";
      this.stateTime = 0;
      this.plan = null;
      this.restoreIdle();
      console.info(`CatBot ${type} console recovery complete; HOME idle restored.`);
    }
    updateConsoleRecovery(delta) {
      if (this.state === "SPECIAL_ALERT") {
        if (this.stateTime > this.plan.alertDuration) {
          if (this.isAtMarker(this.plan.homeTarget)) this.startConsoleRepair();
          else {
            console.info(`CatBot ${this.plan.type} is away from HOME; returning to the main console before repair.`);
            this.stopCurrentAction();
            this.state = "ROTATING_TO_CONSOLE_HOME";
            this.stateTime = 0;
          }
        }
        return;
      }
      if (this.state === "ROTATING_TO_CONSOLE_HOME") {
        if (this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.homeTarget), delta)) {
          this.startContinuousWalk(`${this.plan.type} to MAIN CONSOLE`);
          this.state = "WALKING_TO_CONSOLE_HOME";
          this.stateTime = 0;
        }
        return;
      }
      if (this.state === "WALKING_TO_CONSOLE_HOME") {
        this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.homeTarget), delta);
        if (this.moveTowardMarker(this.plan.homeTarget, delta)) {
          console.info("CatBot reached the main console HOME marker.");
          this.startConsoleRepair();
        }
        return;
      }
      if (this.state === "SPECIAL_SYSTEM_RECOVERY" && this.plan.isRecoveryComplete?.()) {
        console.info(`CatBot ${this.plan.type} plant stabilization complete.`);
        this.stopCurrentAction();
        this.state = "RESTORING_CONSOLE_HOME_ORIENTATION";
        this.stateTime = 0;
        return;
      }
      if (this.state === "RESTORING_CONSOLE_HOME_ORIENTATION" && this.rotateToHomeOrientation(delta)) this.completeConsoleRecovery();
    }
    beginConsoleRecovery(type, navigationTarget, repair, complete, isRecoveryComplete) {
      const homeTarget = this.navigationTargets.NAV_CatBot_HOME || navigationTarget;
      if (!homeTarget || !this.repairAction) {
        console.warn(`CatBot ${type} console recovery cannot start: HOME marker or repair animation is unavailable.`);
        return false;
      }
      this.travelY = this.rootWorldPosition().y;
      this.plan = { type, equipmentName: "MAIN CONSOLE", homeTarget, repair, complete, isRecoveryComplete, repaired: false, specialConsole: true, alertDuration: type === "master" ? .92 : .62 };
      this.state = "SPECIAL_ALERT";
      this.stateTime = 0;
      console.info(`CatBot ${type} special fault started at the main console.`, { atHome: this.isAtMarker(homeTarget), home: this.markerWorldPosition(homeTarget).toArray() });
      return true;
    }
    beginRecovery(type, navigationTarget, repair, options = {}) {
      if (this.isBusy()) return false;
      this.irritation = Math.min(8, this.irritation + 1);
      if (type === "master" || type === "demand") return this.beginConsoleRecovery(type, navigationTarget, repair, options.complete, options.isRecoveryComplete);
      const routeDefinition = this.getRouteDefinition(type);
      if (routeDefinition) {
        this.travelY = this.rootWorldPosition().y;
        const route = this.buildPhysicalRoute(type, navigationTarget);
        if (!route) {
          console.warn(`CatBot ${routeDefinition.equipmentName} physical route is unavailable; retaining the existing simulation-only recovery.`);
          this.plan = { type, navigationTarget, repair, repaired: false, simulationOnly: true };
          this.state = "NOTICE_FAULT";
          this.stateTime = 0;
          return true;
        }
        this.plan = { type, ...route, repair, repaired: false, simulationOnly: false, generalizedRoute: true, outboundIndex: 0, returnIndex: 0 };
        this.stopCurrentAction();
        this.state = "ROTATING_TO_OUTBOUND_WAYPOINT";
        this.stateTime = 0;
        console.info(`CatBot ${route.equipmentName} route started:`, { side: route.side, from: this.markerWorldPosition(route.homeTarget).toArray(), waypoints: route.outboundWaypoints.map((waypoint) => this.markerWorldPosition(waypoint).toArray()), to: this.markerWorldPosition(route.destinationTarget).toArray(), speed: this.walkSpeed });
        return true;
      }
      if (type !== "generator") {
        this.plan = { type, navigationTarget, repair, repaired: false, simulationOnly: true };
        this.state = "NOTICE_FAULT";
        this.stateTime = 0;
        if (navigationTarget) console.info(`CatBot route target ready for ${type}:`, navigationTarget.name, navigationTarget.getWorldPosition(new this.THREE.Vector3()));
        else console.warn(`CatBot route target is not available for ${type}; retaining the existing simulation-only recovery.`);
        return true;
      }
      const homeTarget = this.navigationTargets.NAV_CatBot_HOME;
      const generatorTarget = this.navigationTargets.NAV_CatBot_GENERATOR;
      if (!homeTarget || !generatorTarget || !this.walkAction || !this.repairAction) {
        console.warn("CatBot generator route assets are incomplete; retaining the existing simulation-only recovery.");
        this.plan = { type, navigationTarget, repair, repaired: false, simulationOnly: true };
        this.state = "NOTICE_FAULT";
        this.stateTime = 0;
        return true;
      }
      this.travelY = this.rootWorldPosition().y;
      const rightWaypoint = this.createGeneratorRightWaypoint(homeTarget, generatorTarget);
      if (!rightWaypoint) {
        console.warn("CatBot generator route could not create a safe aisle waypoint; retaining the existing simulation-only recovery.");
        this.plan = { type, navigationTarget, repair, repaired: false, simulationOnly: true };
        this.state = "NOTICE_FAULT";
        this.stateTime = 0;
        return true;
      }
      this.plan = { type, homeTarget, generatorTarget, rightWaypoint, repair, repaired: false, simulationOnly: false };
      this.stopCurrentAction();
      this.state = "ROTATING_TO_RIGHT_WAYPOINT";
      this.stateTime = 0;
      console.info("CatBot generator route started:", { from: this.markerWorldPosition(homeTarget).toArray(), waypoint: this.markerWorldPosition(rightWaypoint).toArray(), to: this.markerWorldPosition(generatorTarget).toArray(), speed: this.walkSpeed });
      console.info("CatBot route segment: HOME → RIGHT WAYPOINT");
      return true;
    }
    startWalkHomeToRightWaypoint() {
      this.startContinuousWalk("HOME to RIGHT WAYPOINT");
      this.state = "WALKING_HOME_TO_RIGHT_WAYPOINT";
      this.stateTime = 0;
    }
    startTurnRightWaypointToGenerator() {
      console.info("CatBot WALK time before outbound waypoint turn:", this.activeWalkTime());
      this.state = "ROTATING_RIGHT_WAYPOINT_TO_GENERATOR";
      this.stateTime = 0;
      console.info("CatBot route segment: RIGHT WAYPOINT → GENERATOR");
    }
    startWalkRightWaypointToGenerator() {
      console.info("CatBot WALK time after outbound waypoint turn:", this.activeWalkTime());
      this.state = "WALKING_RIGHT_WAYPOINT_TO_GENERATOR";
      this.stateTime = 0;
    }
    startRepair() {
      console.info("CatBot generator destination reached.");
      this.stopContinuousWalk("GENERATOR");
      console.info("CatBot generator repair started:", this.repairClip.name);
      this.repairAction.setLoop(this.THREE.LoopOnce, 1);
      this.repairAction.clampWhenFinished = true;
      this.fadeTo(this.repairAction);
      this.state = "REPAIRING";
      this.stateTime = 0;
    }
    startReturnRotation() {
      this.stopCurrentAction();
      this.state = "ROTATING_TO_RIGHT_WAYPOINT_RETURN";
      this.stateTime = 0;
      console.info("CatBot route segment: GENERATOR → RIGHT WAYPOINT");
    }
    startReturnWalkToRightWaypoint() {
      this.startContinuousWalk("GENERATOR to RIGHT WAYPOINT");
      this.state = "RETURNING_GENERATOR_TO_RIGHT_WAYPOINT";
      this.stateTime = 0;
      console.info("CatBot return journey started.");
    }
    startTurnRightWaypointToHome() {
      console.info("CatBot WALK time before return waypoint turn:", this.activeWalkTime());
      this.state = "ROTATING_RIGHT_WAYPOINT_TO_HOME";
      this.stateTime = 0;
      console.info("CatBot route segment: RIGHT WAYPOINT → HOME");
    }
    startReturnWalkHome() {
      console.info("CatBot WALK time after return waypoint turn:", this.activeWalkTime());
      this.state = "RETURNING_RIGHT_WAYPOINT_TO_HOME";
      this.stateTime = 0;
    }
    updateSimulationRecovery() {
      if (this.state === "NOTICE_FAULT" && this.stateTime > .75) { this.state = "AWAITING_ROUTE"; this.stateTime = 0; }
      if (this.state === "AWAITING_ROUTE" && this.stateTime > 1.45) {
        this.plan.repaired = true;
        this.plan.repair();
        this.state = "VERIFYING";
        this.stateTime = 0;
      }
      if (this.state === "VERIFYING" && this.stateTime > .7) { this.state = "IDLE"; this.stateTime = 0; this.plan = null; }
    }
    update(delta) {
      this.mixer.update(delta);
      this.updatePendingStops(delta);
      this.updateSeamlessWalkLoop();
      if (!this.plan) return;
      this.stateTime += delta;
      if (this.plan.simulationOnly) { this.updateSimulationRecovery(); return; }
      if (this.plan.specialConsole) { this.updateConsoleRecovery(delta); return; }
      if (this.plan.generalizedRoute) {
        if (this.state === "ROTATING_TO_OUTBOUND_WAYPOINT") {
          const waypoint = this.plan.outboundWaypoints[this.plan.outboundIndex];
          if (this.rotateTowardWorldPosition(this.markerWorldPosition(waypoint), delta)) this.startOutboundWalk();
          return;
        }
        if (this.state === "WALKING_OUTBOUND_WAYPOINT") {
          const waypoint = this.plan.outboundWaypoints[this.plan.outboundIndex];
          this.rotateTowardWorldPosition(this.markerWorldPosition(waypoint), delta);
          if (this.moveTowardMarker(waypoint, delta)) this.reachOutboundWaypoint();
          return;
        }
        if (this.state === "ROTATING_TO_DESTINATION") {
          if (this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.destinationTarget), delta)) this.startDestinationWalk();
          return;
        }
        if (this.state === "WALKING_TO_DESTINATION") {
          this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.destinationTarget), delta);
          if (this.moveTowardMarker(this.plan.destinationTarget, delta)) this.startGenericRepair();
          return;
        }
        if (this.state === "ROTATING_TO_RETURN_WAYPOINT") {
          const waypoint = this.plan.returnWaypoints[this.plan.returnIndex];
          if (this.rotateTowardWorldPosition(this.markerWorldPosition(waypoint), delta)) this.startReturnWalk();
          return;
        }
        if (this.state === "WALKING_RETURN_WAYPOINT") {
          const waypoint = this.plan.returnWaypoints[this.plan.returnIndex];
          this.rotateTowardWorldPosition(this.markerWorldPosition(waypoint), delta);
          if (this.moveTowardMarker(waypoint, delta)) this.reachReturnWaypoint();
          return;
        }
        if (this.state === "ROTATING_TO_HOME") {
          if (this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.homeTarget), delta)) this.startHomeWalk();
          return;
        }
        if (this.state === "RETURNING_HOME") {
          this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.homeTarget), delta);
          if (this.moveTowardMarker(this.plan.homeTarget, delta)) {
            console.info("CatBot home reached.");
            this.stopContinuousWalk("HOME");
            this.fadeTo(this.idleAction);
            this.state = "RESTORING_HOME_ORIENTATION";
            this.stateTime = 0;
          }
          return;
        }
        if (this.state === "RESTORING_HOME_ORIENTATION" && this.rotateToHomeOrientation(delta)) {
          this.group.position.copy(this.homeLocalPosition);
          this.group.quaternion.copy(this.homeLocalQuaternion);
          this.group.updateMatrixWorld(true);
          this.state = "IDLE";
          this.stateTime = 0;
          this.plan = null;
          this.restoreIdle();
        }
        return;
      }
      if (this.state === "ROTATING_TO_RIGHT_WAYPOINT") {
        if (this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.rightWaypoint), delta)) this.startWalkHomeToRightWaypoint();
        return;
      }
      if (this.state === "WALKING_HOME_TO_RIGHT_WAYPOINT") {
        const waypointPosition = this.markerWorldPosition(this.plan.rightWaypoint);
        this.rotateTowardWorldPosition(waypointPosition, delta);
        if (this.moveTowardMarker(this.plan.rightWaypoint, delta)) this.startTurnRightWaypointToGenerator();
        return;
      }
      if (this.state === "ROTATING_RIGHT_WAYPOINT_TO_GENERATOR") {
        if (this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.generatorTarget), delta)) this.startWalkRightWaypointToGenerator();
        return;
      }
      if (this.state === "WALKING_RIGHT_WAYPOINT_TO_GENERATOR") {
        const generatorPosition = this.markerWorldPosition(this.plan.generatorTarget);
        this.rotateTowardWorldPosition(generatorPosition, delta);
        if (this.moveTowardMarker(this.plan.generatorTarget, delta)) this.startRepair();
        return;
      }
      if (this.state === "ROTATING_TO_RIGHT_WAYPOINT_RETURN") {
        if (this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.rightWaypoint), delta)) this.startReturnWalkToRightWaypoint();
        return;
      }
      if (this.state === "RETURNING_GENERATOR_TO_RIGHT_WAYPOINT") {
        const waypointPosition = this.markerWorldPosition(this.plan.rightWaypoint);
        this.rotateTowardWorldPosition(waypointPosition, delta);
        if (this.moveTowardMarker(this.plan.rightWaypoint, delta)) this.startTurnRightWaypointToHome();
        return;
      }
      if (this.state === "ROTATING_RIGHT_WAYPOINT_TO_HOME") {
        if (this.rotateTowardWorldPosition(this.markerWorldPosition(this.plan.homeTarget), delta)) this.startReturnWalkHome();
        return;
      }
      if (this.state === "RETURNING_RIGHT_WAYPOINT_TO_HOME") {
        const homePosition = this.markerWorldPosition(this.plan.homeTarget);
        this.rotateTowardWorldPosition(homePosition, delta);
        if (this.moveTowardMarker(this.plan.homeTarget, delta)) {
          console.info("CatBot home reached.");
          this.stopContinuousWalk("HOME");
          this.fadeTo(this.idleAction);
          this.state = "RESTORING_HOME_ORIENTATION";
          this.stateTime = 0;
        }
        return;
      }
      if (this.state === "RESTORING_HOME_ORIENTATION" && this.rotateToHomeOrientation(delta)) {
        this.group.position.copy(this.homeLocalPosition);
        this.group.quaternion.copy(this.homeLocalQuaternion);
        this.group.updateMatrixWorld(true);
        this.state = "IDLE";
        this.stateTime = 0;
        this.plan = null;
        this.restoreIdle();
      }
    }
    setRobotExpression(expression) { console.info("CatBot expression request retained for future facial-rig mapping:", expression); }
    readout() { return this.state === "IDLE" ? (this.idleClip ? `IDLE // ${this.idleClip.name}` : "IDLE // ANIMATION MAP PENDING") : this.state.replaceAll("_", " "); }
    dispose() { this.mixer.removeEventListener("finished", this.onAnimationFinished); this.mixer.stopAllAction(); this.mixer.uncacheRoot(this.group); }
  }

  class ControlRoomEngine {
    constructor(THREE, GLTFLoader, mount, onProgress, presentationModules = null) {
      this.T = THREE; this.GLTFLoader = GLTFLoader; this.mount = mount; this.onProgress = onProgress; this.presentationModules = presentationModules;
      this.plant = new PlantState(); this.sound = new ToneManager(); this.interactive = []; this.clock = new THREE.Clock(); this.elapsed = 0; this.uiClock = 0;
      this.yaw = 0; this.pitch = 0; this.zoom = 1; this.pointer = new THREE.Vector2(); this.raycaster = new THREE.Raycaster(); this.drag = null; this.navigationTargets = {}; this.inspection = null;
      this.isMobile = matchMedia("(max-width:680px)").matches; this.reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
      this.qualityTier = this.initialQualityTier(); this.quality = QUALITY_PRESETS[this.qualityTier];
      this.pixelRatio = Math.min(devicePixelRatio || 1, this.quality.pixelRatio);
      this.frameMetrics = { frames: 0, elapsed: 0, idleFps: null, walkingFps: null, initialProfile: null, latestProfile: null, adjustments: 0 };
      this.staticNodeCount = 0; this.loadStartedAt = performance.now(); this.loadTimeMs = null; this.shadowRefreshElapsed = 0; this.wasRobotBusy = false;
    }
    initialQualityTier() {
      if (this.isMobile) return "MOBILE";
      const cores = navigator.hardwareConcurrency || 8;
      const memory = navigator.deviceMemory || 8;
      return cores <= 4 || memory <= 4 ? "BALANCED" : "HIGH";
    }
    async init() {
      const T = this.T;
      this.scene = new T.Scene();
      this.scene.background = new T.Color(0x020912);
      this.scene.fog = new T.FogExp2(0x020912, this.isMobile ? .009 : .0075);
      this.camera = new T.PerspectiveCamera(this.isMobile ? 56 : 52, 1, .08, 100);
      this.renderer = new T.WebGLRenderer({ antialias: !this.isMobile, powerPreference: "high-performance" });
      this.renderer.setPixelRatio(this.pixelRatio);
      this.renderer.outputColorSpace = T.SRGBColorSpace;
      this.renderer.toneMapping = T.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = this.isMobile ? .92 : .98;
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = T.PCFSoftShadowMap;
      // Static room shadows are rendered once. CatBot paths explicitly request
      // refreshes below, avoiding a full shadow-map pass while the visitor is idle.
      this.renderer.shadowMap.autoUpdate = false;
      this.mount.append(this.renderer.domElement);
      this.applyQualityTier(this.qualityTier, "initial", true);
      this.setupEnvironment();
      await this.loadBlenderControlRoom();
      this.prepareBlenderPresentation();
      this.createPresentationLighting();
      this.freezeStaticScene();
      this.collectSceneStats();
      this.renderer.shadowMap.needsUpdate = this.renderer.shadowMap.enabled;
      this.bindInput(); this.resize(); this.resizeHandler = () => this.resize(); window.addEventListener("resize", this.resizeHandler); this.tick();
    }
    setupEnvironment() {
      const RoomEnvironment = this.presentationModules?.RoomEnvironment;
      if (!RoomEnvironment) return;
      const pmrem = new this.T.PMREMGenerator(this.renderer);
      const environment = new RoomEnvironment();
      this.environmentTarget = pmrem.fromScene(environment, .04);
      this.scene.environment = this.environmentTarget.texture;
      this.scene.environmentIntensity = this.quality.environmentIntensity;
      environment.dispose();
      pmrem.dispose();
    }
    prepareBlenderPresentation() {
      const T = this.T;
      const anisotropy = Math.min(this.renderer.capabilities.getMaxAnisotropy(), this.quality.anisotropy);
      this.emissiveMaterials ||= [];
      this.blenderScene.traverse((node) => {
        if (!node.isMesh) return;
        const shadowOwnerNames = [];
        let owner = node;
        while (owner) { if (owner.name) shadowOwnerNames.push(owner.name); owner = owner.parent; }
        const shadowOwner = shadowOwnerNames.join(" ");
        node.receiveShadow = this.quality.shadowMapSize > 0;
        node.castShadow = this.quality.shadowMapSize > 0 && this.quality.shadowCasters.test(shadowOwner);
        if (!node.isSkinnedMesh) {
          node.frustumCulled = true;
          if (!node.geometry.boundingSphere) node.geometry.computeBoundingSphere();
        }
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.filter(Boolean).forEach((material) => {
          if ("envMapIntensity" in material) material.envMapIntensity = Math.min(Math.max(material.envMapIntensity || 0, this.isMobile ? .18 : .28), this.quality.environmentMapIntensity);
          if (material.emissive && material.emissiveIntensity > 0) {
            const baseEmissive = material.userData.crBaseEmissiveIntensity ?? Math.max(material.emissiveIntensity, .72);
            material.userData.crBaseEmissiveIntensity = baseEmissive;
            material.emissiveIntensity = baseEmissive;
            if (!this.emissiveMaterials.some((entry) => entry.material === material)) this.emissiveMaterials.push({ material, base: baseEmissive, isHmi: /hmi|screen|monitor|display|console|panel/i.test(shadowOwner) });
          }
          const textures = new Set([material.map, material.normalMap, material.roughnessMap, material.metalnessMap, material.aoMap, material.emissiveMap].filter(Boolean));
          textures.forEach((texture) => { texture.anisotropy = anisotropy; texture.minFilter = T.LinearMipmapLinearFilter; texture.magFilter = T.LinearFilter; texture.needsUpdate = true; });
          material.needsUpdate = true;
        });
      });
    }
    applyQualityTier(tier, reason, initial = false) {
      const preset = QUALITY_PRESETS[tier];
      if (!preset) return;
      const previous = this.qualityTier;
      this.qualityTier = tier; this.quality = preset;
      this.pixelRatio = Math.min(devicePixelRatio || 1, preset.pixelRatio);
      if (this.renderer) {
        this.renderer.setPixelRatio(this.pixelRatio);
        this.renderer.shadowMap.enabled = preset.shadowMapSize > 0;
        this.renderer.shadowMap.type = this.T.PCFSoftShadowMap;
        this.renderer.shadowMap.needsUpdate = true;
      }
      if (this.scene) this.scene.environmentIntensity = preset.environmentIntensity;
      if (this.consoleKeyLight) {
        this.consoleKeyLight.castShadow = preset.shadowMapSize > 0;
        this.consoleKeyLight.shadow.mapSize.set(Math.max(1, preset.shadowMapSize), Math.max(1, preset.shadowMapSize));
        this.consoleKeyLight.shadow.needsUpdate = true;
      }
      if (this.blenderScene) this.prepareBlenderPresentation();
      if (this.scene) this.collectSceneStats();
      this.mount.dataset.qualityTier = tier;
      if (!initial && previous !== tier) {
        this.frameMetrics.adjustments += 1;
        console.info(`GRID GUARDIAN adaptive quality: ${previous} → ${tier} (${reason}).`);
      }
    }
    freezeStaticScene() {
      this.blenderScene.traverse((node) => {
        if (node === this.blenderScene || node.isLight || node.isCamera) return;
        const hierarchyNames = [];
        let owner = node;
        while (owner) { if (owner.name) hierarchyNames.push(owner.name); owner = owner.parent; }
        const dynamic = node.isSkinnedMesh || node.type === "Bone" || /catbot|armature/i.test(hierarchyNames.join(" "));
        if (dynamic) return;
        node.matrixAutoUpdate = false;
        node.updateMatrix();
        this.staticNodeCount += 1;
      });
      this.blenderScene.updateMatrixWorld(true);
    }
    createPresentationLighting() {
      const T = this.T;
      this.hemisphereLight = new T.HemisphereLight(0xb7eaff, 0x05101a, this.isMobile ? .28 : .38);
      this.scene.add(this.hemisphereLight);
      this.keyLight = new T.PointLight(0x79d9ff, 6.8, 22, 2);
      this.keyLight.position.set(0, 5.6, 5.6);
      this.scene.add(this.keyLight);
      this.consoleKeyLight = new T.SpotLight(0xd6f3ff, this.isMobile ? 6.5 : 11, 20, .6, .6, 2);
      this.consoleKeyLight.position.set(-1.8, 6.8, 6.6);
      this.consoleKeyLight.target.position.set(0, 1.1, -.5);
      this.consoleKeyLight.castShadow = this.quality.shadowMapSize > 0;
      this.consoleKeyLight.shadow.mapSize.set(Math.max(1, this.quality.shadowMapSize), Math.max(1, this.quality.shadowMapSize));
      this.consoleKeyLight.shadow.bias = -.00018;
      this.consoleKeyLight.shadow.normalBias = .02;
      this.scene.add(this.consoleKeyLight, this.consoleKeyLight.target);
      this.coolFillLight = new T.PointLight(0x177db7, this.isMobile ? 1.25 : 2.2, 14, 2);
      this.coolFillLight.position.set(-5.2, 3.4, .8);
      this.rimLight = new T.PointLight(0x53ddff, this.isMobile ? 1.5 : 3.1, 13, 2);
      this.rimLight.position.set(4.4, 3.8, -3.1);
      this.catBotLight = new T.PointLight(0xffc78a, this.isMobile ? .55 : 1.1, 7, 2);
      this.catBotLight.position.set(0, 2.6, 4.9);
      this.emergencyLight = new T.PointLight(0xff3d32, 0, 22, 2);
      this.emergencyLight.position.set(0, 3.4, 2.2);
      this.scene.add(this.coolFillLight, this.rimLight, this.catBotLight, this.emergencyLight);
    }
    async loadBlenderControlRoom() {
      const loader = new this.GLTFLoader();
      let gltf;
      try {
        gltf = await loader.loadAsync(MODEL_URL, (event) => this.onProgress?.(event));
      } catch (error) {
        console.error("Unable to load the production WEB_LITE CatBot control-room GLB.", { modelUrl: MODEL_URL, error });
        throw error;
      }
      this.blenderScene = gltf.scene;
      this.scene.add(this.blenderScene);
      this.blenderScene.updateMatrixWorld(true);
      this.inspectBlenderScene(gltf, MODEL_URL);
      this.frameBlenderScene();
      this.robot = new CatBotController(this.T, this.inspection.mixerRoot, gltf.animations, this.navigationTargets, this.inspection);
    }
    inspectBlenderScene(gltf, modelUrl = MODEL_URL) {
      const T = this.T; const objects = []; const catBotObjects = []; const armatureObjects = [];
      gltf.scene.traverse((object) => {
        const record = { name: object.name || "[unnamed]", type: object.type };
        objects.push(record);
        if (/catbot/i.test(object.name) && !/^NAV_CatBot_/i.test(object.name)) catBotObjects.push(record);
        if (/armature/i.test(object.name) || object.isSkinnedMesh || object.type === "Bone") armatureObjects.push(record);
      });
      const navigation = {};
      Object.values(navigationTargetNames).forEach((name) => {
        const target = gltf.scene.getObjectByName(name);
        if (!target) { console.warn(`Missing required navigation object: ${name}`); return; }
        const position = target.getWorldPosition(new T.Vector3());
        navigation[name] = target;
        console.info(`Navigation target ${name}: [${position.toArray().map((value) => value.toFixed(3)).join(", ")}]`);
      });
      const catBotCandidates = [];
      gltf.scene.traverse((object) => { if (/catbot/i.test(object.name) && !/^NAV_CatBot_/i.test(object.name)) catBotCandidates.push(object); });
      const armatureCandidates = [];
      gltf.scene.traverse((object) => { if (/armature/i.test(object.name) || object.isSkinnedMesh) armatureCandidates.push(object); });
      const likelyRoot = catBotCandidates.find((object) => /armature|rig/i.test(object.name)) || catBotCandidates.find((object) => object.type === "Group" || object.type === "Object3D") || armatureCandidates.find((object) => /armature/i.test(object.name)) || gltf.scene;
      const clips = gltf.animations.map((clip) => ({ name: clip.name || "[unnamed clip]", duration: Number(clip.duration.toFixed(3)) }));
      this.navigationTargets = navigation;
      this.inspection = { modelUrl, sceneObjectCount: objects.length, objects, catBotObjects, armatureObjects, navigation: Object.fromEntries(Object.entries(navigation).map(([name, object]) => [name, object.getWorldPosition(new T.Vector3()).toArray()])), clips, likelyMixerRoot: { name: likelyRoot.name || "[scene root]", type: likelyRoot.type }, mixerRoot: likelyRoot };
      console.group("CatBot GLB Inspection");
      console.info("GLB successfully loaded:", modelUrl);
      console.log("gltf.scene:", gltf.scene);
      console.log("Animation clips:", clips);
      console.log("All scene objects:", objects);
      console.log("Objects containing CatBot:", catBotObjects);
      console.log("Armature / SkinnedMesh objects:", armatureObjects);
      Object.keys(navigationTargetNames).forEach((route) => { const name = navigationTargetNames[route]; console.log(name, navigation[name] || "MISSING"); });
      console.info(`Likely CatBot mixer root: ${likelyRoot.name || "[scene root]"} (${likelyRoot.type})`);
      console.groupEnd();
    }
    frameBlenderScene() {
      const box = new this.T.Box3().setFromObject(this.blenderScene); const center = box.getCenter(new this.T.Vector3()); const size = box.getSize(new this.T.Vector3()); const span = Math.max(size.x, size.y, size.z, 6);
      const home = this.navigationTargets.NAV_CatBot_HOME ? this.navigationTargets.NAV_CatBot_HOME.getWorldPosition(new this.T.Vector3()) : new this.T.Vector3(0, 0, 4.09);
      // A human-scale console-side view: CatBot stays foregrounded while the central HMI and both equipment banks remain visible.
      this.cameraAnchor = new this.T.Vector3(home.x, .56, home.z - 4.48);
      this.cameraDistance = this.isMobile ? 10.0 : 10.8;
      this.cameraBaseHeight = this.isMobile ? 3.0 : 3.35;
      this.cameraDefaultPosition = new this.T.Vector3(this.cameraAnchor.x, this.cameraBaseHeight, this.cameraAnchor.z + this.cameraDistance);
      this.cameraLookDistance = this.cameraDefaultPosition.distanceTo(this.cameraAnchor);
      this.cameraBasePitch = Math.asin((this.cameraAnchor.y - this.cameraDefaultPosition.y) / this.cameraLookDistance);
      // The GLB has a narrow, staged room envelope. A deliberately modest
      // look range keeps visitors inside the room instead of exposing its ends.
      this.maxYaw = .24;
      this.minPitch = -.10;
      this.maxPitch = .60;
      this.camera.near = .08;
      this.camera.far = Math.max(100, span * 8);
      this.defaultFov = this.camera.fov;
      this.camera.updateProjectionMatrix();
      console.info("CatBot GLB presentation framing:", { center: center.toArray(), size: size.toArray(), cameraPosition: [this.cameraAnchor.x, this.cameraBaseHeight, this.cameraAnchor.z + this.cameraDistance], cameraTarget: this.cameraAnchor.toArray(), fov: this.camera.fov });
    }
    material(color, emission = 0, strength = 0) { return new this.T.MeshStandardMaterial({ color, metalness: .68, roughness: .36, emissive: emission, emissiveIntensity: strength }); }
    box(size, material, position) { const mesh = new this.T.Mesh(new this.T.BoxGeometry(...size), material); mesh.position.set(...position); this.scene.add(mesh); return mesh; }
    createRoom() { const T = this.T; const floor = new T.Mesh(new T.PlaneGeometry(25, 22), new T.MeshStandardMaterial({ color: 0x06121d, metalness: .7, roughness: .55 })); floor.rotation.x = -Math.PI / 2; this.scene.add(floor); const grid = new T.GridHelper(24, 28, 0x1e92c4, 0x0b3045); grid.position.y = .01; grid.material.transparent = true; grid.material.opacity = .46; this.scene.add(grid); const wall = this.material(0x071725); this.box([18, 8, .3], wall, [0, 4, -7]); this.box([.3, 8, 18], wall, [-9, 4, -1]); this.box([.3, 8, 18], wall, [9, 4, -1]); for (let x = -8; x <= 8; x += 2) { const strut = this.box([.12, 6, .16], this.material(0x115071, 0x0c5a7d, .25), [x, 3, -6.75]); }
    }
    label(text, color = "#aeefff", width = 512, height = 92) { const T = this.T; const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height; const ctx = canvas.getContext("2d"); ctx.fillStyle = "rgba(2,12,21,.88)"; ctx.fillRect(0, 0, width, height); ctx.strokeStyle = color; ctx.globalAlpha = .65; ctx.strokeRect(2, 2, width - 4, height - 4); ctx.globalAlpha = 1; ctx.fillStyle = color; ctx.font = `600 ${Math.floor(height * .33)}px Arial`; ctx.textAlign = "center"; ctx.textBaseline = "middle"; ctx.fillText(text, width / 2, height / 2 + 2); const texture = new T.CanvasTexture(canvas); const sprite = new T.Mesh(new T.PlaneGeometry(width / 210, height / 210), new T.MeshBasicMaterial({ map: texture, transparent: true })); sprite.userData.texture = texture; return sprite; }
    createScadaWall() { const T = this.T; const panel = this.box([7.4, 3.5, .34], this.material(0x061726, 0x073c62, .3), [0, 3.25, -6.5]); this.scadaCanvas = document.createElement("canvas"); this.scadaCanvas.width = 1024; this.scadaCanvas.height = 512; this.scadaTexture = new T.CanvasTexture(this.scadaCanvas); const screen = new T.Mesh(new T.PlaneGeometry(6.7, 2.85), new T.MeshBasicMaterial({ map: this.scadaTexture })); screen.position.set(0, 3.25, -6.3); this.scene.add(screen); const sign = this.label("ONTARIO SMART GRID", "#7de9ff", 700, 84); sign.position.set(0, 5.28, -6.28); this.scene.add(sign); this.drawScada(); }
    createButton(label, position, action, color = 0x128fd5, size = [1.48, .18, .62]) { const T = this.T; const material = new T.MeshStandardMaterial({ color, metalness: .5, roughness: .26, emissive: color, emissiveIntensity: .35 }); const button = new T.Mesh(new T.BoxGeometry(...size), material); button.position.set(...position); button.userData = { action, material, base: .35 }; this.scene.add(button); this.interactive.push(button); const tag = this.label(label, "#c6f7ff", 360, 70); tag.scale.set(.72, .72, 1); tag.position.set(position[0], position[1] + .36, position[2] + .34); this.scene.add(tag); return button; }
    createStations() {
      const T = this.T; const station = (title, x, z) => { const panel = this.box([2.7, 2.05, .48], this.material(0x0a253a, 0x07598f, .22), [x, 1.32, z]); const sign = this.label(title, "#85eaff", 480, 78); sign.scale.set(.7, .7, 1); sign.position.set(x, 2.18, z + .28); this.scene.add(sign); return panel; };
      station("GENERATOR CONTROL", -4, -4.65); this.generatorRotor = new T.Group(); const core = new T.Mesh(new T.CylinderGeometry(.45, .45, .82, 18), this.material(0x247ca4, 0x075d8c, .5)); core.rotation.z = Math.PI / 2; core.position.set(-4, 1.27, -4.32); this.generatorRotor.add(core); this.scene.add(this.generatorRotor); this.createButton("STOP", [-4, .72, -4.2], "generator", 0xae3632);
      station("GRID BREAKER", 4, -4.65); this.breakerLever = new T.Group(); const lever = new T.Mesh(new T.BoxGeometry(.15, .98, .15), this.material(0x8edfff, 0x0b78b2, .5)); lever.position.y = .4; this.breakerLever.add(lever); this.breakerLever.position.set(4, .86, -4.25); this.scene.add(this.breakerLever); this.createButton("OPEN", [4, .72, -4.2], "breaker", 0xd9862b);
      station("COOLING SYSTEM", 4, -1.82); this.fanGroup = new T.Group(); for (let i = 0; i < 4; i += 1) { const blade = new T.Mesh(new T.BoxGeometry(.12, .82, .06), this.material(0x87e6ff, 0x0875a8, .35)); blade.rotation.z = i * Math.PI / 2; this.fanGroup.add(blade); } this.fanGroup.position.set(4, 1.3, -1.47); this.scene.add(this.fanGroup); this.createButton("OFF", [4, .72, -1.35], "cooling", 0xd9862b);
      station("LOAD CONTROL", 0, -2.82); this.createButton("+ DEMAND", [0, .72, -2.35], "demand", 0xc27a2a);
      const master = this.box([3.3, .45, 1.3], this.material(0x351316, 0x49100d, .3), [0, .42, -.1]); const masterLabel = this.label("MASTER POWER // DO NOT SWITCH OFF", "#ffb1a7", 650, 82); masterLabel.scale.set(1.05, 1.05, 1); masterLabel.position.set(0, .9, .58); this.scene.add(masterLabel); this.createButton("POWER", [0, .72, .18], "master", 0xa52424, [2.15, .2, .62]);
    }
    createWindowAndCity() { const T = this.T; const frame = this.material(0x174a67, 0x0c5f86, .3); this.box([.25, 4.2, 5.7], frame, [7.25, 3.1, -3.7]); this.box([.2, .15, 5.7], frame, [7.15, 5.1, -3.7]); this.box([.2, .15, 5.7], frame, [7.15, 1.1, -3.7]); const label = this.label("OBSERVATION // ONTARIO GRID", "#90eaff", 620, 76); label.rotation.y = -Math.PI / 2; label.position.set(7.04, 5.55, -3.7); this.scene.add(label); this.cityLights = []; for (let i = 0; i < 44; i += 1) { const x = 8.3 + Math.random() * 7; const z = -8 + Math.random() * 9; const h = .25 + Math.random() * .95; const building = new T.Mesh(new T.BoxGeometry(.16 + Math.random() * .22, h, .18 + Math.random() * .35), this.material(0x0a1a25, 0x093955, .15)); building.position.set(x, h / 2, z); this.scene.add(building); const light = new T.PointLight(0x79dfff, .35, 2.3, 2); light.position.set(x, h * .72, z + .12); this.scene.add(light); this.cityLights.push(light); } }
    drawScada() { if (!this.scadaCanvas || !this.scadaTexture) return; const ctx = this.scadaCanvas.getContext("2d"); const s = this.plant; ctx.fillStyle = s.masterPower ? "#03111d" : "#05070b"; ctx.fillRect(0, 0, 1024, 512); ctx.strokeStyle = s.masterPower ? "rgba(75,212,255,.22)" : "rgba(255,80,65,.18)"; ctx.lineWidth = 1; for (let i = 0; i < 1024; i += 64) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke(); } for (let i = 0; i < 512; i += 48) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(1024, i); ctx.stroke(); }
      ctx.fillStyle = "#dffaff"; ctx.font = "600 42px Arial"; ctx.fillText("ONTARIO SMART GRID", 42, 62); ctx.fillStyle = s.activeAlarm ? "#ff9d8d" : "#75f199"; ctx.font = "600 22px Arial"; ctx.fillText(`GRID STATUS: ${s.gridStatus}`, 740, 60);
      const values = [["GENERATION", `${Math.round(s.generation)} MW`], ["DEMAND", `${Math.round(s.demand)} MW`], ["FREQUENCY", `${s.frequency.toFixed(1)} Hz`], ["TEMPERATURE", `${Math.round(s.temperature)} C`], ["GENERATOR", s.generatorOnline ? "ONLINE" : "OFFLINE"], ["BREAKER", s.breakerClosed ? "CLOSED" : "OPEN"], ["COOLING", s.coolingOnline ? "ON" : "OFF"], ["ALARM", s.activeAlarm || "NONE"]];
      values.forEach(([label, value], index) => { const col = index % 2; const row = Math.floor(index / 2); const x = 54 + col * 480; const y = 135 + row * 88; ctx.fillStyle = "rgba(21,93,132,.36)"; ctx.fillRect(x, y - 32, 420, 64); ctx.fillStyle = "#86b7ce"; ctx.font = "500 17px Arial"; ctx.fillText(label, x + 16, y - 7); ctx.fillStyle = label === "ALARM" && s.activeAlarm ? "#ff9b90" : "#c9f5ff"; ctx.font = "600 27px Arial"; ctx.fillText(value, x + 16, y + 22); });
      ctx.fillStyle = s.masterPower ? "#7cecff" : "#ff8779"; ctx.font = "500 15px Arial"; ctx.fillText(s.masterPower ? "SYSTEM TELEMETRY // LIVE" : "EMERGENCY POWER ONLY // RECOVERY ACTIVE", 44, 482); this.scadaTexture.needsUpdate = true;
    }
    triggerFault(type) {
      if (this.robot?.isBusy?.()) { console.info("CatBot is already handling a route; fault request ignored:", type); return; }
      if (!this.plant.begin(type)) return;
      if (type === "master") { this.sound.play("power"); this.sound.play("alarm"); }
      else this.sound.play("alarm");
      const navigationTarget = this.navigationTargets[navigationTargetNames[type]];
      const specialFault = type === "master" || type === "demand";
      const started = this.robot?.beginRecovery(
        type,
        navigationTarget,
        () => {
          if (specialFault) this.plant.startSpecialRecovery(type);
          else this.plant.recover();
          this.sound.play("repair");
        },
        specialFault ? {
          isRecoveryComplete: () => this.plant.isSpecialRecoveryComplete(type),
          complete: () => this.plant.recover()
        } : undefined
      );
      if (!started) {
        console.warn(`GRID GUARDIAN ${type} fault could not start its CatBot flow; restoring the plant.`);
        this.plant.recover();
      }
      this.applyPlantVisuals();
      updateHud(this.plant, this.robot, Boolean(started));
    }
    applyPlantVisuals() {
      const s = this.plant; const roomIsPowered = s.masterPower; const powerLevel = roomIsPowered ? Math.max(0, Math.min(1, s.powerLevel ?? 1)) : 0;
      const roomLight = roomIsPowered ? .12 + powerLevel * .88 : 0;
      this.keyLight.intensity = .45 + (6.8 - .45) * roomLight;
      this.consoleKeyLight.intensity = .35 + ((this.isMobile ? 6.5 : 11) - .35) * roomLight;
      this.coolFillLight.intensity = .12 + ((this.isMobile ? 1.25 : 2.2) - .12) * roomLight;
      this.rimLight.intensity = .22 + ((this.isMobile ? 1.5 : 3.1) - .22) * roomLight;
      this.catBotLight.intensity = .08 + ((this.isMobile ? .55 : 1.1) - .08) * roomLight;
      this.hemisphereLight.intensity = .1 + ((this.isMobile ? .28 : .38) - .1) * roomLight;
      this.emergencyLight.intensity = s.scenario === "master" && s.busy ? 16 * (1 - powerLevel) : 0;
      this.emissiveMaterials?.forEach(({ material, base, isHmi }) => { material.emissiveIntensity = base * (roomIsPowered ? (.08 + powerLevel * .92) : (isHmi ? .035 : .06)); });
      this.cityLights?.forEach((light, index) => { const normal = s.breakerClosed ? .35 : (index % 3 ? .16 : 0); light.intensity = normal * roomLight; });
      if (this.breakerLever) this.breakerLever.rotation.z = s.breakerClosed ? 0 : -.95;
    }
    bindInput() { const canvas = this.renderer.domElement; const endDrag = () => { this.drag = null; }; canvas.addEventListener("pointerdown", (event) => { canvas.setPointerCapture(event.pointerId); this.drag = { x: event.clientX, y: event.clientY, moved: false }; }); canvas.addEventListener("pointermove", (event) => { if (this.drag) { const dx = event.clientX - this.drag.x; const dy = event.clientY - this.drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) this.drag.moved = true; this.yaw = Math.max(-this.maxYaw, Math.min(this.maxYaw, this.yaw - dx * .0065)); this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch - dy * .0035)); this.drag.x = event.clientX; this.drag.y = event.clientY; } else this.setHover(event); }); canvas.addEventListener("pointerup", (event) => { if (!this.drag?.moved) { const hit = this.pick(event); if (hit) this.triggerFault(hit.userData.action); } endDrag(); }); canvas.addEventListener("pointercancel", endDrag); canvas.addEventListener("pointerleave", () => { if (!this.drag) this.clearHover(); }); canvas.addEventListener("wheel", (event) => event.preventDefault(), { passive: false }); }
    pick(event) { const rect = this.renderer.domElement.getBoundingClientRect(); this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1; this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1; this.raycaster.setFromCamera(this.pointer, this.camera); return this.raycaster.intersectObjects(this.interactive, false)[0]?.object; }
    clearHover() { if (this.hover) { this.hover.userData.material.emissiveIntensity = this.hover.userData.base; this.hover = null; this.renderer.domElement.style.cursor = "grab"; } }
    setHover(event) { const hit = this.pick(event); if (hit === this.hover) return; this.clearHover(); if (hit) { this.hover = hit; hit.userData.material.emissiveIntensity = 1.3; this.renderer.domElement.style.cursor = "pointer"; } }
    resetView() { this.yaw = 0; this.pitch = 0; this.zoom = 1; if (this.camera && this.defaultFov) { this.camera.fov = this.defaultFov; this.camera.updateProjectionMatrix(); } }
    updateCamera() {
      const position = this.cameraDefaultPosition || new this.T.Vector3(0, 3.35, 10.41);
      const lookDistance = this.cameraLookDistance || 11;
      const pitch = (this.cameraBasePitch || -.25) + this.pitch;
      const direction = new this.T.Vector3(Math.sin(this.yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(this.yaw) * Math.cos(pitch));
      this.camera.position.copy(position);
      this.camera.lookAt(position.clone().addScaledVector(direction, lookDistance));
    }
    resize() { const rect = this.mount.getBoundingClientRect(); this.camera.aspect = rect.width / Math.max(rect.height, 1); this.camera.updateProjectionMatrix(); this.renderer.setSize(rect.width, rect.height, false); this.composer?.setSize(rect.width, rect.height); }
    collectSceneStats() {
      const stats = { lights: 0, shadowLights: 0, shadowMeshes: 0, skinnedMeshes: 0, staticNodes: this.staticNodeCount };
      this.scene.traverse((node) => {
        if (node.isLight) { stats.lights += 1; if (node.castShadow) stats.shadowLights += 1; }
        if (node.isMesh && node.castShadow) stats.shadowMeshes += 1;
        if (node.isSkinnedMesh) stats.skinnedMeshes += 1;
      });
      this.sceneStats = stats;
    }
    rendererProfile(fps) {
      const info = this.renderer.info;
      return { fps, quality: this.qualityTier, pixelRatio: this.pixelRatio, calls: info.render.calls, triangles: info.render.triangles, textures: info.memory.textures, geometries: info.memory.geometries, ...this.sceneStats };
    }
    updateFrameMetrics(rawDelta) {
      if (!rawDelta || rawDelta > .25) return;
      this.frameMetrics.frames += 1;
      this.frameMetrics.elapsed += rawDelta;
      if (this.frameMetrics.elapsed < 2.5) return;
      const fps = Math.round(this.frameMetrics.frames / this.frameMetrics.elapsed);
      const profile = this.rendererProfile(fps);
      if (!this.frameMetrics.initialProfile) {
        this.frameMetrics.initialProfile = profile;
        console.info("GRID GUARDIAN initial renderer profile:", JSON.stringify(profile));
      }
      this.frameMetrics.latestProfile = profile;
      this.mount.dataset.rendererProfile = JSON.stringify(profile);
      if (this.robot?.isBusy()) {
        if (this.frameMetrics.walkingFps === null) console.info(`GRID GUARDIAN performance sample — WALK: ${fps} FPS`);
        this.frameMetrics.walkingFps = fps;
      } else {
        if (this.frameMetrics.idleFps === null) console.info(`GRID GUARDIAN performance sample — IDLE: ${fps} FPS`);
        this.frameMetrics.idleFps = fps;
      }
      const nextTier = this.qualityTier === "HIGH" && fps < 38 ? "BALANCED" : this.qualityTier === "BALANCED" && fps < 30 ? "LOW" : this.qualityTier === "MOBILE" && fps < 30 ? "MOBILE_LOW" : null;
      if (nextTier && this.frameMetrics.adjustments < 2) this.applyQualityTier(nextTier, `${fps} FPS sustained sample`);
      this.frameMetrics.frames = 0;
      this.frameMetrics.elapsed = 0;
    }
    reportLoadComplete() {
      this.loadTimeMs = Math.round(performance.now() - this.loadStartedAt);
      this.mount.dataset.loadTimeMs = String(this.loadTimeMs);
      console.info(`GRID GUARDIAN control-room load completed in ${this.loadTimeMs} ms.`);
    }
    getPresentationDiagnostics() {
      return {
        cameraPosition: this.camera.position.toArray().map((value) => Number(value.toFixed(3))),
        cameraTarget: this.cameraAnchor?.toArray().map((value) => Number(value.toFixed(3))),
        fov: this.camera.fov,
        near: this.camera.near,
        far: this.camera.far,
        pixelRatio: this.pixelRatio,
        composer: Boolean(this.composer),
        qualityTier: this.qualityTier,
        frameMetrics: { ...this.frameMetrics },
        sceneStats: this.sceneStats,
        loadTimeMs: this.loadTimeMs
      };
    }
    tick() { if (!active) return; const rawDelta = this.clock.getDelta(); const delta = Math.min(rawDelta, .05); this.elapsed += delta; this.plant.update(delta); this.robot?.update(delta, this.elapsed); if (this.generatorRotor) this.generatorRotor.rotation.x += this.plant.generatorOnline ? delta * 5.5 : 0; if (this.fanGroup) this.fanGroup.rotation.z += this.plant.coolingOnline ? delta * 7.5 : 0; this.applyPlantVisuals(); this.drawScada(); this.updateCamera(); this.uiClock += delta; if (this.uiClock > .1 && this.robot) { updateHud(this.plant, this.robot, this.plant.busy || this.robot.isBusy()); this.uiClock = 0; } const robotBusy = Boolean(this.robot?.isBusy()); if (this.renderer.shadowMap.enabled && (robotBusy || this.wasRobotBusy)) { this.shadowRefreshElapsed += delta; if (!robotBusy || this.shadowRefreshElapsed >= this.quality.shadowRefreshInterval) { this.renderer.shadowMap.needsUpdate = true; this.shadowRefreshElapsed = 0; } } this.wasRobotBusy = robotBusy; if (this.composer) this.composer.render(); else this.renderer.render(this.scene, this.camera); this.updateFrameMetrics(rawDelta); this.frame = requestAnimationFrame(() => this.tick()); }
    toggleSound() { const enabled = this.sound.toggle(); const button = shell().querySelector("[data-cr-sound]"); button.textContent = enabled ? "Sound on" : "Sound off"; button.setAttribute("aria-pressed", String(enabled)); this.sound.play("click"); }
    dispose() { cancelAnimationFrame(this.frame); window.removeEventListener("resize", this.resizeHandler); this.robot?.dispose(); this.scene?.traverse((node) => { node.geometry?.dispose?.(); if (node.material) { const materials = Array.isArray(node.material) ? node.material : [node.material]; materials.forEach((material) => { material.map?.dispose?.(); material.dispose?.(); }); } node.userData?.texture?.dispose?.(); }); this.scadaTexture?.dispose(); this.composer?.dispose?.(); this.environmentTarget?.dispose?.(); this.renderer?.dispose(); this.renderer?.domElement.remove(); }
  }

  async function open(options = {}) {
    if (active) return;
    active = true; returnFocus = document.activeElement; const root = roomRoot(); root.setAttribute("aria-hidden", "false"); document.body.classList.add("is-control-room-active"); const ui = createShell(); ui.querySelector("[data-cr-exit]").focus();
    if (options.history !== false && location.hash !== GRID_HASH) history.pushState({ controlRoom: true }, "", GRID_HASH);
    if (!("WebGLRenderingContext" in window)) { setFallback("GRID GUARDIAN requires WebGL-enabled 3D graphics. Return to the portfolio and enable hardware graphics to try again."); return; }
    try {
      const [THREE, loaderModule, presentationModules] = await Promise.all([
        loadThree(), loadGltfLoader(), loadPresentationModules().catch(() => null)
      ]);
      if (!active) return;
      const loadingTitle = ui.querySelector("[data-cr-loading-title]");
      const loadingProgress = ui.querySelector("[data-cr-loading-progress]");
      const loadingDetail = ui.querySelector("[data-cr-loading-detail]");
      const reportProgress = (event) => {
        if (!event.total) { if (loadingDetail) loadingDetail.textContent = "Downloading optimized control-room data..."; return; }
        const percent = Math.min(99, Math.round((event.loaded / event.total) * 100));
        if (loadingProgress) loadingProgress.textContent = `${percent}%`;
        if (loadingDetail) loadingDetail.textContent = `${(event.loaded / 1024 / 1024).toFixed(1)} MB of ${(event.total / 1024 / 1024).toFixed(1)} MB loaded.`;
      };
      engine = new ControlRoomEngine(THREE, loaderModule.GLTFLoader, ui.querySelector("[data-cr-canvas]"), reportProgress, presentationModules);
      await engine.init();
      engine.reportLoadComplete();
      if (loadingProgress) loadingProgress.textContent = "100%";
      if (loadingDetail) loadingDetail.textContent = "Control room ready.";
      ui.querySelector(".cr-loading")?.remove();
    }
    catch (error) { console.error("Grid Guardian failed to initialize the final Blender control room.", { modelUrl: MODEL_URL, error }); if (active) setFallback("GRID GUARDIAN requires WebGL-enabled 3D graphics and the CatBot control-room model. The portfolio remains available without the 3D experience."); }
  }
  function close({ restoreFocus = true } = {}) { if (!active) return; active = false; engine?.dispose(); engine = null; roomRoot().setAttribute("aria-hidden", "true"); shell().replaceChildren(); document.body.classList.remove("is-control-room-active"); if (restoreFocus && returnFocus instanceof HTMLElement) returnFocus.focus(); }
  function exit() { if (location.hash === GRID_HASH && history.state?.controlRoom) history.back(); else { history.replaceState({ section: "entertainment" }, "", "#entertainment"); close(); } }
  window.addEventListener("keydown", (event) => { if (active && event.key === "Escape") { event.preventDefault(); exit(); } });
  window.addEventListener("popstate", () => { if (location.hash === GRID_HASH && !active) open({ history: false }); else if (active && location.hash !== GRID_HASH) close({ restoreFocus: false }); });
  return { open, close, setRobotExpression: (expression) => engine?.robot.setRobotExpression(expression), getInspection: () => engine?.inspection ? { ...engine.inspection, mixerRoot: undefined } : null, getPresentationDiagnostics: () => engine?.getPresentationDiagnostics() || null };
})();
