import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BELOTE_TABLES, CAFE, SEAT_SIDES, TERRACE_TABLE, VIEWPOINTS, seatOffset } from './cafeLayout.ts';
import type { SeatSide, TableSpot, Viewpoint } from './cafeLayout.ts';

/** État d'une table de belote tel que l'affiche la maquette (informations publiques). */
export interface SceneTable {
  readonly number: number;
  readonly status: 'free' | 'lobby' | 'playing' | 'finished';
  readonly players: readonly { readonly seat: number; readonly nickname: string }[];
  readonly scores: readonly [number, number] | null;
}

export type CafeTarget = { readonly kind: 'table'; readonly number: number } | { readonly kind: 'terrace' };

export interface CafeSceneHandle {
  update(tables: readonly SceneTable[], selected: CafeTarget | null): void;
  goTo(view: Viewpoint): void;
  /** Rapproche la caméra d'une table de belote (quand elle est sélectionnée). */
  focusTable(number: number): void;
  dispose(): void;
}

interface Callbacks {
  readonly onSelect: (target: CafeTarget) => void;
  /** Appelé quand la caméra change de point de vue (étiquette « salle de belote » touchée). */
  readonly onView: (view: Viewpoint) => void;
}

const TEAM_COLORS = [0x5aa9e6, 0xf08a68];
const SKIN = 0xd9a77c;

/* ----------------------------------------------------------------------------
 * Textures dessinées (aucun fichier à télécharger)
 * -------------------------------------------------------------------------- */

function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d')!);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  if (repeat) {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
  }
  return texture;
}

/** Sol en granito beige, comme sur la maquette. */
const terrazzo = (base: string, repeat: [number, number]) =>
  canvasTexture(
    256,
    256,
    (ctx) => {
      ctx.fillStyle = base;
      ctx.fillRect(0, 0, 256, 256);
      const rand = seeded(7);
      const colors = ['#7a5a3a', '#f3e6d0', '#a07850', '#5c4128', '#e8d2b0'];
      for (let i = 0; i < 900; i++) {
        ctx.fillStyle = colors[i % colors.length]!;
        const r = 0.6 + rand() * 2.2;
        ctx.beginPath();
        ctx.ellipse(rand() * 256, rand() * 256, r, r * (0.5 + rand()), rand() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
    },
    repeat,
  );

const woodPanels = (repeat: [number, number]) =>
  canvasTexture(
    256,
    128,
    (ctx) => {
      const grad = ctx.createLinearGradient(0, 0, 0, 128);
      grad.addColorStop(0, '#8a5a32');
      grad.addColorStop(1, '#6a4224');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 256, 128);
      ctx.strokeStyle = 'rgba(40, 22, 10, 0.55)';
      ctx.lineWidth = 3;
      for (let x = 0; x <= 256; x += 64) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, 128);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255, 210, 150, 0.08)';
      for (let x = 8; x < 256; x += 64) ctx.fillRect(x, 0, 6, 128);
    },
    repeat,
  );

const garageDoor = () =>
  canvasTexture(256, 256, (ctx) => {
    ctx.fillStyle = '#5c1520';
    ctx.fillRect(0, 0, 256, 256);
    for (let y = 0; y < 256; y += 12) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(0, y, 256, 2);
      ctx.fillStyle = 'rgba(255,255,255,0.06)';
      ctx.fillRect(0, y + 2, 256, 2);
    }
  });

const tvScreen = () =>
  canvasTexture(256, 144, (ctx) => {
    ctx.fillStyle = '#2f8f3a';
    ctx.fillRect(0, 0, 256, 144);
    for (let x = 0; x < 256; x += 32) {
      ctx.fillStyle = x % 64 === 0 ? '#34983f' : '#2b8636';
      ctx.fillRect(x, 0, 32, 144);
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.strokeRect(10, 10, 236, 124);
    ctx.beginPath();
    ctx.moveTo(128, 10);
    ctx.lineTo(128, 134);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 72, 18, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(150, 60, 4, 4);
  });

const signboard = () =>
  canvasTexture(512, 128, (ctx) => {
    ctx.fillStyle = '#123d2a';
    ctx.fillRect(0, 0, 512, 128);
    ctx.strokeStyle = '#f0c35a';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 500, 116);
    ctx.fillStyle = '#f0c35a';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 54px "Noto Naskh Arabic", "Geeza Pro", "Segoe UI", sans-serif';
    ctx.direction = 'rtl';
    ctx.fillText('قهوة طارق', 256, 52);
    ctx.direction = 'ltr';
    ctx.font = 'italic 600 26px Georgia, serif';
    ctx.fillText('Café Tarek', 256, 102);
  });

