import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BELOTE_TABLES, CAFE, SEAT_SIDES, SIDE_TERRACE, STREETS, TERRACE_TABLE, VIEWPOINTS, groundAt, seatOffset } from './cafeLayout.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ambianceAt, currentHour } from './ambiance.ts';
import type { Ambiance } from './ambiance.ts';
import { createCrowd } from './crowd.ts';
import type { TableStatus } from './crowdPlan.ts';
import { MOHAMED_NACEUR, NADER, SMOKE_OFFSET, TAREK, Walker, createPerson, customerSpec, seatedChicha, tray } from './characters.ts';
import type { Waypoint } from './characters.ts';
import { TAREK_END_LINE } from '../labels.ts';
import { CAFE_LINES, CAFE_NAMES, bubbleDuration } from './cafeLines.ts';
import type { CafeCharacter } from './cafeLines.ts';
import { drinkModel, tableKit } from './tableProps.ts';
import type { Drink } from '../../server/types.ts';
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
  /** Une partie vient de finir à cette table : le patron y va et dit « اللي شاح يلبس ». */
  announceEnd(number: number): void;
  dispose(): void;
}

interface Callbacks {
  readonly onSelect: (target: CafeTarget) => void;
  /** Appelé quand la caméra change de point de vue (étiquette « salle de belote » touchée). */
  readonly onView: (view: Viewpoint) => void;
  /** Scène 3D pendant une partie : le serveur est arrivé à la table. */
  readonly onArrive?: () => void;
}

/**
 * Petites scènes pendant le match, à la table des joueurs :
 * - « order » : Mohamed Naceur apporte tapis, carton et stylo, et prend la commande ;
 * - « drinks » : à 500 points, Nader apporte les boissons (il se trompe pour une seule personne) ;
 * - « hung » : à 1000 points, Nader vient presser la table (« لاولاد هي فيسع بش نسكرو » ou « ديما خاسرين انتم .. »).
 */
export interface Cutscene {
  readonly kind: 'order' | 'drinks' | 'hung';
  readonly table: number;
  /** Boissons posées devant chaque place (par numéro de place). */
  readonly served?: Partial<Record<number, Drink>>;
  /** Scène des boissons vue par ce joueur : la caméra est à sa place, à hauteur des yeux. */
  readonly viewerSeat?: number;
  /** Ce que dit le serveur à la place de sa phrase habituelle (personnalisée pour ce joueur). */
  readonly line?: string;
}

/**
 * Vue subjective à une table : les yeux du joueur assis, le point regardé (en face, un peu
 * de côté) et l'endroit où le serveur se poste pour être bien vu : de l'autre côté de la table,
 * côté allée (ou côté entrée pour un joueur assis à l'est ou à l'ouest).
 */
function povAt(spot: TableSpot, seat: number) {
  const { dx, dz } = seatOffset(SEAT_SIDES[seat % 4]!, 1);
  const px = dz !== 0 ? (spot.x > 0 ? -1 : 1) : 0;
  const pz = dx !== 0 ? 1 : 0;
  return {
    eye: new THREE.Vector3(spot.x + dx * 0.95, CAFE.stepHeight + 1.18, spot.z + dz * 0.95),
    look: new THREE.Vector3(spot.x - dx * 0.45 + px * 0.38, CAFE.stepHeight + 1.08, spot.z - dz * 0.45 + pz * 0.38),
    stand: { x: spot.x - dx * 0.45 + px * 0.75, z: spot.z - dz * 0.45 + pz * 0.75 },
  };
}

const CUTSCENE_LINES: Record<Cutscene['kind'], string> = {
  order: 'شنو بش تشربو هاي فيسع',
  drinks: 'تفضلو 😅',
  hung: 'لاولاد هي فيسع بش نسكرو',
};

const TEAM_COLORS = [0x5aa9e6, 0xf08a68];
const SKIN = 0xd9a77c;

/* ----------------------------------------------------------------------------
 * Textures dessinées (aucun fichier à télécharger)
 * -------------------------------------------------------------------------- */

export function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

export function canvasTexture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void, repeat?: [number, number]) {
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
export const terrazzo = (base: string, repeat: [number, number]) =>
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

/** Murs « blanc sale » : enduit blanc cassé, très légèrement irrégulier. */
export const plaster = (repeat: [number, number]) =>
  canvasTexture(
    128,
    128,
    (ctx) => {
      ctx.fillStyle = '#e6dfcd';
      ctx.fillRect(0, 0, 128, 128);
      const rand = seeded(11);
      for (let i = 0; i < 500; i++) {
        ctx.fillStyle = rand() < 0.5 ? 'rgba(120, 105, 80, 0.06)' : 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(rand() * 128, rand() * 128, 1 + rand() * 3, 1 + rand() * 3);
      }
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

/** La télé du café : le match. */
function drawTv(ctx: CanvasRenderingContext2D) {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, 512, 288);
  // Le match : terrain dessiné en 256 × 144, agrandi ×2.
  ctx.scale(2, 2);
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
}

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

export const paving = (repeat: [number, number]) =>
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

/** Carreaux en terre cuite de la terrasse sur palier (4 carreaux de 50 cm par motif). */
const terracotta = () =>
  canvasTexture(128, 128, (ctx) => {
    const rand = seeded(23);
    for (let i = 0; i < 4; i++) {
      const shade = 0.9 + rand() * 0.15;
      ctx.fillStyle = `rgb(${Math.round(184 * shade)}, ${Math.round(104 * shade)}, ${Math.round(72 * shade)})`;
      ctx.fillRect((i % 2) * 64, Math.floor(i / 2) * 64, 64, 64);
    }
    ctx.strokeStyle = '#e3d6c2';
    ctx.lineWidth = 3;
    for (const v of [0, 64, 128]) {
      ctx.beginPath();
      ctx.moveTo(v, 0);
      ctx.lineTo(v, 128);
      ctx.moveTo(0, v);
      ctx.lineTo(128, v);
      ctx.stroke();
    }
  });

export const wcSign = () =>
  canvasTexture(64, 32, (ctx) => {
    ctx.fillStyle = '#f2efe8';
    ctx.fillRect(0, 0, 64, 32);
    ctx.fillStyle = '#1d1f22';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('WC', 32, 17);
  });

/* ----------------------------------------------------------------------------
 * Mobilier
 * -------------------------------------------------------------------------- */

export const mat = (color: number, options: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.75, metalness: 0.05, ...options });

export const MATERIALS = {
  wood: mat(0x6b4226),
  darkWood: mat(0x3e2614),
  chair: mat(0x4a2c17),
  /** Chaises du café : blanches et bordeaux, en alternance. */
  chairWhite: mat(0xf0ebe0, { roughness: 0.5 }),
  chairBordeaux: mat(0x6e1a2b, { roughness: 0.55 }),
  tableBrown: mat(0x7a4a2a, { roughness: 0.6 }),
  baseboard: mat(0x5a3a22),
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

export function box(w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

export function cylinder(
  rTop: number,
  rBottom: number,
  h: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
  segments = 16,
) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, segments), material);
  mesh.position.set(x, y, z);
  return mesh;
}

