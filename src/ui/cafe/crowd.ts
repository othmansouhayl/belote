import * as THREE from 'three';
import { BELOTE_TABLES, CAFE, SEAT_SIDES, groundAt, seatOffset } from './cafeLayout.ts';
import { Walker, createPerson, customerSpec } from './characters.ts';
import type { Person } from './characters.ts';
import { REGULAR_GROUPS, WATCHERS, planCrowd } from './crowdPlan.ts';
import type { TableStatus } from './crowdPlan.ts';
import { drinkModel } from './tableProps.ts';

/**
 * Le monde du Café Tarek, en plus des serveurs et du patron :
 * - des habitués qui jouent à la belote à des tables libres (ils changent de table quand de vrais
 *   joueurs s'installent) et des « شوافة » debout qui regardent les parties ;
 * - des clients aux petites tables de l'entrée (cartes, thé, café) et deux au comptoir ;
 * - un client qui entre, prend un express au comptoir, va regarder une partie et repart.
 */
export interface Crowd {
  /** Tous les personnages (pour couper leurs ombres portées : moins de calcul pour le téléphone). */
  readonly roots: readonly THREE.Object3D[];
  setTables(statuses: ReadonlyMap<number, TableStatus>): void;
  /** Les tables libres où jouent les habitués en ce moment (ils partent dès qu'on s'installe). */
  regularTables(): readonly number[];
  update(now: number, dt: number): void;
}

interface Seated {
  readonly person: Person;
  /** Décalage pour que chacun joue à son tour. */
  readonly turn: number;
  readonly players: number;
}

interface Standing {
  readonly person: Person;
  base: number;
  readonly offset: number;
}

/** Hauteur du plateau des tables (posées au sol). */
const TABLE_TOP = 0.776;

const cardMaterial = new THREE.MeshStandardMaterial({ color: 0xfbf8f0, roughness: 0.6 });
const backMaterial = new THREE.MeshStandardMaterial({ color: 0x2f5fb3, roughness: 0.6 });

/** Les cartes sur la table : le paquet au milieu et une carte jouée devant chaque joueur. */
function cardsOnTable(players: number): THREE.Group {
  const group = new THREE.Group();
  const pile = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.02, 0.1), backMaterial);
  pile.position.y = 0.01;
  pile.rotation.y = 0.4;
  group.add(pile);
  for (let i = 0; i < players; i++) {
    const card = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.004, 0.1), cardMaterial);
    const angle = (i / players) * Math.PI * 2;
    card.position.set(Math.sin(angle) * 0.17, 0.003, Math.cos(angle) * 0.17);
    card.rotation.y = angle + 0.3 * (i % 2 ? 1 : -1);
    group.add(card);
  }
  return group;
}

/** Un client assis à une chaise, tourné vers sa table. */
function seat(person: Person, x: number, y: number, z: number, rotation: number) {
  person.sit();
  person.root.position.set(x, y, z);
  person.root.rotation.y = rotation;
}

