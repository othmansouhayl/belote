import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { loadEnv } from 'vite';
import type { Plugin } from 'vite';
import { contentSecurityPolicy } from './scripts/csp.ts';

/** Ajoute la politique de sécurité (CSP) au site construit (pas en développement : Vite y a besoin de scripts en ligne). */
function securityPolicy(): Plugin {
  let supabaseUrl: string | undefined;
  return {
    name: 'kaboot-csp',
    apply: 'build',
    configResolved(config) {
      supabaseUrl = loadEnv(config.mode, process.cwd(), 'VITE_').VITE_SUPABASE_URL || undefined;
    },
    transformIndexHtml: () => [
      {
        tag: 'meta',
        attrs: { 'http-equiv': 'Content-Security-Policy', content: contentSecurityPolicy(supabaseUrl) },
        injectTo: 'head-prepend',
      },
    ],
  };
}

export default defineConfig({
  // Chemins relatifs : le site fonctionne aussi bien à la racine que sous /belote/ sur GitHub Pages.
  base: './',
  plugins: [react(), securityPolicy()],
  // La maquette 3D du café (three.js) est un module à part, chargé seulement sur l'accueil.
  build: { chunkSizeWarningLimit: 600 },
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
