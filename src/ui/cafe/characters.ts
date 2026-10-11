import * as THREE from 'three';

/**
 * Personnages du Café Tarek, en style simple (formes géométriques), animés à la main :
 * les deux serveurs circulent, le patron reste assis à la première table avec sa chicha.
 */

export interface PersonSpec {
  readonly height: number;
  readonly skin: number;
  readonly shirt: number;
  readonly vest?: number;
  readonly trousers: number;
  readonly shoes: number;
  readonly hair: 'short' | 'bald';
  readonly hairColor: number;
  readonly hat?: number;
  readonly apron?: boolean;
  readonly angry?: boolean;
  readonly belly?: number;
}

/** Nader (نادر), serveur : 35 ans, 1,70 m, rasé de près, cheveux courts. */
export const NADER: PersonSpec = {
  height: 1.7,
  skin: 0xc4956a,
  shirt: 0xf4f1ea,
  vest: 0x1f1f24,
  trousers: 0x1c1c22,
  shoes: 0x111111,
  hair: 'short',
  hairColor: 0x1b1410,
  apron: true,
};

/** Mohamed Naceur (محمد ناصر), serveur : 35 ans, 1,80 m, toujours sa casquette blanche. */
export const MOHAMED_NACEUR: PersonSpec = {
  height: 1.8,
  skin: 0xb88a5f,
  shirt: 0xf4f1ea,
  vest: 0x6e1a2b,
  trousers: 0x23232b,
  shoes: 0x111111,
  hair: 'short',
  hairColor: 0x1b1410,
  hat: 0xf7f7f2,
  apron: true,
};

/** Tarek (طارق), le patron : 50 ans, chauve, toujours de mauvaise humeur. */
export const TAREK: PersonSpec = {
  height: 1.74,
  skin: 0xe8c3a2,
  shirt: 0x34465e,
  trousers: 0x8a7a62,
  shoes: 0x2a1c12,
  hair: 'bald',
  hairColor: 0x9a948c,
  angry: true,
  belly: 1.18,
};

export interface Person {
  readonly root: THREE.Group;
  /** Pose de marche (phase en radians) ou assis. */
  walk(phase: number, amount: number): void;
  sit(): void;
  /** Bras droit levé (geste d'énervement), de 0 à 1. */
  raiseArm(amount: number): void;
  /** Bras droit plié devant soi, pour porter un plateau. */
  carry(): void;
}

const mat = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.02 });

function limb(radius: number, length: number, material: THREE.Material) {
  const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(radius, length - radius * 2, 4, 8), material);
  mesh.position.y = -length / 2;
  return mesh;
}

