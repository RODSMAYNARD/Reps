// Gerador dos ícones 3D originais do Reps (equipamentos e grupos musculares).
// Tudo é modelado aqui em Three.js (formas simples + luz de estúdio); o boneco usa os caminhos MIT do
// `react-native-body-highlighter` (servidos por `server.mjs` em /body.json) extrudados em relevo.
// Saída: PNG 192x192 com o círculo branco já desenhado (o app só mostra a imagem, sem recorte).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SVGLoader } from 'three/addons/loaders/SVGLoader.js';

const SIZE = 640;
const OUT = 192; // mostrado em até 56 pt (168 px numa tela 3x)
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(SIZE, SIZE);
renderer.setClearColor(0x000000, 0);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const ENV = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;

const std = (color, roughness, metalness = 0, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, metalness, envMapIntensity: 0.85, ...extra });
const MAT = {
  rubber: std(0x2a2a2e, 0.5),
  iron: std(0x1f1f22, 0.45, 0.2),
  steel: std(0xd9dce1, 0.26, 0.92),
  frame: std(0xbfc4cb, 0.4, 0.55),
  pad: std(0x2d2e34, 0.7),
  grip: std(0x232428, 0.85),
  blue: std(0x0a84ff, 0.42),
  red: new THREE.MeshPhysicalMaterial({ color: 0xe5484d, roughness: 0.28, clearcoat: 0.8, clearcoatRoughness: 0.2, envMapIntensity: 0.9 }),
  white: std(0xffffff, 0.35),
  wood: std(0xc99a64, 0.55),
  strap: std(0x34363d, 0.8),
  screen: std(0x111318, 0.2, 0.3),
  body: std(0xc9cdd3, 0.55),
  bodyBase: std(0x737b86, 0.75),
  muscle: std(0x0874ec, 0.38),
};

// ---------- formas básicas ----------
const V2 = (x, y) => new THREE.Vector2(x, y);
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const mesh = (geo, mat) => new THREE.Mesh(geo, mat);
const grp = (...kids) => { const g = new THREE.Group(); kids.flat().forEach((k) => k && g.add(k)); return g; };
const at = (o, [x = 0, y = 0, z = 0] = [], [rx = 0, ry = 0, rz = 0] = []) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); return o; };
const arc = (arr, cx, cy, r, a0, a1, n = 6) => { for (let i = 0; i <= n; i++) { const a = a0 + ((a1 - a0) * i) / n; arr.push(V2(cx + r * Math.cos(a), cy + r * Math.sin(a))); } };

/** Cilindro de bordas arredondadas no eixo X (torneado). `hole` = furo central. */
function rcyl(r, len, e, mat, hole = 0, axis = 'x') {
  const h = len / 2, p = [V2(hole, -h)];
  arc(p, r - e, -h + e, e, -Math.PI / 2, 0);
  arc(p, r - e, h - e, e, 0, Math.PI / 2);
  p.push(V2(hole, h));
  if (hole) p.push(V2(hole, -h));
  const g = new THREE.LatheGeometry(p, 72);
  if (axis === 'x') g.rotateZ(-Math.PI / 2);
  if (axis === 'z') g.rotateX(Math.PI / 2);
  return mesh(g, mat);
}

/** Anilha de borracha: aro e cubo altos, face rebaixada, cantos arredondados (eixo X). */
function plate(R, T, mat = MAT.rubber, { hole = 0.045, hub = 0.15, rim = 0.16, recess = 0.022, e = 0.035 } = {}) {
  const h = T / 2, ro = R * (1 - rim), p = [V2(hole, -h), V2(hub, -h), V2(hub + 0.012, -h + recess), V2(ro - 0.012, -h + recess), V2(ro, -h)];
  arc(p, R - e, -h + e, e, -Math.PI / 2, 0);
  arc(p, R - e, h - e, e, 0, Math.PI / 2);
  p.push(V2(ro, h), V2(ro - 0.012, h - recess), V2(hub + 0.012, h - recess), V2(hub, h), V2(hole, h), V2(hole, -h));
  const g = new THREE.LatheGeometry(p, 96);
  g.rotateZ(-Math.PI / 2);
  return grp(mesh(g, mat), rcyl(hub * 0.72, T + 0.008, 0.008, MAT.steel, hole));
}