const paving = (repeat: [number, number]) =>
  canvasTexture(
    128,
    128,
    (ctx) => {
      ctx.fillStyle = '#8d8a84';
      ctx.fillRect(0, 0, 128, 128);
      ctx.strokeStyle = '#6f6c66';
      ctx.lineWidth = 3;
      ctx.strokeRect(0, 0, 64, 64);
      ctx.strokeRect(64, 0, 64, 64);
      ctx.strokeRect(0, 64, 64, 64);
      ctx.strokeRect(64, 64, 64, 64);
    },
    repeat,
  );

const feltTexture = () =>
  canvasTexture(128, 128, (ctx) => {
    ctx.fillStyle = '#1d7a4c';
    ctx.fillRect(0, 0, 128, 128);
    ctx.strokeStyle = 'rgba(240,195,90,0.7)';
    ctx.lineWidth = 4;
    ctx.strokeRect(10, 10, 108, 108);
  });

/* ----------------------------------------------------------------------------
 * Mobilier
 * -------------------------------------------------------------------------- */

const mat = (color: number, options: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...options });

const MATERIALS = {
  wood: mat(0x6b4226),
  darkWood: mat(0x3e2614),
  chair: mat(0x4a2c17),
  metal: mat(0x9aa1a6, { metalness: 0.7, roughness: 0.35 }),
  black: mat(0x1d1f22, { roughness: 0.5 }),
  white: mat(0xf2efe8, { roughness: 0.4 }),
  wallOuter: mat(0x24272b),
  glass: new THREE.MeshStandardMaterial({ color: 0xbfe3ff, transparent: true, opacity: 0.22, roughness: 0.1, metalness: 0.1 }),
  marble: mat(0xe9dfcd, { roughness: 0.3 }),
  plant: mat(0x2f7a3a),
  pot: mat(0x8a5a3c),
  skin: mat(SKIN),
  hit: new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
};

function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function cylinder(rTop: number, rBottom: number, h: number, material: THREE.Material, x: number, y: number, z: number, segments = 16) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  mesh.position.set(x, y, z);
  return mesh;
}

/** Chaise tournée vers -z (dossier côté +z) ; la rotation l'oriente vers sa table. */
function chair(x: number, y: number, z: number, rotation: number) {
  const group = new THREE.Group();
  group.add(box(0.42, 0.05, 0.42, MATERIALS.chair, 0, 0.46, 0));
  group.add(box(0.42, 0.5, 0.05, MATERIALS.chair, 0, 0.72, 0.19));
  for (const [dx, dz] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ] as const) {
    group.add(box(0.04, 0.46, 0.04, MATERIALS.darkWood, dx, 0.23, dz));
  }
  group.position.set(x, y, z);
  group.rotation.y = rotation;
  return group;
}

function squareTable(size: number, x: number, y: number, z: number, top: THREE.Material = MATERIALS.wood) {
  const group = new THREE.Group();
  group.add(box(size, 0.05, size, top, 0, 0.75, 0));
  group.add(cylinder(0.05, 0.05, 0.72, MATERIALS.darkWood, 0, 0.37, 0, 8));
  group.add(box(size * 0.6, 0.03, size * 0.6, MATERIALS.darkWood, 0, 0.02, 0));
  group.position.set(x, y, z);
  return group;
}

