import * as THREE from 'three';
import { MATERIALS, box, canvasTexture, chair, cylinder, mat, plant, plaster, squareTable, terrazzo, wcSign } from './cafeScene.ts';
import { SEAT_SIDES, seatOffset } from './cafeLayout.ts';
import { NIZAR, Walker, createPerson, customerSpec, tray } from './characters.ts';
import type { Person } from './characters.ts';
import {
  CHOUAA,
  CHOUAA_ESTRADE_TABLES,
  CHOUAA_TABLES,
  CHOUAA_VIEW,
  CHOUAA_WINDOW_TABLES,
  NIZAR_ROUND,
  chouaaGroundAt,
} from './chouaaLayout.ts';
import { cardsOnTable } from './crowd.ts';
import { drinkModel } from './tableProps.ts';
import { createVisitStage } from './visitStage.ts';

/**
 * Le Café Chouâa (قهوة الشعاع) en 3D, pour la visite (on n'y joue pas encore), d'après la maquette
 * « rayon.ifc » : une grande salle au coin de deux rues, l'entrée principale sur la rue principale,
 * la porte d'angle dans le pan coupé, 8 petites fenêtres sur la rue de côté, 4 poteaux, et au fond
 * l'estrade avec le comptoir en L et les WC. Nizar, le serveur, fait sa tournée.
 */
export interface ChouaaSceneHandle {
  dispose(): void;
}

const TABLE_TOP = 0.776;
/** Les encadrements des portes et des fenêtres : ocre, comme un rayon de soleil (الشعاع). */
const TRIM = 0xd08a1e;

/** Enseigne au-dessus de l'entrée principale : un soleil levant et le nom. */
const chouaaSign = () =>
  canvasTexture(512, 160, (ctx) => {
    ctx.fillStyle = '#1f3d5c';
    ctx.fillRect(0, 0, 512, 160);
    ctx.strokeStyle = '#f2b632';
    ctx.lineWidth = 8;
    ctx.strokeRect(8, 8, 496, 144);
    // Le soleil, à gauche, avec ses rayons.
    ctx.fillStyle = '#f2b632';
    ctx.beginPath();
    ctx.arc(78, 112, 34, Math.PI, 0);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#f2b632';
    for (let i = 0; i <= 6; i++) {
      const a = Math.PI + (i / 6) * Math.PI;
      ctx.beginPath();
      ctx.moveTo(78 + Math.cos(a) * 44, 112 + Math.sin(a) * 44);
      ctx.lineTo(78 + Math.cos(a) * 62, 112 + Math.sin(a) * 62);
      ctx.stroke();
    }
    ctx.fillStyle = '#fff3d6';
    ctx.textAlign = 'center';
    ctx.font = 'bold 64px "Cairo Variable", "Noto Naskh Arabic", sans-serif';
    ctx.fillText('قهوة الشعاع', 300, 82);
    ctx.font = 'italic 600 28px Georgia, serif';
    ctx.fillText('Café Chouâa', 300, 132);
  });

/** La rue principale (au sud) et la rue de côté (à l'est), leurs trottoirs et leur marquage. */
function streets(scene: THREE.Scene, asphalt: THREE.Material) {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), asphalt);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.02;
  scene.add(ground);
  const { sidewalk, sideSidewalk, room, mainStreet, sideStreet } = CHOUAA;
  const curb = mat(0xb9b2a4, { roughness: 0.95 });
  const h = sidewalk.height;
  const westEnd = room.x0 - 3.2;
  scene.add(box(sideSidewalk.x1 - westEnd, h, sidewalk.z1 - sidewalk.z0, curb, (westEnd + sideSidewalk.x1) / 2, h / 2, (sidewalk.z0 + sidewalk.z1) / 2));
  scene.add(
    box(sideSidewalk.x1 - sideSidewalk.x0, h, sidewalk.z0 - (room.z0 - 0.1), curb, (sideSidewalk.x0 + sideSidewalk.x1) / 2, h / 2, (sidewalk.z0 + room.z0 - 0.1) / 2),
  );
  // Trottoirs d'en face (au sud de la rue principale, à l'est de la rue de côté).
  scene.add(box(44, h, 1.5, curb, 0, h / 2, mainStreet.z1 + 0.75));
  scene.add(box(1.5, h, mainStreet.z0 + 22, curb, sideStreet.x1 + 0.75, h / 2, (mainStreet.z0 - 22) / 2));
  // Pointillés au milieu des deux rues.
  const paint = mat(0xe9e4d6, { roughness: 0.8 });
  const midMain = (mainStreet.z0 + mainStreet.z1) / 2;
  for (let x = -20; x < 22; x += 3) if (x < sideStreet.x0 - 1 || x > sideStreet.x1 + 1) scene.add(box(1.4, 0.01, 0.12, paint, x, 0, midMain));
  const midSide = (sideStreet.x0 + sideStreet.x1) / 2;
  for (let z = -20; z < mainStreet.z0 - 1; z += 3) scene.add(box(0.12, 0.01, 1.4, paint, midSide, 0, z));
}

