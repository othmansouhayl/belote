import { Component, Suspense, lazy, useState } from 'react';
import type { ReactNode } from 'react';
import { BrandHeader, SiteFooter } from '../BrandHeader.tsx';
import { supportsWebGL } from '../cafe/webgl.ts';
import { CLOSED_LINE } from './oudhref.ts';

const GarageView = lazy(() => import('../cafe/GarageView.tsx'));

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

/**
 * Visite du Café Garage (قهوة الڨراج) : on le découvre en 3D, mais on n'y joue pas encore.
 * Ses 2 tables de belote ouvriront plus tard ; en attendant, on joue au Café Tarek.
 */
export function GarageVisit({ onMap, onTarek }: { readonly onMap: () => void; readonly onTarek: () => void }) {
  const [webgl] = useState(supportsWebGL);
  return (
    <div className="home-cafe">
      <BrandHeader place="Visite du Café Garage" />
      <div className="cafe-stage">
        {webgl && (
          <Boundary>
            <Suspense fallback={<div className="cafe-loading">Rochdi ouvre la porte…</div>}>
              <GarageView />
            </Suspense>
          </Boundary>
        )}
        <button type="button" className="cafe-back" onClick={onMap} aria-label="Revenir à la carte de Oudhref">
          ‹ <span lang="ar">وذرف</span>
        </button>
      </div>
      <section className="cafe-sheet">
        <h2 className="sheet__title">
          <span lang="ar">قهوة الڨراج</span> · Café Garage
        </h2>
        <p className="town__sign town__sign--small" lang="ar" dir="rtl">
          🔒 {CLOSED_LINE}
        </p>
        <p className="sheet__text">
          Khalifa et Rochdi préparent l'ouverture : bientôt <strong>2 tables de belote</strong> ici. En attendant, on joue au Café Tarek.
        </p>
        <button type="button" className="btn btn--primary btn--wide" onClick={onTarek}>
          Aller au Café Tarek
        </button>
        <SiteFooter />
      </section>
    </div>
  );
}
