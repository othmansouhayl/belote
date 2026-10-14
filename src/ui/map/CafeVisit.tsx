import { Component, Suspense, lazy, useState } from 'react';
import type { ComponentType, ReactNode } from 'react';
import { BrandHeader, SiteFooter } from '../BrandHeader.tsx';
import { supportsWebGL } from '../cafe/webgl.ts';
import { CLOSED_LINE } from './oudhref.ts';

/** Les cafés qu'on peut déjà visiter en 3D, mais où l'on ne joue pas encore. */
export type VisitCafeId = 'garage' | 'chouaa';

interface VisitInfo {
  readonly ar: string;
  readonly fr: string;
  /** Pendant le chargement de la 3D. */
  readonly loading: string;
  readonly text: ReactNode;
  readonly View: ComponentType;
}

const VISITS: Record<VisitCafeId, VisitInfo> = {
  garage: {
    ar: 'قهوة الڨراج',
    fr: 'Café Garage',
    loading: 'Rochdi ouvre la porte…',
    text: (
      <>
        Khalifa et Rochdi préparent l'ouverture : bientôt <strong>2 tables de belote</strong> ici. En attendant, on joue au Café Tarek.
      </>
    ),
    View: lazy(() => import('../cafe/GarageView.tsx')),
  },
  chouaa: {
    ar: 'قهوة الشعاع',
    fr: 'Café Chouâa',
    loading: 'Nizar ouvre la porte…',
    text: <>Nizar prépare la salle : on ne joue pas encore ici. En attendant, on joue au Café Tarek.</>,
    View: lazy(() => import('../cafe/ChouaaView.tsx')),
  },
};

/** Si la 3D ne peut pas s'afficher, on garde seulement le texte. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

/** Visite d'un café pas encore ouvert au jeu (Café Garage, Café Chouâa) : on le découvre en 3D. */
export function CafeVisit({ cafe, onMap, onTarek }: { readonly cafe: VisitCafeId; readonly onMap: () => void; readonly onTarek: () => void }) {
  const [webgl] = useState(supportsWebGL);
  const { ar, fr, loading, text, View } = VISITS[cafe];
  return (
    <div className="home-cafe">
      <BrandHeader place={`Visite du ${fr}`} />
      <div className="cafe-stage">
        {webgl && (
          <Boundary>
            <Suspense fallback={<div className="cafe-loading">{loading}</div>}>
              <View />
            </Suspense>
          </Boundary>
        )}
        <button type="button" className="cafe-back" onClick={onMap} aria-label="Revenir à la carte de Oudhref">
          ‹ <span lang="ar">وذرف</span>
        </button>
      </div>
      <section className="cafe-sheet">
        <h2 className="sheet__title">
          <span lang="ar">{ar}</span> · {fr}
        </h2>
        <p className="town__sign town__sign--small" lang="ar" dir="rtl">
          🔒 {CLOSED_LINE}
        </p>
        <p className="sheet__text">{text}</p>
        <button type="button" className="btn btn--primary btn--wide" onClick={onTarek}>
          Aller au Café Tarek
        </button>
        <SiteFooter />
      </section>
    </div>
  );
}
