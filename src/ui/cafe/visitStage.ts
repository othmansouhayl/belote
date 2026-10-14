import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { ambianceAt, currentHour } from './ambiance.ts';
import type { Ambiance } from './ambiance.ts';
import { MATERIALS, cylinder, mat } from './cafeScene.ts';

/**
 * Ce que partagent les cafés qu'on visite en 3D (Café Garage, Café Chouâa) : le rendu, la caméra
 * qu'on fait tourner au doigt, la lumière qui suit l'heure de la journée, les ampoules de la salle,
 * les lampadaires, les étiquettes au-dessus des tables, la boucle d'animation et le nettoyage.
 */
export interface VisitStage {
  readonly scene: THREE.Scene;
  /** La chaussée : sa couleur suit l'heure (plus sombre la nuit). */
  readonly asphalt: THREE.MeshStandardMaterial;
  /** Une ampoule suspendue au plafond, au-dessus d'une table. */
  bulb(x: number, z: number, y?: number): void;
  /** Un lampadaire de rue, allumé le soir. */
  streetLamp(x: number, z: number): void;
  /** Une étiquette HTML qui suit un point de la scène (ex. « Table 1 · مازلنا مسكرين »). */
  label(className: string, html: string, anchor: THREE.Vector3): void;
  /** Personnages qui ne projettent pas d'ombre (moins de calcul pour le téléphone). */
  noShadow(object: THREE.Object3D): void;
  /** Lance l'animation : `update` est appelé environ 30 fois par seconde. */
  start(update: (now: number, dt: number, t: number) => void): void;
  dispose(): void;
}

export interface VisitStageOptions {
  readonly view: { readonly camera: readonly [number, number, number]; readonly target: readonly [number, number, number] };
  /** Demi-largeur de la zone où le soleil projette des ombres (m). */
  readonly shadowExtent: number;
  readonly fog: readonly [number, number];
  readonly distance: readonly [number, number];
}

export function createVisitStage(container: HTMLElement, labelLayer: HTMLElement, options: VisitStageOptions): VisitStage {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'default' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.className = 'cafe__canvas';

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0d2219, ...options.fog);
  const camera = new THREE.PerspectiveCamera(48, 1, 0.1, 90);
  camera.position.set(...options.view.camera);

  const hemi = new THREE.HemisphereLight(0xfff1dc, 0x3a2a1c, 1.1);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xffe2b8, 1.6);
  key.position.set(9, 15, 6);
  key.target.position.set(0, 0, -1);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  const e = options.shadowExtent;
  Object.assign(key.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 45 });
  key.shadow.bias = -0.0006;
  key.shadow.normalBias = 0.03;
  scene.add(key, key.target);

  const bulbMaterial = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffc46b, emissiveIntensity: 1.5 });
  const lamps: THREE.PointLight[] = [];
  const lampHead = new THREE.MeshStandardMaterial({ color: 0xfff1c9, emissive: 0xffd08a, emissiveIntensity: 0 });
  const streetLights: THREE.PointLight[] = [];
  const asphalt = mat(0x55585b, { roughness: 1 });
  const labels: { el: HTMLElement; anchor: THREE.Vector3 }[] = [];
  const shadowless: THREE.Object3D[] = [];

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
    for (const light of streetLights) light.intensity = a.streetLights ? 7 : 0;
  };
  const ambianceNow = () => ambianceAt(currentHour(new Date(), window.location.search));
  let ambianceTimer: ReturnType<typeof setInterval> | undefined;

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...options.view.target);
  controls.enablePan = false;
  controls.enableDamping = true;
  controls.dampingFactor = 0.12;
  [controls.minDistance, controls.maxDistance] = options.distance;
  controls.minPolarAngle = 0.3;
  controls.maxPolarAngle = 1.2;
  controls.rotateSpeed = 0.7;
  controls.update();

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

  return {
    scene,
    asphalt,
    bulb(x, z, y = 2.45) {
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), bulbMaterial);
      bulb.position.set(x, y, z);
      scene.add(bulb, cylinder(0.005, 0.005, 0.45, MATERIALS.black, x, y + 0.25, z, 4));
      const light = new THREE.PointLight(0xffc98a, 5, 7, 1.6);
      light.position.set(x, y - 0.1, z);
      scene.add(light);
      lamps.push(light);
    },
    streetLamp(x, z) {
      scene.add(cylinder(0.05, 0.06, 3.4, MATERIALS.black, x, 1.7, z));
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lampHead);
      head.position.set(x, 3.45, z);
      scene.add(head);
      const light = new THREE.PointLight(0xffd08a, 0, 10, 1.4);
      light.position.set(x, 3.3, z);
      scene.add(light);
      streetLights.push(light);
    },
    label(className, html, anchor) {
      const el = document.createElement('div');
      el.className = className;
      el.innerHTML = html;
      labelLayer.appendChild(el);
      labels.push({ el, anchor });
    },
    noShadow(object) {
      shadowless.push(object);
    },
    start(update) {
      scene.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        object.castShadow = !(object.material as THREE.Material).transparent;
        object.receiveShadow = true;
      });
      for (const o of shadowless) o.traverse((child) => (child.castShadow = false));
      applyAmbiance(ambianceNow());
      ambianceTimer = setInterval(() => applyAmbiance(ambianceNow()), 60_000);
      let last = performance.now();
      const loop = (now: number) => {
        frame = requestAnimationFrame(loop);
        // Environ 30 images par seconde suffisent (économie de batterie).
        if (now - last < 33) return;
        const dt = Math.min(0.1, (now - last) / 1000);
        last = now;
        update(now, dt, now / 1000);
        controls.update();
        renderer.render(scene, camera);
        placeLabels();
      };
      frame = requestAnimationFrame(loop);
    },
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
