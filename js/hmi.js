/* --------------------------------------------------------------------------
   HMI boot sequence
   This file owns the loading state and HMI-specific status presentation.
   -------------------------------------------------------------------------- */
window.HmiBoot = (() => {
  const bootSteps = [
    "checking interface protocol…",
    "loading visual control surface…",
    "calibrating interaction layer…",
    "establishing portfolio channel…",
    "system ready."
  ];

  let elements = null;
  let progressValue = 0;
  let progressIntervalId = null;
  let finishTimeoutId = null;

  function cacheElements() {
    elements = {
      screen: document.getElementById("bootScreen"),
      progress: document.getElementById("bootProgress"),
      status: document.getElementById("bootStatus"),
      percent: document.getElementById("bootPercent"),
      log: document.getElementById("bootLog"),
      app: document.getElementById("portfolioApp")
    };
  }

  function updateDisplay() {
    const stepIndex = Math.min(bootSteps.length - 1, Math.floor(progressValue / 21));

    elements.progress.style.width = `${progressValue}%`;
    elements.percent.textContent = `${String(progressValue).padStart(2, "0")}%`;
    elements.log.textContent = `> ${bootSteps[stepIndex]}`;
  }

  function completeSequence() {
    window.clearInterval(progressIntervalId);
    elements.status.textContent = "INTERFACE READY";

    finishTimeoutId = window.setTimeout(() => {
      elements.screen.classList.add("is-complete");
      elements.app.classList.add("is-ready");
      elements.app.setAttribute("aria-hidden", "false");
    }, 360);
  }

  function start() {
    window.clearInterval(progressIntervalId);
    window.clearTimeout(finishTimeoutId);

    progressValue = 0;
    elements.progress.style.width = "0%";
    elements.percent.textContent = "00%";
    elements.status.textContent = "INITIALIZING INTERFACE";
    elements.log.textContent = `> ${bootSteps[0]}`;
    elements.screen.classList.remove("is-complete");
    elements.app.classList.remove("is-ready");
    elements.app.setAttribute("aria-hidden", "true");

    progressIntervalId = window.setInterval(() => {
      progressValue = Math.min(100, progressValue + 5);
      updateDisplay();

      if (progressValue === 100) {
        completeSequence();
      }
    }, 80);
  }

  function initialize() {
    cacheElements();
    start();
  }

  return { initialize, start };
})();
