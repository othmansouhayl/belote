import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ambianceAt, currentHour } from './ambiance.ts';
import type { Ambiance } from './ambiance.ts';
import { MATERIALS, box, canvasTexture, chair, cylinder, mat, plant, plaster, squareTable, terrazzo, wcSign } from './cafeScene.ts';
import { SEAT_SIDES, seatOffset } from './cafeLayout.ts';
import { KHALIFA, ROCHDI, Walker, createPerson, customerSpec, seatedChicha, tray } from './characters.ts';
import type { Person } from './characters.ts';
import { cardsOnTable } from './crowd.ts';
import {
  GARAGE,
  GARAGE_BELOTE_TABLES,
  GARAGE_SMALL_TABLES,
  GARAGE_PLACE_TABLES,
  GARAGE_VIEW,
  KHALIFA_SPOT,
  ROCHDI_ROUND,
  garageGroundAt,
} from './garageLayout.ts';
import { drinkModel } from './tableProps.ts';

/**
 * Le Café Garage (قهوة الڨراج) en 3D, pour la visite (on n'y joue pas encore) :
 * au croisement de trois rues, l'entrée principale sur la place « الڨاراج », l'entrée de côté sur
 * la rue du milieu, la terrasse de 4 tables posée sur la rue, le poteau au milieu de la salle et
 * le comptoir au fond à droite, tenu par Khalifa. Rochdi, le serveur, court partout.
 */
export interface GarageSceneHandle {
  dispose(): void;
}

const TABLE_TOP = 0.776;

/** Enseigne au-dessus de l'entrée principale. */
const garageSign = () =>
  canvasTexture(512, 160, (ctx) => {
    ctx.fillStyle = '#7a1f1f';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#f0c35a';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 144);
    ctx.fillStyle = '#fff3d6';
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px "Cairo Variable", "Noto Naskh Arabic", sans-serif';
    ctx.fillText('قهوة الڨراج', 256, 82);
    ctx.font = 'italic 600 28px Georgia, serif';
    ctx.fillText('Café Garage', 256, 132);
  });

/** Plaque de rue de la place. */
const squareSign = () =>
  canvasTexture(256, 96, (ctx) => {
    ctx.fillStyle = '#1f4f8a';
    ctx.fillRect(0, 0, 256, 96);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 5;
    ctx.strokeRect(5, 5, 246, 86);
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.font = 'bold 40px "Cairo Variable", sans-serif';
    ctx.fillText('ساحة الڨاراج', 128, 58);
    ctx.font = '600 16px sans-serif';
    ctx.fillText('Place du Garage', 128, 84);
  });

function ground(scene: THREE.Scene, asphalt: THREE.Material) {
  const flat = (w: number, d: number, material: THREE.Material, x: number, y: number, z: number, rotation = 0) => {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, d), material);
    mesh.rotation.set(-Math.PI / 2, 0, rotation);
    mesh.position.set(x, y, z);
    scene.add(mesh);
    return mesh;
  };
  // Chaussée partout : les rues et la place sont en enrobé.
  flat(90, 90, asphalt, 0, -0.02, 0);
  const sidewalk = mat(0xb9b2a4, { roughness: 0.95 });
  // Petit trottoir le long de la façade sud (cour).
  const { room } = GARAGE;
  scene.add(box(room.x1 - room.x0 + 2.4, 0.08, 1.4, sidewalk, (room.x0 + room.x1) / 2 + 1, 0.04, room.z1 + 0.8));
}