const box = (w, h, d, r, mat) => mesh(new RoundedBoxGeometry(w, h, d, 4, Math.min(r, w / 2, h / 2, d / 2)), mat);
const tube = (pts, r, mat, { closed = false, seg = 160, tension = 0.5 } = {}) =>
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map((p) => V3(...p)), closed, 'catmullrom', tension), seg, r, 24, closed), mat);
/** Tubo reto entre dois pontos. */
function rod(a, b, r, mat) {
  const A = V3(...a), B = V3(...b), len = A.distanceTo(B);
  const m = mesh(new THREE.CylinderGeometry(r, r, len, 32), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
/** Barra quadrada entre dois pontos (estrutura de máquina). */
function beam(a, b, s, mat = MAT.frame) {
  const A = V3(...a), B = V3(...b), len = A.distanceTo(B);
  const m = box(s, len + s, s, s * 0.28, mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), B.clone().sub(A).normalize());
  return m;
}
/** Fita chata e fechada (elástico) seguindo uma elipse, com torção. */
function ribbonLoop(a, b, width, thick, mat, twist = 0) {
  const N = 240, pos = [], idx = [];
  const ring = [];
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * Math.PI * 2;
    const c = V3(a * Math.cos(t), 0, b * Math.sin(t));
    const tan = V3(-a * Math.sin(t), 0, b * Math.cos(t)).normalize();
    const nrm = V3(tan.z, 0, -tan.x); // para fora, no plano
    const up = V3(0, 1, 0).applyAxisAngle(tan, twist * t);
    const side = nrm.clone().applyAxisAngle(tan, twist * t);
    ring.push([c, up, side]);
  }
  ring.forEach(([c, up, side]) => {
    for (const [u, s] of [[1, 1], [-1, 1], [-1, -1], [1, -1]]) pos.push(...c.clone().addScaledVector(up, (u * width) / 2).addScaledVector(side, (s * thick) / 2).toArray());
  });
  for (let i = 0; i < N; i++) for (let k = 0; k < 4; k++) {
    const a0 = i * 4 + k, a1 = i * 4 + ((k + 1) % 4), b0 = a0 + 4, b1 = a1 + 4;
    idx.push(a0, b0, a1, a1, b0, b1);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  const m2 = mat.clone();
  m2.side = THREE.DoubleSide;
  return mesh(g, m2);
}

// ---------- equipamentos (cada um no seu eixo "natural"; `view` gira para o 3/4) ----------
const M = {};

M.dumbbell = () => grp(
  rcyl(0.07, 1.0, 0.01, MAT.steel),
  [-1, 1].map((s) => grp(
    at(rcyl(0.11, 0.06, 0.015, MAT.steel), [s * 0.46]),
    at(plate(0.42, 0.15), [s * 0.57]),
    at(plate(0.42, 0.15), [s * 0.73]),
    at(plate(0.34, 0.12), [s * 0.87]),
    at(rcyl(0.085, 0.12, 0.02, MAT.steel), [s * 0.98]),
  )),
);

M.barbell = () => grp(
  rcyl(0.032, 2.3, 0.01, MAT.steel),
  [-1, 1].map((s) => grp(
    at(rcyl(0.07, 0.05, 0.012, MAT.steel), [s * 0.78]),
    at(rcyl(0.055, 0.62, 0.02, MAT.steel), [s * 1.12]),
    at(plate(0.5, 0.11), [s * 0.88]),
    at(plate(0.5, 0.11), [s * 1.0]),
    at(plate(0.36, 0.08), [s * 1.1]),
    at(rcyl(0.075, 0.05, 0.012, MAT.steel), [s * 1.17]),
  )),
);

M.ezbar = () => {
  const pts = [[-0.62, 0, 0], [-0.42, 0, 0], [-0.33, 0, 0.07], [-0.22, 0, -0.06], [-0.1, 0, 0.05], [0.1, 0, 0.05], [0.22, 0, -0.06], [0.33, 0, 0.07], [0.42, 0, 0], [0.62, 0, 0]];
  return grp(
    tube(pts, 0.03, MAT.steel, { tension: 0.2 }),
    [-1, 1].map((s) => grp(
      at(rcyl(0.06, 0.04, 0.01, MAT.steel), [s * 0.64]),
      at(rcyl(0.05, 0.42, 0.016, MAT.steel), [s * 0.86]),
      at(plate(0.34, 0.08), [s * 0.73]),
      at(plate(0.27, 0.07), [s * 0.82]),
      at(rcyl(0.065, 0.04, 0.01, MAT.steel), [s * 0.87]),
    )),
  );
};

M.kettlebell = () => {
  const p = [V2(0, -0.53), V2(0.25, -0.53)];
  arc(p, 0, -0.06, 0.55, -1.03, Math.PI / 2, 40);
  const body = mesh(new THREE.LatheGeometry(p, 96), MAT.iron);
  const handle = tube([[-0.3, 0.33, 0], [-0.36, 0.6, 0], [-0.24, 0.82, 0], [0, 0.87, 0], [0.24, 0.82, 0], [0.36, 0.6, 0], [0.3, 0.33, 0]], 0.08, MAT.iron);
  return grp(body, handle);
};

M.plate = () => plate(0.62, 0.13, MAT.rubber, { hole: 0.05, hub: 0.17, rim: 0.15, recess: 0.02 });

M.machine = () => grp(
  box(1.25, 0.07, 1.25, 0.03, MAT.frame),
  // torre com a pilha de anilhas
  beam([-0.27, 0, -0.45], [-0.27, 1.7, -0.45], 0.09), beam([0.27, 0, -0.45], [0.27, 1.7, -0.45], 0.09), beam([-0.27, 1.7, -0.45], [0.27, 1.7, -0.45], 0.09),
  Array.from({ length: 9 }, (_, i) => at(box(0.42, 0.065, 0.24, 0.02, MAT.iron), [0, 0.12 + i * 0.075, -0.45])),
  rod([-0.1, 0.05, -0.45], [-0.1, 1.68, -0.45], 0.012, MAT.steel), rod([0.1, 0.05, -0.45], [0.1, 1.68, -0.45], 0.012, MAT.steel),
  at(rcyl(0.11, 0.05, 0.015, MAT.steel, 0, 'z'), [0, 1.55, -0.38]),
  // banco e encosto
  beam([0, 0, 0.3], [0, 0.5, 0.3], 0.08),
  at(box(0.5, 0.1, 0.48, 0.05, MAT.pad), [0, 0.56, 0.3]),
  at(box(0.5, 0.78, 0.1, 0.05, MAT.pad), [0, 1.02, -0.02], [-0.12, 0, 0]),
  beam([0, 0.5, -0.12], [0, 1.0, -0.12], 0.07),
  // braços com pegadores
  [-1, 1].map((s) => grp(
    tube([[s * 0.27, 1.45, -0.45], [s * 0.4, 1.4, -0.15], [s * 0.42, 1.2, 0.25], [s * 0.36, 1.05, 0.45]], 0.035, MAT.frame),
    at(rcyl(0.035, 0.16, 0.012, MAT.grip, 0, 'z'), [s * 0.36, 1.03, 0.52]),
  )),
);

M.cable = () => grp(
  // roldana presa numa viga, cabo e pegador em D
  beam([-0.62, 1.22, 0], [0.12, 1.22, 0], 0.13),
  at(box(0.24, 0.34, 0.2, 0.05, MAT.frame), [-0.3, 1.02, 0]),
  at(rcyl(0.15, 0.07, 0.025, MAT.steel, 0, 'z'), [-0.3, 0.94, 0.12]),
  at(rcyl(0.05, 0.09, 0.015, MAT.iron, 0, 'z'), [-0.3, 0.94, 0.13]),
  tube([[-0.18, 0.86, 0.14], [-0.02, 0.45, 0.14], [0.14, 0.05, 0.14]], 0.016, MAT.grip),
  at(mesh(new THREE.TorusGeometry(0.045, 0.012, 16, 40), MAT.steel), [0.15, 0.01, 0.14]),
  tube([[0.15, -0.03, 0.14], [-0.02, -0.2, 0.14], [-0.05, -0.38, 0.14], [0.38, -0.38, 0.14], [0.35, -0.2, 0.14], [0.15, -0.03, 0.14]], 0.024, MAT.steel, { closed: true, tension: 0.3 }),
  at(rcyl(0.055, 0.34, 0.02, MAT.grip), [0.165, -0.38, 0.14]),
);

M.band = () => ribbonLoop(0.72, 0.36, 0.24, 0.035, MAT.blue, 1);

M.suspension = () => {
  const strap = (a, b) => beam(a, b, 0.075, MAT.strap);
  const handle = (x) => grp(
    at(rcyl(0.065, 0.34, 0.025, MAT.grip), [x, -0.72, 0]),
    tube([[x - 0.13, -0.72, 0], [x - 0.05, -0.5, 0], [x, -0.42, 0], [x + 0.05, -0.5, 0], [x + 0.13, -0.72, 0]], 0.012, MAT.steel),
  );
  return grp(
    at(mesh(new THREE.TorusGeometry(0.11, 0.025, 24, 64), MAT.steel), [0, 1.05, 0]),
    strap([0, 0.94, 0], [0, 0.55, 0]),
    at(box(0.1, 0.12, 0.05, 0.02, MAT.steel), [0, 0.5, 0]),
    strap([-0.03, 0.45, 0], [-0.32, -0.42, 0]),
    strap([0.03, 0.45, 0], [0.32, -0.42, 0]),
    handle(-0.34), handle(0.34),
  );
};

M.landmine = () => grp(
  box(0.6, 0.05, 0.6, 0.02, MAT.iron),
  at(rcyl(0.07, 0.12, 0.02, MAT.steel, 0, 'y'), [0, 0.08, 0]),
  grp(
    at(rcyl(0.05, 0.4, 0.012, MAT.steel), [0.2, 0, 0]),
    at(rcyl(0.032, 1.8, 0.01, MAT.steel), [1.1, 0, 0]),
    at(rcyl(0.055, 0.5, 0.015, MAT.steel), [2.1, 0, 0]),
    at(plate(0.42, 0.11), [1.95, 0, 0]),
    at(rcyl(0.07, 0.04, 0.01, MAT.steel), [2.03, 0, 0]),
  ).rotateZ(0.42).translateY(0.12),
);

M.trapbar = () => {
  const hex = Array.from({ length: 6 }, (_, i) => { const a = (i / 6) * Math.PI * 2; return [0.62 * Math.cos(a), 0, 0.5 * Math.sin(a)]; });
  return grp(
    tube(hex, 0.03, MAT.steel, { closed: true, tension: 0.05 }),
    [-1, 1].map((s) => grp(
      rod([s * 0.26, 0, -0.2], [s * 0.26, 0, 0.2], 0.032, MAT.steel),
      rod([s * 0.26, 0.001, -0.11], [s * 0.26, 0.001, 0.11], 0.04, MAT.grip),
      at(rcyl(0.05, 0.42, 0.015, MAT.steel), [s * 0.82, 0, 0]),
      at(plate(0.42, 0.1), [s * 0.74, 0, 0]),
      at(plate(0.42, 0.1), [s * 0.85, 0, 0]),
      at(rcyl(0.065, 0.04, 0.01, MAT.steel), [s * 0.92, 0, 0]),
    )),
  );
};

M.pullup = () => grp(
  [-1, 1].map((s) => grp(
    beam([s * 0.7, 0, 0], [s * 0.7, 1.9, 0], 0.11),
    at(box(0.12, 0.06, 0.8, 0.03, MAT.frame), [s * 0.7, 0.03, 0]),
    tube([[s * 0.7, 1.85, 0], [s * 0.76, 1.85, 0.2], [s * 0.86, 1.8, 0.4]], 0.035, MAT.steel),
    at(rcyl(0.045, 0.2, 0.015, MAT.grip, 0, 'z'), [s * 0.87, 1.79, 0.42], [0.2, 0, 0]),
  )),
  rod([-0.7, 1.85, 0], [0.7, 1.85, 0], 0.035, MAT.steel),
  rod([-0.7, 1.2, -0.02], [0.7, 1.2, -0.02], 0.03, MAT.frame),
);

M.rack = () => grp(
  [[-0.62, -0.35], [0.62, -0.35], [-0.62, 0.35], [0.62, 0.35]].map(([x, z]) => beam([x, 0, z], [x, 1.9, z], 0.09)),
  [-1, 1].map((s) => grp(beam([s * 0.62, 1.9, -0.35], [s * 0.62, 1.9, 0.35], 0.08), beam([s * 0.62, 0.04, -0.35], [s * 0.62, 0.04, 0.35], 0.08))),
  beam([-0.62, 1.9, -0.35], [0.62, 1.9, -0.35], 0.08), beam([-0.62, 0.04, -0.35], [0.62, 0.04, -0.35], 0.08),
  [-1, 1].map((s) => at(box(0.06, 0.12, 0.12, 0.02, MAT.steel), [s * 0.62, 1.12, 0.43])),
  at(grp(
    rcyl(0.028, 1.9, 0.01, MAT.steel),
    [-1, 1].map((s) => grp(at(rcyl(0.05, 0.45, 0.015, MAT.steel), [s * 1.1, 0, 0]), at(plate(0.42, 0.1), [s * 1.0, 0, 0]), at(plate(0.42, 0.1), [s * 1.11, 0, 0]))),
  ), [0, 1.2, 0.47]),
);

M.smith = () => grp(
  [-1, 1].map((s) => grp(
    beam([s * 0.7, 0, 0], [s * 0.7, 1.9, 0], 0.11),
    at(box(0.12, 0.06, 0.9, 0.03, MAT.frame), [s * 0.7, 0.03, 0]),
    rod([s * 0.55, 0.06, 0.08], [s * 0.55, 1.85, 0.08], 0.018, MAT.steel),
    at(box(0.09, 0.1, 0.09, 0.02, MAT.frame), [s * 0.55, 1.05, 0.08]),
  )),
  beam([-0.7, 1.9, 0], [0.7, 1.9, 0], 0.1),
  at(grp(
    rcyl(0.028, 1.6, 0.01, MAT.steel),
    [-1, 1].map((s) => grp(at(rcyl(0.05, 0.4, 0.015, MAT.steel), [s * 0.95, 0, 0]), at(plate(0.38, 0.09), [s * 0.88, 0, 0]))),
  ), [0, 1.05, 0.08]),
);

M.bench = () => grp(
  at(box(0.42, 0.12, 1.35, 0.05, MAT.pad), [0, 0.5, 0]),
  beam([0, 0.44, -0.55], [0, 0.44, 0.55], 0.09),
  [-1, 1].map((s) => grp(beam([0, 0.44, s * 0.48], [0, 0.04, s * 0.48], 0.08), at(box(0.5, 0.06, 0.1, 0.03, MAT.frame), [0, 0.03, s * 0.48]))),
);

M.adjbench = () => grp(
  at(box(0.42, 0.11, 0.48, 0.05, MAT.pad), [0, 0.5, 0.36]),
  at(box(0.42, 0.11, 0.9, 0.05, MAT.pad), [0, 0.78, -0.25], [-0.62, 0, 0]),
  beam([0, 0.42, -0.6], [0, 0.42, 0.6], 0.09),
  beam([0, 0.42, -0.2], [0, 0.66, -0.06], 0.06),
  [-1, 1].map((s) => grp(beam([0, 0.42, s * 0.55], [0, 0.04, s * 0.55], 0.08), at(box(0.5, 0.06, 0.1, 0.03, MAT.frame), [0, 0.03, s * 0.55]))),
);

M.dipbar = () => grp(
  [-1, 1].map((s) => grp(
    rod([s * 0.3, 1.1, -0.45], [s * 0.3, 1.1, 0.45], 0.035, MAT.steel),
    rod([s * 0.3, 1.1, 0.18], [s * 0.3, 1.1, 0.42], 0.045, MAT.grip),
    beam([s * 0.3, 0, -0.42], [s * 0.3, 1.08, -0.42], 0.08),
    beam([s * 0.3, 0, 0.0], [s * 0.3, 1.08, 0.0], 0.08),
    at(box(0.1, 0.06, 1.0, 0.03, MAT.frame), [s * 0.3, 0.03, -0.1]),
  )),
  beam([-0.3, 0.25, -0.42], [0.3, 0.25, -0.42], 0.07),
);

M.legpress = () => {
  const r = Math.PI / 4;
  return grp(
    at(box(0.7, 0.07, 2.0, 0.03, MAT.frame), [0, 0.035, 0]),
    [-1, 1].map((s) => beam([s * 0.28, 0.07, 0.6], [s * 0.28, 1.45, -0.78], 0.08)),
    // trenó com a plataforma e os pinos de anilha
    at(grp(
      box(0.66, 0.08, 0.5, 0.03, MAT.frame),
      at(box(0.6, 0.55, 0.05, 0.02, MAT.iron), [0, 0.3, 0.25], [-0.25, 0, 0]),
      [-1, 1].map((s) => grp(at(rcyl(0.045, 0.32, 0.012, MAT.steel), [s * 0.47, 0.05, 0]), at(plate(0.3, 0.07), [s * 0.42, 0.05, 0]))),
    ), [0, 0.95, -0.28], [r, 0, 0]),
    // banco
    at(box(0.5, 0.1, 0.45, 0.05, MAT.pad), [0, 0.42, 0.62]),
    at(box(0.5, 0.65, 0.1, 0.05, MAT.pad), [0, 0.68, 0.92], [0.55, 0, 0]),
    beam([0, 0.07, 0.62], [0, 0.38, 0.62], 0.08),
  );
};

M.platemachine = () => grp(
  box(1.0, 0.06, 1.3, 0.03, MAT.frame),
  beam([0, 0, -0.45], [0, 1.6, -0.45], 0.1),
  beam([0, 0, 0.35], [0, 0.45, 0.35], 0.08),
  at(box(0.48, 0.1, 0.45, 0.05, MAT.pad), [0, 0.5, 0.35]),
  at(box(0.48, 0.7, 0.1, 0.05, MAT.pad), [0, 1.0, 0.05], [-0.15, 0, 0]),
  [-1, 1].map((s) => grp(
    tube([[s * 0.06, 1.55, -0.45], [s * 0.34, 1.45, -0.2], [s * 0.42, 1.2, 0.2], [s * 0.4, 1.05, 0.5]], 0.04, MAT.frame),
    at(rcyl(0.035, 0.16, 0.012, MAT.grip, 0, 'z'), [s * 0.4, 1.03, 0.56]),
    at(rcyl(0.04, 0.3, 0.012, MAT.steel), [s * 0.55, 1.3, -0.1]),
    at(plate(0.3, 0.07), [s * 0.58, 1.3, -0.1]),
  )),
);

M.treadmill = () => grp(
  at(box(0.78, 0.14, 1.8, 0.05, MAT.frame), [0, 0.1, 0]),
  at(box(0.6, 0.03, 1.62, 0.012, MAT.grip), [0, 0.18, 0.02]),
  at(box(0.82, 0.18, 0.28, 0.06, MAT.frame), [0, 0.13, -0.86]),
  [-1, 1].map((s) => grp(
    beam([s * 0.35, 0.18, -0.85], [s * 0.33, 1.25, -0.72], 0.07),
    tube([[s * 0.33, 1.15, -0.72], [s * 0.35, 1.12, -0.45], [s * 0.36, 1.05, -0.2]], 0.03, MAT.steel),
  )),
  at(grp(box(0.78, 0.3, 0.1, 0.04, MAT.frame), at(box(0.5, 0.16, 0.02, 0.01, MAT.screen), [0, 0, 0.052])), [0, 1.28, -0.74], [-0.45, 0, 0]),
);

M.rower = () => grp(
  beam([0, 0.2, 1.0], [0, 0.38, -0.75], 0.11),
  at(rcyl(0.36, 0.22, 0.06, MAT.iron, 0, 'x'), [0, 0.42, -0.92]),
  at(rcyl(0.1, 0.24, 0.02, MAT.steel, 0, 'x'), [0, 0.42, -0.92]),
  [-1, 1].map((s) => at(box(0.13, 0.22, 0.05, 0.02, MAT.pad), [s * 0.12, 0.44, -0.5], [-0.6, 0, 0])),
  at(box(0.3, 0.07, 0.32, 0.035, MAT.pad), [0, 0.38, 0.35]),
  at(box(0.36, 0.05, 0.06, 0.02, MAT.grip), [0, 0.55, -0.7]),
  at(box(0.45, 0.06, 0.1, 0.03, MAT.frame), [0, 0.03, -0.95]),
  at(box(0.4, 0.06, 0.1, 0.03, MAT.frame), [0, 0.03, 1.0]),
  beam([0, 0.03, 1.0], [0, 0.2, 1.0], 0.07),
  beam([0, 0.03, -0.95], [0, 0.25, -0.95], 0.07),
  tube([[0, 0.6, -0.92], [0, 0.9, -0.85], [0, 1.0, -0.7]], 0.02, MAT.frame),
  at(box(0.22, 0.15, 0.03, 0.02, MAT.screen), [0, 1.03, -0.66], [-0.4, 0, 0]),
);

M.bike = () => grp(
  [-1, 1].map((s) => at(box(0.62, 0.06, 0.09, 0.03, MAT.frame), [0, 0.03, s * 0.55])),
  beam([0, 0.03, -0.55], [0, 0.03, 0.55], 0.08),
  tube([[0, 0.06, 0.45], [0, 0.5, 0.15], [0, 0.92, -0.12]], 0.05, MAT.frame),
  tube([[0, 0.06, -0.4], [0, 0.55, -0.15], [0, 1.0, 0.08]], 0.05, MAT.frame),
  at(rcyl(0.33, 0.07, 0.025, MAT.iron, 0, 'x'), [0, 0.4, -0.52]),
  at(rcyl(0.07, 0.09, 0.02, MAT.steel, 0, 'x'), [0, 0.4, -0.52]),
  at(rcyl(0.08, 0.16, 0.02, MAT.steel, 0, 'x'), [0, 0.42, 0.0]),
  [-1, 1].map((s) => grp(rod([s * 0.09, 0.42, 0], [s * 0.09, 0.42 - s * 0.12, s * 0.12], 0.018, MAT.steel), at(box(0.1, 0.03, 0.06, 0.012, MAT.grip), [s * 0.14, 0.42 - s * 0.12, s * 0.12]))),
  at(box(0.16, 0.06, 0.3, 0.03, MAT.pad), [0, 1.0, 0.1]),
  tube([[0, 0.98, -0.12], [0.18, 1.04, -0.24], [0.22, 1.12, -0.36]], 0.025, MAT.steel),
  tube([[0, 0.98, -0.12], [-0.18, 1.04, -0.24], [-0.22, 1.12, -0.36]], 0.025, MAT.steel),
  rod([-0.2, 1.02, -0.2], [0.2, 1.02, -0.2], 0.025, MAT.grip),
);

M.elliptical = () => grp(
  at(box(0.32, 0.08, 1.7, 0.03, MAT.frame), [0, 0.04, 0]),
  at(box(0.36, 0.5, 0.36, 0.08, MAT.iron), [0, 0.3, -0.72]),
  beam([0, 0.5, -0.72], [0, 1.25, -0.62], 0.08),
  at(box(0.3, 0.2, 0.06, 0.03, MAT.screen), [0, 1.3, -0.6], [-0.35, 0, 0]),
  [-1, 1].map((s) => grp(
    tube([[s * 0.12, 0.25, 0.55], [s * 0.14, 0.22, 0.1], [s * 0.18, 0.4, -0.5]], 0.025, MAT.steel),
    at(box(0.13, 0.04, 0.34, 0.02, MAT.pad), [s * 0.12, 0.28, 0.45]),
    tube([[s * 0.18, 0.45, -0.55], [s * 0.2, 0.95, -0.55], [s * 0.24, 1.45, -0.45], [s * 0.26, 1.62, -0.3]], 0.025, MAT.steel),
    at(rcyl(0.032, 0.18, 0.01, MAT.grip, 0, 'y'), [s * 0.26, 1.62, -0.28]),
  )),
);

M.stairs = () => grp(
  at(box(1.35, 0.06, 0.9, 0.03, MAT.frame), [0, 0.03, 0]),
  [-1, 1].map((s) => at(box(1.3, 0.1, 0.05, 0.02, MAT.frame), [-0.02, 0.62, s * 0.36], [0, 0, 0.78])),
  Array.from({ length: 5 }, (_, i) => at(box(0.22, 0.06, 0.62, 0.02, MAT.iron), [0.42 - i * 0.2, 0.17 + i * 0.2, 0])),
  [-1, 1].map((s) => tube([[0.45, 0.78, s * 0.42], [0.0, 1.25, s * 0.42], [-0.42, 1.42, s * 0.38]], 0.03, MAT.steel)),
  beam([-0.58, 0.06, 0], [-0.58, 1.42, 0], 0.1),
  at(box(0.07, 0.24, 0.42, 0.03, MAT.screen), [-0.52, 1.5, 0], [0, 0, 0.35]),
);

M.battlerope = () => {
  // uma corda só: sai de um pegador, ondula até a âncora, dá a volta e volta ondulando até o outro pegador
  const a = Array.from({ length: 9 }, (_, i) => [0.8 - i * 0.2, 0, -0.26 + 0.13 * Math.sin(i * 1.25)]);
  const b = Array.from({ length: 9 }, (_, i) => [-0.8 + i * 0.2, 0, 0.26 + 0.13 * Math.sin(i * 1.25 + 1.4)]);
  return grp(
    tube([...a, [-0.95, 0, -0.17], [-1.04, 0, 0], [-0.95, 0, 0.17], ...b], 0.07, MAT.strap, { seg: 260 }),
    at(mesh(new THREE.TorusGeometry(0.11, 0.028, 20, 48), MAT.steel), [-1.12, 0.02, 0], [0, Math.PI / 2, 0]),
    at(rcyl(0.078, 0.26, 0.025, MAT.grip), [0.95, 0, a[0][2]]),
    at(rcyl(0.078, 0.26, 0.025, MAT.grip), [0.95, 0, b[8][2]]),
  );
};

M.rings = () => grp(
  [-1, 1].map((s) => grp(
    at(mesh(new THREE.TorusGeometry(0.2, 0.034, 24, 72), MAT.wood), [s * 0.3, 0, s * 0.05]),
    beam([s * 0.3, 0.2, s * 0.05], [s * 0.3, 1.2, s * 0.05], 0.05, MAT.strap),
    at(box(0.09, 0.06, 0.03, 0.01, MAT.steel), [s * 0.3, 0.55, s * 0.05]),
  )),
);

M.jumprope = () => grp(
  tube([[-0.35, 0.12, 0], [-0.55, 0.5, 0.05], [-0.4, 0.95, 0.1], [0, 1.12, 0.12], [0.4, 0.95, 0.1], [0.55, 0.5, 0.05], [0.35, 0.12, 0]], 0.014, MAT.blue),
  [-1, 1].map((s) => grp(
    at(rcyl(0.045, 0.34, 0.02, MAT.grip, 0, 'y'), [s * 0.33, -0.08, 0], [0, 0, s * 0.35]),
    at(rcyl(0.05, 0.04, 0.01, MAT.steel, 0, 'y'), [s * 0.36, 0.1, 0], [0, 0, s * 0.35]),
  )),
);

M.medball = () => grp(
  mesh(new THREE.SphereGeometry(0.5, 96, 64), MAT.iron),
  at(mesh(new THREE.TorusGeometry(0.502, 0.012, 12, 128), MAT.steel), [], [0, 0, 0]),
  at(mesh(new THREE.TorusGeometry(0.502, 0.012, 12, 128), MAT.steel), [], [0, Math.PI / 2, 0]),
  at(mesh(new THREE.TorusGeometry(0.502, 0.012, 12, 128), MAT.steel), [], [Math.PI / 2, 0, 0]),
);

M.cardio = () => {
  const s = new THREE.Shape();
  s.moveTo(0, -0.52);
  s.bezierCurveTo(-0.16, -0.34, -0.64, -0.05, -0.64, 0.22);
  s.bezierCurveTo(-0.64, 0.5, -0.42, 0.64, -0.23, 0.64);
  s.bezierCurveTo(-0.09, 0.64, 0, 0.54, 0, 0.42);
  s.bezierCurveTo(0, 0.54, 0.09, 0.64, 0.23, 0.64);
  s.bezierCurveTo(0.42, 0.64, 0.64, 0.5, 0.64, 0.22);
  s.bezierCurveTo(0.64, -0.05, 0.16, -0.34, 0, -0.52);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.17, bevelSize: 0.13, bevelSegments: 12, curveSegments: 48 });
  g.center();
  const pulse = tube([[-0.5, 0.06, 0], [-0.22, 0.06, 0], [-0.13, 0.28, 0], [-0.03, -0.18, 0], [0.07, 0.2, 0], [0.15, 0.06, 0], [0.5, 0.06, 0]], 0.03, MAT.white, { tension: 0.0, seg: 200 });
  pulse.position.z = 0.25;
  return grp(mesh(g, MAT.red), pulse);
};

