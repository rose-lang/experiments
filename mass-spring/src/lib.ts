import {
  Vec,
  Real,
  div,
  mul,
  fn,
  vec,
  add,
  sub,
  sqrt,
  select,
  lt,
  opaque,
  Dual,
  neg,
} from "rose";

// vector helpers
export const Vec2 = Vec(2, Real);

export const pow = (x: Real, n: number): Real => {
  if (!Number.isInteger(n)) throw new Error(`exponent is not an integer: ${n}`);
  // https://en.wikipedia.org/wiki/Exponentiation_by_squaring
  if (n < 0) return pow(div(1, x), -n);
  else if (n == 0) return 1;
  else if (n == 1) return x;
  else if (n % 2 == 0) return pow(mul(x, x), n / 2);
  else return mul(x, pow(mul(x, x), (n - 1) / 2));
};

export const vadd2 = fn([Vec2, Vec2], Vec2, (v1, v2) =>
  vec(2, Real, (i) => add(v1[i], v2[i]))
);
export const vsub2 = fn([Vec2, Vec2], Vec2, (v1, v2) =>
  vec(2, Real, (i) => sub(v1[i], v2[i]))
);

export const vmul = fn([Real, Vec2], Vec2, (a, v) =>
  vec(2, Real, (i) => mul(a, v[i]))
);

export const norm = fn([Vec2], Real, (v) =>
  sqrt(add(mul(v[0], v[0]), mul(v[1], v[1])))
);

export const dot = fn([Vec2, Vec2], Real, (v1, v2) =>
  add(mul(v1[0], v2[0]), mul(v1[1], v2[1]))
);

export const min = fn([Real, Real], Real, (a, b) =>
  select(lt(a, b), Real, a, b)
);

export const normalize = fn([Vec2, Real], Vec2, (v, eps) =>
  vmul(div(1, add(eps, norm(v))), v)
);

export const print = opaque([Real], Real, (x) => {
  console.log(x);
  return x;
});

export const exp = opaque([Real], Real, Math.exp);
exp.jvp = fn([Dual], Dual, ({ re: x, du: dx }) => {
  const y = exp(x);
  const dy = mul(dx, y);
  return { re: y, du: dy };
});

export const tanh = opaque([Real], Real, Math.tanh);
tanh.jvp = fn([Dual], Dual, ({ re: x, du: dx }) => {
  const y = tanh(x);
  const dy = mul(dx, sub(1, mul(y, y)));
  return { re: y, du: dy };
});

export const cos = opaque([Real], Real, Math.cos);
export const sin = opaque([Real], Real, Math.sin);

cos.jvp = fn([Dual], Dual, ({ re: x, du: dx }) => {
  const y = cos(x);
  const dy = mul(dx, neg(sin(x)));
  return { re: y, du: dy };
});
sin.jvp = fn([Dual], Dual, ({ re: x, du: dx }) => {
  const y = sin(x);
  const dy = mul(dx, cos(x));
  return { re: y, du: dy };
});
