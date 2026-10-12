import * as THREE from 'three';
import type { Drink } from '../../server/types.ts';
import { chicha } from './characters.ts';

/**
 * Ce que les serveurs posent sur la table : le tapis, le bout de carton et le stylo
 * (pour noter les points), puis les boissons commandées… ou presque.
 */
const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05, ...extra });

function cylinder(rTop: number, rBottom: number, h: number, material: THREE.Material, y: number) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBottom, h, 14), material);
  mesh.position.y = y;
  return mesh;
}

/** Tapis vert, carton et stylo bleu : posés au centre de la table (repère : dessus de la table en y = 0). */
export function tableKit(): THREE.Group {
  const group = new THREE.Group();
  const felt = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.008, 0.72), mat(0x1f6b3a, { roughness: 0.95 }));
  felt.position.y = 0.004;
  group.add(felt);
  const paper = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.003, 0.15), mat(0xece4d2, { roughness: 0.9 }));
  paper.position.set(0.24, 0.01, 0.24);
  paper.rotation.y = 0.35;
  group.add(paper);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.0035, 0.15), mat(0xb3262e));
  stripe.position.set(0.2, 0.0105, 0.255);
  stripe.rotation.y = 0.35;
  group.add(stripe);
  const pen = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.15, 8), mat(0x1d3a94, { roughness: 0.3 }));
  pen.rotation.set(0, 0.9, Math.PI / 2);
  pen.position.set(0.27, 0.018, 0.2);
  group.add(pen);
  return group;
}

const white = mat(0xf4f1ea, { roughness: 0.35 });
const coffee = mat(0x3b2412, { roughness: 0.25 });

/** Une boisson posée sur la table (repère : dessus de la table en y = 0). La chicha, elle, va par terre. */
export function drinkModel(drink: Drink): THREE.Group {
  const group = new THREE.Group();
  const saucer = () => cylinder(0.055, 0.055, 0.006, white, 0.003);
  switch (drink) {
    case 'express':
      group.add(saucer(), cylinder(0.028, 0.022, 0.035, white, 0.02), cylinder(0.025, 0.025, 0.003, coffee, 0.037));
      break;
    case 'allonge':
      group.add(saucer(), cylinder(0.036, 0.028, 0.055, white, 0.03), cylinder(0.033, 0.033, 0.003, coffee, 0.057));
      break;
    case 'capucin':
      group.add(saucer(), cylinder(0.04, 0.03, 0.055, white, 0.03), cylinder(0.037, 0.037, 0.006, mat(0xd9b48a), 0.058));
      break;
    case 'filtre':
      group.add(cylinder(0.034, 0.034, 0.09, mat(0xc9b28f, { roughness: 0.5 }), 0.045), cylinder(0.031, 0.031, 0.003, coffee, 0.09));
      break;
    case 'tey':
      group.add(
        cylinder(0.024, 0.02, 0.075, new THREE.MeshStandardMaterial({ color: 0xc8732a, transparent: true, opacity: 0.85, roughness: 0.15 }), 0.038),
      );
      break;
    case 'chicha':
      group.add(chicha());
      break;
  }
  return group;
}