/** Como cada equipamento aparece (giro do objeto). */
const VIEW = {
  dumbbell: [0.35, -0.55, 0.6], barbell: [0.3, -0.42, 0.1], ezbar: [0.75, -0.25, 0.08], kettlebell: [0.12, 0.45, 0], plate: [0.3, 1.0, 0],
  machine: [0.25, -0.65, 0], cable: [0.12, -0.45, 0], band: [0.62, 0.35, 0.25], suspension: [0.1, -0.5, 0.04], landmine: [0.35, -0.6, 0],
  trapbar: [0.7, -0.3, 0], pullup: [0.2, -0.45, 0], rack: [0.22, -0.55, 0], smith: [0.22, -0.5, 0], bench: [0.4, -0.75, 0], adjbench: [0.35, -0.85, 0],
  dipbar: [0.35, -0.65, 0], legpress: [0.25, -0.95, 0], platemachine: [0.25, -0.7, 0], treadmill: [0.35, -0.8, 0], rower: [0.35, -0.9, 0],
  bike: [0.2, -1.1, 0], elliptical: [0.25, -0.95, 0], stairs: [0.22, -0.55, 0], battlerope: [0.95, -0.3, 0], rings: [0.1, -0.35, 0],
  jumprope: [0.15, -0.3, 0], medball: [0.35, -0.5, 0.2], cardio: [0.08, -0.38, -0.08],
};

