/* Electrical Machine Solver: deterministic formulas, units, validation, and HMI UI. */
window.MotionSolver = (() => {
  const UNIT_SCALES = Object.freeze({
    voltage: { V: 1, kV: 1000, mV: .001 },
    current: { A: 1, mA: .001 },
    frequency: { Hz: 1, kHz: 1000 },
    speed: { RPM: 1 },
    power: { W: 1, kW: 1000, MW: 1000000, HP: 745.699872 },
    torque: { "N.m": 1, "lb-ft": 1.35581795 },
    resistance: { Ohm: 1, kOhm: 1000 },
    inductance: { H: 1, mH: .001 },
    capacitance: { F: 1, mF: .001, uF: .000001 },
    percent: { "%": .01 },
    factor: { pu: 1 },
    poles: { poles: 1 },
    count: { turns: 1 },
    emfConstant: { "V/(rad/s)": 1 },
    torqueConstant: { "N.m/A": 1 }
  });

  const FIELDS = Object.freeze({
    appliedVoltage: field("Applied Voltage", "voltage", "V", "Voltage supplied to the DC armature circuit."),
    armatureVoltage: field("Armature Voltage", "voltage", "V", "Voltage available across the armature."),
    armatureCurrent: field("Armature Current", "current", "A", "Current flowing in the DC motor armature."),
    fieldCurrent: field("Field Current", "current", "A", "Current used to establish the machine field."),
    armatureResistance: field("Armature Resistance", "resistance", "Ohm", "Armature winding resistance used for the IaRa voltage drop."),
    fieldResistance: field("Field Resistance", "resistance", "Ohm", "Field winding resistance."),
    lineVoltage: field("Line Voltage", "voltage", "V", "Line-to-line voltage supplied to a three-phase machine."),
    lineCurrent: field("Line Current", "current", "A", "Current measured in each supply line."),
    phaseVoltage: field("Phase Voltage", "voltage", "V", "Voltage across one phase winding."),
    phaseCurrent: field("Phase Current", "current", "A", "Current flowing in one phase winding."),
    supplyVoltage: field("Supply Voltage", "voltage", "V", "Applied single-phase supply voltage."),
    frequency: field("Supply Frequency", "frequency", "Hz", "Supply frequency determines synchronous field speed and reactance."),
    poles: field("Number of Poles", "poles", "poles", "Total magnetic poles. A positive whole number is required."),
    synchronousSpeed: field("Synchronous Speed", "speed", "RPM", "Synchronous speed is the rotating magnetic-field speed."),
    rotorSpeed: field("Rotor Speed", "speed", "RPM", "Rotor speed is required because slip compares rotor speed with synchronous-field speed."),
    powerFactor: field("Power Factor", "factor", "pu", "Power factor is the fraction of apparent power converted to real power."),
    efficiency: field("Efficiency", "percent", "%", "Efficiency is output power divided by input power."),
    slip: field("Slip", "percent", "%", "Slip is the relative speed difference between the rotor and synchronous field."),
    torque: field("Torque", "torque", "N.m", "Shaft torque can be combined with angular speed to calculate mechanical power."),
    inputPower: field("Input Power", "power", "W", "Electrical power entering the machine."),
    outputPower: field("Output Power", "power", "W", "Useful mechanical or electrical power delivered by the machine."),
    resistance: field("Resistance", "resistance", "Ohm", "Circuit resistance used with AC reactance to determine impedance."),
    inductance: field("Inductance", "inductance", "H", "Inductance is needed to calculate inductive reactance."),
    capacitance: field("Capacitance", "capacitance", "F", "Capacitance is needed to calculate capacitive reactance."),
    dcBusVoltage: field("DC Bus Voltage", "voltage", "V", "DC supply voltage available to the BLDC or PMSM drive."),
    phaseCurrentBldc: field("Phase Current", "current", "A", "Motor phase current used with the torque constant."),
    backEmfConstant: field("Back-EMF Constant", "emfConstant", "V/(rad/s)", "Back-EMF constant relates angular velocity to generated voltage."),
    torqueConstant: field("Torque Constant", "torqueConstant", "N.m/A", "Torque constant relates phase current to electromagnetic torque."),
    primaryVoltage: field("Primary Voltage", "voltage", "V", "Transformer primary winding voltage."),
    secondaryVoltage: field("Secondary Voltage", "voltage", "V", "Transformer secondary winding voltage."),
    primaryCurrent: field("Primary Current", "current", "A", "Transformer primary current."),
    secondaryCurrent: field("Secondary Current", "current", "A", "Transformer secondary current."),
    primaryTurns: field("Primary Turns", "count", "turns", "Number of turns in the transformer primary winding."),
    secondaryTurns: field("Secondary Turns", "count", "turns", "Number of turns in the transformer secondary winding.")
  });

  const FORMULAS = Object.freeze({
    dcBackEmf: formula("Back EMF", "backEmf", "voltage", "Eb = V - IaRa", ["appliedVoltage", "armatureCurrent", "armatureResistance"], (v) => {
      const value = v.appliedVoltage - v.armatureCurrent * v.armatureResistance;
      return result(value, ["Eb = V - IaRa", `Eb = ${fixed(v.appliedVoltage)} - (${fixed(v.armatureCurrent)} x ${fixed(v.armatureResistance)})`, `Eb = ${fixed(value)} V`]);
    }),
    angularVelocity: formula("Angular Velocity", "angularVelocity", "rad/s", "omega = 2piN / 60", ["rotorSpeed"], (v) => {
      const value = 2 * Math.PI * v.rotorSpeed / 60;
      return result(value, ["omega = 2piN / 60", `omega = (2pi x ${fixed(v.rotorSpeed)}) / 60`, `omega = ${fixed(value)} rad/s`]);
    }),
    mechanicalPower: formula("Mechanical Power", "mechanicalPower", "power", "P = T omega", ["torque", "rotorSpeed"], (v) => {
      const omega = 2 * Math.PI * v.rotorSpeed / 60;
      const value = v.torque * omega;
      return result(value, ["omega = 2piN / 60", `omega = ${fixed(omega)} rad/s`, "P = T omega", `P = ${fixed(v.torque)} x ${fixed(omega)}`, `P = ${format(value, "power")}`]);
    }),
    dcEfficiency: formula("Efficiency", "efficiencyOut", "percent", "eta = Pout / Pin x 100", ["inputPower", "outputPower"], (v) => {
      const value = v.outputPower / v.inputPower;
      return result(value, ["eta = Pout / Pin x 100", `eta = ${format(v.outputPower, "power")} / ${format(v.inputPower, "power")} x 100`, `eta = ${format(value, "percent")}`]);
    }),
    syncSpeed: formula("Synchronous Speed", "synchronousSpeed", "speed", "Ns = 120f / P", ["frequency", "poles"], (v) => {
      const value = 120 * v.frequency / v.poles;
      return result(value, ["Ns = 120f / P", `Ns = (120 x ${fixed(v.frequency)}) / ${fixed(v.poles)}`, `Ns = ${format(value, "speed")}`]);
    }),
    slip: formula("Slip", "slip", "percent", "s = (Ns - Nr) / Ns x 100", ["synchronousSpeed", "rotorSpeed"], (v) => {
      const value = (v.synchronousSpeed - v.rotorSpeed) / v.synchronousSpeed;
      return result(value, ["s = (Ns - Nr) / Ns x 100", `s = (${fixed(v.synchronousSpeed)} - ${fixed(v.rotorSpeed)}) / ${fixed(v.synchronousSpeed)} x 100`, `s = ${format(value, "percent")}`]);
    }),
    rotorFrequency: formula("Rotor Frequency", "rotorFrequency", "frequency", "fr = sf", ["frequency", "slip"], (v) => {
      const value = v.slip * v.frequency;
      return result(value, ["fr = sf", `fr = ${fixed(v.slip * 100)}% x ${fixed(v.frequency)} Hz`, `fr = ${format(value, "frequency")}`]);
    }),
    apparentPower: formula("Apparent Power", "apparentPower", "power", "S = sqrt(3) VL IL", ["lineVoltage", "lineCurrent"], (v) => {
      const value = Math.sqrt(3) * v.lineVoltage * v.lineCurrent;
      return result(value, ["S = sqrt(3) VL IL", `S = 1.732 x ${fixed(v.lineVoltage)} x ${fixed(v.lineCurrent)}`, `S = ${format(value, "power")}`]);
    }),
    threePhaseInputPower: formula("3-Phase Input Power", "inputPower3ph", "power", "P3ph = sqrt(3) VL IL cos(phi)", ["lineVoltage", "lineCurrent", "powerFactor"], (v) => {
      const value = Math.sqrt(3) * v.lineVoltage * v.lineCurrent * v.powerFactor;
      return result(value, ["P3ph = sqrt(3) VL IL cos(phi)", `P3ph = 1.732 x ${fixed(v.lineVoltage)} x ${fixed(v.lineCurrent)} x ${fixed(v.powerFactor)}`, `P3ph = ${format(value, "power")}`]);
    }),
    estimatedOutputPower: formula("Estimated Output Power", "estimatedOutputPower", "power", "Pout = Pin eta", ["inputPower3ph", "efficiency"], (v) => {
      const value = v.inputPower3ph * v.efficiency;
      return result(value, ["Pout = Pin eta", `Pout = ${format(v.inputPower3ph, "power")} x ${fixed(v.efficiency * 100)}%`, `Pout = ${format(value, "power")}`]);
    }),
    reactivePower: formula("Reactive Power", "reactivePower", "power", "Q = sqrt(S^2 - P^2)", ["apparentPower", "realPower"], (v) => {
      const square = v.apparentPower ** 2 - v.realPower ** 2;
      if (square < -0.0001) throw new Error("Apparent power must be greater than or equal to real power.");
      const value = Math.sqrt(Math.max(0, square));
      return result(value, ["Q = sqrt(S^2 - P^2)", `Q = sqrt(${fixed(v.apparentPower)}^2 - ${fixed(v.realPower)}^2)`, `Q = ${format(value, "power")}`]);
    }),
    inductiveReactance: formula("Inductive Reactance", "inductiveReactance", "resistance", "XL = 2pi fL", ["frequency", "inductance"], (v) => {
      const value = 2 * Math.PI * v.frequency * v.inductance;
      return result(value, ["XL = 2pi fL", `XL = 2pi x ${fixed(v.frequency)} x ${fixed(v.inductance)}`, `XL = ${format(value, "resistance")}`]);
    }),
    capacitiveReactance: formula("Capacitive Reactance", "capacitiveReactance", "resistance", "XC = 1 / (2pi fC)", ["frequency", "capacitance"], (v) => {
      const value = 1 / (2 * Math.PI * v.frequency * v.capacitance);
      return result(value, ["XC = 1 / (2pi fC)", `XC = 1 / (2pi x ${fixed(v.frequency)} x ${fixed(v.capacitance)})`, `XC = ${format(value, "resistance")}`]);
    }),
    impedance: formula("Impedance", "impedance", "resistance", "Z = sqrt(R^2 + (XL - XC)^2)", ["resistance", "inductiveReactance", "capacitiveReactance"], (v) => {
      const value = Math.hypot(v.resistance, v.inductiveReactance - v.capacitiveReactance);
      return result(value, ["Z = sqrt(R^2 + (XL - XC)^2)", `Z = sqrt(${fixed(v.resistance)}^2 + (${fixed(v.inductiveReactance)} - ${fixed(v.capacitiveReactance)})^2)`, `Z = ${format(value, "resistance")}`]);
    }),
    bldcBackEmf: formula("Back EMF", "backEmfBldc", "voltage", "E = Ke omega", ["backEmfConstant", "rotorSpeed"], (v) => {
      const omega = 2 * Math.PI * v.rotorSpeed / 60;
      const value = v.backEmfConstant * omega;
      return result(value, ["omega = 2piN / 60", `omega = ${fixed(omega)} rad/s`, "E = Ke omega", `E = ${fixed(v.backEmfConstant)} x ${fixed(omega)}`, `E = ${format(value, "voltage")}`]);
    }),
    bldcTorque: formula("Electromagnetic Torque", "bldcTorque", "torque", "T = KtI", ["torqueConstant", "phaseCurrentBldc"], (v) => {
      const value = v.torqueConstant * v.phaseCurrentBldc;
      return result(value, ["T = KtI", `T = ${fixed(v.torqueConstant)} x ${fixed(v.phaseCurrentBldc)}`, `T = ${format(value, "torque")}`]);
    }),
    turnsRatio: formula("Turns Ratio", "turnsRatio", "ratio", "a = Np / Ns", ["primaryTurns", "secondaryTurns"], (v) => {
      const value = v.primaryTurns / v.secondaryTurns;
      return result(value, ["a = Np / Ns", `a = ${fixed(v.primaryTurns)} / ${fixed(v.secondaryTurns)}`, `a = ${fixed(value)} : 1`]);
    }),
    transformerSecondaryVoltage: formula("Secondary Voltage", "secondaryVoltageCalc", "voltage", "V2 = V1 Ns / Np", ["primaryVoltage", "primaryTurns", "secondaryTurns"], (v) => {
      const value = v.primaryVoltage * v.secondaryTurns / v.primaryTurns;
      return result(value, ["V1 / V2 = N1 / N2", `V2 = ${fixed(v.primaryVoltage)} x ${fixed(v.secondaryTurns)} / ${fixed(v.primaryTurns)}`, `V2 = ${format(value, "voltage")}`]);
    }),
    transformerSecondaryCurrent: formula("Secondary Current", "secondaryCurrentCalc", "current", "I2 = I1 Np / Ns", ["primaryCurrent", "primaryTurns", "secondaryTurns"], (v) => {
      const value = v.primaryCurrent * v.primaryTurns / v.secondaryTurns;
      return result(value, ["I1 / I2 = N2 / N1", `I2 = ${fixed(v.primaryCurrent)} x ${fixed(v.primaryTurns)} / ${fixed(v.secondaryTurns)}`, `I2 = ${format(value, "current")}`]);
    })
  });

  const MACHINES = Object.freeze({
    dc: machine("DC MOTOR", "DC-MTR", ["dcBackEmf", "angularVelocity", "mechanicalPower", "dcEfficiency"], ["appliedVoltage", "armatureCurrent", "armatureResistance", "rotorSpeed", "torque", "inputPower", "outputPower"], ["dcBackEmf", "angularVelocity", "mechanicalPower", "dcEfficiency"]),
    induction: machine("3-PHASE INDUCTION MOTOR", "IM-3PH", ["syncSpeed", "slip", "rotorFrequency", "threePhaseInputPower", "apparentPower"], ["lineVoltage", "lineCurrent", "frequency", "poles", "rotorSpeed", "powerFactor", "efficiency", "torque", "synchronousSpeed", "slip"], ["syncSpeed", "slip", "rotorFrequency", "apparentPower", "threePhaseInputPower", "estimatedOutputPower", "angularVelocity", "mechanicalPower"]),
    synchronous: machine("SYNCHRONOUS MACHINE", "SYN-M", ["syncSpeed", "threePhaseInputPower", "apparentPower"], ["lineVoltage", "lineCurrent", "frequency", "poles", "rotorSpeed", "powerFactor", "efficiency", "torque"], ["syncSpeed", "apparentPower", "threePhaseInputPower", "angularVelocity", "mechanicalPower"]),
    single: machine("SINGLE-PHASE AC MOTOR", "SP-AC", ["inductiveReactance", "capacitiveReactance", "syncSpeed"], ["supplyVoltage", "lineCurrent", "frequency", "poles", "rotorSpeed", "powerFactor", "resistance", "inductance", "capacitance", "efficiency"], ["inductiveReactance", "capacitiveReactance", "syncSpeed", "angularVelocity"]),
    bldc: machine("BLDC / PMSM", "BLDC-P", ["bldcBackEmf", "bldcTorque", "angularVelocity", "mechanicalPower"], ["dcBusVoltage", "phaseCurrentBldc", "backEmfConstant", "torqueConstant", "rotorSpeed", "torque"], ["bldcBackEmf", "bldcTorque", "angularVelocity", "mechanicalPower"]),
    transformer: machine("TRANSFORMER", "TX-01", ["turnsRatio", "transformerSecondaryVoltage", "transformerSecondaryCurrent"], ["primaryVoltage", "secondaryVoltage", "primaryCurrent", "secondaryCurrent", "primaryTurns", "secondaryTurns"], ["turnsRatio", "transformerSecondaryVoltage", "transformerSecondaryCurrent"])
  });

  const SMART_METHODS = Object.freeze({
    induction: {
      slip: [
        smartMethod("speed", "METHOD A / KNOWN SPEEDS", ["synchronousSpeed", "rotorSpeed"], (values) => calculate("slip", values)),
        smartMethod("frequency", "METHOD B / SUPPLY DATA", ["frequency", "poles", "rotorSpeed"], (values) => {
          const sync = calculate("syncSpeed", values);
          const slip = calculate("slip", { ...values, synchronousSpeed: sync.value });
          return { ...slip, steps: [...sync.steps, ...slip.steps], derived: [sync] };
        })
      ],
      rotorFrequency: [
        smartMethod("slip", "METHOD A / KNOWN SLIP", ["frequency", "slip"], (values) => calculate("rotorFrequency", values)),
        smartMethod("speed", "METHOD B / SPEED + SUPPLY", ["frequency", "poles", "rotorSpeed"], (values) => {
          const sync = calculate("syncSpeed", values);
          const slip = calculate("slip", { ...values, synchronousSpeed: sync.value });
          const rotor = calculate("rotorFrequency", { ...values, slip: slip.value });
          return { ...rotor, steps: [...sync.steps, ...slip.steps, ...rotor.steps], derived: [sync, slip] };
        })
      ]
    }
  });

  const state = {
    level: 1,
    levelOne: { machine: "", parameter: "", values: {}, units: {}, result: null, error: "" },
    levelTwo: { machine: "induction", parameter: "slip", method: "speed", values: {}, units: {}, result: null, error: "" },
    levelThree: { machine: "induction", enabled: {}, values: {}, units: {}, results: [], error: "", message: "" },
    history: [],
    calculationNumber: 0
  };

  const labState = { open: false, root: null, returnFocus: null, directRoute: false, onKeydown: null };

  function field(label, quantity, unit, help) { return { label, quantity, unit, help }; }
  function formula(label, output, quantity, expression, required, calculateFormula) { return { label, output, quantity, expression, required, calculate: calculateFormula }; }
  function machine(label, code, parameters, analyzerFields, analyzerRules) { return { label, code, parameters, analyzerFields, analyzerRules }; }
  function smartMethod(id, label, fields, run) { return { id, label, fields, run }; }
  function result(value, steps) { return { value, steps }; }
  function create(tag, className, text) { const node = document.createElement(tag); if (className) node.className = className; if (text !== undefined) node.textContent = text; return node; }
  function fixed(value) { return Number(value).toLocaleString(undefined, { maximumFractionDigits: 2, minimumFractionDigits: Number.isInteger(value) ? 0 : 2 }); }
  function format(value, quantity) {
    if (!Number.isFinite(value)) return "--";
    if (quantity === "percent") return `${fixed(value * 100)} %`;
    if (quantity === "power") {
      if (Math.abs(value) >= 1000000) return `${fixed(value / 1000000)} MW`;
      if (Math.abs(value) >= 1000) return `${fixed(value / 1000)} kW`;
      return `${fixed(value)} W`;
    }
    if (quantity === "voltage") return `${fixed(value)} V`;
    if (quantity === "current") return `${fixed(value)} A`;
    if (quantity === "frequency") return `${fixed(value)} Hz`;
    if (quantity === "speed") return `${fixed(value)} RPM`;
    if (quantity === "resistance") return `${fixed(value)} Ohm`;
    if (quantity === "torque") return `${fixed(value)} N.m`;
    if (quantity === "rad/s") return `${fixed(value)} rad/s`;
    if (quantity === "ratio") return `${fixed(value)} : 1`;
    return fixed(value);
  }

  function validateValue(id, value) {
    if (!Number.isFinite(value)) return "Enter a numeric value.";
    const positive = ["frequency", "poles", "synchronousSpeed", "appliedVoltage", "armatureVoltage", "lineVoltage", "supplyVoltage", "dcBusVoltage", "primaryVoltage", "primaryTurns", "secondaryTurns", "inductance", "capacitance", "backEmfConstant", "torqueConstant"];
    const nonNegative = ["rotorSpeed", "lineCurrent", "phaseCurrent", "armatureCurrent", "fieldCurrent", "primaryCurrent", "secondaryCurrent", "phaseCurrentBldc", "torque", "resistance", "armatureResistance", "fieldResistance", "inputPower", "outputPower"];
    if (positive.includes(id) && value <= 0) return "Value must be greater than zero.";
    if (nonNegative.includes(id) && value < 0) return "Negative values are not valid here.";
    if (id === "efficiency" && (value < 0 || value > 1)) return "Efficiency must be between 0 and 100%.";
    if (id === "powerFactor" && (value < 0 || value > 1)) return "Power factor must be between 0 and 1.";
    return "";
  }

  function readValues(root, ids, values, units, required = true) {
    const output = {};
    for (const id of ids) {
      const fieldDef = FIELDS[id];
      const input = root.querySelector(`[data-motion-value="${id}"]`);
      const raw = input ? input.value : values[id];
      const unitSelect = root.querySelector(`[data-motion-unit="${id}"]`);
      const unit = unitSelect ? unitSelect.value : units[id] || fieldDef.unit;
      if (raw === "" || raw === undefined) {
        if (required) throw new Error(`${fieldDef.label} is required.`);
        continue;
      }
      const numeric = Number(raw);
      const scale = UNIT_SCALES[fieldDef.quantity][unit];
      const value = numeric * scale;
      const invalid = validateValue(id, value);
      if (invalid) throw new Error(`${fieldDef.label}: ${invalid}`);
      output[id] = value;
    }
    return output;
  }

  function calculate(id, values) {
    const definition = FORMULAS[id];
    if (!definition) throw new Error("This engineering formula is not available yet.");
    definition.required.forEach((fieldId) => {
      if (!Number.isFinite(values[fieldId])) throw new Error(`${FIELDS[fieldId].label} is required.`);
    });
    const response = definition.calculate(values);
    if (!Number.isFinite(response.value)) throw new Error("The supplied values did not produce a valid result.");
    return { ...response, id, label: definition.label, output: definition.output, quantity: definition.quantity, expression: definition.expression, inputs: values };
  }

  function addHistory(item) {
    state.calculationNumber += 1;
    state.history = [{ number: state.calculationNumber, label: item.label, value: format(item.value, item.quantity) }, ...state.history].slice(0, 5);
  }

  function option(label, value, selected) { const node = document.createElement("option"); node.value = value; node.textContent = label; node.selected = selected; return node; }
  function button(label, className = "motion-button") { const node = create("button", className, label); node.type = "button"; return node; }

  function buildSelect(labelText, dataName, choices, selected, placeholder) {
    const wrap = create("label", "motion-select-field");
    wrap.append(create("span", "motion-field-label", labelText));
    const select = document.createElement("select");
    select.dataset.motionSelect = dataName;
    select.append(option(placeholder || "SELECT", "", !selected));
    choices.forEach(([value, label]) => select.append(option(label, value, selected === value)));
    wrap.append(select);
    return wrap;
  }

  function buildInput(id, store, optional = false) {
    const definition = FIELDS[id];
    const row = create("div", `motion-input-row${optional ? " is-optional" : ""}`);
    if (optional) {
      const enabled = Boolean(store.enabled[id]);
      const check = document.createElement("input");
      check.type = "checkbox";
      check.checked = enabled;
      check.dataset.motionOptional = id;
      check.setAttribute("aria-label", `Use ${definition.label}`);
      row.append(check);
    }
    const label = create("label", "motion-input-label", definition.label);
    label.htmlFor = `motion-${id}`;
    const control = create("div", "motion-input-control");
    const input = document.createElement("input");
    input.id = `motion-${id}`;
    input.type = "number";
    input.inputMode = "decimal";
    input.step = "any";
    input.placeholder = "0.00";
    input.value = store.values[id] ?? "";
    input.disabled = optional && !store.enabled[id];
    input.dataset.motionValue = id;
    const unit = document.createElement("select");
    unit.dataset.motionUnit = id;
    unit.disabled = optional && !store.enabled[id];
    Object.keys(UNIT_SCALES[definition.quantity]).forEach((name) => unit.append(option(name, name, (store.units[id] || definition.unit) === name)));
    const info = button("i", "motion-info-button");
    info.setAttribute("aria-label", `Why ${definition.label} is required`);
    info.setAttribute("aria-expanded", "false");
    const help = create("p", "motion-inline-help", definition.help);
    help.hidden = true;
    info.addEventListener("click", () => { const expanded = info.getAttribute("aria-expanded") === "true"; info.setAttribute("aria-expanded", String(!expanded)); help.hidden = expanded; });
    control.append(input, unit, info);
    row.append(label, control, help);
    return row;
  }

  function buildResult(data, title = "CALCULATION RESULT", detailLabel = "VIEW STEPS") {
    const panel = create("section", "motion-result");
    panel.append(create("p", "motion-section-label", title));
    panel.append(create("h3", "motion-result-name", data.label));
    panel.append(create("output", "motion-result-value", format(data.value, data.quantity)));
    const status = create("p", "motion-valid-status", "STATUS: VALID");
    panel.append(status);
    const formula = create("p", "motion-formula", data.expression);
    panel.append(create("span", "motion-formula-label", "FORMULA"), formula);
    const steps = create("ol", "motion-steps");
    data.steps.forEach((step, index) => { const item = create("li", "", step); item.dataset.step = String(index + 1).padStart(2, "0"); steps.append(item); });
    steps.hidden = true;
    const actions = create("div", "motion-result-actions");
    const view = button(detailLabel, "motion-outline-button");
    view.setAttribute("aria-expanded", "false");
    view.addEventListener("click", () => { const expanded = view.getAttribute("aria-expanded") === "true"; steps.hidden = expanded; view.setAttribute("aria-expanded", String(!expanded)); view.textContent = expanded ? detailLabel : "HIDE CALCULATION"; });
    const copy = button("COPY RESULT", "motion-outline-button");
    copy.addEventListener("click", async () => {
      const summary = `${data.machineLabel || "Electrical Machine"}\n${data.label} = ${format(data.value, data.quantity)}\n\nFormula:\n${data.expression}`;
      try { await navigator.clipboard.writeText(summary); copy.textContent = "COPIED"; } catch { copy.textContent = "COPY UNAVAILABLE"; }
    });
    actions.append(view, copy);
    panel.append(actions, steps);
    return panel;
  }

  function buildError(message) { return create("p", "motion-error", `INPUT ERROR / CHECK VALUE: ${message}`); }
  function getMachineChoices() { return Object.entries(MACHINES).map(([key, item]) => [key, item.label]); }
  function getParameterChoices(machineKey) { return (MACHINES[machineKey]?.parameters || []).map((id) => [id, FORMULAS[id].label]); }

  function bindStoredValue(input, store, id) {
    input.addEventListener("input", () => { store.values[id] = input.value; });
    const unit = input.parentElement.querySelector(`[data-motion-unit="${id}"]`);
    unit?.addEventListener("change", () => { store.units[id] = unit.value; });
  }

  function buildWorkspaceColumn(code, title, copy) {
    const column = create("section", "motion-workspace-column");
    const header = create("header", "motion-workspace-column-header");
    header.append(create("span", "motion-workspace-code", code), create("h2", "", title), create("p", "", copy));
    column.append(header);
    return column;
  }

  function buildParameterMap(machine, selected = "") {
    const panel = create("section", "motion-parameter-map");
    panel.append(create("p", "motion-section-label", "MACHINE PARAMETER MAP"));
    const map = create("div", "motion-parameter-pills");
    machine.parameters.forEach((id) => {
      const formula = FORMULAS[id];
      const item = create("span", "motion-parameter-pill", formula.label);
      item.classList.toggle("is-selected", selected === id);
      item.title = formula.expression;
      map.append(item);
    });
    panel.append(map);
    return panel;
  }

  function buildFormulaReference(machine) {
    const reference = create("details", "motion-formula-reference");
    const summary = create("summary", "", "FORMULA REFERENCE / SELECTED MACHINE");
    const list = create("dl", "motion-formula-reference-list");
    machine.parameters.forEach((id) => {
      const formula = FORMULAS[id];
      const row = document.createElement("div");
      row.append(create("dt", "", formula.label), create("dd", "", formula.expression));
      list.append(row);
    });
    reference.append(summary, list);
    return reference;
  }

  function buildCalculationStation({ title, formula, result: calculation, note }) {
    const station = create("section", "motion-calculation-station");
    station.append(create("p", "motion-section-label", title));
    if (!formula) {
      station.append(create("h3", "motion-station-name", "WAITING FOR TARGET"), create("p", "motion-station-note", note || "Select a machine parameter to load its deterministic formula."));
      return station;
    }
    station.append(create("h3", "motion-station-name", formula.label), create("p", "motion-station-expression", formula.expression));
    if (calculation) {
      station.append(create("p", "motion-station-status", "FORMULA EVALUATED / VERIFIED INPUTS"));
      const flow = create("ol", "motion-calculation-flow");
      calculation.steps.forEach((step, index) => {
        const item = create("li", "", step);
        item.dataset.step = String(index + 1).padStart(2, "0");
        flow.append(item);
      });
      station.append(flow);
    } else {
      station.append(create("p", "motion-station-status is-idle", note || "READY / Enter verified values to calculate."));
    }
    return station;
  }

  function getEnabledAnalyzerValues(level, machine) {
    const values = {};
    machine.analyzerFields.forEach((id) => {
      if (!level.enabled[id] || level.values[id] === "" || level.values[id] === undefined) return;
      const definition = FIELDS[id];
      const unit = level.units[id] || definition.unit;
      const numeric = Number(level.values[id]);
      if (Number.isFinite(numeric)) values[id] = numeric * UNIT_SCALES[definition.quantity][unit];
    });
    return values;
  }

  function buildAvailability(machine, level) {
    const known = getEnabledAnalyzerValues(level, machine);
    const panel = create("section", "motion-availability");
    panel.append(create("p", "motion-section-label", "AVAILABLE CALCULATIONS"));
    const list = create("ul", "motion-availability-list");
    machine.analyzerRules.forEach((id) => {
      const formula = FORMULAS[id];
      const available = formula.required.every((fieldId) => Number.isFinite(known[fieldId]));
      const row = create("li", available ? "is-available" : "");
      row.append(create("span", "", formula.label), create("b", "", available ? "READY" : "INPUTS NEEDED"));
      list.append(row);
    });
    panel.append(list, create("p", "motion-station-note", "Analyzer only calculates relationships proven by the enabled verified inputs."));
    return panel;
  }

  function renderLevelOne(root, columns) {
    const level = state.levelOne;
    const machine = MACHINES[level.machine];
    columns.setup.append(create("p", "motion-instruction", "GUIDED SOLVER / Select a machine, choose a parameter, then enter only the required values."));
    const selectorGrid = create("div", "motion-selector-grid");
    const machineSelect = buildSelect("01 MACHINE TYPE", "level-one-machine", getMachineChoices(), level.machine, "SELECT MACHINE");
    const parameterSelect = buildSelect("02 FIND PARAMETER", "level-one-parameter", getParameterChoices(level.machine), level.parameter, "SELECT PARAMETER");
    const parameterControl = parameterSelect.querySelector("select");
    parameterControl.disabled = !machine;
    selectorGrid.append(machineSelect, parameterSelect);
    columns.setup.append(selectorGrid);
    machineSelect.querySelector("select").addEventListener("change", (event) => {
      level.machine = event.target.value; level.parameter = ""; level.values = {}; level.units = {}; level.result = null; level.error = ""; render(root);
    });
    parameterControl.addEventListener("change", (event) => { level.parameter = event.target.value; level.values = {}; level.units = {}; level.result = null; level.error = ""; render(root); });
    if (machine) columns.setup.append(buildMachineReadout(machine), buildParameterMap(machine, level.parameter));
    if (level.parameter) {
      const definition = FORMULAS[level.parameter];
      const required = create("section", "motion-required-inputs");
      required.append(create("p", "motion-section-label", "REQUIRED INPUTS"));
      definition.required.forEach((id) => { const input = buildInput(id, level); bindStoredValue(input.querySelector(`[data-motion-value="${id}"]`), level, id); required.append(input); });
      const calculateButton = button("CALCULATE", "motion-calculate-button");
      calculateButton.addEventListener("click", () => {
        try { const values = readValues(required, definition.required, level.values, level.units); level.result = { ...calculate(level.parameter, values), machineLabel: machine.label }; level.error = ""; addHistory(level.result); } catch (error) { level.result = null; level.error = error.message; } render(root);
      });
      required.append(calculateButton);
      columns.setup.append(required);
    }
    columns.calculation.append(buildCalculationStation({ title: "FORMULA / SUBSTITUTION", formula: level.parameter ? FORMULAS[level.parameter] : null, result: level.result, note: "Select a target parameter to display its formula path." }));
    if (machine) columns.calculation.append(buildFormulaReference(machine));
    if (level.error) columns.results.append(buildError(level.error));
    if (level.result) columns.results.append(buildResult(level.result));
  }

  function getSmartMethods(machineKey, parameter) {
    const machine = MACHINES[machineKey];
    const custom = SMART_METHODS[machineKey]?.[parameter];
    return custom || (parameter ? [smartMethod("direct", "DIRECT METHOD", FORMULAS[parameter].required, (values) => calculate(parameter, values))] : []);
  }

  function renderLevelTwo(root, columns) {
    const level = state.levelTwo;
    const machine = MACHINES[level.machine];
    columns.setup.append(create("p", "motion-instruction", "SMART SOLVER / Use a complete known-value method. Derived intermediate values remain visible."));
    const selectorGrid = create("div", "motion-selector-grid");
    const machineSelect = buildSelect("01 MACHINE TYPE", "level-two-machine", getMachineChoices(), level.machine, "SELECT MACHINE");
    const parameterSelect = buildSelect("02 FIND PARAMETER", "level-two-parameter", getParameterChoices(level.machine), level.parameter, "SELECT PARAMETER");
    selectorGrid.append(machineSelect, parameterSelect); columns.setup.append(selectorGrid);
    machineSelect.querySelector("select").addEventListener("change", (event) => { level.machine = event.target.value; level.parameter = ""; level.method = ""; level.values = {}; level.units = {}; level.result = null; level.error = ""; render(root); });
    parameterSelect.querySelector("select").addEventListener("change", (event) => { level.parameter = event.target.value; level.method = getSmartMethods(level.machine, level.parameter)[0]?.id || ""; level.values = {}; level.units = {}; level.result = null; level.error = ""; render(root); });
    if (!machine || !level.parameter) {
      columns.calculation.append(buildCalculationStation({ title: "ENGINEERING CALCULATION FLOW", formula: null, note: "Choose a machine and target parameter to view the available solution methods." }));
      return;
    }
    const methods = getSmartMethods(level.machine, level.parameter);
    if (!methods.some((method) => method.id === level.method)) level.method = methods[0].id;
    const methodBar = create("div", "motion-method-tabs");
    methods.forEach((method) => { const tab = button(method.label, "motion-method-tab"); tab.classList.toggle("is-active", level.method === method.id); tab.setAttribute("aria-pressed", String(level.method === method.id)); tab.addEventListener("click", () => { level.method = method.id; level.values = {}; level.units = {}; level.result = null; level.error = ""; render(root); }); methodBar.append(tab); });
    columns.setup.append(buildMachineReadout(machine), buildParameterMap(machine, level.parameter));
    const method = methods.find((item) => item.id === level.method);
    const required = create("section", "motion-required-inputs");
    required.append(create("p", "motion-section-label", "KNOWN INPUTS / " + method.label));
    method.fields.forEach((id) => { const input = buildInput(id, level); bindStoredValue(input.querySelector(`[data-motion-value="${id}"]`), level, id); required.append(input); });
    const calculateButton = button("DERIVE & CALCULATE", "motion-calculate-button");
    calculateButton.addEventListener("click", () => {
      try { const values = readValues(required, method.fields, level.values, level.units); level.result = { ...method.run(values), machineLabel: machine.label }; level.error = ""; addHistory(level.result); } catch (error) { level.result = null; level.error = error.message; } render(root);
    });
    required.append(calculateButton); columns.setup.append(required);
    columns.calculation.append(methodBar, buildCalculationStation({ title: `ENGINEERING FLOW / ${method.label}`, formula: FORMULAS[level.parameter], result: level.result, note: "Select a method and provide its complete known-value set." }), buildFormulaReference(machine));
    if (level.error) columns.results.append(buildError(level.error));
    if (level.result) columns.results.append(buildResult(level.result, "SMART CALCULATION RESULT", "VIEW CALCULATION"));
  }

  function buildMachineReadout(machine) { const readout = create("div", "motion-machine-readout"); readout.append(create("span", "motion-led"), create("span", "", `MACHINE CODE / ${machine.code}`), create("span", "", `${machine.parameters.length} FORMULAS READY`)); return readout; }

  function analyze(machineKey, values) {
    const machine = MACHINES[machineKey];
    const known = { ...values };
    const calculated = [];
    let progressed = true;
    while (progressed) {
      progressed = false;
      machine.analyzerRules.forEach((id) => {
        const definition = FORMULAS[id];
        if (known[definition.output] !== undefined || !definition.required.every((key) => Number.isFinite(known[key]))) return;
        try {
          const output = calculate(id, known);
          known[definition.output] = output.value;
          calculated.push(output);
          progressed = true;
        } catch { /* A missing or invalid optional relationship simply remains unavailable. */ }
      });
    }
    return { calculated, known };
  }

  function analyzerHint(machineKey, known) {
    if (machineKey === "induction" && !Number.isFinite(known.torque)) return "OPTIONAL INPUT / Torque would allow calculation of shaft power.";
    if (machineKey === "induction" && (!Number.isFinite(known.frequency) || !Number.isFinite(known.poles))) return "OPTIONAL INPUT / Frequency and poles unlock synchronous speed and slip.";
    if (machineKey === "bldc" && !Number.isFinite(known.torqueConstant)) return "OPTIONAL INPUT / Torque constant and phase current unlock electromagnetic torque.";
    if (machineKey === "transformer" && (!Number.isFinite(known.primaryTurns) || !Number.isFinite(known.secondaryTurns))) return "OPTIONAL INPUT / Both winding turn counts unlock ratio and transferred voltage calculations.";
    return "ENGINEERING NOTE / Add more verified values to unlock additional deterministic calculations.";
  }

  function buildAnalyzerResults(report) {
    const panel = create("section", "motion-analysis-result");
    panel.append(create("p", "motion-section-label", "CALCULATED PARAMETERS"));
    panel.append(create("strong", "motion-analysis-count", `${report.calculated.length} PARAMETERS CALCULATED`));
    const list = create("dl", "motion-analysis-list");
    report.calculated.forEach((item) => { const row = document.createElement("div"); row.append(create("dt", "", item.label), create("dd", "", format(item.value, item.quantity))); list.append(row); });
    panel.append(list);
    return panel;
  }

  function renderLevelThree(root, columns) {
    const level = state.levelThree;
    const machine = MACHINES[level.machine];
    columns.setup.append(create("p", "motion-instruction", "MACHINE ANALYZER / Enable only the values you know. The solver derives every valid result it can prove."));
    const select = buildSelect("MACHINE TYPE", "level-three-machine", getMachineChoices(), level.machine, "SELECT MACHINE");
    select.querySelector("select").addEventListener("change", (event) => { level.machine = event.target.value; level.enabled = {}; level.values = {}; level.units = {}; level.results = []; level.error = ""; level.message = ""; render(root); });
    columns.setup.append(select, buildMachineReadout(machine), buildParameterMap(machine));
    const inputs = create("section", "motion-analyzer-inputs");
    inputs.append(create("p", "motion-section-label", "ENTER WHAT YOU KNOW"));
    machine.analyzerFields.forEach((id) => {
      const input = buildInput(id, level, true);
      const valueInput = input.querySelector(`[data-motion-value="${id}"]`);
      bindStoredValue(valueInput, level, id);
      input.querySelector(`[data-motion-optional="${id}"]`).addEventListener("change", (event) => { level.enabled[id] = event.target.checked; if (!event.target.checked) delete level.values[id]; render(root); });
      inputs.append(input);
    });
    const analyzeButton = button("ANALYZE MACHINE", "motion-calculate-button");
    analyzeButton.addEventListener("click", () => {
      const activeIds = machine.analyzerFields.filter((id) => level.enabled[id]);
      try {
        if (!activeIds.length) throw new Error("Enable at least one known input.");
        const values = readValues(inputs, activeIds, level.values, level.units);
        const report = analyze(level.machine, values);
        level.results = report.calculated;
        level.message = analyzerHint(level.machine, report.known);
        level.error = "";
        report.calculated.forEach(addHistory);
      } catch (error) { level.results = []; level.message = ""; level.error = error.message; }
      render(root);
    });
    inputs.append(analyzeButton); columns.setup.append(inputs);
    columns.calculation.append(buildAvailability(machine, level), buildFormulaReference(machine));
    if (level.error) columns.results.append(buildError(level.error));
    if (level.results.length) columns.results.append(buildAnalyzerResults({ calculated: level.results }));
    if (level.message) columns.results.append(create("p", "motion-analyzer-hint", level.message));
  }

  function renderHistory(root) {
    if (!state.history.length) return;
    const section = create("section", "motion-history");
    section.append(create("p", "motion-section-label", "RECENT CALCULATIONS / SESSION"));
    const list = create("ol", "motion-history-list");
    state.history.forEach((item) => { const row = create("li"); row.append(create("span", "", String(item.number).padStart(2, "0")), create("b", "", item.label), create("em", "", item.value)); list.append(row); });
    section.append(list); root.append(section);
  }

  function render(root) {
    root.replaceChildren();
    const shell = create("section", "motion-lab-shell");
    const topbar = create("header", "motion-lab-topbar");
    const back = button("← BACK TO HMI", "motion-lab-back");
    back.dataset.motionLabBack = "";
    back.setAttribute("aria-label", "Return to the Automation Control home screen");
    back.addEventListener("click", () => closeLab());
    const brand = create("div", "motion-lab-brand");
    brand.append(create("p", "motion-lab-eyebrow", "AUTOMATION CONTROL / MODULE 05"), create("h1", "", "MOTION LAB"), create("p", "", "ELECTRICAL MACHINE SOLVER"), create("small", "", "AC / DC / INDUCTION / SYNCHRONOUS / BLDC / TRANSFORMER"));
    const status = create("div", "motion-lab-status");
    status.append(create("span", "motion-lab-online"), create("p", "", "SOLVER ONLINE"), create("small", "", "DETERMINISTIC FORMULA ENGINE"));
    topbar.append(back, brand, status);
    const solver = create("section", "motion-solver motion-solver--lab");
    solver.setAttribute("aria-label", "Electrical Machine Solver");
    const header = create("header", "motion-solver-header");
    const title = create("div", "motion-solver-title");
    title.append(create("p", "motion-solver-kicker", "ELECTRICAL MACHINE SOLVER"), create("p", "motion-solver-status", "SOLVER ONLINE / DETERMINISTIC FORMULA ENGINE"));
    const tabs = create("div", "motion-level-tabs");
    [[1, "LEVEL 1 — GUIDED"], [2, "LEVEL 2 — SMART"], [3, "LEVEL 3 — ANALYZER"]].forEach(([number, label]) => { const tab = button(label, "motion-level-tab"); tab.classList.toggle("is-active", state.level === number); tab.setAttribute("aria-pressed", String(state.level === number)); tab.addEventListener("click", () => { state.level = number; render(root); }); tabs.append(tab); });
    header.append(title, tabs); solver.append(header);
    const workspace = create("main", "motion-workspace");
    const columns = {
      setup: buildWorkspaceColumn("01", "MACHINE SETUP", "Choose a machine and provide verified input values."),
      calculation: buildWorkspaceColumn("02", "FORMULA ENGINE", "Trace the deterministic engineering calculation path."),
      results: buildWorkspaceColumn("03", "RESULTS & HISTORY", "Calculated values remain available for this session.")
    };
    workspace.append(columns.setup, columns.calculation, columns.results);
    if (state.level === 1) renderLevelOne(root, columns); else if (state.level === 2) renderLevelTwo(root, columns); else renderLevelThree(root, columns);
    renderHistory(columns.results);
    shell.append(topbar, solver, workspace);
    root.append(shell);
  }

  function renderPreview(container) {
    if (!container) return;
    container.replaceChildren();
    const preview = create("section", "motion-preview");
    const kicker = create("p", "content-kicker", "MOTION / ELECTRICAL MACHINE SOLVER");
    const title = create("h2", "", "Electrical Machine Solver");
    title.id = "contentTitle";
    const description = create("p", "content-description", "Interactive AC/DC machine calculations, smart formula solving and machine analysis.");
    const features = create("ul", "motion-preview-features");
    ["LEVEL 1 / GUIDED SOLVER", "LEVEL 2 / SMART METHODS", "LEVEL 3 / MACHINE ANALYZER"].forEach((label, index) => {
      const item = create("li", "");
      item.append(create("span", "", String(index + 1).padStart(2, "0")), create("b", "", label));
      features.append(item);
    });
    const open = button("OPEN MOTION LAB", "motion-preview-open");
    open.addEventListener("click", () => openLab(open));
    preview.append(kicker, title, description, features, open);
    container.append(preview);
  }

  function hideLab(restoreFocus = true) {
    if (!labState.open || !labState.root) return;
    const root = labState.root;
    root.removeEventListener("keydown", labState.onKeydown);
    root.replaceChildren();
    root.classList.remove("is-open");
    root.setAttribute("aria-hidden", "true");
    document.body.classList.remove("is-motion-lab-active");
    document.documentElement.classList.remove("is-motion-lab-active");
    labState.open = false;
    labState.directRoute = false;
    if (restoreFocus && labState.returnFocus instanceof HTMLElement && document.contains(labState.returnFocus)) window.setTimeout(() => labState.returnFocus.focus({ preventScroll: true }), 0);
  }

  function closeLab(options = {}) {
    if (!labState.open) return;
    if (options.history !== false && location.hash === "#motion-lab" && !labState.directRoute) {
      history.back();
      return;
    }
    hideLab(options.restoreFocus !== false);
    if (options.history !== false && location.hash === "#motion-lab") history.replaceState({ section: "motion" }, "", "#motion");
  }

  function openLab(trigger, options = {}) {
    const root = document.getElementById("motionLab");
    if (!root) return;
    if (labState.open) return;
    labState.root = root;
    labState.returnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    labState.directRoute = options.directRoute === true;
    labState.open = true;
    root.classList.add("is-open");
    root.setAttribute("aria-hidden", "false");
    document.body.classList.add("is-motion-lab-active");
    document.documentElement.classList.add("is-motion-lab-active");
    labState.onKeydown = (event) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      closeLab();
    };
    root.addEventListener("keydown", labState.onKeydown);
    render(root);
    if (options.history !== false && location.hash !== "#motion-lab") history.pushState({ section: "motion-lab" }, "", "#motion-lab");
    window.requestAnimationFrame(() => root.querySelector("[data-motion-lab-back]")?.focus({ preventScroll: true }));
  }

  return {
    renderPreview,
    openLab,
    closeLab,
    isOpen: () => labState.open,
    machineDefinitions: MACHINES,
    formulas: FORMULAS,
    units: UNIT_SCALES,
    engine: { unitScales: UNIT_SCALES, fields: FIELDS, formulas: FORMULAS, machines: MACHINES, smartMethods: SMART_METHODS, calculate, analyze, format, validateValue }
  };
})();
