import { BrandMark } from './icons.tsx';
import { SoundToggle } from './SoundToggle.tsx';

/** La bannière du site : logo carreau, « Kaboot Dineri », et le lieu où l'on est. */
export function BrandHeader({ place }: { readonly place: string }) {
  return (
    <header className="cafe-header">
      <div className="brand">
        <BrandMark />
        <div className="brand__titles">
          <h1 className="brand__name">Kaboot Dineri</h1>
          <p className="brand__tag">
            <span lang="ar" dir="rtl">
              كبوط ديناري
            </span>
            <span aria-hidden="true"> · </span>
            <span>{place}</span>
          </p>
        </div>
      </div>
      <SoundToggle className="cafe-header__sound" />
    </header>
  );
}

/** Le pied de page : qui a développé le jeu. */
export function SiteFooter() {
  return (
    <footer className="site-footer">
      Ce jeu est développé par{' '}
      <a href="https://www.linkedin.com/in/souhayl-othman/" target="_blank" rel="noopener noreferrer">
        Souhayl Othman
      </a>
    </footer>
  );
}
