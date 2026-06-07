import type { AppZustand } from '../store/AppStore';
import { appStore } from '../anwendung';

/**
 * Zeigt das In-App-Bugreport-Dialog-Overlay an.
 * Sammelt Beschreibung + Schweregrad; technischer Kontext wird automatisch ergaenzt.
 * Verhindert doppeltes Oeffnen per ID-Guard.
 */
export function zeigeBugreportDialog(zustand: AppZustand): void {
  if (document.getElementById('bugreport-backdrop')) return;

  const backdrop = document.createElement('div');
  backdrop.id = 'bugreport-backdrop';
  backdrop.className = 'ui-modal-backdrop';
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');
  backdrop.setAttribute('aria-labelledby', 'bugreport-titel');

  const modal = document.createElement('div');
  modal.className = 'ui-modal';
  modal.style.cssText = 'max-width:520px;padding:24px;';
  modal.innerHTML = [
    '<h2 id="bugreport-titel" style="margin:0 0 16px;color:#ffd700;font-size:18px;">',
    '&#x1F41E; Bug melden</h2>',
    '<label style="display:block;margin-bottom:4px;font-size:13px;color:#7a5a9a;">Schweregrad</label>',
    '<select id="bugreport-schweregrad"',
    ' style="width:100%;margin-bottom:12px;padding:6px 8px;background:#221530;',
    'color:#f0e6ff;border:1px solid #4a2d6a;border-radius:4px;font-size:14px;">',
    '<option value="NIEDRIG">Niedrig — kleine Unannehmlichkeit</option>',
    '<option value="MITTEL" selected>Mittel — beeinträchtigt das Spiel</option>',
    '<option value="HOCH">Hoch — Spiel nicht nutzbar</option>',
    '<option value="KRITISCH">Kritisch — Datenverlust / Sicherheit</option>',
    '</select>',
    '<label style="display:block;margin-bottom:4px;font-size:13px;color:#7a5a9a;">Beschreibung</label>',
    '<textarea id="bugreport-beschreibung" rows="5"',
    ' style="width:100%;box-sizing:border-box;padding:8px;background:#221530;color:#f0e6ff;',
    'border:1px solid #4a2d6a;border-radius:4px;font-size:14px;resize:vertical;"',
    ' placeholder="Was ist passiert? Wie kann man es reproduzieren?"></textarea>',
    '<p style="margin:6px 0 0;font-size:11px;color:#7a5a9a;">',
    'Technischer Kontext (Correlation-IDs, Tisch, Session) wird automatisch erfasst.',
    ' Keine Screenshots oder fremde Spielerdaten.</p>',
    '<p id="bugreport-status" style="margin:8px 0;min-height:20px;font-size:13px;color:#44ff88;"></p>',
    '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">',
    '<button id="bugreport-abbrechen"',
    ' style="padding:8px 16px;background:transparent;color:#b8a8d0;border:1px solid #7a5a9a;',
    'border-radius:4px;cursor:pointer;">Abbrechen</button>',
    '<button id="bugreport-senden"',
    ' style="padding:8px 16px;background:#ef4444;color:#fff;border:none;',
    'border-radius:4px;cursor:pointer;font-weight:bold;">Bug melden</button>',
    '</div>',
  ].join('');

  backdrop.appendChild(modal);
  const uiRoot = document.getElementById('ui-root');
  if (!uiRoot) return;
  uiRoot.appendChild(backdrop);

  const textarea = modal.querySelector('#bugreport-beschreibung') as HTMLTextAreaElement;
  const schweregrad = modal.querySelector('#bugreport-schweregrad') as HTMLSelectElement;
  const statusEl = modal.querySelector('#bugreport-status') as HTMLParagraphElement;
  const sendenBtn = modal.querySelector('#bugreport-senden') as HTMLButtonElement;
  const abbrechenBtn = modal.querySelector('#bugreport-abbrechen') as HTMLButtonElement;

  const schliessen = () => {
    backdrop.remove();
    document.removeEventListener('keydown', escHandler);
  };
  const escHandler = (e: KeyboardEvent) => {
    if (e.key === 'Escape') schliessen();
  };
  document.addEventListener('keydown', escHandler);
  backdrop.addEventListener('click', (e) => { if (e.target === backdrop) schliessen(); });
  abbrechenBtn.addEventListener('click', schliessen);

  sendenBtn.addEventListener('click', () => {
    const beschreibung = textarea.value.trim();
    if (!beschreibung) {
      statusEl.style.color = '#ff4455';
      statusEl.textContent = 'Bitte eine Beschreibung eingeben.';
      return;
    }
    sendenBtn.disabled = true;
    statusEl.style.color = '#44ff88';
    statusEl.textContent = 'Wird gesendet…';

    const zustandZusammenfassung = JSON.stringify({
      bereich: zustand.bereich,
      verbindung: zustand.verbindung,
      debugModus: zustand.debugModus,
      authentifiziert: zustand.authentifiziert,
      spielerId: zustand.spieler?.spielerId ?? null,
      tischId: zustand.aktuellerTisch?.id ?? null,
      partieId: zustand.aktuellerTisch?.partieId
        ?? zustand.partieStand?.partieId
        ?? null,
    });

    appStore.meldeBugReport({
      beschreibung,
      schweregrad: schweregrad.value,
      correlationIds: [...zustand.correlationIds],
      tischId: zustand.aktuellerTisch?.id ?? null,
      partieId: zustand.aktuellerTisch?.partieId
        ?? zustand.partieStand?.partieId
        ?? null,
      userAgent: navigator.userAgent,
      viewport: `${window.innerWidth}x${window.innerHeight}`,
      buildSha: (import.meta.env.VITE_GIT_SHA as string | undefined) ?? null,
      zustandZusammenfassung,
    })
      .then((antwort) => {
        const issueHinweis = antwort?.issueUrl ? ` Issue: ${antwort.issueUrl}` : '';
        statusEl.textContent = `Bug gemeldet! Danke.${issueHinweis}`;
        setTimeout(schliessen, 2000);
      })
      .catch(() => {
        statusEl.style.color = '#ff4455';
        statusEl.textContent = 'Senden fehlgeschlagen. Bitte nochmal versuchen.';
        sendenBtn.disabled = false;
      });
  });

  textarea.focus();
}
