import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import {
  goal,
  ground_height,
  head_id,
  init,
  init_weights_biases,
  optimize,
  steps,
  stepsCompiled,
} from "./optimizer";
import { Robot, robots } from "./robots";

const rgbToHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((x) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("");

const RobotViz = ({
  robot,
  x,
  act,
  head_id,
  w,
  h,
}: {
  robot: Robot;
  x: number[][];
  act: number[];
  head_id: number;
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
export default () => {
  const [w, h] = [512, 512];
  const toX = (x: number) => x * w;
  const toY = (y: number) => (1 - y) * h;
  const robot = robots[1]();

  // signals
  const [currentT, setCurrentT] = createSignal(0);

  const { initV, initX } = init(robot);
  const [optimizing, setOptimizing] = createSignal(false);

  const [x, setX] = createStore<number[][]>(initX);
  const [act, setAct] = createStore<number[]>([]);
  const { weights1, weights2, bias1, bias2 } = init_weights_biases();
  const { acts: initActs, xs: initXs } = stepsCompiled(
    initX,
    initV,
    weights1,
    weights2,
    bias1,
    bias2
  );
  const [xs, setXs] = createStore<number[][][]>(initXs as any);
  const [acts, setActs] = createStore<number[][]>(initActs as any);

  createEffect(() => {
    setX([...(xs[currentT()] as any)]);
    setAct([...(acts[currentT()] as any)]);
  });

  const optimizeNow = () => {
    setOptimizing(true);
    setTimeout(() => {
      // record timing info
      const start = performance.now();
      const { weights1, weights2, bias1, bias2 } = optimize();
      const end = performance.now();
      console.log(`Optimization took ${end - start}ms`);
      const { acts, xs } = stepsCompiled(
        initX,
        initV,
        weights1,
        weights2,
        bias1,
        bias2
      );
      setXs([...(xs as any)]);
      setActs([...(acts as any)]);
      setOptimizing(false);
    }, 10);
  };

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
        <RobotViz robot={robot} x={x} act={act} w={w} h={h} head_id={head_id} />
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
      {/* <div>
        Loss: <span>{loss().toFixed(3)}</span>
      </div> */}
      <button onclick={() => optimizeNow()} disabled={optimizing()}>
        {!optimizing() ? "Train" : "Training"}
      </button>
    </>
  );
};
