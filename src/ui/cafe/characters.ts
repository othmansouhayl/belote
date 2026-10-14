import * as THREE from 'three';

/**
 * Personnages du Café Tarek, en style simple (formes géométriques), animés à la main :
 * les deux serveurs circulent, le patron va et vient avec sa chicha, les clients sont assis en terrasse.
 */

export interface PersonSpec {
  readonly height: number;
  readonly skin: number;
  readonly shirt: number;
  /** Manches courtes (t-shirt) : avant-bras nus. */
  readonly shortSleeves?: boolean;
  readonly trousers: number;
  readonly shoes: number;
  /** Cheveux courts, crâne chauve (couronne sur les côtés), ou front dégarni (cheveux en arrière). */
  readonly hair: 'short' | 'bald' | 'receding';
  readonly hairColor: number;
  readonly hat?: number;
  readonly angry?: boolean;
  readonly belly?: number;
}

/** Nader (نادر), serveur : 35 ans, 1,70 m, rasé de près, cheveux courts. En tenue de tous les jours : t-shirt et jean. */
export const NADER: PersonSpec = {
  height: 1.7,
  skin: 0xc4956a,
  shirt: 0x3f6f86,
  shortSleeves: true,
  trousers: 0x34476a,
  shoes: 0xece9e2,
  hair: 'short',
  hairColor: 0x1b1410,
};

/** Mohamed Naceur (محمد ناصر), serveur : 35 ans, 1,80 m, toujours sa casquette blanche. Sweat gris et pantalon beige. */
export const MOHAMED_NACEUR: PersonSpec = {
  height: 1.8,
  skin: 0xb88a5f,
  shirt: 0x8a9099,
  trousers: 0xb3a07e,
  shoes: 0xece9e2,
  hair: 'short',
  hairColor: 0x1b1410,
  hat: 0xf7f7f2,
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

/** Khalifa (خليفة), patron du Café Garage : 65 ans, gros, cheveux noirs, le front un peu dégarni. */
export const KHALIFA: PersonSpec = {
  height: 1.72,
  skin: 0xc99a72,
  shirt: 0x6d5a45,
  trousers: 0x3a3a40,
  shoes: 0x2a1c12,
  hair: 'receding',
  hairColor: 0x15110d,
  belly: 1.38,
};

/** Rochdi (رشدي), serveur du Café Garage : 60 ans, cheveux gris, toujours pressé. */
export const ROCHDI: PersonSpec = {
  height: 1.68,
  skin: 0xb98c62,
  shirt: 0xf1eee6,
  trousers: 0x2c2f36,
  shoes: 0x2a1c12,
  hair: 'short',
  hairColor: 0xa8a29a,
};

/** Nizar (نزار), serveur du Café Chouâa : 40 ans, noir, grand et mince. */
export const NIZAR: PersonSpec = {
  height: 1.82,
  skin: 0x5a3a26,
  shirt: 0xf3f1ec,
  trousers: 0x23252b,
  shoes: 0x2a1c12,
  hair: 'short',
  hairColor: 0x0f0c0a,
  belly: 0.88,
};

/** Clients de la terrasse : des tenues variées, de tous les jours. */
export function customerSpec(index: number): PersonSpec {
  const shirts = [0x2e5e8c, 0x8c3b2e, 0x4f7a4a, 0xd9c7a0, 0x3a3a40, 0x9b6bb0, 0xe0e0da, 0x6b4f3a, 0x2f7d7a, 0xc9803a];
  const trousers = [0x34476a, 0x2a2a30, 0x6b5a45, 0x3d4d66];
  const skins = [0xc4956a, 0xe0b48e, 0xa8774f, 0xd2a27a];
  return {
    height: 1.7 + (index % 3) * 0.05,
    skin: skins[index % skins.length]!,
    shirt: shirts[index % shirts.length]!,
    shortSleeves: index % 2 === 0,
    trousers: trousers[index % trousers.length]!,
    shoes: index % 3 === 0 ? 0xece9e2 : 0x2a1c12,
    hair: index % 4 === 3 ? 'bald' : 'short',
    hairColor: index % 5 === 2 ? 0x8a837a : 0x1b1410,
    hat: index % 7 === 5 ? 0x2a2a30 : undefined,
  };
}

export interface Person {
  readonly root: THREE.Group;
  /** Pose de marche (phase en radians) ou assis. */
  walk(phase: number, amount: number): void;
  sit(): void;
  /** Bras droit levé (geste d'énervement), de 0 à 1. */
  raiseArm(amount: number): void;
  /** Bras droit plié devant soi, pour porter un plateau. */
  carry(): void;
  /** Bras droit le long du corps, un peu écarté : pour porter la chicha. */
  hold(): void;
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

  // Buste (un peu de ventre pour le patron).
  const torso = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.34, 4, 10), shirt);
  torso.position.y = 1.2;
  torso.scale.set(1.05 * (spec.belly ?? 1), 1, 0.62 * (spec.belly ?? 1));
  body.add(torso);

  // Bras : épaule → bras (manche) → main.
  const arms = [-1, 1].map((side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.26, 1.44, 0);
    shoulder.add(limb(0.06, 0.34, shirt));
    const elbow = new THREE.Group();
    elbow.position.y = -0.32;
    elbow.add(limb(0.052, 0.3, spec.shortSleeves ? skin : shirt));
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
  if (spec.hair === 'receding') {
    // Front dégarni : les cheveux commencent plus en arrière sur le crâne.
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.137, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.42), hairMat);
    hair.rotation.x = -0.75;
    hair.position.set(0, 0.0, -0.02);
    head.add(hair);
  } else if (spec.hair === 'short') {
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
  // Nez et oreilles : un visage lisible de près, avec très peu de géométrie.
  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.02, 0.05, 6), skin);
  nose.rotation.x = Math.PI / 2;
  nose.position.set(0, -0.015, 0.14);
  head.add(nose);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.032, 8, 6), skin);
    ear.scale.set(0.45, 1, 0.75);
    ear.position.set(side * 0.13, -0.005, -0.005);
    head.add(ear);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.007, 4, 10, Math.PI), mat(0x5a2a22));
  mouth.position.set(0, -0.06, 0.118);
  // Sourire pour les serveurs, bouche tombante pour le patron.
  mouth.rotation.z = spec.angry ? 0 : Math.PI;
  if (spec.angry) mouth.position.y = -0.075;
  head.add(mouth);
  if (spec.angry) {
    for (const side of [-1, 1]) {
      const cheek = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 8, 6),
        new THREE.MeshStandardMaterial({ color: 0xd9534f, transparent: true, opacity: 0.55 }),
      );
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
    for (const arm of arms) {
      arm.shoulder.rotation.z = 0;
      arm.elbow.rotation.x = -0.2;
    }
    body.position.y = Math.abs(Math.cos(phase)) * 0.025 * amount;
  };

  const sit = () => {
    for (const leg of legs) {
      leg.hip.rotation.x = -Math.PI / 2;
      leg.knee.rotation.x = Math.PI / 2;
    }
    for (const arm of arms) {
      arm.shoulder.rotation.x = -0.5;
      arm.shoulder.rotation.z = 0;
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

  const hold = () => {
    arms[1]!.shoulder.rotation.x = 0;
    arms[1]!.shoulder.rotation.z = 0.15;
    arms[1]!.elbow.rotation.x = 0;
  };

  return { root, walk, sit, raiseArm, carry, hold };
}

/** Plateau avec un verre de thé, tenu par un serveur. */
export function tray(): THREE.Group {
  const group = new THREE.Group();
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(0.17, 0.17, 0.015, 20),
    new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.7, roughness: 0.3 }),
  );
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

