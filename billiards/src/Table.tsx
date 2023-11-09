import {
  Real,
  Vec,
  add,
  and,
  compile,
  div,
  fn,
  interp,
  lt,
  mul,
  opaque,
  select,
  sqrt,
  sub,
  vec,
  vjp,
} from "rose";
import { createEffect, createSignal } from "solid-js";
import { createMutable, createStore } from "solid-js/store";

// constants
const maxSteps = 2048;
const visInterval = 64;
const outputInterval = 16;
const steps = 4096;

const layers = 4;
const ballCount = Math.round(1 + ((1 + layers) * layers) / 2);
const targetBall = ballCount - 1;
const goal = [0.9, 0.75];
const radius = 0.03;
const elasticity = 0.8;

// const alpha = 0.0;
const learningRate = 0.01;

const init_x: number[] = [];
const init_v: number[] = [];
const loss: number[] = [];

const [dt, setdt] = createSignal(0.003);

// all the balls
// const alpha = -Math.PI / 70;
const alpha = 0;
let [x, setX] = createStore<number[][]>([]);
let v: number[][] = [];

// vector helpers
const Vec2 = Vec(2, Real);

const pow = (x: Real, n: number): Real => {
  if (!Number.isInteger(n)) throw new Error(`exponent is not an integer: ${n}`);
  // https://en.wikipedia.org/wiki/Exponentiation_by_squaring
  if (n < 0) return pow(div(1, x), -n);
  else if (n == 0) return 1;
  else if (n == 1) return x;
  else if (n % 2 == 0) return pow(mul(x, x), n / 2);
  else return mul(x, pow(mul(x, x), (n - 1) / 2));
};

const vadd2 = fn([Vec2, Vec2], Vec2, (v1, v2) =>
  vec(2, Real, (i) => add(v1[i], v2[i]))
);
const vsub2 = fn([Vec2, Vec2], Vec2, (v1, v2) =>
  vec(2, Real, (i) => sub(v1[i], v2[i]))
);

const vmul = fn([Real, Vec2], Vec2, (a, v) =>
  vec(2, Real, (i) => mul(a, v[i]))
);

const norm = fn([Vec2], Real, (v) =>
  sqrt(add(mul(v[0], v[0]), mul(v[1], v[1])))
);

const dot = fn([Vec2, Vec2], Real, (v1, v2) =>
  add(mul(v1[0], v2[0]), mul(v1[1], v2[1]))
);

const min = fn([Real, Real], Real, (a, b) => select(lt(a, b), Real, a, b));

const normalize = fn([Vec2, Real], Vec2, (v, eps) =>
  vmul(div(1, add(eps, norm(v))), v)
);

const print = opaque([Real], Real, (x) => {
  console.log(x);
  return x;
});

// ball collision

const collidePair = fn(
  [Vec2, Vec2, Vec2, Vec2],
  { x_inc_contrib: Vec2, imp: Vec2 },
  (x1, x2, v1, v2) => {
    const dist = vsub2(vadd2(x1, vmul(dt(), v1)), vadd2(x2, vmul(dt(), v2)));
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
      vmul(min(sub(toi, dt()), 0), imp),
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
    x[i] = vadd2(vadd2(x[i], x_inc[i]), vmul(dt(), v[i]));
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

const init = () => {
  // initialize cue ball position
  const init_x = [];
  init_x[0] = [0.1, 0.5];
  v[0] = [0.3 * Math.cos(alpha), 0.3 * Math.sin(alpha)];
  // initialize other balls
  let count = 0;
  for (let i = 0; i < layers; i++) {
    for (let j = 0; j < i + 1; j++) {
      count += 1;
      init_x[count] = [
        i * 2 * radius + 0.5,
        j * 2 * radius + 0.5 - i * radius * 0.7,
      ];
      v[count] = [0, 0];
    }
  }
  setX(init_x);
};

const computeLoss = fn([Vec2, Vec2], Real, (current, goal) =>
  add(pow(sub(current[0], goal[0]), 2), pow(sub(current[1], goal[1]), 2))
);

const F = fn([{ x: Rack, v: Rack }], Real, ({ x, v }) => {
  const xs = allSteps(x, v);
  return computeLoss(xs[steps - 1][targetBall], goal);
});

const gradF = fn(
  [{ x: Rack, v: Rack }],
  { gradX: Vec2, gradV: Vec2, loss: Real },
  ({ x, v }) => {
    const f = vjp(F)({ x, v });
    const g = f.grad(1);
    return {
      loss: f.ret,
      gradX: g.x[0],
      gradV: g.v[0],
    };
  }
);

const optimize = () => {};

const stepsCompiled = await compile(allSteps);
const gradCompiled = await compile(gradF);
// const stepsCompiled = interp(allSteps);

export default function Table() {
  const [w, h] = [1024, 1024];
  const pixelRadius = Math.round(radius * 1024) + 1;
  const cloth = "#2bb4e5";
  const [playID, setPlayID] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const fps = 60;
  const [currentT, setCurrentT] = createSignal(0);

  init();
  const xs = stepsCompiled(x, v);
  const { loss } = gradCompiled({ x, v });

  createEffect(() => {
    setX([...(xs[currentT()] as any)]);
  });

  return (
    <>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
        <rect width={w} height={h} fill={cloth}></rect>
        {x.map(([x, y], i) => (
          <circle
            cx={x * 1024}
            cy={h - y * 1024}
            r={pixelRadius}
            fill={i === 0 ? "#fff" : i === targetBall ? "#3344cc" : "#f20530"}
          ></circle>
        ))}
        <circle
          cx={goal[0] * 1024}
          cy={h - goal[1] * 1024}
          r={pixelRadius / 2}
          fill="#000"
        ></circle>
      </svg>
      {/* <button
        onclick={() => {
          if (playing()) {
            clearInterval(playID());
            setPlaying(false);
            return;
          } else {
            setPlaying(true);
            setPlayID(setInterval(() => step(), 1000 / fps));
          }
        }}
      >
        {playing() ? `Pause` : `Play`}
      </button>
      <button onclick={() => init()}>Reset</button> */}
      <div>
        T:
        <input
          type="range"
          min={0}
          max={steps - 1}
          step={1}
          value={currentT()}
          // disabled={playing()}
          // onchange={(v) => setdt(v.target.valueAsNumber)}
          oninput={(v) => setCurrentT(v.target.valueAsNumber)}
          name="Time step"
        />
      </div>
      {/* <div>Loss: {interp(computeLoss)(x[targetBall], goal)}</div> */}
      {/* <div>Loss: {loss}</div> */}
      {/* <div>Grad: {interp(computeLoss)(x[targetBall], goal)}</div> */}
    </>
  );
}
