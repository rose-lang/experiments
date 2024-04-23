import { ballCount, init, optimize, stepsCompiled } from "./optimizer";
import * as process from "process";

// set up scene
const goal = [0.9, 0.75];
const targetBall = ballCount - 1;
const { initV, initX } = init();

// record timing
const start = performance.now();
const { x: optX, v: optV, loss } = optimize(goal, targetBall);
const end = performance.now();
console.log(`optimization took ${end - start}ms`);
initX[0] = optX as any;
initV[0] = optV as any;
const xs = stepsCompiled(initX, initV);
console.log(`final loss=${loss}`);
console.log(
  `final target ball position=${xs[(xs as any).length - 1][targetBall]}`
);
console.log(`goal=${goal}`);
process.exit();
