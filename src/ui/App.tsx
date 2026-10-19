import { useEffect, useState } from 'react';
import { createDeck } from '../engine/index.ts';
import { preloadCards } from './CardView.tsx';
import { Home } from './Home.tsx';
import { CafeVisit } from './map/CafeVisit.tsx';
import type { VisitCafeId } from './map/CafeVisit.tsx';
import { TownMap } from './map/TownMap.tsx';
import { LocalGame } from './LocalGame.tsx';
import { OnlineRoom } from './online/OnlineRoom.tsx';
import { WatchRoom } from './online/WatchRoom.tsx';
import { loadNickname, loadSavedRoom, saveNickname, saveRoom, sendRequest } from './online/client.ts';
import type { SavedRoom } from './online/client.ts';

type Screen =
  | { readonly kind: 'map' }
  | { readonly kind: 'visit'; readonly cafe: VisitCafeId }
  | { readonly kind: 'home' }
  | { readonly kind: 'local'; readonly targetScore: number }
  | { readonly kind: 'online'; readonly room: SavedRoom }
  | { readonly kind: 'watch'; readonly roomId: string; readonly table: number; readonly listen: boolean };

function inviteCodeFromUrl(): string {
  return new URLSearchParams(window.location.search).get('salon')?.toUpperCase() ?? '';
}

function clearInviteFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has('salon')) return;
  url.searchParams.delete('salon');
  window.history.replaceState(null, '', url);
}

export function App() {
  // On arrive sur la carte de Oudhref ; avec un lien d'invitation, directement au café.
  const [screen, setScreen] = useState<Screen>(() => (inviteCodeFromUrl() ? { kind: 'home' } : { kind: 'map' }));
  const [nickname, setNickname] = useState(loadNickname);
  const [savedRoom, setSavedRoom] = useState<SavedRoom | null>(loadSavedRoom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => preloadCards(createDeck().map((c) => c.id)), []);

  const enterRoom = async (request: { type: 'create'; table: number } | { type: 'join'; code: string }) => {
    setBusy(true);
    setError(null);
    const name = nickname.trim() || 'Joueur';
    saveNickname(name);
    const result = await sendRequest({ ...request, nickname: name });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      if (request.type === 'join' && savedRoom?.code === request.code) {
        saveRoom(null);
        setSavedRoom(null);
      }
      return;
    }
    const room = { roomId: result.roomId, code: result.code };
    saveRoom(room);
    setSavedRoom(room);
    clearInviteFromUrl();
    setScreen({ kind: 'online', room });
  };

  /** Le spectateur s'inscrit avec son nom ; le serveur vérifie que les joueurs l'acceptent. */
  const watch = async (roomId: string, table: number) => {
    setBusy(true);
    setError(null);
    const name = nickname.trim() || 'Spectateur';
    saveNickname(name);
    const result = await sendRequest({ type: 'watch', roomId, nickname: name });
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setScreen({ kind: 'watch', roomId, table, listen: result.listen === true });
  };

  if (screen.kind === 'local') {
    return <LocalGame targetScore={screen.targetScore} onExit={() => setScreen({ kind: 'home' })} />;
  }

  if (screen.kind === 'watch') {
    return (
      <WatchRoom
        key={screen.roomId}
        roomId={screen.roomId}
        tableNumber={screen.table}
        listen={screen.listen}
        onExit={() => {
          // On se désinscrit (sans attendre) : les joueurs ne voient plus son nom.
          void sendRequest({ type: 'unwatch', roomId: screen.roomId });
          setScreen({ kind: 'home' });
        }}
      />
    );
  }

  if (screen.kind === 'online') {
    return (
      <OnlineRoom
        key={screen.room.roomId}
        roomId={screen.room.roomId}
        onExit={(forget) => {
          if (forget) {
            saveRoom(null);
            setSavedRoom(null);
          }
          setScreen({ kind: 'home' });
        }}
      />
    );
  }

  if (screen.kind === 'visit') {
    return <CafeVisit key={screen.cafe} cafe={screen.cafe} onMap={() => setScreen({ kind: 'map' })} onTarek={() => setScreen({ kind: 'home' })} />;
  }

  if (screen.kind === 'map') {
    return (
      <TownMap
        savedRoom={savedRoom}
        busy={busy}
        error={error}
        onResume={(room) => void enterRoom({ type: 'join', code: room.code })}
        onEnter={(cafe) => setScreen(cafe === 'garage' || cafe === 'chouaa' ? { kind: 'visit', cafe } : { kind: 'home' })}
      />
    );
  }

  return (
    <Home
      nickname={nickname}
      onNickname={setNickname}
      initialCode={inviteCodeFromUrl()}
      savedRoom={savedRoom}
      busy={busy}
      error={error}
      onLocal={(targetScore) => setScreen({ kind: 'local', targetScore })}
      onCreate={(table) => void enterRoom({ type: 'create', table })}
      onWatch={(roomId, table) => void watch(roomId, table)}
      onJoin={(code) => void enterRoom({ type: 'join', code })}
      onResume={(room) => void enterRoom({ type: 'join', code: room.code })}
      onMap={() => setScreen({ kind: 'map' })}
    />
  );
}
