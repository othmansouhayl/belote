import { useEffect, useRef } from 'react';
import { createChouaaScene } from './chouaaScene.ts';

/** La maquette 3D du Café Chouâa (chargée à la demande, comme celles des autres cafés). */
export default function ChouaaView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = createChouaaScene(containerRef.current!, labelsRef.current!);
    return () => scene.dispose();
  }, []);
  return (
    <div className="cafe" ref={containerRef}>
      <div className="cafe__labels" ref={labelsRef} />
    </div>
  );
}