/** Construit un personnage debout, face à +z, les pieds en y = 0. Dimensions pour 1,75 m puis mise à l'échelle. */
export function createPerson(spec: PersonSpec): Person {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.scale.setScalar(spec.height / 1.75);
  root.add(body);

  const skin = mat(spec.skin);
  const shirt = mat(spec.shirt);
  const trousers = mat(spec.trousers);
  const shoes = mat(spec.shoes);

  // Jambes : hanche → cuisse → genou → mollet → chaussure.
  const legs = [-1, 1].map((side) => {
    const hip = new THREE.Group();
    hip.position.set(side * 0.1, 0.9, 0);
    hip.add(limb(0.075, 0.46, trousers));
    const knee = new THREE.Group();
    knee.position.y = -0.44;
    knee.add(limb(0.065, 0.44, trousers));
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.24), shoes);
    shoe.position.set(0, -0.44, 0.05);
    knee.add(shoe);
    hip.add(knee);
    body.add(hip);
    return { hip, knee };
  });

  // Buste (un peu de ventre pour le patron), gilet et tablier des serveurs.
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 4, 10), shirt);
  torso.position.y = 1.2;
  torso.scale.set(1.05 * (spec.belly ?? 1), 1, 0.62 * (spec.belly ?? 1));
  body.add(torso);
  if (spec.vest !== undefined) {
    const vest = new THREE.Mesh(new THREE.CapsuleGeometry(0.205, 0.26, 4, 10), mat(spec.vest));
    vest.position.y = 1.22;
    vest.scale.set(1.08, 1, 0.66);
    body.add(vest);
  }
  if (spec.apron) {
    const apron = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.42, 0.02), mat(0xfaf8f2));
    apron.position.set(0, 0.86, 0.15);
    body.add(apron);
  }

  // Bras : épaule → bras (manche) → main.
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.26, 1.44, 0);
    shoulder.add(limb(0.06, 0.34, shirt));
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    elbow.add(limb(0.052, 0.3, shirt));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.055, 10, 8), skin);
    hand.position.y = -0.32;
    elbow.add(hand);
    shoulder.add(elbow);
    body.add(shoulder);
    return { shoulder, elbow };
  });

  // Tête, cheveux ou crâne chauve, visage.
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.1, 10), skin);
  neck.position.y = 1.56;
  body.add(neck);
  const head = new THREE.Group();
  head.position.y = 1.7;
  body.add(head);
  head.add(new THREE.Mesh(new THREE.SphereGeometry(0.13, 18, 14), skin));
  const hairMat = mat(spec.hairColor);
  if (spec.hair === 'short') {
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.136, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.52), hairMat);
    hair.rotation.x = -0.25;
    hair.position.set(0, 0.012, -0.012);
    head.add(hair);
  } else {
    // Chauve : juste une couronne de cheveux gris sur les côtés.
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.118, 0.025, 6, 20, Math.PI * 1.25), hairMat);
    ring.rotation.set(Math.PI / 2, 0, Math.PI * 1.375);
    ring.position.y = -0.02;
    head.add(ring);
  }
  if (spec.hat !== undefined) {
    const hatMat = mat(spec.hat);
    const crown = new THREE.Mesh(new THREE.SphereGeometry(0.14, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), hatMat);
    crown.position.y = 0.03;
    head.add(crown);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 16, 1, false, -Math.PI / 2, Math.PI), hatMat);
    brim.scale.set(1, 1, 1.4);
    brim.position.set(0, 0.04, 0.11);
    head.add(brim);
  }
  const dark = mat(0x111111);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.017, 8, 6), dark);
    eye.position.set(side * 0.045, 0.02, 0.118);
    head.add(eye);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.055, 0.012, 0.012), mat(spec.hair === 'bald' ? 0x6b625a : spec.hairColor));
    brow.position.set(side * 0.047, 0.055, 0.12);
    // Sourcils froncés vers le nez : l'air fâché du patron.
    brow.rotation.z = spec.angry ? side * 0.45 : 0;
    head.add(brow);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 10, Math.PI), mat(0x5a2a22));
  mouth.position.set(0, -0.06, 0.118);
  // Sourire pour les serveurs, bouche tombante pour le patron.
  mouth.rotation.z = spec.angry ? 0 : Math.PI;
  if (spec.angry) mouth.position.y = -0.075;
  head.add(mouth);
  if (spec.angry) {
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), new THREE.MeshStandardMaterial({ color: 0xd9534f, transparent: true, opacity: 0.55 }));
      cheek.position.set(side * 0.075, -0.025, 0.1);
      head.add(cheek);
    }
  }

  const walk = (phase: number, amount: number) => {
    const swing = Math.sin(phase) * 0.55 * amount;
    legs[0]!.hip.rotation.x = swing;
    legs[1]!.hip.rotation.x = -swing;
    legs[0]!.knee.rotation.x = Math.max(0, -Math.sin(phase)) * 0.6 * amount;
    legs[1]!.knee.rotation.x = Math.max(0, Math.sin(phase)) * 0.6 * amount;
    arms[0]!.shoulder.rotation.x = -swing * 0.8;
    arms[1]!.shoulder.rotation.x = swing * 0.8;
    body.position.y = Math.abs(Math.cos(phase)) * 0.025 * amount;
  };

  const sit = () => {
    for (const leg of legs) {
      leg.hip.rotation.x = -Math.PI / 2;
      leg.knee.rotation.x = Math.PI / 2;
    }
    for (const arm of arms) {
      arm.shoulder.rotation.x = -0.5;
      arm.elbow.rotation.x = -0.9;
    }
    // Hanches à hauteur d'assise (siège à 0,48 m).
    body.position.y = 0.5 - 0.9 * (spec.height / 1.75);
  };

  const raiseArm = (amount: number) => {
    arms[1]!.shoulder.rotation.x = -0.5 - amount * 2.1;
    arms[1]!.elbow.rotation.x = -0.9 + amount * 0.5;
  };

  const carry = () => {
    arms[1]!.shoulder.rotation.x = -0.35;
    arms[1]!.elbow.rotation.x = -1.25;
  };

  return { root, walk, sit, raiseArm, carry };
}

