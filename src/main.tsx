import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 16 }}>
      <h1>Belote coinchée tunisienne</h1>
      <p>La table de jeu arrive en phase 2.</p>
    </main>
  </StrictMode>,
);
