/* Visitor-facing AI HVAC capstone prototype: real scenario inputs plus deterministic reconstruction. */
window.AiHvacSimulation = (() => {
  const ROUTE = "#project-ai-hvac-simulation";
  const PROJECT_ROUTE = "#project-ai-hvac";
  const PHYSICS_TICK_MS = 1000;
  const WEATHER_REFRESH_MS = 15 * 60 * 1000;
  const MODEL = Object.freeze({
    floorAreaM2: 120, ceilingHeightM: 2.5, volumeM3: 300,
    envelopeUaWPerK: 180, thermalCapacitanceJPerK: 5000000,
    heatingCapacityW: 12000, coolingCapacityW: 10000,
    proportionalGainPctPerK: 20, deadbandC: 0.25, internalStepSeconds: 5,
  });
  const LOCATION = Object.freeze({ name: "Kitchener, ON", timezone: "America/Toronto", latitude: 43.4516, longitude: -80.4925 });
  const WEATHER_CODES = Object.freeze({ 0: "CLEAR", 1: "MAINLY CLEAR", 2: "PARTLY CLOUDY", 3: "OVERCAST", 45: "FOG", 48: "RIME FOG", 51: "LIGHT DRIZZLE", 53: "DRIZZLE", 55: "DENSE DRIZZLE", 61: "LIGHT RAIN", 63: "RAIN", 65: "HEAVY RAIN", 71: "LIGHT SNOW", 73: "SNOW", 75: "HEAVY SNOW", 80: "RAIN SHOWERS", 81: "RAIN SHOWERS", 82: "HEAVY SHOWERS", 95: "THUNDERSTORM" });
  const MAX_HISTORY = 8641;
  const SCENARIOS = Object.freeze({
    current: { label: "CURRENT", kind: "current", file: null },
    winter: { label: "WINTER", kind: "winter", file: "assets/data/ai-hvac/log_low_temp.csv" },
    summer: { label: "SUMMER", kind: "summer", file: "assets/data/ai-hvac/log_high_temp.csv" },
  });
  const RANGES = Object.freeze({ "30": 30, "60": 60, "360": 360, "720": 720 });
  const state = {
    active: false, scenario: "current", source: null, sourceRows: 0,
    setpoint: 22, roomTemp: 20, roomHumidity: 50, integral: 0,
    previousError: 2, energyKwh: 0, simulationSeconds: 0, graphSeconds: 0, history: [], projection: 22,
    playing: false, speed: 60, range: 60, timer: 0, weatherTimer: 0, weatherRequest: null,
    lastLiveWeather: null, loadToken: 0,
  };
  let ui;

  const create = (tag, className, text) => {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const button = (text, className) => {
    const node = create("button", className, text);
    node.type = "button";
    return node;
  };
  const number = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const fixed = (value, digits = 1) => Number.isFinite(value) ? value.toFixed(digits) : "--";

  function parseCsv(text) {
    const lines = text.replace(/^\uFEFF/, "").trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(",").map((item) => item.trim());
    return lines.slice(1).map((line) => {
      const values = line.split(",");
      return Object.fromEntries(headers.map((header, index) => [header, values[index]?.trim() ?? ""]));
    }).filter((row) => Number.isFinite(Number(row.temperature)) && Number.isFinite(Number(row.humidity)));
  }

  function calculateStep(model, outsideTemp, setpoint, deltaSeconds = MODEL.internalStepSeconds) {
    const error = setpoint - model.roomTemp;
    let boiler = 0;
    let chiller = 0;
    const envelopeHeat = MODEL.envelopeUaWPerK * (outsideTemp - model.roomTemp);
    if (error > MODEL.deadbandC) {
      const holdingDemand = Math.max(0, -envelopeHeat) / MODEL.heatingCapacityW * 100;
      boiler = Math.min(100, holdingDemand + MODEL.proportionalGainPctPerK * error);
    } else if (error < -MODEL.deadbandC) {
      const holdingDemand = Math.max(0, envelopeHeat) / MODEL.coolingCapacityW * 100;
      chiller = Math.min(100, holdingDemand + MODEL.proportionalGainPctPerK * Math.abs(error));
    } else if (envelopeHeat < 0) {
      boiler = Math.min(100, -envelopeHeat / MODEL.heatingCapacityW * 100);
    } else if (envelopeHeat > 0) {
      chiller = Math.min(100, envelopeHeat / MODEL.coolingCapacityW * 100);
    }
    const fan = boiler > 0 || chiller > 0 ? 100 : 0;
    const heatingPower = MODEL.heatingCapacityW * boiler / 100;
    const coolingPower = MODEL.coolingCapacityW * chiller / 100;
    const netHeat = envelopeHeat + heatingPower - coolingPower;
    const delta = netHeat * deltaSeconds / MODEL.thermalCapacitanceJPerK;
    const energyJ = (heatingPower + coolingPower / 3 + 100 * fan / 100) * deltaSeconds;
    return {
      roomTemp: model.roomTemp + delta,
      energyKwh: model.energyKwh + energyJ / 3600000,
      boiler, chiller, fan, externalHeat: envelopeHeat, netHeat,
      mode: boiler > 0 ? "heating" : chiller > 0 ? "cooling" : "stable",
    };
  }

  function simulateDuration(model, durationSeconds, outsideTemp, setpoint) {
    let remaining = durationSeconds;
    let result = { ...model, boiler: 0, chiller: 0, fan: 0, externalHeat: 0, mode: "stable" };
    while (remaining > 0) {
      const delta = Math.min(MODEL.internalStepSeconds, remaining);
      result = calculateStep(result, outsideTemp, setpoint, delta);
      remaining -= delta;
    }
    return result;
  }

  function projectOneHour(roomTemp, energyKwh, outsideTemp, setpoint) {
    return simulateDuration({ roomTemp, energyKwh }, 3600, outsideTemp, setpoint).roomTemp;
  }

  function stop() {
    state.playing = false;
    window.clearInterval(state.timer);
    state.timer = 0;
    updateControls();
  }

  function resetModel() {
    stop();
    state.roomTemp = state.scenario === "winter" ? 20 : state.scenario === "summer" ? 24 : Math.max(20, Math.min(22, state.setpoint));
    state.roomHumidity = 50;
    state.energyKwh = 0;
    state.simulationSeconds = 0;
    state.graphSeconds = 0;
    state.history = [];
    if (state.source) {
      state.previousError = state.setpoint - state.roomTemp;
      advance(true);
    }
  }

  function scenarioIcon() {
    if (state.scenario === "winter") return "❄";
    if (state.scenario === "summer") return "☀";
    const condition = state.source?.condition || "LIVE";
    if (/SNOW/.test(condition)) return "SNOW";
    if (/RAIN|DRIZZLE|SHOWER|THUNDER/.test(condition)) return "RAIN";
    if (/CLOUD|OVERCAST|FOG/.test(condition)) return "CLOUD";
    return "CLEAR";
  }

  function statusText(mode) {
    if (mode === "heating") return "HEATING TOWARD SETPOINT";
    if (mode === "cooling") return "COOLING TOWARD SETPOINT";
    return "SETPOINT STABLE";
  }

  function advance(initial = false) {
    if (!state.source || !ui) return;
    const simulatedDelta = initial ? 0 : state.speed;
    const result = simulatedDelta > 0
      ? simulateDuration(state, simulatedDelta, state.source.outsideTemp, state.setpoint)
      : calculateStep(state, state.source.outsideTemp, state.setpoint, 0);
    state.roomTemp = result.roomTemp;
    state.energyKwh = result.energyKwh;
    state.simulationSeconds += simulatedDelta;
    state.graphSeconds += simulatedDelta;
    const shouldSample = initial || state.graphSeconds >= 60;
    if (shouldSample) state.projection = projectOneHour(state.roomTemp, state.energyKwh, state.source.outsideTemp, state.setpoint);
    if (shouldSample) {
      state.history.push({ minute: state.simulationSeconds / 60, room: state.roomTemp, setpoint: state.setpoint, projection: state.projection,
        boiler: result.boiler, chiller: result.chiller, fan: result.fan });
      state.graphSeconds %= 60;
      if (state.history.length > MAX_HISTORY) state.history.shift();
    }
    updateView(result, state.projection);
  }

  function updateView(result, projection) {
    ui.setpointValue.textContent = `${fixed(state.setpoint)}°C`;
    ui.outdoorTemp.textContent = `${fixed(state.source.outsideTemp)}°C`;
    ui.outdoorHumidity.textContent = `${fixed(state.source.outsideHumidity, 0)}%`;
    ui.roomHumidity.textContent = `${fixed(state.roomHumidity, 0)}%`;
    ui.roomTemp.textContent = `${fixed(state.roomTemp)}°C`;
    ui.projectedTemp.textContent = `${fixed(projection)}°C`;
    ui.status.textContent = statusText(result.mode);
    ui.path.textContent = `${fixed(state.roomTemp)}°C  →  ${fixed(projection)}°C  →  TARGET ${fixed(state.setpoint)}°C`;
    const thermalDirection = state.source.outsideTemp > state.roomTemp ? "gain" : "loss";
    ui.house.className = `ai-hvac-house-scene is-${state.scenario} is-${result.mode} is-heat-${thermalDirection}`;
    ui.weatherIcon.textContent = scenarioIcon();
    ui.houseOutside.textContent = `${fixed(state.source.outsideTemp)}°C`;
    ui.houseInside.textContent = `${fixed(state.roomTemp)}°C`;
    ui.houseMode.textContent = result.mode === "stable" ? "STABLE" : result.mode.toUpperCase();
    ui.houseSetpoint.textContent = `SETPOINT ${fixed(state.setpoint)}°C`;
    const envelopeKw = result.externalHeat / 1000;
    ui.envelopeReadout.textContent = Math.abs(envelopeKw) < 0.05
      ? "ENVELOPE HEAT TRANSFER 0.0 kW · BALANCED"
      : `ENVELOPE HEAT TRANSFER ${envelopeKw > 0 ? "+" : "−"}${fixed(Math.abs(envelopeKw))} kW ${envelopeKw > 0 ? "HEAT GAIN" : "HEAT LOSS"}`;
    ui.boilerValue.textContent = `${fixed(result.boiler, 0)}%`;
    ui.chillerValue.textContent = `${fixed(result.chiller, 0)}%`;
    ui.fanValue.textContent = `${fixed(result.fan, 0)}%`;
    ui.elapsed.textContent = formatDuration(state.simulationSeconds);
    drawGraphs();
  }

  function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function visibleHistory() {
    return state.history.slice(-(state.range + 1));
  }

  function drawGraph() {
    if (!ui) return;
    const canvas = ui.graph;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio);
    canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d");
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const width = rect.width, height = rect.height;
    const left = 52, right = 16, top = 16, bottom = 31;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const points = visibleHistory();
    const raw = points.flatMap((point) => [point.room, point.setpoint, point.projection]);
    let minimum = Math.floor(Math.min(...raw, state.source.outsideTemp) - 1);
    let maximum = Math.ceil(Math.max(...raw, state.source.outsideTemp) + 1);
    if (maximum - minimum < 4) { minimum -= 2; maximum += 2; }

    context.clearRect(0, 0, width, height);
    context.fillStyle = "#030b13";
    context.fillRect(0, 0, width, height);
    context.font = "9px 'DM Mono', monospace";
    context.lineWidth = 1;
    for (let tick = minimum; tick <= maximum; tick += 1) {
      const y = top + (maximum - tick) / (maximum - minimum) * plotHeight;
      context.strokeStyle = "rgba(80,180,224,.13)";
      context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
      context.fillStyle = "#7da7b9"; context.fillText(`${tick}°C`, 8, y + 3);
    }
    const maxPoints = Math.max(20, Math.floor(plotWidth * 1.5));
    const stride = Math.max(1, Math.ceil(points.length / maxPoints));
    const sampled = points.filter((_, index) => index % stride === 0 || index === points.length - 1);
    const line = (key, color, dash = []) => {
      context.strokeStyle = color; context.lineWidth = key === "room" ? 2.2 : 1.7; context.setLineDash(dash); context.beginPath();
      sampled.forEach((point, index) => {
        const x = left + (sampled.length === 1 ? 0 : index / (sampled.length - 1)) * plotWidth;
        const y = top + (maximum - point[key]) / (maximum - minimum) * plotHeight;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      });
      context.stroke();
    };
    line("room", "#56e3ff");
    line("projection", "#b78cff", [5, 4]);
    line("setpoint", "#72e3a6", [3, 4]);
    context.setLineDash([]);
    context.fillStyle = "#6e99ab";
    context.fillText(`LATEST ${Math.min(state.range, Math.max(0, state.history.length - 1))} MIN`, left, height - 9);
  }

  function drawOutputGraph() {
    if (!ui) return;
    const canvas = ui.outputGraph;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(rect.width * ratio); canvas.height = Math.round(rect.height * ratio);
    const context = canvas.getContext("2d"); context.setTransform(ratio, 0, 0, ratio, 0, 0);
    const width = rect.width, height = rect.height, left = 52, right = 16, top = 16, bottom = 31;
    const plotWidth = width - left - right, plotHeight = height - top - bottom;
    const points = visibleHistory();
    context.clearRect(0, 0, width, height); context.fillStyle = "#030b13"; context.fillRect(0, 0, width, height);
    context.font = "9px 'DM Mono', monospace"; context.lineWidth = 1;
    for (let tick = 0; tick <= 100; tick += 10) {
      const y = top + (100 - tick) / 100 * plotHeight;
      context.strokeStyle = "rgba(80,180,224,.13)"; context.beginPath(); context.moveTo(left, y); context.lineTo(width - right, y); context.stroke();
      context.fillStyle = "#7da7b9"; context.fillText(`${tick}%`, 12, y + 3);
    }
    const stride = Math.max(1, Math.ceil(points.length / Math.max(20, Math.floor(plotWidth * 1.5))));
    const sampled = points.filter((_, index) => index % stride === 0 || index === points.length - 1);
    const line = (key, color, dash = []) => {
      context.strokeStyle = color; context.lineWidth = 2; context.setLineDash(dash); context.beginPath();
      sampled.forEach((point, index) => {
        const x = left + (sampled.length === 1 ? 0 : index / (sampled.length - 1)) * plotWidth;
        const y = top + (100 - point[key]) / 100 * plotHeight;
        if (index === 0) context.moveTo(x, y); else context.lineTo(x, y);
      }); context.stroke();
    };
    line("boiler", "#ffae67"); line("chiller", "#56e3ff"); line("fan", "#72e3a6", [3, 4]);
    context.setLineDash([]); context.fillStyle = "#6e99ab";
    context.fillText(`LATEST ${Math.min(state.range, Math.max(0, state.history.length - 1))} MIN`, left, height - 9);
  }

  function drawGraphs() { drawGraph(); drawOutputGraph(); }

  function updateControls() {
    if (!ui) return;
    ui.playPause.textContent = state.playing ? "PAUSE" : "PLAY";
    ui.playPause.setAttribute("aria-label", state.playing ? "Pause simulation" : "Play simulation");
    ui.speedButtons.forEach((node) => {
      const selected = Number(node.dataset.speed) === state.speed;
      node.classList.toggle("is-active", selected); node.setAttribute("aria-pressed", String(selected));
    });
  }

  function togglePlay() {
    if (state.playing) { stop(); return; }
    if (!state.source) return;
    state.playing = true;
    updateControls();
    state.timer = window.setInterval(() => advance(), PHYSICS_TICK_MS);
  }

  function weatherUrl() {
    const params = new URLSearchParams({
      latitude: String(LOCATION.latitude), longitude: String(LOCATION.longitude),
      current: "temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m",
      temperature_unit: "celsius", wind_speed_unit: "kmh", timezone: LOCATION.timezone,
    });
    return `https://api.open-meteo.com/v1/forecast?${params}`;
  }

  function applyLiveWeather(weather, reset = false) {
    state.source = { ...weather, file: "Open-Meteo current conditions" };
    state.sourceRows = 1;
    if (ui) {
      const stamp = weather.updatedAt instanceof Date && !Number.isNaN(weather.updatedAt.valueOf())
        ? weather.updatedAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) : "UNKNOWN";
      ui.source.textContent = `LIVE WEATHER // KITCHENER, ON · ${weather.condition} · LAST UPDATED ${stamp}`;
      ui.source.classList.toggle("is-stale", Boolean(weather.stale));
      ui.weatherState.textContent = weather.stale ? "DATA STALE" : "LIVE DATA";
    }
    if (reset) resetModel();
    else if (ui) advance(true);
  }

  async function refreshCurrentWeather({ reset = false } = {}) {
    if (state.weatherRequest) return state.weatherRequest;
    state.weatherRequest = (async () => {
      try {
        const response = await fetch(weatherUrl());
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        const current = payload.current;
        if (!current || !Number.isFinite(Number(current.temperature_2m))) throw new Error("Invalid weather response");
        const timestamp = new Date(current.time || Date.now());
        state.lastLiveWeather = {
          outsideTemp: number(current.temperature_2m), outsideHumidity: number(current.relative_humidity_2m, 50),
          condition: WEATHER_CODES[number(current.weather_code, -1)] || "CURRENT CONDITIONS",
          updatedAt: timestamp, fetchedAt: new Date(), stale: false,
        };
        if (state.active && state.scenario === "current") applyLiveWeather(state.lastLiveWeather, reset || !state.source);
      } catch (error) {
        console.warn("[AI HVAC] Live weather update unavailable", error);
        if (state.lastLiveWeather && state.active && state.scenario === "current") {
          state.lastLiveWeather.stale = true; applyLiveWeather(state.lastLiveWeather, reset);
        } else if (ui && state.scenario === "current") {
          ui.source.textContent = "LIVE WEATHER // KITCHENER, ON · WEATHER UPDATE UNAVAILABLE";
          ui.source.classList.add("is-stale"); ui.weatherState.textContent = "UNAVAILABLE";
        }
      } finally { state.weatherRequest = null; }
    })();
    return state.weatherRequest;
  }

  async function loadScenario(id) {
    const scenario = SCENARIOS[id];
    if (!scenario || !ui) return;
    const token = ++state.loadToken;
    stop();
    state.scenario = id;
    ui.scenarioButtons.forEach((node) => {
      const selected = node.dataset.scenario === id;
      node.classList.toggle("is-active", selected); node.setAttribute("aria-pressed", String(selected));
    });
    ui.source.textContent = id === "current" ? "LIVE WEATHER // KITCHENER, ON · UPDATING..." : "LOADING SCENARIO DATA...";
    ui.weatherState.textContent = id === "current" ? "UPDATING" : "CAPSTONE DATA";
    ui.source.classList.remove("is-stale");
    if (id === "current") {
      if (state.lastLiveWeather) applyLiveWeather(state.lastLiveWeather, true);
      await refreshCurrentWeather({ reset: !state.lastLiveWeather });
      return;
    }
    try {
      const response = await fetch(scenario.file);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = parseCsv(await response.text());
      if (token !== state.loadToken) return;
      if (!rows.length) throw new Error("No usable environmental records");
      const first = rows[0];
      state.source = {
        outsideTemp: number(first.temperature), outsideHumidity: number(first.humidity),
        time: first.localTime || first.utcTime || "SOURCE RECORD 01", file: scenario.file,
      };
      state.sourceRows = rows.length;
      ui.source.textContent = `${scenario.label} // CAPSTONE ${scenario.kind.toUpperCase()}-WEATHER SCENARIO · ${rows.length} SOURCE RECORDS`;
      resetModel();
    } catch (error) {
      if (token !== state.loadToken) return;
      console.error("[AI HVAC] Scenario data failed to load", error);
      state.source = null;
      ui.source.textContent = "SCENARIO DATA UNAVAILABLE";
    }
  }

  function metric(label, className) {
    const node = create("article", `ai-hvac-metric ${className}`);
    const value = create("strong", "", "--");
    node.append(create("span", "", label), value);
    return { node, value };
  }

  function buildHouse() {
    const scene = create("section", "ai-hvac-house-scene is-current is-stable");
    const outside = create("div", "ai-hvac-house-outside");
    const weatherIcon = create("span", "ai-hvac-weather-icon", "LIVE");
    const houseOutside = create("strong", "", "--");
    const weatherState = create("em", "ai-hvac-weather-state", "UPDATING");
    outside.append(weatherIcon, create("small", "", "OUTSIDE"), houseOutside, weatherState);
    const house = create("div", "ai-hvac-house");
    house.append(create("div", "ai-hvac-roof", ""), create("div", "ai-hvac-home-body", ""));
    house.append(create("div", "ai-hvac-window ai-hvac-window-left", ""), create("div", "ai-hvac-window ai-hvac-window-right", ""),
      create("div", "ai-hvac-floor", ""), create("div", "ai-hvac-supply-vent", "SUPPLY"), create("div", "ai-hvac-return-vent", "RETURN"),
      create("i", "ai-hvac-thermal-arrow ai-hvac-thermal-left", "→"), create("i", "ai-hvac-thermal-arrow ai-hvac-thermal-right", "←"));
    const interior = create("div", "ai-hvac-house-interior");
    const houseInside = create("strong", "", "--");
    const houseMode = create("small", "", "HVAC STABLE");
    interior.append(create("span", "", "INDOOR"), houseInside, houseMode);
    const houseSetpoint = create("span", "ai-hvac-house-setpoint", "SETPOINT --");
    const homeLabel = create("span", "ai-hvac-home-label", "REPRESENTATIVE HOME · 120 m² / 300 m³");
    house.append(interior, houseSetpoint, homeLabel, create("i", "ai-hvac-airflow ai-hvac-airflow-one", "→"), create("i", "ai-hvac-airflow ai-hvac-airflow-two", "→"));
    const envelopeReadout = create("p", "ai-hvac-envelope-readout", "ENVELOPE HEAT TRANSFER --");
    scene.append(outside, house, envelopeReadout);
    return { scene, weatherIcon, weatherState, houseOutside, houseInside, houseMode, houseSetpoint, envelopeReadout };
  }

  function details() {
    const node = document.createElement("details");
    node.className = "ai-hvac-technical";
    const summary = create("summary", "", "TECHNICAL MODEL DETAILS");
    const grid = create("div", "ai-hvac-technical-grid");
    [
      ["INPUT", "12 features × 10-step sequence"], ["NORMALIZATION", "MATLAB mapminmax"],
      ["NETWORK", "2 × 128-unit LSTM layers"], ["DROPOUT", "0.30 after each LSTM"],
      ["TARGET", "RoomTemp_C / next sequence step"], ["CONTROL", "Kp 20 / ±0.25°C deadband"],
      ["TRAINING", "simulated_hvac_data.csv / 1-minute rows"], ["WEB MODE", "Source-derived deterministic reconstruction"],
    ].forEach(([label, value]) => { const item = create("div", ""); item.append(create("span", "", label), create("strong", "", value)); grid.append(item); });
    [
      ["MODEL", "REPRESENTATIVE RESIDENTIAL THERMAL MODEL"], ["FLOOR AREA", "120 m²"],
      ["CEILING HEIGHT", "2.5 m"], ["CONDITIONED VOLUME", "300 m³"],
      ["ENVELOPE UA", "180 W/K"], ["THERMAL CAPACITANCE", "5,000,000 J/K"],
      ["HEATING CAPACITY", "12,000 W"], ["COOLING CAPACITY", "10,000 W"],
    ].forEach(([label, value]) => { const item = create("div", ""); item.append(create("span", "", label), create("strong", "", value)); grid.append(item); });
    const features = create("p", "", "FEATURES / RoomTemp_C · RoomHumidity_Pct · OutsideTemp_C · OutsideHumidity_Pct · Boiler_Power_Pct · Chiller_Power_Pct · Fan_Speed_Pct · Setpoint_C · Sin_Hour · Cos_Hour · Sin_Day_of_Week · Cos_Day_of_Week");
    const note = create("p", "ai-hvac-tech-note", "CURRENT WEATHER / Live Kitchener environmental input. ROOM RESPONSE / Whole-home lumped thermal model: C × dTin/dt = UA × (Tout − Tin) + QHVAC. HVAC CONTROL / Source-derived Kp with envelope-load compensation and mutually exclusive heating or cooling. The original MATLAB capstone used a smaller room-level simulation. This representative residential browser model demonstrates physics-based whole-home response; it is not a building-load calculation or professional HVAC sizing. LSTM / Original MATLAB capstone architecture; the serialized network is not executed in this browser. 1-HOUR PROJECTION / A separate cloned state is simulated forward using the same physics and controller.");
    node.append(summary, grid, features, note);
    return node;
  }

  function build() {
    const shell = create("article", "ai-hvac-shell");
    const ribbon = create("header", "ai-hvac-ribbon");
    const back = button("← BACK TO PROJECT", "ai-hvac-back");
    back.addEventListener("click", () => { window.location.hash = PROJECT_ROUTE; });
    const identity = create("div", "");
    identity.append(create("strong", "", "VIRTUAL SIMULATION PROTOTYPE"), create("small", "", "Derived from the original MATLAB AI-HVAC capstone model"));
    ribbon.append(back, identity, create("span", "ai-hvac-ribbon-status", "MODEL RECONSTRUCTION / READY"));

    const tabs = create("nav", "ai-hvac-weather-tabs");
    tabs.setAttribute("aria-label", "Select weather scenario");
    const scenarioButtons = [];
    Object.entries(SCENARIOS).forEach(([id, scenario]) => {
      const action = button(scenario.label, "ai-hvac-weather-tab");
      action.dataset.scenario = id; action.addEventListener("click", () => loadScenario(id));
      scenarioButtons.push(action); tabs.append(action);
    });

    const main = create("main", "ai-hvac-main");
    const setpointPanel = create("section", "ai-hvac-setpoint-panel");
    setpointPanel.append(create("p", "ai-hvac-eyebrow", "TEMPERATURE SETPOINT CONTROL"), create("h1", "", "DESIRED ROOM TEMPERATURE"));
    const setpointValue = create("strong", "ai-hvac-setpoint-value", "22.0°C");
    const slider = document.createElement("input");
    slider.className = "ai-hvac-slider"; slider.type = "range"; slider.min = "18"; slider.max = "26"; slider.step = "0.5"; slider.value = String(state.setpoint);
    slider.setAttribute("aria-label", "Desired room temperature");
    const scale = create("div", "ai-hvac-slider-scale"); scale.append(create("span", "", "18°C"), create("span", "", "26°C"));
    const simpleReadouts = create("div", "ai-hvac-simple-readouts");
    const outdoor = metric("OUTDOOR TEMPERATURE", "");
    const humidity = metric("OUTDOOR HUMIDITY", "");
    const roomHumidity = metric("ROOM HUMIDITY", "");
    simpleReadouts.append(outdoor.node, humidity.node, roomHumidity.node);
    const source = create("p", "ai-hvac-source-line", "LOADING SCENARIO DATA...");
    setpointPanel.append(setpointValue, slider, scale, simpleReadouts, source);

    const visualPanel = create("section", "ai-hvac-visual-panel");
    const temperatures = create("div", "ai-hvac-temperatures");
    const room = metric("CURRENT ROOM", "is-room");
    const projected = metric("1-HOUR ROOM PROJECTION", "is-projected");
    projected.node.append(create("small", "ai-hvac-metric-note", "PHYSICS + HVAC CONTROL FORECAST"));
    temperatures.append(room.node, projected.node);
    const status = create("strong", "ai-hvac-comfort-status", "SETPOINT STABLE");
    const path = create("p", "ai-hvac-temperature-path", "-- → -- → TARGET 22.0°C");
    const house = buildHouse();
    visualPanel.append(temperatures, status, path, house.scene, create("p", "ai-hvac-projection-note", "1-HOUR ROOM PROJECTION / Separate forward solution of the representative thermal model and HVAC controller. This is not browser LSTM inference."));
    main.append(setpointPanel, visualPanel);

    const graphPanel = create("section", "ai-hvac-graph-panel");
    const graphHead = create("header", "ai-hvac-graph-head");
    const graphTitle = create("div", ""); graphTitle.append(create("p", "ai-hvac-eyebrow", "SIMULATION OUTPUT"), create("h2", "", "TEMPERATURE TREND"));
    const ranges = create("div", "ai-hvac-ranges"); const rangeButtons = [];
    [[30, "30 MIN"], [60, "1 HR"], [360, "6 HR"], [720, "12 HR"]].forEach(([minutes, label]) => {
      const action = button(label, "ai-hvac-range"); action.dataset.range = String(minutes);
      action.addEventListener("click", () => { state.range = minutes; rangeButtons.forEach((node) => { const selected = node === action; node.classList.toggle("is-active", selected); node.setAttribute("aria-pressed", String(selected)); }); drawGraphs(); });
      rangeButtons.push(action); ranges.append(action);
    });
    graphHead.append(graphTitle, ranges);
    const legend = create("div", "ai-hvac-legend");
    [["ROOM TEMPERATURE", "room"], ["1-HOUR PROJECTION", "projection"], ["SETPOINT", "setpoint"]].forEach(([label, key]) => { const item = create("span", "", label); item.dataset.line = key; legend.append(item); });
    const graph = document.createElement("canvas"); graph.className = "ai-hvac-graph"; graph.setAttribute("aria-label", "Temperature trend graph with one degree Celsius ticks");
    const outputHead = create("header", "ai-hvac-output-head");
    const outputTitle = create("div", ""); outputTitle.append(create("p", "ai-hvac-eyebrow", "ACTUAL CONTROLLER DEMAND"), create("h2", "", "HVAC CONTROL OUTPUT"));
    const outputValues = create("div", "ai-hvac-output-values");
    const boilerValue = create("strong", "is-boiler", "0%"); const chillerValue = create("strong", "is-chiller", "0%"); const fanValue = create("strong", "is-fan", "0%");
    [["BOILER", boilerValue], ["CHILLER", chillerValue], ["FAN", fanValue]].forEach(([label, value]) => { const item = create("span", ""); item.append(create("small", "", label), value); outputValues.append(item); });
    outputHead.append(outputTitle, outputValues);
    const outputLegend = create("div", "ai-hvac-legend ai-hvac-output-legend");
    [["BOILER OUTPUT", "boiler"], ["CHILLER OUTPUT", "chiller"], ["FAN OUTPUT", "fan"]].forEach(([label, key]) => { const item = create("span", "", label); item.dataset.line = key; outputLegend.append(item); });
    const outputGraph = document.createElement("canvas"); outputGraph.className = "ai-hvac-graph ai-hvac-output-graph"; outputGraph.setAttribute("aria-label", "HVAC boiler, chiller, and fan output graph from zero to one hundred percent");
    const controls = create("div", "ai-hvac-controls");
    const playPause = button("PLAY", "ai-hvac-control"), reset = button("RESET", "ai-hvac-control");
    playPause.addEventListener("click", togglePlay); reset.addEventListener("click", resetModel);
    const speedButtons = [];
    [1, 10, 60].forEach((speed) => { const action = button(`${speed}X`, "ai-hvac-speed"); action.dataset.speed = String(speed); action.addEventListener("click", () => { const resume = state.playing; stop(); state.speed = speed; updateControls(); if (resume) togglePlay(); }); speedButtons.push(action); });
    const elapsed = create("strong", "", "00:00:00");
    controls.append(playPause, reset, create("span", "", "SIMULATION RATE"), ...speedButtons, create("span", "", "SIMULATION CLOCK"), elapsed);
    graphPanel.append(graphHead, legend, graph, outputHead, outputLegend, outputGraph, controls);

    shell.append(ribbon, tabs, main, graphPanel, details());
    ui = { scenarioButtons, setpointValue, slider, outdoorTemp: outdoor.value, outdoorHumidity: humidity.value,
      roomHumidity: roomHumidity.value, source, roomTemp: room.value, projectedTemp: projected.value,
      status, path, house: house.scene, weatherIcon: house.weatherIcon, weatherState: house.weatherState, houseOutside: house.houseOutside,
      houseInside: house.houseInside, houseMode: house.houseMode, houseSetpoint: house.houseSetpoint, envelopeReadout: house.envelopeReadout,
      graph, outputGraph, boilerValue, chillerValue, fanValue, rangeButtons,
      playPause, speedButtons, elapsed };
    slider.addEventListener("input", () => {
      state.setpoint = number(slider.value, 22);
      state.history.forEach((point) => { point.setpoint = state.setpoint; });
      if (state.source) {
        const projection = projectOneHour(state.roomTemp, state.energyKwh, state.source.outsideTemp, state.setpoint);
        state.projection = projection;
        if (state.history.length) state.history[state.history.length - 1].projection = projection;
        const currentMode = calculateStep(state, state.source.outsideTemp, state.setpoint);
        updateView(currentMode, projection);
      }
    });
    rangeButtons.find((node) => Number(node.dataset.range) === state.range)?.click();
    updateControls();
    return shell;
  }

  function open(options = {}) {
    const root = document.getElementById("aiHvacSimulation");
    if (!root || state.active) return;
    state.active = true;
    root.replaceChildren(build()); root.classList.add("is-open"); root.setAttribute("aria-hidden", "false");
    document.documentElement.classList.add("is-ai-hvac-open"); document.body.classList.add("is-ai-hvac-open");
    if (options.history !== false && location.hash !== ROUTE) history.pushState({ section: "ai-hvac-simulation" }, "", ROUTE);
    loadScenario("current");
    window.clearInterval(state.weatherTimer);
    state.weatherTimer = window.setInterval(() => {
      if (state.active && state.scenario === "current") refreshCurrentWeather();
    }, WEATHER_REFRESH_MS);
    window.requestAnimationFrame(() => root.querySelector(".ai-hvac-back")?.focus({ preventScroll: true }));
  }

  function close() {
    if (!state.active) return;
    stop(); window.clearInterval(state.weatherTimer); state.weatherTimer = 0; state.loadToken += 1; state.active = false;
    const root = document.getElementById("aiHvacSimulation");
    root?.replaceChildren(); root?.classList.remove("is-open"); root?.setAttribute("aria-hidden", "true");
    document.documentElement.classList.remove("is-ai-hvac-open"); document.body.classList.remove("is-ai-hvac-open"); ui = null;
  }

  function syncRoute() {
    if (location.hash === ROUTE) {
      if (window.BASSystem?.isOpen()) window.BASSystem.close({ history: false, restoreFocus: false });
      if (window.EngineeringLab?.isOpen()) window.EngineeringLab.closeLab({ history: false, restoreFocus: false });
      if (window.ProjectsSystem?.isOpen()) window.ProjectsSystem.closeProject({ history: false, restoreFocus: false });
      if (window.ProjectsSystem?.isLibraryOpen()) window.ProjectsSystem.closeLibrary({ history: false, restoreFocus: false });
      open({ history: false });
    } else close();
  }

  window.addEventListener("resize", () => { if (state.active) drawGraphs(); });
  window.addEventListener("hashchange", syncRoute); window.addEventListener("popstate", syncRoute);
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", syncRoute, { once: true }); else syncRoute();
  return { open, close, isOpen: () => state.active, route: ROUTE };
})();
