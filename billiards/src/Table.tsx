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

const dt = 0.003;
const alpha = 0.0;
const learningRate = 0.01;

export default function Table() {
  const [w, h] = [1024, 1024];
  const pixelRadius = Math.round(radius * 1024) + 1;
  const cloth = "#2bb4e5";
  let x: number[][] = [[0.1, 0.5]];

  let count = 0;
  for (let i = 0; i < layers; i++) {
    for (let j = 0; j < i + 1; j++) {
      count += 1;
      x[count] = [
        i * 2 * radius + 0.5,
        j * 2 * radius + 0.5 - i * radius * 0.7,
      ];
    }
  }

  return (
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
  );
}
