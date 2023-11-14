interface Object {
  x: number;
  y: number;
  actuation?: number;
}

interface Spring {
  object1: number;
  object2: number;
  length: number;
  stiffness: number;
  actuation: number;
}

export interface Robot {
  objects: Object[];
  springs: Spring[];
}

const add_object = (r: Robot, x: number, y: number): void => {
  r.objects.push({ x, y });
};

const add_spring = (
  r: Robot,
  a: number,
  b: number,
  stiffness: number,
  actuation: number,
  length?: number
): void => {
  const l =
    ((r.objects[a].x - r.objects[b].x) ** 2 +
      (r.objects[a].y - r.objects[b].y) ** 2) **
    0.5;
  r.springs.push({
    object1: a,
    object2: b,
    length: length ?? l,
    stiffness,
    actuation,
  });
};

function robotA(): Robot {
  const robot = { objects: [], springs: [] };
  add_object(robot, 0.2, 0.1);
  add_object(robot, 0.3, 0.13);
  add_object(robot, 0.4, 0.1);
  add_object(robot, 0.2, 0.2);
  add_object(robot, 0.3, 0.2);
  add_object(robot, 0.4, 0.2);
  const s = 14000;
  const a = 0.1;
  add_spring(robot, 0, 1, s, a);
  add_spring(robot, 1, 2, s, a);
  add_spring(robot, 3, 4, s, a);
  add_spring(robot, 4, 5, s, a);
  add_spring(robot, 0, 3, s, a);
  add_spring(robot, 2, 5, s, a);
  add_spring(robot, 0, 4, s, a);
  add_spring(robot, 1, 4, s, a);
  add_spring(robot, 2, 4, s, a);
  add_spring(robot, 3, 1, s, a);
  add_spring(robot, 5, 1, s, a);
  return robot;
}

const points: [number, number][] = [];
const pointId: number[] = [];
const meshSprings: [number, number][] = [];

function addMeshPoint(robot: Robot, i: number, j: number): number {
  const index = points.findIndex(([x, y]) => x === i && y === j);
  if (index !== -1) {
    return pointId[index];
  }
  add_object(robot, i * 0.05 + 0.1, j * 0.05 + 0.1);
  const id = robot.objects.length - 1;
  points.push([i, j]);
  pointId.push(id);
  return id;
}

function add_mesh_spring(
  robot: Robot,
  a: number,
  b: number,
  s: number,
  act: number
): void {
  if (
    meshSprings.some(([x, y]) => (x === a && y === b) || (x === b && y === a))
  ) {
    return;
  }
  meshSprings.push([a, b]);
  add_spring(robot, a, b, s, act);
}

function add_mesh_square(
  robot: Robot,
  i: number,
  j: number,
  actuation = 0.0
): void {
  const a = addMeshPoint(robot, i, j);
  const b = addMeshPoint(robot, i, j + 1);
  const c = addMeshPoint(robot, i + 1, j);
  const d = addMeshPoint(robot, i + 1, j + 1);

  // b d
  // a c
  add_mesh_spring(robot, a, b, 3e4, actuation);
  add_mesh_spring(robot, c, d, 3e4, actuation);

  for (const i of [a, b, c, d])
    for (const j of [a, b, c, d])
      if (i !== j) add_mesh_spring(robot, i, j, 3e4, 0);
}

function robotC() {
  const robot = { objects: [], springs: [] };
  add_mesh_square(robot, 2, 0, 0.15);
  add_mesh_square(robot, 0, 0, 0.15);
  add_mesh_square(robot, 0, 1, 0.15);
  add_mesh_square(robot, 0, 2);
  add_mesh_square(robot, 1, 2);
  add_mesh_square(robot, 2, 1, 0.15);
  add_mesh_square(robot, 2, 2);
  add_mesh_square(robot, 2, 3);
  add_mesh_square(robot, 2, 4);
  add_mesh_square(robot, 3, 1);
  add_mesh_square(robot, 4, 0, 0.15);
  add_mesh_square(robot, 4, 1, 0.15);

  return robot;
}

export const robots = [robotA, robotC];
