import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Chemins relatifs : le site fonctionne aussi bien à la racine que sous /belote/ sur GitHub Pages.
  base: './',
  plugins: [react()],
  // La maquette 3D du café (three.js) est un module à part, chargé seulement sur l'accueil.
  build: { chunkSizeWarningLimit: 600 },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