/** Pâtés de maisons autour du café : simples volumes, enduits clairs, toits plats. */
function neighbours(scene: THREE.Scene) {
  const facades = [mat(0xe2d6bf), mat(0xd6c7aa), mat(0xeadfca), mat(0xcdbb9c)].map((m) => {
    m.roughness = 0.95;
    return m;
  });
  const blocks: [number, number, number, number, number][] = [
    // x0, x1, z0, z1, hauteur
    [-22, -6.25, -4.5, 6, 3.4], // à l'ouest du café
    [-22, 17, 10.8, 18, 3.2], // de l'autre côté de la rue du sud
    [-22, -4, -16, -8.5, 3.6], // au nord de la rue du milieu
    [-1.5, 4.6, -12.5, -8.5, 3.3], // entre la rue du milieu et la rue en diagonale (le magasin)
  ];
  blocks.forEach(([x0, x1, z0, z1, h], i) =>
    scene.add(box(x1 - x0, h, z1 - z0, facades[i % facades.length]!, (x0 + x1) / 2, h / 2, (z0 + z1) / 2)),
  );
  // La rue en diagonale qui arrive du nord-ouest sur la place : bordée d'un pâté en biais.
  const diagonal = box(9, 3.5, 5, facades[2]!, 6.5, 1.75, -17);
  diagonal.rotation.y = -0.75;
  scene.add(diagonal);
}

/** Murs du café : portes sur la terrasse d'entrée et sur la rue du milieu ; façades nord et est basses (vue en coupe). */
function walls(scene: THREE.Scene) {
  const { room, wallHeight: H, mainDoor, sideDoor } = GARAGE;
  const { x0, x1, z0, z1 } = room;
  const wall = new THREE.MeshStandardMaterial({ map: plaster([3, 1]), roughness: 0.9 });
  const trim = mat(0x2b5c8a);
  const piece = (a0: number, a1: number, b0: number, b1: number, h: number, y = 0) => {
    const w = Math.max(0.2, a1 - a0);
    const d = Math.max(0.2, b1 - b0);
    scene.add(box(w, h, d, wall, (a0 + a1) / 2, y + h / 2, (b0 + b1) / 2));
  };
  // Mur ouest (la télé) et mur sud (contre la cour) : pleins.
  piece(x0 - 0.1, x0 + 0.1, z0, z1, H);
  piece(x0, x1, z1 - 0.1, z1 + 0.1, H);
  // Façades nord (rue du milieu) et est (terrasse d'entrée) : laissées basses, comme une maquette en
  // coupe, pour voir la salle depuis la place. Les portes gardent leur encadrement bleu.
  const low = 1.0;
  piece(x0, sideDoor.x0, z0 - 0.1, z0 + 0.1, low);
  piece(sideDoor.x1, x1, z0 - 0.1, z0 + 0.1, low);
  piece(x1 - 0.1, x1 + 0.1, z0, mainDoor.z0, low);
  piece(x1 - 0.1, x1 + 0.1, mainDoor.z1, z1, low);
  for (const z of [z0, mainDoor.z0, mainDoor.z1, z1]) scene.add(box(0.12, H, 0.12, trim, x1, H / 2, z));
  scene.add(box(0.12, H, 0.12, trim, x0, H / 2, z0));
  scene.add(box(0.14, 0.14, mainDoor.z1 - mainDoor.z0 + 0.2, trim, x1, H, 0));
  for (const x of [sideDoor.x0, sideDoor.x1]) scene.add(box(0.12, 2.25, 0.24, trim, x, 1.12, z0));
  scene.add(box(sideDoor.x1 - sideDoor.x0 + 0.2, 0.14, 0.24, trim, (sideDoor.x0 + sideDoor.x1) / 2, 2.25, z0));
  // Enseigne au-dessus de l'entrée principale, tournée vers la place.
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshStandardMaterial({ map: garageSign(), roughness: 0.6 }));
  sign.rotation.y = Math.PI / 2;
  sign.position.set(x1 + 0.16, H + 0.45, 0);
  scene.add(sign);
  scene.add(box(0.08, 0.9, 2.7, mat(0x1d1f22), x1 + 0.1, H + 0.45, 0));
}

