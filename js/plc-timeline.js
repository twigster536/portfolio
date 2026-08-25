/* PLC Timeline V7 — fixed HUD viewing a supplied tall timeline artwork. */
window.PlcTimeline = (() => {
  const ARTWORK_SRC = "assets/images/timeline/v7/plc-timeline-final.png";
  const ARTWORK_SOURCE_HEIGHT = 1672;
  const START_PROGRESS = .02;
  // Source-image focal positions were measured from the supplied 941 × 1672 PNG.
  // They intentionally follow the artwork's actual equipment order rather than equal slices.
  const STAGES = Object.freeze([
    { key: "robotics", sourceY: 210, right: 0, value: 0, theme: 0 },
    { key: "networking", sourceY: 450, right: 1, value: 4, theme: 1 },
    { key: "plc", sourceY: 640, right: 2, value: 2, theme: 2 },
    { key: "hvac", sourceY: 875, right: 3, value: 3, theme: 3 },
    { key: "ai", sourceY: 1105, right: 4, value: 0, theme: 3 },
    { key: "future", sourceY: 1380, right: 5, value: 5, theme: 4 }
  ]);

  let openState;
  let returnFocus;
  let artworkPreload;

  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const root = () => document.getElementById("plcTimeline");

  /*
   * The artwork itself deliberately remains a clean, unfiltered PNG.  This canvas is
   * only the low-contrast environmental layer sitting behind the artwork and HUD.
   * Keeping it here avoids adding another rendering engine to the portfolio.
   */
  function createSpaceBackground(canvas, shell) {
    const context = canvas?.getContext?.("2d", { alpha: true });
    if (!context || !shell) return { setTimelineOffset() {}, dispose() {} };

    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
    const colors = ["#006DFF", "#009DFF", "#00D9FF", "#75F3FF"];
    const state = {
      active: true,
      frame: 0,
      width: 1,
      height: 1,
      ratio: 1,
      timelineOffset: 0,
      pointer: { x: 0, y: 0, targetX: 0, targetY: 0 },
      layers: [],
      fragments: [],
      nodes: [],
      streaks: []
    };

    const wrap = (value, limit) => ((value % limit) + limit) % limit;
    const random = (min, max) => min + Math.random() * (max - min);
    const isCompact = () => innerWidth <= 820;

    function makeParticles(count, options) {
      return Array.from({ length: count }, () => ({
        x: Math.random(),
        y: Math.random(),
        radius: random(options.radius[0], options.radius[1]),
        opacity: random(options.opacity[0], options.opacity[1]),
        speedX: random(options.speedX[0], options.speedX[1]),
        speedY: random(options.speedY[0], options.speedY[1]),
        color: colors[Math.floor(Math.random() * colors.length)],
        phase: random(0, Math.PI * 2)
      }));
    }

    function buildScene() {
      const compact = isCompact();
      state.layers = [
        { particles: makeParticles(compact ? 64 : 170, { radius: [.35, .75], opacity: [.06, .18], speedX: [-.35, .35], speedY: [-.48, .08] }), parallax: .02, mouse: .18, glow: false },
        { particles: makeParticles(compact ? 31 : 78, { radius: [.48, 1.05], opacity: [.09, .27], speedX: [-.65, .65], speedY: [-.85, -.12] }), parallax: .055, mouse: .52, glow: false },
        { particles: makeParticles(compact ? 10 : 25, { radius: [.8, 1.5], opacity: [.16, .42], speedX: [-1.15, 1.15], speedY: [-1.45, -.32] }), parallax: .10, mouse: 1, glow: true }
      ];
      state.fragments = Array.from({ length: compact ? 12 : 32 }, () => ({
        x: Math.random(), y: Math.random(), vertical: Math.random() > .56,
        length: random(12, compact ? 27 : 44), opacity: random(.025, .09), phase: random(0, Math.PI * 2), color: colors[Math.floor(Math.random() * 3)]
      }));
      state.nodes = Array.from({ length: compact ? 7 : 18 }, () => ({
        x: Math.random(), y: Math.random(), opacity: random(.035, .13), phase: random(0, Math.PI * 2), color: colors[Math.floor(Math.random() * colors.length)]
      }));
      state.streaks = Array.from({ length: compact ? 1 : 3 }, () => ({
        x: random(.08, .9), y: random(.12, .84), length: random(20, 56), driftX: random(.03, .12), driftY: random(-.045, -.012), duration: random(.5, .9), interval: random(12, 21), offset: random(0, 18), opacity: random(.13, .23), color: colors[Math.floor(Math.random() * colors.length)]
      }));
    }

    function resize() {
      const bounds = canvas.getBoundingClientRect();
      state.width = Math.max(1, bounds.width);
      state.height = Math.max(1, bounds.height);
      state.ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(state.width * state.ratio);
      canvas.height = Math.round(state.height * state.ratio);
      context.setTransform(state.ratio, 0, 0, state.ratio, 0, 0);
      buildScene();
      draw(performance.now());
    }

    function drawDetails(seconds) {
      state.fragments.forEach((fragment) => {
        const brightness = .52 + Math.sin(seconds * .18 + fragment.phase) * .48;
        context.globalAlpha = fragment.opacity * brightness;
        context.strokeStyle = fragment.color;
        context.lineWidth = 1;
        context.beginPath();
        const x = fragment.x * state.width + state.pointer.x * .1;
        const y = fragment.y * state.height + state.timelineOffset * .008 + state.pointer.y * .1;
        if (fragment.vertical) {
          context.moveTo(x, y);
          context.lineTo(x, y + fragment.length);
        } else {
          context.moveTo(x, y);
          context.lineTo(x + fragment.length, y);
        }
        context.stroke();
      });
      state.nodes.forEach((node) => {
        context.globalAlpha = node.opacity * (.52 + Math.sin(seconds * .23 + node.phase) * .48);
        context.fillStyle = node.color;
        context.fillRect(node.x * state.width, node.y * state.height + state.timelineOffset * .008, 1.25, 1.25);
      });
    }

    function drawLayer(layer, seconds) {
      layer.particles.forEach((particle) => {
        const x = wrap(particle.x * state.width + seconds * particle.speedX + state.pointer.x * layer.mouse, state.width + 8) - 4;
        const y = wrap(particle.y * state.height + seconds * particle.speedY + state.timelineOffset * layer.parallax + state.pointer.y * layer.mouse, state.height + 8) - 4;
        context.globalAlpha = particle.opacity * (.76 + Math.sin(seconds * .36 + particle.phase) * .24);
        context.fillStyle = particle.color;
        if (layer.glow) {
          context.shadowColor = particle.color;
          context.shadowBlur = 7;
        }
        context.beginPath();
        context.arc(x, y, particle.radius, 0, Math.PI * 2);
        context.fill();
        if (layer.glow) context.shadowBlur = 0;
      });
    }

    function drawStreaks(seconds) {
      state.streaks.forEach((streak) => {
        const cycle = (seconds + streak.offset) % streak.interval;
        if (cycle > streak.duration) return;
        const progress = cycle / streak.duration;
        const alpha = Math.sin(progress * Math.PI) * streak.opacity;
        const x = (streak.x + progress * streak.driftX) * state.width;
        const y = (streak.y + progress * streak.driftY) * state.height + state.timelineOffset * .04;
        context.globalAlpha = alpha;
        context.strokeStyle = streak.color;
        context.lineWidth = 1;
        context.shadowColor = streak.color;
        context.shadowBlur = 6;
        context.beginPath();
        context.moveTo(x - streak.length, y + streak.length * .22);
        context.lineTo(x, y);
        context.stroke();
        context.shadowBlur = 0;
      });
    }

    function draw(time) {
      if (!state.active) return;
      const seconds = time * .001;
      context.clearRect(0, 0, state.width, state.height);
      drawDetails(seconds);
      state.layers.forEach((layer) => drawLayer(layer, seconds));
      drawStreaks(seconds);
      context.globalAlpha = 1;
    }

    function schedule() {
      if (reducedMotion || !state.active || document.hidden || state.frame) return;
      state.frame = requestAnimationFrame((time) => {
        state.frame = 0;
        state.pointer.x += (state.pointer.targetX - state.pointer.x) * .055;
        state.pointer.y += (state.pointer.targetY - state.pointer.y) * .055;
        draw(time);
        schedule();
      });
    }

    function onPointerMove(event) {
      const bounds = shell.getBoundingClientRect();
      state.pointer.targetX = clamp(((event.clientX - bounds.left) / Math.max(1, bounds.width) - .5) * 10, -5, 5);
      state.pointer.targetY = clamp(((event.clientY - bounds.top) / Math.max(1, bounds.height) - .5) * 10, -5, 5);
    }

    function onPointerLeave() {
      state.pointer.targetX = 0;
      state.pointer.targetY = 0;
    }

    function onVisibilityChange() {
      if (document.hidden) {
        cancelAnimationFrame(state.frame);
        state.frame = 0;
      } else {
        draw(performance.now());
        schedule();
      }
    }

    buildScene();
    window.addEventListener("resize", resize, { passive: true });
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (finePointer && !reducedMotion) {
      shell.addEventListener("pointermove", onPointerMove, { passive: true });
      shell.addEventListener("pointerleave", onPointerLeave, { passive: true });
    }
    resize();
    schedule();

    return {
      setTimelineOffset(offset) {
        state.timelineOffset = Number.isFinite(offset) ? offset : 0;
        if (reducedMotion) draw(performance.now());
      },
      dispose() {
        state.active = false;
        cancelAnimationFrame(state.frame);
        window.removeEventListener("resize", resize);
        document.removeEventListener("visibilitychange", onVisibilityChange);
        shell.removeEventListener("pointermove", onPointerMove);
        shell.removeEventListener("pointerleave", onPointerLeave);
      }
    };
  }

  function preload() {
    if (artworkPreload) return artworkPreload;
    artworkPreload = new Image();
    artworkPreload.decoding = "async";
    artworkPreload.src = ARTWORK_SRC;
    artworkPreload.decode?.().catch(() => undefined);
    return artworkPreload;
  }

  function stageProgresses(state) {
    const centerHeight = state.center.clientHeight || 1;
    const artworkHeight = state.artwork.offsetHeight || centerHeight * 4.25;
    const sourceHeight = state.artwork.naturalHeight || ARTWORK_SOURCE_HEIGHT;
    const travel = Math.max(1, artworkHeight - centerHeight);
    const focalY = centerHeight * .48;
    return STAGES.map((stage) => clamp(((stage.sourceY / sourceHeight) * artworkHeight - focalY) / travel));
  }

  function nearestStageIndex(progress, positions) {
    return positions.reduce((bestIndex, position, index) => (
      Math.abs(progress - position) < Math.abs(progress - positions[bestIndex]) ? index : bestIndex
    ), 0);
  }

  function render(state) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    state.progress = reduced ? state.targetProgress : state.progress + (state.targetProgress - state.progress) * .16;
    if (Math.abs(state.targetProgress - state.progress) < .0005) state.progress = state.targetProgress;

    const centerHeight = state.center.clientHeight || 1;
    const artworkHeight = state.artwork.offsetHeight || centerHeight * 4.25;
    const travel = Math.max(0, artworkHeight - centerHeight);
    const positions = stageProgresses(state);
    const stageIndex = nearestStageIndex(state.progress, positions);
    const stage = STAGES[stageIndex];

    const artworkY = -(state.progress * travel);
    state.artwork.style.setProperty("--plc6-art-y", `${artworkY.toFixed(1)}px`);
    state.space?.setTimelineOffset(artworkY);
    state.shell.dataset.stage = stage.key;
    state.milestones.forEach((node, index) => {
      const active = index === stage.right;
      node.classList.toggle("is-active", active);
      node.setAttribute("aria-current", active ? "step" : "false");
    });
    state.values.forEach((node, index) => node.classList.toggle("is-active", index === stage.value));
    state.themes.forEach((node, index) => node.classList.toggle("is-active", index === stage.theme));
    state.status.textContent = `Journey stage: ${stage.key}`;
    if (state.active && Math.abs(state.targetProgress - state.progress) > .0005) schedule(state);
  }

  function schedule(state) {
    if (!state.active || state.frame) return;
    state.frame = requestAnimationFrame(() => {
      state.frame = 0;
      render(state);
    });
  }

  function travel(state, delta) {
    state.targetProgress = clamp(state.targetProgress + delta);
    schedule(state);
  }

  function keyTravel(state, event) {
    const step = event.key === "ArrowDown" ? .045 : event.key === "ArrowUp" ? -.045 : event.key === "PageDown" ? .16 : event.key === "PageUp" ? -.16 : 0;
    if (event.key === "Home") {
      event.preventDefault();
      state.targetProgress = START_PROGRESS;
      schedule(state);
      return true;
    }
    if (event.key === "End") {
      event.preventDefault();
      state.targetProgress = 1;
      schedule(state);
      return true;
    }
    if (!step) return false;
    event.preventDefault();
    travel(state, step);
    return true;
  }

  function markup() {
    const container = root();
    if (!container) return undefined;
    container.replaceChildren();
    container.innerHTML = `
      <div class="plc6-scroll-track"><section class="plc6-shell" aria-label="PLC and Automation Timeline">
        <div class="plc6-space" aria-hidden="true"><canvas class="plc6-space-canvas"></canvas></div><div class="plc6-backdrop" aria-hidden="true"></div><div class="plc6-frame" aria-hidden="true"></div>
        <aside class="plc6-left" aria-label="Journey introduction"><p class="plc6-eyebrow">MY JOURNEY</p><h1>PLC &amp; AUTOMATION <span>TIMELINE</span></h1><p class="plc6-subtitle">From Learning to<br />Building Intelligent<br />HVAC Systems</p><section class="plc6-aim"><h2>AIM</h2><p>Build AI based<br />HVAC systems<br />for a smarter<br />and sustainable<br />future.</p></section><ul class="plc6-values"><li><b>INTELLIGENT</b><span>Systems</span></li><li><b>SUSTAINABLE</b><span>Future</span></li><li><b>AUTOMATE</b><span>Processes</span></li><li><b>OPTIMIZE</b><span>Performance</span></li><li><b>SECURE</b><span>Network</span></li><li><b>INNOVATE</b><span>Continuously</span></li></ul></aside>
        <main class="plc6-center" aria-label="Scroll-controlled reference timeline artwork"><div class="plc6-artwork-scene"><img class="plc6-artwork" src="${ARTWORK_SRC}" alt="" aria-hidden="true" decoding="async" fetchpriority="high" /></div></main>
        <aside class="plc6-right" aria-label="Career milestones"><ol>${[{ icon: "&#8984;", year: "2020", copy: "Introduction to<br />Robotics Certification" }, { icon: "&#8680;", year: "2023", copy: "Web Security &amp;<br />Networking" }, { icon: "&#9635;", year: "2024", copy: "Begin PLC with<br />4 Languages" }, { icon: "&#9673;", year: "2025", copy: "Begin HVAC<br />(Walk through to<br />Gas 2 Technician<br />Certification)" }, { icon: "AI", year: "2026", copy: "Progress<br />Building AI Based<br />HVAC Systems" }, { icon: "&#8734;", year: "FUTURE", copy: "Smart City<br />BAS System" }].map((item, index) => `<li${index === 0 ? " class=\"is-active\"" : ""}><span class="plc6-node" aria-hidden="true"><span class="plc6-node-ring plc6-node-ring--one"></span><span class="plc6-node-ring plc6-node-ring--two"></span><span class="plc6-node-ring plc6-node-ring--three"></span><i class="plc6-node-icon">${item.icon}</i></span><span class="plc6-node-copy"><b>${item.year}</b><em>${item.copy}</em></span></li>`).join("")}</ol></aside>
        <footer class="plc6-footer"><p>LEARNING. BUILDING. AUTOMATING. INNOVATING.<br /><span>ONE STEP AT A TIME.</span></p><nav aria-label="Journey themes"><span class="is-active"><i>&#9636;</i>LEARN</span><span><i>&#9874;</i>BUILD</span><span><i>&#9881;</i>AUTOMATE</span><span><i>&#9674;</i>INNOVATE</span><span><i>&#8858;</i>SUSTAIN</span></nav></footer><p class="plc6-sr-status" aria-live="polite"></p><button class="plc6-close" type="button" data-plc6-close aria-label="Close PLC automation timeline">&times;</button>
      </section></div>`;

    return {
      container,
      close: container.querySelector("[data-plc6-close]"),
      shell: container.querySelector(".plc6-shell"),
      spaceCanvas: container.querySelector(".plc6-space-canvas"),
      center: container.querySelector(".plc6-center"),
      artwork: container.querySelector(".plc6-artwork"),
      milestones: [...container.querySelectorAll(".plc6-right li")],
      values: [...container.querySelectorAll(".plc6-values li")],
      themes: [...container.querySelectorAll(".plc6-footer nav span")],
      status: container.querySelector(".plc6-sr-status")
    };
  }

  function close() {
    if (!openState?.active) return;
    const state = openState;
    state.active = false;
    cancelAnimationFrame(state.frame);
    state.container.removeEventListener("wheel", state.onWheel);
    state.container.removeEventListener("touchstart", state.onTouchStart);
    state.container.removeEventListener("touchmove", state.onTouchMove);
    state.container.removeEventListener("keydown", state.onKeydown);
    document.removeEventListener("keydown", state.onDocumentKeydown);
    state.close.removeEventListener("click", state.onClose);
    state.artwork.removeEventListener("load", state.onArtworkLoad);
    state.space?.dispose();
    state.container.replaceChildren();
    state.container.removeAttribute("tabindex");
    state.container.classList.remove("is-open");
    state.container.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-plc-timeline-active");
    document.documentElement.classList.remove("is-plc-timeline-active");
    openState = undefined;
    window.setTimeout(() => {
      if (returnFocus instanceof HTMLElement && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true });
    }, 0);
  }

  function open(trigger) {
    if (openState?.active) return;
    returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    preload();
    const ui = markup();
    if (!ui) return;
    ui.container.classList.add("is-open");
    ui.container.setAttribute("aria-hidden", "false");
    ui.container.tabIndex = 0;
    document.body.classList.add("is-plc-timeline-active");
    document.documentElement.classList.add("is-plc-timeline-active");
    openState = { active: true, frame: 0, progress: START_PROGRESS, targetProgress: START_PROGRESS, touchY: null, ...ui };
    openState.space = createSpaceBackground(ui.spaceCanvas, ui.shell);
    openState.onWheel = (event) => { event.preventDefault(); travel(openState, event.deltaY / Math.max(1200, innerHeight * 5.4)); };
    openState.onTouchStart = (event) => { openState.touchY = event.touches[0]?.clientY ?? null; };
    openState.onTouchMove = (event) => { const nextY = event.touches[0]?.clientY; if (openState.touchY == null || nextY == null) return; event.preventDefault(); travel(openState, (openState.touchY - nextY) / Math.max(900, innerHeight * 3.6)); openState.touchY = nextY; };
    openState.onKeydown = (event) => keyTravel(openState, event);
    openState.onDocumentKeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); close(); } else if (!event.defaultPrevented && !(event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) keyTravel(openState, event); };
    openState.onClose = close;
    openState.onArtworkLoad = () => schedule(openState);
    ui.container.addEventListener("wheel", openState.onWheel, { passive: false });
    ui.container.addEventListener("touchstart", openState.onTouchStart, { passive: true });
    ui.container.addEventListener("touchmove", openState.onTouchMove, { passive: false });
    ui.container.addEventListener("keydown", openState.onKeydown);
    document.addEventListener("keydown", openState.onDocumentKeydown);
    ui.close.addEventListener("click", openState.onClose);
    ui.artwork.addEventListener("load", openState.onArtworkLoad, { once: true });
    requestAnimationFrame(() => { render(openState); ui.container.focus({ preventScroll: true }); });
  }

  window.addEventListener("load", () => window.setTimeout(preload, 1200), { once: true });
  return { open, close };
})();
