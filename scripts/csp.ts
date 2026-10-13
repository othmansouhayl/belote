/**
 * Politique de sécurité du contenu (CSP) du site publié.
 * Le navigateur refuse tout ce qui n'est pas listé : scripts venus d'ailleurs, connexions vers
 * un autre serveur que le nôtre et Supabase, site affiché dans un cadre d'un autre site, etc.
 * GitHub Pages ne permet pas d'ajouter des en-têtes HTTP : elle est posée en balise <meta>.
 */
export function contentSecurityPolicy(supabaseUrl: string | undefined): string {
  const connect = ["'self'"];
  if (supabaseUrl) {
    const { origin, protocol, host } = new URL(supabaseUrl);
    // Appels au serveur du jeu (https) et temps réel (WebSocket).
    connect.push(origin, `${protocol === 'https:' ? 'wss' : 'ws'}://${host}`);
  }
  return [
    "default-src 'self'",
    "script-src 'self'",
    // Styles calculés par React (positions, couleurs) : attributs style en ligne.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "media-src 'self' blob:",
    `connect-src ${connect.join(' ')}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; ');
}
