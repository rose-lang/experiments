import "./App.css";
import Table from "./Table";

import { Real, Vec, fn, interp, mul, vjp } from "rose";

const f = fn([Vec(2, Real)], Real, (v) => mul(v[0], v[1]));

const g = fn([Real, Real], Vec(3, Real), (x, y) => {
  const { ret, grad } = vjp(f)([x, y]);
  const v = grad(1);
  return [ret, v[0], v[1]];
});

function App() {
  // console.log(interp(g)(2, 3)); // [6, 3, 2]
  return (
    <>
      <h1>Billiards</h1>
      <div class="card">
        <p>Differentiable physics for break shots!</p>
      </div>
      <div class="table">
        <Table />
      </div>
    </>
  );
}

export default App;