function plant(x: number, y: number, z: number, scale = 1) {
  const group = new THREE.Group();
  group.add(cylinder(0.16, 0.12, 0.32, MATERIALS.pot, 0, 0.16, 0, 10));
  const leaves = new THREE.Mesh(new THREE.IcosahedronGeometry(0.34, 0), MATERIALS.plant);
  leaves.position.set(0, 0.62, 0);
  leaves.scale.set(1, 1.35, 1);
  group.add(leaves);
  group.position.set(x, y, z);
  group.scale.setScalar(scale);
  return group;
}

/** Petit personnage assis, aux couleurs de son équipe. */
function avatar(color: number) {
  const group = new THREE.Group();
  const body = cylinder(0.15, 0.19, 0.5, mat(color, { roughness: 0.6 }), 0, 0.78, 0.04, 12);
  group.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), MATERIALS.skin);
  head.position.set(0, 1.16, 0.02);
  group.add(head);
  return group;
}

/* ----------------------------------------------------------------------------
 * Construction de la salle
 * -------------------------------------------------------------------------- */

function buildRoom(scene: THREE.Scene) {
  const { width, length, wallHeight, stepZ, stepHeight, terraceDepth } = CAFE;
  const half = width / 2;
  const frontLength = -stepZ;
  const backLength = length + stepZ;

  // Sols : granito devant, salle du fond surélevée de 20 cm.
  const front = new THREE.Mesh(
    new THREE.PlaneGeometry(width, frontLength),
    new THREE.MeshStandardMaterial({ map: terrazzo('#c79b6c', [2.5, 6]), roughness: 0.55 }),
  );
  front.rotation.x = -Math.PI / 2;
  front.position.set(0, 0, stepZ / 2);
  scene.add(front);
  const back = box(
    width,
    stepHeight,
    backLength,
    new THREE.MeshStandardMaterial({ map: terrazzo('#bf8f5f', [2.5, 4]), roughness: 0.55 }),
    0,
    stepHeight / 2,
    stepZ - backLength / 2,
  );
  scene.add(back);
  scene.add(box(width, 0.06, 0.12, MATERIALS.darkWood, 0, stepHeight + 0.01, stepZ - 0.04));

  // Terrasse et trottoir.
  const terrace = new THREE.Mesh(
    new THREE.PlaneGeometry(width + 3, terraceDepth),
    new THREE.MeshStandardMaterial({ map: paving([4, 2.5]), roughness: 0.9 }),
  );
  terrace.rotation.x = -Math.PI / 2;
  terrace.position.set(0, -0.01, terraceDepth / 2);
  scene.add(terrace);
  const street = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), mat(0x3a3d40, { roughness: 1 }));
  street.rotation.x = -Math.PI / 2;
  street.position.set(0, -0.03, 0);
  scene.add(street);

  // Murs : extérieur sombre, lambris de bois à l'intérieur.
  const panelMaterial = (len: number) => new THREE.MeshStandardMaterial({ map: woodPanels([len / 2, 1]), roughness: 0.7 });
  const leftWall = new THREE.Group();
  leftWall.add(box(0.2, wallHeight, length, MATERIALS.wallOuter, -half - 0.1, wallHeight / 2, -length / 2));
  const leftPanel = new THREE.Mesh(new THREE.PlaneGeometry(length, wallHeight - 0.4), panelMaterial(length));
  leftPanel.rotation.y = Math.PI / 2;
  leftPanel.position.set(-half + 0.005, wallHeight / 2, -length / 2);
  leftWall.add(leftPanel);
  scene.add(leftWall);

  // Mur de droite, ouvert pour la 2e entrée (au milieu, au niveau de la marche).
  const doorFrom = stepZ + 1.2;
  const doorTo = stepZ + 0.2;
  for (const [from, to] of [
    [0, doorFrom],
    [doorTo, -length],
  ] as const) {
    const len = from - to;
    scene.add(box(0.2, wallHeight, len, MATERIALS.wallOuter, half + 0.1, wallHeight / 2, (from + to) / 2));
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, wallHeight - 0.4), panelMaterial(len));
    panel.rotation.y = -Math.PI / 2;
    panel.position.set(half - 0.005, wallHeight / 2, (from + to) / 2);
    scene.add(panel);
  }
  scene.add(box(0.22, 0.3, doorFrom - doorTo, MATERIALS.wallOuter, half + 0.1, wallHeight - 0.15, (doorFrom + doorTo) / 2));

  // Fond : porte de garage bordeaux.
  scene.add(box(width + 0.4, wallHeight, 0.2, MATERIALS.wallOuter, 0, wallHeight / 2, -length - 0.1));
  const garage = new THREE.Mesh(
    new THREE.PlaneGeometry(width - 0.5, wallHeight - 0.3),
    new THREE.MeshStandardMaterial({ map: garageDoor(), roughness: 0.6 }),
  );
  garage.position.set(0.15, (wallHeight - 0.3) / 2 + stepHeight, -length + 0.01);
  scene.add(garage);

  // Télé 40" excentrée à gauche.
  const tv = new THREE.Group();
  tv.add(box(1.0, 0.6, 0.06, MATERIALS.black, 0, 0, 0));
  const tvTexture = tvScreen();
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(0.92, 0.52),
    new THREE.MeshStandardMaterial({ map: tvTexture, emissive: 0xffffff, emissiveMap: tvTexture, emissiveIntensity: 0.6 }),
  );
  screen.position.z = 0.035;
  tv.add(screen);
  tv.position.set(-1.45, 1.95, -length + 0.12);
  scene.add(tv);

  // Façade vitrée : deux vitrines et la double porte.
  const facadeTop = box(width + 0.4, 0.4, 0.2, MATERIALS.wallOuter, 0, wallHeight - 0.2, 0.1);
  scene.add(facadeTop);
  for (const x of [-half + 0.05, -0.9, 0.9, half - 0.05]) scene.add(box(0.1, wallHeight - 0.4, 0.12, MATERIALS.black, x, (wallHeight - 0.4) / 2, 0.1));
  for (const [x, w] of [
    [-1.7, 1.5],
    [1.7, 1.5],
  ] as const) {
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(w, wallHeight - 0.5), MATERIALS.glass);
    pane.position.set(x, (wallHeight - 0.4) / 2, 0.1);
    scene.add(pane);
  }
  // Portes ouvertes vers l'intérieur.
  for (const side of [-1, 1]) {
    const door = new THREE.Group();
    const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.85, wallHeight - 0.5), MATERIALS.glass);
    pane.position.x = side * 0.42;
    door.add(pane);
    door.add(box(0.85, 0.05, 0.04, MATERIALS.black, side * 0.42, wallHeight - 0.75, 0));
    door.position.set(side * 0.88, (wallHeight - 0.4) / 2, 0.08);
    door.rotation.y = side * -0.9;
    scene.add(door);
  }
  const signTexture = signboard();
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(2.6, 0.65),
    new THREE.MeshStandardMaterial({ map: signTexture, emissive: 0xffffff, emissiveMap: signTexture, emissiveIntensity: 0.35 }),
  );
  sign.position.set(0, wallHeight + 0.35, 0.22);
  scene.add(sign);
  scene.add(box(2.7, 0.75, 0.08, MATERIALS.black, 0, wallHeight + 0.35, 0.17));
}

