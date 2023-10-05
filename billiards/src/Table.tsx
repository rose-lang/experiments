export default function Table() {
  const [w, h] = [2048, 1024];
  const cloth = "#2bb4e5";
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`}>
      <rect width={w} height={h} fill={cloth}></rect>
    </svg>
  );
}
