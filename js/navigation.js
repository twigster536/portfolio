/* --------------------------------------------------------------------------
   Application launcher and modal navigation
   This file manages application tiles, modal content, keyboard use, and focus.
   -------------------------------------------------------------------------- */
window.PortfolioNavigation = (() => {
  const portfolioModules = Object.freeze({
    resume: {
      identifier: "APP_01 / RESUME",
      title: "Resume",
      accent: "module.",
      description: "Your professional timeline, education, skills, and notable achievements will be added here when the portfolio content is ready."
    },
    games: {
      identifier: "APP_02 / GAMES",
      title: "Games",
      accent: "module.",
      description: "A small collection of playful experiments, interactive ideas, and game prototypes will live here."
    },
    projects: {
      identifier: "APP_03 / PROJECTS",
      title: "Projects",
      accent: "module.",
      description: "Your work will be displayed as project files. The AI-based Predictive HVAC System can become the first featured case study."
    },
    contact: {
      identifier: "APP_04 / CONTACT",
      title: "Contact",
      accent: "module.",
      description: "This channel will hold your email, professional links, and a simple way for visitors to start a conversation."
    },
    bio: {
      identifier: "APP_05 / BIOGRAPHY",
      title: "Biography",
      accent: "module.",
      description: "This section will introduce your point of view, background, and the ideas that guide your work."
    }
  });

  let elements = null;
  let lastFocusedElement = null;

  function cacheElements() {
    elements = {
      modal: document.getElementById("moduleModal"),
      modalIdentifier: document.getElementById("modalIdentifier"),
      modalTitlePrimary: document.getElementById("modalTitlePrimary"),
      modalTitleAccent: document.getElementById("modalTitleAccent"),
      modalDescription: document.getElementById("modalDescription"),
      modalClose: document.getElementById("modalClose"),
      moduleButtons: document.querySelectorAll("[data-module]")
    };
  }

  function openModule(moduleKey) {
    const module = portfolioModules[moduleKey];

    if (!module) {
      return;
    }

    lastFocusedElement = document.activeElement;
    elements.modalIdentifier.textContent = module.identifier;
    elements.modalTitlePrimary.textContent = module.title;
    elements.modalTitleAccent.textContent = module.accent;
    elements.modalDescription.textContent = module.description;
    elements.modal.classList.add("is-open");
    elements.modal.setAttribute("aria-hidden", "false");
    elements.modalClose.focus();
  }

  function closeModule() {
    elements.modal.classList.remove("is-open");
    elements.modal.setAttribute("aria-hidden", "true");

    if (lastFocusedElement instanceof HTMLElement) {
      lastFocusedElement.focus();
    }
  }

  function keepFocusInsideModal(event) {
    if (event.key !== "Tab" || !elements.modal.classList.contains("is-open")) {
      return;
    }

    const focusableElements = elements.modal.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    const firstFocusable = focusableElements[0];
    const lastFocusable = focusableElements[focusableElements.length - 1];

    if (!firstFocusable || !lastFocusable) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstFocusable) {
      event.preventDefault();
      lastFocusable.focus();
    } else if (!event.shiftKey && document.activeElement === lastFocusable) {
      event.preventDefault();
      firstFocusable.focus();
    }
  }

  function handleKeyboard(event) {
    if (event.key === "Escape" && elements.modal.classList.contains("is-open")) {
      closeModule();
      return;
    }

    keepFocusInsideModal(event);
  }

  function initialize() {
    cacheElements();

    elements.moduleButtons.forEach((button) => {
      button.addEventListener("click", () => openModule(button.dataset.module));
    });

    elements.modalClose.addEventListener("click", closeModule);

    elements.modal.addEventListener("click", (event) => {
      if (event.target === elements.modal) {
        closeModule();
      }
    });

    document.addEventListener("keydown", handleKeyboard);
  }

  return { initialize };
})();