/** Comptoir à droite en entrant : machine à café, tasses, vitrine à pâtisseries. */
function buildCounter(scene: THREE.Scene) {
  const x = 1.75;
  const from = -1.3;
  const to = -11.3;
  const len = from - to;
  scene.add(box(0.75, 1.0, len, MATERIALS.wood, x - 0.05, 0.5, (from + to) / 2));
  scene.add(box(0.85, 0.06, len + 0.05, MATERIALS.marble, x - 0.05, 1.03, (from + to) / 2));
  // Machine à café.
  scene.add(box(0.55, 0.45, 0.8, MATERIALS.metal, x, 1.28, -10.2));
  scene.add(box(0.5, 0.12, 0.7, MATERIALS.black, x, 1.56, -10.2));
  for (const dz of [-0.2, 0.2]) scene.add(cylinder(0.05, 0.05, 0.12, MATERIALS.black, x - 0.3, 1.18, -10.2 + dz, 8));
  // Moulins.
  for (const dz of [-9.2, -8.7]) {
    scene.add(cylinder(0.09, 0.07, 0.3, MATERIALS.black, x + 0.1, 1.21, dz, 10));
    scene.add(cylinder(0.11, 0.06, 0.2, mat(0x2a1a10), x + 0.1, 1.46, dz, 10));
  }
  // Tasses.
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) scene.add(cylinder(0.045, 0.038, 0.07, MATERIALS.white, x + 0.18 - j * 0.12, 1.1, -7.6 + i * 0.13, 10));
  }
  // Vitrine à pâtisseries.
  const showcase = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 1.4), MATERIALS.glass);
  showcase.position.set(x, 1.29, -4.4);
  scene.add(showcase);
  const pastry = mat(0xe08a2e, { roughness: 0.6 });
  for (let i = 0; i < 6; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), pastry);
    p.scale.y = 0.6;
    p.position.set(x - 0.12 + (i % 2) * 0.24, 1.12, -4.9 + Math.floor(i / 2) * 0.45);
    scene.add(p);
  }
  // Caisse et réfrigérateur près de l'entrée.
  scene.add(box(0.3, 0.2, 0.35, MATERIALS.black, x, 1.16, -2.6));
  scene.add(box(0.65, 1.7, 0.8, MATERIALS.metal, 2.1, 0.85, -0.7));
}