/** Les maisons autour : le voisin collé au mur ouest, le pâté derrière, et en face des deux rues. */
function neighbours(scene: THREE.Scene) {
  const facades = [mat(0xe2d6bf), mat(0xd6c7aa), mat(0xeadfca), mat(0xcdbb9c)].map((m) => {
    m.roughness = 0.95;
    return m;
  });
  const { neighbour: n, mainStreet, sideStreet, room } = CHOUAA;
  const blocks: [number, number, number, number, number][] = [
    // x0, x1, z0, z1, hauteur
    [n.x0, n.x1, n.z0, n.z1, n.height], // le voisin de la maquette, collé au café
    [-22, n.x0, n.z0, n.z1, 3.4],
    [-22, CHOUAA.sideSidewalk.x0, -15, room.z0 - 0.1, 3.3], // derrière le café
    [-22, 22, mainStreet.z1 + 1.5, 24, 3.2], // en face, de l'autre côté de la rue principale
    [sideStreet.x1 + 1.5, 22, -15, mainStreet.z0 - 1.5, 3.6], // en face, de l'autre côté de la rue de côté
  ];
  blocks.forEach(([x0, x1, z0, z1, h], i) =>
    scene.add(box(x1 - x0, h, z1 - z0, facades[i % facades.length]!, (x0 + x1) / 2, h / 2, (z0 + z1) / 2)),
  );
}

/** Un mur droit entre deux points (vu de dessus), d'une hauteur donnée. */
function wallBetween(scene: THREE.Scene, material: THREE.Material, ax: number, az: number, bx: number, bz: number, h: number, y = 0, thickness = 0.2) {
  const length = Math.hypot(bx - ax, bz - az);
  const piece = box(length, h, thickness, material, (ax + bx) / 2, y + h / 2, (az + bz) / 2);
  piece.rotation.y = -Math.atan2(bz - az, bx - ax);
  scene.add(piece);
  return piece;
}

/**
 * Les murs : le fond et le mur ouest pleins ; le mur est (rue de côté) avec ses 8 petites fenêtres ;
 * la façade sud et le pan coupé laissés bas, comme une maquette en coupe, pour voir la salle depuis la rue.
 */
