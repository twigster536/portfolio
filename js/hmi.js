/* Automation Control: boot and power-state behavior. */
window.HmiBoot = (() => {
  const bootSteps = [
    "checking interface protocol…",
    "loading control surface…",
    "calibrating navigation layer…",
    "establishing local session…",
    "system ready."
  ];

  let elements;
  let progress = 0;
  let progressTimer;
  let finishTimer;

  function cacheElements() {
    elements = {
      screen: document.getElementById("bootScreen"),
      progress: document.getElementById("bootProgress"),
      status: document.getElementById("bootStatus"),
      percent: document.getElementById("bootPercent"),
      log: document.getElementById("bootLog"),
      app: document.getElementById("portfolioApp"),
      powerScreen: document.getElementById("powerScreen"),
      powerRestart: document.getElementById("powerRestartButton")
    };
  }

  function updateBootDisplay() {
    const step = bootSteps[Math.min(bootSteps.length - 1, Math.floor(progress / 21))];
    elements.progress.style.width = `${progress}%`;
    elements.percent.textContent = `${String(progress).padStart(2, "0")}%`;
    elements.log.textContent = `> ${step}`;
  }

  function completeBoot() {
    window.clearInterval(progressTimer);
    elements.status.textContent = "AUTOMATION CONTROL READY";
    finishTimer = window.setTimeout(() => {
      elements.screen.classList.add("is-complete");
      elements.app.classList.add("is-ready");
      elements.app.setAttribute("aria-hidden", "false");
    }, 300);
  }

  function start() {
    window.clearInterval(progressTimer);
    window.clearTimeout(finishTimer);
    progress = 0;
    elements.powerScreen.classList.remove("is-open");
    elements.powerScreen.setAttribute("aria-hidden", "true");
    elements.screen.classList.remove("is-complete");
    elements.app.classList.remove("is-ready");
    elements.app.setAttribute("aria-hidden", "true");
    elements.status.textContent = "INITIALIZING INTERFACE";
    updateBootDisplay();

    progressTimer = window.setInterval(() => {
      progress = Math.min(100, progress + 5);
      updateBootDisplay();
      if (progress === 100) completeBoot();
    }, 72);
  }

  function powerDown() {
    window.clearInterval(progressTimer);
    window.clearTimeout(finishTimer);
    elements.app.classList.remove("is-ready");
    elements.app.setAttribute("aria-hidden", "true");
    elements.powerScreen.classList.add("is-open");
    elements.powerScreen.setAttribute("aria-hidden", "false");
    elements.powerRestart.focus();
  }

  function initialize() {
    cacheElements();
    elements.powerRestart.addEventListener("click", start);
    start();
  }

  return { initialize, start, powerDown };
})();
