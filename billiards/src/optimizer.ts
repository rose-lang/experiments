import {
  Real,
  Vec,
  add,
  and,
  compile,
  div,
  fn,
  lt,
  mul,
  select,
  sub,
  vjp,
} from "rose";
import {
  Vec2,
  dot,
  min,
  norm,
  normalize,
  pow,
  vadd2,
  vmul,
  vsub2,
} from "./lib";

// constants
export const steps = 1024;
export const layers = 4;
export const ballCount = Math.round(1 + ((1 + layers) * layers) / 2);
export const radius = 0.03;
export const elasticity = 0.8;
export const learningRate = 0.01;
export const dt = 0.003;

// ball collision

const collidePair = fn(
  [Vec2, Vec2, Vec2, Vec2],
  { x_inc_contrib: Vec2, imp: Vec2 },
  (x1, x2, v1, v2) => {
    const dist = vsub2(vadd2(x1, vmul(dt, v1)), vadd2(x2, vmul(dt, v2)));
    const distNorm = norm(dist);
    const relativeV = vsub2(v1, v2);
    const dir = normalize(dist, 1e-6);
    const projectedV = dot(dir, relativeV);
    const cond = and(lt(distNorm, 2 * radius), lt(projectedV, 0));
    const imp = select(
      cond,
      Vec2,
      vmul(mul(-(1 + elasticity) * 0.5 * 1, projectedV), dir),
      [0, 0]
    );
    const toi = div(sub(distNorm, 2 * radius), min(-1e-3, projectedV));
    const x_inc_contrib = select(
      cond,
      Vec2,
      vmul(min(sub(toi, dt), 0), imp),
      [0, 0]
    );
    return { x_inc_contrib, imp };
  }
);

const Rack = Vec(ballCount, Vec2);

const step = fn([Rack, Rack], { x: Rack, v: Rack }, (init_x, init_v) => {
  // copy over the initial values
  const x: Vec<Real>[] = [];
  const v: Vec<Real>[] = [];
  for (let i = 0; i < ballCount; i++) {
    x.push(init_x[i]);
    v.push(init_v[i]);
  }
  // collide all pairs of balls
  const x_inc: (Vec<Real> | number[])[] = [];
  const impulse: (Vec<Real> | number[])[] = [];
  for (let i = 0; i < ballCount; i++) {
    x_inc.push([0, 0]);
    impulse.push([0, 0]);
  }
  for (let i = 0; i < ballCount; i++) {
    for (let j = 0; j < ballCount; j++) {
      if (i === j) continue;
      const { x_inc_contrib, imp } = collidePair(x[i], x[j], v[i], v[j]);
      x_inc[i] = vadd2(x_inc[i], x_inc_contrib);
      impulse[i] = vadd2(impulse[i], imp);
    }
  }

  // update ball positions
  for (let i = 0; i < ballCount; i++) {
    v[i] = vadd2(v[i], impulse[i]);
    x[i] = vadd2(vadd2(x[i], x_inc[i]), vmul(dt, v[i]));
  }

  return { x, v };
});

// main simulation step
const allSteps = fn([Rack, Rack], Vec(steps, Rack), (init_x, init_v) => {
  const xs = [];
  let x = init_x;
  let v = init_v;
  for (let t = 0; t < steps; t++) {
    const { x: newX, v: newV } = step(x, v);
    x = newX;
    v = newV;
    xs.push(x);
  }
  return xs;
});

export const init = (): {
  initX: number[][];
  initV: number[][];
} => {
  // initialize cue ball position and speed
  const initX = [];
  initX[0] = [0.1, 0.5];
  const initV = [];
  initV[0] = [0.3, 0.0];
  // initialize other balls
  let count = 0;
  for (let i = 0; i < layers; i++) {
    for (let j = 0; j < i + 1; j++) {
      count += 1;
      initX[count] = [
        i * 2 * radius + 0.5,
        j * 2 * radius + 0.5 - i * radius * 0.7,
      ];
      initV[count] = [0, 0];
    }
  }
  return {
    initV,
    initX,
  };
};

const computeLoss = fn([Vec2, Vec2], Real, (current, goal) =>
  add(pow(sub(current[0], goal[0]), 2), pow(sub(current[1], goal[1]), 2))
);

const F = fn(
  [{ x: Rack, v: Rack, goal: Vec2, targetBall: ballCount }],
  Real,
  ({ x, v, goal, targetBall }) => {
    const xs = allSteps(x, v);
    return computeLoss(xs[steps - 1][targetBall], goal);
  }
);

const gradF = fn(
  [{ x: Rack, v: Rack, goal: Vec2, targetBall: ballCount }],
  { gradX: Vec2, gradV: Vec2, loss: Real },
  ({ x, v, goal, targetBall }) => {
    const f = vjp(F)({ x, v, goal, targetBall });
    const g = f.grad(1);
    return {
      loss: f.ret,
      gradX: g.x[0],
      gradV: g.v[0],
    };
  }
);

export const stepsCompiled = await compile(allSteps);
export const gradCompiled = await compile(gradF);

export const optimize = (goal: number[], targetBall: number) => {
  let optX = [0.1, 0.5];
  let optV = [0.3, 0.0];
  let loss = Infinity;

  for (let i = 0; i < 200; i++) {
    // initialize the board
    const { initX, initV } = init();
    // plug in the optimized initial values
    initX[0] = [...optX];
    initV[0] = [...optV];
    const {
      gradX,
      gradV,
      loss: newLoss,
    } = gradCompiled({
      x: initX,
      v: initV,
      goal,
      targetBall,
    });
    // update the optimized values by descenting the gradient
    optX[0] = optX[0] - learningRate * gradX[0];
    optX[1] = optX[1] - learningRate * gradX[1];
    optV[0] = optV[0] - learningRate * gradV[0];
    optV[1] = optV[1] - learningRate * gradV[1];
    console.log(`iter=${i} loss: ${newLoss}`);
    console.log(`iter=${i} grad X: ${gradX}`);
    console.log(`iter=${i} grad V: ${gradV}`);
    loss = newLoss;
  }
  return { x: optX, v: optV, loss };
};
