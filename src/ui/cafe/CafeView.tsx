import { useEffect, useRef } from 'react';
import { createCafeScene } from './cafeScene.ts';
import type { CafeSceneHandle, CafeTarget, Cutscene, SceneTable } from './cafeScene.ts';
import type { Viewpoint } from './cafeLayout.ts';
import type { CafeEnding } from '../online/cafeTables.ts';

interface CafeViewProps {
  readonly tables: readonly SceneTable[];
  /** Parties qui viennent de finir : le patron vient à la table. */
  readonly endings?: readonly CafeEnding[];
  readonly selected: CafeTarget | null;
  readonly view: Viewpoint;
  readonly onSelect: (target: CafeTarget) => void;
  readonly onView: (view: Viewpoint) => void;
  /** Scène pendant une partie (le serveur vient à la table) : la caméra reste sur la table. */
  readonly cutscene?: Cutscene | null;
  readonly onArrive?: () => void;
}

/** La maquette 3D du Café Tarek (chargée à la demande : three.js n'alourdit pas le jeu). */
export default function CafeView(props: CafeViewProps) {
  const { tables, endings = [], selected, view, onSelect, onView, cutscene = null, onArrive } = props;
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const handle = useRef<CafeSceneHandle | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;
  const onArriveRef = useRef(onArrive);
  onArriveRef.current = onArrive;
  // La scène est choisie à l'ouverture : elle ne change pas ensuite.
  const cutsceneRef = useRef(cutscene);

  useEffect(() => {
    const scene = createCafeScene(
      containerRef.current!,
      labelsRef.current!,
      {
        onSelect: (target) => onSelectRef.current(target),
        onView: (next) => onViewRef.current(next),
        onArrive: () => onArriveRef.current?.(),
      },
      cutsceneRef.current,
    );
    handle.current = scene;
    return () => {
      scene.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => handle.current?.update(tables, selected), [tables, selected]);
  // Chaque fin de partie ne fait venir le patron qu'une fois.
  const seenEndings = useRef(new Set<string>());
  useEffect(() => {
    for (const ending of endings) {
      if (seenEndings.current.has(ending.key)) continue;
      seenEndings.current.add(ending.key);
      handle.current?.announceEnd(ending.number);
    }
  }, [endings]);
  const focused = selected?.kind === 'table' ? selected.number : null;
  useEffect(() => {
    if (cutsceneRef.current) return;
    if (focused !== null) handle.current?.focusTable(focused);
    else handle.current?.goTo(view);
  }, [view, focused]);

  return (
    <div className="cafe" ref={containerRef}>
      <div className="cafe__labels" ref={labelsRef} />
    </div>
  );
}
