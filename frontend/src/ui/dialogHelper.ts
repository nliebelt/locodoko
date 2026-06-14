/**
 * Installiert Accessibility-Standardverhalten für einen Dialog:
 * - Escape schließt den Dialog
 * - Tab zirkuliert innerhalb der fokussierbaren Elemente (Fokus-Trap)
 * - Fokus kehrt nach Schließen zum auslösenden Element zurück
 *
 * Muss VOR dem ersten focus()-Aufruf gerufen werden, damit fokusMerker
 * den Zustand vor dem Dialog-Öffnen erfasst.
 *
 * @returns Aufräumfunktion — muss in der Schließ-Routine aufgerufen werden
 */
export function installiereDialogA11y(
  container: HTMLElement,
  schliessen: () => void,
): () => void {
  const fokusMerker = document.activeElement as HTMLElement | null;

  const fokusTrapHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      schliessen();
      return;
    }
    if (e.key !== 'Tab') return;

    const fokussierbar = Array.from(
      container.querySelectorAll<HTMLElement>(
        'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])',
      ),
    );
    if (fokussierbar.length === 0) return;

    const erstes = fokussierbar[0];
    const letztes = fokussierbar[fokussierbar.length - 1];

    if (e.shiftKey && document.activeElement === erstes) {
      e.preventDefault();
      letztes.focus();
    } else if (!e.shiftKey && document.activeElement === letztes) {
      e.preventDefault();
      erstes.focus();
    }
  };

  document.addEventListener('keydown', fokusTrapHandler);

  return () => {
    document.removeEventListener('keydown', fokusTrapHandler);
    fokusMerker?.focus();
  };
}
