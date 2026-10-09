import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  // Chemins relatifs : le site fonctionne aussi bien à la racine que sous /belote/ sur GitHub Pages.
  base: './',
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts'],
  },
});
