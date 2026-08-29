const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const context = { window: {} };
vm.createContext(context);
vm.runInContext(fs.readFileSync("js/motion-solver.js", "utf8"), context);

const formulas = context.window.MotionSolver.formulas;
const calculate = (name, values) => formulas[name].calculate(values).value;
const closeTo = (actual, expected, tolerance = .00001) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

closeTo(calculate("dcBackEmf", { appliedVoltage: 240, armatureCurrent: 10, armatureResistance: 1.5 }), 225);
closeTo(calculate("syncSpeed", { frequency: 60, poles: 4 }), 1800);
closeTo(calculate("slip", { synchronousSpeed: 1800, rotorSpeed: 1745 }), .0305555556);
closeTo(calculate("rotorFrequency", { frequency: 60, slip: .0305555556 }), 1.833333336);
closeTo(calculate("threePhaseInputPower", { lineVoltage: 460, lineCurrent: 12.4, powerFactor: .86 }), 8496.4713135, .001);
closeTo(calculate("inductiveReactance", { frequency: 60, inductance: .05 }), 18.8495559);
closeTo(calculate("capacitiveReactance", { frequency: 60, capacitance: .0001 }), 26.5258238);
closeTo(calculate("bldcBackEmf", { backEmfConstant: .12, rotorSpeed: 3000 }), 37.6991118);
closeTo(calculate("bldcTorque", { torqueConstant: .35, phaseCurrentBldc: 8 }), 2.8);
closeTo(calculate("turnsRatio", { primaryTurns: 1000, secondaryTurns: 250 }), 4);
closeTo(calculate("transformerSecondaryVoltage", { primaryVoltage: 480, primaryTurns: 1000, secondaryTurns: 250 }), 120);
closeTo(calculate("estimatedOutputPower", { inputPower3ph: 8500, efficiency: .91 }), 7735);

assert.equal(context.window.MotionSolver.units.voltage.kV, 1000);
assert.equal(context.window.MotionSolver.units.current.mA, .001);
assert.equal(context.window.MotionSolver.units.power.kW, 1000);
console.log("Motion solver formula smoke test passed.");
