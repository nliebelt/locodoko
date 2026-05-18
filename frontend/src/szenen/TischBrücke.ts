import { appStore } from '../anwendung';
import type { TischSzene } from './TischSzene';

/** Richtet die window.__locodoko E2E-Bridge-API fuer Playwright-Tests ein. */
export function richteE2EBrückeEin(szene: TischSzene): void {
  const bridge = (window as {
    __locodoko?: {
      setzeAnimationsGeschwindigkeit?: (f: number) => void;
      setzeKiVerzoegerung?: (ms: number) => void;
      isOverlaySichtbar?: () => boolean;
      isIdle?: (ignoreStore?: boolean) => boolean;
      getHudState?: () => { stichzaehler: string; spieltyp: string; startBtnSichtbar: boolean; rundenEndeSichtbar: boolean };
      schliesseRundenEndeModal?: () => void;
      _rundenEndeModalGezeigt?: number;
    };
  }).__locodoko;

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
  bridge.schliesseRundenEndeModal = () => szene.rundenEndeController?.schliesseRundenEndeModal();
}
