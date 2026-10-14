import { useEffect, useRef } from 'react';
import { createGarageScene } from './garageScene.ts';

/** La maquette 3D du Café Garage (chargée à la demande, comme celle du Café Tarek). */
export default function GarageView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const scene = createGarageScene(containerRef.current!, labelsRef.current!);
    return () => scene.dispose();
  }, []);
  return (
    <div className="cafe" ref={containerRef}>
      <div className="cafe__labels" ref={labelsRef} />
    </div>
  );
}