let chairCount = 0;

/** Chaise tournée vers -z (dossier côté +z) ; la rotation l'oriente vers sa table. Blanche ou bordeaux. */
export function chair(x: number, y: number, z: number, rotation: number) {
  const group = new THREE.Group();
  const color = chairCount++ % 2 === 0 ? MATERIALS.chairWhite : MATERIALS.chairBordeaux;
  group.add(box(0.42, 0.05, 0.42, color, 0, 0.46, 0));
  group.add(box(0.42, 0.5, 0.05, color, 0, 0.72, 0.19));
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

export function squareTable(size: number, x: number, y: number, z: number, top: THREE.Material = MATERIALS.tableBrown) {
  const group = new THREE.Group();
  group.add(box(size, 0.05, size, top, 0, 0.75, 0));
  group.add(cylinder(0.05, 0.05, 0.72, MATERIALS.darkWood, 0, 0.37, 0, 8));
  group.add(box(size * 0.6, 0.03, size * 0.6, MATERIALS.darkWood, 0, 0.02, 0));
  group.position.set(x, y, z);
  return group;
}

export function plant(x: number, y: number, z: number, scale = 1) {
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

/** Matériaux dont la couleur change avec l'heure (rue, enseigne). */
interface RoomHandles {
  readonly street: THREE.MeshStandardMaterial;
  readonly sign: THREE.MeshStandardMaterial;
  /** Écran de la télé (redessiné quand on change de chaîne). */
  readonly tv: THREE.CanvasTexture;
}

/** Trottoirs, bordures, chaussées (avec marquages) et immeubles voisins autour du café, au coin de deux rues. */
function buildStreets(scene: THREE.Scene, asphalt: THREE.MeshStandardMaterial) {
  const { frontCurbZ, frontRoad, sideCurbX, sideRoad, roadY } = STREETS;
  const flat = (w: number, d: number, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  // Chaussée partout en dessous (couleur selon l'heure).
  flat(70, 80, asphalt, 3, roadY, -6);
  // Trottoirs : devant (où est la terrasse des bots) et le long de la terrasse sur palier.
  const front = frontCurbZ;
  const westEdge = -14;
  flat(
    sideCurbX - westEdge,
    front,
    new THREE.MeshStandardMaterial({ map: paving([10, 2.5]), roughness: 0.9 }),
    (sideCurbX + westEdge) / 2,
    -0.01,
    front / 2,
  );
  const sideFrom = CAFE.width / 2;
  flat(
    sideCurbX - sideFrom,
    26,
    new THREE.MeshStandardMaterial({ map: paving([2, 13]), roughness: 0.9 }),
    (sideCurbX + sideFrom) / 2,
    -0.01,
    -13,
  );
  // Bordures en pierre.
  const curb = mat(0xb9b3a7, { roughness: 0.85 });
  scene.add(box(sideCurbX - westEdge + 0.15, 0.13, 0.15, curb, (sideCurbX + westEdge) / 2 + 0.075, roadY + 0.065, frontCurbZ + 0.075));
  scene.add(box(0.15, 0.13, 26 + frontCurbZ, curb, sideCurbX + 0.075, roadY + 0.065, (frontCurbZ - 26) / 2));
  // Marquages blancs : lignes discontinues au milieu des rues et passages piétons au coin (une seule forme).
  const marks: THREE.BufferGeometry[] = [];
  const mark = (w: number, d: number, x: number, z: number) => {
    const g = new THREE.PlaneGeometry(w, d);
    g.rotateX(-Math.PI / 2);
    g.translate(x, roadY + 0.006, z);
    marks.push(g);
  };
  const frontMid = (frontRoad[0] + frontRoad[1]) / 2;
  const sideMid = (sideRoad[0] + sideRoad[1]) / 2;
  // Carrefour : les deux rues se croisent au coin du café, sans marquage au milieu du croisement.
  for (let x = westEdge; x < sideRoad[0] - 1; x += 3.2) mark(1.6, 0.12, x, frontMid);
  for (let x = sideRoad[1] + 1; x < 30; x += 3.2) mark(1.6, 0.12, x, frontMid);
  for (let z = frontRoad[0] - 1.5; z > -30; z -= 3.2) mark(0.12, 1.6, sideMid, z);
  for (let z = frontRoad[1] + 1.5; z < 25; z += 3.2) mark(0.12, 1.6, sideMid, z);
  const zebraX = sideCurbX - 1.5;
  const zebraZ = frontCurbZ - 1.5;
  for (let z = frontRoad[0] + 0.4; z < frontRoad[1] - 0.2; z += 0.9) mark(2.2, 0.45, zebraX, z);
  for (let x = sideRoad[0] + 0.4; x < sideRoad[1] - 0.2; x += 0.9) mark(0.45, 2.2, x, zebraZ);
  const markings = new THREE.Mesh(mergeGeometries(marks), new THREE.MeshStandardMaterial({ color: 0xf2f0ea, roughness: 0.8 }));
  scene.add(markings);
  // Immeubles voisins, simples et bas : à gauche et derrière le café, et de l'autre côté des deux rues.
  const facade = mat(0xd8cdb8, { roughness: 0.95 });
  const facade2 = mat(0xc9b9a0, { roughness: 0.95 });
  scene.add(box(westEdge * -1 - 2.75, 3.4, 24, facade, (westEdge - 2.75) / 2, 1.7 + roadY, -12));
  scene.add(box(sideCurbX + 2.75, 3.0, 6, facade2, (sideCurbX - 2.75) / 2, 1.5 + roadY, -23.3));
  // Les trois autres coins du carrefour.
  const across = 6;
  const acrossFront = frontRoad[1] + across / 2;
  const acrossSide = sideRoad[1] + across / 2;
  scene.add(box(sideRoad[0] - 0.15 - westEdge, 3.6, across, facade2, (sideRoad[0] - 0.15 + westEdge) / 2, 1.8 + roadY, acrossFront));
  scene.add(box(across, 3.6, frontRoad[0] - 0.15 + 30, facade, acrossSide, 1.8 + roadY, (frontRoad[0] - 0.15 - 30) / 2));
  scene.add(box(across, 4.2, across, facade, acrossSide, 2.1 + roadY, acrossFront));
}

function buildRoom(scene: THREE.Scene): RoomHandles {
  const { width, length, wallHeight, stepZ, stepHeight } = CAFE;
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

  // Le café est au coin de deux rues : trottoirs, bordures, chaussées et voisins.
  const streetMaterial = mat(0x3a3d40, { roughness: 1 });
  buildStreets(scene, streetMaterial);

  // Murs : extérieur sombre, intérieur « blanc sale » avec une plinthe en bois.
  const panelMaterial = (len: number) => new THREE.MeshStandardMaterial({ map: plaster([len / 2, 1]), roughness: 0.9 });
  const leftWall = new THREE.Group();
  leftWall.add(box(0.2, wallHeight, length, MATERIALS.wallOuter, -half - 0.1, wallHeight / 2, -length / 2));
  const leftPanel = new THREE.Mesh(new THREE.PlaneGeometry(length, wallHeight), panelMaterial(length));
  leftPanel.rotation.y = Math.PI / 2;
  leftPanel.position.set(-half + 0.005, wallHeight / 2, -length / 2);
  leftWall.add(leftPanel);
  leftWall.add(box(0.03, 0.12, length, MATERIALS.baseboard, -half + 0.015, 0.06, -length / 2));
  scene.add(leftWall);

  // Mur de droite, ouvert pour la 2e entrée (au milieu, au niveau de la marche), avec des fenêtres
  // sur la terrasse : au-dessus du comptoir et dans la salle de belote.
  const doorFrom = SIDE_TERRACE.sideDoor.from;
  const doorTo = SIDE_TERRACE.sideDoor.to;
  const rightPanel = panelMaterial(2);
  const wallPiece = (from: number, to: number, bottom: number, top: number) => {
    const len = from - to;
    const h = top - bottom;
    scene.add(box(0.2, h, len, MATERIALS.wallOuter, half + 0.1, bottom + h / 2, (from + to) / 2));
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(len, h), rightPanel);
    panel.rotation.y = -Math.PI / 2;
    panel.position.set(half - 0.005, bottom + h / 2, (from + to) / 2);
    scene.add(panel);
  };
  const windowFrame = MATERIALS.black;
  const windowGlass = new THREE.MeshStandardMaterial({
    color: 0x9fd3f0,
    transparent: true,
    opacity: 0.38,
    roughness: 0.1,
    metalness: 0.1,
    side: THREE.DoubleSide,
  });
  for (const [from, to, windows] of [
    [
      0,
      doorFrom,
      [
        [-2.2, -3.8],
        [-4.6, -6.2],
        [-7.0, -8.6],
      ],
    ],
    [
      doorTo,
      -length,
      [
        [-15.0, -16.4],
        [-17.2, -18.6],
      ],
    ],
  ] as const) {
    let z: number = from;
    const sill = from === 0 ? 1.25 : 1.15;
    const head = 2.25;
    for (const [wFrom, wTo] of windows) {
      wallPiece(z, wFrom, 0, wallHeight);
      wallPiece(wFrom, wTo, 0, sill);
      wallPiece(wFrom, wTo, head, wallHeight);
      const len = wFrom - wTo;
      const mid = (wFrom + wTo) / 2;
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(len, head - sill), windowGlass);
      pane.rotation.y = -Math.PI / 2;
      pane.position.set(half + 0.1, (sill + head) / 2, mid);
      scene.add(pane);
      // Cadre noir, meneau au milieu et rebord de fenêtre.
      scene.add(box(0.06, 0.05, len, windowFrame, half + 0.1, sill + 0.025, mid));
      scene.add(box(0.06, 0.05, len, windowFrame, half + 0.1, head - 0.025, mid));
      for (const edge of [wFrom - 0.025, wTo + 0.025, mid])
        scene.add(box(0.06, head - sill, 0.05, windowFrame, half + 0.1, (sill + head) / 2, edge));
      scene.add(box(0.26, 0.04, len + 0.1, MATERIALS.marble, half - 0.04, sill - 0.02, mid));
      z = wTo;
    }
    wallPiece(z, to, 0, wallHeight);
    scene.add(box(0.03, 0.12, from - to, MATERIALS.baseboard, half - 0.015, 0.06, (from + to) / 2));
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

  // Grande télé pour les matchs, inclinée vers la salle pour que tout le monde la voie.
  const tv = new THREE.Group();
  tv.add(box(2.2, 1.26, 0.07, MATERIALS.black, 0, 0, 0));
  const tvCanvas = document.createElement('canvas');
  tvCanvas.width = 512;
  tvCanvas.height = 288;
  drawTv(tvCanvas.getContext('2d')!);
  const tvTexture = new THREE.CanvasTexture(tvCanvas);
  tvTexture.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(2.1, 1.16),
    new THREE.MeshStandardMaterial({ map: tvTexture, emissive: 0xffffff, emissiveMap: tvTexture, emissiveIntensity: 0.6 }),
  );
  screen.position.z = 0.04;
  tv.add(screen);
  tv.position.set(-0.75, stepHeight + 1.72, -length + 0.2);
  tv.rotation.x = 0.12;
  scene.add(tv);
  scene.add(box(0.3, 0.3, 0.16, MATERIALS.black, -0.75, stepHeight + 1.75, -length + 0.08));

  // Façade vitrée : deux vitrines et la double porte.
  const facadeTop = box(width + 0.4, 0.4, 0.2, MATERIALS.wallOuter, 0, wallHeight - 0.2, 0.1);
  scene.add(facadeTop);
  for (const x of [-half + 0.05, -0.9, 0.9, half - 0.05])
    scene.add(box(0.1, wallHeight - 0.4, 0.12, MATERIALS.black, x, (wallHeight - 0.4) / 2, 0.1));
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
  const signMaterial = new THREE.MeshStandardMaterial({
    map: signTexture,
    emissive: 0xffffff,
    emissiveMap: signTexture,
    emissiveIntensity: 0.35,
  });
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), signMaterial);
  sign.position.set(0, wallHeight + 0.35, 0.22);
  scene.add(sign);
  scene.add(box(2.7, 0.75, 0.08, MATERIALS.black, 0, wallHeight + 0.35, 0.17));
  return { street: streetMaterial, sign: signMaterial, tv: tvTexture };
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
  // Porte fermée, avec sa poignée et le panneau « WC ».
  const doorLen = z0 - (z1 + 0.6);
  scene.add(box(0.06, 2.0, doorLen, mat(0x7a4a2a), x0, y + 1.0, z0 - doorLen / 2));
  scene.add(box(0.08, 0.3, doorLen, wall, x0, y + 2.15, z0 - doorLen / 2));
  scene.add(cylinder(0.02, 0.02, 0.1, MATERIALS.metal, x0 - 0.06, y + 1.0, z1 + 0.75, 8).rotateZ(Math.PI / 2));
  const signTexture = wcSign();
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.14), new THREE.MeshStandardMaterial({ map: signTexture }));
  sign.rotation.y = -Math.PI / 2;
  sign.position.set(x0 - 0.035, y + 1.65, z0 - doorLen / 2);
  scene.add(sign);
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

