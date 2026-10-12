import { Component, Suspense, lazy, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Cutscene, SceneTable } from '../cafe/cafeScene.ts';
import { supportsWebGL } from '../cafe/webgl.ts';

const CafeView = lazy(() => import('../cafe/CafeView.tsx'));
const NO_OP = () => undefined;

/** Si la 3D ne peut pas s'afficher, on garde seulement le panneau du bas. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

interface CafeCutsceneProps {
  readonly cutscene: Cutscene;
  /** Les joueurs assis à la table (leurs pseudos et leurs places). */
  readonly players: SceneTable['players'];
  readonly children: ReactNode;
  readonly onArrive?: () => void;
}

/**
 * Pendant le match, l'affichage passe un instant en 3D : le serveur vient à la table des joueurs.
 * En bas, un panneau (commande des boissons, ce qui est servi…) ; puis on revient à la table en 2D.
 */
export function CafeCutscene({ cutscene, players, children, onArrive }: CafeCutsceneProps) {
  const [webgl] = useState(supportsWebGL);
  // Sans 3D, pas de serveur qui marche : le panneau est tout de suite « arrivé ».
  useEffect(() => {
    if (!webgl) onArrive?.();
  }, [webgl, onArrive]);
  const tables = useMemo<SceneTable[]>(
    () => [{ number: cutscene.table, status: 'playing', players, scores: null }],
    [cutscene.table, players],
  );
  return (
    <div className="cutscene" role="dialog" aria-modal="true" aria-label="Au Café Tarek">
      <div className="cutscene__stage">
        {webgl && (
          <Boundary>
            <Suspense fallback={<div className="cafe-loading">Le serveur arrive…</div>}>
              <CafeView tables={tables} selected={null} view="back" onSelect={NO_OP} onView={NO_OP} cutscene={cutscene} onArrive={onArrive} />
            </Suspense>
          </Boundary>
        )}
      </div>
      <div className="cutscene__panel">{children}</div>
    </div>
  );
}
