import {
  Real,
  Vec,
  add,
  and,
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
} from "rose";
import { createSignal } from "solid-js";
import { createMutable } from "solid-js/store";

// constants
const maxSteps = 2048;
const visInterval = 64;
const outputInterval = 16;
const steps = 1024;

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
const alpha = 0;
let x: number[][] = createMutable([]);
let v: number[][] = createMutable([]);

// vector helpers
const Vec2 = Vec(2, Real);

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

// main simulation step
const step = () => {
  // collide all pairs of balls
  const x_inc: number[][] = [];
  const impulse: number[][] = [];
  for (let i = 0; i < ballCount; i++) {
    x_inc.push([0, 0]);
  }
  for (let i = 0; i < ballCount; i++) {
    impulse.push([0, 0]);
  }
  for (let i = 0; i < ballCount; i++) {
    for (let j = 0; j < ballCount; j++) {
      if (i === j) continue;
      const { x_inc_contrib, imp } = interp(collidePair)(
        x[i],
        x[j],
        v[i],
        v[j]
      );
      x_inc[i] = [
        x_inc[i][0] + x_inc_contrib[0],
        x_inc[i][1] + x_inc_contrib[1],
      ];
      impulse[i] = [impulse[i][0] + imp[0], impulse[i][1] + imp[1]];
    }
  }

  // update ball positions
  for (let i = 0; i < ballCount; i++) {
    v[i] = [v[i][0] + impulse[i][0], v[i][1] + impulse[i][1]];
    x[i] = [
      x[i][0] + x_inc[i][0] + dt() * v[i][0],
      x[i][1] + x_inc[i][1] + dt() * v[i][1],
    ];
  }
};

const init = () => {
  // initialize cue ball position
  x[0] = [0.1, 0.5];
  v[0] = [0.3 * Math.cos(alpha), 0.3 * Math.sin(alpha)];
  // initialize other balls
  let count = 0;
  for (let i = 0; i < layers; i++) {
    for (let j = 0; j < i + 1; j++) {
      count += 1;
      x[count] = [
        i * 2 * radius + 0.5,
        j * 2 * radius + 0.5 - i * radius * 0.7,
      ];
      v[count] = [0, 0];
    }
  }
};

export default function Table() {
  const [w, h] = [1024, 1024];
  const pixelRadius = Math.round(radius * 1024) + 1;
  const cloth = "#2bb4e5";
  const [playID, setPlayID] = createSignal(0);
  const [playing, setPlaying] = createSignal(false);
  const fps = 60;

  init();

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
      <button
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
      <button onclick={() => init()}>Reset</button>
      <div>
        Time step:
        <input
          type="range"
          min={0.001}
          max={0.05}
          step={0.0001}
          value={dt()}
          // disabled={playing()}
          onchange={(v) => setdt(v.target.valueAsNumber)}
          name="Time step"
        />
      </div>
    </>
  );
}