function walls(scene: THREE.Scene) {
  const { room, wallHeight: H, wallThickness: T, mainDoor, cornerDoor, eastWallEnd, eastWindows, southWindows, window: w } = CHOUAA;
  const { x0, x1, z0, z1 } = room;
  const wall = new THREE.MeshStandardMaterial({ map: plaster([3, 1]), roughness: 0.9 });
  const trim = mat(TRIM, { roughness: 0.6 });
  const frame = mat(0xb9bcbf, { metalness: 0.5, roughness: 0.4 });
  const sill = mat(0xe9e4da, { roughness: 0.5 });
  // Le fond (nord) et le mur ouest, contre le voisin.
  scene.add(box(x1 - x0 + 2 * T, H, T, wall, (x0 + x1) / 2, H / 2, z0 - T / 2));
  scene.add(box(T, H, z1 - z0 + 2 * T, wall, x0 - T / 2, H / 2, (z0 + z1) / 2));

  // Le mur est, sur la rue de côté : bandeaux sous et au-dessus des fenêtres, trumeaux entre elles.
  const ex = x1 + T / 2;
  const eastStart = z0 - T;
  scene.add(box(T, w.sill, eastWallEnd - eastStart, wall, ex, w.sill / 2, (eastStart + eastWallEnd) / 2));
  scene.add(box(T, H - w.top, eastWallEnd - eastStart, wall, ex, (w.top + H) / 2, (eastStart + eastWallEnd) / 2));
  const edges = [eastStart, ...[...eastWindows].sort((a, b) => a - b).flatMap((z) => [z - w.width / 2, z + w.width / 2]), eastWallEnd];
  for (let i = 0; i < edges.length; i += 2) {
    const a = edges[i]!;
    const b = edges[i + 1]!;
    scene.add(box(T, w.top - w.sill, b - a, wall, ex, (w.sill + w.top) / 2, (a + b) / 2));
  }
  for (const z of eastWindows) {
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(w.width, w.top - w.sill), MATERIALS.glass);
    glass.rotation.y = Math.PI / 2;
    glass.position.set(ex, (w.sill + w.top) / 2, z);
    scene.add(glass);
    // Cadre en aluminium et appui.
    for (const dz of [-w.width / 2, w.width / 2]) scene.add(box(T + 0.04, w.top - w.sill, 0.04, frame, ex, (w.sill + w.top) / 2, z + dz));
    scene.add(box(T + 0.04, 0.04, w.width, frame, ex, w.top, z));
    scene.add(box(T + 0.12, 0.04, w.width + 0.1, sill, ex + 0.04, w.sill, z));
  }

  // La façade sud, sur la rue principale : basse (1 m), échancrée aux 2 fenêtres, ouverte à l'entrée principale.
  const low = 1.0;
  const sz = z1 + T / 2;
  const southEdges = [x0 - T, ...[...southWindows].sort((a, b) => a - b).flatMap((x) => [x - w.width / 2, x + w.width / 2]), mainDoor.x0];
  for (let i = 0; i < southEdges.length; i += 2) {
    const a = southEdges[i]!;
    const b = southEdges[i + 1]!;
    scene.add(box(b - a, low, T, wall, (a + b) / 2, low / 2, sz));
  }
  for (const x of southWindows) {
    scene.add(box(w.width, w.sill, T, wall, x, w.sill / 2, sz));
    scene.add(box(w.width + 0.1, 0.04, T + 0.12, sill, x, w.sill, sz + 0.04));
  }
  // Entre l'entrée principale et le pan coupé, puis les deux petits murs en biais du pan coupé.
  scene.add(box(5.0 - mainDoor.x1, low, T, wall, (mainDoor.x1 + 5.0) / 2, low / 2, sz));
  wallBetween(scene, wall, 4.95, sz, cornerDoor.a.x, cornerDoor.a.z, low);
  wallBetween(scene, wall, cornerDoor.b.x, cornerDoor.b.z, ex, eastWallEnd, low);

  // Encadrements des deux portes (ocre), toute hauteur, et l'enseigne au-dessus de l'entrée principale.
  for (const x of [mainDoor.x0, mainDoor.x1]) scene.add(box(0.14, H, 0.24, trim, x, H / 2, sz));
  scene.add(box(mainDoor.x1 - mainDoor.x0 + 0.14, 0.16, 0.24, trim, (mainDoor.x0 + mainDoor.x1) / 2, H - 0.08, sz));
  for (const p of [cornerDoor.a, cornerDoor.b]) scene.add(box(0.14, 2.3, 0.14, trim, p.x, 1.15, p.z));
  wallBetween(scene, trim, cornerDoor.a.x, cornerDoor.a.z, cornerDoor.b.x, cornerDoor.b.z, 0.16, 2.22, 0.18);
  const doorMid = (mainDoor.x0 + mainDoor.x1) / 2;
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.8), new THREE.MeshStandardMaterial({ map: chouaaSign(), roughness: 0.6 }));
  sign.position.set(doorMid, H + 0.45, sz + 0.16);
  scene.add(sign);
  scene.add(box(2.7, 0.9, 0.08, mat(0x1d1f22), doorMid, H + 0.45, sz + 0.1));
}

