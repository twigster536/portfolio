/* PLC Timeline V6 — fixed HUD looking into a virtual helical journey. */
window.PlcTimeline = (() => {
  const ASSET_ROOT = "assets/images/timeline/v6/";
  const SCENE_FACTOR = 6.2;
  const START_PROGRESS = 0.09;
  const ASSETS = Object.freeze(["robotics.png", "networking.png", "plc.png", "hvac.png", "ai-brain.png", "bas-city.png"]);
  const STAGES = Object.freeze([
    { key: "robotics", focus: 0.09, right: 0, value: 0, theme: 0 },
    { key: "networking", focus: 0.27, right: 1, value: 4, theme: 1 },
    { key: "plc", focus: 0.45, right: 2, value: 2, theme: 2 },
    { key: "hvac", focus: 0.63, right: 3, value: 3, theme: 3 },
    { key: "ai", focus: 0.81, right: 4, value: 0, theme: 3 },
    { key: "future", focus: 0.98, right: 5, value: 5, theme: 4 }
  ]);
  const ANCHORS = Object.freeze([
    { key: "robotics", file: "robotics.png", label: "ROBOTICS", focus: 0.09, top: 15.6, angle: 68, radius: 1.0 },
    { key: "networking", file: "networking.png", label: "NETWORKING", focus: 0.27, top: 30.7, angle: 25, radius: .94 },
    { key: "plc", file: "plc.png", label: "PLC CONTROL", focus: 0.45, top: 45.8, angle: -18, radius: 1.04 },
    { key: "hvac", file: "hvac.png", label: "HVAC", focus: 0.63, top: 60.9, angle: -61, radius: .94 },
    { key: "ai", file: "ai-brain.png", label: "AI INTELLIGENCE", focus: 0.81, top: 76, angle: -104, radius: 1.02 },
    { key: "city", file: "bas-city.png", label: "FUTURE BAS SYSTEM", focus: 0.98, top: 90.3, angle: -145, radius: 1.06 }
  ]);
  let openState;
  let returnFocus;
  const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
  const smooth = (value) => { const safe = clamp(value); return safe * safe * (3 - 2 * safe); };
  const root = () => document.getElementById("plcTimeline");

  function preload() { ASSETS.forEach((file) => { const image = new Image(); image.decoding = "async"; image.src = `${ASSET_ROOT}${file}`; image.decode?.().catch(() => undefined); }); }
  function stageFor(progress) { return progress < .18 ? 0 : progress < .36 ? 1 : progress < .54 ? 2 : progress < .72 ? 3 : progress < .9 ? 4 : 5; }

  function render(state) {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    state.progress = reduced ? state.targetProgress : state.progress + (state.targetProgress - state.progress) * .16;
    if (Math.abs(state.targetProgress - state.progress) < .0005) state.progress = state.targetProgress;
    const progress = state.progress;
    const stage = STAGES[stageFor(progress)];
    const centerHeight = state.center.clientHeight;
    const travel = centerHeight * (SCENE_FACTOR - 1);
    const radius = Math.min(state.center.clientWidth * .34, 255);
    state.scene.style.setProperty("--plc6-scene-y", `${-(progress * travel).toFixed(1)}px`);
    state.rotor.style.setProperty("--plc6-rotor-y", `${(progress * 18 - 9).toFixed(2)}deg`);
    state.shell.style.setProperty("--plc6-energy-a", `${220 - progress * 360}`);
    state.shell.style.setProperty("--plc6-energy-b", `${-90 - progress * 420}`);
    state.shell.style.setProperty("--plc6-energy-c", `${70 - progress * 310}`);
    state.shell.dataset.stage = stage.key;

    state.anchors.forEach((anchor) => {
      const proximity = smooth(1 - Math.abs(progress - anchor.focus) / .18);
      const futureBoost = stage.key === "future" && anchor.key === "city" ? .72 : 0;
      const stageBoost = stage.key === anchor.key ? .7 : futureBoost;
      const strength = Math.max(proximity, stageBoost);
      const angle = (anchor.angle + progress * 240) * Math.PI / 180;
      const orbitRadius = radius * anchor.radius;
      const x = Math.cos(angle) * orbitRadius;
      const depth = Math.sin(angle) * orbitRadius * .72 + strength * 50;
      const scale = .56 + strength * .62;
      const opacity = .14 + strength * .86;
      anchor.node.style.setProperty("--plc6-orbit-x", `${x.toFixed(1)}px`);
      anchor.node.style.setProperty("--plc6-depth", `${depth.toFixed(1)}px`);
      anchor.node.style.setProperty("--plc6-object-scale", scale.toFixed(3));
      anchor.node.style.setProperty("--plc6-object-opacity", opacity.toFixed(3));
      anchor.node.style.setProperty("--plc6-object-rotate-y", `${(-Math.cos(angle) * 9).toFixed(2)}deg`);
      anchor.node.style.setProperty("--plc6-halo", strength.toFixed(3));
      anchor.node.style.setProperty("--plc6-object-light", (.72 + strength * .46).toFixed(3));
      anchor.node.style.zIndex = String(8 + Math.round(depth));
      anchor.node.classList.toggle("is-focus", strength > .56);
    });
    state.milestones.forEach((node, index) => { const active = index === stage.right; node.classList.toggle("is-active", active); node.setAttribute("aria-current", active ? "step" : "false"); });
    state.values.forEach((node, index) => node.classList.toggle("is-active", index === stage.value));
    state.themes.forEach((node, index) => node.classList.toggle("is-active", index === stage.theme));
    state.convergence.classList.toggle("is-active", progress >= .9);
    state.status.textContent = `Journey stage: ${stage.key}`;
    if (state.active && Math.abs(state.targetProgress - state.progress) > .0005) schedule(state);
  }

  function schedule(state) { if (!state.active || state.frame) return; state.frame = requestAnimationFrame(() => { state.frame = 0; render(state); }); }
  function travel(state, delta) { state.targetProgress = clamp(state.targetProgress + delta); schedule(state); }
  function keyTravel(state, event) {
    const step = event.key === "ArrowDown" ? .045 : event.key === "ArrowUp" ? -.045 : event.key === "PageDown" ? .16 : event.key === "PageUp" ? -.16 : 0;
    if (event.key === "Home") { event.preventDefault(); state.targetProgress = START_PROGRESS; schedule(state); return true; }
    if (event.key === "End") { event.preventDefault(); state.targetProgress = 1; schedule(state); return true; }
    if (!step) return false;
    event.preventDefault(); travel(state, step); return true;
  }

  function markup() {
    const container = root();
    container.replaceChildren();
    container.innerHTML = `
      <div class="plc6-scroll-track"><section class="plc6-shell" aria-label="PLC and Automation Timeline">
        <div class="plc6-backdrop" aria-hidden="true"><i></i><i></i><i></i><b></b><b></b></div><div class="plc6-particles" aria-hidden="true"><span class="plc6-particle-field plc6-particle-field--back"></span><span class="plc6-particle-field plc6-particle-field--mid"></span><span class="plc6-particle-field plc6-particle-field--front"></span></div><div class="plc6-frame" aria-hidden="true"></div>
        <aside class="plc6-left" aria-label="Journey introduction"><p class="plc6-eyebrow">MY JOURNEY</p><h1>PLC &amp; AUTOMATION <span>TIMELINE</span></h1><p class="plc6-subtitle">From Learning to<br />Building Intelligent<br />HVAC Systems</p><section class="plc6-aim"><h2>AIM</h2><p>Build AI based<br />HVAC systems<br />for a smarter<br />and sustainable<br />future.</p></section><ul class="plc6-values"><li><b>INTELLIGENT</b><span>Systems</span></li><li><b>SUSTAINABLE</b><span>Future</span></li><li><b>AUTOMATE</b><span>Processes</span></li><li><b>OPTIMIZE</b><span>Performance</span></li><li><b>SECURE</b><span>Network</span></li><li><b>INNOVATE</b><span>Continuously</span></li></ul></aside>
        <main class="plc6-center" aria-label="Internal helical career journey"><div class="plc6-spiral-scene"><div class="plc6-scene-rotor">
          <svg class="plc6-spiral" viewBox="0 0 760 6200" role="presentation" aria-hidden="true"><defs><filter id="plc6-glow"><feGaussianBlur stdDeviation="3.8" result="glow"/><feMerge><feMergeNode in="glow"/><feMergeNode in="SourceGraphic"/></feMerge></filter><filter id="plc6-energy-glow"><feGaussianBlur stdDeviation="5" result="energyGlow"/><feMerge><feMergeNode in="energyGlow"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="plc6-rail" x1="0" x2="1"><stop stop-color="#0056c9"/><stop offset=".45" stop-color="#bffcff"/><stop offset=".55" stop-color="#15d8ff"/><stop offset="1" stop-color="#0258cb"/></linearGradient></defs><g class="plc6-rails" filter="url(#plc6-glow)"><path class="plc6-rail-shadow" d="M380 0 C700 100 700 300 380 400 C60 500 60 700 380 800 C700 900 700 1100 380 1200 C60 1300 60 1500 380 1600 C700 1700 700 1900 380 2000 C60 2100 60 2300 380 2400 C700 2500 700 2700 380 2800 C60 2900 60 3100 380 3200 C700 3300 700 3500 380 3600 C60 3700 60 3900 380 4000 C700 4100 700 4300 380 4400 C60 4500 60 4700 380 4800 C700 4900 700 5100 380 5200 C60 5300 60 5500 380 5600 C700 5700 700 5900 380 6000"/><path class="plc6-rail rail-outer-a" d="M380 0 C700 100 700 300 380 400 C60 500 60 700 380 800 C700 900 700 1100 380 1200 C60 1300 60 1500 380 1600 C700 1700 700 1900 380 2000 C60 2100 60 2300 380 2400 C700 2500 700 2700 380 2800 C60 2900 60 3100 380 3200 C700 3300 700 3500 380 3600 C60 3700 60 3900 380 4000 C700 4100 700 4300 380 4400 C60 4500 60 4700 380 4800 C700 4900 700 5100 380 5200 C60 5300 60 5500 380 5600 C700 5700 700 5900 380 6000"/><path class="plc6-rail rail-outer-b" d="M390 0 C710 105 710 295 390 405 C70 505 70 695 390 805 C710 905 710 1095 390 1205 C70 1305 70 1495 390 1605 C710 1705 710 1895 390 2005 C70 2105 70 2295 390 2405 C710 2505 710 2695 390 2805 C70 2905 70 3095 390 3205 C710 3305 710 3495 390 3605 C70 3705 70 3895 390 4005 C710 4105 710 4295 390 4405 C70 4505 70 4695 390 4805 C710 4905 710 5095 390 5205 C70 5305 70 5495 390 5605 C710 5705 710 5895 390 6000"/><path class="plc6-rail rail-inner-a" d="M400 0 C690 110 690 290 400 410 C110 510 110 690 400 810 C690 910 690 1090 400 1210 C110 1310 110 1490 400 1610 C690 1710 690 1890 400 2010 C110 2110 110 2290 400 2410 C690 2510 690 2690 400 2810 C110 2910 110 3090 400 3210 C690 3310 690 3490 400 3610 C110 3710 110 3890 400 4010 C690 4110 690 4290 400 4410 C110 4510 110 4690 400 4810 C690 4910 690 5090 400 5210 C110 5310 110 5490 400 5610 C690 5710 690 5890 400 6000"/></g><g class="plc6-energy" filter="url(#plc6-energy-glow)"><path class="plc6-energy-a" pathLength="100" d="M400 0 C690 110 690 290 400 410 C110 510 110 690 400 810 C690 910 690 1090 400 1210 C110 1310 110 1490 400 1610 C690 1710 690 1890 400 2010 C110 2110 110 2290 400 2410 C690 2510 690 2690 400 2810 C110 2910 110 3090 400 3210 C690 3310 690 3490 400 3610 C110 3710 110 3890 400 4010 C690 4110 690 4290 400 4410 C110 4510 110 4690 400 4810 C690 4910 690 5090 400 5210 C110 5310 110 5490 400 5610 C690 5710 690 5890 400 6000"/></g></svg>
          ${ANCHORS.map((item) => `<figure class="plc6-object plc6-anchor plc6-${item.key}" style="--plc6-anchor-top:${item.top}%"><img src="${ASSET_ROOT}${item.file}" alt="${item.label}" /><figcaption>${item.label}</figcaption></figure>`).join("")}
          <div class="plc6-convergence" aria-hidden="true"><span>R</span><span>N</span><span>P</span><span>H</span><span>AI</span></div>
        </div></div></main>
        <aside class="plc6-right" aria-label="Career milestones"><ol>${[{ icon: "&#8984;", year: "2020", copy: "Introduction to<br />Robotics Certification" }, { icon: "&#8680;", year: "2023", copy: "Web Security &amp;<br />Networking" }, { icon: "&#9635;", year: "2024", copy: "Begin PLC with<br />4 Languages" }, { icon: "&#9673;", year: "2025", copy: "Begin HVAC<br />(Walk through to<br />Gas 2 Technician<br />Certification)" }, { icon: "AI", year: "2026", copy: "Progress<br />Building AI Based<br />HVAC Systems" }, { icon: "&#8734;", year: "FUTURE", copy: "Smart City<br />BAS System" }].map((item, index) => `<li${index === 0 ? " class=\"is-active\"" : ""}><span class="plc6-node" aria-hidden="true"><span class="plc6-node-ring plc6-node-ring--one"></span><span class="plc6-node-ring plc6-node-ring--two"></span><span class="plc6-node-ring plc6-node-ring--three"></span><i class="plc6-node-icon">${item.icon}</i></span><span class="plc6-node-copy"><b>${item.year}</b><em>${item.copy}</em></span></li>`).join("")}</ol></aside>
        <footer class="plc6-footer"><p>LEARNING. BUILDING. AUTOMATING. INNOVATING.<br /><span>ONE STEP AT A TIME.</span></p><nav aria-label="Journey themes"><span class="is-active"><i>&#9636;</i>LEARN</span><span><i>&#9874;</i>BUILD</span><span><i>&#9881;</i>AUTOMATE</span><span><i>&#9674;</i>INNOVATE</span><span><i>&#8858;</i>SUSTAIN</span></nav></footer><p class="plc6-sr-status" aria-live="polite"></p><button class="plc6-close" type="button" data-plc6-close aria-label="Close PLC automation timeline">&times;</button>
      </section></div>`;
    return { container, close: container.querySelector("[data-plc6-close]"), shell: container.querySelector(".plc6-shell"), center: container.querySelector(".plc6-center"), scene: container.querySelector(".plc6-spiral-scene"), rotor: container.querySelector(".plc6-scene-rotor"), anchors: ANCHORS.map((item) => ({ ...item, node: container.querySelector(`.plc6-${item.key}`) })), milestones: [...container.querySelectorAll(".plc6-right li")], values: [...container.querySelectorAll(".plc6-values li")], themes: [...container.querySelectorAll(".plc6-footer nav span")], convergence: container.querySelector(".plc6-convergence"), status: container.querySelector(".plc6-sr-status") };
  }

  function close() { if (!openState?.active) return; const state = openState; state.active = false; cancelAnimationFrame(state.frame); state.container.removeEventListener("wheel", state.onWheel); state.container.removeEventListener("touchstart", state.onTouchStart); state.container.removeEventListener("touchmove", state.onTouchMove); state.container.removeEventListener("keydown", state.onKeydown); document.removeEventListener("keydown", state.onDocumentKeydown); state.close.removeEventListener("click", state.onClose); state.observer?.disconnect(); state.container.replaceChildren(); state.container.removeAttribute("tabindex"); state.container.classList.remove("is-open"); state.container.setAttribute("aria-hidden", "true"); document.body.classList.remove("is-plc-timeline-active"); document.documentElement.classList.remove("is-plc-timeline-active"); openState = undefined; window.setTimeout(() => { if (returnFocus instanceof HTMLElement && document.contains(returnFocus)) returnFocus.focus({ preventScroll: true }); }, 0); }

  function open(trigger) {
    if (openState?.active) return;
    returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    preload(); const ui = markup(); ui.container.classList.add("is-open"); ui.container.setAttribute("aria-hidden", "false"); ui.container.tabIndex = 0; document.body.classList.add("is-plc-timeline-active"); document.documentElement.classList.add("is-plc-timeline-active");
    openState = { active: true, frame: 0, progress: START_PROGRESS, targetProgress: START_PROGRESS, touchY: null, ...ui };
    openState.onWheel = (event) => { event.preventDefault(); travel(openState, event.deltaY / Math.max(1200, innerHeight * 5.4)); };
    openState.onTouchStart = (event) => { openState.touchY = event.touches[0]?.clientY ?? null; };
    openState.onTouchMove = (event) => { const nextY = event.touches[0]?.clientY; if (openState.touchY == null || nextY == null) return; event.preventDefault(); travel(openState, (openState.touchY - nextY) / Math.max(900, innerHeight * 3.6)); openState.touchY = nextY; };
    openState.onKeydown = (event) => keyTravel(openState, event);
    openState.onDocumentKeydown = (event) => { if (event.key === "Escape") { event.preventDefault(); close(); } else if (!event.defaultPrevented && !(event.target instanceof HTMLButtonElement || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement)) keyTravel(openState, event); };
    openState.onClose = close;
    openState.observer = "IntersectionObserver" in window ? new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) preload(); }, { root: ui.container, threshold: .01 }) : undefined;
    openState.observer?.observe(ui.center); ui.container.addEventListener("wheel", openState.onWheel, { passive: false }); ui.container.addEventListener("touchstart", openState.onTouchStart, { passive: true }); ui.container.addEventListener("touchmove", openState.onTouchMove, { passive: false }); ui.container.addEventListener("keydown", openState.onKeydown); document.addEventListener("keydown", openState.onDocumentKeydown); ui.close.addEventListener("click", openState.onClose);
    requestAnimationFrame(() => { render(openState); ui.container.focus({ preventScroll: true }); });
  }
  return { open, close };
})();