/** Un café (tasse blanche) et un thé (verre ambré) posés sur une table. */
function drinks(x: number, y: number, z: number) {
  const group = new THREE.Group();
  const coffee = mat(0x3b2412, { roughness: 0.3 });
  const tea = new THREE.MeshStandardMaterial({ color: 0xc8732a, transparent: true, opacity: 0.85, roughness: 0.2 });
  group.add(cylinder(0.04, 0.034, 0.06, MATERIALS.white, -0.12, 0.03, 0.12, 10));
  group.add(cylinder(0.034, 0.034, 0.005, coffee, -0.12, 0.058, 0.12, 10));
  group.add(cylinder(0.065, 0.065, 0.008, MATERIALS.white, -0.12, 0.004, 0.12, 14));
  group.add(cylinder(0.03, 0.025, 0.085, tea, 0.1, 0.043, -0.1, 10));
  group.add(cylinder(0.03, 0.025, 0.085, tea, 0.14, 0.043, 0.06, 10));
  group.position.set(x, y, z);
  return group;
}

/**
 * Terrasse sur palier le long du mur de droite : dallage en terre cuite, escalier devant,
 * marches vers la 2e entrée, garde-corps, et ses tables (les clients sont ajoutés avec les personnages).
 */
function buildSideTerrace(scene: THREE.Scene) {
  const t = SIDE_TERRACE;
  const side = mat(0xd8cfbf, { roughness: 0.9 });
  const tileTexture = terracotta();
  const platform = (xa: number, xb: number, za: number, zb: number, h: number) => {
    const w = xb - xa;
    const d = za - zb;
    const top = tileTexture.clone();
    top.wrapS = top.wrapT = THREE.RepeatWrapping;
    top.repeat.set(w, d);
    top.needsUpdate = true;
    const topMaterial = new THREE.MeshStandardMaterial({ map: top, roughness: 0.8 });
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h + 0.03, d), [side, side, topMaterial, side, side, side]);
    mesh.position.set((xa + xb) / 2, (h - 0.03) / 2, (za + zb) / 2);
    scene.add(mesh);
  };
  // Palier à +50 cm puis à +70 cm, avec l'entaille des marches vers la 2e entrée.
  platform(t.x0, t.x1, 0, t.splitZ, t.frontHeight);
  platform(t.x0, t.x1, t.splitZ, t.sideDoor.from, t.backHeight);
  platform(t.sideDoor.x1, t.x1, t.sideDoor.from, t.sideDoor.to, t.backHeight);
  platform(t.x0, t.x1, t.sideDoor.to, -CAFE.length, t.backHeight);
  for (let i = 0; i < 3; i++) {
    const stepW = (t.sideDoor.x1 - t.x0) / 3;
    platform(t.x0 + i * stepW, t.x0 + (i + 1) * stepW, t.sideDoor.from, t.sideDoor.to, (t.backHeight * (i + 1)) / 4);
  }
  // Escalier de devant, sur le trottoir.
  for (let i = 0; i < 3; i++) {
    const stepD = t.stairs.depth / 3;
    platform(t.x0, t.stairs.x1, t.stairs.depth - i * stepD, t.stairs.depth - (i + 1) * stepD, (t.frontHeight * (i + 1)) / 4);
  }
  // Tables avec un café et un thé ; deux chaises face à face.
  for (const z of t.tables) {
    const y = groundAt(t.tableX, z);
    scene.add(squareTable(0.6, t.tableX, y, z));
    scene.add(chair(t.tableX, y, z + 0.55, 0));
    scene.add(chair(t.tableX, y, z - 0.55, Math.PI));
    if (z !== t.tables[0]) scene.add(drinks(t.tableX, y + 0.775, z));
  }
  scene.add(plant(t.x1 - 0.3, t.backHeight, -11.4, 0.85), plant(t.x1 - 0.3, t.frontHeight, -0.5, 0.8));
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