/** WC au fond à droite, après la marche (porte côté salle). */
function buildToilets(scene: THREE.Scene) {
  const y = CAFE.stepHeight;
  const x0 = 1.3;
  const x1 = CAFE.width / 2;
  const z0 = -12.7;
  const z1 = -14.4;
  const wall = mat(0xd9d4ca);
  scene.add(box(x1 - x0, 2.3, 0.08, wall, (x0 + x1) / 2, y + 1.15, z0));
  scene.add(box(x1 - x0, 2.3, 0.08, wall, (x0 + x1) / 2, y + 1.15, z1));
  scene.add(box(0.08, 2.3, 0.6, wall, x0, y + 1.15, z1 + 0.3));
  // Porte entrouverte.
  const door = box(0.06, 2.0, 0.85, mat(0x7a4a2a), x0 - 0.25, y + 1.0, z0 - 0.75);
  door.rotation.y = 0.6;
  scene.add(door);
  scene.add(cylinder(0.17, 0.15, 0.4, MATERIALS.white, 2.15, y + 0.2, -13.9, 12));
  scene.add(box(0.35, 0.12, 0.28, MATERIALS.white, 1.7, y + 0.85, z0 - 0.2));
}

/** Petites tables à gauche en entrant (2 chaises chacune) et plantes. */
function buildFrontSeating(scene: THREE.Scene) {
  for (const z of [-3, -6.5, -10]) {
    scene.add(squareTable(0.7, -1.75, 0, z));
    scene.add(chair(-1.75, 0, z + 0.55, 0));
    scene.add(chair(-1.75, 0, z - 0.55, Math.PI));
  }
  for (const z of [-1, -4.8, -8.3, -11.8]) scene.add(plant(-2.15, 0, z, 0.9));
}

/* ----------------------------------------------------------------------------
 * Scène complète
 * -------------------------------------------------------------------------- */

interface TableObjects {
  readonly spot: TableSpot;
  readonly avatars: THREE.Group;
  readonly highlight: THREE.Mesh;
  readonly label: HTMLButtonElement;
  readonly names: HTMLSpanElement[];
}

