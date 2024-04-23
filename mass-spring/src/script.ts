import { init, optimize, stepsCompiled } from "./optimizer";
import { robots } from "./robots";

// setup robot
const robot = robots[1]();
const { initV, initX } = init(robot);
// optimize and record timing info
const start = performance.now();
const { weights1, weights2, bias1, bias2 } = optimize();
const end = performance.now();
console.log(`Optimization took ${end - start}ms`);
const {
  // acts,
  // xs,
  loss: newLoss,
} = stepsCompiled(initX, initV, weights1, weights2, bias1, bias2);
console.log(`Loss=${newLoss}`);
