import { MusicControls } from './MusicControls.tsx';

export interface MenuAction {
  readonly label: string;
  readonly onClick: () => void;
  readonly danger?: boolean;
  readonly hint?: string;
}

/** Menu ☰ de la partie : musique (volume, couper) et les façons de quitter. */
export function GameMenu({ actions, onClose }: { readonly actions: readonly MenuAction[]; readonly onClose: () => void }) {
  return (
    <div className="overlay" role="dialog" aria-modal="true" aria-labelledby="game-menu-title" onClick={onClose}>
      <div className="dialog game-menu" onClick={(e) => e.stopPropagation()}>
        <h2 id="game-menu-title" className="dialog__title">
          Menu
        </h2>
        <MusicControls mood="game" />
        <div className="game-menu__actions">
          {actions.map((action) => (
            <div key={action.label} className="game-menu__action">
              <button type="button" className={`btn btn--wide ${action.danger ? 'btn--danger' : 'btn--ghost'}`} onClick={action.onClick}>
                {action.label}
              </button>
              {action.hint && <p className="dialog__note">{action.hint}</p>}
            </div>
          ))}
        </div>
        <button type="button" className="btn btn--primary btn--wide" onClick={onClose} autoFocus>
          Reprendre la partie
        </button>
      </div>
    </div>
  );
}