/** La terrasse d'entrée : 2 m de large, 20 cm plus haut que la place, carrelée, avec sa marche. */
function entryTerrace(scene: THREE.Scene) {
  const t = GARAGE.entryTerrace;
  const tiles = new THREE.MeshStandardMaterial({ map: terrazzo('#c9bfae', [2, 6]), roughness: 0.6 });
  scene.add(box(t.x1 - t.x0, t.height, t.z1 - t.z0, tiles, (t.x0 + t.x1) / 2, t.height / 2, (t.z0 + t.z1) / 2));
  // Bordure en pierre côté place.
  scene.add(
    box(0.12, t.height + 0.02, t.z1 - t.z0, mat(0xb9b3a7, { roughness: 0.85 }), t.x1 - 0.06, (t.height + 0.02) / 2, (t.z0 + t.z1) / 2),
  );
}

/** Le comptoir, le long du mur nord ; Khalifa est derrière, dos au mur. */
function counter(scene: THREE.Scene) {
  const { counter: c, room } = GARAGE;
  const length = c.x1 - c.x0;
  const mid = (c.x0 + c.x1) / 2;
  scene.add(box(length, 1.0, c.depth, MATERIALS.wood, mid, 0.5, c.z));
  scene.add(box(length + 0.05, 0.06, c.depth + 0.1, MATERIALS.marble, mid, 1.03, c.z));
  // Machine à café et tasses.
  scene.add(box(0.7, 0.42, 0.5, MATERIALS.metal, c.x1 - 0.5, 1.27, c.z - 0.05));
  scene.add(box(0.62, 0.1, 0.46, MATERIALS.black, c.x1 - 0.5, 1.53, c.z - 0.05));
  for (let i = 0; i < 6; i++) scene.add(cylinder(0.045, 0.038, 0.07, MATERIALS.white, c.x0 + 0.2 + i * 0.13, 1.1, c.z + 0.15, 10));
  // Étagères avec des bouteilles, contre le mur nord derrière Khalifa.
  for (const y of [1.4, 1.9]) {
    scene.add(box(length, 0.04, 0.25, MATERIALS.darkWood, mid, y, room.z0 + 0.2));
    for (let i = 0; i < 5; i++) {
      const color = [0xc8732a, 0x2f6b3a, 0xe8e0d0, 0x8a1f1f][i % 4]!;
      scene.add(cylinder(0.04, 0.04, 0.24, mat(color, { roughness: 0.3 }), c.x0 + 0.2 + i * 0.36, y + 0.14, room.z0 + 0.2, 8));
    }
  }
}

/** Les WC, dans le coin nord-ouest : une petite pièce, sa porte vers la salle et son panneau. */
function toilets(scene: THREE.Scene) {
  const t = GARAGE.toilets;
  const wall = mat(0xd9d4ca);
  const h = 2.3;
  scene.add(box(0.1, h, t.z1 - t.z0, wall, t.x1, h / 2, (t.z0 + t.z1) / 2));
  // Mur côté salle, avec la porte (fermée) au milieu.
  const doorW = 0.75;
  const doorX = (t.x0 + t.x1) / 2;
  scene.add(box(doorX - doorW / 2 - t.x0, h, 0.1, wall, (t.x0 + doorX - doorW / 2) / 2, h / 2, t.z1));
  scene.add(box(t.x1 - (doorX + doorW / 2), h, 0.1, wall, (doorX + doorW / 2 + t.x1) / 2, h / 2, t.z1));
  scene.add(box(doorW, h - 2.0, 0.1, wall, doorX, 2.0 + (h - 2.0) / 2, t.z1));
  scene.add(box(doorW, 2.0, 0.06, mat(0x7a4a2a), doorX, 1.0, t.z1));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.14), new THREE.MeshStandardMaterial({ map: wcSign(), roughness: 0.6 }));
  sign.position.set(doorX, 1.65, t.z1 + 0.035);
  scene.add(sign);
  scene.add(cylinder(0.17, 0.15, 0.4, MATERIALS.white, t.x0 + 0.4, 0.2, t.z0 + 0.4, 12));
}

