import { Real, Vec, fn, vec } from "rose";
import { Vec2 } from "./lib";
import { Robot, robots } from "./robots";
// constants
const elasticity = 0.0;
const ground_height = 0.1;
const gravity = -4.8;
const friction = 2.5;
const gradient_clip = 1;
const spring_omega = 10;
const damping = 15;
const dt = 0.004;
const learning_rate = 25;
const n_sin_waves = 10;
const n_hidden = 32;

const act: number[][] = [];
const spring_actuation: number[] = [];
const spring_anchor_a: number[] = [];
const spring_anchor_b: number[] = [];

const x: number[][] = [];
const head_id = 0;
const goal = [0.9, 0.2];
const robot = robots[1]();
const n_objects: number = robot.objects.length;
const n_springs: number = robot.objects.length;

const rgbToHex = (r: number, g: number, b: number) =>
  "#" +
  [r, g, b]
    .map((x) => {
      const hex = Math.round(x * 255).toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("");

const init = () => {
  const x = [
    [0.3, 0.5],
    [0.3, 0.4],
    [0.4, 0.4],
  ];
  const spring_anchor_a = [0, 1, 2];
  const spring_anchor_b = [1, 2, 0];
  const spring_length = [0.1, 0.1, 0.1 * 2 ** 0.5];
};

const Objects = Vec(n_objects, Vec2);

const compute_center = fn([Objects], Real, (objects) => {});

const RobotViz = ({ robot, w, h }: { robot: Robot; w: number; h: number }) => {
  const { objects, springs } = robot;
  return (
    <>
      {springs.map((spring, i) => {
        let r = 2;
        let a = 0;
        let c = "#000000";
        if (spring.actuation == 0) {
          a = 0;
          c = "#222222";
        } else {
          console.log(spring);

          r = 4;
          c = rgbToHex(0.5 + a, 0.5 - Math.abs(a), 0.5 - a);
        }
        const { object1, object2 } = spring;
        const { x: x1, y: y1 } = objects[object1];
        const { x: x2, y: y2 } = objects[object2];
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
      {objects.map((object, i) => {
        const [r, g, b] = i === head_id ? [0.8, 0.2, 0.3] : [0.4, 0.6, 0.6];
        const color = rgbToHex(r, g, b);
        const { x, y } = object;
        return <circle cx={x * w} cy={(1 - y) * h} fill={color} r={7}></circle>;
      })}
    </>
  );
};

export default () => {
  const [w, h] = [512, 512];
  const toX = (x: number) => x * w;
  const toY = (y: number) => (1 - y) * h;
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
        <RobotViz robot={robot} w={w} h={h} />
      </svg>
    </>
  );
};
