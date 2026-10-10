/** Affiche un texte d'annonce (« 110 ♦ ») avec les symboles cœur et carreau en rouge. */
export function SuitText({ text }: { readonly text: string }) {
  return (
    <>
      {text.split(/([♥♦])/).map((part, i) =>
        part === '♥' || part === '♦' ? (
          <span key={i} className="suit-red">
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}
