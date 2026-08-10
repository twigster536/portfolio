/* Automation Control: portfolio data, launcher navigation, panel rendering, and dialogs. */
window.PortfolioNavigation = (() => {
  const sectionOrder = ["profile", "projects", "plc", "games", "motion", "memory", "certificates", "resume", "contact"];
  const sections = {
    profile: { label: "Profile", code: "01", description: "Entry-level Electrical & Automation Technician with hands-on experience in PLC logic, motor control, solar PV systems, and preventive maintenance.", facts: [["ROLE", "Electrical & Automation Technician"], ["FOCUS", "PLC, motor control, and maintenance"], ["LOCATION", "Kitchener, ON"]] },
    projects: { label: "Projects", code: "02", description: "Available project records are listed below." },
    plc: { label: "PLC", code: "03", description: "Verified PLC experience from the supplied resume is presented here; detailed project case studies can be added as they are ready.", facts: [["LOGIC", "Ladder Logic"], ["EXPOSURE", "Allen-Bradley"], ["SYSTEMS", "Motor control"]] },
    games: { label: "Games", code: "04", description: "The Games module is ready for interactive engineering and automation-themed games. New experiences will be added here soon.", facts: [["STATUS", "Game bay initializing"], ["CONTROLS", "Interactive modules planned"], ["AVAILABILITY", "Coming soon"]] },
    motion: { label: "Motion", code: "05", description: "Motion and electrical-control knowledge is supported by Applied Electrical Motion and Control Management study and VFD basics.", facts: [["STUDY", "Electrical motion and control"], ["EQUIPMENT", "VFD basics"], ["STATUS", "Portfolio details pending"]] },
    memory: { label: "Memory Wall", code: "06", description: "A shared space where visitors can leave a review, rating, or note about their portfolio visit." },
    certificates: { label: "Certificates", code: "07", description: "No certificate records were supplied with the current resume. This module is ready for verified credentials when available.", facts: [["STATUS", "Records pending"], ["DISPLAY", "Verified credentials only"], ["READY", "Add certificates"]] },
    resume: { label: "Resume", code: "08", description: "Entry-level Electrical & Automation Technician with hands-on experience in PLC logic, motor control, solar PV systems, and preventive maintenance." },
    contact: { label: "Contact", code: "09", description: "Professional contact details from the supplied resume.", facts: [["EMAIL", "dishnuunnikrishnan@gmail.com"], ["PHONE", "+1 548 922 4198"], ["LINKEDIN", "dishnu-unnikrishnan"]] }
  };
  const project = { title: "AI-Based Predictive HVAC System", description: "College project portfolio for an AI-based predictive HVAC system.", technologies: "AI / IOT / HVAC", image: "assets/images/hvac-plant-thumbnail.png", objective: "Predict HVAC demand before comfort conditions drift.", system: "Sensor inputs, predictive model, and adaptive HVAC control.", status: "Project record in development." };
  let elements;
  const sectionAngles = Object.freeze({ profile: 0, projects: 40, plc: 80, games: 120, motion: 160, memory: 200, contact: 240, resume: 280, certificates: 320 });
  let activeKey = "projects";
  let recent = [];
  let lastFocused;
  let selectionAnimationTimer;

  function cacheElements() {
    elements = {
      apps: [...document.querySelectorAll("[data-section]")], stage: document.getElementById("radialStage"), activeName: document.getElementById("activeModuleName"), openSelected: document.getElementById("openSelectedButton"), content: document.getElementById("contentPanel"), contentEyebrow: document.getElementById("contentEyebrow"), contentCode: document.getElementById("contentCode"), pagination: document.getElementById("paginationLabel"), previous: document.getElementById("previousButton"), next: document.getElementById("nextButton"), navButtons: [...document.querySelectorAll("[data-action]")], detailModal: document.getElementById("detailsModal"), detailsWindow: document.getElementById("detailsWindow"), modalLabel: document.getElementById("modalLabel"), modalContent: document.getElementById("modalContent"), modalClose: document.getElementById("modalClose"), searchModal: document.getElementById("searchModal"), searchClose: document.getElementById("searchClose"), searchInput: document.getElementById("searchInput"), searchResults: document.getElementById("searchResults")
    };
  }

  function create(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text) node.textContent = text; return node; }
  function createProjectArt(projectData) { const art = create("div", "project-art"); const image = document.createElement("img"); image.src = projectData.image; image.alt = "Industrial HVAC automation equipment"; image.width = 1024; image.height = 1024; image.loading = "eager"; art.append(image); return art; }

  function renderHeader(key) { const systemSections = { recent: { label: "Recent", code: "REC" }, diagnostics: { label: "Diagnostics", code: "SYS" } }; const section = sections[key] || systemSections[key]; elements.contentEyebrow.textContent = section.label.toUpperCase(); elements.contentCode.textContent = section.code; elements.pagination.textContent = key in sections ? `${String(sectionOrder.indexOf(key) + 1).padStart(2, "0")} / 09` : "SYS"; }
  function renderResume() { const kicker = create("p", "content-kicker", "RESUME / VERIFIED DOCX"); const title = create("h2", "", "Resume"); title.id = "contentTitle"; const description = create("p", "content-description", sections.resume.description); const documentCard = create("section", "resume-document"); const name = create("b", "", "dishnu_college_res.docx"); const detail = create("small", "", "Includes skills, work experience, and education from the supplied Word résumé."); const skills = create("div", "resume-skills"); ["PLC LADDER LOGIC", "HMI DESIGN", "MOTOR CONTROL", "ELECTRICAL TROUBLESHOOTING"].forEach((skill) => skills.append(create("span", "", skill))); const actions = create("div", "resume-actions"); const download = create("a", "", "DOWNLOAD .DOCX"); download.href = "assets/documents/dishnu-college-resume.docx"; download.download = "dishnu_college_res.docx"; const open = create("a", "", "OPEN DOCUMENT"); open.href = "assets/documents/dishnu-college-resume.docx"; open.target = "_blank"; open.rel = "noopener"; actions.append(download, open); documentCard.append(name, detail, skills, actions); elements.content.replaceChildren(kicker, title, description, documentCard); }
  function renderPlaceholder(key) { const section = sections[key]; const brief = create("section", "module-brief"); const kicker = create("p", "content-kicker", `ENGINEERING MODULE / ${section.code}`); const title = create("h2", "", section.label); title.id = "contentTitle"; const description = create("p", "content-description", section.description); const readout = create("dl", "module-readout"); (section.facts || [["STATUS", "Verified portfolio details pending"], ["MODULE", section.label], ["READY", "Content intake available"]]).forEach(([label, value]) => { const row = document.createElement("div"); row.append(create("dt", "", label), create("dd", "", value)); readout.append(row); }); const signal = create("p", "module-signal", "SYSTEM READY / VERIFIED CONTENT ONLY"); brief.append(kicker, title, description, readout, signal); elements.content.replaceChildren(brief); }
  function renderProjects() { const title = create("h2", "", "Projects"); title.id = "contentTitle"; const list = create("div", "project-list"); const card = create("article", "project-card"); const copy = create("div", "project-copy"); const heading = create("h3", "", project.title); const description = create("p", "", project.description); const tech = create("div", "tech-list", project.technologies); const open = create("button", "project-open", "OPEN PROJECT"); open.type = "button"; open.addEventListener("click", openProjectDetail); copy.append(heading, description, tech); card.append(createProjectArt(project), copy, open); list.append(card); const telemetry = create("dl", "project-telemetry"); [["OBJECTIVE", project.objective], ["SYSTEM", project.system], ["STATUS", project.status]].forEach(([label, value]) => { const row = document.createElement("div"); row.append(create("dt", "", label), create("dd", "", value)); telemetry.append(row); }); const note = create("div", "empty-state", "01 VERIFIED PROJECT RECORD - additional cards appear when portfolio material is added."); elements.content.replaceChildren(title, list, telemetry, note); }
  function renderMemoryWall() { const brief = create("section", "memory-module-brief"); const kicker = create("p", "content-kicker", "VISITOR MEMORIES / SHARED WALL"); const title = create("h2", "", "Memory Wall"); title.id = "contentTitle"; const description = create("p", "content-description", sections.memory.description); const signal = create("div", "memory-module-signal"); signal.append(create("span", "", "✦"), create("p", "", "Reviews and ratings are stored as visitor memories.")); const open = create("button", "memory-module-open", "OPEN MEMORY WALL"); open.type = "button"; open.addEventListener("click", () => { lastFocused = open; window.MemoryWall?.open(); }); brief.append(kicker, title, description, signal, open); elements.content.replaceChildren(brief); }
  function renderRecent() { const kicker = create("p", "content-kicker", "SYSTEM NAVIGATION / RECENT"); const title = create("h2", "", "Recent"); title.id = "contentTitle"; const list = create("div", "search-results"); const records = recent.length ? recent : ["profile"]; records.forEach((key) => { const button = create("button", "search-result", sections[key].label); button.type = "button"; button.addEventListener("click", () => selectSection(key)); list.append(button); }); elements.content.replaceChildren(kicker, title, list); }
  function renderDiagnostics() { const kicker = create("p", "content-kicker", "SYSTEM NAVIGATION / DIAGNOSTICS"); const title = create("h2", "", "Diagnostics"); title.id = "contentTitle"; const note = create("div", "empty-state", "INTERFACE: ONLINE\nMODULES: 09 AVAILABLE\nCAREER DATA: PLACEHOLDERS REMAIN\n3D ENVIRONMENT: NOT ENABLED"); note.style.whiteSpace = "pre-line"; elements.content.replaceChildren(kicker, title, note); }
  function renderContent(key) { renderHeader(key); if (key === "projects") renderProjects(); else if (key === "resume") renderResume(); else if (key === "memory") renderMemoryWall(); else if (key === "recent") renderRecent(); else if (key === "diagnostics") renderDiagnostics(); else renderPlaceholder(key); }

  function remember(key) { recent = [key, ...recent.filter((entry) => entry !== key)].slice(0, 5); }
  function setHash(key, replace) { const hash = key === "profile" ? "#home" : `#${key}`; history[replace ? "replaceState" : "pushState"]({ section: key }, "", hash); }
  function playSelectionAnimation(shouldAnimate) { if (!shouldAnimate) return; window.clearTimeout(selectionAnimationTimer); elements.stage.classList.remove("is-launching"); window.setTimeout(() => elements.stage.classList.add("is-launching"), 460); selectionAnimationTimer = window.setTimeout(() => elements.stage.classList.remove("is-launching"), 1280); }
  function selectSection(key, options = {}) { if (!sections[key]) return; activeKey = key; if (options.record !== false) remember(key); elements.apps.forEach((button) => { const selected = button.dataset.section === key; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); button.style.setProperty("--display-angle", `${sectionAngles[button.dataset.section]}deg`); }); elements.activeName.textContent = sections[key].label.toUpperCase(); renderContent(key); playSelectionAnimation(options.animate !== false); if (options.writeHistory !== false) setHash(key, options.replace === true); }
  function showDetailsModal(label) { const panelBar = elements.detailsWindow.querySelector(".panel-bar"); if (!panelBar.contains(elements.modalClose)) panelBar.append(elements.modalClose); elements.detailsWindow.classList.remove("is-resume-viewer", "is-memory-wall", "is-profile-screen", "is-dark-view", "is-light-view"); elements.modalClose.setAttribute("aria-label", "Close dialog"); elements.modalLabel.textContent = label; elements.detailModal.classList.add("is-open"); elements.detailModal.setAttribute("aria-hidden", "false"); elements.modalClose.focus(); }
  function openProjectDetail() { lastFocused = document.activeElement; const title = create("h2", "", project.title); title.id = "modalTitle"; const description = create("p", "", project.description); const grid = create("div", "detail-list"); [["OBJECTIVE", project.objective], ["SYSTEM", project.system], ["STATUS", project.status]].forEach(([label, value]) => { const item = create("div", ""); item.append(create("span", "", label), create("b", "", value)); grid.append(item); }); elements.modalContent.replaceChildren(title, description, grid); showDetailsModal("PROJECT RECORD"); }
  function createResumeEntry(titleText, dateText, items) { const entry = create("section", "resume-entry"); entry.append(create("h3", "", titleText), create("p", "", dateText)); const list = create("ul", ""); items.forEach((item) => list.append(create("li", "", item))); entry.append(list); return entry; }
  function createResumeDocumentPage() {
    const page = create("article", "resume-page");
    page.setAttribute("aria-label", "Read-only résumé document");
    page.setAttribute("aria-readonly", "true");
    const title = create("h1", "", "Dishnu Unnikrishnan");
    title.id = "modalTitle";
    const contact = create("p", "resume-contact", "Kitchener, ON | dishnuunnikrishnan@gmail.com | +1 548 922 4198 | linkedin.com/in/dishnu-unnikrishnan");
    const intro = create("p", "resume-intro", "Entry-level Electrical & Automation Technician with hands-on experience in PLC logic, motor control, solar PV systems, and preventive maintenance. Strong background in electrical troubleshooting, control panels, and industrial safety. Seeking a junior automation or maintenance role with growth toward controls and building automation systems.");
    const skillsHeading = create("h2", "", "Skills and Certificates");
    const skills = create("ul", "");
    ["PLC Programming: Ladder Logic (Allen-Bradley exposure)", "Electrical Troubleshooting and Motor Control", "Control Panels, Relays, Contactors, and VFD basics", "HMI Design and Testing", "Preventive and Corrective Maintenance", "CMMS maintenance records"].forEach((item) => skills.append(create("li", "", item)));
    const experienceHeading = create("h2", "", "Experience");
    const educationHeading = create("h2", "", "Education");
    const education = create("ul", "");
    ["Post Graduate Diploma in Applied Electrical Motion and Control Management — Conestoga College, Kitchener Doon (May 2024 – August 2025)", "B.Tech in Electrical and Electronics Engineering — University College of Engineering", "Diploma in Electrical and Electronics Engineering — Indira Gandhi Polytechnic College"].forEach((item) => education.append(create("li", "", item)));
    const downloadBar = create("div", "resume-download-bar");
    const downloadText = create("span", "", "Original résumé document");
    const download = create("a", "", "Download .docx");
    download.href = "assets/documents/dishnu-college-resume.docx";
    download.download = "dishnu_college_res.docx";
    downloadBar.append(downloadText, download);
    page.append(title, contact, intro, skillsHeading, skills, experienceHeading, createResumeEntry("Team Member — Longo’s | Kitchener", "August 2024 – Present", ["Follow food safety, health, workplace safety, and standard operating procedures.", "Deliver customer service while maintaining a clean and presentable work area."]), createResumeEntry("Service Engineer — Illumine Energy Solutions | Kerala, India", "March 2023 – March 2024", ["Supported installation and servicing of solar PV systems while following electrical safety procedures.", "Used CMMS software to plan, track, and document preventive and corrective maintenance.", "Communicated system performance, maintenance actions, and troubleshooting outcomes to clients."]), createResumeEntry("Site Supervisor — Repair Kochi Renovations | Kerala, India", "January 2022 – March 2023", ["Supervised on-site work for quality standards, material control, and timely task completion.", "Reported completed work to engineers and coordinated material requirements."]), educationHeading, education, downloadBar);
    return page;
  }

  function openResumeViewer() {
    lastFocused = document.activeElement;
    const viewer = create("section", "word-viewer");
    const titlebar = create("header", "viewer-titlebar");
    const documentMark = create("span", "viewer-document-mark", "DOC");
    documentMark.setAttribute("aria-hidden", "true");
    const filename = create("span", "viewer-filename", "dishnu_college_res.docx");
    const syncStatus = create("span", "viewer-sync", "Saved to this PC");
    const readOnly = create("span", "viewer-readonly", "Read only");
    const titleDetails = create("div", "viewer-title-details");
    titleDetails.append(documentMark, filename, syncStatus, readOnly);
    const titleSearch = create("div", "viewer-title-search", "Search");
    titleSearch.setAttribute("aria-hidden", "true");
    const actions = create("div", "viewer-actions");
    const themeToggle = create("button", "viewer-theme-toggle", "");
    themeToggle.type = "button";
    themeToggle.setAttribute("aria-label", "Switch document viewer theme");
    const download = create("a", "viewer-download", "Download .docx");
    download.href = "assets/documents/dishnu-college-resume.docx";
    download.download = "dishnu_college_res.docx";
    actions.append(themeToggle, download, elements.modalClose);
    titlebar.append(titleDetails, titleSearch, actions);

    const tabs = create("nav", "viewer-tabs");
    tabs.setAttribute("aria-label", "Document viewer ribbon");
    ["File", "Home", "Insert", "Design", "Layout", "References", "Mailings", "Review", "View", "Help"].forEach((tab, index) => {
      const label = create("span", index === 1 ? "is-current" : "", tab);
      label.setAttribute("aria-hidden", "true");
      tabs.append(label);
    });

    const ribbon = create("div", "viewer-ribbon");
    ribbon.setAttribute("aria-hidden", "true");
    const addRibbonGroup = (name, label) => {
      const group = create("section", `viewer-ribbon-group ${name}`);
      const controls = create("div", "ribbon-group-controls");
      group.append(controls, create("small", "", label));
      ribbon.append(group);
      return controls;
    };
    const clipboard = addRibbonGroup("ribbon-clipboard", "Clipboard");
    const paste = create("div", "ribbon-paste-control");
    paste.append(create("span", "ribbon-paste-icon", ""), create("span", "ribbon-paste-label", "Paste"));
    const clipboardTools = create("div", "ribbon-mini-stack");
    ["✂", "⧉", "⌁"].forEach((symbol) => clipboardTools.append(create("span", "", symbol)));
    clipboard.append(paste, clipboardTools);

    const font = addRibbonGroup("ribbon-font", "Font");
    const fontSelects = create("div", "ribbon-font-selects");
    fontSelects.append(create("span", "ribbon-select", "Cambria"), create("span", "ribbon-size", "11"));
    const fontTools = create("div", "ribbon-font-tools");
    [["B", "is-bold"], ["I", "is-italic"], ["U", "is-underline"], ["ab", "is-strike"], ["x₂", ""], ["x²", ""], ["A", "is-highlight"], ["A", "is-font-colour"]].forEach(([symbol, className]) => fontTools.append(create("span", `ribbon-action ${className}`, symbol)));
    font.append(fontSelects, fontTools);

    const paragraph = addRibbonGroup("ribbon-paragraph", "Paragraph");
    const paragraphTools = create("div", "ribbon-paragraph-tools");
    ["≡", "≣", "☰", "≡", "⇤", "⇥", "↕", "¶"].forEach((symbol) => paragraphTools.append(create("span", "ribbon-action", symbol)));
    paragraph.append(paragraphTools);

    const styles = addRibbonGroup("ribbon-styles", "Styles");
    [["Normal", "ribbon-style-normal"], ["No Spacing", "ribbon-style-compact"], ["Heading 1", "ribbon-style-heading"]].forEach(([label, className]) => styles.append(create("span", `ribbon-style-tile ${className}`, label)));

    const review = addRibbonGroup("ribbon-reading", "Document status");
    review.append(create("span", "ribbon-reading-icon", "◉"), create("span", "ribbon-reading-copy", "VIEW\nONLY"));

    const ruler = create("div", "viewer-ruler");
    ruler.setAttribute("aria-hidden", "true");
    for (let mark = 1; mark <= 7; mark += 1) ruler.append(create("span", "", String(mark)));

    const workspace = create("div", "viewer-workspace");
    workspace.tabIndex = 0;
    workspace.setAttribute("aria-label", "Scrollable résumé document preview");
    workspace.append(createResumeDocumentPage());
    const status = create("footer", "viewer-statusbar");
    status.append(create("span", "", "READ ONLY · Document preview"), create("span", "", "1 page"));
    viewer.append(titlebar, tabs, ribbon, ruler, workspace, status);
    elements.modalContent.replaceChildren(viewer);
    const isDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const applyTheme = (dark) => {
      elements.detailsWindow.classList.toggle("is-dark-view", dark);
      elements.detailsWindow.classList.toggle("is-light-view", !dark);
      themeToggle.textContent = dark ? "Light view" : "Dark view";
      themeToggle.setAttribute("aria-pressed", String(dark));
    };
    applyTheme(isDark);
    themeToggle.addEventListener("click", () => applyTheme(!elements.detailsWindow.classList.contains("is-dark-view")));
    elements.modalClose.setAttribute("aria-label", "Close résumé viewer");
    elements.detailsWindow.classList.add("is-resume-viewer");
    elements.modalLabel.textContent = "DOCUMENT VIEWER";
    elements.detailModal.classList.add("is-open");
    elements.detailModal.setAttribute("aria-hidden", "false");
    elements.modalClose.focus();
  }

  function openActiveModule() { if (activeKey === "projects") { openProjectDetail(); return; } if (activeKey === "resume") { openResumeViewer(); return; } if (activeKey === "memory" && window.MemoryWall) { lastFocused = document.activeElement; window.MemoryWall.open(); return; } if (activeKey === "profile" && window.ProfileSystem) { lastFocused = document.activeElement; window.ProfileSystem.open((target) => { closeDetail(); selectSection(target); if (target === "resume") window.setTimeout(openResumeViewer, 60); }); return; } const section = sections[activeKey]; lastFocused = document.activeElement; const title = create("h2", "", section.label); title.id = "modalTitle"; const description = create("p", "", section.description); const note = create("div", "empty-state", "This module is ready for verified portfolio content."); elements.modalContent.replaceChildren(title, description, note); showDetailsModal("PORTFOLIO MODULE"); }
  function closeDetail() { elements.detailModal.classList.remove("is-open"); elements.detailModal.setAttribute("aria-hidden", "true"); if (lastFocused instanceof HTMLElement) lastFocused.focus(); }
  function renderSearch(query = "") { const term = query.trim().toLowerCase(); const matches = sectionOrder.filter((key) => sections[key].label.toLowerCase().includes(term)); elements.searchResults.replaceChildren(); matches.forEach((key) => { const button = create("button", "search-result", sections[key].label); button.type = "button"; button.addEventListener("click", () => { closeSearch(); selectSection(key); }); elements.searchResults.append(button); }); if (!matches.length) elements.searchResults.append(create("p", "empty-state", "No portfolio module matches that search.")); }
  function openSearch() { lastFocused = document.activeElement; elements.searchModal.classList.add("is-open"); elements.searchModal.setAttribute("aria-hidden", "false"); elements.searchInput.value = ""; renderSearch(); elements.searchInput.focus(); }
  function closeSearch() { elements.searchModal.classList.remove("is-open"); elements.searchModal.setAttribute("aria-hidden", "true"); if (lastFocused instanceof HTMLElement) lastFocused.focus(); }
  function changeSection(direction) { const index = sectionOrder.indexOf(activeKey); const nextIndex = (index + direction + sectionOrder.length) % sectionOrder.length; selectSection(sectionOrder[nextIndex]); elements.apps[nextIndex].focus(); }
  function handleAppKeyboard(event) { if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return; event.preventDefault(); changeSection(event.key === "ArrowLeft" || event.key === "ArrowUp" ? -1 : 1); }
  function setNavState(action) { elements.navButtons.forEach((button) => button.classList.toggle("is-active", button.dataset.action === action)); }
  function handleAction(action) { setNavState(action); if (action === "home") selectSection("profile", { replace: true }); if (action === "recent") { renderContent("recent"); setHash("recent"); } if (action === "search") openSearch(); if (action === "diagnostics") { renderContent("diagnostics"); setHash("diagnostics"); } if (action === "power") window.HmiBoot.powerDown(); }
  function handleKeydown(event) { if (event.key !== "Escape") return; if (elements.searchModal.classList.contains("is-open")) closeSearch(); else if (elements.detailModal.classList.contains("is-open")) closeDetail(); }
  function applyHash() { const hash = location.hash.slice(1); if (hash === "home" || !hash) selectSection("projects", { writeHistory: false, record: false, animate: false }); else if (hash === "hmi") selectSection("games", { writeHistory: false, record: false, animate: false }); else if (sections[hash]) selectSection(hash, { writeHistory: false, record: false, animate: false }); else if (hash === "recent" || hash === "diagnostics") renderContent(hash); }

  function initialize() {
    cacheElements();
    elements.apps.forEach((button) => { button.addEventListener("click", () => { if (button.dataset.section === activeKey) openActiveModule(); else selectSection(button.dataset.section); }); button.addEventListener("keydown", handleAppKeyboard); });
    elements.openSelected.addEventListener("click", openActiveModule);
    elements.previous.addEventListener("click", () => changeSection(-1)); elements.next.addEventListener("click", () => changeSection(1));
    elements.navButtons.forEach((button) => button.addEventListener("click", () => handleAction(button.dataset.action)));
    elements.modalClose.addEventListener("click", closeDetail); elements.detailModal.addEventListener("click", (event) => { if (event.target === elements.detailModal) closeDetail(); });
    elements.searchClose.addEventListener("click", closeSearch); elements.searchModal.addEventListener("click", (event) => { if (event.target === elements.searchModal) closeSearch(); }); elements.searchInput.addEventListener("input", () => renderSearch(elements.searchInput.value));
    document.addEventListener("keydown", handleKeydown); window.addEventListener("popstate", applyHash); setNavState("home"); applyHash();
  }
  return { initialize };
})();
