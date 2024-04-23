import { createEffect, createSignal } from "solid-js";
import { createStore } from "solid-js/store";
import {
  ballCount,
  init,
  optimize,
  radius,
  steps,
  stepsCompiled,
} from "./optimizer";

// const stepsCompiled = interp(allSteps);

export default function Table() {
  const [w, h] = [1024, 1024];
  const pixelRadius = Math.round(radius * 1024) + 1;
  const cloth = "#2bb4e5";
  const [currentT, setCurrentT] = createSignal(0);
  const [optimizing, setOptimizing] = createSignal(false);

  const { initV, initX } = init();

  const [x, setX] = createStore<number[][]>(initX);
  const [xs, setXs] = createStore<number[][][]>(
    stepsCompiled(initX, initV) as any
  );

  createEffect(() => {
    setX([...(xs[currentT()] as any)]);
  });

  const optimizePos = () => {
    setOptimizing(true);
    setTimeout(() => {
      // record timing
      const start = performance.now();
      const { x: optX, v: optV } = optimize(goal, targetBall());
      const end = performance.now();
      console.log(`optimization took ${end - start}ms`);
      initX[0] = optX as any;
      initV[0] = optV as any;
      const xs = stepsCompiled(initX, initV);
      setXs(xs as any);
      setOptimizing(false);
    }, 1);
  };

  const [goal, setGoal] = createStore([0.9, 0.75]);
  const [targetBall, setTargetBall] = createSignal(ballCount - 1);
  const getPosition = (
    { clientX, clientY }: { clientX: number; clientY: number },
    svg: SVGSVGElement
  ) => {
    const CTM = svg.getScreenCTM();
    if (CTM !== null) {
      return { x: (clientX - CTM.e) / CTM.a, y: (clientY - CTM.f) / CTM.d };
    }
    return { x: 0, y: 0 };
  };

  const clamp = (x: number, min: number, max: number): number =>
    Math.min(Math.max(x, min), max);

  const onMouseDown = () => {
    const radius = pixelRadius / 2;
    const minX = radius;
    const maxX = w - radius;
    const minY = radius;
    const maxY = h - radius;

    const onMouseMove = (e: MouseEvent) => {
      const { clientX, clientY } = e;
      const { x: newX, y: newY } = getPosition({ clientX, clientY }, svg!);
      const constrainedX = clamp(newX, minX, maxX);
      const constrainedY = clamp(newY, minY, maxY);
      const newGoal = [constrainedX / 1024, (h - constrainedY) / 1024];
      setGoal(newGoal);
    };
    const onMouseUp = () => {
      document.removeEventListener("mouseup", onMouseUp);
      document.removeEventListener("mousemove", onMouseMove);
    };
    document.addEventListener("mouseup", onMouseUp);
    document.addEventListener("mousemove", onMouseMove);
  };

  let svg: SVGSVGElement | undefined;

  return (
    <>
      <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} ref={svg}>
        <rect width={w} height={h} fill={cloth}></rect>
        {x.map(([x, y], i) => (
          <circle
            cx={x * 1024}
            cy={h - y * 1024}
            r={pixelRadius}
            fill={i === 0 ? "#fff" : i === targetBall() ? "#3344cc" : "#f20530"}
            onclick={() => setTargetBall(i)}
          ></circle>
        ))}
        <circle
          cx={goal[0] * 1024}
          cy={h - goal[1] * 1024}
          r={pixelRadius / 2}
          onMouseDown={onMouseDown}
          style={{ cursor: "move" }}
          fill="#000"
        ></circle>
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
      <button onclick={() => optimizePos()} disabled={optimizing()}>
        {!optimizing() ? "Optimize" : "Optimizing"}
      </button>
    </>
  );
}
