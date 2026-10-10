/** Vrai si le navigateur sait afficher de la 3D (WebGL). Sinon, on montre le plan en 2D. */
export function supportsWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}
