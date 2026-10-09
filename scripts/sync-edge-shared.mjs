// Copie le moteur et la logique des salons dans supabase/functions/_shared
// pour que l'Edge Function (Deno) exécute exactement le même code que les tests.
import { cpSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const target = `${root}supabase/functions/_shared`;
rmSync(target, { recursive: true, force: true });
for (const dir of ['engine', 'server', 'voice']) {
  cpSync(`${root}src/${dir}`, `${target}/${dir}`, { recursive: true });
}
console.log('Code partagé copié dans supabase/functions/_shared');
