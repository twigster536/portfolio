/* Application entry point: shared startup and live time display. */
function updateClock() { document.getElementById("clock").textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }); }
function initializePortfolio() { window.PortfolioNavigation.initialize(); window.HmiBoot.initialize(); updateClock(); window.setInterval(updateClock, 1000); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initializePortfolio, { once: true }); else initializePortfolio();
