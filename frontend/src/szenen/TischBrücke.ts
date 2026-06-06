import { appStore } from '../anwendung';
import '../e2eBruecke';
import type { TischSzene } from './TischSzene';

/** Richtet die window.__locodoko E2E-Bridge-API fuer Playwright-Tests ein. */
export function richteE2EBrückeEin(szene: TischSzene): void {
  const bridge = window.__locodoko;

  if (!bridge) return;

  bridge.setzeAnimationsGeschwindigkeit = (f: number) => {
    szene.animationsGeschwindigkeit = f as typeof szene.animationsGeschwindigkeit;
    szene.animationen?.setzeGeschwindigkeitsfaktor(f);
    szene.flashTextManager?.setzeGeschwindigkeitsfaktor(f);
    if (f >= 50) {
      appStore.setzeKiKartenVerzögerung(0);
    }
  };
  bridge.setzeKiVerzoegerung = (ms: number) => appStore.setzeKiKartenVerzögerung(ms);
  bridge.isOverlaySichtbar = () => {
    const rSichtbar = !!szene.rundenEndeController?.phaserRundenEndeModal;
    const pSichtbar = !!szene.rundenEndeController?.phaserPartieEndeModal;
    return rSichtbar || pSichtbar || szene.einstellungenOffen || szene.isSpielprotokollOffen();
  };
  bridge.isIdle = (ignoreStore = false) => szene.isIdle(ignoreStore);
  bridge.getHudState = () => {
    const zustand = szene.letzterZustand;
    const modell = szene.letztesModell;
    const stichAnzahl = modell?.spieler.reduce((sum, s) => sum + s.stiche, 0) ?? 0;
    const maxStiche = zustand?.aktuellerTisch?.konfiguration.ohneNeunen ? 10 : 12;
    return {
      stichzaehler: modell?.spieltyp ? `Stich ${stichAnzahl}/${maxStiche}` : '',
      spieltyp: modell?.spieltyp ?? '',
      startBtnSichtbar: !!(zustand?.aktuellerTisch?.status === 'WARTEND' && zustand?.spieler?.spielerId === zustand?.aktuellerTisch?.erstelltVonSpielerId),
      rundenEndeSichtbar: !!szene.rundenEndeController?.phaserRundenEndeModal,
    };
  };
  bridge._rundenEndeModalGezeigt = 0;
  bridge._letzterFlashTyp = undefined;
  if (szene.flashTextManager) {
    const originalZeige = szene.flashTextManager.zeigeSpielevent.bind(szene.flashTextManager);
    szene.flashTextManager.zeigeSpielevent = async (event, payload) => {
      bridge._letzterFlashTyp = event;
      return originalZeige(event, payload);
    };
  }
  bridge.schliesseRundenEndeModal = () => szene.rundenEndeController?.schliesseRundenEndeModal();
  bridge.toggleSpielprotokoll = () => {
    if (szene.letztesModell && szene.letzterZustand) {
      szene.toggleSpielprotokoll(szene.letztesModell, szene.letzterZustand);
    }
  };
  bridge.zeigeLetztesStichOverlay = () => {
    if (szene.letztesModell && szene.letzterZustand && szene.kartenRenderer) {
      const letzterStich = szene.letztesModell.letzteAbgeschlosseneStiche.find(s => s.gewinnerPosition === 'SUED')
        || szene.letztesModell.letzteAbgeschlosseneStiche[0];
      if (letzterStich) {
        szene.kartenRenderer.zeigeLetztesStichOverlay(letzterStich, szene.scale.width, szene.scale.height);
      }
    }
  };
  bridge.isPartieEndeModalSichtbar = () => !!szene.rundenEndeController?.phaserPartieEndeModal;
  bridge.schliessePartieEndeModal = () => szene.rundenEndeController?.schliessePartieEndeModal();
}
