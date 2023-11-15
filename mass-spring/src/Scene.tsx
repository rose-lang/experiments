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
  neg,
  select,
  sub,
  vec,
  vjp,
} from "rose";
import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import { Vec2, exp, norm, sin, tanh, vadd2, vmul, vsub2 } from "./lib";
import { Robot, robots } from "./robots";
// constants
const iter = 100;

const steps = Math.floor(2048 / 3) * 2;
const elasticity = 0.0;
const ground_height = 0.1;
const gravity = -4.8;
const friction = 2.5;
const gradient_clip = 1;
const spring_omega = 10;
const damping = 15;
const dt = 0.004;

const head_id = 0;
const goal = [0.9, 0.2];
const robot = robots[1]();
const n_objects: number = robot.objects.length;
const n_springs: number = robot.springs.length;

// NN constants
const learning_rate = 25;
const n_sin_waves = 10;
const n_hidden = 32;
const n_input_states = n_sin_waves + 4 * n_objects + 2;

const rgbToHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((x) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("");

const Objects = Vec(n_objects, Vec2);

const compute_center = fn([Objects], Vec2, (objects) => {
  let sum: Vec<Real> | number[] = [0, 0];
  for (let i = 0; i < n_objects; i++) {
    sum = vadd2(sum, objects[i]);
  }
  return vmul(div(1, n_objects), sum);
});

const Hidden = Vec(n_hidden, Real);
const Weights1 = Vec(n_hidden, Vec(n_input_states, Real));
const Weights2 = Vec(n_springs, Vec(n_hidden, Real));
const Act = Vec(n_springs, Real);
const Bias1 = Hidden;
const Bias2 = Act;

const apply_spring_force = fn([Objects, Act], Objects, (x, act) => {
  const v_inc: (Vec<Real> | number[])[] = [];
  for (let i = 0; i < n_objects; i++) {
    v_inc.push([0, 0]);
  }
  for (let i = 0; i < n_springs; i++) {
    const spring = robot.springs[i];
    const a = spring.object1;
    const b = spring.object2;
    const pos_a = x[a];
    const pos_b = x[b];
    const dist = vsub2(pos_a, pos_b);
    const length = add(norm(dist), 1e-4);
    const target_length = mul(
      spring.length,
      add(1, mul(act[i], spring.actuation))
    );
    const impulse = vmul(
      div(mul(dt * spring.stiffness, sub(length, target_length)), length),
      dist
    );
    v_inc[a] = vsub2(v_inc[a], impulse);
    v_inc[b] = vadd2(v_inc[b], impulse);
  }
  return v_inc;
});

const advance_no_toi = fn(
  [Objects, Objects, Objects],
  { next_x: Objects, next_v: Objects },
  (x, v, v_inc) => {
    const next_x: Vec<Real>[] = [];
    const next_v: Vec<Real>[] = [];
    for (let i = 0; i < n_objects; i++) {
      const s = exp(-dt * damping);
      const old_v = vadd2(vadd2(vmul(s, v[i]), [0, dt * gravity]), v_inc[i]);
      const old_x = x[i];
      const depth = sub(old_x[1], ground_height);
      // friction projection
      const new_v = select(
        and(lt(depth, 0), lt(old_v[1], 0)),
        Vec2,
        [0, 0],
        old_v
      );
      // const new_v = old_v;
      const new_x = vadd2(old_x, vmul(dt, new_v));
      next_v.push(new_v);
      next_x.push(new_x);
    }
    return { next_v, next_x };
  }
);

const advance_toi = fn(
  [Objects, Objects, Objects],
  { next_x: Objects, next_v: Objects },
  (x, v, v_inc) => {
    const next_x: Vec<Real>[] = [];
    const next_v: Vec<Real>[] = [];
    for (let i = 0; i < n_objects; i++) {
      const s = exp(-dt * damping);
      const old_v = vadd2(vadd2(vmul(s, v[i]), [0, dt * gravity]), v_inc[i]);
      const old_x = x[i];
      const new_x = vadd2(old_x, vmul(dt, old_v));
      const cond = and(lt(new_x[1], ground_height), lt(old_v[1], -1e-4));
      const toi = select(
        cond,
        Real,
        div(neg(sub(old_x[1], ground_height)), old_v[1]),
        0
      );
      const new_v = select(cond, Vec2, [0, 0], old_v);
      const new_new_x = vadd2(
        vadd2(old_x, vmul(toi, old_v)),
        vmul(sub(dt, toi), new_v)
      );

      next_v.push(new_v);
      next_x.push(new_new_x);
    }
    return { next_v, next_x };
  }
);

const nn1 = fn(
  [Real, Objects, Objects, Bias1, Vec2, Weights1],
  Hidden,
  (t, x, v, bias1, center, weights1) =>
    vec(n_hidden, Real, (i) => {
      let actuation: Real = 0;
      for (let j = 0; j < n_sin_waves; j++) {
        actuation = add(
          actuation,
          mul(
            weights1[i][j],
            sin(add(mul(t, spring_omega * dt), (2 * Math.PI * j) / n_sin_waves))
          )
        );
      }
      for (let j = 0; j < n_objects; j++) {
        const offset = vsub2(x[j], center);
        actuation = add(
          actuation,
          mul(mul(weights1[i][n_sin_waves + 4 * j], offset[0]), 0.05)
        );
        actuation = add(
          actuation,
          mul(mul(weights1[i][n_sin_waves + 4 * j + 1], offset[1]), 0.05)
        );
        actuation = add(
          actuation,
          mul(mul(weights1[i][n_sin_waves + 4 * j + 2], v[j][0]), 0.05)
        );
        actuation = add(
          actuation,
          mul(mul(weights1[i][n_sin_waves + 4 * j + 3], v[j][1]), 0.05)
        );
      }
      actuation = add(
        actuation,
        mul(weights1[i][n_objects * 4 + n_sin_waves], sub(goal[0], center[0]))
      );
      actuation = add(
        actuation,
        mul(
          weights1[i][n_objects * 4 + n_sin_waves + 1],
          sub(goal[1], center[1])
        )
      );
      actuation = add(actuation, bias1[i]);
      actuation = tanh(actuation);
      return actuation;
    })
);

const nn2 = fn([Weights2, Hidden, Bias2], Act, (weights2, hidden, bias2) => {
  const act = [];
  for (let i = 0; i < n_springs; i++) {
    let actuation: Real = 0;
    for (let j = 0; j < n_hidden; j++) {
      actuation = add(actuation, mul(weights2[i][j], hidden[j]));
    }
    actuation = add(actuation, bias2[i]);
    actuation = tanh(actuation);
    act.push(actuation);
  }
  return act;
});

// implicitly, the timestep is 0, 1, 2...
const step = fn(
  [Real, Objects, Objects, Weights1, Weights2, Bias1, Bias2],
  { x: Objects, v: Objects, act: Act },
  (t, init_x, init_v, weights1, weights2, bias1, bias2) => {
    // copy over the initial values
    const x: Vec<Real>[] = [];
    const v: Vec<Real>[] = [];
    for (let i = 0; i < n_objects; i++) {
      x.push(init_x[i]);
      v.push(init_v[i]);
    }
    // compute center and spring forces
    const center = compute_center(x);
    // go through neural network to compute actuations
    const hidden = nn1(t, x, v, bias1, center, weights1);
    const act = nn2(weights2, hidden, bias2);
    // return v_inc for the next timestep
    const v_inc = apply_spring_force(x, act);
    // const { next_x, next_v } = advance_no_toi(x, v, v_inc);
    const { next_x, next_v } = advance_toi(x, v, v_inc);
    return { x: next_x, v: next_v, act };
  }
);

function randn(): number {
  let u = 0,
    v = 0;
  while (u === 0) u = Math.random(); // Converting [0,1) to (0,1)
  while (v === 0) v = Math.random();
  const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  return z;
}

const init_weights_biases = () => {
  const weights1: number[][] = [];
  const weights2: number[][] = [];
  const bias1: number[] = [];
  const bias2: number[] = [];
  for (let i = 0; i < n_hidden; i++) {
    weights1.push([]);
    for (let j = 0; j < n_input_states; j++) {
      weights1[i].push(
        randn() * Math.sqrt(2 / (n_hidden + n_input_states)) * 2
      );
    }
    bias1.push(0);
  }
  for (let i = 0; i < n_springs; i++) {
    weights2.push([]);
    for (let j = 0; j < n_hidden; j++) {
      weights2[i].push(randn() * Math.sqrt(2 / (n_hidden + n_springs)) * 3);
    }
    bias2.push(0);
  }
  return { weights1, weights2, bias1, bias2 };
};

const compute_loss = fn([Objects], Real, (x) => {
  return neg(x[head_id][0]);
});

const allSteps = fn(
  [Objects, Objects, Weights1, Weights2, Bias1, Bias2],
  {
    xs: Vec(steps, Objects),
    acts: Vec(steps, Act),
    loss: Real,
  },
  (init_x, init_v, weights1, weights2, bias1, bias2) => {
    const xs = [];
    const acts = [];
    let x = init_x;
    let v = init_v;
    // different from original: the timestamp starts at 0
    for (let t = 0; t < steps; t++) {
      const {
        x: newX,
        v: newV,
        act,
      } = step(t, x, v, weights1, weights2, bias1, bias2);
      x = newX;
      v = newV;
      xs.push(x);
      acts.push(act);
    }
    return { xs, acts, loss: compute_loss(x) };
  }
);

const F = fn(
  [
    {
      init_x: Objects,
      init_v: Objects,
      weights1: Weights1,
      weights2: Weights2,
      bias1: Bias1,
      bias2: Bias2,
    },
  ],
  Real,
  ({ init_x, init_v, weights1, weights2, bias1, bias2 }) => {
    const { loss } = allSteps(init_x, init_v, weights1, weights2, bias1, bias2);
    return loss;
  }
);

const gradF = fn(
  [Objects, Objects, Weights1, Weights2, Bias1, Bias2],
  {
    bias1Grad: Bias1,
    bias2Grad: Bias2,
    weights1Grad: Weights1,
    weights2Grad: Weights2,
    loss: Real,
  },
  (init_x, init_v, weights1, weights2, bias1, bias2) => {
    const f = vjp(F)({ init_x, init_v, weights1, weights2, bias1, bias2 });
    const {
      bias1: bias1Grad,
      bias2: bias2Grad,
      weights1: weights1Grad,
      weights2: weights2Grad,
    } = f.grad(1);
    return { bias1Grad, bias2Grad, weights1Grad, weights2Grad, loss: f.ret };
  }
);

const stepsCompiled = await compile(allSteps);
const gradCompiled = await compile(gradF);

const optimize = () => {
  const { initV, initX } = init(robot);
  let { weights1, weights2, bias1, bias2 } = init_weights_biases();

  for (let i = 0; i < iter; i++) {
    let total_norm_sqr = 0;
    const { loss, bias1Grad, bias2Grad, weights1Grad, weights2Grad } =
      gradCompiled(initX, initV, weights1, weights2, bias1, bias2);
    console.log(`Iter=${i} Loss=${loss}`);
    for (let i = 0; i < n_hidden; i++) {
      for (let j = 0; j < n_input_states; j++) {
        total_norm_sqr += weights1Grad[i][j] ** 2;
      }
      total_norm_sqr += bias1Grad[i] ** 2;
    }
    for (let i = 0; i < n_springs; i++) {
      for (let j = 0; j < n_hidden; j++) {
        total_norm_sqr += weights2Grad[i][j] ** 2;
      }
      total_norm_sqr += bias2Grad[i] ** 2;
    }

    const gradient_clip = 0.2;
    const scale = gradient_clip / (total_norm_sqr ** 0.5 + 1e-6);
    for (let i = 0; i < n_hidden; i++) {
      for (let j = 0; j < n_input_states; j++) {
        weights1[i][j] -= scale * weights1Grad[i][j];
      }
      bias1[i] -= scale * bias1Grad[i];
    }
    for (let i = 0; i < n_springs; i++) {
      for (let j = 0; j < n_hidden; j++) {
        weights2[i][j] -= scale * weights2Grad[i][j];
      }
      bias2[i] -= scale * bias2Grad[i];
    }
  }
  return { weights1, weights2, bias1, bias2 };
};

const RobotViz = ({
  robot,
  x,
  act,
  w,
  h,
}: {
  robot: Robot;
  x: number[][];
  act: number[];
  w: number;
  h: number;
}) => {
  const { springs } = robot;
  return (
    <>
      {springs.map((spring, i) => {
        let r = 2;
        let c = "#000000";
        let a = act[i] * 0.5;
        if (spring.actuation == 0) {
          a = 0;
          c = "#222222";
        } else {
          r = 4;
          c = rgbToHex(0.5 + a, 0.5 - Math.abs(a), 0.5 - a);
        }
        const { object1, object2 } = spring;
        const [x1, y1] = x[object1];
        const [x2, y2] = x[object2];

        return (
          <line
            x1={x1 * w}
            y1={(1 - y1) * h}
            x2={x2 * w}
            y2={(1 - y2) * h}
            stroke={c}
            stroke-width={r}
          ></line>
        );
      })}
      {x.map(([x, y], i) => {
        const [r, g, b] = i === head_id ? [0.8, 0.2, 0.3] : [0.4, 0.6, 0.6];
        const color = rgbToHex(r, g, b);
        return <circle cx={x * w} cy={(1 - y) * h} fill={color} r={7}></circle>;
      })}
    </>
  );
};

const init = (robot: Robot): { initX: number[][]; initV: number[][] } => {
  const initX = [];
  const initV = [];
  for (let i = 0; i < n_objects; i++) {
    const object = robot.objects[i];
    initX.push([object.x, object.y]);
    initV.push([0, 0]);
  }
  return { initX, initV };
};

export default () => {
  const [w, h] = [512, 512];
  const toX = (x: number) => x * w;
  const toY = (y: number) => (1 - y) * h;

  // signals
  const [currentT, setCurrentT] = createSignal(0);

  const { initV, initX } = init(robot);

  const [x, setX] = createStore<number[][]>(initX);
  const [act, setAct] = createStore<number[]>([]);

  createEffect(() => {
    setX([...(xs[currentT()] as any)]);
    setAct([...(acts[currentT()] as any)]);
  });

  const { weights1, weights2, bias1, bias2 } = optimize();
  const { acts, xs, loss } = stepsCompiled(
    initX,
    initV,
    weights1,
    weights2,
    bias1,
    bias2
  );

  return (
    <>
      <svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${w} ${h}`}
        style={"background-color: #fff"}
      >
        <circle
          cx={goal[0] * w}
          cy={(1 - goal[1]) * h}
          fill={"red"}
          r={3}
        ></circle>
        <line
          x1={toX(0)}
          y1={toY(ground_height)}
          x2={toX(1)}
          y2={toY(ground_height)}
          stroke={"#000000"}
          stroke-width={3}
        ></line>
        <RobotViz robot={robot} x={x} act={act} w={w} h={h} />
      </svg>
      <div>
        T:
        <input
          type="range"
          min={0}
          max={steps - 1}
          step={1}
          value={currentT()}
          oninput={(v) => setCurrentT(v.target.valueAsNumber)}
          name="Time step"
        />
      </div>
      <div>
        Loss: <span>{loss.toFixed(3)}</span>
      </div>
    </>
  );
};
