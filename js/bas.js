/* Residential BAS digital-twin baseline: deterministic, rule-based, and lightweight. */
window.BASSystem = (() => {
  const CONFIG = Object.freeze({
    location: Object.freeze({ name: "Kitchener, Ontario", timezone: "America/Toronto", latitude: 43.4516, longitude: -80.4925 }),
    weatherRefreshMs: 15 * 60 * 1000,
    setpoints: Object.freeze({ occupied: Object.freeze({ heat: 21, cool: 23 }), unoccupied: Object.freeze({ heat: 18, cool: 26 }), night: Object.freeze({ heat: 19, cool: 25 }) }),
    setpointLimits: Object.freeze({ heat: Object.freeze({ min: 15, max: 24, step: 0.5 }), cool: Object.freeze({ min: 20, max: 30, step: 0.5 }), minimumSeparation: 1 }),
    control: Object.freeze({ deadband: 0.35, actuatorFollowRate: 38, maxStepSeconds: 5 }),
    thermal: Object.freeze({ outdoorCoupling: 0.0018, hvacResponse: 0.025, maxStepSeconds: 5 }),
    iaq: Object.freeze({ co2: Object.freeze({ good: 800, moderate: 1100 }), voc: Object.freeze({ good: 350, moderate: 650 }), pm25: Object.freeze({ good: 12, moderate: 35 }), outdoorAqi: Object.freeze({ good: 50, moderate: 100 }), outdoorPm25: Object.freeze({ good: 12, moderate: 35 }) }),
    ventilation: Object.freeze({ normal: 25, elevated: 45, high: 70, restricted: 35, unavailable: 40 }),
    maintenance: Object.freeze({ filter: Object.freeze({ cleanDp: 72, watchDp: 110, serviceDp: 150, initialDp: 118, initialRuntimeHours: 612, dpRisePerFanHour: 0.085, lowAirflowPercent: 76 }), fanServiceHours: 1000, airflowRestrictionDp: 108, lowAirflowPercent: 76 }),
    diagnostics: Object.freeze({ filterWarningSeconds: 5, valveMismatchSeconds: 3, sensorCommunicationSeconds: 4, falseFlameSeconds: 3, energyWarningKw: 7.5, energyResetKw: 6.8 }),
    safety: Object.freeze({ gasAlarmPpm: 1000, gasResetPpm: 750, coAlarmPpm: 35, coResetPpm: 20, draftProveSeconds: 2, ignitionSeconds: 1, flameProveSeconds: 2, postPurgeSeconds: 8, gasValveFollowSeconds: 1, maxSensorAgeSeconds: 5 }),
    energyRates: Object.freeze({ electricityRate: null, gasRate: null }),
    energyHistory: Object.freeze({ electricityTodayKwh: 18.7, electricityMonthKwh: 412, electricityYearKwh: 4826, gasTodayM3: 3.7, gasMonthM3: 68.4, gasYearM3: 742, peakTodayKw: 6.84, peakMonthKw: 8.22 })
  });
  const WEATHER_CODES = Object.freeze({ 0: "CLEAR", 1: "MAINLY CLEAR", 2: "PARTLY CLOUDY", 3: "OVERCAST", 45: "FOG", 48: "RIME FOG", 51: "LIGHT DRIZZLE", 53: "DRIZZLE", 55: "DENSE DRIZZLE", 61: "LIGHT RAIN", 63: "RAIN", 65: "HEAVY RAIN", 71: "LIGHT SNOW", 73: "SNOW", 75: "HEAVY SNOW", 80: "RAIN SHOWERS", 81: "RAIN SHOWERS", 82: "HEAVY SHOWERS", 95: "THUNDERSTORM" });
  const EQUIPMENT_META = Object.freeze([
    { id: "heating", name: "FURNACE / HEATING SYSTEM", kind: "THERMAL" },
    { id: "cooling", name: "AC / HEAT PUMP", kind: "THERMAL" },
    { id: "fan", name: "SUPPLY FAN / BLOWER", kind: "AIRFLOW" },
    { id: "filter", name: "AIR FILTER", kind: "FILTER" },
    { id: "airflow", name: "DUCT / AIRFLOW", kind: "AIRFLOW" },
    { id: "oaDamper", name: "OUTDOOR AIR DAMPER", kind: "ACTUATOR" },
    { id: "zoneDamper", name: "ZONE DAMPER", kind: "ACTUATOR" },
    { id: "heatingValve", name: "HEATING VALVE", kind: "ACTUATOR" },
    { id: "coolingValve", name: "COOLING VALVE", kind: "ACTUATOR" },
    { id: "sensors", name: "TEMPERATURE / HUMIDITY / IAQ SENSORS", kind: "SENSORS" }
  ]);
  const state = {
    time: new Date(),
    weather: { status: "CONNECTING", temperature: null, humidity: null, condition: null, wind: null, updatedAt: null },
    outdoorAirQuality: { status: "CONNECTING", aqi: null, pm25: null, quality: "DATA UNAVAILABLE", updatedAt: null },
    schedule: { type: "WEEKDAY", period: "EVENING OCCUPIED", mode: "occupied", occupancy: 2, nextEvent: "23:00 NIGHT SETBACK" },
    setpointMode: "SCHEDULE",
    manualSetpoints: { heat: 21, cool: 23 },
    activeSetpoints: { heat: 21, cool: 23, source: "SCHEDULE" },
    indoorTemp: 22.1,
    indoorHumidity: 46,
    co2: 615,
    voc: 220,
    pm25: 7,
    indoorIAQ: { status: "GOOD", primaryCause: "NONE" },
    ventilation: { demand: "NORMAL", strategy: "STANDARD VENTILATION", warning: "NONE" },
    supplyTemp: 20.1,
    returnTemp: 22.6,
    hvac: { mode: "VENTILATION", heating: false, cooling: false, heatingDemand: 0, coolingDemand: 0, supplyFan: "RUNNING", fanCommand: 28, fanStatus: "RUNNING", compressor: false, heatingStage: 0, coolingStage: 0, runtimeSeconds: 0, compressorRuntimeHours: 324, compressorStarts: 14, compressorStartsToday: 14, startsThisHour: 0, fanStartsToday: 9, fanStarts: 442, lastCompressorState: false, lastFanState: true },
    actuators: { oaDamperCommand: 25, oaDamperPosition: 25, raDamperCommand: 75, raDamperPosition: 75, heatingValveCommand: 0, heatingValvePosition: 0, coolingValveCommand: 0, coolingValvePosition: 0, zoneDamperCommand: 54, zoneDamperPosition: 54 },
    maintenance: { filterDp: 118, filterLoad: 0.46, filterRuntimeHours: 612, fanRuntimeHours: 486, systemRuntimeHours: 780, lastFilterService: null, simulatedElapsedSeconds: 0 },
    safety: { gasLevel: 0, gasSensorQuality: "GOOD", gasSensorCommunication: "ONLINE", gasSensorHealth: "NORMAL", gasSelfTest: "PASS", gasLastUpdate: new Date(), coLevel: 0, coSensorQuality: "GOOD", coSensorCommunication: "ONLINE", coSensorHealth: "NORMAL", coLastUpdate: new Date(), flameExpected: false, flameProven: false, flameSensorQuality: "GOOD", flameSensorHealth: "NORMAL", flameCurrent: 0, flameLastProof: null, inducerCommand: false, draftProof: false, ignitionCommand: false, gasValveCommand: false, gasValveFeedback: false, burnerState: "STANDBY", furnaceEnable: true, highLimit: "NORMAL", furnaceLockout: false, sequence: "STANDBY", sequenceSeconds: 0, postPurgeSeconds: 0, burnerRuntimeHours: 284, furnaceStartsToday: 7, furnaceStarts: 268, lastBurnerState: false },
    energy: { voltage: 240, current: 0, powerFactor: 0.92, power: 0, apparentPower: 0, totalHomePower: 0, hvacPower: 0, fanPower: 0, compressorPower: 0, inducerPower: 0, controlsPower: 0.03, gasFlow: 0, electricityToday: 18.7, electricityMonth: 412, electricityYear: 4826, gasToday: 3.7, gasMonth: 68.4, gasYear: 742, peakDemandToday: 6.84, peakDemandMonth: 8.22, fanEnergy: 126, electricPowerHistory: [], gasFlowHistory: [], indoorTempHistory: [], outdoorTempHistory: [], hvacDemandHistory: [] },
    sensorHealth: {},
    diagnosticTimers: {},
    events: [],
    eventCounts: { ALARM: 0, WARNING: 0, FAULT: 0, MAINTENANCE: 0 },
    equipmentHealth: [],
    maintenanceAlerts: [],
    alarms: 0,
    lastUpdate: performance.now()
  };
  const expandedSections = new Set();
  const expandedEquipment = new Set();
  let eventDrawerFilter = null;
  let serviceConfirmOpen = false;
  let active = false;
  let directRoute = false;
  let returnFocus = null;
  let ticker = 0;
  let weatherRequest = null;
  let airQualityRequest = null;
  const twinState = { layer: "BOTH", view: "WHOLE", selected: "zt-hall" };
  const TWIN_LAYERS = Object.freeze(["HOME", "HVAC", "BAS", "BOTH"]);
  const TWIN_VIEWS = Object.freeze(["WHOLE", "HALL", "KITCHEN", "BEDROOM", "BASEMENT"]);

  const create = (tag, className, text) => { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; };
  const root = () => document.getElementById("basPage");
  const pad = (number) => String(number).padStart(2, "0");
  const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
  const follow = (current, target, rate, deltaSeconds) => current + Math.sign(target - current) * Math.min(Math.abs(target - current), rate * deltaSeconds);
  const torontoParts = (date = new Date()) => Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: CONFIG.location.timezone, hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", weekday: "long", month: "short", day: "2-digit", year: "numeric" }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, part.value]));
  const formatClock = (date = state.time) => { const parts = torontoParts(date); return { time: `${parts.hour}:${parts.minute}:${parts.second}`, day: parts.weekday.toUpperCase(), date: `${parts.month.toUpperCase()} ${parts.day} ${parts.year}`, minutes: Number(parts.hour) * 60 + Number(parts.minute), weekday: !["SATURDAY", "SUNDAY"].includes(parts.weekday.toUpperCase()) }; };
  const displayNumber = (value, unit = "", decimals = 1) => value == null ? "—" : `${Number(value).toFixed(decimals)}${unit ? ` ${unit}` : ""}`;
  const displayPercent = (value) => value == null ? "—" : `${Math.round(value)} %`;
  const displayRuntime = (seconds) => `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(Math.floor(seconds % 60))}`;
  const displayHours = (hours) => `${Math.round(hours)} h`;

  function resolveSchedule(clock) {
    const minutes = clock.minutes;
    if (clock.weekday) {
      if (minutes < 390) return { type: "WEEKDAY", period: "NIGHT SETBACK", mode: "night", occupancy: 0, nextEvent: "06:30 MORNING / OCCUPIED" };
      if (minutes < 510) return { type: "WEEKDAY", period: "MORNING / OCCUPIED", mode: "occupied", occupancy: 2, nextEvent: "08:30 UNOCCUPIED" };
      if (minutes < 1020) return { type: "WEEKDAY", period: "UNOCCUPIED", mode: "unoccupied", occupancy: 0, nextEvent: "17:00 OCCUPIED" };
      if (minutes < 1380) return { type: "WEEKDAY", period: "EVENING OCCUPIED", mode: "occupied", occupancy: 2, nextEvent: "23:00 NIGHT SETBACK" };
      return { type: "WEEKDAY", period: "NIGHT SETBACK", mode: "night", occupancy: 0, nextEvent: "06:30 MORNING / OCCUPIED" };
    }
    if (minutes < 480) return { type: "WEEKEND", period: "NIGHT SETBACK", mode: "night", occupancy: 0, nextEvent: "08:00 OCCUPIED" };
    if (minutes < 1410) return { type: "WEEKEND", period: "OCCUPIED", mode: "occupied", occupancy: 2, nextEvent: "23:30 NIGHT SETBACK" };
    return { type: "WEEKEND", period: "NIGHT SETBACK", mode: "night", occupancy: 0, nextEvent: "08:00 OCCUPIED" };
  }

  function levelFor(value, thresholds) {
    if (value == null) return "UNAVAILABLE";
    if (value <= thresholds.good) return "GOOD";
    if (value <= thresholds.moderate) return "MODERATE";
    return "POOR";
  }

  function updateIaqState() {
    const readings = [
      { label: "CO₂ HIGH", level: levelFor(state.co2, CONFIG.iaq.co2), severity: state.co2 },
      { label: "VOC HIGH", level: levelFor(state.voc, CONFIG.iaq.voc), severity: state.voc },
      { label: "PM2.5 HIGH", level: levelFor(state.pm25, CONFIG.iaq.pm25), severity: state.pm25 }
    ];
    const rank = { GOOD: 0, MODERATE: 1, POOR: 2 };
    const primary = readings.slice().sort((a, b) => rank[b.level] - rank[a.level] || b.severity - a.severity)[0];
    state.indoorIAQ = { status: primary.level, primaryCause: primary.level === "GOOD" ? "NONE" : primary.label };
    const outdoorQuality = state.outdoorAirQuality.quality;
    const indoorStatus = state.indoorIAQ.status;
    if (indoorStatus === "GOOD") state.ventilation = { demand: "NORMAL", strategy: "STANDARD VENTILATION", warning: "NONE" };
    else if (outdoorQuality === "GOOD") state.ventilation = { demand: indoorStatus === "POOR" ? "HIGH" : "ELEVATED", strategy: "OUTDOOR AIR ENABLED", warning: "NONE" };
    else if (outdoorQuality === "POOR") state.ventilation = { demand: "LIMITED", strategy: "LIMITED OUTDOOR AIR", warning: "OUTDOOR AIR QUALITY RESTRICTING VENTILATION" };
    else state.ventilation = { demand: "CAUTIOUS", strategy: "OUTDOOR AQI UNAVAILABLE", warning: "OUTDOOR AIR DATA UNAVAILABLE" };
  }

  function ventilationCommand() {
    if (state.ventilation.demand === "HIGH") return CONFIG.ventilation.high;
    if (state.ventilation.demand === "ELEVATED") return CONFIG.ventilation.elevated;
    if (state.ventilation.demand === "LIMITED") return CONFIG.ventilation.restricted;
    if (state.ventilation.demand === "CAUTIOUS") return CONFIG.ventilation.unavailable;
    return state.schedule.occupancy ? CONFIG.ventilation.normal : 10;
  }

  function persisted(key, condition, seconds, deltaSeconds) {
    state.diagnosticTimers[key] = condition ? (state.diagnosticTimers[key] || 0) + deltaSeconds : 0;
    return state.diagnosticTimers[key] >= seconds;
  }

  function eventTimestamp(date = new Date()) {
    const clock = formatClock(date);
    return `${clock.time} / ${clock.date}`;
  }

  function syncEvent({ key, severity, equipment, code, description, active: isActive }) {
    const current = state.events.find((event) => event.key === key && event.status !== "CLEARED");
    if (isActive) {
      if (current) {
        current.severity = severity;
        current.equipment = equipment;
        current.code = code;
        current.description = description;
        return current;
      }
      const event = { id: `${key}-${Date.now()}`, key, severity, equipment, code, description, timestamp: new Date(), status: "ACTIVE", acknowledgedAt: null, clearedAt: null };
      state.events.unshift(event);
      return event;
    }
    if (current) { current.status = "CLEARED"; current.clearedAt = new Date(); }
    return current;
  }

  function recordInformation(equipment, code, description) {
    state.events.unshift({ id: `${code}-${Date.now()}`, key: `${code}-${Date.now()}`, severity: "INFO", equipment, code, description, timestamp: new Date(), status: "CLEARED", acknowledgedAt: new Date(), clearedAt: new Date() });
  }

  function acknowledgeEvent(id) {
    const event = state.events.find((item) => item.id === id);
    if (!event || event.status !== "ACTIVE") return;
    event.status = "ACKNOWLEDGED";
    event.acknowledgedAt = new Date();
    renderState();
  }

  function updateEventCounts() {
    state.eventCounts = ["ALARM", "WARNING", "FAULT", "MAINTENANCE"].reduce((counts, severity) => {
      counts[severity] = state.events.filter((event) => event.severity === severity && event.status !== "CLEARED").length;
      return counts;
    }, {});
  }

  function updateSensorHealth() {
    const s = state.safety;
    const now = new Date();
    if (s.gasSensorCommunication === "ONLINE") s.gasLastUpdate = now;
    if (s.coSensorCommunication === "ONLINE") s.coLastUpdate = now;
    s.gasSensorHealth = s.gasSensorCommunication === "ONLINE" && s.gasSensorQuality === "GOOD" ? "NORMAL" : "FAULT";
    s.coSensorHealth = s.coSensorCommunication === "ONLINE" && s.coSensorQuality === "GOOD" ? "NORMAL" : "FAULT";
    s.flameSensorHealth = s.flameSensorQuality === "GOOD" ? "NORMAL" : "FAULT";
    state.sensorHealth = {
      zone: { value: state.indoorTemp, quality: "GOOD", communication: "ONLINE", health: "NORMAL", updatedAt: now },
      co2: { value: state.co2, quality: "GOOD", communication: "ONLINE", health: "NORMAL", updatedAt: now },
      voc: { value: state.voc, quality: "GOOD", communication: "ONLINE", health: "NORMAL", updatedAt: now },
      pm25: { value: state.pm25, quality: "GOOD", communication: "ONLINE", health: "NORMAL", updatedAt: now },
      supply: { value: state.supplyTemp, quality: "GOOD", communication: "ONLINE", health: "NORMAL", updatedAt: now },
      return: { value: state.returnTemp, quality: "GOOD", communication: "ONLINE", health: "NORMAL", updatedAt: now },
      filter: { value: state.maintenance.filterDp, quality: "GOOD", communication: "ONLINE", health: "NORMAL", updatedAt: now },
      gas: { value: s.gasSensorHealth === "NORMAL" ? s.gasLevel : null, quality: s.gasSensorQuality, communication: s.gasSensorCommunication, health: s.gasSensorHealth, updatedAt: s.gasLastUpdate },
      co: { value: s.coSensorHealth === "NORMAL" ? s.coLevel : null, quality: s.coSensorQuality, communication: s.coSensorCommunication, health: s.coSensorHealth, updatedAt: s.coLastUpdate },
      flame: { value: s.flameProven, quality: s.flameSensorQuality, communication: "ONLINE", health: s.flameSensorHealth, updatedAt: now }
    };
  }

  function updateSafetySequence(deltaSeconds, heatRequested) {
    const s = state.safety;
    const dt = Math.min(deltaSeconds, CONFIG.thermal.maxStepSeconds);
    updateSensorHealth();
    const gasAlarm = s.gasSensorHealth === "NORMAL" && s.gasLevel >= CONFIG.safety.gasAlarmPpm;
    const coAlarm = s.coSensorHealth === "NORMAL" && s.coLevel >= CONFIG.safety.coAlarmPpm;
    const highLimitTrip = s.highLimit === "TRIPPED";
    if (gasAlarm || coAlarm || highLimitTrip) s.furnaceLockout = true;
    if (s.furnaceLockout) {
      s.sequence = "LOCKOUT";
      s.inducerCommand = false;
      s.draftProof = false;
      s.ignitionCommand = false;
      s.gasValveCommand = false;
      s.gasValveFeedback = false;
      s.flameExpected = false;
      s.flameProven = false;
      s.flameCurrent = 0;
      s.burnerState = "LOCKOUT";
      return;
    }
    if (heatRequested) {
      if (["STANDBY", "POST PURGE"].includes(s.sequence)) { s.sequence = "INDUCER ON"; s.sequenceSeconds = 0; s.furnaceStartsToday += 1; s.furnaceStarts += 1; }
      s.sequenceSeconds += dt;
      s.inducerCommand = true;
      if (s.sequence === "INDUCER ON") {
        if (s.sequenceSeconds >= CONFIG.safety.draftProveSeconds) { s.draftProof = true; s.sequence = "IGNITION"; s.sequenceSeconds = 0; }
      } else if (s.sequence === "IGNITION") {
        s.ignitionCommand = true;
        if (s.sequenceSeconds >= CONFIG.safety.ignitionSeconds) { s.gasValveCommand = true; s.sequence = "GAS VALVE OPEN"; s.sequenceSeconds = 0; }
      } else if (s.sequence === "GAS VALVE OPEN") {
        s.gasValveFeedback = s.gasValveCommand;
        s.flameExpected = s.gasValveCommand && s.draftProof;
        if (s.flameExpected && s.sequenceSeconds >= CONFIG.safety.flameProveSeconds) {
          s.flameProven = true;
          s.flameCurrent = 3.2;
          s.flameLastProof = new Date();
          s.burnerState = "HEATING ACTIVE";
          s.sequence = "HEATING ACTIVE";
          s.sequenceSeconds = 0;
        } else if (!s.flameExpected && s.sequenceSeconds >= CONFIG.safety.flameProveSeconds) {
          s.furnaceLockout = true;
          s.sequence = "LOCKOUT";
          s.gasValveCommand = false;
          s.gasValveFeedback = false;
          s.burnerState = "LOCKOUT";
        }
      } else if (s.sequence === "HEATING ACTIVE") {
        s.gasValveCommand = true;
        s.gasValveFeedback = true;
        s.flameExpected = true;
        s.flameProven = true;
        s.flameCurrent = 3.2;
        s.burnerState = "HEATING ACTIVE";
      }
    } else if (s.sequence === "HEATING ACTIVE" || s.gasValveCommand || s.flameProven) {
      s.gasValveCommand = false;
      s.gasValveFeedback = false;
      s.ignitionCommand = false;
      s.flameExpected = false;
      s.flameProven = false;
      s.flameCurrent = 0;
      s.burnerState = "POST PURGE";
      s.sequence = "POST PURGE";
      s.postPurgeSeconds = CONFIG.safety.postPurgeSeconds;
    } else if (s.sequence === "POST PURGE") {
      s.postPurgeSeconds = Math.max(0, s.postPurgeSeconds - dt);
      s.inducerCommand = s.postPurgeSeconds > 0;
      if (!s.inducerCommand) { s.sequence = "STANDBY"; s.draftProof = false; s.burnerState = "STANDBY"; }
    } else {
      s.sequence = "STANDBY";
      s.inducerCommand = false;
      s.draftProof = false;
      s.ignitionCommand = false;
      s.gasValveCommand = false;
      s.gasValveFeedback = false;
      s.flameExpected = false;
      s.flameProven = false;
      s.flameCurrent = 0;
      s.burnerState = "STANDBY";
    }
    if (s.burnerState === "HEATING ACTIVE") s.burnerRuntimeHours += dt / 3600;
  }

  function updateEnergy(deltaSeconds) {
    const s = state.safety;
    const e = state.energy;
    const dt = Math.min(deltaSeconds, CONFIG.thermal.maxStepSeconds);
    e.fanPower = state.hvac.fanCommand > 0 ? 0.08 + state.hvac.fanCommand / 100 * 0.54 : 0;
    e.compressorPower = state.hvac.compressor ? 2.4 : 0;
    e.inducerPower = s.inducerCommand ? 0.08 : 0;
    e.controlsPower = 0.03;
    e.hvacPower = e.fanPower + e.compressorPower + e.inducerPower + e.controlsPower;
    e.totalHomePower = 0.48 + (state.schedule.occupancy ? 0.23 : 0.08) + e.hvacPower;
    e.power = e.totalHomePower;
    e.apparentPower = e.power / e.powerFactor;
    e.current = e.apparentPower * 1000 / e.voltage;
    e.gasFlow = s.burnerState === "HEATING ACTIVE" && s.gasValveCommand ? Math.min(0.95, 0.42 + state.hvac.heatingDemand / 175) : 0;
    const hours = dt / 3600;
    const electricIncrement = e.power * hours;
    const gasIncrement = e.gasFlow * hours;
    e.electricityToday += electricIncrement;
    e.electricityMonth += electricIncrement;
    e.electricityYear += electricIncrement;
    e.gasToday += gasIncrement;
    e.gasMonth += gasIncrement;
    e.gasYear += gasIncrement;
    e.fanEnergy += e.fanPower * hours;
    e.peakDemandToday = Math.max(e.peakDemandToday, e.power);
    e.peakDemandMonth = Math.max(e.peakDemandMonth, e.power);
    const snapshot = (array, value) => { array.push({ at: Date.now(), value }); if (array.length > 120) array.shift(); };
    if (dt > 0) { snapshot(e.electricPowerHistory, e.power); snapshot(e.gasFlowHistory, e.gasFlow); snapshot(e.indoorTempHistory, state.indoorTemp); snapshot(e.outdoorTempHistory, state.weather.temperature); snapshot(e.hvacDemandHistory, Math.max(state.hvac.heatingDemand, state.hvac.coolingDemand)); }
  }

  function updateEventCenter(deltaSeconds) {
    const s = state.safety;
    const filterService = state.maintenance.filterDp >= CONFIG.maintenance.filter.serviceDp;
    const filterWatch = state.maintenance.filterDp >= CONFIG.maintenance.filter.watchDp || (state.hvac.fanCommand >= 55 && state.airflow < CONFIG.maintenance.filter.lowAirflowPercent);
    const filterWatchActive = persisted("filterRestriction", filterWatch, CONFIG.diagnostics.filterWarningSeconds, deltaSeconds);
    const gasSensorFault = persisted("gasSensor", s.gasSensorHealth === "FAULT", CONFIG.diagnostics.sensorCommunicationSeconds, deltaSeconds);
    const coSensorFault = persisted("coSensor", s.coSensorHealth === "FAULT", CONFIG.diagnostics.sensorCommunicationSeconds, deltaSeconds);
    const flameFailure = persisted("flameFailure", s.flameExpected && !s.flameProven, CONFIG.safety.flameProveSeconds, deltaSeconds);
    const falseFlame = persisted("falseFlame", !s.gasValveCommand && s.flameProven, CONFIG.diagnostics.falseFlameSeconds, deltaSeconds);
    const valveClosedOpen = persisted("gasValveClosedOpen", !s.gasValveCommand && s.gasValveFeedback, CONFIG.diagnostics.valveMismatchSeconds, deltaSeconds);
    const valveOpenClosed = persisted("gasValveOpenClosed", s.gasValveCommand && !s.gasValveFeedback, CONFIG.diagnostics.valveMismatchSeconds, deltaSeconds);
    const draftFailure = persisted("draftFailure", s.inducerCommand && !s.draftProof && s.sequenceSeconds >= CONFIG.safety.draftProveSeconds, CONFIG.diagnostics.valveMismatchSeconds, deltaSeconds);
    const energyWarning = persisted("energyWarning", state.energy.power >= CONFIG.diagnostics.energyWarningKw, CONFIG.diagnostics.valveMismatchSeconds, deltaSeconds);
    syncEvent({ key: "FILTER_RESTRICTION", severity: filterService ? "MAINTENANCE" : "WARNING", equipment: "AIR FILTER", code: filterService ? "FILTER_SERVICE_DUE" : "FILTER_DP_RISING", description: filterService ? "FILTER SERVICE RECOMMENDED" : "FILTER DIFFERENTIAL PRESSURE RISING", active: filterService || filterWatchActive });
    syncEvent({ key: "GAS_SENSOR_COMMS", severity: "FAULT", equipment: "GAS SENSOR", code: "GAS_SENSOR_COMMS_LOST", description: "GAS SENSOR COMMUNICATION LOST", active: gasSensorFault });
    syncEvent({ key: "CO_SENSOR_COMMS", severity: "FAULT", equipment: "CO SENSOR", code: "CO_SENSOR_COMMS_LOST", description: "CO SENSOR COMMUNICATION LOST", active: coSensorFault });
    syncEvent({ key: "GAS_DETECTED", severity: "ALARM", equipment: "GAS DETECTOR", code: "GAS_DETECTED", description: "SIMULATED GAS LEVEL ABOVE SAFETY THRESHOLD", active: s.gasSensorHealth === "NORMAL" && s.gasLevel >= CONFIG.safety.gasAlarmPpm });
    syncEvent({ key: "CO_HIGH", severity: "ALARM", equipment: "CO DETECTOR", code: "CO_LEVEL_HIGH", description: "SIMULATED CARBON MONOXIDE LEVEL HIGH", active: s.coSensorHealth === "NORMAL" && s.coLevel >= CONFIG.safety.coAlarmPpm });
    syncEvent({ key: "FLAME_FAILURE", severity: "ALARM", equipment: "FURNACE", code: "FLAME_NOT_PROVEN", description: "BURNER FLAME NOT PROVEN", active: flameFailure });
    syncEvent({ key: "FALSE_FLAME", severity: "FAULT", equipment: "FLAME SENSOR", code: "FALSE_FLAME_SIGNAL", description: "CHECK FLAME SENSOR / CONTROL CIRCUIT", active: falseFlame });
    syncEvent({ key: "GAS_VALVE_OPEN", severity: "ALARM", equipment: "GAS VALVE", code: "GAS_VALVE_OPEN_WHEN_CLOSED", description: "GAS VALVE FEEDBACK OPEN WHILE COMMAND CLOSED", active: valveClosedOpen });
    syncEvent({ key: "GAS_VALVE_CLOSED", severity: "FAULT", equipment: "GAS VALVE", code: "GAS_VALVE_NOT_FOLLOWING", description: "GAS VALVE FEEDBACK NOT FOLLOWING COMMAND", active: valveOpenClosed });
    syncEvent({ key: "DRAFT_NOT_PROVEN", severity: "FAULT", equipment: "DRAFT SWITCH", code: "DRAFT_NOT_PROVEN", description: "DRAFT / PRESSURE SWITCH NOT PROVEN", active: draftFailure });
    syncEvent({ key: "HIGH_LIMIT", severity: "ALARM", equipment: "FURNACE", code: "HIGH_LIMIT_TRIPPED", description: "FURNACE HIGH LIMIT TRIPPED", active: s.highLimit === "TRIPPED" });
    syncEvent({ key: "ENERGY_DEMAND", severity: "WARNING", equipment: "ELECTRICAL SERVICE", code: "ABNORMAL_ENERGY_DEMAND", description: "SIMULATED ELECTRICAL DEMAND ABOVE CONFIGURED THRESHOLD", active: energyWarning });
    updateEventCounts();
  }

  function resolveEquipmentHealth() {
    const actuatorFault = (command, position) => Math.abs(command - position) > 22;
    const mode = state.hvac.mode;
    const filterRestriction = state.maintenance.filterDp >= CONFIG.maintenance.filter.watchDp || (state.hvac.fanCommand >= 55 && state.airflow < CONFIG.maintenance.filter.lowAirflowPercent);
    const filterStatus = state.maintenance.filterDp >= CONFIG.maintenance.filter.serviceDp || (state.maintenance.filterRuntimeHours >= CONFIG.maintenance.fanServiceHours && filterRestriction) ? "SERVICE DUE" : filterRestriction ? "WATCH" : "NORMAL";
    const airflowStatus = state.hvac.fanCommand >= 55 && state.airflow < CONFIG.maintenance.lowAirflowPercent ? "WATCH" : "NORMAL";
    const sensorStatus = state.indoorTemp < 10 || state.indoorTemp > 35 || state.indoorHumidity < 10 || state.indoorHumidity > 90 ? "FAULT" : "NORMAL";
    const fanStatus = state.hvac.fanCommand > 0 && state.hvac.fanStatus !== "RUNNING" ? "FAULT" : airflowStatus === "WATCH" ? "WATCH" : "NORMAL";
    const heatingStatus = state.hvac.heating && state.supplyTemp < state.returnTemp + 3 ? "WATCH" : "NORMAL";
    const coolingStatus = state.hvac.cooling && state.supplyTemp > state.returnTemp - 2 ? "WATCH" : "NORMAL";
    const details = {
      heating: { status: heatingStatus, operating: state.safety.burnerState, points: [["HEATING DEMAND", displayPercent(state.hvac.heatingDemand), "CMD"], ["FURNACE SEQUENCE", state.safety.sequence, "CALC"], ["GAS VALVE CMD / FB", `${state.safety.gasValveCommand ? "OPEN" : "CLOSED"} / ${state.safety.gasValveFeedback ? "OPEN" : "CLOSED"}`, "CMD / FB"], ["SUPPLY / RETURN", `${displayNumber(state.supplyTemp, "°C")} / ${displayNumber(state.returnTemp, "°C")}`, "SIM"], ["BURNER RUNTIME", displayHours(state.safety.burnerRuntimeHours), "SIM"]], indication: state.safety.furnaceLockout ? "FURNACE SAFETY LOCKOUT" : heatingStatus === "WATCH" ? "LOW HEATING RESPONSE" : "THERMAL RESPONSE NORMAL", action: state.safety.furnaceLockout ? "RESET CERTIFIED EQUIPMENT / INVESTIGATE CAUSE" : heatingStatus === "WATCH" ? "INSPECT HEATING PERFORMANCE" : "NO ACTION REQUIRED" },
      cooling: { status: coolingStatus, operating: state.hvac.compressor ? "RUNNING" : "STANDBY", points: [["COOLING DEMAND", displayPercent(state.hvac.coolingDemand), "CMD"], ["COMPRESSOR", state.hvac.compressor ? "ON" : "OFF", "FB"], ["STARTS TODAY", String(state.hvac.compressorStartsToday), "SIM"], ["CYCLES / HOUR", String(state.hvac.startsThisHour), "CALC"], ["RUNTIME", displayHours(state.hvac.compressorRuntimeHours), "SIM"]], indication: coolingStatus === "WATCH" ? "LOW COOLING RESPONSE" : "NORMAL COOLING RESPONSE", action: coolingStatus === "WATCH" ? "INSPECT COOLING PERFORMANCE" : "NO ACTION REQUIRED" },
      fan: { status: fanStatus, operating: state.hvac.fanStatus, points: [["FAN COMMAND", displayPercent(state.hvac.fanCommand), "CMD"], ["FAN FEEDBACK", state.hvac.fanStatus, "FB"], ["AIRFLOW", displayPercent(state.airflow), "CALC"], ["RUNTIME", displayHours(state.maintenance.fanRuntimeHours), "SIM"]], indication: fanStatus === "FAULT" ? "FAN COMMAND / STATUS MISMATCH" : fanStatus === "WATCH" ? "POSSIBLE AIRFLOW RESTRICTION" : "COMMAND / FEEDBACK NORMAL", action: fanStatus === "NORMAL" ? "NO ACTION REQUIRED" : "INSPECT BLOWER AND AIR PATH" },
      filter: { status: filterStatus, operating: filterStatus === "NORMAL" ? "NORMAL" : filterStatus, points: [["FILTER ΔP", `${Math.round(state.maintenance.filterDp)} Pa`, "SIM"], ["FAN CMD", displayPercent(state.hvac.fanCommand), "CMD"], ["AIRFLOW", displayPercent(state.airflow), "CALC"], ["RUNTIME", displayHours(state.maintenance.filterRuntimeHours), "SIM"], ["LAST SERVICE", state.maintenance.lastFilterService ? eventTimestamp(state.maintenance.lastFilterService) : "NO CONFIRMED SERVICE", "SIM"]], indication: filterStatus === "NORMAL" ? "FILTER RESISTANCE NORMAL" : "FILTER RESTRICTION INCREASING", action: filterStatus === "SERVICE DUE" ? "REPLACE FILTER" : filterStatus === "WATCH" ? "INSPECT / PLAN FILTER SERVICE" : "NO ACTION REQUIRED" },
      airflow: { status: airflowStatus, operating: state.hvac.fanStatus, points: [["AIRFLOW", displayPercent(state.airflow), "CALC"], ["FAN COMMAND", displayPercent(state.hvac.fanCommand), "CMD"], ["FILTER ΔP", `${Math.round(state.maintenance.filterDp)} Pa`, "SIM"], ["ZONE DAMPER FB", displayPercent(state.actuators.zoneDamperPosition), "FB"]], indication: airflowStatus === "WATCH" ? "POSSIBLE FILTER / DUCT RESTRICTION" : "AIRFLOW RELATIONSHIP NORMAL", action: airflowStatus === "WATCH" ? "INSPECT FILTER AND DUCT PATH" : "NO ACTION REQUIRED" },
      oaDamper: { status: actuatorFault(state.actuators.oaDamperCommand, state.actuators.oaDamperPosition) ? "FAULT" : "NORMAL", operating: state.ventilation.strategy, points: [["COMMAND", displayPercent(state.actuators.oaDamperCommand), "CMD"], ["POSITION", displayPercent(state.actuators.oaDamperPosition), "FB"], ["VENTILATION", state.ventilation.demand, "CALC"]], indication: actuatorFault(state.actuators.oaDamperCommand, state.actuators.oaDamperPosition) ? "POSITION NOT FOLLOWING COMMAND" : "POSITION FOLLOWING COMMAND", action: actuatorFault(state.actuators.oaDamperCommand, state.actuators.oaDamperPosition) ? "INSPECT DAMPER ACTUATOR" : "NO ACTION REQUIRED" },
      zoneDamper: { status: actuatorFault(state.actuators.zoneDamperCommand, state.actuators.zoneDamperPosition) ? "FAULT" : "NORMAL", operating: "ZONE AIRFLOW CONTROL", points: [["COMMAND", displayPercent(state.actuators.zoneDamperCommand), "CMD"], ["POSITION", displayPercent(state.actuators.zoneDamperPosition), "FB"], ["ZONE TEMP", displayNumber(state.indoorTemp, "°C"), "SIM"]], indication: actuatorFault(state.actuators.zoneDamperCommand, state.actuators.zoneDamperPosition) ? "POSITION NOT FOLLOWING COMMAND" : "POSITION FOLLOWING COMMAND", action: actuatorFault(state.actuators.zoneDamperCommand, state.actuators.zoneDamperPosition) ? "INSPECT DAMPER ACTUATOR" : "NO ACTION REQUIRED" },
      heatingValve: { status: actuatorFault(state.actuators.heatingValveCommand, state.actuators.heatingValvePosition) ? "FAULT" : "NORMAL", operating: state.hvac.heating ? "MODULATING" : "CLOSED", points: [["COMMAND", displayPercent(state.actuators.heatingValveCommand), "CMD"], ["POSITION", displayPercent(state.actuators.heatingValvePosition), "FB"], ["HEATING DEMAND", displayPercent(state.hvac.heatingDemand), "CALC"]], indication: actuatorFault(state.actuators.heatingValveCommand, state.actuators.heatingValvePosition) ? "POSITION NOT FOLLOWING COMMAND" : "POSITION FOLLOWING COMMAND", action: actuatorFault(state.actuators.heatingValveCommand, state.actuators.heatingValvePosition) ? "INSPECT VALVE ACTUATOR" : "NO ACTION REQUIRED" },
      coolingValve: { status: actuatorFault(state.actuators.coolingValveCommand, state.actuators.coolingValvePosition) ? "FAULT" : "NORMAL", operating: state.hvac.cooling ? "MODULATING" : "CLOSED", points: [["COMMAND", displayPercent(state.actuators.coolingValveCommand), "CMD"], ["POSITION", displayPercent(state.actuators.coolingValvePosition), "FB"], ["COOLING DEMAND", displayPercent(state.hvac.coolingDemand), "CALC"]], indication: actuatorFault(state.actuators.coolingValveCommand, state.actuators.coolingValvePosition) ? "POSITION NOT FOLLOWING COMMAND" : "POSITION FOLLOWING COMMAND", action: actuatorFault(state.actuators.coolingValveCommand, state.actuators.coolingValvePosition) ? "INSPECT VALVE ACTUATOR" : "NO ACTION REQUIRED" },
      sensors: { status: sensorStatus, operating: sensorStatus === "NORMAL" ? "VALID" : "CHECK SENSOR", points: [["T_ZONE", displayNumber(state.indoorTemp, "°C"), "SIM"], ["RH_ZONE", displayPercent(state.indoorHumidity), "SIM"], ["CO₂", `${Math.round(state.co2)} ppm`, "SIM"], ["IAQ STATUS", state.indoorIAQ.status, "CALC"]], indication: sensorStatus === "NORMAL" ? "SIGNALS PLAUSIBLE / VALID" : "OUT-OF-RANGE SENSOR SIGNAL", action: sensorStatus === "NORMAL" ? "NO ACTION REQUIRED" : "CHECK SENSOR SIGNAL" }
    };
    state.equipmentHealth = EQUIPMENT_META.map((equipment) => ({ ...equipment, ...details[equipment.id] }));
    state.maintenanceAlerts = state.equipmentHealth.filter((equipment) => equipment.status !== "NORMAL");
    state.alarms = state.equipmentHealth.filter((equipment) => equipment.status === "FAULT").length;
  }

  function updateRuleBasedState(deltaSeconds) {
    const clock = formatClock();
    state.schedule = resolveSchedule(clock);
    const scheduledSetpoints = CONFIG.setpoints[state.schedule.mode];
    state.activeSetpoints = state.setpointMode === "MANUAL" ? { ...state.manualSetpoints, source: "MANUAL" } : { ...scheduledSetpoints, source: "SCHEDULE" };
    updateIaqState();
    const { heat, cool } = state.activeSetpoints;
    const previousMode = state.hvac.mode;
    const deadband = CONFIG.control.deadband;
    let requestedMode;
    if (previousMode === "HEATING" && state.indoorTemp < heat + deadband) requestedMode = "HEATING";
    else if (previousMode === "COOLING" && state.indoorTemp > cool - deadband) requestedMode = "COOLING";
    else if (state.indoorTemp < heat - deadband) requestedMode = "HEATING";
    else if (state.indoorTemp > cool + deadband) requestedMode = "COOLING";
    else requestedMode = state.schedule.occupancy || state.ventilation.demand !== "NORMAL" ? "VENTILATION" : "STANDBY";
    const heatRequested = requestedMode === "HEATING";
    state.hvac.heatingDemand = heatRequested ? Math.min(100, 42 + (heat - state.indoorTemp) * 28) : 0;
    state.hvac.cooling = requestedMode === "COOLING";
    state.hvac.coolingDemand = state.hvac.cooling ? Math.min(100, 42 + (state.indoorTemp - cool) * 28) : 0;
    state.hvac.compressor = state.hvac.cooling;
    updateSafetySequence(deltaSeconds, heatRequested);
    state.hvac.heating = state.safety.burnerState === "HEATING ACTIVE";
    state.hvac.heatingStage = heatRequested ? 1 : 0;
    state.hvac.coolingStage = state.hvac.cooling ? 1 : 0;
    if (heatRequested && !state.hvac.heating) state.hvac.mode = state.safety.furnaceLockout ? "SAFETY LOCKOUT" : "HEAT STARTUP";
    else state.hvac.mode = requestedMode;
    const ventilation = ventilationCommand();
    const thermalDemand = Math.max(state.hvac.heatingDemand, state.hvac.coolingDemand);
    state.hvac.fanCommand = Math.round(state.hvac.mode === "STANDBY" ? 0 : Math.max(ventilation, thermalDemand, state.safety.postPurgeSeconds > 0 ? 35 : 0));
    state.hvac.supplyFan = state.hvac.fanCommand > 0 ? "RUNNING" : "IDLE";
    state.hvac.fanStatus = state.hvac.supplyFan;
    state.actuators.oaDamperCommand = ventilation;
    state.actuators.raDamperCommand = 100 - ventilation;
    state.actuators.heatingValveCommand = state.hvac.heating ? Math.round(Math.min(100, state.hvac.heatingDemand + 8)) : 0;
    state.actuators.coolingValveCommand = state.hvac.cooling ? Math.round(Math.min(100, state.hvac.coolingDemand + 8)) : 0;
    state.actuators.zoneDamperCommand = state.hvac.fanCommand ? Math.max(20, Math.round(state.hvac.fanCommand * 0.86)) : 15;
    const dt = Math.min(deltaSeconds, CONFIG.thermal.maxStepSeconds);
    Object.entries({ oaDamper: "oaDamper", raDamper: "raDamper", heatingValve: "heatingValve", coolingValve: "coolingValve", zoneDamper: "zoneDamper" }).forEach(([key, prefix]) => {
      state.actuators[`${prefix}Position`] = follow(state.actuators[`${prefix}Position`], state.actuators[`${prefix}Command`], CONFIG.control.actuatorFollowRate, dt);
    });
    const outdoorAnchor = state.weather.temperature == null ? 18 : state.weather.temperature;
    if (state.hvac.heating) state.indoorTemp += (heat - state.indoorTemp) * CONFIG.thermal.hvacResponse * dt;
    else if (state.hvac.cooling) state.indoorTemp += (cool - state.indoorTemp) * CONFIG.thermal.hvacResponse * dt;
    else state.indoorTemp += (outdoorAnchor - state.indoorTemp) * CONFIG.thermal.outdoorCoupling * dt;
    state.indoorTemp = clamp(state.indoorTemp, 10, 30);
    state.supplyTemp = state.hvac.heating ? 33 + state.hvac.heatingDemand * 0.035 : state.hvac.cooling ? 14.4 - state.hvac.coolingDemand * 0.02 : state.indoorTemp - (state.hvac.mode === "VENTILATION" ? 1.6 : 0.4);
    state.returnTemp = state.indoorTemp + 0.5;
    state.airflow = Math.round(clamp(state.hvac.fanCommand * (1 - Math.max(0, state.maintenance.filterDp - CONFIG.maintenance.filter.cleanDp) / 330), 0, 100));
    const occupancyCo2 = state.schedule.occupancy ? 760 : 460;
    const ventilationReduction = state.hvac.fanCommand * 3.1;
    state.co2 += (Math.max(430, occupancyCo2 - ventilationReduction) - state.co2) * 0.02 * dt;
    state.voc += ((state.schedule.occupancy ? 235 : 150) - state.voc) * 0.012 * dt;
    state.pm25 += ((state.outdoorAirQuality.status === "LIVE" && state.outdoorAirQuality.pm25 != null ? Math.min(15, state.outdoorAirQuality.pm25 * (ventilation / 100)) : 6) - state.pm25) * 0.018 * dt;
    state.indoorHumidity += ((state.hvac.cooling ? 44 : 46) - state.indoorHumidity) * 0.02 * dt;
    if (state.hvac.heating || state.hvac.cooling) state.hvac.runtimeSeconds += dt;
    if (state.hvac.fanCommand > 0) {
      const elapsedHours = dt / 3600;
      state.maintenance.filterRuntimeHours += elapsedHours;
      state.maintenance.fanRuntimeHours += elapsedHours;
      state.maintenance.systemRuntimeHours += elapsedHours;
      state.maintenance.filterLoad += elapsedHours * Math.max(0.35, state.hvac.fanCommand / 100) / 900;
      state.maintenance.filterDp = CONFIG.maintenance.filter.cleanDp + state.maintenance.filterLoad * 100;
      state.maintenance.filterDp += CONFIG.maintenance.filter.dpRisePerFanHour * elapsedHours * Math.max(0.35, state.hvac.fanCommand / 100);
    }
    if (state.hvac.compressor) state.hvac.compressorRuntimeHours += dt / 3600;
    if (state.hvac.compressor && !state.hvac.lastCompressorState) { state.hvac.compressorStarts += 1; state.hvac.compressorStartsToday += 1; state.hvac.startsThisHour += 1; }
    state.hvac.lastCompressorState = state.hvac.compressor;
    if (state.hvac.fanCommand > 0 && !state.hvac.lastFanState) { state.hvac.fanStarts += 1; state.hvac.fanStartsToday += 1; }
    state.hvac.lastFanState = state.hvac.fanCommand > 0;
    state.maintenance.simulatedElapsedSeconds += dt;
    if (state.maintenance.simulatedElapsedSeconds > 3600) { state.maintenance.simulatedElapsedSeconds = 0; state.hvac.startsThisHour = 0; }
    updateIaqState();
    resolveEquipmentHealth();
    updateEnergy(deltaSeconds);
    updateEventCenter(deltaSeconds);
    if (previousMode !== state.hvac.mode) root()?.classList.toggle("is-bas-demand", state.hvac.heating || state.hvac.cooling);
  }

  function weatherText(key) {
    if (state.weather.status !== "LIVE") return key === "condition" ? "WEATHER DATA UNAVAILABLE" : "—";
    if (key === "temp") return displayNumber(state.weather.temperature, "°C");
    if (key === "humidity") return displayPercent(state.weather.humidity);
    if (key === "wind") return displayNumber(state.weather.wind, "km/h");
    return state.weather.condition;
  }

  function airQualityText(key) {
    if (state.outdoorAirQuality.status !== "LIVE") return key === "status" ? "DATA UNAVAILABLE" : "DATA UNAVAILABLE";
    if (key === "aqi") return `${Math.round(state.outdoorAirQuality.aqi)} AQI`;
    if (key === "pm25") return displayNumber(state.outdoorAirQuality.pm25, "µg/m³");
    return state.outdoorAirQuality.quality;
  }

  function values() {
    const clock = formatClock();
    const online = state.weather.status === "LIVE";
    const outdoorAirLive = state.outdoorAirQuality.status === "LIVE";
    const mode = state.hvac.mode;
    const health = state.equipmentHealth;
    const safety = state.safety;
    const energy = state.energy;
    const count = (status) => health.filter((equipment) => equipment.status === status).length;
    const gasValue = safety.gasSensorHealth === "NORMAL" ? `${Math.round(safety.gasLevel)} ppm` : "UNKNOWN";
    const coValue = safety.coSensorHealth === "NORMAL" ? `${Math.round(safety.coLevel)} ppm` : "UNKNOWN";
    const costsConfigured = Number.isFinite(CONFIG.energyRates.electricityRate) && Number.isFinite(CONFIG.energyRates.gasRate);
    const estimatedCost = costsConfigured ? (energy.electricityToday * CONFIG.energyRates.electricityRate + energy.gasToday * CONFIG.energyRates.gasRate).toFixed(2) : "NOT CONFIGURED";
    return {
      "header-time": clock.time, "header-date": `${clock.day} / ${clock.date}`, "header-weather": online ? `${weatherText("temp")} / ${weatherText("condition")}` : "WEATHER DATA UNAVAILABLE", "weather-status": online ? "LIVE" : state.weather.status === "CONNECTING" ? "CONNECTING" : "UNAVAILABLE",
      "outdoor-location": CONFIG.location.name.toUpperCase(), "outdoor-temp": weatherText("temp"), "outdoor-rh": weatherText("humidity"), "outdoor-condition": weatherText("condition"), "outdoor-wind": weatherText("wind"), "outdoor-time": `${clock.time} / ${clock.day} / ${clock.date}`,
      "home-temp": displayNumber(state.indoorTemp, "°C"), "home-rh": displayPercent(state.indoorHumidity), "home-co2": `${Math.round(state.co2)} ppm`, "heat-sp": displayNumber(state.activeSetpoints.heat, "°C"), "cool-sp": displayNumber(state.activeSetpoints.cool, "°C"), "supply-temp": displayNumber(state.supplyTemp, "°C"), "return-temp": displayNumber(state.returnTemp, "°C"), "occupancy": String(state.schedule.occupancy),
      "hvac-mode": mode, "heating": state.hvac.heating ? "ON" : "OFF", "cooling": state.hvac.cooling ? "ON" : "OFF", "supply-fan": state.hvac.supplyFan, "fan-command": displayPercent(state.hvac.fanCommand), "fan-status": state.hvac.fanStatus, "compressor": state.hvac.compressor ? "ON" : "OFF", "heating-stage": String(state.hvac.heatingStage), "cooling-stage": String(state.hvac.coolingStage), "runtime": displayRuntime(state.hvac.runtimeSeconds),
      "sensor-zone": displayNumber(state.indoorTemp, "°C"), "sensor-rh": displayPercent(state.indoorHumidity), "sensor-co2": `${Math.round(state.co2)} ppm`, "sensor-voc": `${Math.round(state.voc)} ppb`, "sensor-pm25": displayNumber(state.pm25, "µg/m³"), "sensor-supply": displayNumber(state.supplyTemp, "°C"), "sensor-return": displayNumber(state.returnTemp, "°C"), "sensor-outdoor": weatherText("temp"), "sensor-occ": String(state.schedule.occupancy),
      "oa-damper-command": `${Math.round(state.actuators.oaDamperCommand)} % OPEN`, "oa-damper-position": `${Math.round(state.actuators.oaDamperPosition)} % OPEN`, "ra-damper-command": `${Math.round(state.actuators.raDamperCommand)} % OPEN`, "ra-damper-position": `${Math.round(state.actuators.raDamperPosition)} % OPEN`, "heating-valve-command": state.actuators.heatingValveCommand ? `${Math.round(state.actuators.heatingValveCommand)} % OPEN` : "CLOSED", "heating-valve-position": state.actuators.heatingValvePosition ? `${Math.round(state.actuators.heatingValvePosition)} % OPEN` : "CLOSED", "cooling-valve-command": state.actuators.coolingValveCommand ? `${Math.round(state.actuators.coolingValveCommand)} % OPEN` : "CLOSED", "cooling-valve-position": state.actuators.coolingValvePosition ? `${Math.round(state.actuators.coolingValvePosition)} % OPEN` : "CLOSED", "zone-damper-command": `${Math.round(state.actuators.zoneDamperCommand)} % OPEN`, "zone-damper-position": `${Math.round(state.actuators.zoneDamperPosition)} % OPEN`, "actuator-fan": displayPercent(state.hvac.fanCommand),
      "control-mode": state.setpointMode, "control-type": "RULE-BASED / NON-AI", "setpoint-source": state.activeSetpoints.source, "occupancy-mode": state.schedule.period, "control-heat": displayNumber(state.activeSetpoints.heat, "°C"), "control-cool": displayNumber(state.activeSetpoints.cool, "°C"), "heating-demand": displayPercent(state.hvac.heatingDemand), "cooling-demand": displayPercent(state.hvac.coolingDemand), "current-demand": state.hvac.heatingDemand ? `HEATING ${Math.round(state.hvac.heatingDemand)} %` : state.hvac.coolingDemand ? `COOLING ${Math.round(state.hvac.coolingDemand)} %` : "NO ACTIVE THERMAL DEMAND", "control-fan": displayPercent(state.hvac.fanCommand), "system-response": safety.furnaceLockout ? "SAFETY LOCKOUT" : "NORMAL",
      "iaq-status": state.indoorIAQ.status, "iaq-cause": state.indoorIAQ.primaryCause, "iaq-co2": `${Math.round(state.co2)} ppm`, "iaq-voc": `${Math.round(state.voc)} ppb`, "iaq-pm25": displayNumber(state.pm25, "µg/m³"), "iaq-rh": displayPercent(state.indoorHumidity), "outdoor-aqi": airQualityText("aqi"), "outdoor-pm25": airQualityText("pm25"), "outdoor-aq-status": airQualityText("status"), "outdoor-aq-live": outdoorAirLive ? "LIVE" : state.outdoorAirQuality.status === "CONNECTING" ? "CONNECTING" : "UNAVAILABLE", "vent-demand": state.ventilation.demand, "vent-strategy": state.ventilation.strategy, "vent-warning": state.ventilation.warning,
      "schedule-type": state.schedule.type, "schedule-period": state.schedule.period, "schedule-occupancy": String(state.schedule.occupancy), "schedule-next": state.schedule.nextEvent,
      "event-alarm": String(state.eventCounts.ALARM || 0), "event-warning": String(state.eventCounts.WARNING || 0), "event-fault": String(state.eventCounts.FAULT || 0), "event-maintenance": String(state.eventCounts.MAINTENANCE || 0), "event-total": String(state.events.filter((event) => event.status !== "CLEARED").length),
      "safety-gas": gasValue, "safety-gas-signal": safety.gasSensorHealth === "NORMAL" ? "VALID" : "LOST", "safety-gas-device": safety.gasSensorCommunication, "safety-gas-test": safety.gasSelfTest, "safety-gas-health": safety.gasSensorHealth, "safety-co": coValue, "safety-co-signal": safety.coSensorHealth === "NORMAL" ? "VALID" : "LOST", "safety-co-device": safety.coSensorCommunication, "safety-co-health": safety.coSensorHealth, "safety-flame-command": safety.flameExpected ? "ON" : "OFF", "safety-flame-proven": safety.flameProven ? "YES" : "NO", "safety-flame-health": safety.flameSensorHealth, "safety-flame-current": displayNumber(safety.flameCurrent, "µA"), "safety-last-proof": safety.flameLastProof ? eventTimestamp(safety.flameLastProof) : "NONE", "safety-gas-valve-command": safety.gasValveCommand ? "OPEN" : "CLOSED", "safety-gas-valve-feedback": safety.gasValveFeedback ? "OPEN" : "CLOSED", "safety-inducer": safety.inducerCommand ? "ON" : "OFF", "safety-draft": safety.draftProof ? "YES" : "NO", "safety-high-limit": safety.highLimit, "safety-sequence": safety.sequence, "safety-burner": safety.burnerState, "safety-lockout": safety.furnaceLockout ? "LOCKOUT" : "CLEAR",
      "energy-voltage": displayNumber(energy.voltage, "V", 0), "energy-current": displayNumber(energy.current, "A"), "energy-power": displayNumber(energy.power, "kW", 2), "energy-apparent": displayNumber(energy.apparentPower, "kVA", 2), "energy-pf": energy.powerFactor.toFixed(2), "energy-hvac-power": displayNumber(energy.hvacPower, "kW", 2), "energy-hvac-share": displayPercent(energy.totalHomePower ? energy.hvacPower / energy.totalHomePower * 100 : 0), "energy-fan-power": displayNumber(energy.fanPower, "kW", 2), "energy-compressor-power": displayNumber(energy.compressorPower, "kW", 2), "energy-inducer-power": displayNumber(energy.inducerPower, "kW", 2), "energy-controls-power": displayNumber(energy.controlsPower, "kW", 2), "energy-gas-flow": displayNumber(energy.gasFlow, "m³/h", 2), "energy-electric-today": displayNumber(energy.electricityToday, "kWh", 1), "energy-electric-month": displayNumber(energy.electricityMonth, "kWh", 0), "energy-electric-year": displayNumber(energy.electricityYear, "kWh", 0), "energy-gas-today": displayNumber(energy.gasToday, "m³", 1), "energy-gas-month": displayNumber(energy.gasMonth, "m³", 1), "energy-gas-year": displayNumber(energy.gasYear, "m³", 0), "energy-peak-today": displayNumber(energy.peakDemandToday, "kW", 2), "energy-peak-month": displayNumber(energy.peakDemandMonth, "kW", 2), "energy-cost": estimatedCost, "energy-burner-runtime": displayHours(safety.burnerRuntimeHours), "energy-fan-runtime": displayHours(state.maintenance.fanRuntimeHours), "energy-compressor-runtime": displayHours(state.hvac.compressorRuntimeHours), "energy-furnace-starts": String(safety.furnaceStartsToday), "energy-compressor-starts": String(state.hvac.compressorStartsToday), "energy-fan-starts": String(state.hvac.fanStartsToday),
      "maintenance-monitored": String(health.length), "maintenance-normal": String(count("NORMAL")), "maintenance-watch": String(count("WATCH")), "maintenance-service": String(count("SERVICE DUE")), "maintenance-fault": String(count("FAULT")), "maintenance-alerts": state.maintenanceAlerts.length ? state.maintenanceAlerts.map((equipment) => equipment.name).join(" / ") : "NONE", "maintenance-filter-runtime": displayHours(state.maintenance.filterRuntimeHours), "maintenance-filter-dp": `${Math.round(state.maintenance.filterDp)} Pa`, "maintenance-last-filter": state.maintenance.lastFilterService ? eventTimestamp(state.maintenance.lastFilterService) : "NO CONFIRMED SERVICE",
      "status-bas": "ONLINE", "status-loop": "ACTIVE", "status-weather": online ? "LIVE" : "UNAVAILABLE", "status-aq": outdoorAirLive ? "LIVE" : "UNAVAILABLE", "status-schedule": "ACTIVE", "status-alarms": `${state.eventCounts.ALARM || 0} ACTIVE`, "status-health": state.eventCounts.ALARM || state.eventCounts.FAULT ? "FAULT" : state.maintenanceAlerts.length ? "WATCH" : "NORMAL",
      "twin-occupancy": String(state.schedule.occupancy), "twin-temp": displayNumber(state.indoorTemp, "°C"), "twin-mode": mode, "twin-iaq": state.indoorIAQ.status, "twin-power": displayNumber(energy.power, "kW", 2), "twin-gas": displayNumber(energy.gasFlow, "m³/h", 2)
    };
  }

  function bars() { return { "oa-damper-command": state.actuators.oaDamperCommand, "ra-damper-command": state.actuators.raDamperCommand, "heating-valve-command": state.actuators.heatingValveCommand, "cooling-valve-command": state.actuators.coolingValveCommand, "zone-damper-command": state.actuators.zoneDamperCommand, "actuator-fan": state.hvac.fanCommand }; }
  function renderSetpointControls() {
    const page = root(); if (!page) return;
    page.querySelectorAll("[data-bas-setpoint-mode]").forEach((button) => { const selected = button.dataset.basSetpointMode === state.setpointMode; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
    page.querySelectorAll("[data-bas-setpoint-input]").forEach((input) => { const key = input.dataset.basSetpointInput; if (document.activeElement !== input) input.value = state.manualSetpoints[key]; input.disabled = state.setpointMode !== "MANUAL"; });
    page.querySelectorAll("[data-bas-adjust]").forEach((button) => button.disabled = state.setpointMode !== "MANUAL");
  }
  function renderMaintenance() {
    const mount = root()?.querySelector("[data-bas-maintenance-list]"); if (!mount) return;
    mount.innerHTML = state.equipmentHealth.map((equipment) => {
      const expanded = expandedEquipment.has(equipment.id);
      const points = equipment.points.map(([label, value, type]) => `<div><span>${label}</span><b>${value}</b><em>${type}</em></div>`).join("");
      return `<article class="bas-maint-item is-${equipment.status.toLowerCase().replaceAll(" ", "-")}${expanded ? " is-expanded" : ""}"><button type="button" data-bas-equipment="${equipment.id}" aria-expanded="${expanded}"><span>${equipment.name}</span><b>${equipment.status}</b><i>${expanded ? "−" : "+"}</i></button><div class="bas-maint-detail"><div class="bas-maint-detail-inner"><p><span>STATUS</span><b>${equipment.operating}</b></p><div class="bas-maint-points">${points}</div><p><span>DIAGNOSTIC INDICATION</span><b>${equipment.indication}</b></p><p><span>RECOMMENDED ACTION</span><b>${equipment.action}</b></p></div></div></article>`;
    }).join("");
    mount.querySelectorAll("[data-bas-equipment]").forEach((button) => button.addEventListener("click", () => toggleEquipment(button.dataset.basEquipment)));
  }
  function renderEvents() {
    const page = root(); const mount = page?.querySelector("[data-bas-event-list]"); if (!page || !mount) return;
    page.querySelectorAll("[data-bas-event-filter]").forEach((button) => { const selected = button.dataset.basEventFilter === eventDrawerFilter; button.classList.toggle("is-selected", selected); button.setAttribute("aria-expanded", String(selected)); });
    const events = state.events.filter((event) => !eventDrawerFilter || event.severity === eventDrawerFilter).slice(0, 16);
    mount.innerHTML = events.length ? events.map((event) => `<article class="bas-event is-${event.severity.toLowerCase()} is-${event.status.toLowerCase()}"><div><b>${event.severity}</b><span>${eventTimestamp(event.timestamp)}</span><em>${event.status}${event.acknowledgedAt ? ` / ACK ${eventTimestamp(event.acknowledgedAt)}` : ""}</em></div><strong>${event.equipment}</strong><p><code>${event.code}</code>${event.description}</p>${event.status === "ACTIVE" ? `<button type="button" data-bas-event-ack="${event.id}">ACKNOWLEDGE</button>` : ""}</article>`).join("") : `<p class="bas-events-empty">NO ${eventDrawerFilter || "ACTIVE"} EVENTS.</p>`;
    mount.querySelectorAll("[data-bas-event-ack]").forEach((button) => button.addEventListener("click", () => acknowledgeEvent(button.dataset.basEventAck)));
  }
  function setServiceConfirmation(open) {
    serviceConfirmOpen = open;
    const dialog = root()?.querySelector("[data-bas-service-confirm]");
    if (!dialog) return;
    dialog.classList.toggle("is-open", open);
    dialog.setAttribute("aria-hidden", String(!open));
    if (open) window.requestAnimationFrame(() => dialog.querySelector("[data-bas-confirm-filter]")?.focus());
  }
  function replaceFilter() {
    state.maintenance.filterRuntimeHours = 0;
    state.maintenance.filterLoad = 0;
    state.maintenance.filterDp = CONFIG.maintenance.filter.cleanDp;
    state.maintenance.lastFilterService = new Date();
    recordInformation("AIR FILTER", "FILTER_REPLACED", "FILTER REPLACEMENT CONFIRMED BY TECHNICIAN");
    setServiceConfirmation(false);
    updateRuleBasedState(0);
    renderState();
  }
  function renderState() {
    const page = root(); if (!page) return;
    const pointValues = values();
    page.querySelectorAll("[data-bas-value]").forEach((node) => { node.textContent = pointValues[node.dataset.basValue] ?? "—"; });
    const percentageBars = bars();
    page.querySelectorAll("[data-bas-bar]").forEach((node) => node.style.setProperty("--bas-bar", `${percentageBars[node.dataset.basBar] ?? 0}%`));
    page.querySelectorAll("[data-bas-state]").forEach((node) => { const value = pointValues[node.dataset.basState] || ""; node.classList.toggle("is-on", /^(ON|RUNNING|ONLINE|ACTIVE|LIVE|NORMAL|AUTO|OCCUPIED|VENTILATION|HEATING|COOLING|GOOD)$/i.test(value)); node.classList.toggle("is-off", /^(OFF|IDLE|STANDBY|UNAVAILABLE|CLOSED)$/i.test(value)); node.classList.toggle("is-watch", /^(WATCH|MODERATE|LIMITED|CAUTIOUS|SERVICE DUE)$/i.test(value)); node.classList.toggle("is-fault", /^(FAULT|POOR)$/i.test(value)); });
    renderSetpointControls();
    renderMaintenance();
    renderEvents();
    renderTwin();
  }

  function dataRow(label, key, type = "SIM", stateKey = "") { return `<div class="bas-data-row"><span>${label}</span><b data-bas-value="${key}">—</b><em class="bas-data-type">${type}</em>${stateKey ? `<i data-bas-state="${stateKey}"></i>` : ""}</div>`; }
  function pointRow(point, key, type = "SIM", stateKey = "") { return `<div class="bas-point-row"><span>${point}</span><b data-bas-value="${key}">—</b><em>${type}</em>${stateKey ? `<i data-bas-state="${stateKey}"></i>` : ""}</div>`; }
  function actuatorRow(label, key) { return `<div class="bas-actuator-row"><span>${label}</span><b data-bas-value="${key}">—</b><em>CMD</em><i><i data-bas-bar="${key}"></i></i></div>`; }
  function accordion(id, number, label, content) { return `<section class="bas-accordion" data-bas-section="${id}"><button class="bas-accordion-toggle" type="button" aria-expanded="false" aria-controls="bas-panel-${id}"><span class="bas-accordion-arrow" aria-hidden="true">▸</span><b>${number}</b><strong>${label}</strong><em>VIEW</em></button><div class="bas-accordion-panel" id="bas-panel-${id}"><div class="bas-accordion-panel-inner">${content}</div></div></section>`; }
  function setpointControl(kind, label) { const limits = CONFIG.setpointLimits[kind]; return `<div class="bas-setpoint-control"><label>${label}<small>${limits.min}–${limits.max} °C / MANUAL</small></label><div><button type="button" data-bas-adjust="${kind}" data-bas-direction="-1" aria-label="Lower ${label}">−</button><input type="number" inputmode="decimal" step="${limits.step}" min="${limits.min}" max="${limits.max}" data-bas-setpoint-input="${kind}" aria-label="${label}" /><span>°C</span><button type="button" data-bas-adjust="${kind}" data-bas-direction="1" aria-label="Raise ${label}">+</button></div></div>`; }

  function buildPage() {
    const page = root(); if (!page) return;
    page.innerHTML = `<article class="bas-shell">
      <header class="bas-topbar"><div class="bas-title"><p>BUILDING AUTOMATION SYSTEM / RESIDENTIAL</p><h1>RESIDENTIAL BUILDING<br /><span>AUTOMATION SYSTEM</span></h1><strong>LIVE DIGITAL TWIN</strong></div><div class="bas-live-strip"><span class="bas-online"><i></i>BAS ONLINE</span><span>KITCHENER, ON</span><span><b data-bas-value="header-time">--:--:--</b><small data-bas-value="header-date">—</small></span><span class="bas-weather"><b data-bas-value="header-weather">CONNECTING</b><small>LIVE WEATHER / <i data-bas-value="weather-status">CONNECTING</i></small></span></div><div class="bas-control-mode"><span>CONTROL BASELINE</span><b>RULE-BASED / NON-AI</b><button type="button" data-bas-close aria-label="Close Residential Building Automation System">×</button></div></header>
      <main class="bas-workspace"><section class="bas-operator" aria-label="BAS information and control stack"><div class="bas-operator-heading"><span>OPERATOR STACK / LIVE WEATHER + SIMULATED BAS POINTS</span><b>MULTI-EXPAND VIEW</b></div>
        ${accordion("outdoor", "01", "OUTDOOR CONDITIONS", `${dataRow("LOCATION", "outdoor-location", "LIVE")}${dataRow("OUTDOOR TEMP", "outdoor-temp", "LIVE")}${dataRow("OUTDOOR RH", "outdoor-rh", "LIVE")}${dataRow("CONDITION", "outdoor-condition", "LIVE")}${dataRow("WIND", "outdoor-wind", "LIVE")}${dataRow("DATE / TIME", "outdoor-time", "CALC")}`)}
        ${accordion("home", "02", "HOME CONDITIONS", `${dataRow("INDOOR TEMP", "home-temp")}${dataRow("INDOOR RH", "home-rh")}${dataRow("CO₂", "home-co2")}${dataRow("HEATING SP", "heat-sp", "CMD")}${dataRow("COOLING SP", "cool-sp", "CMD")}${dataRow("SUPPLY AIR", "supply-temp")}${dataRow("RETURN AIR", "return-temp")}${dataRow("CURRENT OCCUPANCY", "occupancy")}`)}
        ${accordion("hvac", "03", "HVAC SYSTEM", `${dataRow("MODE", "hvac-mode", "CALC", "hvac-mode")}${dataRow("HEATING", "heating", "FB", "heating")}${dataRow("COOLING", "cooling", "FB", "cooling")}${dataRow("SUPPLY FAN", "supply-fan", "FB", "supply-fan")}${dataRow("FAN COMMAND", "fan-command", "CMD")}${dataRow("FAN FEEDBACK", "fan-status", "FB", "fan-status")}${dataRow("COMPRESSOR", "compressor", "FB", "compressor")}${dataRow("HEATING STAGE", "heating-stage", "CALC")}${dataRow("COOLING STAGE", "cooling-stage", "CALC")}${dataRow("RUNTIME", "runtime", "SIM")}`)}
        ${accordion("sensors", "04", "SENSORS", `${pointRow("T_ZONE", "sensor-zone")}${pointRow("RH_ZONE", "sensor-rh")}${pointRow("CO2_ZONE", "sensor-co2")}${pointRow("VOC_ZONE", "sensor-voc")}${pointRow("PM2.5_ZONE", "sensor-pm25")}${pointRow("T_SUPPLY", "sensor-supply")}${pointRow("T_RETURN", "sensor-return")}${pointRow("T_OUTSIDE", "sensor-outdoor", "LIVE")}${pointRow("OCC", "sensor-occ")}`)}
        ${accordion("actuators", "05", "ACTUATORS", `${actuatorRow("OA DAMPER", "oa-damper-command")}${dataRow("OA POSITION", "oa-damper-position", "FB")}${actuatorRow("RA DAMPER", "ra-damper-command")}${dataRow("RA POSITION", "ra-damper-position", "FB")}${actuatorRow("HEATING VALVE", "heating-valve-command")}${dataRow("HEAT VALVE FB", "heating-valve-position", "FB")}${actuatorRow("COOLING VALVE", "cooling-valve-command")}${dataRow("COOL VALVE FB", "cooling-valve-position", "FB")}${actuatorRow("ZONE DAMPER", "zone-damper-command")}${dataRow("ZONE POSITION", "zone-damper-position", "FB")}${actuatorRow("FAN COMMAND", "actuator-fan")}`)}
        ${accordion("control", "06", "BAS CONTROL", `<div class="bas-control-block"><p>SETPOINT MODE</p><div class="bas-mode-switch" role="group" aria-label="Setpoint mode"><button type="button" data-bas-setpoint-mode="SCHEDULE" aria-pressed="true">SCHEDULE</button><button type="button" data-bas-setpoint-mode="MANUAL" aria-pressed="false">MANUAL</button></div>${setpointControl("heat", "HEATING SP")}${setpointControl("cool", "COOLING SP")}</div>${dataRow("SETPOINT SOURCE", "setpoint-source", "CALC", "setpoint-source")}${dataRow("OCCUPANCY MODE", "occupancy-mode", "CALC")}${dataRow("HEATING DEMAND", "heating-demand", "CALC")}${dataRow("COOLING DEMAND", "cooling-demand", "CALC")}${dataRow("CURRENT DEMAND", "current-demand", "CALC")}${dataRow("FAN COMMAND", "control-fan", "CMD")}${dataRow("SYSTEM RESPONSE", "system-response", "CALC", "system-response")}`)}
        ${accordion("iaq", "07", "AIR QUALITY / IAQ", `<p class="bas-sim-note">INDOOR VALUES = SIMULATED BUILDING SENSORS / OUTDOOR AQI = LIVE WHEN AVAILABLE</p><div class="bas-panel-subheading">INDOOR AIR QUALITY / SIM</div>${dataRow("CO₂", "iaq-co2")}${dataRow("VOC", "iaq-voc")}${dataRow("PM2.5", "iaq-pm25")}${dataRow("INDOOR RH", "iaq-rh")}${dataRow("IAQ STATUS", "iaq-status", "CALC", "iaq-status")}${dataRow("PRIMARY CAUSE", "iaq-cause", "CALC")}<div class="bas-panel-subheading">OUTDOOR AIR QUALITY / LIVE</div>${dataRow("OUTDOOR AQI", "outdoor-aqi", "LIVE")}${dataRow("OUTDOOR PM2.5", "outdoor-pm25", "LIVE")}${dataRow("OUTDOOR STATUS", "outdoor-aq-status", "LIVE", "outdoor-aq-status")}${dataRow("AQ DATA", "outdoor-aq-live", "LIVE", "outdoor-aq-live")}<div class="bas-panel-subheading">VENTILATION RESPONSE / CALC + CMD</div>${dataRow("VENTILATION DEMAND", "vent-demand", "CALC", "vent-demand")}${dataRow("VENTILATION STRATEGY", "vent-strategy", "CALC")}${dataRow("VENTILATION WARNING", "vent-warning", "CALC")}`)}
        ${accordion("schedule", "08", "OCCUPANCY / SCHEDULE", `<div class="bas-schedule-rules"><span>MON–FRI / 06:30 MORNING OCCUPIED</span><span>MON–FRI / 08:30 UNOCCUPIED</span><span>MON–FRI / 17:00 OCCUPIED</span><span>MON–FRI / 23:00 NIGHT SETBACK</span><span>WEEKEND / 08:00 OCCUPIED</span><span>WEEKEND / 23:30 NIGHT SETBACK</span></div>${dataRow("CURRENT SCHEDULE", "schedule-type", "CALC")}${dataRow("PERIOD", "schedule-period", "CALC")}${dataRow("OCCUPANCY", "schedule-occupancy")}${dataRow("NEXT EVENT", "schedule-next", "CALC")}`)}
        ${accordion("maintenance", "09", "PREVENTIVE MAINTENANCE", `<p class="bas-sim-note">CONDITION STATUS IS CALCULATED FROM SIMULATED BAS POINTS, RUNTIME, COMMAND / FEEDBACK AND TRENDS.</p><div class="bas-maint-summary">${dataRow("EQUIPMENT MONITORED", "maintenance-monitored", "CALC")}${dataRow("NORMAL", "maintenance-normal", "CALC")}${dataRow("WATCH", "maintenance-watch", "CALC")}${dataRow("SERVICE DUE", "maintenance-service", "CALC")}${dataRow("FAULT", "maintenance-fault", "CALC")}${dataRow("ACTIVE INDICATIONS", "maintenance-alerts", "CALC")}</div><div class="bas-maintenance-list" data-bas-maintenance-list></div>`)}
        ${accordion("status", "10", "SYSTEM STATUS", `${dataRow("BAS STATUS", "status-bas", "CALC", "status-bas")}${dataRow("CONTROL LOOP", "status-loop", "CALC", "status-loop")}${dataRow("WEATHER DATA", "status-weather", "LIVE", "status-weather")}${dataRow("OUTDOOR AQ DATA", "status-aq", "LIVE", "status-aq")}${dataRow("SCHEDULE", "status-schedule", "CALC", "status-schedule")}${dataRow("ALARMS", "status-alarms", "CALC")}${dataRow("SYSTEM HEALTH", "status-health", "CALC", "status-health")}`)}
      </section><aside class="bas-visualization" aria-label="Residential digital twin placeholder"><div class="bas-visual-topbar"><span>LIVE HOME VIEW</span><b>VIEW_01</b></div><section class="bas-twin-screen" data-bas-twin-mount><div class="bas-twin-grid" aria-hidden="true"></div><div class="bas-twin-empty"><span>RESIDENTIAL<br />DIGITAL TWIN</span><b>2D HOME VIEW</b><small>NEXT PHASE</small></div><dl class="bas-twin-readout"><div><dt>OCCUPANCY</dt><dd data-bas-value="twin-occupancy">—</dd></div><div><dt>ZONE TEMP</dt><dd data-bas-value="twin-temp">—</dd></div><div><dt>HVAC MODE</dt><dd data-bas-value="twin-mode">—</dd></div><div><dt>IAQ STATUS</dt><dd data-bas-value="twin-iaq">—</dd></div></dl></section><p class="bas-future-note">RESERVED MOUNT / FUTURE 2D RESIDENTIAL HOME</p></aside></main>
    </article>`;
    page.querySelector("[data-bas-close]")?.addEventListener("click", () => close());
    page.querySelectorAll(".bas-accordion-toggle").forEach((toggle) => toggle.addEventListener("click", () => toggleSection(toggle.closest(".bas-accordion")?.dataset.basSection)));
    page.querySelectorAll("[data-bas-setpoint-mode]").forEach((button) => button.addEventListener("click", () => setSetpointMode(button.dataset.basSetpointMode)));
    page.querySelectorAll("[data-bas-adjust]").forEach((button) => button.addEventListener("click", () => adjustSetpoint(button.dataset.basAdjust, Number(button.dataset.basDirection))));
    page.querySelectorAll("[data-bas-setpoint-input]").forEach((input) => {
      const commitSetpoint = () => setManualSetpoint(input.dataset.basSetpointInput, input.value);
      input.addEventListener("input", commitSetpoint);
      input.addEventListener("change", commitSetpoint);
    });
    expandedSections.forEach((id) => setSectionState(id, true));
    renderState();
  }

  /* Extended event, safety and energy presentation. This intentionally reuses the original BAS shell and point helpers. */
  function buildPage() {
    const page = root(); if (!page) return;
    const safetyContent = `<p class="bas-sim-note">SIMULATED SAFETY POINTS / EDUCATIONAL BAS MONITORING ONLY. CERTIFIED FURNACE SAFETY INTERLOCKS REMAIN EQUIPMENT HARDWARE.</p><div class="bas-panel-subheading">GAS DETECTOR / SIM</div>${dataRow("GAS LEVEL", "safety-gas")}${dataRow("SIGNAL", "safety-gas-signal", "FB")}${dataRow("DEVICE STATUS", "safety-gas-device", "FB")}${dataRow("SELF TEST", "safety-gas-test")}${dataRow("HEALTH", "safety-gas-health", "CALC", "safety-gas-health")}<div class="bas-panel-subheading">CARBON MONOXIDE SENSOR / SIM</div>${dataRow("CO LEVEL", "safety-co")}${dataRow("SIGNAL", "safety-co-signal", "FB")}${dataRow("DEVICE STATUS", "safety-co-device", "FB")}${dataRow("HEALTH", "safety-co-health", "CALC", "safety-co-health")}<div class="bas-panel-subheading">FURNACE PROVING SEQUENCE / SIM</div>${dataRow("SEQUENCE", "safety-sequence", "CALC")}${dataRow("FURNACE STATUS", "safety-burner", "FB")}${dataRow("FURNACE ENABLE", "safety-lockout", "CALC", "safety-lockout")}${dataRow("INDUCER COMMAND", "safety-inducer", "CMD")}${dataRow("DRAFT PROOF", "safety-draft", "FB")}${dataRow("FLAME EXPECTED", "safety-flame-command", "CMD")}${dataRow("FLAME PROVEN", "safety-flame-proven", "FB")}${dataRow("FLAME SENSOR HEALTH", "safety-flame-health", "CALC", "safety-flame-health")}${dataRow("FLAME CURRENT", "safety-flame-current")}${dataRow("LAST PROOF", "safety-last-proof")}${dataRow("GAS VALVE CMD", "safety-gas-valve-command", "CMD")}${dataRow("GAS VALVE FB", "safety-gas-valve-feedback", "FB")}${dataRow("HIGH LIMIT", "safety-high-limit", "FB", "safety-high-limit")}`;
    const energyContent = `<p class="bas-sim-note">REAL-TIME LOADS + SIMULATED HISTORICAL DATA. THIS INTERFACE IS NOT CONNECTED TO A UTILITY METER.</p><div class="bas-energy-highlight"><span>CURRENT ENERGY USE</span><div><b>ELECTRICITY <em data-bas-value="energy-power">—</em></b><b>GAS <em data-bas-value="energy-gas-flow">—</em></b><b>HVAC MODE <em data-bas-value="hvac-mode">—</em></b><b>OUTDOOR <em data-bas-value="outdoor-temp">—</em></b></div></div><div class="bas-panel-subheading">ELECTRICAL / SIM + CALC</div>${dataRow("LINE VOLTAGE", "energy-voltage")}${dataRow("CURRENT", "energy-current", "CALC")}${dataRow("REAL POWER", "energy-power", "CALC")}${dataRow("APPARENT POWER", "energy-apparent", "CALC")}${dataRow("POWER FACTOR", "energy-pf", "CALC")}${dataRow("HVAC POWER", "energy-hvac-power", "CALC")}${dataRow("HVAC SHARE", "energy-hvac-share", "CALC")}<div class="bas-panel-subheading">HVAC ELECTRICAL LOAD / CALC</div>${dataRow("SUPPLY FAN", "energy-fan-power", "CALC")}${dataRow("COMPRESSOR", "energy-compressor-power", "CALC")}${dataRow("INDUCER", "energy-inducer-power", "CALC")}${dataRow("CONTROLS", "energy-controls-power", "CALC")}<div class="bas-panel-subheading">NATURAL GAS / SIM</div>${dataRow("CURRENT GAS FLOW", "energy-gas-flow")}${dataRow("BURNER RUNTIME", "energy-burner-runtime")}<div class="bas-energy-table"><div><span></span><b>TODAY</b><b>MONTH</b><b>YEAR</b></div><div><span>ELECTRICITY</span><b data-bas-value="energy-electric-today">—</b><b data-bas-value="energy-electric-month">—</b><b data-bas-value="energy-electric-year">—</b></div><div><span>NATURAL GAS</span><b data-bas-value="energy-gas-today">—</b><b data-bas-value="energy-gas-month">—</b><b data-bas-value="energy-gas-year">—</b></div></div>${dataRow("TODAY PEAK DEMAND", "energy-peak-today", "CALC")}${dataRow("MONTH PEAK DEMAND", "energy-peak-month", "CALC")}${dataRow("EST. ENERGY COST", "energy-cost", "CALC")}<div class="bas-panel-subheading">RUNTIME / STARTS / SIM</div>${dataRow("FURNACE STARTS TODAY", "energy-furnace-starts")}${dataRow("COMPRESSOR STARTS TODAY", "energy-compressor-starts")}${dataRow("FAN STARTS TODAY", "energy-fan-starts")}${dataRow("SUPPLY FAN RUNTIME", "energy-fan-runtime")}${dataRow("COMPRESSOR RUNTIME", "energy-compressor-runtime")}`;
    const maintenanceContent = `<p class="bas-sim-note">CONDITION STATUS IS CALCULATED FROM SIMULATED BAS POINTS, RUNTIME, COMMAND / FEEDBACK AND TRENDS.</p><div class="bas-maint-summary">${dataRow("EQUIPMENT MONITORED", "maintenance-monitored", "CALC")}${dataRow("NORMAL", "maintenance-normal", "CALC")}${dataRow("WATCH", "maintenance-watch", "CALC")}${dataRow("SERVICE DUE", "maintenance-service", "CALC")}${dataRow("FAULT", "maintenance-fault", "CALC")}${dataRow("ACTIVE INDICATIONS", "maintenance-alerts", "CALC")}${dataRow("FILTER ΔP", "maintenance-filter-dp")}${dataRow("FILTER RUNTIME", "maintenance-filter-runtime")}${dataRow("LAST FILTER SERVICE", "maintenance-last-filter")}</div><button class="bas-service-button" type="button" data-bas-filter-replace>FILTER REPLACED</button><div class="bas-maintenance-list" data-bas-maintenance-list></div>`;
    page.innerHTML = `<article class="bas-shell"><header class="bas-topbar"><div class="bas-title"><p>BUILDING AUTOMATION SYSTEM / RESIDENTIAL</p><h1>RESIDENTIAL BUILDING<br /><span>AUTOMATION SYSTEM</span></h1><strong>LIVE DIGITAL TWIN</strong></div><div class="bas-live-strip"><span class="bas-online"><i></i>BAS ONLINE</span><span>KITCHENER, ON</span><span><b data-bas-value="header-time">--:--:--</b><small data-bas-value="header-date">—</small></span><span class="bas-weather"><b data-bas-value="header-weather">CONNECTING</b><small>LIVE WEATHER / <i data-bas-value="weather-status">CONNECTING</i></small></span></div><div class="bas-control-mode"><span>CONTROL BASELINE</span><b>RULE-BASED / NON-AI</b><button type="button" data-bas-close aria-label="Close Residential Building Automation System">×</button></div></header><section class="bas-event-center" aria-label="System event notification center"><div class="bas-event-heading"><span>SYSTEM EVENTS</span><b><i></i><span data-bas-value="event-total">0</span> ACTIVE</b></div><div class="bas-event-actions"><button type="button" data-bas-event-filter="ALARM"><span>ALARM</span><b data-bas-value="event-alarm">0</b></button><button type="button" data-bas-event-filter="WARNING"><span>WARNING</span><b data-bas-value="event-warning">0</b></button><button type="button" data-bas-event-filter="FAULT"><span>FAULT</span><b data-bas-value="event-fault">0</b></button><button type="button" data-bas-event-filter="MAINTENANCE"><span>MAINTENANCE</span><b data-bas-value="event-maintenance">0</b></button></div></section><section class="bas-event-drawer" data-bas-event-drawer aria-live="polite"><div class="bas-event-drawer-heading"><span>ACTIVE EVENTS</span><b>ACKNOWLEDGEMENT DOES NOT CLEAR THE UNDERLYING CONDITION</b><button type="button" data-bas-event-close aria-label="Close system events">×</button></div><div data-bas-event-list></div></section><main class="bas-workspace"><section class="bas-operator" aria-label="BAS information and control stack"><div class="bas-operator-heading"><span>OPERATOR STACK / LIVE WEATHER + SIMULATED BAS POINTS</span><b>MULTI-EXPAND VIEW</b></div>${accordion("outdoor", "01", "OUTDOOR CONDITIONS", `${dataRow("LOCATION", "outdoor-location", "LIVE")}${dataRow("OUTDOOR TEMP", "outdoor-temp", "LIVE")}${dataRow("OUTDOOR RH", "outdoor-rh", "LIVE")}${dataRow("CONDITION", "outdoor-condition", "LIVE")}${dataRow("WIND", "outdoor-wind", "LIVE")}${dataRow("DATE / TIME", "outdoor-time", "CALC")}`)}${accordion("home", "02", "HOME CONDITIONS", `${dataRow("INDOOR TEMP", "home-temp")}${dataRow("INDOOR RH", "home-rh")}${dataRow("CO₂", "home-co2")}${dataRow("HEATING SP", "heat-sp", "CMD")}${dataRow("COOLING SP", "cool-sp", "CMD")}${dataRow("SUPPLY AIR", "supply-temp")}${dataRow("RETURN AIR", "return-temp")}${dataRow("CURRENT OCCUPANCY", "occupancy")}`)}${accordion("hvac", "03", "HVAC SYSTEM", `${dataRow("MODE", "hvac-mode", "CALC", "hvac-mode")}${dataRow("HEATING", "heating", "FB", "heating")}${dataRow("COOLING", "cooling", "FB", "cooling")}${dataRow("SUPPLY FAN", "supply-fan", "FB", "supply-fan")}${dataRow("FAN COMMAND", "fan-command", "CMD")}${dataRow("FAN FEEDBACK", "fan-status", "FB", "fan-status")}${dataRow("COMPRESSOR", "compressor", "FB", "compressor")}${dataRow("HEATING STAGE", "heating-stage", "CALC")}${dataRow("COOLING STAGE", "cooling-stage", "CALC")}${dataRow("RUNTIME", "runtime")}`)}${accordion("iaq", "04", "AIR QUALITY / IAQ", `<p class="bas-sim-note">INDOOR VALUES = SIMULATED BUILDING SENSORS / OUTDOOR AQI = LIVE WHEN AVAILABLE</p><div class="bas-panel-subheading">INDOOR AIR QUALITY / SIM</div>${dataRow("CO₂", "iaq-co2")}${dataRow("VOC", "iaq-voc")}${dataRow("PM2.5", "iaq-pm25")}${dataRow("INDOOR RH", "iaq-rh")}${dataRow("IAQ STATUS", "iaq-status", "CALC", "iaq-status")}${dataRow("PRIMARY CAUSE", "iaq-cause", "CALC")}<div class="bas-panel-subheading">OUTDOOR AIR QUALITY / LIVE</div>${dataRow("OUTDOOR AQI", "outdoor-aqi", "LIVE")}${dataRow("OUTDOOR PM2.5", "outdoor-pm25", "LIVE")}${dataRow("OUTDOOR STATUS", "outdoor-aq-status", "LIVE", "outdoor-aq-status")}${dataRow("AQ DATA", "outdoor-aq-live", "LIVE", "outdoor-aq-live")}<div class="bas-panel-subheading">VENTILATION RESPONSE / CALC + CMD</div>${dataRow("VENTILATION DEMAND", "vent-demand", "CALC", "vent-demand")}${dataRow("VENTILATION STRATEGY", "vent-strategy", "CALC")}${dataRow("VENTILATION WARNING", "vent-warning", "CALC")}`)}${accordion("sensors", "05", "SENSORS", `${pointRow("T_ZONE", "sensor-zone")}${pointRow("RH_ZONE", "sensor-rh")}${pointRow("CO2_ZONE", "sensor-co2")}${pointRow("VOC_ZONE", "sensor-voc")}${pointRow("PM2.5_ZONE", "sensor-pm25")}${pointRow("T_SUPPLY", "sensor-supply")}${pointRow("T_RETURN", "sensor-return")}${pointRow("T_OUTSIDE", "sensor-outdoor", "LIVE")}${pointRow("OCC", "sensor-occ")}`)}${accordion("actuators", "06", "ACTUATORS", `${actuatorRow("OA DAMPER", "oa-damper-command")}${dataRow("OA POSITION", "oa-damper-position", "FB")}${actuatorRow("RA DAMPER", "ra-damper-command")}${dataRow("RA POSITION", "ra-damper-position", "FB")}${actuatorRow("HEATING VALVE", "heating-valve-command")}${dataRow("HEAT VALVE FB", "heating-valve-position", "FB")}${actuatorRow("COOLING VALVE", "cooling-valve-command")}${dataRow("COOL VALVE FB", "cooling-valve-position", "FB")}${actuatorRow("ZONE DAMPER", "zone-damper-command")}${dataRow("ZONE POSITION", "zone-damper-position", "FB")}${actuatorRow("FAN COMMAND", "actuator-fan")}`)}${accordion("safety", "07", "COMBUSTION & GAS SAFETY", safetyContent)}${accordion("control", "08", "BAS CONTROL", `<div class="bas-control-block"><p>SETPOINT MODE</p><div class="bas-mode-switch" role="group" aria-label="Setpoint mode"><button type="button" data-bas-setpoint-mode="SCHEDULE" aria-pressed="true">SCHEDULE</button><button type="button" data-bas-setpoint-mode="MANUAL" aria-pressed="false">MANUAL</button></div>${setpointControl("heat", "HEATING SP")}${setpointControl("cool", "COOLING SP")}</div>${dataRow("SETPOINT SOURCE", "setpoint-source", "CALC", "setpoint-source")}${dataRow("OCCUPANCY MODE", "occupancy-mode", "CALC")}${dataRow("HEATING DEMAND", "heating-demand", "CALC")}${dataRow("COOLING DEMAND", "cooling-demand", "CALC")}${dataRow("CURRENT DEMAND", "current-demand", "CALC")}${dataRow("FAN COMMAND", "control-fan", "CMD")}${dataRow("SYSTEM RESPONSE", "system-response", "CALC", "system-response")}`)}${accordion("schedule", "09", "OCCUPANCY / SCHEDULE", `<div class="bas-schedule-rules"><span>MON–FRI / 06:30 MORNING OCCUPIED</span><span>MON–FRI / 08:30 UNOCCUPIED</span><span>MON–FRI / 17:00 OCCUPIED</span><span>MON–FRI / 23:00 NIGHT SETBACK</span><span>WEEKEND / 08:00 OCCUPIED</span><span>WEEKEND / 23:30 NIGHT SETBACK</span></div>${dataRow("CURRENT SCHEDULE", "schedule-type", "CALC")}${dataRow("PERIOD", "schedule-period", "CALC")}${dataRow("OCCUPANCY", "schedule-occupancy")}${dataRow("NEXT EVENT", "schedule-next", "CALC")}`)}${accordion("energy", "10", "ENERGY & UTILITIES", energyContent)}${accordion("maintenance", "11", "PREVENTIVE MAINTENANCE", maintenanceContent)}${accordion("status", "12", "SYSTEM STATUS", `${dataRow("BAS STATUS", "status-bas", "CALC", "status-bas")}${dataRow("CONTROL LOOP", "status-loop", "CALC", "status-loop")}${dataRow("WEATHER DATA", "status-weather", "LIVE", "status-weather")}${dataRow("OUTDOOR AQ DATA", "status-aq", "LIVE", "status-aq")}${dataRow("SCHEDULE", "status-schedule", "CALC", "status-schedule")}${dataRow("SAFETY ALARMS", "status-alarms", "CALC")}${dataRow("SYSTEM HEALTH", "status-health", "CALC", "status-health")}`)}</section><aside class="bas-visualization" aria-label="Residential digital twin placeholder"><div class="bas-visual-topbar"><span>LIVE HOME VIEW</span><b>VIEW_01</b></div><section class="bas-twin-screen" data-bas-twin-mount><div class="bas-twin-grid" aria-hidden="true"></div><div class="bas-twin-empty"><span>RESIDENTIAL<br />DIGITAL TWIN</span><b>2D HOME VIEW</b><small>NEXT PHASE</small></div><dl class="bas-twin-readout"><div><dt>OCCUPANCY</dt><dd data-bas-value="twin-occupancy">—</dd></div><div><dt>ZONE TEMP</dt><dd data-bas-value="twin-temp">—</dd></div><div><dt>HVAC MODE</dt><dd data-bas-value="twin-mode">—</dd></div><div><dt>IAQ STATUS</dt><dd data-bas-value="twin-iaq">—</dd></div><div><dt>POWER</dt><dd data-bas-value="twin-power">—</dd></div><div><dt>GAS FLOW</dt><dd data-bas-value="twin-gas">—</dd></div></dl></section><p class="bas-future-note">RESERVED MOUNT / FUTURE 2D RESIDENTIAL HOME</p></aside></main><div class="bas-confirm" data-bas-service-confirm aria-hidden="true" role="dialog" aria-modal="true" aria-label="Confirm filter replacement"><section><p>CONFIRM MAINTENANCE ACTION</p><h2>AIR FILTER REPLACED?</h2><span>CONFIRMING RESETS FILTER RUNTIME, LOADING AND DIFFERENTIAL PRESSURE. THIS DOES NOT AUTO-ASSUME SERVICE.</span><div><button type="button" data-bas-cancel-filter>CANCEL</button><button type="button" data-bas-confirm-filter>CONFIRM</button></div></section></div></article>`;
    page.querySelector("[data-bas-close]")?.addEventListener("click", () => close());
    page.querySelectorAll(".bas-accordion-toggle").forEach((toggle) => toggle.addEventListener("click", () => toggleSection(toggle.closest(".bas-accordion")?.dataset.basSection)));
    page.querySelectorAll("[data-bas-setpoint-mode]").forEach((button) => button.addEventListener("click", () => setSetpointMode(button.dataset.basSetpointMode)));
    page.querySelectorAll("[data-bas-adjust]").forEach((button) => button.addEventListener("click", () => adjustSetpoint(button.dataset.basAdjust, Number(button.dataset.basDirection))));
    page.querySelectorAll("[data-bas-setpoint-input]").forEach((input) => {
      const commitSetpoint = () => setManualSetpoint(input.dataset.basSetpointInput, input.value);
      input.addEventListener("input", commitSetpoint);
      input.addEventListener("change", commitSetpoint);
    });
    installTwin(page);
    page.querySelectorAll("[data-bas-event-filter]").forEach((button) => button.addEventListener("click", () => { eventDrawerFilter = button.dataset.basEventFilter; page.querySelector("[data-bas-event-drawer]")?.classList.add("is-open"); renderEvents(); }));
    page.querySelector("[data-bas-event-close]")?.addEventListener("click", () => { eventDrawerFilter = null; page.querySelector("[data-bas-event-drawer]")?.classList.remove("is-open"); renderEvents(); });
    page.querySelector("[data-bas-filter-replace]")?.addEventListener("click", () => setServiceConfirmation(true));
    page.querySelector("[data-bas-cancel-filter]")?.addEventListener("click", () => setServiceConfirmation(false));
    page.querySelector("[data-bas-confirm-filter]")?.addEventListener("click", replaceFilter);
    expandedSections.forEach((id) => setSectionState(id, true));
    renderState();
  }

  function twinSensor(id, x, y, tag, label, zone) {
    return `<g class="twin-point twin-point--sensor twin-zone-${zone}" tabindex="0" role="button" data-bas-twin-point="${id}" aria-label="${label}"><circle cx="${x}" cy="${y}" r="8" /><circle cx="${x}" cy="${y}" r="3" /><text x="${x + 12}" y="${y + 3}">${tag}</text></g>`;
  }

  function twinEquipment(id, x, y, width, height, label, zone, className = "") {
    return `<g class="twin-equipment twin-zone-${zone} ${className}" tabindex="0" role="button" data-bas-twin-equipment="${id}" aria-label="${label}"><rect x="${x}" y="${y}" width="${width}" height="${height}" rx="3" /><path d="M ${x + 7} ${y + height * .42} H ${x + width - 7} M ${x + 7} ${y + height * .63} H ${x + width - 7}" /><text x="${x + width / 2}" y="${y + height + 14}">${label}</text></g>`;
  }

  function buildTwinMarkup() {
    const layers = TWIN_LAYERS.map((layer) => `<button type="button" data-bas-twin-layer="${layer}" aria-pressed="${layer === twinState.layer}">${layer}</button>`).join("");
    const views = TWIN_VIEWS.map((view) => `<button type="button" data-bas-twin-view="${view}" aria-pressed="${view === twinState.view}">${view === "WHOLE" ? "WHOLE HOUSE" : view}</button>`).join("");
    return `<div class="bas-twin" data-bas-twin data-layer="${twinState.layer}" data-view="${twinState.view}" data-hvac-mode="STANDBY">
      <div class="bas-twin-controls">
        <div class="bas-twin-control-group" role="group" aria-label="Digital twin visualization layer"><span>LAYERS</span><div>${layers}</div></div>
        <div class="bas-twin-control-group bas-twin-control-group--views" role="group" aria-label="Digital twin room view"><span>VIEW</span><div>${views}</div></div>
      </div>
      <section class="bas-twin-stage" data-bas-twin-stage aria-label="Interactive residential HVAC digital twin">
        <div class="bas-twin-grid" aria-hidden="true"></div>
        <svg class="bas-twin-svg" viewBox="0 0 840 590" role="img" aria-label="Residential forced-air HVAC digital twin showing rooms, ductwork and BAS points">
          <defs>
            <pattern id="twinBlueprintPattern" width="20" height="20" patternUnits="userSpaceOnUse"><path d="M 20 0 H 0 V 20" fill="none" stroke="rgba(85,213,255,.13)" stroke-width=".65" /></pattern>
            <marker id="twinSupplyArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#4eeaff" /></marker>
            <marker id="twinReturnArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0 L7,3.5 L0,7 Z" fill="#6d9aac" /></marker>
          </defs>
          <g class="twin-home-layer">
            <path class="twin-shell" d="M93 83 L130 45 H710 L748 83 V526 H93 Z" />
            <path class="twin-floor" d="M93 209 H748 M93 370 H748" />
            <path class="twin-wall" d="M390 83 V209 M535 83 V209 M397 209 V370 M598 209 V370 M300 370 V526" />
            <path class="twin-stairs" d="M118 233 H174 V338 H118 M132 247 H174 M132 263 H174 M132 279 H174 M132 295 H174 M132 311 H174 M132 327 H174" />
            <path class="twin-window" d="M208 82 V113 M245 82 V113 M630 82 V113 M667 82 V113 M657 259 H718" />
            <g class="twin-room-labels"><text x="195" y="143">BEDROOM 01</text><text x="438" y="143">BEDROOM / OFFICE</text><text x="253" y="290">HALL / LIVING</text><text x="535" y="290">KITCHEN</text><text x="486" y="458">BASEMENT MECHANICAL</text><text x="133" y="494">UTILITY / RETURN RISER</text></g>
            <rect class="twin-room-fill twin-room-fill--hall" x="177" y="226" width="211" height="126" /><rect class="twin-room-fill twin-room-fill--kitchen" x="410" y="226" width="173" height="126" /><rect class="twin-room-fill twin-room-fill--bedroom" x="117" y="99" width="260" height="91" />
          </g>
          <g class="twin-hvac-layer">
            <path class="twin-return-duct" d="M354 320 H329 V411 H358 M690 319 H646 V411 H358 M246 190 V203 H329 V411 H358" />
            <path class="twin-supply-duct" d="M625 443 H676 V395 H707 M625 443 H564 V383 H456 V347 M564 383 V197 H505 M456 383 V320 H288" />
            <path class="twin-return-air" marker-end="url(#twinReturnArrow)" d="M354 320 H329 V411 H358" />
            <path class="twin-return-air twin-return-air--kitchen" marker-end="url(#twinReturnArrow)" d="M690 319 H646 V411 H358" />
            <path class="twin-supply-air" marker-end="url(#twinSupplyArrow)" d="M625 443 H676 V395 H707" />
            <path class="twin-supply-air twin-supply-air--hall" marker-end="url(#twinSupplyArrow)" d="M564 383 V320 H288" />
            <path class="twin-supply-air twin-supply-air--upper" marker-end="url(#twinSupplyArrow)" d="M564 383 V197 H505" />
            <path class="twin-refrigerant" d="M716 488 C744 468 736 438 657 432 M716 502 C741 513 713 528 656 454" />
            <path class="twin-combustion" d="M399 498 H430 V466 H468 M468 492 H490 V461 H507 M507 457 V406 H489" />
            <path class="twin-flue" d="M506 406 V384 H529 V369" />
            <g class="twin-registers"><rect x="280" y="338" width="20" height="8" /><rect x="495" y="191" width="20" height="8" /><rect x="701" y="391" width="20" height="8" /><rect x="347" y="316" width="16" height="8" /><rect x="684" y="315" width="16" height="8" /></g>
            <g class="twin-duct-labels"><text x="220" y="306">RETURN GRILLE</text><text x="496" y="180">SUPPLY REGISTER</text><text x="583" y="367">SUPPLY TRUNK</text><text x="602" y="424">SUPPLY PLENUM</text><text x="218" y="405">RETURN TRUNK</text><text x="696" y="531">OUTDOOR AC</text></g>
            ${twinEquipment("filter", 358, 416, 53, 49, "FILTER-01", "basement", "twin-equipment--filter")}
            ${twinEquipment("blower", 425, 416, 58, 49, "BLOWER-01", "basement")}
            ${twinEquipment("furnace", 493, 405, 63, 61, "FURNACE-01", "basement", "twin-equipment--furnace")}
            ${twinEquipment("coil", 572, 416, 53, 49, "A-COIL-01", "basement", "twin-equipment--coil")}
            ${twinEquipment("condenser", 687, 476, 62, 45, "COND-01", "basement", "twin-equipment--condenser")}
            <g class="twin-gas-train twin-zone-basement"><rect x="370" y="490" width="48" height="17" rx="3" /><text x="394" y="517">GAS VALVE</text><circle cx="443" cy="476" r="10" /><text x="443" y="494">INDUCER</text><text x="529" y="357">FLUE</text></g>
          </g>
          <g class="twin-bas-layer">
            ${twinSensor("zt-hall", 230, 270, "ZT-01", "Hall temperature sensor", "hall")}
            ${twinSensor("rh-hall", 271, 302, "RH-01", "Hall humidity sensor", "hall")}
            ${twinSensor("co2-hall", 326, 270, "CO2-01", "Hall carbon dioxide sensor", "hall")}
            ${twinSensor("occ-hall", 201, 329, "OCC-01", "Hall occupancy sensor", "hall")}
            ${twinSensor("zt-kitchen", 478, 270, "ZT-K01", "Kitchen temperature sensor", "kitchen")}
            ${twinSensor("iaq-kitchen", 551, 315, "IAQ-K", "Kitchen IAQ sensor", "kitchen")}
            ${twinSensor("zt-bedroom", 211, 135, "ZT-BR1", "Bedroom temperature sensor", "bedroom")}
            ${twinSensor("co2-bedroom", 322, 165, "CO2-BR1", "Bedroom carbon dioxide sensor", "bedroom")}
            ${twinSensor("tra", 323, 431, "T-RA", "Return air temperature sensor", "basement")}
            ${twinSensor("tsa", 647, 395, "T-SA", "Supply air temperature sensor", "basement")}
            ${twinSensor("filter-dp", 385, 408, "DP-F", "Filter differential pressure sensor", "basement")}
            ${twinSensor("oa-damper", 646, 442, "OA-DMP", "Outdoor air damper actuator", "basement")}
          </g>
        </svg>
        <div class="bas-twin-faceplate" data-bas-twin-faceplate aria-live="polite"></div>
        <div class="bas-twin-legend" aria-label="Digital twin visual legend"><span class="is-supply">SUPPLY AIR</span><span class="is-return">RETURN AIR</span><span class="is-refrigerant">REFRIGERANT</span><span class="is-combustion">COMBUSTION / FLUE</span><span class="is-sensor">SENSOR</span><span class="is-equipment">EQUIPMENT</span></div>
      </section>
      <dl class="bas-twin-readout"><div><dt>OCCUPANCY</dt><dd data-bas-value="twin-occupancy">—</dd></div><div><dt>ZONE TEMP</dt><dd data-bas-value="twin-temp">—</dd></div><div><dt>HVAC MODE</dt><dd data-bas-value="twin-mode">—</dd></div><div><dt>IAQ STATUS</dt><dd data-bas-value="twin-iaq">—</dd></div><div><dt>POWER</dt><dd data-bas-value="twin-power">—</dd></div><div><dt>GAS FLOW</dt><dd data-bas-value="twin-gas">—</dd></div></dl>
      <p class="bas-future-note">LIVE SVG DIGITAL TWIN / SYNCHRONIZED WITH BAS STATE</p>
    </div>`;
  }

  function twinFilterStatus() {
    return state.equipmentHealth.find((equipment) => equipment.id === "filter")?.status || (state.maintenance.filterDp >= CONFIG.maintenance.filter.serviceDp ? "SERVICE DUE" : state.maintenance.filterDp >= CONFIG.maintenance.filter.watchDp ? "WATCH" : "NORMAL");
  }

  function twinFaceplate(id) {
    const filterStatus = twinFilterStatus();
    const faces = {
      "zt-hall": ["ZT-01", "HALL TEMPERATURE", displayNumber(state.indoorTemp, "°C"), [["QUALITY", "GOOD"], ["STATUS", state.hvac.mode], ["SOURCE", "SIM"], ["LAST UPDATE", "LIVE"]]],
      "rh-hall": ["RH-01", "HALL HUMIDITY", displayPercent(state.indoorHumidity), [["QUALITY", "GOOD"], ["STATUS", state.indoorIAQ.status], ["SOURCE", "SIM"], ["LAST UPDATE", "LIVE"]]],
      "co2-hall": ["CO2-01", "HALL CARBON DIOXIDE", `${Math.round(state.co2)} ppm`, [["QUALITY", "GOOD"], ["STATUS", state.indoorIAQ.status], ["SOURCE", "SIM"], ["VENT DEMAND", state.ventilation.demand]]],
      "occ-hall": ["OCC-01", "HALL OCCUPANCY", state.schedule.occupancy ? "OCCUPIED" : "UNOCCUPIED", [["SCHEDULE", state.schedule.period], ["COUNT", String(state.schedule.occupancy)], ["SOURCE", "CALC"], ["NEXT", state.schedule.nextEvent]]],
      "zt-kitchen": ["ZT-K01", "KITCHEN TEMPERATURE", displayNumber(state.indoorTemp, "°C"), [["QUALITY", "GOOD"], ["COOKING LOAD", "MODELLED / FUTURE INPUT"], ["SOURCE", "SIM"], ["STATUS", state.hvac.mode]]],
      "iaq-kitchen": ["IAQ-K", "KITCHEN IAQ", state.indoorIAQ.status, [["CO2", `${Math.round(state.co2)} ppm`], ["RH", displayPercent(state.indoorHumidity)], ["VOC", `${Math.round(state.voc)} ppb`], ["PM2.5", displayNumber(state.pm25, "µg/m³")]]],
      "zt-bedroom": ["ZT-BR1", "BEDROOM TEMPERATURE", displayNumber(state.indoorTemp, "°C"), [["QUALITY", "GOOD"], ["SOURCE", "SIM"], ["OCCUPANCY", state.schedule.occupancy ? "OCCUPIED" : "UNOCCUPIED"], ["MODE", state.hvac.mode]]],
      "co2-bedroom": ["CO2-BR1", "BEDROOM CARBON DIOXIDE", `${Math.round(state.co2)} ppm`, [["QUALITY", "GOOD"], ["SOURCE", "SIM"], ["VENT DEMAND", state.ventilation.demand], ["STATUS", state.indoorIAQ.status]]],
      "tra": ["T_RA", "RETURN AIR TEMPERATURE", displayNumber(state.returnTemp, "°C"), [["QUALITY", "GOOD"], ["SOURCE", "SIM"], ["AIRFLOW", displayPercent(state.airflow)], ["FAN CMD", displayPercent(state.hvac.fanCommand)]]],
      "tsa": ["T_SA", "SUPPLY AIR TEMPERATURE", displayNumber(state.supplyTemp, "°C"), [["QUALITY", "GOOD"], ["SOURCE", "SIM"], ["MODE", state.hvac.mode], ["FAN FB", state.hvac.fanStatus]]],
      "filter-dp": ["FILTER-01", "FILTER DIFFERENTIAL", `${Math.round(state.maintenance.filterDp)} Pa`, [["AIRFLOW", displayPercent(state.airflow)], ["RUNTIME", displayHours(state.maintenance.filterRuntimeHours)], ["STATUS", filterStatus], ["LAST SERVICE", state.maintenance.lastFilterService ? eventTimestamp(state.maintenance.lastFilterService) : "NONE"]]],
      "oa-damper": ["OA-DMP", "OUTDOOR AIR DAMPER", displayPercent(state.actuators.oaDamperPosition), [["CMD", displayPercent(state.actuators.oaDamperCommand)], ["FB", displayPercent(state.actuators.oaDamperPosition)], ["VENT DEMAND", state.ventilation.demand], ["STATUS", state.ventilation.strategy]]],
      filter: ["FILTER-01", "AIR FILTER", filterStatus, [["FILTER ΔP", `${Math.round(state.maintenance.filterDp)} Pa`], ["AIRFLOW", displayPercent(state.airflow)], ["RUNTIME", displayHours(state.maintenance.filterRuntimeHours)], ["STATUS", filterStatus]]],
      blower: ["BLOWER-01", "SUPPLY FAN", state.hvac.fanStatus, [["FAN CMD", displayPercent(state.hvac.fanCommand)], ["FAN FB", state.hvac.fanStatus], ["RETURN TEMP", displayNumber(state.returnTemp, "°C")], ["AIRFLOW", displayPercent(state.airflow)]]],
      furnace: ["FURNACE-01", "NATURAL GAS FURNACE", state.hvac.mode, [["BURNER", state.safety.burnerState], ["FLAME PROVEN", state.safety.flameProven ? "YES" : "NO"], ["GAS CMD / FB", `${state.safety.gasValveCommand ? "OPEN" : "CLOSED"} / ${state.safety.gasValveFeedback ? "OPEN" : "CLOSED"}`], ["SUPPLY TEMP", displayNumber(state.supplyTemp, "°C")]]],
      coil: ["A-COIL-01", "EVAPORATOR COIL", state.hvac.cooling ? "COOLING" : "STANDBY", [["COMPRESSOR CMD", state.hvac.compressor ? "ON" : "OFF"], ["COOLING STAGE", String(state.hvac.coolingStage)], ["SUPPLY TEMP", displayNumber(state.supplyTemp, "°C")], ["REFRIGERATION", state.hvac.cooling ? "ACTIVE" : "IDLE"]]],
      condenser: ["COND-01", "OUTDOOR CONDENSER", state.hvac.compressor ? "RUNNING" : "STANDBY", [["STATUS", state.hvac.compressor ? "ON" : "OFF"], ["REFRIGERANT", state.hvac.compressor ? "CIRCUIT ACTIVE" : "CIRCUIT IDLE"], ["SOURCE", "SIM"], ["OUTDOOR", displayNumber(state.weather.temperature, "°C")]]]
    };
    const [tag, title, value, rows] = faces[id] || faces["zt-hall"];
    return `<div><span>${tag}</span><strong>${title}</strong><b>${value}</b>${rows.map(([label, rowValue]) => `<p><span>${label}</span><b>${rowValue}</b></p>`).join("")}</div>`;
  }

  function renderTwin() {
    const page = root(); const twin = page?.querySelector("[data-bas-twin]"); if (!twin) return;
    const mode = state.hvac.mode.startsWith("HEAT") ? "HEATING" : state.hvac.mode === "COOLING" ? "COOLING" : state.hvac.mode === "VENTILATION" ? "VENTILATION" : "STANDBY";
    const filterStatus = twinFilterStatus().replaceAll(" ", "-");
    twin.dataset.layer = twinState.layer;
    twin.dataset.view = twinState.view;
    twin.dataset.hvacMode = mode;
    twin.dataset.filterStatus = filterStatus;
    twin.style.setProperty("--twin-airflow", String(Math.max(0, state.hvac.fanCommand)));
    twin.querySelectorAll("[data-bas-twin-layer]").forEach((button) => { const selected = button.dataset.basTwinLayer === twinState.layer; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
    twin.querySelectorAll("[data-bas-twin-view]").forEach((button) => { const selected = button.dataset.basTwinView === twinState.view; button.classList.toggle("is-selected", selected); button.setAttribute("aria-pressed", String(selected)); });
    twin.querySelectorAll("[data-bas-twin-point], [data-bas-twin-equipment]").forEach((node) => node.classList.toggle("is-selected", node.dataset.basTwinPoint === twinState.selected || node.dataset.basTwinEquipment === twinState.selected));
    const faceplate = twin.querySelector("[data-bas-twin-faceplate]"); if (faceplate) faceplate.innerHTML = twinFaceplate(twinState.selected);
  }

  function setTwinLayer(layer) { if (!TWIN_LAYERS.includes(layer)) return; twinState.layer = layer; renderTwin(); }
  function setTwinView(view) { if (!TWIN_VIEWS.includes(view)) return; twinState.view = view; renderTwin(); }
  function setTwinSelection(id) { if (!id) return; twinState.selected = id; renderTwin(); }

  function bindTwinInteractions(page) {
    page.querySelectorAll("[data-bas-twin-layer]").forEach((button) => button.addEventListener("click", () => setTwinLayer(button.dataset.basTwinLayer)));
    page.querySelectorAll("[data-bas-twin-view]").forEach((button) => button.addEventListener("click", () => setTwinView(button.dataset.basTwinView)));
    page.querySelectorAll("[data-bas-twin-point], [data-bas-twin-equipment]").forEach((node) => {
      const select = () => setTwinSelection(node.dataset.basTwinPoint || node.dataset.basTwinEquipment);
      node.addEventListener("click", select);
      node.addEventListener("keydown", (event) => { if (!["Enter", " "].includes(event.key)) return; event.preventDefault(); select(); });
    });
  }

  function installTwin(page) {
    const visual = page.querySelector(".bas-visualization");
    if (!visual) return;
    visual.setAttribute("aria-label", "Residential HVAC digital twin");
    visual.innerHTML = `<div class="bas-visual-topbar"><span>LIVE HOME VIEW</span><b>SVG / LIVE STATE</b></div>${buildTwinMarkup()}`;
    bindTwinInteractions(page);
  }

  function setSectionState(id, expanded) { const section = root()?.querySelector(`[data-bas-section="${id}"]`); if (!section) return; section.classList.toggle("is-expanded", expanded); section.querySelector(".bas-accordion-toggle")?.setAttribute("aria-expanded", String(expanded)); }
  function toggleSection(id) { if (!id) return; const next = !expandedSections.has(id); if (next) expandedSections.add(id); else expandedSections.delete(id); setSectionState(id, next); }
  function toggleEquipment(id) { if (!id) return; if (expandedEquipment.has(id)) expandedEquipment.delete(id); else expandedEquipment.add(id); renderMaintenance(); }
  function setSetpointMode(mode) { if (!["SCHEDULE", "MANUAL"].includes(mode)) return; state.setpointMode = mode; updateRuleBasedState(0); renderState(); }
  function setManualSetpoint(kind, value) {
    const limits = CONFIG.setpointLimits[kind]; if (!limits) return;
    const separation = CONFIG.setpointLimits.minimumSeparation;
    let next = clamp(Number(value), limits.min, limits.max);
    if (kind === "heat") next = Math.min(next, state.manualSetpoints.cool - separation);
    if (kind === "cool") next = Math.max(next, state.manualSetpoints.heat + separation);
    state.manualSetpoints[kind] = next;
    state.setpointMode = "MANUAL";
    updateRuleBasedState(0);
    renderState();
  }
  function adjustSetpoint(kind, direction) { const limits = CONFIG.setpointLimits[kind]; if (!limits) return; setManualSetpoint(kind, state.manualSetpoints[kind] + limits.step * Math.sign(direction)); }

  async function refreshWeather() {
    if (weatherRequest) return weatherRequest;
    state.weather.status = "CONNECTING"; renderState();
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${CONFIG.location.latitude}&longitude=${CONFIG.location.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&temperature_unit=celsius&wind_speed_unit=kmh&timezone=${encodeURIComponent(CONFIG.location.timezone)}`;
    weatherRequest = fetch(url, { headers: { Accept: "application/json" } }).then((response) => { if (!response.ok) throw new Error(`Weather request failed (${response.status})`); return response.json(); }).then((data) => {
      const current = data?.current; if (!current || !Number.isFinite(current.temperature_2m)) throw new Error("Weather response missing current conditions");
      state.weather = { status: "LIVE", temperature: current.temperature_2m, humidity: current.relative_humidity_2m, condition: WEATHER_CODES[current.weather_code] || `WEATHER CODE ${current.weather_code}`, wind: current.wind_speed_10m, updatedAt: new Date() };
    }).catch(() => { state.weather = { status: "UNAVAILABLE", temperature: null, humidity: null, condition: null, wind: null, updatedAt: null }; }).finally(() => { weatherRequest = null; updateRuleBasedState(0); renderState(); });
    return weatherRequest;
  }
  async function refreshAirQuality() {
    if (airQualityRequest) return airQualityRequest;
    state.outdoorAirQuality.status = "CONNECTING"; renderState();
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${CONFIG.location.latitude}&longitude=${CONFIG.location.longitude}&current=us_aqi,pm2_5&timezone=${encodeURIComponent(CONFIG.location.timezone)}`;
    airQualityRequest = fetch(url, { headers: { Accept: "application/json" } }).then((response) => { if (!response.ok) throw new Error(`Air quality request failed (${response.status})`); return response.json(); }).then((data) => {
      const current = data?.current; if (!current || !Number.isFinite(current.us_aqi) || !Number.isFinite(current.pm2_5)) throw new Error("Air quality response missing current values");
      const aqiLevel = levelFor(current.us_aqi, CONFIG.iaq.outdoorAqi); const pmLevel = levelFor(current.pm2_5, CONFIG.iaq.outdoorPm25); const quality = aqiLevel === "POOR" || pmLevel === "POOR" ? "POOR" : aqiLevel === "MODERATE" || pmLevel === "MODERATE" ? "MODERATE" : "GOOD";
      state.outdoorAirQuality = { status: "LIVE", aqi: current.us_aqi, pm25: current.pm2_5, quality, updatedAt: new Date() };
    }).catch(() => { state.outdoorAirQuality = { status: "UNAVAILABLE", aqi: null, pm25: null, quality: "DATA UNAVAILABLE", updatedAt: null }; }).finally(() => { airQualityRequest = null; updateRuleBasedState(0); renderState(); });
    return airQualityRequest;
  }

  function tick() {
    if (!active) return;
    const now = performance.now(); const delta = Math.max(0, (now - state.lastUpdate) / 1000); state.lastUpdate = now; state.time = new Date(); updateRuleBasedState(delta); renderState();
    if (!state.weather.updatedAt || Date.now() - state.weather.updatedAt.getTime() > CONFIG.weatherRefreshMs) refreshWeather();
    if (!state.outdoorAirQuality.updatedAt || Date.now() - state.outdoorAirQuality.updatedAt.getTime() > CONFIG.weatherRefreshMs) refreshAirQuality();
  }
  function start() { state.lastUpdate = performance.now(); updateRuleBasedState(0); tick(); ticker = window.setInterval(tick, 1000); }
  function stop() { window.clearInterval(ticker); ticker = 0; }
  function open(trigger, options = {}) {
    const page = root(); if (!page || active) return;
    returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement; directRoute = options.directRoute === true; active = true; buildPage(); page.classList.add("is-open"); page.setAttribute("aria-hidden", "false"); document.documentElement.classList.add("is-bas-open"); document.body.classList.add("is-bas-open"); start(); refreshWeather(); refreshAirQuality();
    if (options.history !== false && location.hash !== "#bas") history.pushState({ section: "bas" }, "", "#bas");
    window.requestAnimationFrame(() => page.querySelector("[data-bas-close]")?.focus({ preventScroll: true }));
  }
  function close(options = {}) {
    if (!active) return;
    const useHistory = options.history !== false;
    if (useHistory && location.hash === "#bas" && history.state?.section === "bas" && !directRoute) { history.back(); return; }
    active = false; stop(); root()?.classList.remove("is-open", "is-bas-demand"); root()?.setAttribute("aria-hidden", "true"); root()?.replaceChildren(); document.documentElement.classList.remove("is-bas-open"); document.body.classList.remove("is-bas-open");
    if (useHistory && location.hash === "#bas") history.replaceState({ section: "home" }, "", "#home");
    if (options.restoreFocus !== false && returnFocus instanceof HTMLElement && document.contains(returnFocus)) window.setTimeout(() => returnFocus.focus({ preventScroll: true }), 0);
  }
  window.addEventListener("keydown", (event) => { if (!active || event.key !== "Escape") return; event.preventDefault(); if (serviceConfirmOpen) { setServiceConfirmation(false); return; } close(); });
  return { config: CONFIG, state, open, close, isOpen: () => active, refreshWeather, refreshAirQuality, setSetpointMode, setManualSetpoint, adjustSetpoint, acknowledgeEvent, replaceFilter };
})();