export function createCafeScene(container: HTMLElement, labelLayer: HTMLElement, callbacks: Callbacks): CafeSceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0d2219);
  container.appendChild(renderer.domElement);
  renderer.domElement.className = 'cafe__canvas';

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d2219, 22, 40);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  const start = VIEWPOINTS.entrance;
  camera.position.set(...start.camera);

  scene.add(new THREE.HemisphereLight(0xfff1dc, 0x3a2a1c, 1.1));
  const sun = new THREE.DirectionalLight(0xffe2b8, 1.2);
  sun.position.set(4, 10, 6);
  scene.add(sun);
  // Lumières chaudes : comptoir et salle du fond.
  for (const [x, z, intensity] of [
    [0.8, -6, 6],
    [0, -15.5, 7],
    [0, -18.5, 7],
  ] as const) {
    const light = new THREE.PointLight(0xffc98a, intensity, 7, 1.6);
    light.position.set(x, 2.4, z);
    scene.add(light);
  }

  buildRoom(scene);
  buildCounter(scene);
  buildToilets(scene);
  buildFrontSeating(scene);
  for (const [x, z] of [
    [-2.1, -13.0],
    [2.1, -19.5],
    [-2.15, -19.5],
  ] as const) {
    scene.add(plant(x, CAFE.stepHeight, z));
  }

  const pickables: THREE.Object3D[] = [];
  const felt = new THREE.MeshStandardMaterial({ map: feltTexture(), roughness: 0.9 });
  const highlightMaterial = new THREE.MeshBasicMaterial({ color: 0xf0c35a, transparent: true, opacity: 0.85 });

  const makeLabel = (className: string, onClick: () => void) => {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = className;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      onClick();
    });
    labelLayer.appendChild(el);
    return el;
  };

  // Les 6 tables de belote.
  const tables: TableObjects[] = BELOTE_TABLES.map((spot) => {
    const y = CAFE.stepHeight;
    const group = squareTable(0.95, spot.x, y, spot.z, felt);
    scene.add(group);
    for (const side of SEAT_SIDES) {
      const { dx, dz, rotation } = seatOffset(side, 0.68);
      scene.add(chair(spot.x + dx, y, spot.z + dz, rotation));
    }
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.3, 1.9), MATERIALS.hit);
    hit.position.set(spot.x, y + 0.65, spot.z);
    hit.userData = { kind: 'table', number: spot.number };
    scene.add(hit);
    pickables.push(hit);
    const highlight = new THREE.Mesh(new THREE.RingGeometry(0.95, 1.08, 40), highlightMaterial);
    highlight.rotation.x = -Math.PI / 2;
    highlight.position.set(spot.x, y + 0.015, spot.z);
    highlight.visible = false;
    scene.add(highlight);
    const avatars = new THREE.Group();
    scene.add(avatars);
    const label = makeLabel('cafe-label', () => callbacks.onSelect({ kind: 'table', number: spot.number }));
    const names = SEAT_SIDES.map(() => {
      const name = document.createElement('span');
      name.className = 'cafe-name';
      labelLayer.appendChild(name);
      return name;
    });
    return { spot, avatars, highlight, label, names };
  });

  // Terrasse : table ronde et parasol, contre les bots.
  {
    const { x, z } = TERRACE_TABLE;
    const group = new THREE.Group();
    group.add(cylinder(0.5, 0.5, 0.05, MATERIALS.white, 0, 0.75, 0, 24));
    group.add(cylinder(0.04, 0.04, 0.72, MATERIALS.metal, 0, 0.37, 0, 8));
    group.add(cylinder(0.03, 0.03, 2.1, MATERIALS.metal, 0, 1.05, 0, 8));
    const parasol = new THREE.Mesh(
      new THREE.ConeGeometry(0.95, 0.35, 8, 1, true),
      mat(0xb3262e, { side: THREE.DoubleSide, transparent: true, opacity: 0.8 }),
    );
    parasol.position.y = 2.2;
    group.add(parasol);
    group.position.set(x, 0, z);
    scene.add(group);
    const bots = [0x5aa9e6, 0xf08a68, 0x5aa9e6, 0xf08a68];
    SEAT_SIDES.forEach((side, i) => {
      const { dx, dz, rotation } = seatOffset(side, 0.72);
      scene.add(chair(x + dx, 0, z + dz, rotation));
      if (i > 0) {
        const bot = avatar(bots[i]!);
        bot.position.set(x + dx, 0, z + dz);
        bot.rotation.y = rotation;
        scene.add(bot);
      }
    });
    scene.add(plant(1.9, 0, 1.0), plant(-2.4, 0, 0.9), plant(2.2, 0, 3.8, 0.8));
    const hit = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.6, 2.2), MATERIALS.hit);
    hit.position.set(x, 1.3, z);
    hit.userData = { kind: 'terrace' };
    scene.add(hit);
    pickables.push(hit);
  }
  const terraceLabel = makeLabel('cafe-label cafe-label--terrace', () => callbacks.onSelect({ kind: 'terrace' }));
  terraceLabel.innerHTML = '<span class="cafe-label__title">Terrasse</span><span class="cafe-label__status">Contre les bots</span>';
  const terraceAnchor = new THREE.Vector3(TERRACE_TABLE.x, 0.85, TERRACE_TABLE.z);

  // Vue de l'entrée : une seule étiquette pour toute la salle de belote (les 6 tables seraient illisibles).
  const roomLabel = makeLabel('cafe-label cafe-label--room', () => {
    goTo('back');
    callbacks.onView('back');
  });
  const roomAnchor = new THREE.Vector3(0, 2.6, -16.8);

  /* ---------------------------- Caméra et gestes ---------------------------- */

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...start.target);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 5;
  controls.maxDistance = 17;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.12;
  controls.minAzimuthAngle = -0.85;
  controls.maxAzimuthAngle = 0.85;
  controls.rotateSpeed = 0.7;
  controls.update();

  let tween: { from: THREE.Vector3[]; to: THREE.Vector3[]; start: number; duration: number } | null = null;
  let needsRender = true;
  const requestRender = () => {
    needsRender = true;
  };
  controls.addEventListener('change', requestRender);

  const flyTo = (cameraPosition: THREE.Vector3, target: THREE.Vector3) => {
    tween = {
      from: [camera.position.clone(), controls.target.clone()],
      to: [cameraPosition, target],
      start: performance.now(),
      duration: 1000,
    };
    requestRender();
  };
  const goTo = (view: Viewpoint) => {
    const target = VIEWPOINTS[view];
    flyTo(new THREE.Vector3(...target.camera), new THREE.Vector3(...target.target));
  };
  const focusTable = (number: number) => {
    const spot = BELOTE_TABLES.find((t) => t.number === number);
    if (!spot) return;
    const target = new THREE.Vector3(spot.x * 0.6, CAFE.stepHeight + 0.4, spot.z);
    flyTo(new THREE.Vector3(spot.x * 0.4, 5.6, spot.z + 3.4), target);
  };

  // Un appui court (sans glisser) sélectionne une table.
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downAt: { x: number; y: number } | null = null;
  const onDown = (e: PointerEvent) => {
    downAt = { x: e.clientX, y: e.clientY };
  };
  const onUp = (e: PointerEvent) => {
    if (!downAt || Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) > 8) return;
    downAt = null;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickables, false)[0];
    if (hit) callbacks.onSelect(hit.object.userData as CafeTarget);
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  /* -------------------------- Taille et rendu -------------------------- */

  let width = 1;
  let height = 1;
  const resize = () => {
    width = container.clientWidth || 1;
    height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Écran en portrait : on recule un peu pour voir toute la largeur du café.
    camera.fov = width < height ? 56 : 46;
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const projected = new THREE.Vector3();
  const place = (el: HTMLElement, point: THREE.Vector3, hide = false) => {
    projected.copy(point).project(camera);
    const visible = !hide && projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < 1.15;
    el.style.display = visible ? '' : 'none';
    if (!visible) return;
    const x = ((projected.x + 1) / 2) * width;
    const y = ((1 - projected.y) / 2) * height;
    el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
  };

  const anchor = new THREE.Vector3();
  const placeLabels = () => {
    // De loin (vue de l'entrée), on regroupe les 6 tables sous une seule étiquette.
    const far = camera.position.distanceTo(roomAnchor) > 12.5;
    place(roomLabel, roomAnchor, !far);
    for (const t of tables) {
      // L'étiquette est posée sur la table elle-même : pas de doute sur la table choisie.
      anchor.set(t.spot.x, CAFE.stepHeight + 0.8, t.spot.z - 0.12);
      place(t.label, anchor, far);
      // Les pseudos ne s'affichent que pour la table touchée, sinon ils se chevauchent.
      const near = t.highlight.visible && camera.position.distanceTo(anchor) < 8;
      SEAT_SIDES.forEach((side: SeatSide, i) => {
        const { dx, dz } = seatOffset(side, side === 'south' ? 1.05 : 0.85);
        anchor.set(t.spot.x + dx, CAFE.stepHeight + (side === 'south' ? 1.05 : 1.4), t.spot.z + dz);
        place(t.names[i]!, anchor, !near || !t.names[i]!.textContent);
      });
    }
    place(terraceLabel, terraceAnchor);
  };

  let frame = 0;
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (tween) {
      const p = Math.min(1, (now - tween.start) / tween.duration);
      const ease = p < 0.5 ? 4 * p * p * p : 1 - (-2 * p + 2) ** 3 / 2;
      camera.position.lerpVectors(tween.from[0]!, tween.to[0]!, ease);
      controls.target.lerpVectors(tween.from[1]!, tween.to[1]!, ease);
      if (p >= 1) tween = null;
      needsRender = true;
    }
    if (controls.update()) needsRender = true;
    if (!needsRender) return;
    needsRender = false;
    renderer.render(scene, camera);
    placeLabels();
  };
  frame = requestAnimationFrame(loop);

  /* ------------------------- Mise à jour des tables ------------------------- */

  const update = (states: readonly SceneTable[], selected: CafeTarget | null) => {
    for (const t of tables) {
      const state = states.find((s) => s.number === t.spot.number);
      const status = state?.status ?? 'free';
      t.highlight.visible = selected?.kind === 'table' && selected.number === t.spot.number;
      t.avatars.clear();
      const players = state?.players ?? [];
      SEAT_SIDES.forEach((side, seat) => {
        const player = players.find((p) => p.seat === seat);
        t.names[seat]!.textContent = player?.nickname ?? '';
        t.names[seat]!.className = `cafe-name cafe-name--team${seat % 2}`;
        if (!player) return;
        const { dx, dz, rotation } = seatOffset(side, 0.68);
        const figure = avatar(TEAM_COLORS[seat % 2]!);
        figure.position.set(t.spot.x + dx, CAFE.stepHeight, t.spot.z + dz);
        figure.rotation.y = rotation;
        t.avatars.add(figure);
      });
      const statusText =
        status === 'free'
          ? 'Libre'
          : status === 'lobby'
            ? `En attente · ${players.length}/4`
            : status === 'playing'
              ? state?.scores
                ? `En jeu · ${state.scores[0]} – ${state.scores[1]}`
                : 'En jeu'
              : 'Partie terminée';
      t.label.className = `cafe-label cafe-label--${status}${t.highlight.visible ? ' cafe-label--selected' : ''}`;
      t.label.innerHTML = '';
      const title = document.createElement('span');
      title.className = 'cafe-label__title';
      title.textContent = `Table ${t.spot.number}`;
      const sub = document.createElement('span');
      sub.className = 'cafe-label__status';
      sub.textContent = statusText;
      t.label.append(title, sub);
      t.label.setAttribute('aria-label', `Table ${t.spot.number} : ${statusText}`);
    }
    terraceLabel.className = `cafe-label cafe-label--terrace${selected?.kind === 'terrace' ? ' cafe-label--selected' : ''}`;
    const free = tables.filter((t) => !states.some((s) => s.number === t.spot.number && s.status !== 'free')).length;
    roomLabel.innerHTML = '';
    const roomTitle = document.createElement('span');
    roomTitle.className = 'cafe-label__title';
    roomTitle.textContent = 'Salle de belote ↑';
    const roomStatus = document.createElement('span');
    roomStatus.className = 'cafe-label__status';
    roomStatus.textContent = free === 0 ? 'Café complet' : `${free} table${free > 1 ? 's' : ''} libre${free > 1 ? 's' : ''} sur 6`;
    roomLabel.append(roomTitle, roomStatus);
    requestRender();
  };

  return {
    update,
    goTo,
    focusTable,
    dispose() {
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          for (const m of materials) {
            (m as THREE.MeshStandardMaterial).map?.dispose();
            m.dispose();
          }
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
      labelLayer.replaceChildren();
    },
  };
}