export function createCafeScene(
  container: HTMLElement,
  labelLayer: HTMLElement,
  callbacks: Callbacks,
  cutscene: Cutscene | null = null,
): CafeSceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(0x0d2219);
  // Lumière plus douce et plus juste : rendu « cinéma » et ombres adoucies.
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.className = 'cafe__canvas';

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d2219, 22, 40);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 80);
  const start = VIEWPOINTS.entrance;
  camera.position.set(...start.camera);

  // Lumières : ambiance (ciel/sol), lumière principale qui donne les ombres, lampes chaudes.
  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a2a1c, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2b8, 1.6);
  key.position.set(3.5, 13, 3);
  key.target.position.set(0, 0, -8.5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -8, right: 8, top: 15, bottom: -15, near: 1, far: 40 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  const lamps: THREE.PointLight[] = [];
  for (const [x, z] of [
    [0.8, -6],
    [0, -15.4],
    [0, -18.4],
  ] as const) {
    const light = new THREE.PointLight(0xffc98a, 5, 7.5, 1.6);
    light.position.set(x, 2.3, z);
    scene.add(light);
    lamps.push(light);
  }

  // Suspensions : une ampoule chaude au-dessus de chaque table et du comptoir.
  const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffc46b, emissiveIntensity: 1.5 });
  const shadeMaterial = mat(0x2b2b2e, { roughness: 0.5, metalness: 0.4, side: THREE.DoubleSide });
  const pendant = (x: number, y: number, z: number) => {
    const group = new THREE.Group();
    group.add(cylinder(0.005, 0.005, 0.5, MATERIALS.black, 0, 0.25, 0, 4));
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.12, 16, 1, true), shadeMaterial);
    shade.position.y = -0.02;
    group.add(shade);
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), bulbMaterial);
    bulb.position.y = -0.08;
    group.add(bulb);
    group.position.set(x, y, z);
    scene.add(group);
  };
  for (const t of BELOTE_TABLES) pendant(t.x, CAFE.stepHeight + 1.95, t.z);
  for (const z of [-3, -6.5, -10]) pendant(-1.75, 1.95, z);
  for (const z of [-3, -6, -9]) pendant(1.75, 2.0, z);
  // Appliques sur le mur extérieur, au-dessus de la terrasse sur palier.
  for (const z of [-4, -15.5]) {
    const x = CAFE.width / 2 + 0.24;
    scene.add(box(0.08, 0.22, 0.14, MATERIALS.black, x, 2.35, z));
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), bulbMaterial);
    bulb.position.set(x + 0.08, 2.3, z);
    scene.add(bulb);
    const light = new THREE.PointLight(0xffc98a, 5, 6.5, 1.6);
    light.position.set(x + 0.4, 2.25, z);
    scene.add(light);
    lamps.push(light);
  }

  // Lampadaire sur le trottoir, allumé le soir.
  const streetLamp = new THREE.Group();
  streetLamp.add(cylinder(0.04, 0.05, 3.2, MATERIALS.black, 0, 1.6, 0, 8));
  streetLamp.add(box(0.5, 0.05, 0.08, MATERIALS.black, -0.25, 3.15, 0));
  const lampHeadMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd08a, emissiveIntensity: 0 });
  const lampHead = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), lampHeadMaterial);
  lampHead.position.set(-0.45, 3.05, 0);
  streetLamp.add(lampHead);
  streetLamp.position.set(2.9, 0, STREETS.frontCurbZ - 0.3);
  scene.add(streetLamp);
  const streetLight = new THREE.PointLight(0xffd08a, 0, 8, 1.4);
  streetLight.position.set(2.45, 3.0, STREETS.frontCurbZ - 0.3);
  scene.add(streetLight);

  const room = buildRoom(scene);
  buildCounter(scene);
  buildToilets(scene);
  buildFrontSeating(scene);
  buildSideTerrace(scene);
  for (const [x, z] of [
    [-2.1, -13.0],
    [2.1, -19.5],
    [-2.15, -19.5],
  ] as const) {
    scene.add(plant(x, CAFE.stepHeight, z));
  }

  const pickables: THREE.Object3D[] = [];
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
    const group = squareTable(0.95, spot.x, y, spot.z);
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
    scene.add(plant(-2.4, 0, 0.9), plant(2.2, 0, 3.8, 0.8));
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

  /* ------------------------------ Personnages ------------------------------ */

  // Chaque fumeur assis a sa chicha ; la fumée sort devant son visage.
  const smokers: { readonly kit: THREE.Group; next: number; active: boolean }[] = [];

  // Clients de la terrasse sur palier : deux par table (sauf celle du patron), une chicha par table.
  const customers: THREE.Object3D[] = [];
  SIDE_TERRACE.tables.slice(1).forEach((z, i) => {
    const y = groundAt(SIDE_TERRACE.tableX, z);
    for (const [k, dz, rotation] of [
      [0, 0.55, Math.PI],
      [1, -0.55, 0],
    ] as const) {
      const person = createPerson(customerSpec(i * 2 + k));
      person.sit();
      person.root.position.set(SIDE_TERRACE.tableX, y, z + dz);
      person.root.rotation.y = rotation;
      scene.add(person.root);
      customers.push(person.root);
    }
    // La chicha côté garde-corps, son tuyau vers le client assis dos à la rue.
    const { kit } = seatedChicha();
    kit.position.set(SIDE_TERRACE.tableX, y, z + 0.55);
    kit.rotation.y = Math.PI;
    kit.updateMatrixWorld();
    scene.add(kit);
    smokers.push({ kit, next: performance.now() + Math.random() * 4000, active: true });
  });

  // Les habitués, les spectateurs et les clients de l'entrée et du comptoir. Pendant une scène à
  // une table, la salle de belote reste calme (la vue est celle des joueurs).
  const crowd = createCrowd(scene, { backRoom: !cutscene, excludedTable: cutscene?.table });
  crowd.setTables(new Map(BELOTE_TABLES.map((t) => [t.number, 'free' as TableStatus])));
  customers.push(...crowd.roots);

  // Tarek, le patron : assis à la première table de l'entrée, il sort de temps en temps
  // s'installer sur la terrasse, sa chicha à la main, puis revient.
  const tarek = createPerson(TAREK);
  scene.add(tarek.root);
  const tarekKit = seatedChicha();
  scene.add(tarekKit.kit);
  const tarekSmoke = { kit: tarekKit.kit, next: 0, active: true };
  smokers.push(tarekSmoke);
  const terraceSeatZ = SIDE_TERRACE.tables[0] + 0.55;
  const TAREK_SEATS = {
    inside: { x: -1.75, z: -2.42 },
    terrace: { x: SIDE_TERRACE.tableX, z: terraceSeatZ },
  } as const;
  const laneX = SIDE_TERRACE.x0 + 0.55;
  const TO_TERRACE: Waypoint[] = [
    { x: -1.75, z: -2.42 },
    { x: -0.95, z: -2.3 },
    { x: -0.1, z: -0.9 },
    { x: 0, z: 0.7 },
    { x: 1.2, z: 1.3 },
    { x: laneX, z: 1.35 },
    { x: laneX, z: SIDE_TERRACE.stairs.depth },
    { x: laneX, z: -0.1 },
    { x: laneX, z: terraceSeatZ },
    { x: SIDE_TERRACE.tableX, z: terraceSeatZ },
  ];
  const TO_INSIDE = [...TO_TERRACE].reverse();
  // Vers la salle de belote : par l'allée entre les tables de gauche et le comptoir.
  const TO_BACK_ROOM: Waypoint[] = [
    { x: 0.45, z: -3.6 },
    { x: 0.55, z: -10.8 },
    { x: 0.1, z: -12.9 },
  ];
  type Seat = keyof typeof TAREK_SEATS;
  let tarekState:
    | { seat: Seat; until: number }
    | { walker: Walker; to: Seat }
    | { walker: Walker; to: Seat; visit: TableSpot; spoke: boolean };
  /** Tables où une partie vient de finir et où le patron doit encore passer. */
  const pendingVisits: TableSpot[] = [];
  const seatTarek = (seat: Seat, until: number) => {
    const { x, z } = TAREK_SEATS[seat];
    const y = groundAt(x, z);
    tarek.sit();
    tarek.root.position.set(x, y, z);
    tarek.root.rotation.y = Math.PI;
    tarekKit.kit.position.set(x, y, z);
    tarekKit.kit.rotation.y = Math.PI;
    tarekKit.kit.add(tarekKit.chicha);
    tarekKit.chicha.position.set(-0.63, 0, -0.12);
    tarekKit.kit.visible = true;
    tarekKit.kit.updateMatrixWorld();
    tarekSmoke.active = true;
    tarekState = { seat, until };
  };
  const walkTarek = (to: Seat) => {
    // Il se lève et emporte sa chicha à la main.
    tarekKit.kit.visible = false;
    tarekSmoke.active = false;
    tarek.root.add(tarekKit.chicha);
    tarekKit.chicha.position.set(0.37, 0.2, 0);
    tarekKit.chicha.visible = true;
    tarekState = { walker: new Walker(tarek, to === 'terrace' ? TO_TERRACE : TO_INSIDE, 0.7, groundAt, false), to };
  };
  /** Il laisse sa chicha à sa place, va à la table où la partie est finie, puis revient s'asseoir. */
  const visitTable = (seat: Seat, spot: TableSpot) => {
    tarekSmoke.active = false;
    const start = seat === 'inside' ? [TO_TERRACE[0]!, TO_TERRACE[1]!] : TO_INSIDE.slice(0, 8);
    const go: Waypoint[] = [...start, ...TO_BACK_ROOM, { x: 0, z: spot.z, pause: 6 }];
    const path = [...go, ...[...go].reverse().slice(1)];
    tarekState = { walker: new Walker(tarek, path, 1.1, groundAt, false), to: seat, visit: spot, spoke: false };
  };
  seatTarek('inside', performance.now() + 15000);

  // Bouffées de fumée de chicha qui montent et disparaissent.
  const smokeMaterial = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0, depthWrite: false });
  const puffs = Array.from({ length: 16 }, () => {
    const puff = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), smokeMaterial.clone());
    puff.visible = false;
    scene.add(puff);
    return { mesh: puff, born: -1e9, kit: tarekKit.kit as THREE.Object3D, drift: Math.random() * 6 };
  });
  const smokePoint = new THREE.Vector3();

  // Les deux serveurs font leur tournée.
  const nader = createPerson(NADER);
  const carried = tray();
  carried.position.set(0.22, 1.02, 0.36);
  nader.root.add(carried);
  scene.add(nader.root);
  let naderWalk = new Walker(
    nader,
    [
      { x: 0.55, z: -8.4, pause: 3 },
      { x: 0.4, z: -6.6 },
      { x: -1.0, z: -6.6, pause: 2.5 },
      { x: -0.9, z: -3.9, pause: 2 },
      { x: 0.1, z: -1.3 },
      { x: 0.1, z: 1.3, pause: 3 },
      // Il monte servir la terrasse sur palier.
      { x: 1.2, z: 1.45 },
      { x: laneX - 0.2, z: 1.45 },
      { x: laneX - 0.2, z: -0.1 },
      { x: laneX - 0.2, z: SIDE_TERRACE.tables[1], pause: 3 },
      { x: laneX - 0.2, z: SIDE_TERRACE.tables[2], pause: 2.5 },
      { x: laneX - 0.2, z: -0.1 },
      { x: laneX - 0.2, z: 1.45 },
      { x: 1.2, z: 1.45 },
      { x: 0.3, z: -1.6 },
      { x: 0.55, z: -5 },
    ],
    0.95,
    groundAt,
  );
  const naceur = createPerson(MOHAMED_NACEUR);
  scene.add(naceur.root);
  let naceurWalk = new Walker(
    naceur,
    [
      { x: 0.5, z: -10.9, pause: 2 },
      { x: 0, z: -12.1 },
      { x: 0, z: -14.6 },
      { x: 0, z: -16.2, pause: 2.5 },
      { x: 0, z: -17.9, pause: 2.5 },
      { x: -0.3, z: -19.2, pause: 4 },
      { x: 0, z: -16.2 },
      { x: 0, z: -13 },
      { x: 0.5, z: -9.6, pause: 3 },
    ],
    0.9,
    groundAt,
  );

  // Scène pendant une partie : le serveur vient de l'entrée de la salle jusqu'à la table des joueurs.
  const cutSpot = cutscene ? (BELOTE_TABLES.find((t) => t.number === cutscene.table) ?? BELOTE_TABLES[0]!) : null;
  const cutWaiter = cutscene?.kind === 'order' ? naceur : nader;
  let cutWalker: Walker | null = null;
  let arrived = false;
  const tableTop = CAFE.stepHeight + 0.776;
  const kit = tableKit();
  /** Où se pose la boisson d'une place : sur la table devant le joueur, la chicha par terre à côté de sa chaise. */
  const drinkSpot = (seat: number, drink: Drink, spot: TableSpot) => {
    const onFloor = drink === 'chicha';
    const { dx, dz } = seatOffset(SEAT_SIDES[seat]!, onFloor ? 0.62 : 0.3);
    const lateral = onFloor ? seatOffset(SEAT_SIDES[(seat + 1) % 4]!, 0.32) : { dx: 0, dz: 0 };
    return new THREE.Vector3(spot.x + dx + lateral.dx, onFloor ? CAFE.stepHeight : tableTop, spot.z + dz + lateral.dz);
  };
  const placeDrinks = (served: Partial<Record<number, Drink>>, spot: TableSpot, skipSeat?: number) => {
    SEAT_SIDES.forEach((_, seat) => {
      const drink = served[seat];
      if (!drink || seat === skipSeat) return;
      const model = drinkModel(drink);
      model.position.copy(drinkSpot(seat, drink, spot));
      scene.add(model);
    });
  };
  // Vue subjective (scène des boissons) : Nader porte sur son plateau la boisson de ce joueur.
  const pov = cutscene?.kind === 'drinks' && cutscene.viewerSeat !== undefined && cutSpot ? povAt(cutSpot, cutscene.viewerSeat) : null;
  const ownServed = pov && cutscene?.viewerSeat !== undefined ? cutscene.served?.[cutscene.viewerSeat] : undefined;
  let ownDrink: THREE.Object3D | null = null;
  let placing: { from: THREE.Vector3; to: THREE.Vector3; start: number } | null = null;
  if (ownServed) {
    ownDrink = drinkModel(ownServed);
    if (ownServed === 'chicha') {
      // Trop grande pour le plateau : il la porte de l'autre main.
      ownDrink.position.set(-0.34, 0.22, 0.06);
      nader.root.add(ownDrink);
    } else {
      for (const item of carried.children.slice(1)) item.visible = false;
      ownDrink.position.set(-0.01, 0.008, 0.01);
      carried.add(ownDrink);
    }
  }
  if (cutscene && cutSpot) {
    const path = pov
      ? [{ x: 0.2, z: -12.4 }, { x: 0, z: -13.8 }, { x: 0, z: pov.stand.z }, pov.stand]
      : [
          { x: 0.2, z: -12.4 },
          { x: 0, z: -13.8 },
          { x: 0, z: cutSpot.z },
        ];
    cutWalker = new Walker(cutWaiter, path, 0.9, groundAt, false);
    if (cutscene.kind === 'order') naceurWalk = cutWalker;
    else {
      naderWalk = cutWalker;
      // L'autre serveur reste au comptoir : la salle du fond est à Nader.
      naceur.root.visible = false;
    }
    kit.position.set(cutSpot.x, tableTop, cutSpot.z);
    kit.visible = cutscene.kind !== 'order';
    scene.add(kit);
    if (cutscene.kind === 'hung' && cutscene.served) placeDrinks(cutscene.served, cutSpot);
    // Pendant la scène, pas d'étiquettes de tables : seulement la bulle du serveur.
    labelLayer.classList.add('cafe__labels--cutscene');
  }

  // Toucher un personnage : une bulle avec son nom et une de ses phrases (à tour de rôle).
  const bubbleHtml = (id: CafeCharacter, line: string, className = 'cafe-bubble__line') =>
    `${CAFE_NAMES[id]}<br><span class="${className}" lang="ar" dir="rtl">${line}</span>`;
  const characters = (
    [
      { id: 'tarek', person: tarek, height: 1.35 },
      { id: 'nader', person: nader, height: 2.0 },
      { id: 'naceur', person: naceur, height: 2.12 },
    ] as const
  ).map((c) => {
    const hit = new THREE.Mesh(new THREE.BoxGeometry(0.7, c.height, 0.7), MATERIALS.hit);
    hit.position.y = c.height / 2;
    hit.userData = { kind: 'character', id: c.id };
    c.person.root.add(hit);
    pickables.push(hit);
    const bubble = document.createElement('div');
    bubble.className = 'cafe-bubble';
    bubble.style.display = 'none';
    labelLayer.appendChild(bubble);
    return { ...c, bubble, until: 0, line: 0 };
  });
  const showBubble = (id: CafeCharacter, now: number, html?: string, duration?: number) => {
    const c = characters.find((x) => x.id === id);
    if (!c) return;
    const lines = CAFE_LINES[id];
    const line = lines[c.line++ % lines.length]!;
    c.bubble.innerHTML = html ?? bubbleHtml(id, line);
    c.until = now + (duration ?? bubbleDuration(line));
  };
  // Chacun parle aussi tout seul de temps en temps, sans se couper la parole.
  const openedAt = performance.now();
  const talkAt: Record<CafeCharacter, number> = cutscene
    ? { tarek: Infinity, nader: Infinity, naceur: Infinity }
    : { tarek: openedAt + 9000, nader: openedAt + 17000, naceur: openedAt + 26000 };

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
  if (pov) {
    // Assis à sa place : on regarde la table et le serveur, sans tourner la caméra.
    Object.assign(controls, { enableRotate: false, enableZoom: false, minDistance: 0.1, minPolarAngle: 0, maxPolarAngle: Math.PI });
    Object.assign(controls, { minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity });
    camera.position.copy(pov.eye);
    controls.target.copy(pov.look);
  } else if (cutSpot) {
    // Scène à la table : la caméra se pose près des joueurs.
    controls.minDistance = 2.5;
    camera.position.set(cutSpot.x * 0.1 - 0.5, CAFE.stepHeight + 3.9, cutSpot.z + 3.0);
    controls.target.set(cutSpot.x * 0.55, CAFE.stepHeight + 0.6, cutSpot.z - 0.4);
  }
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
    if (!hit) return;
    const data = hit.object.userData as CafeTarget | { kind: 'character'; id: CafeCharacter };
    if (data.kind === 'character') showBubble(data.id, performance.now());
    else callbacks.onSelect(data);
  };
  renderer.domElement.addEventListener('pointerdown', onDown);
  renderer.domElement.addEventListener('pointerup', onUp);

  /* ------------------------ Ombres et heure de Tunis ------------------------ */

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.Material;
    object.castShadow = !material.transparent;
    object.receiveShadow = true;
  });
  // Les clients assis ne bougent pas : pas d'ombre portée, moins de calcul pour le téléphone.
  for (const customer of customers) customer.traverse((object) => (object.castShadow = false));
  if (pov) {
    // Assis dans le café, on voit le plafond (vu d'en haut, le café reste ouvert). Sans ombre portée.
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(CAFE.width, CAFE.length),
      mat(0xeee6d8, { roughness: 0.95, emissive: 0x2c2822 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, CAFE.wallHeight, -CAFE.length / 2);
    scene.add(ceiling);
  }

  const applyAmbiance = (a: Ambiance) => {
    renderer.setClearColor(a.sky);
    (scene.fog as THREE.Fog).color.setHex(a.sky);
    hemi.color.setHex(a.hemiSky);
    hemi.groundColor.setHex(a.hemiGround);
    hemi.intensity = a.hemiIntensity;
    key.color.setHex(a.keyColor);
    key.intensity = a.keyIntensity;
    for (const lamp of lamps) lamp.intensity = a.lampIntensity;
    bulbMaterial.emissiveIntensity = a.bulbGlow;
    room.street.color.setHex(a.street);
    room.sign.emissiveIntensity = a.streetLights ? 1.1 : 0.35;
    lampHeadMaterial.emissiveIntensity = a.streetLights ? 2.5 : 0;
    streetLight.intensity = a.streetLights ? 6 : 0;
    requestRender();
  };
  applyAmbiance(ambianceAt(currentHour(new Date(), window.location.search)));
  const ambianceTimer = setInterval(() => applyAmbiance(ambianceAt(currentHour(new Date(), window.location.search))), 60_000);

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
    // Assis à table : assez large pour voir à la fois sa place et le serveur debout.
    // (de la boisson posée devant soi jusqu'au visage du serveur).
    if (pov)
      camera.fov = Math.min(
        84,
        Math.max(68, 2 * THREE.MathUtils.radToDeg(Math.atan(Math.tan(THREE.MathUtils.degToRad(26)) / camera.aspect))),
      );
    camera.updateProjectionMatrix();
    requestRender();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const projected = new THREE.Vector3();
  const place = (el: HTMLElement, point: THREE.Vector3, hide = false, margin = 0) => {
    projected.copy(point).project(camera);
    const visible = !hide && projected.z < 1 && Math.abs(projected.x) < 1.15 && Math.abs(projected.y) < (margin > 0 ? 3 : 1.15);
    el.style.display = visible ? '' : 'none';
    if (!visible) return;
    // Les bulles des personnages restent entièrement dans l'écran (de près, la tête peut en sortir).
    const rawX = ((projected.x + 1) / 2) * width;
    const x = margin > 0 ? Math.min(Math.max(rawX, margin), width - margin) : rawX;
    const rawY = ((1 - projected.y) / 2) * height;
    const y = margin > 0 ? Math.min(Math.max(rawY, 64), height - 64) : rawY;
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
    const now = performance.now();
    // Debout, le patron est plus grand qu'assis : sa bulle remonte.
    const tarekStanding = 'walker' in tarekState;
    for (const c of characters) {
      anchor.copy(c.person.root.position);
      anchor.y += (c.id === 'tarek' && tarekStanding ? 1.85 : c.height) + 0.25;
      // De près (vue subjective), la bulle se pose sur le serveur pour laisser voir son visage.
      if (pov && c.id === 'nader') anchor.y = c.person.root.position.y + 0.95;
      place(c.bubble, anchor, now > c.until, 116);
    }
  };

  let frame = 0;
  let last = performance.now();
  const animate = (now: number) => {
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    naderWalk.update(now, dt);
    nader.carry();
    crowd.update(now, dt);
    naceurWalk.update(now, dt);
    if (cutscene && cutSpot && cutWalker?.finished && !arrived) {
      // Arrivé à la table : il se tourne vers les joueurs, pose ce qu'il apporte et parle.
      arrived = true;
      kit.visible = true;
      if (pov && ownDrink && ownServed && cutscene.viewerSeat !== undefined) {
        // Face au joueur, il prend sa boisson et la pose devant lui ; il parle une fois posée.
        const p = cutWaiter.root.position;
        cutWaiter.root.rotation.y = Math.atan2(pov.eye.x - p.x, pov.eye.z - p.z);
        if (cutscene.served) placeDrinks(cutscene.served, cutSpot, cutscene.viewerSeat);
        scene.updateMatrixWorld();
        const from = ownDrink.getWorldPosition(new THREE.Vector3());
        scene.attach(ownDrink);
        placing = { from, to: drinkSpot(cutscene.viewerSeat, ownServed, cutSpot), start: now };
      } else {
        cutWaiter.root.rotation.y = cutSpot.x > 0 ? Math.PI / 2 : -Math.PI / 2;
        if (cutscene.kind === 'drinks' && cutscene.served) placeDrinks(cutscene.served, cutSpot);
        const who = cutscene.kind === 'order' ? 'naceur' : 'nader';
        showBubble(who, now, bubbleHtml(who, cutscene.line ?? CUTSCENE_LINES[cutscene.kind]), 600000);
        callbacks.onArrive?.();
      }
    }
    if (placing && ownDrink) {
      // La boisson passe du plateau à la table, en petit arc ; le bras accompagne le geste.
      const t = Math.min(1, (now - placing.start) / 1100);
      const ease = t * t * (3 - 2 * t);
      ownDrink.position.lerpVectors(placing.from, placing.to, ease);
      ownDrink.position.y += Math.sin(Math.PI * t) * 0.12;
      nader.raiseArm(0.18 * Math.sin(Math.PI * t));
      if (t >= 1) {
        placing = null;
        showBubble('nader', now, bubbleHtml('nader', cutscene?.line ?? CUTSCENE_LINES.drinks), 600000);
        callbacks.onArrive?.();
      }
    }
    // Le patron : assis, il s'énerve de temps en temps (bras levé) ; sinon il marche avec sa chicha.
    if ('visit' in tarekState) {
      const state = tarekState;
      state.walker.update(now, dt);
      const p = tarek.root.position;
      if (Math.hypot(p.x, p.z - state.visit.z) < 0.05) {
        // À la table : il se tourne vers les joueurs, lève le bras et les chasse.
        tarek.root.rotation.y = state.visit.x > 0 ? Math.PI / 2 : -Math.PI / 2;
        tarek.raiseArm(0.6 + 0.4 * Math.sin(now / 180));
        if (!state.spoke) {
          state.spoke = true;
          showBubble('tarek', now, bubbleHtml('tarek', `« ${TAREK_END_LINE} »`, 'cafe-bubble__ar'), 6000);
          talkAt.tarek = now + 20000;
        }
      }
      if (state.walker.finished) seatTarek(state.to, now + 20000 + Math.random() * 15000);
    } else if ('walker' in tarekState) {
      tarekState.walker.update(now, dt);
      tarek.hold();
      if (tarekState.walker.finished) seatTarek(tarekState.to, now + 25000 + Math.random() * 20000);
    } else if (pendingVisits.length > 0) {
      visitTable(tarekState.seat, pendingVisits.shift()!);
    } else if (now > tarekState.until) {
      walkTarek(tarekState.seat === 'inside' ? 'terrace' : 'inside');
    } else {
      const cycle = (now / 1000) % 7;
      tarek.raiseArm(cycle < 1.2 ? Math.sin((cycle / 1.2) * Math.PI) : 0);
    }
    for (const smoker of smokers) {
      if (!smoker.active || now < smoker.next) continue;
      smoker.next = now + 1800 + Math.random() * 2600;
      const puff = puffs.find((p) => now - p.born > 2600);
      if (!puff) continue;
      puff.born = now;
      puff.kit = smoker.kit;
    }
    for (const p of puffs) {
      const age = (now - p.born) / 2600;
      p.mesh.visible = age >= 0 && age < 1 && p.kit.visible;
      if (!p.mesh.visible) continue;
      smokePoint.set(SMOKE_OFFSET.x + Math.sin(age * 5 + p.drift) * 0.05, SMOKE_OFFSET.y + age * 0.7, SMOKE_OFFSET.z + age * 0.15);
      p.mesh.position.copy(p.kit.localToWorld(smokePoint));
      p.mesh.scale.setScalar(1 + age * 2.2);
      (p.mesh.material as THREE.MeshStandardMaterial).opacity = 0.45 * (1 - age);
    }
    for (const c of characters) {
      if (now < talkAt[c.id]) continue;
      const someoneTalking = characters.some((other) => other.until > now);
      if (!someoneTalking) showBubble(c.id, now);
      talkAt[c.id] = now + (c.id === 'tarek' ? 20000 + Math.random() * 15000 : 35000 + Math.random() * 20000);
    }
  };

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    // Les personnages bougent : environ 30 images par seconde suffisent (économie de batterie).
    if (now - last >= 33) {
      animate(now);
      needsRender = true;
    }
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
    crowd.setTables(new Map(BELOTE_TABLES.map((t) => [t.number, states.find((s) => s.number === t.number)?.status ?? 'free'])));
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
          ? crowd.regularTables().includes(t.spot.number)
            ? 'Libre · habitués'
            : 'Libre'
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
    announceEnd(number: number) {
      const spot = BELOTE_TABLES.find((t) => t.number === number);
      if (spot && !pendingVisits.includes(spot)) pendingVisits.push(spot);
    },
    dispose() {
      cancelAnimationFrame(frame);
      clearInterval(ambianceTimer);
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