/** La télé, au mur ouest : le match. */
function television(scene: THREE.Scene) {
  const { tv, room } = GARAGE;
  const screen = canvasTexture(256, 144, (ctx) => {
    ctx.fillStyle = '#2f8a3a';
    ctx.fillRect(0, 0, 256, 144);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 236, 124);
    ctx.beginPath();
    ctx.moveTo(128, 10);
    ctx.lineTo(128, 134);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(128, 72, 20, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(150, 60, 5, 5);
  });
  const height = tv.width * 0.56;
  scene.add(box(0.08, height + 0.08, tv.width + 0.08, MATERIALS.black, room.x0 + 0.14, tv.y, tv.z));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(tv.width, height), new THREE.MeshBasicMaterial({ map: screen }));
  panel.rotation.y = Math.PI / 2;
  panel.position.set(room.x0 + 0.19, tv.y, tv.z);
  scene.add(panel);
}

/**
 * Volkswagen Polo 3 vert pistache, en formes simples : petite citadine à hayon (l'avant vers +z avant
 * rotation), pare-chocs gris, phares, vitres teintées, roues.
 */
function polo3(): THREE.Group {
  const car = new THREE.Group();
  const paint = mat(0x9cc96b, { roughness: 0.35, metalness: 0.25 });
  const glass = mat(0x2c3a44, { roughness: 0.1, metalness: 0.3 });
  const trim = mat(0x55595e, { roughness: 0.6 });
  // Caisse (3,75 m × 1,65 m), capot plongeant à l'avant.
  car.add(box(1.64, 0.5, 3.6, paint, 0, 0.55, 0));
  const hood = box(1.6, 0.12, 0.95, paint, 0, 0.8, 1.25);
  hood.rotation.x = 0.12;
  car.add(hood);
  // Habitacle : pare-brise incliné, toit, hayon presque vertical à l'arrière.
  car.add(box(1.5, 0.5, 1.75, paint, 0, 1.05, -0.35));
  const windshield = box(1.42, 0.5, 0.06, glass, 0, 1.03, 0.6);
  windshield.rotation.x = -0.75;
  car.add(windshield);
  car.add(box(1.52, 0.34, 1.5, glass, 0, 1.08, -0.38));
  car.add(box(1.4, 0.36, 0.05, glass, 0, 1.08, -1.24));
  // Pare-chocs, phares et feux, rétroviseurs.
  for (const z of [1.82, -1.82]) car.add(box(1.68, 0.2, 0.12, trim, 0, 0.38, z));
  for (const x of [-0.55, 0.55]) {
    car.add(box(0.36, 0.14, 0.04, mat(0xfff6d8, { emissive: 0x332f20 }), x, 0.66, 1.81));
    car.add(box(0.26, 0.16, 0.04, mat(0xb32020), x * 1.15, 0.7, -1.81));
    car.add(box(0.1, 0.08, 0.14, paint, x * 1.62, 0.98, 0.45));
  }
  for (const [x, z] of [
    [-0.8, 1.2],
    [0.8, 1.2],
    [-0.8, -1.15],
    [0.8, -1.15],
  ] as const) {
    const wheel = cylinder(0.3, 0.3, 0.2, MATERIALS.black, x, 0.3, z, 14);
    wheel.rotation.z = Math.PI / 2;
    car.add(wheel);
    const hub = cylinder(0.14, 0.14, 0.21, MATERIALS.metal, x, 0.3, z, 10);
    hub.rotation.z = Math.PI / 2;
    car.add(hub);
  }
  return car;
}

/** Un client assis : sur la chaise, tourné vers sa table. */
function seatPerson(scene: THREE.Scene, person: Person, x: number, z: number, rotation: number) {
  person.sit();
  person.root.position.set(x, 0, z);
  person.root.rotation.y = rotation;
  scene.add(person.root);
}

