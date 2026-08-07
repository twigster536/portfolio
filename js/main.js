/* --------------------------------------------------------------------------
   Application startup
   This file coordinates page-level initialization and shared interface data.
   -------------------------------------------------------------------------- */
function updateClock() {
  const clock = document.getElementById("clock");

  clock.textContent = new Date().toLocaleTimeString("en-GB", {
    hour12: false,
    timeZone: "UTC"
  });
}

function initializePortfolio() {
  window.HmiBoot.initialize();
  window.PortfolioNavigation.initialize();

  document.getElementById("restartButton").addEventListener("click", window.HmiBoot.start);

  updateClock();
  window.setInterval(updateClock, 1000);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initializePortfolio, { once: true });
} else {
  initializePortfolio();
}
