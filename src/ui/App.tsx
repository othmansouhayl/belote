import { useState } from 'react';
import { Home } from './Home.tsx';
import { LocalGame } from './LocalGame.tsx';
import { OnlineRoom } from './online/OnlineRoom.tsx';
import { loadNickname, loadSavedRoom, saveNickname, saveRoom, sendRequest } from './online/client.ts';
import type { SavedRoom } from './online/client.ts';

type Screen = { readonly kind: 'home' } | { readonly kind: 'local' } | { readonly kind: 'online'; readonly room: SavedRoom };

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
  const [screen, setScreen] = useState<Screen>({ kind: 'home' });
  const [nickname, setNickname] = useState(loadNickname);
  const [savedRoom, setSavedRoom] = useState<SavedRoom | null>(loadSavedRoom);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const enterRoom = async (request: { type: 'create' } | { type: 'join'; code: string }) => {
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

  if (screen.kind === 'local') return <LocalGame onExit={() => setScreen({ kind: 'home' })} />;

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

  return (
    <Home
      nickname={nickname}
      onNickname={setNickname}
      initialCode={inviteCodeFromUrl()}
      savedRoom={savedRoom}
      busy={busy}
      error={error}
      onLocal={() => setScreen({ kind: 'local' })}
      onCreate={() => void enterRoom({ type: 'create' })}
      onJoin={(code) => void enterRoom({ type: 'join', code })}
      onResume={(room) => void enterRoom({ type: 'join', code: room.code })}
    />
  );
}