/** Chicha posée au sol, à côté de celui qui la fume. */
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
  const coal = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.02, 0.03),
    new THREE.MeshStandardMaterial({ color: 0xff5a1f, emissive: 0xff3a10, emissiveIntensity: 1.2 }),
  );
  coal.position.y = 0.765;
  group.add(coal);
  return group;
}

/** Tuyau de la chicha, courbé entre le vase et la main du fumeur. */
export function hose(from: THREE.Vector3, to: THREE.Vector3): THREE.Mesh {
  const mid = from.clone().lerp(to, 0.5);
  mid.y = Math.min(from.y, to.y) - 0.25;
  const curve = new THREE.CatmullRomCurve3([from, mid, to]);
  return new THREE.Mesh(new THREE.TubeGeometry(curve, 16, 0.012, 6), new THREE.MeshStandardMaterial({ color: 0x5b2c1d, roughness: 0.8 }));
}

/**
 * Chicha et son tuyau, placés par rapport à une personne assise (repère de la personne, qui regarde vers +z) :
 * on pose ce groupe à l'endroit et dans l'orientation de la chaise.
 */
export const CHICHA_OFFSET = new THREE.Vector3(-0.63, 0, -0.12);
/** Point où la fumée sort (devant le visage d'une personne assise). */
export const SMOKE_OFFSET = new THREE.Vector3(-0.03, 1.22, 0.2);

export function seatedChicha(): { readonly kit: THREE.Group; readonly chicha: THREE.Group } {
  const kit = new THREE.Group();
  const pipe = chicha();
  pipe.position.copy(CHICHA_OFFSET);
  kit.add(pipe);
  kit.add(hose(new THREE.Vector3(-0.68, 0.42, -0.12), new THREE.Vector3(-0.15, 0.78, 0.3)));
  return { kit, chicha: pipe };
}

/** Trajet d'un personnage : il marche de point en point et marque des pauses. */
export interface Waypoint {
  readonly x: number;
  readonly z: number;
  /** Pause à ce point, en secondes. */
  readonly pause?: number;
}

/** Fait marcher un personnage sur un trajet : en boucle (serveurs) ou une seule fois (le patron). */
export class Walker {
  private index = 0;
  private waitUntil = 0;
  private phase = 0;
  private readonly position: THREE.Vector2;
  /** Trajet simple terminé (jamais vrai pour un trajet en boucle). */
  finished = false;

  constructor(
    private readonly person: Person,
    private readonly path: readonly Waypoint[],
    private readonly speed: number,
    private readonly groundAt: (x: number, z: number) => number,
    private readonly loop = true,
  ) {
    const first = path[0]!;
    this.position = new THREE.Vector2(first.x, first.z);
    person.root.position.set(first.x, groundAt(first.x, first.z), first.z);
  }

  update(now: number, dt: number): void {
    if (this.finished) return;
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
      if (!this.loop && this.index === this.path.length - 1) this.finished = true;
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
    this.person.root.position.set(this.position.x, this.groundAt(this.position.x, this.position.y), this.position.y);
  }

  get location(): THREE.Vector3 {
    return this.person.root.position;
  }
}
