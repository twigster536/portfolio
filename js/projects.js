/* Reusable project browser and case-study workspace. */
window.ProjectsSystem = (() => {
  const PROJECTS = Object.freeze([
    {
      id: "ai-hvac",
      number: "01",
      title: "AI-Based Predictive HVAC Control",
      titleLines: ["AI-BASED PREDICTIVE", "HVAC CONTROL"],
      subtitle: "AI-Based Predictive Control Simulation for Energy-Efficient HVAC Motors",
      status: "SIMULATION COMPLETED & TESTED",
      browserStatus: "SIMULATION COMPLETED",
      type: "CAPSTONE PROJECT",
      platform: "MATLAB / SIMULATION",
      domain: "HVAC / AI / VFD / CONTROL",
      tags: ["AI", "HVAC", "VFD", "MATLAB", "CONTROL"],
      categories: ["HVAC", "AUTOMATION", "CONTROL", "SOFTWARE"],
      libraryDescription: "Simulation-based capstone project developed in MATLAB to predict HVAC demand and evaluate proactive VFD-oriented motor control against traditional control methods.",
      thumbnail: "assets/images/ai-hvac/simulation-output.png",
      images: {
        context: "assets/images/ai-hvac/case-study-ac01.png",
        matlab: "assets/images/ai-hvac/matlab-simulation.png",
        output: "assets/images/ai-hvac/simulation-output.png"
      },
      projectRoute: "#project-ai-hvac",
      caseStudy: "hvac",
      overview: "This capstone project developed a simulation-based predictive HVAC control system using MATLAB. Environmental and occupancy-related inputs are used to forecast HVAC demand and inform a VFD-oriented motor-speed strategy before indoor conditions significantly deviate from the desired state.",
      problem: [
        "Fixed-speed motors or basic thermostat / PID control can react after the temperature has already changed.",
        "Partial-load operation can waste energy and create unnecessary cycling.",
        "Rapid weather or occupancy changes can be difficult to address with purely reactive control."
      ],
      architecture: ["WEATHER / ENVIRONMENT", "INPUT DATA", "MATLAB AI MODEL", "PREDICTED THERMAL LOAD", "CONTROL STRATEGY", "VFD MOTOR SPEED", "HVAC SYSTEM", "TEMPERATURE / ENERGY RESPONSE", "MONITORING / FEEDBACK"],
      metrics: ["Temperature Control Accuracy (C)", "Boiler Power", "Chiller Power", "Total Energy Consumption (kWh)", "Humidity Monitoring", "AI Temperature Prediction Error (C)"],
      technologies: ["MATLAB", "AI / Predictive Modeling", "HVAC Control", "VFD Control Concept", "PID Comparison", "BAS Comparison", "Weather / Environmental Data", "Simulation"],
      simulationRoute: "#project-ai-hvac-simulation"
    },
    {
      id: "engineering-lab",
      number: "02",
      title: "Engineering Lab",
      titleLines: ["ENGINEERING", "LAB"],
      subtitle: "Interactive Engineering Calculation & Analysis Workspace",
      status: "ACTIVE / FUNCTIONAL",
      browserStatus: "ACTIVE / FUNCTIONAL",
      cardStatus: "ACTIVE / FUNCTIONAL",
      type: "WEB ENGINEERING TOOL",
      platform: "DETERMINISTIC FORMULA ENGINE",
      domain: "ELECTRICAL / MOTION / PLC / CONTROL / HVAC / BAS",
      tags: ["ELECTRICAL", "MOTION", "PLC", "CONTROL", "HVAC", "BAS"],
      categories: ["ELECTRICAL", "MOTION", "PLC", "AUTOMATION", "CONTROL", "HVAC", "BAS", "SOFTWARE"],
      libraryDescription: "Interactive engineering calculation and analysis workspace for Electrical, Motion, PLC, Control, HVAC and BAS systems.",
      projectRoute: "#project-engineering-lab",
      simulationRoute: "#engineering-lab",
      caseStudy: "engineering-lab"
    },
    {
      id: "residential-hvac-bas",
      number: "03",
      title: "Residential HVAC BAS",
      titleLines: ["RESIDENTIAL HVAC", "BUILDING AUTOMATION SYSTEM"],
      subtitle: "Rule-Based Smart Home HVAC Monitoring, Control & Diagnostic Platform",
      status: "ACTIVE DEVELOPMENT",
      browserStatus: "IN DEVELOPMENT / FUNCTIONAL PROTOTYPE",
      cardStatus: "IN DEVELOPMENT / FUNCTIONAL PROTOTYPE",
      type: "INTERACTIVE BAS PROTOTYPE",
      platform: "RULE-BASED / NON-AI",
      domain: "HVAC / BAS / CONTROLS",
      locationModel: "KITCHENER, ONTARIO",
      tags: ["HVAC", "BAS", "CONTROLS", "ENERGY", "IAQ", "MAINTENANCE"],
      categories: ["HVAC", "AUTOMATION", "CONTROL", "SOFTWARE"],
      libraryDescription: "Interactive residential Building Automation System for HVAC control, environmental monitoring, indoor air quality, energy management, equipment diagnostics and preventive maintenance.",
      projectRoute: "#project-residential-hvac-bas",
      simulationRoute: "#bas",
      caseStudy: "residential-bas"
    }
  ]);

  const pageState = { open: false, root: null, returnFocus: null, directRoute: false, onKeydown: null, project: null };
  const libraryState = { open: false, root: null, returnFocus: null, directRoute: false, activeFilter: "ALL", onKeydown: null };
  const projectById = (id) => PROJECTS.find((project) => project.id === id);
  const projectByRoute = (route) => PROJECTS.find((project) => project.projectRoute === route);
  const create = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const button = (label, className) => { const node = create("button", className, label); node.type = "button"; return node; };
  const label = (text) => create("p", "project-case-label", text);

  function tagList(tags) { const list = create("div", "project-case-tags"); tags.forEach((tag) => list.append(create("span", "", tag))); return list; }
  function imageFrame(source, alt, caption, className = "") { const figure = create("figure", `project-case-figure ${className}`.trim()); const image = document.createElement("img"); image.src = source; image.alt = alt; image.width = 1600; image.height = 900; image.loading = "lazy"; const figcaption = create("figcaption", "", caption); figure.append(image, figcaption); return figure; }
  function sectionShell(number, title, copy, className = "") { const section = create("section", `project-case-section ${className}`.trim()); section.id = `project-section-${number}`; const header = create("header", "project-case-section-header"); header.append(create("span", "project-case-section-number", number), create("div", "", "")); header.lastChild.append(create("h2", "", title), create("p", "", copy)); section.append(header); return section; }
  function factGrid(items) { const list = create("dl", "project-case-facts"); items.forEach(([term, definition]) => { const row = document.createElement("div"); row.append(create("dt", "", term), create("dd", "", definition)); list.append(row); }); return list; }

  function showSimulationNotice(root, project, trigger) {
    const notice = root.querySelector(".project-simulation-notice");
    if (!notice) return;
    notice.hidden = false;
    notice.dataset.returnFocus = trigger instanceof HTMLElement ? "true" : "false";
    notice.querySelector(".project-simulation-dismiss")?.focus({ preventScroll: true });
    const route = notice.querySelector(".project-simulation-route");
    if (route) route.textContent = `INTERACTIVE PROTOTYPE / ${project.simulationRoute}`;
  }
  function hideSimulationNotice(root) {
    const notice = root?.querySelector(".project-simulation-notice");
    if (notice) notice.hidden = true;
  }
  function simulateButton(root, project, modifier = "") {
    const action = button("SIMULATE", `project-simulate ${modifier}`.trim());
    action.setAttribute("aria-label", `Open the interactive digital prototype for ${project.title}`);
    action.addEventListener("click", () => { window.location.hash = project.simulationRoute; });
    return action;
  }

  function launchLabButton(project, modifier = "") {
    const action = button("SIMULATE", `project-simulate ${modifier}`.trim());
    action.setAttribute("aria-label", `Launch the interactive Engineering Lab from ${project.title}`);
    action.addEventListener("click", () => window.EngineeringLab?.openLab(action));
    return action;
  }

  function launchBasButton(project, modifier = "") {
    const action = button("SIMULATE", `project-simulate ${modifier}`.trim());
    action.setAttribute("aria-label", `Launch the live Residential BAS from ${project.title}`);
    action.addEventListener("click", () => { window.location.hash = "#bas"; });
    return action;
  }

  function renderEngineeringLabProject(project, root) {
    root.replaceChildren();
    const shell = create("article", "project-case-shell project-case-shell--engineering");
    const header = create("header", "project-case-topbar");
    const back = button("ALL PROJECTS", "project-case-back");
    back.setAttribute("aria-label", "Return to Projects browser");
    back.addEventListener("click", () => returnToLibrary());
    const identity = create("div", "project-case-identity");
    identity.append(create("p", "", "AUTOMATION CONTROL / PROJECT CASE STUDY"), create("strong", "", `PROJECT / ${project.number}`));
    const status = create("div", "project-case-status");
    status.append(create("span", "", ""), create("b", "", "PROJECT ONLINE"), create("small", "", project.status));
    header.append(back, identity, status);

    const hero = create("section", "project-case-hero");
    const heroCopy = create("div", "project-case-hero-copy");
    heroCopy.append(label(`PROJECT ${project.number}`));
    const heading = create("h1", ""); project.titleLines.forEach((line) => heading.append(create("span", "", line))); heroCopy.append(heading, create("p", "project-case-subtitle", project.subtitle), tagList(project.tags));
    const actions = create("div", "project-case-hero-actions"); actions.append(launchLabButton(project, "project-simulate--hero"), create("p", "", "LAUNCH INTERACTIVE ENGINEERING LAB")); heroCopy.append(actions);
    const meta = create("aside", "project-case-hero-meta");
    meta.append(label("PROJECT METADATA"), factGrid([["TYPE", project.type], ["STATUS", project.status], ["SYSTEM", project.platform], ["MODULES", project.domain]]));
    hero.append(heroCopy, meta);

    const overview = sectionShell("02", "PROJECT OVERVIEW", "Interactive engineering workspace, not a static calculator page.");
    overview.append(create("p", "project-case-lead", "The Engineering Lab is an interactive calculation and analysis workspace designed to bring common engineering calculations into one structured interface. It combines electrical, machine, PLC, control, HVAC and BAS calculations with a deterministic formula engine, dynamic input requirements and multi-level solving."));

    const problem = sectionShell("03", "THE PROBLEM", "Common calculation tasks are often split across tools and manual steps.");
    const problemList = create("ul", "project-case-problem-list");
    ["Switch between separate calculators or references.", "Manually identify the correct formula and required values.", "Convert compatible units separately before calculating.", "Calculate intermediate values without a clear dependency path.", "Determine which known values are still missing.", "Work across several engineering disciplines with inconsistent workflows."].forEach((item, index) => { const row = create("li", ""); row.append(create("span", "", String(index + 1).padStart(2, "0")), create("p", "", item)); problemList.append(row); });
    problem.append(problemList, create("p", "project-case-scope-lead", "The Lab brings these tasks into one consistent formula-driven system while keeping the calculation path visible."));

    const concept = sectionShell("04", "CORE CONCEPT", "A guided route from system selection to a traceable result.");
    const conceptFlow = create("ol", "project-case-flow");
    ["SELECT CATEGORY", "SELECT LEVEL", "SELECT EQUIPMENT / SYSTEM", "SELECT TARGET PARAMETER", "ENTER KNOWN VALUES", "FORMULA ENGINE", "DEPENDENCY RESOLUTION", "RESULT + CALCULATION PATH"].forEach((item, index) => { const step = create("li", ""); step.append(create("span", "", String(index + 1).padStart(2, "0")), create("b", "", item)); conceptFlow.append(step); }); concept.append(conceptFlow);

    const categories = sectionShell("05", "ENGINEERING CATEGORIES", "Available formula groups currently exposed by the Engineering Lab.");
    const categoryGrid = create("div", "engineering-case-category-grid");
    [["01", "ELECTRICAL", ["Ohm's law", "DC, single-phase and three-phase power", "Inductive and capacitive reactance"]], ["02", "MOTION", ["DC and AC machine relationships", "Synchronous speed, slip and torque / power", "BLDC / PMSM and transformer calculations"]], ["03", "PLC", ["4-20 mA and 0-10 V scaling", "Raw-count conversion", "Encoder RPM"]], ["04", "CONTROL", ["Control error and proportional output", "Gain / proportional-band relationships", "Basic PID output and VFD speed"]], ["05", "HVAC", ["Round / rectangular duct area", "Airflow and velocity relationships", "Cooling capacity, refrigeration tons and COP"]], ["06", "BAS", ["Sensor scaling", "Runtime energy and savings", "Load aggregation and airflow"]]].forEach(([number, title, items]) => { const card = create("article", "engineering-case-category"); const list = create("ul", ""); items.forEach((item) => list.append(create("li", "", item))); card.append(create("span", "", number), create("p", "engineering-case-availability", "AVAILABLE"), create("h3", "", title), list); categoryGrid.append(card); });
    categories.append(categoryGrid);

    const levels = sectionShell("06", "THREE-LEVEL SYSTEM", "Three modes support direct calculation through constrained dependency solving.");
    const levelGrid = create("div", "engineering-case-level-grid");
    [["LEVEL 1", "QUICK CALCULATOR", "Known values → one selected deterministic relationship.", ["Direct calculation", "Formula and substitution steps"]], ["LEVEL 2", "ENGINEERING CALCULATOR", "Select a system and target; the Lab requests a valid direct or derived input method.", ["Dynamic required inputs", "Formula, substitution and derived values"]], ["LEVEL 3", "SYSTEM SOLVER", "Enable only verified known values; the dependency engine derives only relationships it can prove.", ["NO GUESSING", "INSUFFICIENT DATA when no additional result is proven"]]].forEach(([number, title, copy, items]) => { const card = create("article", "engineering-case-level"); const list = create("ul", ""); items.forEach((item) => list.append(create("li", "", item))); card.append(create("span", "", number), create("h3", "", title), create("p", "", copy), list); levelGrid.append(card); }); levels.append(levelGrid);

    const engine = sectionShell("07", "FORMULA ENGINE", "Explicit engineering relationships are used instead of AI-generated numerical answers.");
    const engineBadge = create("p", "engineering-case-badge", "DETERMINISTIC / TRACEABLE / ENGINEERING LOGIC");
    const enginePoints = create("ul", "project-case-matters"); ["Deterministic calculations", "Formula-based outputs", "Validated inputs", "Dependency resolution", "Unit normalization where supported", "Transparent calculation steps", "No hidden estimation"].forEach((item) => enginePoints.append(create("li", "", item))); engine.append(engineBadge, enginePoints);

    const dependency = sectionShell("08", "DEPENDENCY RESOLUTION", "Level 3 evaluates relationships between verified engineering variables.");
    const derivation = create("div", "engineering-case-derivation");
    [["KNOWN", "Frequency + Poles"], ["DERIVE", "Synchronous Speed"], ["ADD", "Rotor Speed"], ["DERIVE", "Slip"]].forEach(([labelText, value]) => { const node = create("article", ""); node.append(create("span", "", labelText), create("b", "", value)); derivation.append(node); });
    dependency.append(derivation, create("p", "project-case-lead", "The solver can derive downstream values only when its available formulas and verified inputs support them. It does not claim to solve every engineering problem."));

    const inputs = sectionShell("09", "DYNAMIC REQUIRED INPUTS", "The interface asks only for inputs needed by the selected relationship or method.");
    const inputFlow = create("div", "engineering-case-mini-flow"); ["SELECT EQUIPMENT", "SELECT TARGET", "SHOW REQUIRED PARAMETERS", "CALCULATE / DERIVE"].forEach((item, index) => inputFlow.append(create("span", "", `${String(index + 1).padStart(2, "0")}  ${item}`))); inputs.append(inputFlow, create("p", "project-case-lead", "This reduces visual clutter and helps prevent unnecessary or incorrect entries before a calculation is attempted."));

    const units = sectionShell("10", "UNIT HANDLING", "Supported unit choices are normalized internally for the selected formula input.");
    const unitTags = tagList(["V / kV / mV", "A / mA", "W / kW / MW", "RPM", "Hz / kHz", "Ohm / kOhm", "H / mH", "F / mF / uF", "Pa / kPa", "CFM / m3/s", "BTU/h", "kWh / MWh", "TONS", "C / F (DELTA)"]); units.append(unitTags, create("p", "project-case-lead", "The Lab presents available unit selectors per input, then converts supported values to a normalized internal scale before calculation."));

    const validation = sectionShell("11", "ENGINEERING VALIDATION", "Implemented rules prevent invalid numerical inputs from entering a formula path.");
    const validationGrid = create("div", "engineering-case-validation-grid");
    [["INVALID INPUT", "Non-numeric entries and values outside enforced limits return an explicit input error."], ["POSITIVE VALUES", "Frequency, poles, selected voltages and similar required inputs must be greater than zero where the formula requires it."], ["BOUNDED VALUES", "Efficiency is constrained to 0–100%, while power factor is constrained to 0–1 before calculation."], ["INSUFFICIENT DATA", "The solver reports when supplied inputs cannot prove another supported relationship."]].forEach(([title, copy]) => { const card = create("article", ""); card.append(create("h3", "", title), create("p", "", copy)); validationGrid.append(card); }); validation.append(validationGrid);

    const interfaceSection = sectionShell("12", "USER INTERFACE", "The working Lab uses a three-column desktop arrangement.");
    const interfaceMap = create("div", "engineering-case-interface-map");
    [["01", "CONFIGURATION", ["Category", "Level", "Equipment", "Target", "Dynamic inputs", "Units", "Calculate"]], ["02", "ENGINEERING WORKSPACE", ["Active formula", "Calculation path", "Substitution steps", "Relationship map", "Derived values"]], ["03", "RESULTS", ["Primary result", "Status", "Derived values", "Insufficient-data notices", "Session history"]]].forEach(([number, title, items]) => { const card = create("article", ""); const list = create("ul", ""); items.forEach((item) => list.append(create("li", "", item))); card.append(create("span", "", number), create("h3", "", title), list); interfaceMap.append(card); }); interfaceSection.append(interfaceMap);

    const recent = sectionShell("13", "SESSION HISTORY", "Recent calculations are retained only during the active browser session.");
    recent.append(create("p", "project-case-lead", "When calculations are completed, the current Lab can display a short recent-calculations list in its results workspace. It does not claim persistent cloud storage."));

    const principle = sectionShell("14", "DESIGN PRINCIPLE", "Transparent engineering calculation is the central product decision.");
    principle.append(create("p", "engineering-case-quote", "Engineering calculations should be transparent. Every result should be traceable back to known values, formulas and derived relationships."), create("ul", "project-case-matters", ""));
    const principleList = principle.querySelector(".project-case-matters"); ["No black-box numerical answers", "No guessed missing values", "Clearly show insufficient data", "Expose formula and calculation path", "Support learning as well as professional checking"].forEach((item) => principleList.append(create("li", "", item)));

    const outcome = sectionShell("15", "PROJECT OUTCOME", "The Lab demonstrates reusable web-engineering tool design.");
    const outcomeList = create("ul", "project-case-matters"); ["Multi-discipline engineering tool design", "Formula-engine architecture", "Dependency solving", "Dynamic UI generation", "Input validation", "Supported unit handling", "Responsive technical interface", "Integration into the main portfolio"].forEach((item) => outcomeList.append(create("li", "", item))); outcome.append(outcomeList);

    const scope = sectionShell("16", "PROJECT SCOPE", "Current implemented Engineering Lab capabilities.");
    const scopeGrid = create("div", "project-case-scope-grid");
    [["CURRENTLY AVAILABLE", ["Engineering Lab interface", "Six-category architecture", "Level 1 / Level 2 / Level 3 workflows", "Formula-driven calculations", "Dynamic input workflow", "Results workspace", "Input validation", "Website integration"]], ["CURRENT LIMITS", ["Only formulas currently exposed by the Lab are available", "Derived values require sufficient verified inputs", "Recent calculations are session-only", "No AI-generated numerical answers"]]].forEach(([title, items], index) => { const block = create("section", `project-case-scope-block ${index ? "is-outside" : ""}`); const list = create("ul", ""); items.forEach((item) => list.append(create("li", "", item))); block.append(create("h3", "", title), list); scopeGrid.append(block); }); scope.append(scopeGrid);

    const cta = create("section", "project-case-final-cta");
    const ctaActions = create("div", "project-case-cta-actions");
    const projectOne = button("PROJECT 01", "project-case-related-button"); projectOne.setAttribute("aria-label", "Open Project 01 AI-Based Predictive HVAC Control"); projectOne.addEventListener("click", () => switchProject("ai-hvac", projectOne));
    const allProjects = button("ALL PROJECTS", "project-case-related-button"); allProjects.addEventListener("click", () => returnToLibrary());
    ctaActions.append(projectOne, allProjects);
    cta.append(label("17 / INTERACTIVE TOOL"), create("h2", "", "TRY THE ENGINE"), create("p", "", "Choose an engineering category, provide known values and see the formula engine solve the problem."), launchLabButton(project, "project-simulate--final"), ctaActions);

    shell.append(header, hero, overview, problem, concept, categories, levels, engine, dependency, inputs, units, validation, interfaceSection, recent, principle, outcome, scope, cta); root.append(shell);
  }

  function renderResidentialBasProject(project, root) {
    root.replaceChildren();
    const shell = create("article", "project-case-shell project-case-shell--bas");
    const header = create("header", "project-case-topbar");
    const back = button("ALL PROJECTS", "project-case-back");
    back.setAttribute("aria-label", "Return to Projects browser");
    back.addEventListener("click", () => returnToLibrary());
    const identity = create("div", "project-case-identity");
    identity.append(create("p", "", "AUTOMATION CONTROL / PROJECT CASE STUDY"), create("strong", "", `PROJECT / ${project.number}`));
    const status = create("div", "project-case-status");
    status.append(create("span", "", ""), create("b", "", "BAS PROTOTYPE"), create("small", "", project.status));
    header.append(back, identity, status);

    const hero = create("section", "project-case-hero project-case-hero--bas");
    const heroCopy = create("div", "project-case-hero-copy");
    heroCopy.append(label(`PROJECT ${project.number}`));
    const heading = create("h1", ""); project.titleLines.forEach((line) => heading.append(create("span", "", line)));
    const heroActions = create("div", "project-case-hero-actions");
    heroActions.append(launchBasButton(project, "project-simulate--hero"), create("p", "", "LAUNCH LIVE BAS"));
    heroCopy.append(heading, create("p", "project-case-subtitle", project.subtitle), tagList(project.tags), heroActions);
    const heroMeta = create("aside", "project-case-hero-meta");
    heroMeta.append(label("PROJECT METADATA"), factGrid([["TYPE", project.type], ["DOMAIN", project.domain], ["CONTROL", project.platform], ["LOCATION MODEL", project.locationModel], ["STATUS", project.status]]));
    hero.append(heroCopy, heroMeta);

    const overview = sectionShell("02", "PROJECT OVERVIEW", "A centralized operator view of a simulated residential HVAC system.");
    const overviewGrid = create("div", "project-case-two-column project-bas-overview-grid");
    overviewGrid.append(create("p", "project-case-lead", "The Residential HVAC BAS is an interactive building automation prototype designed to demonstrate how a residential HVAC system can be monitored, controlled and diagnosed through a centralized HMI. The system combines live outdoor conditions with simulated indoor sensors, HVAC equipment, occupancy schedules, energy monitoring, air-quality control and preventive-maintenance logic."), factGrid([["LIVE EXTERNAL DATA", "Kitchener outdoor weather, humidity, condition and wind when available"], ["SIMULATED BUILDING DATA", "Indoor sensors, equipment response, runtime, energy and maintenance points"], ["CONTROL BASIS", "Conventional rule-based BAS logic - no AI control"]]));
    overview.append(overviewGrid);

    const objective = sectionShell("03", "OBJECTIVE", "Demonstrate conventional BAS coordination without presenting it as AI control.");
    objective.append(create("p", "project-case-lead", "The objective is to demonstrate how a conventional rule-based BAS can coordinate HVAC control, environmental monitoring, occupancy scheduling, indoor air quality, energy management, equipment monitoring, preventive maintenance, and alarm / fault management."));
    const objectiveList = create("ul", "project-case-matters"); ["HVAC control", "Environmental monitoring", "Occupancy scheduling", "Indoor air quality", "Energy management", "Equipment monitoring", "Preventive maintenance", "Alarm / fault management"].forEach((item) => objectiveList.append(create("li", "", item))); objective.append(objectiveList);

    const architecture = sectionShell("04", "SYSTEM ARCHITECTURE", "Live environmental input feeds a rule-based BAS data and control path.");
    const diagram = create("div", "project-bas-architecture");
    const stage = (title, items, className = "") => { const node = create("section", `project-bas-architecture-stage ${className}`.trim()); node.append(create("b", "", title)); const list = create("div", ""); items.forEach((item) => list.append(create("span", "", item))); node.append(list); return node; };
    diagram.append(stage("LIVE KITCHENER DATA", ["Weather", "Outdoor conditions"], "is-live"), create("span", "project-bas-architecture-arrow", "DOWN"), stage("BAS DATA LAYER", ["Live / SIM point management"], "is-data"), create("span", "project-bas-architecture-arrow", "DOWN"), stage("SENSORS", ["Temperature", "Humidity", "CO2 / IAQ", "Gas / CO", "Equipment feedback"], "is-sensors"), create("span", "project-bas-architecture-arrow", "DOWN"), stage("BAS CONTROL LOGIC", ["HVAC control", "Ventilation control"], "is-control"), create("span", "project-bas-architecture-arrow", "DOWN"), stage("ACTUATORS", ["Fan", "Dampers", "Valves", "Heating", "Cooling"], "is-actuators"), create("span", "project-bas-architecture-arrow", "DOWN"), stage("BUILDING RESPONSE", ["Zone response", "Sensor feedback"], "is-response"));
    const parallel = create("div", "project-bas-parallel-systems"); ["ENERGY MONITORING", "PREVENTIVE MAINTENANCE", "ALARMS / FAULTS"].forEach((item) => parallel.append(create("span", "", item))); architecture.append(diagram, parallel);

    const environment = sectionShell("05", "LIVE ENVIRONMENTAL INPUT", "External Kitchener data remains separate from simulated building points.");
    const environmentGrid = create("div", "project-bas-card-grid");
    [["LIVE WHEN AVAILABLE", "Outdoor temperature, outdoor humidity, weather condition and wind are requested from the existing weather service for Kitchener, Ontario."], ["SIMULATED BUILDING LAYER", "Indoor zone conditions, equipment feedback and building response are purposely labelled as simulated training / prototype points."]].forEach(([title, copy]) => { const card = create("article", ""); card.append(create("h3", "", title), create("p", "", copy)); environmentGrid.append(card); }); environment.append(environmentGrid);

    const hvacControl = sectionShell("06", "HVAC CONTROL", "A rule-based demand path uses setpoints and indoor response.");
    const hvacFlow = create("div", "project-bas-control-flow"); ["INDOOR TEMPERATURE + HEATING / COOLING SETPOINT", "CONTROL DEMAND", "HEATING / COOLING", "FAN / VALVES / DAMPERS", "ZONE RESPONSE"].forEach((item, index) => { hvacFlow.append(create("span", "", item)); if (index < 4) hvacFlow.append(create("i", "", "DOWN")); }); hvacControl.append(hvacFlow, create("p", "project-case-lead", "The implemented interface supports manual setpoint control, scheduled setpoints, occupied and unoccupied periods, heating, cooling, standby behavior, and a deadband-based rule response."));

    const setpoints = sectionShell("07", "MANUAL + SCHEDULE CONTROL", "The operator can select a normal schedule or a manual override.");
    const setpointGrid = create("div", "project-bas-card-grid");
    [["SCHEDULE MODE", "Scheduled operation changes temperature targets by occupancy period. The existing BAS resolves weekday and weekend occupied, unoccupied and night-setback periods."], ["MANUAL MODE", "An operator can override the normal heating and cooling setpoints. Changes affect the simulated HVAC response rather than a physical HVAC device."]].forEach(([title, copy]) => { const card = create("article", ""); card.append(create("h3", "", title), create("p", "", copy)); setpointGrid.append(card); }); setpoints.append(setpointGrid);

    const occupancy = sectionShell("08", "OCCUPANCY-BASED OPERATION", "Scheduled periods are a conventional BAS input, not an AI decision.");
    const occupancyFlow = create("div", "project-bas-occupancy-flow"); [["MORNING", "OCCUPIED"], ["WORK HOURS", "UNOCCUPIED"], ["EVENING", "OCCUPIED"], ["NIGHT", "SETBACK"]].forEach(([period, state]) => { const item = create("article", ""); item.append(create("span", "", period), create("b", "", state)); occupancyFlow.append(item); }); occupancy.append(occupancyFlow, create("p", "project-case-lead", "Conventional schedule logic adjusts setpoint targets according to expected occupancy without requiring predictive or AI control."));

    const iaq = sectionShell("09", "INDOOR AIR QUALITY", "Indoor values are simulated; outdoor AQ data is live when the existing provider is available.");
    const iaqGrid = create("div", "project-bas-iaq-grid");
    const indoorIaq = create("article", ""); indoorIaq.append(create("h3", "", "SUPPORTED IAQ POINTS"), tagList(["CO2", "VOC", "PM2.5", "HUMIDITY", "IAQ STATUS"]));
    const ventilationLogic = create("article", ""); ventilationLogic.append(create("h3", "", "RULE-BASED VENTILATION"), create("p", "", "INDOOR IAQ POOR + OUTDOOR IAQ ACCEPTABLE -> increase ventilation."), create("p", "", "INDOOR IAQ POOR + OUTDOOR IAQ POOR -> restrict unnecessary outdoor-air intake and generate an operator indication."));
    iaqGrid.append(indoorIaq, ventilationLogic); iaq.append(iaqGrid);

    const sensors = sectionShell("10", "BAS SENSOR NETWORK", "The BAS presents a value together with feedback, communication and health context.");
    const sensorGrid = create("div", "project-bas-sensor-grid"); ["Zone temperature", "Indoor RH", "CO2", "VOC", "PM2.5", "Supply-air temperature", "Return-air temperature", "Outdoor temperature", "Occupancy", "Gas", "CO", "Flame status", "Filter differential pressure"].forEach((item) => sensorGrid.append(create("span", "", item))); sensors.append(sensorGrid, create("p", "project-case-lead", "Sensor quality is interpreted as VALUE + QUALITY + COMMUNICATION + HEALTH. A 0 reading does not automatically mean conditions are safe if the signal is invalid."));

    const actuators = sectionShell("11", "CONTROLLED EQUIPMENT", "Command versus feedback makes closed-loop monitoring visible.");
    const actuatorGrid = create("div", "project-bas-actuator-grid"); ["Supply fan", "Outdoor-air damper", "Return-air damper", "Zone damper", "Heating valve", "Cooling valve", "Heating system", "Cooling system"].forEach((item) => actuatorGrid.append(create("span", "", item))); const actuatorExample = create("article", "project-bas-command-example"); actuatorExample.append(create("h3", "", "OA DAMPER"), factGrid([["CMD", "60%"], ["FB", "58%"], ["STATUS", "NORMAL"]])); actuators.append(actuatorGrid, actuatorExample);

    const safety = sectionShell("12", "COMBUSTION & GAS SAFETY MONITORING", "Educational monitoring points sit alongside the implemented furnace proving sequence.");
    const safetyList = create("ul", "project-case-matters"); ["Gas detector", "CO detector", "Flame sensor", "Gas valve", "Burner status", "Draft proof", "High-limit status", "Furnace sequence"].forEach((item) => safetyList.append(create("li", "", item))); const safetyFlow = create("div", "project-bas-safety-flow"); ["CALL FOR HEAT", "INDUCER", "DRAFT PROOF", "IGNITION", "GAS VALVE", "FLAME PROOF", "HEATING"].forEach((item) => safetyFlow.append(create("span", "", item))); safety.append(safetyList, safetyFlow, create("p", "project-case-scope-lead", "This is an educational BAS simulation and does not replace certified furnace equipment or life-safety controls."));

    const faults = sectionShell("13", "FAULT & ALARM ENGINE", "Events are based on expected system relationships and persistence rather than random messages.");
    const faultFlow = create("div", "project-bas-fault-flow"); [["COMMAND", "Feedback request"], ["FEEDBACK", "Reported equipment state"], ["SENSOR VALUE", "Plausible point reading"], ["EXPECTED RESPONSE", "Rule condition"], ["PERSISTENCE TIME", "Condition remains"], ["EVENT", "Fault / warning indication"]].forEach(([title, copy]) => { const card = create("article", ""); card.append(create("b", "", title), create("span", "", copy)); faultFlow.append(card); }); const faultExamples = create("ul", "project-case-problem-list"); [["01", "FAN COMMAND = ON + FAN FEEDBACK = OFF + persistence time -> FAN FAULT."], ["02", "DAMPER CMD = 70% + POSITION = 10% + persistence time -> POSITION FAULT."]].forEach(([number, copy]) => { const item = create("li", ""); item.append(create("span", "", number), create("p", "", copy)); faultExamples.append(item); }); faults.append(faultFlow, faultExamples);

    const events = sectionShell("14", "EVENT MANAGEMENT", "The top event center distinguishes current condition from operator acknowledgement.");
    const eventGrid = create("div", "project-bas-event-levels"); ["INFO", "WARNING", "MAINTENANCE", "FAULT", "ALARM"].forEach((item) => eventGrid.append(create("span", "", item))); events.append(eventGrid, create("p", "project-case-lead", "The event lifecycle is ACTIVE -> ACKNOWLEDGED -> CLEARED. Acknowledging an event does not imply the underlying condition has been repaired."));

    const maintenance = sectionShell("15", "PREVENTIVE MAINTENANCE", "Operating information is used to surface developing conditions for inspection.");
    const maintenanceGrid = create("div", "project-bas-maintenance-grid"); ["Air filter", "Supply fan / blower", "Furnace", "AC / cooling system", "Compressor", "Dampers", "Valves", "Temperature sensors", "IAQ sensors"].forEach((item) => maintenanceGrid.append(create("span", "", item))); maintenance.append(maintenanceGrid, create("p", "project-case-lead", "These interfaces are condition-oriented indicators based on available simulated BAS points and runtime information; they do not claim a definitive physical diagnosis."));

    const filter = sectionShell("16", "FILTER CONDITION MONITORING", "Air-filter condition is the primary preventive-maintenance example.");
    const filterFormula = create("div", "project-bas-filter-formula"); ["FILTER DELTA P", "AIRFLOW", "FAN COMMAND", "RUNTIME", "TREND"].forEach((item) => filterFormula.append(create("span", "", item))); const technicianAction = launchBasButton(project, "project-bas-filter-action"); technicianAction.textContent = "FILTER REPLACED"; technicianAction.setAttribute("aria-label", "Open live BAS filter replacement action"); filter.append(filterFormula, create("p", "project-case-lead", "The current BAS evaluates NORMAL, WATCH, SERVICE DUE and FAULT condition states. Increasing restriction can raise differential pressure and affect airflow. After confirmed service in the live BAS, runtime and condition reset and a service timestamp is recorded."), technicianAction);

    const conditionMaintenance = sectionShell("17", "CONDITION-BASED MAINTENANCE", "Diagnostics use cautious language when available points indicate a developing issue.");
    const conditionFlow = create("div", "project-bas-condition-flow"); ["HIGH FAN COMMAND", "LOW AIRFLOW", "HIGH FILTER DELTA P", "DIAGNOSTIC INDICATION", "POSSIBLE AIRFLOW RESTRICTION"].forEach((item) => conditionFlow.append(create("span", "", item))); conditionMaintenance.append(conditionFlow, create("p", "project-case-scope-lead", "Possible indication - check the equipment. The BAS does not claim a definitive mechanical diagnosis from limited signals."));

    const energy = sectionShell("18", "ENERGY MANAGEMENT", "Current calculated loads are separate from simulated historical utility values.");
    const energyGrid = create("div", "project-bas-energy-grid"); [["CURRENT ELECTRICAL DEMAND", "kW"], ["ELECTRICITY TODAY", "kWh"], ["ELECTRICITY THIS MONTH", "kWh"], ["ELECTRICITY THIS YEAR", "kWh"], ["NATURAL GAS FLOW", "m3/h"], ["GAS TODAY", "m3"], ["GAS THIS MONTH", "m3"], ["GAS THIS YEAR", "m3"]].forEach(([title, unit]) => { const item = create("article", ""); item.append(create("span", "", title), create("b", "", unit)); energyGrid.append(item); }); energy.append(energyGrid, create("p", "project-case-scope-lead", "SIMULATED HISTORICAL DATA: today, month and year totals are prototype history values, not utility-meter measurements from a real house. The current BAS also exposes peak demand, HVAC electrical load, HVAC energy share, equipment runtime, compressor starts, furnace starts and fan runtime."));

    const dataTypes = sectionShell("19", "BAS DATA TYPES", "Point labels make the provenance of a value visible to the operator.");
    const dataGrid = create("div", "project-bas-data-types"); [["LIVE", "Real external data"], ["SIM", "Simulated building / sensor data"], ["CALC", "Calculated value"], ["CMD", "Controller command"], ["FB", "Equipment / sensor feedback"]].forEach(([type, copy]) => { const card = create("article", ""); card.append(create("b", "", type), create("span", "", copy)); dataGrid.append(card); }); dataTypes.append(dataGrid);

    const interfaceSection = sectionShell("20", "CURRENT BAS INTERFACE", "The live application is reused directly; no fabricated BAS screenshot is shown.");
    const interfaceMap = create("div", "project-bas-interface-map"); [["LEFT", "Collapsible BAS information and control sections"], ["RIGHT", "Residential Digital Twin visualization area"], ["TOP", "System alarm and event status"]].forEach(([side, copy]) => { const card = create("article", ""); card.append(create("b", "", side), create("span", "", copy)); interfaceMap.append(card); }); interfaceSection.append(interfaceMap, create("p", "project-case-lead", "Use SIMULATE to open the actual existing BAS page and inspect the active operator interface."));

    const twin = sectionShell("21", "RESIDENTIAL DIGITAL TWIN", "The graphical residential visualization area is reserved for the next implementation phase.");
    const twinStatus = create("div", "project-bas-twin-status"); twinStatus.append(create("b", "", "DIGITAL TWIN VISUALIZATION"), create("span", "", "IN DEVELOPMENT")); twin.append(twinStatus, create("p", "project-case-lead", "The existing BAS contains the visualization mount and live readout area. Animated house and resident visualization features are not represented as complete."));

    const statusMatrix = sectionShell("22", "PROJECT DEVELOPMENT STATUS", "Only current BAS functionality is marked as operational.");
    const matrix = create("div", "project-bas-status-matrix"); [["BAS HMI", "FUNCTIONAL"], ["RULE-BASED CONTROL", "FUNCTIONAL"], ["SETPOINT CONTROL", "FUNCTIONAL"], ["OCCUPANCY SCHEDULE", "FUNCTIONAL"], ["IAQ MONITORING", "FUNCTIONAL / SIM + LIVE OUTDOOR"], ["ENERGY MONITORING", "FUNCTIONAL / SIM HISTORY"], ["FAULT ENGINE", "FUNCTIONAL / SIM"], ["PREVENTIVE MAINTENANCE", "FUNCTIONAL / SIM"], ["2D DIGITAL TWIN", "IN DEVELOPMENT"]].forEach(([name, state]) => { const row = create("article", state === "IN DEVELOPMENT" ? "is-development" : ""); row.append(create("span", "", name), create("b", "", state)); matrix.append(row); }); statusMatrix.append(matrix);

    const value = sectionShell("23", "ENGINEERING VALUE", "A portfolio prototype focused on transparent building-automation concepts.");
    const valueList = create("ul", "project-case-matters"); ["HVAC control", "Building automation", "HMI design", "Sensors", "Actuators", "Rule-based control", "Indoor air quality", "Energy management", "Alarm management", "Preventive maintenance", "Condition monitoring"].forEach((item) => valueList.append(create("li", "", item))); value.append(valueList);

    const relationship = sectionShell("24", "PROJECT RELATIONSHIP", "This prototype remains distinct from the academic predictive-control capstone.");
    const relationshipGrid = create("div", "project-bas-card-grid"); [["PROJECT 01", "AI-Based Predictive HVAC Control - academic MATLAB simulation / predictive control."], ["PROJECT 03", "Residential HVAC BAS - interactive rule-based building automation prototype."]].forEach(([title, copy]) => { const card = create("article", ""); card.append(create("h3", "", title), create("p", "", copy)); relationshipGrid.append(card); }); relationship.append(relationshipGrid, create("p", "project-case-scope-lead", "The projects serve different purposes. They may be compared or integrated later, but are not merged in this implementation."));

    const cta = create("section", "project-case-final-cta");
    const ctaActions = create("div", "project-case-cta-actions");
    const projectTwo = button("PROJECT 02", "project-case-related-button"); projectTwo.setAttribute("aria-label", "Open Project 02 Engineering Lab"); projectTwo.addEventListener("click", () => switchProject("engineering-lab", projectTwo));
    const allProjects = button("ALL PROJECTS", "project-case-related-button"); allProjects.addEventListener("click", () => returnToLibrary()); ctaActions.append(projectTwo, allProjects);
    cta.append(label("25 / LIVE OPERATOR WORKSPACE"), create("h2", "", "EXPLORE THE BAS"), create("p", "", "Monitor building conditions, adjust HVAC setpoints, inspect equipment status and observe the rule-based control system respond."), launchBasButton(project, "project-simulate--final"), create("p", "project-case-label", "LAUNCH INTERACTIVE BAS"), ctaActions);

    shell.append(header, hero, overview, objective, architecture, environment, hvacControl, setpoints, occupancy, iaq, sensors, actuators, safety, faults, events, maintenance, filter, conditionMaintenance, energy, dataTypes, interfaceSection, twin, statusMatrix, value, relationship, cta);
    root.append(shell);
  }

  function renderProject(project, root) {
    if (project.caseStudy === "residential-bas") { renderResidentialBasProject(project, root); return; }
    if (project.caseStudy === "engineering-lab") { renderEngineeringLabProject(project, root); return; }
    root.replaceChildren();
    const shell = create("article", "project-case-shell");
    const header = create("header", "project-case-topbar");
    const back = button("ALL PROJECTS", "project-case-back");
    back.setAttribute("aria-label", "Return to Projects browser");
    back.addEventListener("click", () => returnToLibrary());
    const identity = create("div", "project-case-identity");
    identity.append(create("p", "", "AUTOMATION CONTROL / PROJECT CASE STUDY"), create("strong", "", `PROJECT / ${project.number}`));
    const status = create("div", "project-case-status");
    status.append(create("span", "", ""), create("b", "", "PROJECT ONLINE"), create("small", "", project.status));
    header.append(back, identity, status);

    const hero = create("section", "project-case-hero");
    const heroCopy = create("div", "project-case-hero-copy");
    heroCopy.append(label(`PROJECT ${project.number}`));
    const heading = create("h1", ""); project.titleLines.forEach((line) => heading.append(create("span", "", line))); heroCopy.append(heading, create("p", "project-case-subtitle", project.subtitle), tagList(project.tags));
    const heroActions = create("div", "project-case-hero-actions");
    heroActions.append(simulateButton(root, project, "project-simulate--hero"), create("p", "", "INTERACTIVE PROTOTYPE / AI HVAC DIGITAL SIMULATION"));
    heroCopy.append(heroActions);
    const heroMeta = create("aside", "project-case-hero-meta");
    heroMeta.append(label("PROJECT METADATA"), factGrid([["TYPE", project.type], ["PLATFORM", project.platform], ["DOMAIN", project.domain], ["STATUS", project.status]]));
    hero.append(heroCopy, heroMeta);

    const overview = sectionShell("02", "PROJECT OVERVIEW", "Simulation-based proof of concept for predictive residential HVAC control.");
    overview.append(create("p", "project-case-lead", project.overview));

    const problem = sectionShell("03", "THE PROBLEM", "Why a predictive HVAC-control path was explored.");
    const problemList = create("ul", "project-case-problem-list");
    project.problem.forEach((item, index) => { const row = create("li", ""); row.append(create("span", "", `0${index + 1}`), create("p", "", item)); problemList.append(row); });
    problem.append(problemList);

    const context = sectionShell("04", "CASE STUDY ENVIRONMENT", "Simulation and project basis - not a physical installation.");
    const contextLayout = create("div", "project-case-two-column");
    contextLayout.append(factGrid([["INSTITUTION", "CONESTOGA COLLEGE"], ["CAMPUS", "DOON CAMPUS"], ["REFERENCE AREA", "DO-DME-E WING - AC01"], ["PROJECT BASIS", "SIMULATION CASE STUDY"]]), imageFrame(project.images.context, "Conestoga College Doon Campus HVAC case-study layout", "SOURCE VISUAL / Case-study HVAC reference area", "project-case-figure--context"));
    context.append(contextLayout);

    const idea = sectionShell("05", "THE IDEA", "Predict demand before a purely reactive system needs to respond.");
    const ideaGrid = create("div", "project-case-idea-grid");
    [["INPUTS", "Temperature, humidity, time-related data, and occupancy / environmental patterns."], ["PREDICTION", "A MATLAB predictive AI model forecasts HVAC or thermal demand."], ["CONTROL USE", "The forecast informs a VFD-oriented motor-speed / control response."], ["MONITORING", "Temperature, humidity, power behavior, and energy response are evaluated in simulation."]].forEach(([title, copy], index) => { const card = create("article", "project-case-idea-card"); card.append(create("span", "", String(index + 1).padStart(2, "0")), create("h3", "", title), create("p", "", copy)); ideaGrid.append(card); });
    idea.append(ideaGrid);

    const architecture = sectionShell("06", "SYSTEM ARCHITECTURE", "Predictive-control flow used by the simulation concept.");
    const flow = create("ol", "project-case-flow");
    project.architecture.forEach((item, index) => { const step = create("li", ""); step.append(create("span", "", String(index + 1).padStart(2, "0")), create("b", "", item)); flow.append(step); });
    architecture.append(flow);

    const ai = sectionShell("07", "AI PREDICTION", "Predictive-model role within the MATLAB simulation.");
    const aiGrid = create("div", "project-case-ai-grid");
    [["INPUTS", ["Weather / environmental conditions", "Occupancy patterns", "Time-related data"]], ["MODEL", ["Predictive AI model in MATLAB", "Neural-network-style predictive concept"]], ["OUTPUT", ["Forecast HVAC / thermal demand", "Prediction used before a control response"]], ["CONTROL USE", ["Informs motor-speed / control response", "Supports proactive HVAC operation"]]].forEach(([title, items]) => { const card = create("article", "project-case-ai-card"); const list = create("ul", ""); items.forEach((item) => list.append(create("li", "", item))); card.append(create("h3", "", title), list); aiGrid.append(card); });
    ai.append(aiGrid);

    const control = sectionShell("08", "HVAC / VFD CONTROL LOGIC", "The forecast is used to support a motor-speed control decision.");
    const controlGrid = create("div", "project-case-control-grid");
    [["01", "FORECAST", "Environmental and occupancy-related patterns inform an HVAC demand forecast."], ["02", "DECIDE", "The predicted thermal load informs the control strategy before significant indoor drift."], ["03", "COMMAND", "A VFD-oriented concept adjusts HVAC motor speed rather than relying on fixed-speed operation."], ["04", "OBSERVE", "Temperature, power behavior, energy response, and humidity are monitored in simulation."]].forEach(([number, title, copy]) => { const card = create("article", "project-case-control-card"); card.append(create("span", "", number), create("h3", "", title), create("p", "", copy)); controlGrid.append(card); });
    control.append(controlGrid);

    const matlab = sectionShell("09", "MATLAB SIMULATION", "The capstone was developed and evaluated as a MATLAB simulation.");
    const matlabGrid = create("div", "project-case-two-column project-case-two-column--matlab");
    const matlabCopy = create("div", "project-case-copy-list");
    matlabCopy.append(create("p", "", "The MATLAB environment was used to model the HVAC / control concept, implement the predictive model, evaluate environmental scenarios, compare strategies, and monitor temperature, energy, boiler, and chiller behavior."));
    const list = create("ul", ""); ["Model the HVAC / control system", "Evaluate environmental scenarios", "Implement the predictive AI model", "Compare control strategies", "Monitor temperature response", "Evaluate energy and boiler / chiller power behavior"].forEach((item) => list.append(create("li", "", item))); matlabCopy.append(list);
    matlabGrid.append(matlabCopy, imageFrame(project.images.matlab, "MATLAB simulation environment supplied in capstone presentation", "SOURCE VISUAL / MATLAB simulation environment"));
    matlab.append(matlabGrid);

    const comparison = sectionShell("10", "CONTROL METHOD COMPARISON", "Comparison categories stated in the capstone presentation.");
    const tableWrap = create("div", "project-case-table-wrap");
    const table = document.createElement("table");
    const head = document.createElement("thead"); const headRow = document.createElement("tr"); ["FEATURE / METHOD", "CONSTANT-SPEED", "PID", "BAS (RULE-BASED)", "AI PREDICTIVE"].forEach((item) => headRow.append(create("th", "", item))); head.append(headRow); table.append(head);
    const body = document.createElement("tbody"); [["Control type", "Manual / fixed", "Feedback / reactive", "Rule-based / scheduled", "Forecast-based / proactive"], ["Response", "Slow", "Moderate", "Trigger / schedule dependent", "Anticipatory"], ["Adaptability", "None", "Limited", "Pre-programmed", "Dynamic / predictive"], ["Environmental awareness", "None", "Limited", "Partial", "Weather / occupancy-aware"], ["Learning ability", "None", "None", "None", "Data-informed predictive model"]].forEach((row) => { const tr = document.createElement("tr"); row.forEach((cell, index) => tr.append(create(index === 0 ? "th" : "td", "", cell))); body.append(tr); }); table.append(body); tableWrap.append(table); comparison.append(tableWrap);

    const metrics = sectionShell("11", "EVALUATION METRICS", "Measures identified for the traditional and AI-based simulation paths.");
    const metricList = create("div", "project-case-metrics"); project.metrics.forEach((item, index) => { const metric = create("article", ""); metric.append(create("span", "", String(index + 1).padStart(2, "0")), create("p", "", item)); metricList.append(metric); }); metrics.append(metricList);

    const realtime = sectionShell("12", "REAL-TIME SIMULATION TEST", "Dynamic simulation observation of HVAC response and control output.");
    const realtimeGrid = create("div", "project-case-two-column");
    const realtimeCopy = create("div", "project-case-copy-list"); realtimeCopy.append(create("p", "", "The presentation includes real-time simulation stages used to observe temperature behavior, humidity, boiler / chiller demand, HVAC response, and predictive-control output."));
    const realtimeList = create("ul", ""); ["Temperature behavior", "Humidity", "Boiler and chiller demand", "HVAC response", "Predictive-control output"].forEach((item) => realtimeList.append(create("li", "", item))); realtimeCopy.append(realtimeList);
    realtimeGrid.append(realtimeCopy, imageFrame(project.images.output, "Simulation output graphs supplied in capstone presentation", "SOURCE VISUAL / Simulation output monitoring")); realtime.append(realtimeGrid);

    const results = sectionShell("13", "SIMULATION RESULTS", "Qualitative simulation outcomes reported in the capstone conclusion.");
    const resultsList = create("div", "project-case-results"); ["Predictive control responded proactively to environmental changes in the simulation concept.", "The project comparison indicated advantages over constant-speed, PID, and rule-based strategies.", "Indoor comfort was maintained within approximately +/-1 C according to the capstone.", "The concept reduced unnecessary motor operation / cycling while supporting energy-efficient HVAC response."].forEach((item) => { const row = create("p", ""); row.append(create("span", "", "VALID"), document.createTextNode(item)); resultsList.append(row); }); results.append(resultsList);

    const outcome = sectionShell("14", "PROJECT OUTCOME", "AI prediction plus VFD-based motor-control concept.");
    outcome.append(create("p", "project-case-lead", "The capstone demonstrated, in simulation, the potential value of combining AI prediction with VFD-based HVAC motor control for proactive response, thermal comfort, improved energy efficiency, and reduced unnecessary motor operation. Ontario environmental and weather context informed the model basis."));

    const scope = sectionShell("15", "PROJECT SCOPE", "Simulation-based proof of concept.");
    const scopeLead = create("p", "project-case-scope-lead", "This project was developed and tested as a MATLAB-based simulation and academic capstone proof of concept. It did not include a physical HVAC installation or field-deployed hardware.");
    const scopeGrid = create("div", "project-case-scope-grid");
    [["COMPLETED IN PROJECT", ["System concept", "MATLAB HVAC simulation", "AI predictive model", "Predictive control logic", "Control-method comparison", "Simulation testing", "Performance evaluation", "Capstone presentation"]], ["OUTSIDE CAPSTONE SCOPE", ["Physical HVAC prototype", "VFD hardware integration", "Building installation", "Physical sensor network", "Field testing"]]].forEach(([title, items], index) => { const block = create("section", `project-case-scope-block ${index ? "is-outside" : ""}`); const list = create("ul", ""); items.forEach((item) => list.append(create("li", "", item))); block.append(create("h3", "", title), list); scopeGrid.append(block); });
    scope.append(scopeLead, scopeGrid);

    const technologies = sectionShell("16", "TOOLS / TECHNOLOGIES", "Capstone-supported methods and platforms."); technologies.append(tagList(project.technologies));
    const matters = sectionShell("17", "WHY IT MATTERS", "Predictive-control relevance for efficient HVAC and smart buildings.");
    const mattersList = create("ul", "project-case-matters"); ["HVAC energy efficiency", "Reducing unnecessary cycling", "Adapting to changing environmental conditions", "Predictive rather than purely reactive control", "Smart-building potential", "Future integration with IoT / BAS systems"].forEach((item) => mattersList.append(create("li", "", item))); matters.append(mattersList);

    const cta = create("section", "project-case-final-cta"); cta.append(label("18 / INTERACTIVE PROTOTYPE"), create("h2", "", "AI HVAC DIGITAL SIMULATION"), create("p", "", "Explore a browser-based reconstruction of the MATLAB AI-HVAC capstone, including environmental scenarios, predictive-control architecture, HVAC outputs and simulation data."), simulateButton(root, project, "project-simulate--final"));

    const notice = create("section", "project-simulation-notice"); notice.hidden = true;

    shell.append(header, hero, overview, problem, context, idea, architecture, ai, control, matlab, comparison, metrics, realtime, results, outcome, scope, technologies, matters, cta, notice); root.append(shell);
  }

  function renderBrowser(container) {
    if (!container) return;
    container.replaceChildren();
    const browser = create("section", "projects-browser");
    const kicker = create("p", "content-kicker", "PROJECT DATABASE");
    const title = create("h2", "", "Projects"); title.id = "contentTitle";
    const headline = create("p", "projects-browser-headline", "ENGINEERING PROJECT ARCHIVE");
    const copy = create("p", "projects-browser-summary", "Browse current and future automation, HVAC, PLC, control, electrical, and software project records.");
    const summary = create("div", "projects-browser-summary-grid");
    summary.append(create("span", "", `${String(PROJECTS.length).padStart(2, "0")} ACTIVE RECORD${PROJECTS.length === 1 ? "" : "S"}`), create("span", "", "DATABASE ONLINE"));
    const open = button("OPEN PROJECT LIBRARY", "projects-browser-open"); open.addEventListener("click", () => openLibrary(open));
    const index = create("section", "projects-browser-index"); index.append(create("p", "projects-browser-headline", "AVAILABLE RECORDS"));
    const list = create("ol", "");
    PROJECTS.forEach((project) => { const item = create("li", ""); item.append(create("span", "", `${project.number}  ${project.title.toUpperCase()}`), create("span", "", project.browserStatus || "COMPLETED")); list.append(item); });
    index.append(list);
    browser.append(kicker, title, headline, copy, summary, open, index); container.append(browser);
  }

  function renderLibraryCards(grid) {
    const matches = libraryState.activeFilter === "ALL" ? PROJECTS : PROJECTS.filter((project) => project.categories.includes(libraryState.activeFilter));
    if (!matches.length) {
      grid.append(create("p", "projects-library-empty", `NO ${libraryState.activeFilter} PROJECT RECORDS ARE AVAILABLE YET.`));
      return;
    }
    matches.forEach((project) => {
      const card = create("article", "projects-library-card");
      const cardTop = create("header", "projects-library-card-top");
      cardTop.append(create("span", "", `PROJECT ${project.number}`), create("b", "", project.cardStatus || "COMPLETED / SIMULATION TESTED"));
      const title = create("h2", "", project.title.toUpperCase());
      const description = create("p", "", project.libraryDescription);
      const categories = tagList(project.tags);
      const open = button("OPEN PROJECT", "projects-library-open");
      open.addEventListener("click", () => openProject(project.id, open));
      card.append(cardTop, title, description, categories, open);
      grid.append(card);
    });
  }

  function renderLibrary(root) {
    root.replaceChildren();
    const shell = create("article", "projects-library-shell");
    const topbar = create("header", "projects-library-topbar");
    const home = button("HOME", "projects-library-home");
    home.setAttribute("aria-label", "Return to home dashboard");
    home.addEventListener("click", () => closeLibrary());
    const identity = create("div", "projects-library-identity");
    identity.append(create("p", "", "AUTOMATION CONTROL / PROJECT LIBRARY"), create("strong", "", "ENGINEERING PROJECT ARCHIVE"));
    const status = create("div", "projects-library-status");
    status.append(create("span", "", ""), create("b", "", "PROJECT DATABASE"), create("small", "", "ONLINE"));
    topbar.append(home, identity, status);

    const hero = create("section", "projects-library-hero");
    hero.append(create("p", "projects-library-kicker", "PROJECTS"), create("h1", "", "ENGINEERING PROJECT ARCHIVE"), create("p", "", "A collection of automation, HVAC, PLC, control, electrical, and software engineering projects."));

    const filters = create("div", "projects-library-filters");
    filters.setAttribute("aria-label", "Project category filters");
    ["ALL", "HVAC", "PLC", "AUTOMATION", "CONTROL", "ELECTRICAL", "SOFTWARE"].forEach((filter) => {
      const action = button(filter, "projects-library-filter");
      action.dataset.projectFilter = filter;
      action.setAttribute("aria-pressed", String(filter === libraryState.activeFilter));
      action.addEventListener("click", () => { libraryState.activeFilter = filter; renderLibrary(root); window.requestAnimationFrame(() => root.querySelector(`[data-project-filter="${filter}"]`)?.focus({ preventScroll: true })); });
      filters.append(action);
    });

    const grid = create("section", "projects-library-grid");
    grid.setAttribute("aria-label", "Engineering project records");
    renderLibraryCards(grid);
    shell.append(topbar, hero, filters, grid);
    root.append(shell);
  }

  function hideProject(restoreFocus = true) {
    if (!pageState.open || !pageState.root) return;
    pageState.root.removeEventListener("keydown", pageState.onKeydown);
    pageState.root.replaceChildren(); pageState.root.classList.remove("is-open"); pageState.root.setAttribute("aria-hidden", "true"); document.body.classList.remove("is-project-case-open"); document.documentElement.classList.remove("is-project-case-open"); pageState.open = false; pageState.directRoute = false; pageState.project = null;
    if (restoreFocus && pageState.returnFocus instanceof HTMLElement && document.contains(pageState.returnFocus)) window.setTimeout(() => pageState.returnFocus.focus({ preventScroll: true }), 0);
  }
  function hideLibrary(restoreFocus = true) {
    if (!libraryState.open || !libraryState.root) return;
    libraryState.root.removeEventListener("keydown", libraryState.onKeydown);
    libraryState.root.replaceChildren(); libraryState.root.classList.remove("is-open"); libraryState.root.setAttribute("aria-hidden", "true"); document.body.classList.remove("is-project-library-open"); document.documentElement.classList.remove("is-project-library-open"); libraryState.open = false; libraryState.directRoute = false;
    if (restoreFocus && libraryState.returnFocus instanceof HTMLElement && document.contains(libraryState.returnFocus)) window.setTimeout(() => libraryState.returnFocus.focus({ preventScroll: true }), 0);
  }
  function closeLibrary(options = {}) {
    if (!libraryState.open) return;
    if (pageState.open) hideProject(false);
    if (options.history !== false && location.hash === "#projects" && !libraryState.directRoute) { history.back(); return; }
    hideLibrary(options.restoreFocus !== false);
    if (options.history !== false && location.hash === "#projects") history.replaceState({ section: "home" }, "", "#home");
  }
  function openLibrary(trigger, options = {}) {
    const root = document.getElementById("projectsLibrary");
    if (!root) return;
    if (libraryState.open) return;
    libraryState.root = root; libraryState.returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement; libraryState.directRoute = options.directRoute === true; libraryState.open = true;
    root.classList.add("is-open"); root.setAttribute("aria-hidden", "false"); document.body.classList.add("is-project-library-open"); document.documentElement.classList.add("is-project-library-open"); root.scrollTop = 0;
    libraryState.onKeydown = (event) => { if (event.key !== "Escape") return; event.preventDefault(); event.stopPropagation(); closeLibrary(); };
    root.addEventListener("keydown", libraryState.onKeydown); renderLibrary(root);
    if (options.history !== false && location.hash !== "#projects") history.pushState({ section: "projects" }, "", "#projects");
    window.requestAnimationFrame(() => root.querySelector(".projects-library-home")?.focus({ preventScroll: true }));
  }
  function returnToLibrary() {
    if (!pageState.open) { openLibrary(); return; }
    if (location.hash === pageState.project?.projectRoute && !pageState.directRoute) { history.back(); return; }
    hideProject(false);
    if (!libraryState.open) openLibrary(undefined, { history: false, directRoute: true });
    if (location.hash !== "#projects") history.replaceState({ section: "projects" }, "", "#projects");
    window.requestAnimationFrame(() => libraryState.root?.querySelector(".projects-library-open")?.focus({ preventScroll: true }));
  }
  function closeProject(options = {}) {
    if (!pageState.open) return;
    if (options.history !== false) { returnToLibrary(); return; }
    hideProject(options.restoreFocus !== false);
  }
  function openProject(id, trigger, options = {}) {
    const project = projectById(id); const root = document.getElementById("projectCaseStudy");
    if (!project || !root || pageState.open) return;
    pageState.root = root; pageState.returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement; pageState.directRoute = options.directRoute === true; pageState.project = project; pageState.open = true;
    root.classList.add("is-open"); root.setAttribute("aria-hidden", "false"); document.body.classList.add("is-project-case-open"); document.documentElement.classList.add("is-project-case-open");
    pageState.onKeydown = (event) => { if (event.key !== "Escape") return; const notice = root.querySelector(".project-simulation-notice"); if (notice && !notice.hidden) { hideSimulationNotice(root); return; } event.preventDefault(); event.stopPropagation(); closeProject(); };
    root.addEventListener("keydown", pageState.onKeydown); renderProject(project, root);
    if (options.history !== false && location.hash !== project.projectRoute) history.pushState({ section: `project:${project.id}` }, "", project.projectRoute);
    window.requestAnimationFrame(() => root.querySelector(".project-case-back")?.focus({ preventScroll: true }));
  }
  function switchProject(id, trigger) {
    if (pageState.open) hideProject(false);
    openProject(id, trigger);
  }
  return { projects: PROJECTS, renderBrowser, openLibrary, closeLibrary, isLibraryOpen: () => libraryState.open, openProject, closeProject, isOpen: () => pageState.open, activeProject: () => pageState.project, projectForRoute: projectByRoute, switchProject };
})();