export function createCrowd(scene: THREE.Scene, options: { readonly backRoom: boolean; readonly excludedTable?: number }): Crowd {
  const roots: THREE.Object3D[] = [];
  let spec = 20;
  const person = () => {
    const p = createPerson(customerSpec(spec++));
    scene.add(p.root);
    roots.push(p.root);
    return p;
  };
  const props = (object: THREE.Object3D) => {
    scene.add(object);
    roots.push(object);
    return object;
  };

  /* --------------------- Petites tables de l'entrée et comptoir --------------------- */

  const seated: Seated[] = [];
  // Table du milieu : une partie de cartes à deux.
  for (const [k, dz, rotation] of [
    [0, 0.55, Math.PI],
    [1, -0.55, 0],
  ] as const) {
    const p = person();
    seat(p, -1.75, 0, -6.5 + dz, rotation);
    seated.push({ person: p, turn: k, players: 2 });
  }
  props(cardsOnTable(2)).position.set(-1.75, TABLE_TOP, -6.5);
  // Table du fond : un thé et un café, on discute.
  const talkers: Standing[] = [];
  for (const [i, dz, rotation] of [
    [0, 0.55, Math.PI],
    [1, -0.55, 0],
  ] as const) {
    const p = person();
    seat(p, -1.75, 0, -10 + dz, rotation);
    talkers.push({ person: p, base: rotation, offset: i * 2.3 });
  }
  props(drinkModel('tey')).position.set(-1.75, TABLE_TOP, -9.8);
  props(drinkModel('express')).position.set(-1.75, TABLE_TOP, -10.2);

  // Au comptoir : deux clients debout avec leur express.
  const counter: Standing[] = [];
  for (const [i, z] of [
    [0, -6.1],
    [1, -7.0],
  ] as const) {
    const p = person();
    p.walk(0, 0);
    p.root.position.set(1.02, 0, z);
    p.root.rotation.y = Math.PI / 2;
    counter.push({ person: p, base: Math.PI / 2, offset: i * 3.1 });
    props(drinkModel('express')).position.set(1.48, 1.06, z + 0.05);
  }

  /* ----------------------------- Salle de belote ----------------------------- */

  const groups: { readonly people: Person[]; readonly cards: THREE.Group }[] = [];
  const watchers: Standing[] = [];
  let wanderer: Walker | null = null;
  if (options.backRoom) {
    for (let g = 0; g < REGULAR_GROUPS; g++) {
      const people = SEAT_SIDES.map(() => person());
      const cards = props(cardsOnTable(4)) as THREE.Group;
      groups.push({ people, cards });
      people.forEach((p, i) => seated.push({ person: p, turn: i, players: 4 }));
    }
    for (let w = 0; w < WATCHERS; w++) {
      const p = person();
      p.walk(0, 0);
      watchers.push({ person: p, base: 0, offset: w * 1.7 });
    }
    // Un client fait le tour : entrée, comptoir, salle de belote (il regarde une partie), puis repart.
    const visitor = person();
    wanderer = new Walker(
      visitor,
      [
        { x: 0.7, z: 3.3, pause: 3 },
        { x: 0.1, z: 0.6 },
        { x: 0.95, z: -5.3, pause: 6 },
        { x: 0.5, z: -10.8 },
        { x: 0.1, z: -12.9 },
        { x: 0, z: -16.1, pause: 9 },
        { x: 0, z: -13 },
        { x: 0.5, z: -9.5 },
        { x: 0.15, z: 0.6 },
      ],
      0.8,
      groundAt,
    );
  }

  let regulars: readonly number[] = [];
  const setTables = (statuses: ReadonlyMap<number, TableStatus>) => {
    if (!options.backRoom) return;
    const plan = planCrowd(statuses, options.excludedTable);
    regulars = plan.regulars;
    groups.forEach((group, g) => {
      const spot = BELOTE_TABLES.find((t) => t.number === plan.regulars[g]);
      group.cards.visible = Boolean(spot);
      group.people.forEach((p, i) => {
        p.root.visible = Boolean(spot);
        if (!spot) return;
        const { dx, dz, rotation } = seatOffset(SEAT_SIDES[i]!, 0.68);
        seat(p, spot.x + dx, CAFE.stepHeight, spot.z + dz, rotation + Math.PI);
      });
      if (spot) group.cards.position.set(spot.x, CAFE.stepHeight + TABLE_TOP, spot.z);
    });
    // Les spectateurs se tiennent derrière les joueurs des côtés (le premier côté mur, le second côté
    // allée) : derrière les joueurs du nord ou du sud, ils gêneraient la table voisine.
    const used = new Map<number, number>();
    watchers.forEach((w, i) => {
      const table = plan.watchers[i];
      const spot = BELOTE_TABLES.find((t) => t.number === table);
      w.person.root.visible = Boolean(spot);
      if (!spot || table == null) return;
      const k = used.get(table) ?? 0;
      used.set(table, k + 1);
      const wallSide = spot.x < 0 ? 'west' : 'east';
      const aisleSide = spot.x < 0 ? 'east' : 'west';
      const { dx, dz, rotation } = seatOffset(k === 0 ? wallSide : aisleSide, k === 0 ? 1.08 : 1.02);
      const lateral = seatOffset(k === 0 ? 'north' : 'south', 0.25);
      w.person.root.position.set(spot.x + dx + lateral.dx, CAFE.stepHeight, spot.z + dz + lateral.dz);
      w.base = rotation + Math.PI;
    });
  };

  const update = (now: number, dt: number) => {
    const t = now / 1000;
    // Chacun joue à son tour : le bras se lève pour poser la carte.
    for (const s of seated) {
      const slot = 1.4;
      const active = Math.floor(t / slot) % s.players === s.turn;
      const frac = (t % slot) / slot;
      s.person.raiseArm(active ? 0.32 * Math.sin(frac * Math.PI) : 0);
    }
    // On discute : de temps en temps, un geste de la main.
    for (const s of talkers) {
      const cycle = (t + s.offset) % 5;
      s.person.raiseArm(cycle < 1.1 ? 0.35 * Math.sin((cycle / 1.1) * Math.PI) : 0);
    }
    // Au comptoir : on boit son express, gorgée par gorgée.
    for (const s of counter) {
      const cycle = (t + s.offset) % 6;
      s.person.walk(0, 0);
      if (cycle < 1.4) s.person.raiseArm(0.45 * Math.sin((cycle / 1.4) * Math.PI));
      s.person.root.rotation.y = s.base + 0.08 * Math.sin(t * 0.5 + s.offset);
    }
    // Les spectateurs se balancent un peu et commentent la partie.
    for (const w of watchers) {
      if (!w.person.root.visible) continue;
      const cycle = (t + w.offset) % 7;
      w.person.walk(0, 0);
      if (cycle < 1.2) w.person.raiseArm(0.5 * Math.sin((cycle / 1.2) * Math.PI));
      w.person.root.rotation.y = w.base + 0.15 * Math.sin(t * 0.6 + w.offset);
    }
    wanderer?.update(now, dt);
  };

  return { roots, setTables, regularTables: () => regulars, update };
}
