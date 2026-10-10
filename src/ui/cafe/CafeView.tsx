import { useEffect, useRef } from 'react';
import { createCafeScene } from './cafeScene.ts';
import type { CafeSceneHandle, CafeTarget, SceneTable } from './cafeScene.ts';
import type { Viewpoint } from './cafeLayout.ts';

interface CafeViewProps {
  readonly tables: readonly SceneTable[];
  readonly selected: CafeTarget | null;
  readonly view: Viewpoint;
  readonly onSelect: (target: CafeTarget) => void;
  readonly onView: (view: Viewpoint) => void;
}

/** La maquette 3D du Café Tarek (chargée à la demande : three.js n'alourdit pas le jeu). */
export default function CafeView({ tables, selected, view, onSelect, onView }: CafeViewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const handle = useRef<CafeSceneHandle | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onViewRef = useRef(onView);
  onViewRef.current = onView;

  useEffect(() => {
    const scene = createCafeScene(containerRef.current!, labelsRef.current!, {
      onSelect: (target) => onSelectRef.current(target),
      onView: (next) => onViewRef.current(next),
    });
    handle.current = scene;
    return () => {
      scene.dispose();
      handle.current = null;
    };
  }, []);

  useEffect(() => handle.current?.update(tables, selected), [tables, selected]);
  const focused = selected?.kind === 'table' ? selected.number : null;
  useEffect(() => {
    if (focused !== null) handle.current?.focusTable(focused);
    else handle.current?.goTo(view);
  }, [view, focused]);

  return (
    <div className="cafe" ref={containerRef}>
      <div className="cafe__labels" ref={labelsRef} />
    </div>
  );
}