// ---------- cena, enquadramento e saída ----------
function lights(scene) {
  scene.environment = ENV;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8b8f96, 0.75));
  const key = new THREE.DirectionalLight(0xffffff, 2.4); key.position.set(-2.5, 4, 3.5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.7); fill.position.set(3, 1, 2); scene.add(fill);
  const rim = new THREE.DirectionalLight(0xffffff, 1.1); rim.position.set(1, 3, -4); scene.add(rim);
}

function samplePoints(obj) {
  const pts = [];
  obj.updateMatrixWorld(true);
  obj.traverse((o) => {
    if (!o.isMesh) return;
    const p = o.geometry.attributes.position, step = Math.max(1, Math.floor(p.count / 1500));
    for (let i = 0; i < p.count; i += step) pts.push(V3(0, 0, 0).fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld));
  });
  return pts;
}

/** Renderiza o objeto girado, enquadrado em perspectiva suave; devolve o canvas WebGL. */
function renderObject(obj, [rx, ry, rz], fill = 0.9) {
  const scene = new THREE.Scene();
  lights(scene);
  // rola em Z, gira de lado (Y) e inclina para a câmera (X)
  obj.rotation.set(0, 0, rz);
  const holder = grp(obj);
  holder.rotation.y = ry;
  const turn = grp(holder);
  turn.rotation.x = rx;
  scene.add(turn);
  turn.updateMatrixWorld(true);
  const box3 = new THREE.Box3().setFromObject(turn);
  turn.position.sub(box3.getCenter(V3(0, 0, 0)));
  const pts = samplePoints(turn);
  const cam = new THREE.PerspectiveCamera(20, 1, 0.01, 100);
  const target = V3(0, 0, 0);
  let D = box3.getSize(V3(0, 0, 0)).length() * 3;
  for (let k = 0; k < 8; k++) {
    cam.position.set(target.x, target.y, target.z + D);
    cam.lookAt(target);
    cam.updateMatrixWorld(true);
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const v of pts) { const q = v.clone().project(cam); x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    const hh = D * Math.tan(THREE.MathUtils.degToRad(10));
    target.x += ((x0 + x1) / 2) * hh;
    target.y += ((y0 + y1) / 2) * hh;
    const half = Math.max(x1 - x0, y1 - y0) / 2;
    D *= half / fill;
  }
  renderer.render(scene, cam);
  return renderer.domElement;
}

