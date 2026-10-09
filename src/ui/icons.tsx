const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true } as const;

export function MicIcon() {
  return (
    <svg {...base}>
      <rect x="9" y="2" width="6" height="12" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8" />
    </svg>
  );
}

export function MicOffIcon({ size = 22 }: { readonly size?: number }) {
  return (
    <svg {...base} width={size} height={size}>
      <path d="M15 9.3V5a3 3 0 0 0-5.7-1.3M9 9v3a3 3 0 0 0 5.1 2.1M19 10a7 7 0 0 1-1.2 3.9M5 10a7 7 0 0 0 11.6 5.3M12 17v4M8 21h8M3 3l18 18" />
    </svg>
  );
}

export function HangUpIcon() {
  return (
    <svg {...base}>
      <path d="M3 15.5c5-4.7 13-4.7 18 0l-2.3 2.6-3.4-1.7v-2.6a12 12 0 0 0-6.6 0v2.6l-3.4 1.7z" />
    </svg>
  );
}

export function SpeakerIcon() {
  return (
    <svg {...base}>
      <path d="M11 5 6 9H3v6h3l5 4zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" />
    </svg>
  );
}