/** L'estrade du fond (25 cm), carrelée plus clair, avec son nez de marche en pierre. */
function estrade(scene: THREE.Scene) {
  const { room, estrade: e } = CHOUAA;
  const tiles = new THREE.MeshStandardMaterial({ map: terrazzo('#d4c6ab', [6, 2]), roughness: 0.6 });
  scene.add(box(room.x1 - room.x0, e.height, e.z1 - e.z0, tiles, (room.x0 + room.x1) / 2, e.height / 2, (e.z0 + e.z1) / 2));
  scene.add(box(room.x1 - room.x0, e.height + 0.01, 0.1, mat(0xb9b3a7, { roughness: 0.85 }), (room.x0 + room.x1) / 2, (e.height + 0.01) / 2, e.z1 - 0.05));
}

/** Le comptoir en L sur l'estrade, la machine à café derrière, les étagères au mur du fond. */
function counter(scene: THREE.Scene) {
  const { counter: c, estrade: e, room } = CHOUAA;
  const y = e.height;
  for (const part of [c.front, c.back]) {
    const w = part.x1 - part.x0;
    const d = part.z1 - part.z0;
    const cx = (part.x0 + part.x1) / 2;
    const cz = (part.z0 + part.z1) / 2;
    scene.add(box(w, c.height - 0.05, d, MATERIALS.wood, cx, y + (c.height - 0.05) / 2, cz));
    scene.add(box(w + 0.04, 0.05, d + 0.04, MATERIALS.marble, cx, y + c.height - 0.025, cz));
  }
  // Une frise ocre sur la face du comptoir, côté salle.
  scene.add(box(c.front.x1 - c.front.x0, 0.12, 0.02, mat(TRIM), (c.front.x0 + c.front.x1) / 2, y + 0.75, c.front.z1 + 0.01));
  // Tasses sur le comptoir.
  for (let i = 0; i < 7; i++) scene.add(cylinder(0.045, 0.038, 0.07, MATERIALS.white, c.front.x0 + 0.6 + i * 0.16, y + c.height + 0.035, c.front.z0 + 0.25, 10));
  // Le meuble du fond, contre le mur : la machine à café, le moulin, les étagères avec les bouteilles.
  const backZ = room.z0 + 0.3;
  scene.add(box(3.6, 0.9, 0.55, MATERIALS.darkWood, 4.2, y + 0.45, backZ));
  scene.add(box(0.8, 0.45, 0.5, MATERIALS.metal, 3.6, y + 1.12, backZ));
  scene.add(box(0.72, 0.1, 0.46, MATERIALS.black, 3.6, y + 1.4, backZ));
  scene.add(cylinder(0.1, 0.12, 0.42, MATERIALS.black, 4.4, y + 1.11, backZ, 10));
  for (const shelfY of [1.65, 2.1]) {
    scene.add(box(3.6, 0.04, 0.25, MATERIALS.darkWood, 4.2, y + shelfY, room.z0 + 0.13));
    for (let i = 0; i < 7; i++) {
      const color = [0xc8732a, 0x2f6b3a, 0xe8e0d0, 0x8a1f1f][i % 4]!;
      scene.add(cylinder(0.04, 0.04, 0.24, mat(color, { roughness: 0.3 }), 2.65 + i * 0.5, y + shelfY + 0.14, room.z0 + 0.13, 8));
    }
  }
}

/** Les WC, dans le coin nord-ouest : leur porte donne sur la salle. */
function toilets(scene: THREE.Scene) {
  const t = CHOUAA.toilets;
  const wall = mat(0xd9d4ca);
  const h = t.height;
  scene.add(box(0.1, h, t.z1 - t.z0, wall, t.x1, h / 2, (t.z0 + t.z1) / 2));
  const doorW = 0.75;
  const doorX = (t.x0 + t.x1) / 2;
  scene.add(box(doorX - doorW / 2 - t.x0, h, 0.1, wall, (t.x0 + doorX - doorW / 2) / 2, h / 2, t.z1));
  scene.add(box(t.x1 - (doorX + doorW / 2), h, 0.1, wall, (doorX + doorW / 2 + t.x1) / 2, h / 2, t.z1));
  scene.add(box(doorW, h - 2.0, 0.1, wall, doorX, 2.0 + (h - 2.0) / 2, t.z1));
  scene.add(box(doorW, 2.0, 0.06, mat(0x7a4a2a), doorX, 1.0, t.z1));
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.14), new THREE.MeshStandardMaterial({ map: wcSign(), roughness: 0.6 }));
  sign.position.set(doorX, 1.65, t.z1 + 0.035);
  scene.add(sign);
}