// ---------- boneco ----------
let BODY = null;
const SKIN = new Set(['head', 'hair', 'hands', 'feet', 'neck', 'knees', 'ankles']);
/** Corpo em relevo: contorno (base) + cada músculo extrudado; `hit(slug, lado, i)` diz o que fica azul. */
function bodyModel(side, hit) {
  const off = side === 'back' ? -724 : 0;
  let svg = `<svg xmlns="http://www.w3.org/2000/svg"><g transform="matrix(1 0 0 -1 ${off} 1448)"><path id="outline" d="${BODY.outline[side]}"/>`;
  for (const part of BODY[side]) for (const [k, list] of Object.entries(part.path)) list.forEach((d, i) => { svg += `<path id="${part.slug}__${k}__${i}" d="${d}"/>`; });
  svg += '</g></svg>';
  const g = new THREE.Group();
  for (const p of new SVGLoader().parse(svg).paths) {
    const id = p.userData.node.id;
    const shapes = SVGLoader.createShapes(p);
    if (id === 'outline') {
      const geo = new THREE.ExtrudeGeometry(shapes, { depth: 1, bevelEnabled: false, curveSegments: 12 });
      g.add(mesh(geo, MAT.bodyBase));
      continue;
    }
    const [slug, k, i] = id.split('__');
    const geo = new THREE.ExtrudeGeometry(shapes, { depth: 2, bevelEnabled: true, bevelThickness: 14, bevelSize: 5, bevelOffset: -5, bevelSegments: 7, curveSegments: 12 });
    const m = mesh(geo, hit(slug, k, Number(i)) ? MAT.muscle : MAT.body);
    m.position.z = 3;
    g.add(m);
  }
  return g;
}