export function createGarageScene(container: HTMLElement, labelLayer: HTMLElement): GarageSceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.className = 'cafe__canvas';

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d2219, 26, 48);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 90);
  camera.position.set(...GARAGE_VIEW.camera);

  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a2a1c, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2b8, 1.6);
  key.position.set(9, 15, 6);
  key.target.position.set(0, 0, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  Object.assign(key.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13, near: 1, far: 45 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);
  // Ampoules au-dessus des tables de la salle.
  const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffc46b, emissiveIntensity: 1.5 });
  const lamps: THREE.PointLight[] = [];
  for (const [x, z] of [
    [2.6, 2.4],
    [-2.6, 2.6],
    [1.8, -2.7],
    [-3.5, -2.6],
  ] as const) {
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), bulbMaterial);
    bulb.position.set(x, 2.45, z);
    scene.add(bulb, cylinder(0.005, 0.005, 0.45, MATERIALS.black, x, 2.7, z, 4));
    const light = new THREE.PointLight(0xffc98a, 5, 7, 1.6);
    light.position.set(x, 2.35, z);
    scene.add(light);
    lamps.push(light);
  }

  /* -------------------------------- Le décor -------------------------------- */

  const asphalt = mat(0x55585b, { roughness: 1 });
  ground(scene, asphalt);
  neighbours(scene);
  const { room } = GARAGE;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(room.x1 - room.x0, room.z1 - room.z0),
    new THREE.MeshStandardMaterial({ map: terrazzo('#b9b2a6', [4, 3]), roughness: 0.55 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((room.x0 + room.x1) / 2, 0.01, (room.z0 + room.z1) / 2);
  scene.add(floor);
  walls(scene);
  entryTerrace(scene);
  counter(scene);
  toilets(scene);
  television(scene);
  // Le poteau au milieu de la salle.
  const { pillar } = GARAGE;
  scene.add(
    box(
      pillar.size,
      GARAGE.wallHeight,
      pillar.size,
      new THREE.MeshStandardMaterial({ map: plaster([1, 3]), roughness: 0.9 }),
      pillar.x,
      GARAGE.wallHeight / 2,
      pillar.z,
    ),
  );
  scene.add(box(pillar.size + 0.04, 0.12, pillar.size + 0.04, MATERIALS.baseboard, pillar.x, 0.06, pillar.z));
  // Plantes : dans la salle et aux deux bouts de la terrasse d'entrée.
  for (const [x, z, y] of [
    [3.5, 4.0, 0],
    [-5.6, 4.0, 0],
    [5.6, -4.1, GARAGE.entryTerrace.height],
    [5.6, 4.1, GARAGE.entryTerrace.height],
  ] as const)
    scene.add(plant(x, y, z, 0.85));

  // La place : une Volkswagen Polo 3 vert pistache garée au coin du café, la plaque de la place et un lampadaire.
  const car = polo3();
  car.position.set(7.3, 0, 5.9);
  car.rotation.y = Math.PI / 2;
  scene.add(car);
  scene.add(cylinder(0.04, 0.04, 2.6, MATERIALS.metal, 16, 1.3, -2));
  const plate = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.52), new THREE.MeshStandardMaterial({ map: squareSign(), roughness: 0.6 }));
  plate.rotation.y = -Math.PI / 2;
  plate.position.set(15.94, 2.4, -2);
  scene.add(plate);
  const lampHead = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd08a, emissiveIntensity: 0 });
  scene.add(cylinder(0.05, 0.06, 3.4, MATERIALS.black, 11.5, 1.7, -4));
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lampHead);
  head.position.set(11.5, 3.45, -4);
  scene.add(head);
  const streetLight = new THREE.PointLight(0xffd08a, 0, 10, 1.4);
  streetLight.position.set(11.5, 3.3, -4);
  scene.add(streetLight);

  /* ------------------------------- Les tables ------------------------------- */

  const labels: { el: HTMLElement; anchor: THREE.Vector3 }[] = [];
  // Les 2 tables de belote : vides, elles attendent l'ouverture du jeu en ligne.
  GARAGE_BELOTE_TABLES.forEach((t, i) => {
    scene.add(squareTable(0.95, t.x, 0, t.z));
    for (const side of SEAT_SIDES) {
      const { dx, dz, rotation } = seatOffset(side, 0.68);
      scene.add(chair(t.x + dx, 0, t.z + dz, rotation));
    }
    const label = document.createElement('div');
    label.className = 'cafe-label cafe-label--locked';
    label.innerHTML = `<span class="cafe-label__title">Table ${i + 1}</span><span class="cafe-label__status" lang="ar">مازلنا مسكرين</span>`;
    labelLayer.appendChild(label);
    labels.push({ el: label, anchor: new THREE.Vector3(t.x, 0.95, t.z) });
  });

  const players: { person: Person; turn: number; players: number }[] = [];
  const talkers: { person: Person; offset: number }[] = [];
  const people: THREE.Object3D[] = [];
  let spec = 40;
  const customer = () => {
    const p = createPerson(customerSpec(spec++));
    people.push(p.root);
    return p;
  };

  // Petites tables de la salle (chaises au nord et au sud).
  GARAGE_SMALL_TABLES.forEach((t, i) => {
    scene.add(squareTable(0.7, t.x, 0, t.z));
    scene.add(chair(t.x, 0, t.z + 0.55, 0));
    scene.add(chair(t.x, 0, t.z - 0.55, Math.PI));
    if (i === 2) {
      // Un vieil habitué seul avec son café.
      seatPerson(scene, customer(), t.x, t.z + 0.55, Math.PI);
      const cup = drinkModel('express');
      cup.position.set(t.x, TABLE_TOP, t.z + 0.2);
      scene.add(cup);
      return;
    }
    const a = customer();
    const b = customer();
    seatPerson(scene, a, t.x, t.z + 0.55, Math.PI);
    seatPerson(scene, b, t.x, t.z - 0.55, 0);
    if (i === 0) {
      const cards = cardsOnTable(2);
      cards.position.set(t.x, TABLE_TOP, t.z);
      scene.add(cards);
      players.push({ person: a, turn: 0, players: 2 }, { person: b, turn: 1, players: 2 });
    } else {
      for (const [drink, dz] of [
        ['tey', 0.2],
        ['capucin', -0.2],
      ] as const) {
        const model = drinkModel(drink);
        model.position.set(t.x, TABLE_TOP, t.z + dz);
        scene.add(model);
      }
      talkers.push({ person: a, offset: 0 }, { person: b, offset: 2.4 });
    }
  });

  // Dehors : 4 tables laissées sur la place, devant la terrasse d'entrée (chaises à l'est et à l'ouest).
  GARAGE_PLACE_TABLES.forEach((t, i) => {
    scene.add(squareTable(0.7, t.x, 0, t.z));
    scene.add(chair(t.x + 0.55, 0, t.z, Math.PI / 2));
    scene.add(chair(t.x - 0.55, 0, t.z, -Math.PI / 2));
    if (i === 2) {
      seatPerson(scene, customer(), t.x - 0.55, t.z, Math.PI / 2);
      const glass = drinkModel('tey');
      glass.position.set(t.x - 0.18, TABLE_TOP, t.z);
      scene.add(glass);
      return;
    }
    const a = customer();
    const b = customer();
    seatPerson(scene, a, t.x + 0.55, t.z, -Math.PI / 2);
    seatPerson(scene, b, t.x - 0.55, t.z, Math.PI / 2);
    if (i === 1) {
      // Une chicha pour deux.
      const { kit } = seatedChicha();
      kit.position.set(t.x - 0.55, 0, t.z);
      kit.rotation.y = Math.PI / 2;
      scene.add(kit);
      talkers.push({ person: a, offset: 1.1 }, { person: b, offset: 3.3 });
    } else {
      const cards = cardsOnTable(2);
      cards.position.set(t.x, TABLE_TOP, t.z);
      scene.add(cards);
      players.push({ person: a, turn: 0, players: 2 }, { person: b, turn: 1, players: 2 });
    }
  });

  /* ------------------------------ Khalifa, Rochdi ------------------------------ */

  const khalifa = createPerson(KHALIFA);
  khalifa.walk(0, 0);
  khalifa.root.position.set(KHALIFA_SPOT.x, 0, KHALIFA_SPOT.z);
  khalifa.root.rotation.y = 0;
  scene.add(khalifa.root);
  const rochdi = createPerson(ROCHDI);
  const rochdiTray = tray();
  rochdiTray.position.set(0.22, 1.0, 0.36);
  rochdi.root.add(rochdiTray);
  scene.add(rochdi.root);
  // Toujours pressé : il marche presque deux fois plus vite que les serveurs du Café Tarek.
  const rochdiWalk = new Walker(rochdi, ROCHDI_ROUND, 1.65, garageGroundAt);

  scene.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    object.castShadow = !(object.material as THREE.Material).transparent;
    object.receiveShadow = true;
  });
  // Les clients ne projettent pas d'ombre : moins de calcul pour le téléphone.
  for (const p of people) p.traverse((o) => (o.castShadow = false));

  /* ---------------------------- Caméra et lumière ---------------------------- */

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...GARAGE_VIEW.target);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  controls.minDistance = 6;
  controls.maxDistance = 22;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = 1.2;
  controls.rotateSpeed = 0.7;
  controls.update();

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
    asphalt.color.setHex(a.street);
    lampHead.emissiveIntensity = a.streetLights ? 2.5 : 0;
    streetLight.intensity = a.streetLights ? 7 : 0;
  };
  applyAmbiance(ambianceAt(currentHour(new Date(), window.location.search)));
  const ambianceTimer = setInterval(() => applyAmbiance(ambianceAt(currentHour(new Date(), window.location.search))), 60_000);

  let width = 1;
  let height = 1;
  const resize = () => {
    width = container.clientWidth || 1;
    height = container.clientHeight || 1;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.fov = width < height ? 58 : 46;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const projected = new THREE.Vector3();
  const placeLabels = () => {
    for (const { el, anchor } of labels) {
      projected.copy(anchor).project(camera);
      const visible = projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      el.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const x = ((projected.x + 1) / 2) * width;
      const y = ((1 - projected.y) / 2) * height;
      el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px) translate(-50%, -50%)`;
    }
  };

  let frame = 0;
  let last = performance.now();
  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    // Environ 30 images par seconde suffisent (économie de batterie).
    if (now - last < 33) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    rochdiWalk.update(now, dt);
    rochdi.carry();
    // Khalifa, derrière son comptoir : il se balance, sert un café de temps en temps.
    khalifa.walk(0, 0);
    const pour = t % 6;
    if (pour < 1.4) khalifa.raiseArm(0.35 * Math.sin((pour / 1.4) * Math.PI));
    khalifa.root.rotation.y = 0.12 * Math.sin(t * 0.4);
    for (const s of players) {
      const slot = 1.5;
      const active = Math.floor(t / slot) % s.players === s.turn;
      s.person.raiseArm(active ? 0.32 * Math.sin(((t % slot) / slot) * Math.PI) : 0);
    }
    for (const s of talkers) {
      const cycle = (t + s.offset) % 5;
      s.person.raiseArm(cycle < 1.1 ? 0.35 * Math.sin((cycle / 1.1) * Math.PI) : 0);
    }
    controls.update();
    renderer.render(scene, camera);
    placeLabels();
  };
  frame = requestAnimationFrame(loop);

  return {
    dispose() {
      cancelAnimationFrame(frame);
      clearInterval(ambianceTimer);
      observer.disconnect();
      controls.dispose();
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