/** La télé, au mur du fond, au-dessus de l'estrade : le match. */
function television(scene: THREE.Scene) {
  const { tv, room } = CHOUAA;
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
    ctx.fillRect(96, 80, 5, 5);
  });
  const height = tv.width * 0.56;
  scene.add(box(tv.width + 0.08, height + 0.08, 0.08, MATERIALS.black, tv.x, tv.y, room.z0 + 0.06));
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(tv.width, height), new THREE.MeshBasicMaterial({ map: screen }));
  panel.position.set(tv.x, tv.y, room.z0 + 0.11);
  scene.add(panel);
}

/** Un client assis : sur la chaise, tourné vers sa table. */
function seatPerson(scene: THREE.Scene, person: Person, x: number, y: number, z: number, rotation: number) {
  person.sit();
  person.root.position.set(x, y, z);
  person.root.rotation.y = rotation;
  scene.add(person.root);
}

export function createChouaaScene(container: HTMLElement, labelLayer: HTMLElement): ChouaaSceneHandle {
  const stage = createVisitStage(container, labelLayer, { view: CHOUAA_VIEW, shadowExtent: 16, fog: [30, 56], distance: [7, 26] });
  const { scene } = stage;
  for (const t of [...CHOUAA_TABLES, ...CHOUAA_ESTRADE_TABLES]) stage.bulb(t.x, t.z);
  stage.bulb(5.2, -1.0);
  stage.bulb(5.2, 2.0);
  stage.bulb(3.6, -5.6);

  /* -------------------------------- Le décor -------------------------------- */

  streets(scene, stage.asphalt);
  neighbours(scene);
  const { room } = CHOUAA;
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(room.x1 - room.x0, room.z1 - room.z0),
    new THREE.MeshStandardMaterial({ map: terrazzo('#bdb4a4', [5, 6]), roughness: 0.55 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set((room.x0 + room.x1) / 2, 0.01, (room.z0 + room.z1) / 2);
  scene.add(floor);
  walls(scene);
  estrade(scene);
  counter(scene);
  toilets(scene);
  television(scene);
  // Les 4 poteaux porteurs, avec leur plinthe.
  const pillarMaterial = new THREE.MeshStandardMaterial({ map: plaster([1, 3]), roughness: 0.9 });
  const s = CHOUAA.pillarSize;
  for (const p of CHOUAA.pillars) {
    scene.add(box(s, CHOUAA.wallHeight, s, pillarMaterial, p.x, CHOUAA.wallHeight / 2, p.z));
    scene.add(box(s + 0.04, 0.12, s + 0.04, MATERIALS.baseboard, p.x, chouaaGroundAt(p.x, p.z + 0.2) + 0.06, p.z));
  }
  // Plantes : de chaque côté de l'entrée principale (sur le trottoir) et dans la salle.
  const sidewalkTop = CHOUAA.sidewalk.height;
  for (const [x, z, y] of [
    [CHOUAA.mainDoor.x0 - 0.45, 7.0, sidewalkTop],
    [CHOUAA.mainDoor.x1 + 0.45, 7.0, sidewalkTop],
    [-5.2, 5.9, 0],
    [5.75, 4.6, 0],
  ] as const)
    scene.add(plant(x, y, z, 0.85));
  stage.streetLamp(-2, 8.6);
  stage.streetLamp(8.4, -3);

  /* ------------------------------- Les clients ------------------------------- */

  const players: { person: Person; turn: number; players: number }[] = [];
  const talkers: { person: Person; offset: number }[] = [];
  let spec = 60;
  const customer = () => {
    const p = createPerson(customerSpec(spec++));
    stage.noShadow(p.root);
    return p;
  };

  // Les grandes tables : deux parties de cartes, deux amis autour d'un thé, une table libre.
  CHOUAA_TABLES.forEach((t, i) => {
    scene.add(squareTable(0.95, t.x, 0, t.z));
    SEAT_SIDES.forEach((side, seat) => {
      const { dx, dz, rotation } = seatOffset(side, 0.68);
      scene.add(chair(t.x + dx, 0, t.z + dz, rotation));
      const playing = i === 1 || i === 2;
      if (playing || (i === 0 && seat % 2 === 0)) {
        const person = customer();
        seatPerson(scene, person, t.x + dx, 0, t.z + dz, rotation + Math.PI);
        if (playing) players.push({ person, turn: seat, players: 4 });
        else talkers.push({ person, offset: seat * 1.3 });
      }
    });
    if (i === 1 || i === 2) {
      const cards = cardsOnTable(4);
      cards.position.set(t.x, TABLE_TOP, t.z);
      scene.add(cards);
    } else if (i === 0) {
      for (const [drink, dz] of [
        ['tey', 0.22],
        ['capucin', -0.22],
      ] as const) {
        const model = drinkModel(drink);
        model.position.set(t.x, TABLE_TOP, t.z + dz);
        scene.add(model);
      }
    }
  });
  // Un curieux debout qui regarde la partie près de l'entrée.
  const watcher = customer();
  watcher.walk(0, 0);
  watcher.root.position.set(-2.95, 0, 4.35);
  watcher.root.rotation.y = -2.3;
  scene.add(watcher.root);

  // Les petites tables des fenêtres (chaises au nord et au sud).
  CHOUAA_WINDOW_TABLES.forEach((t, i) => {
    scene.add(squareTable(0.7, t.x, 0, t.z));
    scene.add(chair(t.x, 0, t.z + 0.55, 0));
    scene.add(chair(t.x, 0, t.z - 0.55, Math.PI));
    if (i === 0) {
      // Un vieil habitué seul avec son café, il regarde la rue.
      seatPerson(scene, customer(), t.x, 0, t.z + 0.55, Math.PI);
      const cup = drinkModel('express');
      cup.position.set(t.x, TABLE_TOP, t.z + 0.2);
      scene.add(cup);
    } else if (i === 1) {
      const a = customer();
      const b = customer();
      seatPerson(scene, a, t.x, 0, t.z + 0.55, Math.PI);
      seatPerson(scene, b, t.x, 0, t.z - 0.55, 0);
      const glass = drinkModel('tey');
      glass.position.set(t.x, TABLE_TOP, t.z);
      scene.add(glass);
      talkers.push({ person: a, offset: 0.4 }, { person: b, offset: 2.8 });
    }
  });

  // Sur l'estrade, devant la télé : ils regardent le match (assis côté sud, tournés vers le mur du fond).
  const up = CHOUAA.estrade.height;
  CHOUAA_ESTRADE_TABLES.forEach((t, i) => {
    scene.add(squareTable(0.7, t.x, up, t.z));
    scene.add(chair(t.x, up, t.z + 0.55, 0));
    scene.add(chair(t.x, up, t.z - 0.55, Math.PI));
    seatPerson(scene, customer(), t.x, up, t.z + 0.55, Math.PI);
    const drink = drinkModel(i === 0 ? 'express' : 'tey');
    drink.position.set(t.x, up + TABLE_TOP, t.z + 0.15);
    scene.add(drink);
  });

  /* ---------------------------------- Nizar ---------------------------------- */

  const nizar = createPerson(NIZAR);
  const nizarTray = tray();
  nizarTray.position.set(0.22, 1.0, 0.36);
  nizar.root.add(nizarTray);
  scene.add(nizar.root);
  const nizarWalk = new Walker(nizar, NIZAR_ROUND, 1.2, chouaaGroundAt);

  /* ---------------------------- Animation ---------------------------- */

  stage.start((now, dt, t) => {
    nizarWalk.update(now, dt);
    nizar.carry();
    for (const p of players) {
      const slot = 1.5;
      const active = Math.floor(t / slot) % p.players === p.turn;
      p.person.raiseArm(active ? 0.32 * Math.sin(((t % slot) / slot) * Math.PI) : 0);
    }
    for (const p of talkers) {
      const cycle = (t + p.offset) % 5;
      p.person.raiseArm(cycle < 1.1 ? 0.35 * Math.sin((cycle / 1.1) * Math.PI) : 0);
    }
  });

  return { dispose: () => stage.dispose() };
}