/** Plateau avec un verre de thé, tenu par un serveur. */
export function tray(): THREE.Group {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.015, 20), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.7, roughness: 0.3 }));
  group.add(plate);
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.025, 0.08, 10),
    new THREE.MeshStandardMaterial({ color: 0xc8732a, transparent: true, opacity: 0.85, roughness: 0.2 }),
  );
  glass.position.set(0.04, 0.045, 0);
  group.add(glass);
  const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.03, 0.05, 10), new THREE.MeshStandardMaterial({ color: 0xf4f1ea }));
  cup.position.set(-0.06, 0.03, 0.03);
  group.add(cup);
  return group;
}

/** Chicha posée au sol, à côté du patron. */
export function chicha(): THREE.Group {
  const group = new THREE.Group();
  const vase = new THREE.Mesh(
    new THREE.SphereGeometry(0.13, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0x2f7d6b, transparent: true, opacity: 0.8, roughness: 0.15, metalness: 0.2 }),
  );
  vase.position.y = 0.13;
  vase.scale.y = 1.1;
  group.add(vase);
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 0.8, roughness: 0.3 });
  const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.025, 0.5, 8), brass);
  stem.position.y = 0.5;
  group.add(stem);
  const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 14), brass);
  plate.position.y = 0.66;
  group.add(plate);
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.03, 0.07, 10), new THREE.MeshStandardMaterial({ color: 0x8a3b22 }));
  bowl.position.y = 0.72;
  group.add(bowl);
  const coal = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.02, 0.03), new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3a10, emissiveIntensity: 1.2 }));
  coal.position.y = 0.765;
  group.add(coal);
  return group;
}

/** Tuyau de la chicha, courbé entre le vase et la main du patron (coordonnées locales au café). */
export function hose(from: THREE.Vector3, to: THREE.Vector3): THREE.Mesh {
  const mid = from.clone().lerp(to, 0.5);
  mid.y = Math.min(from.y, to.y) - 0.25;
  const curve = new THREE.CatmullRomCurve3([from, mid, to]);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.012, 6), new THREE.MeshStandardMaterial({ color: 0x5b2c1d, roughness: 0.8 }));
}

/** Trajet d'un serveur : il marche de point en point et marque des pauses. */
export interface Waypoint {
  readonly x: number;
  readonly z: number;
  /** Pause à ce point, en secondes. */
  readonly pause?: number;
}

export class Walker {
  private index = 0;
  private waitUntil = 0;
  private phase = 0;
  private readonly position: THREE.Vector2;

  constructor(
    private readonly person: Person,
    private readonly path: readonly Waypoint[],
    private readonly speed: number,
    private readonly groundAt: (z: number) => number,
  ) {
    const first = path[0]!;
    this.position = new THREE.Vector2(first.x, first.z);
    person.root.position.set(first.x, groundAt(first.z), first.z);
  }

  update(now: number, dt: number): void {
    const target = this.path[(this.index + 1) % this.path.length]!;
    if (now < this.waitUntil) {
      this.person.walk(this.phase, 0);
      return;
    }
    const delta = new THREE.Vector2(target.x - this.position.x, target.z - this.position.y);
    const distance = delta.length();
    const step = this.speed * dt;
    if (distance <= step) {
      this.position.set(target.x, target.z);
      this.index = (this.index + 1) % this.path.length;
      if (target.pause) this.waitUntil = now + target.pause * 1000;
    } else {
      this.position.addScaledVector(delta.normalize(), step);
      // Le personnage se tourne doucement vers sa direction de marche (face à +z au repos).
      const heading = Math.atan2(delta.x, delta.y);
      const current = this.person.root.rotation.y;
      let diff = heading - current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      this.person.root.rotation.y = current + diff * Math.min(1, dt * 8);
    }
    this.phase += dt * this.speed * 7;
    this.person.walk(this.phase, now < this.waitUntil ? 0 : 1);
    this.person.root.position.set(this.position.x, this.groundAt(this.position.y), this.position.y);
  }

  get location(): THREE.Vector3 {
    return this.person.root.position;
  }
}
