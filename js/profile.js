/* Profile System: dedicated engineer overview screen and interactive domains. */
window.ProfileSystem = (() => {
  const modules = [
    { code: "PLC", label: "PLC Automation", domain: "Industrial Control", status: "Engineering Knowledge", glyph: "▦" },
    { code: "HMI", label: "HMI / SCADA", domain: "System Visualization", status: "Engineering Knowledge", glyph: "▤" },
    { code: "ELC", label: "Electrical Control", domain: "Electrical Systems", status: "Engineering Knowledge", glyph: "ϟ" },
    { code: "DRV", label: "Motors & Drives", domain: "Motion Control", status: "Engineering Knowledge", glyph: "◌" },
    { code: "HVAC", label: "HVAC Systems", domain: "Building Systems", status: "Development Focus", glyph: "≋" },
    { code: "BAS", label: "Building Automation", domain: "Smart Buildings", status: "Development Focus", glyph: "⌂" },
    { code: "ENG", label: "Solar / Energy Systems", domain: "Energy Technology", status: "Engineering Knowledge", glyph: "◐" },
    { code: "AI", label: "AI HVAC / Predictive Systems", domain: "Predictive Automation", status: "Development Path Active", glyph: "◉" }
  ];

  function create(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text !== undefined) element.textContent = text;
    return element;
  }

  function panel(eyebrow, title, className) {
    const section = create("section", "profile-system-panel " + (className || ""));
    section.append(create("p", "profile-panel-eyebrow", eyebrow), create("h3", "", title));
    return section;
  }

  function statRow(label, value) {
    const row = create("div", "profile-detail-row");
    row.append(create("span", "", label), create("strong", "", value));
    return row;
  }

  function actionButton(label, target, onNavigate) {
    const button = create("button", "profile-action-button", label);
    button.type = "button";
    button.addEventListener("click", () => onNavigate(target));
    return button;
  }

  function build(onNavigate) {
    const screen = create("section", "profile-system-screen");
    screen.setAttribute("aria-labelledby", "modalTitle");
    const layout = create("div", "profile-system-layout");

    const identity = panel("ENGINEER PROFILE  /  ID // DU-001", "Dishnu Unnikrishnan", "profile-identity-panel");
    identity.querySelector("h3").id = "modalTitle";
    identity.append(create("p", "profile-professional-title", "Automation & Control Engineer"), create("p", "profile-professional-title profile-professional-subtitle", "HVAC Developer"), create("p", "profile-location", "Kitchener // Ontario // Canada"));

    const hud = create("section", "profile-hud-panel");
    hud.setAttribute("aria-label", "Engineer portrait and system status");
    const hudRings = create("div", "profile-portrait-hud");
    const ringOne = create("span", "profile-hud-ring profile-hud-ring-one");
    const ringTwo = create("span", "profile-hud-ring profile-hud-ring-two");
    const ringThree = create("span", "profile-hud-ring profile-hud-ring-three");
    const markers = create("span", "profile-hud-markers");
    const portrait = document.createElement("img");
    portrait.src = "assets/images/dishnu-profile.png";
    portrait.alt = "Dishnu Unnikrishnan in a black suit";
    portrait.width = 1080;
    portrait.height = 1440;
    hudRings.append(ringOne, ringTwo, ringThree, markers, portrait);
    const status = create("p", "profile-hud-status");
    status.append(create("span", "online-dot"), create("span", "", "SYSTEM STATUS"), create("strong", "", "ACTIVE"));
    hud.append(create("p", "profile-hud-coordinate", "PROFILE_SYS_01  /  SCAN LOCK"), hudRings, status);

    const overview = panel("CONTROL_LAYER  /  SYSTEM OVERVIEW", "System Overview", "profile-overview-panel");
    overview.append(create("p", "", "Electrical and automation professional focused on industrial control, intelligent HVAC, and next-generation building technologies. My goal is to combine automation, control systems, HVAC knowledge, and AI to develop smarter systems that improve efficiency, reliability, and predictive maintenance."));

    const mission = panel("MISSION_CORE  /  AI-DRIVEN HVAC", "Mission // AI-Driven HVAC", "profile-mission-panel");
    mission.append(create("p", "", "Develop intelligent HVAC systems that combine automation, real-time system data and AI-based predictive technology to improve energy efficiency, detect problems earlier and enable smarter building operation."));
    const missionStatus = create("p", "profile-mission-status");
    missionStatus.append(create("span", "online-dot"), create("span", "", "STATUS: DEVELOPMENT PATH ACTIVE"));
    mission.append(missionStatus);

    const modulePanel = panel("SYSTEM_DOMAINS  /  SELECT NODE", "Engineering System Modules", "profile-modules-panel");
    const moduleGrid = create("div", "profile-module-grid");
    const details = panel("DATA_LINK  /  SYSTEM DETAILS", "System Details", "profile-details-panel");
    const selectedName = create("strong", "profile-selected-name", "");
    const selectedDomain = create("strong", "profile-selected-domain", "");
    const selectedStatus = create("strong", "profile-selected-status", "");
    details.append(statRow("SELECTED SYSTEM", ""), statRow("DOMAIN", ""), statRow("STATUS", ""));
    const detailRows = details.querySelectorAll(".profile-detail-row strong");
    detailRows[0].replaceWith(selectedName);
    detailRows[1].replaceWith(selectedDomain);
    detailRows[2].replaceWith(selectedStatus);

    function setSelected(selected, button) {
      moduleGrid.querySelectorAll("button").forEach((entry) => {
        const active = entry === button;
        entry.classList.toggle("is-active", active);
        entry.setAttribute("aria-pressed", String(active));
      });
      selectedName.textContent = selected.label;
      selectedDomain.textContent = selected.domain;
      selectedStatus.textContent = selected.status;
    }

    modules.forEach((module, index) => {
      const button = create("button", "profile-system-module");
      button.type = "button";
      button.setAttribute("aria-pressed", "false");
      button.setAttribute("aria-label", module.label + ". Select system details.");
      const icon = create("span", "profile-module-icon", module.glyph);
      icon.setAttribute("aria-hidden", "true");
      const code = create("span", "profile-module-code", module.code);
      const name = create("span", "profile-module-name", module.label);
      const dot = create("span", "profile-module-status");
      dot.setAttribute("aria-hidden", "true");
      button.append(icon, code, name, dot);
      button.addEventListener("click", () => setSelected(module, button));
      button.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setSelected(module, button);
        }
      });
      moduleGrid.append(button);
      if (index === 0) setSelected(module, button);
    });
    modulePanel.append(moduleGrid);

    const foundation = panel("FOUNDATION_NODE  /  TECHNICAL BACKGROUND", "Technical Foundation", "profile-foundation-panel");
    const foundationList = create("ul", "profile-foundation-list");
    ["Electrical & Electronics Engineering", "Applied Electrical Motion & Control", "Industrial Automation", "Electrical Troubleshooting", "Solar PV Systems", "System Monitoring"].forEach((item) => foundationList.append(create("li", "", item)));
    foundation.append(foundationList);

    const connection = panel("IDENTITY_NODE  /  CONNECTION", "Contact / Connection", "profile-connection-panel");
    const contactList = create("div", "profile-contact-list");
    const email = document.createElement("a");
    email.href = "mailto:dishnuunnikrishnan@gmail.com";
    email.textContent = "dishnuunnikrishnan@gmail.com";
    const linkedIn = document.createElement("a");
    linkedIn.href = "https://www.linkedin.com/in/dishnu-unnikrishnan-133b991b6/";
    linkedIn.target = "_blank";
    linkedIn.rel = "noopener";
    linkedIn.textContent = "linkedin.com/in/dishnu-unnikrishnan-133b991b6/";
    const emailRow = create("div", "profile-contact-row");
    emailRow.append(create("span", "", "EMAIL"), email);
    const linkedInRow = create("div", "profile-contact-row");
    linkedInRow.append(create("span", "", "LINKEDIN"), linkedIn);
    const locationRow = create("div", "profile-contact-row");
    locationRow.append(create("span", "", "LOCATION"), create("strong", "", "Kitchener, Ontario, Canada"));
    contactList.append(emailRow, linkedInRow, locationRow);
    connection.append(contactList);

    const actions = create("nav", "profile-action-panel");
    actions.setAttribute("aria-label", "Profile navigation");
    actions.append(actionButton("View Projects", "projects", onNavigate), actionButton("Resume", "resume", onNavigate), actionButton("Contact", "contact", onNavigate));

    layout.append(identity, hud, overview, mission, modulePanel, details, foundation, connection, actions);
    screen.append(layout);
    return screen;
  }

  function open(onNavigate) {
    const modal = document.getElementById("detailsModal");
    const windowElement = document.getElementById("detailsWindow");
    const content = document.getElementById("modalContent");
    const label = document.getElementById("modalLabel");
    const close = document.getElementById("modalClose");
    const panelBar = windowElement.querySelector(".panel-bar");
    if (!panelBar.contains(close)) panelBar.append(close);
    windowElement.classList.remove("is-resume-viewer", "is-memory-wall", "is-dark-view", "is-light-view");
    windowElement.classList.add("is-profile-screen");
    content.replaceChildren(build(onNavigate));
    label.textContent = "ENGINEER PROFILE";
    close.setAttribute("aria-label", "Close engineer profile");
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    close.focus();
  }

  return { open };
})();