/** Recorte quadrado do boneco (coordenadas do SVG: x 0-724, y 0-1448 para baixo). */
function renderBody(side, hit, crop) {
  const scene = new THREE.Scene();
  scene.environment = ENV;
  scene.add(new THREE.HemisphereLight(0xffffff, 0x6f7680, 0.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.7); key.position.set(-1.7, 1.9, 1.5); scene.add(key);
  const fill = new THREE.DirectionalLight(0xffffff, 0.5); fill.position.set(1.6, -0.4, 1.3); scene.add(fill);
  scene.add(bodyModel(side, hit));
  const { cx, cy, s } = crop;
  const cam = new THREE.OrthographicCamera(-s / 2, s / 2, s / 2, -s / 2, -2000, 2000);
  cam.position.set(cx, 1448 - cy, 600);
  cam.lookAt(cx, 1448 - cy, 0);
  renderer.render(scene, cam);
  return renderer.domElement;
}

const UP = { cx: 362, cy: 440, s: 640 };
const HIPS = { cx: 362, cy: 770, s: 600 };
const LOW = { cx: 362, cy: 960, s: 740 };
const FULL = { cx: 362, cy: 739, s: 1380 };
const only = (...slugs) => (slug) => slugs.includes(slug);
const pieces = (slug0, test) => (slug, k, i) => slug === slug0 && test(i, k);

/** Grupos musculares: lado do boneco, o que acende e o recorte. */
const MUSCLES = {
  abs: ['front', only('abs'), UP],
  biceps: ['front', only('biceps'), UP],
  chest: ['front', only('chest'), UP],
  forearms: ['front', only('forearm'), UP],
  lats: ['back', (s, k, i) => s === 'upper-back' && LATS.has(k + i), UP],
  lowerback: ['back', only('lower-back'), UP],
  neck: ['front', only('neck'), UP],
  shoulders: ['front', only('deltoids'), UP],
  traps: ['back', only('trapezius'), UP],
  triceps: ['back', only('triceps'), UP],
  upperback: ['back', (s, k, i) => s === 'upper-back' && !LATS.has(k + i), UP],
  abductors: ['back', (s, k, i) => s === 'gluteal' && i === 0, HIPS],
  adductors: ['front', only('adductors'), LOW],
  calves: ['back', only('calves'), LOW],
  glutes: ['back', only('gluteal'), HIPS],
  hamstrings: ['back', only('hamstring'), LOW],
  quads: ['front', only('quadriceps'), LOW],
  fullbody: ['front', (s) => !SKIN.has(s), FULL],
};
// pedaços grandes de baixo do "upper-back" = dorsais; os de cima = costas altas. Glúteo pedaço 0 = médio (abdutores).
const LATS = new Set(['left1', 'right2']);

// ---------- composição no círculo branco ----------
function composite(src, inset) {
  const c = document.createElement('canvas');
  c.width = c.height = OUT;
  const x = c.getContext('2d');
  const r = OUT / 2;
  x.beginPath(); x.arc(r, r, r - 1, 0, Math.PI * 2); x.fillStyle = '#fff'; x.fill();
  x.save(); x.beginPath(); x.arc(r, r, r - 1.5, 0, Math.PI * 2); x.clip();
  const m = OUT * inset;
  x.imageSmoothingEnabled = true; x.imageSmoothingQuality = 'high';
  x.drawImage(src, m, m, OUT - 2 * m, OUT - 2 * m);
  x.restore();
  x.beginPath(); x.arc(r, r, r - 1, 0, Math.PI * 2); x.strokeStyle = 'rgba(16,24,40,0.10)'; x.lineWidth = 2; x.stroke();
  return c;
}

const ICONS = []; // { dir, name, canvas }
function add(dir, name, canvas) {
  ICONS.push({ dir, name, png: canvas.toDataURL('image/png') });
  const grid = document.getElementById('grid');
  for (const theme of ['light', 'dark']) {
    const cell = document.createElement('div');
    cell.className = `cell ${theme}`;
    cell.innerHTML = `<img src="${ICONS.at(-1).png}"><span>${dir === 'muscles' ? 'm/' : ''}${name}</span>`;
    grid.appendChild(cell);
  }
}

const EQUIP_NAMES = Object.keys(M).filter((n) => n !== 'cardio');
export function buildEquipment(names = EQUIP_NAMES) {
  for (const n of names) add('equipment', n, composite(renderObject(M[n](), VIEW[n]), 0.1));
}
export function buildMuscle(n) {
  const [side, hit, crop] = MUSCLES[n];
  add('muscles', n, composite(renderBody(side, hit, crop), 0));
}
export function buildCardio() { add('muscles', 'cardio', composite(renderObject(M.cardio(), VIEW.cardio, 0.86), 0.12)); }
export function buildBodyweight() { add('equipment', 'bodyweight', composite(renderBody('front', () => false, FULL), 0)); }

// Fila: um ícone por tarefa (MessageChannel não sofre o atraso de timers de página em segundo plano).
const queue = [];
export const state = { done: 0, total: 0, errors: [] };
const chan = new MessageChannel();
chan.port1.onmessage = () => {
  const job = queue.shift();
  if (!job) return;
  try { job(); } catch (e) { state.errors.push(String(e.stack || e).slice(0, 300)); }
  state.done++;
  if (queue.length) chan.port2.postMessage(0);
};
export function run(jobs) {
  queue.push(...jobs);
  state.total += jobs.length;
  chan.port2.postMessage(0);
}
export function runAll() {
  run([
    ...EQUIP_NAMES.map((n) => () => buildEquipment([n])),
    buildBodyweight,
    ...Object.keys(MUSCLES).map((n) => () => buildMuscle(n)),
    buildCardio,
  ]);
}

/** Caixas (no SVG) de cada pedaço de um músculo, para decidir recortes e divisões. */
export function pieceBoxes(side, slug) {
  const part = BODY[side].find((p) => p.slug === slug);
  const out = [];
  for (const [k, list] of Object.entries(part.path)) list.forEach((d, i) => {
    const nums = d.match(/-?\d*\.?\d+(e-?\d+)?/g).map(Number);
    out.push({ k, i, start: [nums[0], nums[1]] });
  });
  return out;
}

export async function saveAll() {
  const res = [];
  for (const it of ICONS) {
    const r = await fetch('/save', { method: 'POST', body: JSON.stringify({ dir: it.dir, name: it.name, png: it.png }) });
    res.push(`${it.dir}/${it.name}:${r.status}`);
  }
  return res;
}

window.icons = { buildEquipment, buildMuscle, buildCardio, buildBodyweight, run, runAll, state, saveAll, pieceBoxes, renderObject, renderBody, composite, M, VIEW, MUSCLES, ICONS, get BODY() { return BODY; } };

BODY = await (await fetch('/body.json')).json();
document.getElementById('status').textContent = 'ready';
