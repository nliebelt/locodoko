import { appStore } from '../anwendung';
import { nameplatePositionFuer } from './layout';
import type { TischSzene } from './TischSzene';

/**
 * Richtet alle drei AppStore-Abonnements ein und gibt eine kombinierte Abmeldefunktion zurueck.
 * Kapselt die Event-, Store- und Sonderpunkte-Subscriptions aus TischSzene.create().
 */
export function richteStoreAbonnementsEin(szene: TischSzene): () => void {
  const abmeldenEvents = appStore.abonniereEvents(async (e) => {
    await szene.ereignisHandler.verarbeitePartieEreignis(e);
    void szene.animationen?.reiheEin(() => Promise.resolve())
      .then(() => { if (szene.sys?.displayList) szene.triggerRender(); })
      .catch(() => { /* Szene wurde zerstört */ });
  });

  // Wrapper-Objekt erlaubt Self-Referenz auch bei synchronem initialem Callback-Aufruf
  const abmeldung: { store?: () => void } = {};
  abmeldung.store = appStore.abonniere((zustand) => {
    if (zustand.bereich === 'SPIELVERWALTUNG') {
      abmeldung.store?.();
      abmeldenEvents();
      szene.scene.start('SpielverwaltungsSzene');
      return;
    }
    if (!zustand.aktuellerTisch && szene.letzterZustand?.aktuellerTisch) {
      szene.initialisiereZustand();
    }
    const modell = szene.erstelleModell(zustand);
    szene.zustandsKontroller.synchronisiereAnimationszustand(modell, zustand);
    szene.letzterZustand = zustand;
    szene.letztesModell = modell;
    szene.aktualisiereUi(zustand, modell);

    if (szene._zeigeOverlayNachSnapshot && zustand.aktuellerTisch && modell.letztesSpielergebnis) {
      const { partieBeendet } = szene._zeigeOverlayNachSnapshot;
      szene._zeigeOverlayNachSnapshot = null;
      appStore.pausiereQueue();
      if (partieBeendet) {
        szene.rundenEndeController.zeigePartieEndeModal(modell);
      } else {
        void szene.rundenEndeController.zeigeRundenEndeModal(modell);
      }
    }

    szene.triggerRender();
  });

  const abmeldenSonderpunkte = appStore.abonniereSonderpunkte((sp) => {
    for (const s of sp) {
      const gewinnerSpieler = szene.letztesModell?.spieler.find(p => p.absolutePosition === s.gewinner);
      const name = gewinnerSpieler?.name;
      const { width: b, height: h } = szene.scale.gameSize;
      const pos = nameplatePositionFuer(s.gewinner, b, h);

      switch (s.typ) {
        case 'FUCHS_GEFANGEN':
          szene.animationen?.reiheEin(async () => {
            await szene.flashTextManager?.zeigeSpielevent('FuchsGefangen', { spielerName: name, x: pos.x, y: pos.y });
          });
          if (gewinnerSpieler) szene.nameplates.get(gewinnerSpieler.position)?.shake();
          break;
        case 'KARLCHEN':
          szene.animationen?.reiheEin(async () => {
            await szene.flashTextManager?.zeigeSpielevent('KarlchenGespielt', { spielerName: name, x: pos.x, y: pos.y });
          });
          if (gewinnerSpieler) szene.nameplates.get(gewinnerSpieler.position)?.shake();
          break;
        case 'DOPPELKOPF':
          szene.animationen?.reiheEin(async () => {
            await szene.flashTextManager?.zeigeSpielevent('DoppelkopfGestochen', { x: pos.x, y: pos.y });
          });
          break;
      }
    }
  });

  return () => { abmeldung.store?.(); abmeldenEvents(); abmeldenSonderpunkte(); };
}
