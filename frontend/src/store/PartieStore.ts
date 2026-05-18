import type {
  KarteGespieltEreignis,
  PartieEreignisAntwort,
  PartieEreignisBatch,
  PartieStandAntwort,
  SpielerPosition,
  Uuid
} from '../modelle/SpielverwaltungDto';
import type { EchtzeitPort } from '../services/SpielverwaltungEchtzeit';
import { Logger } from '../logger';
import type { AppZustand, PartieEreignisListener, SonderpunkteListener } from './StoreTypen';

/**
 * Verwaltet die Partie-Ereignis-Warteschlange, WebSocket-Abonnements für Partie-Kanäle
 * und das Sequential-Processing-Pattern für Animations-Events.
 */
export class PartieStore {
  private readonly _sonderpunkteListener = new Set<SonderpunkteListener>();
  readonly _eventListener = new Set<PartieEreignisListener>();
  _eventQueue: PartieEreignisAntwort[] = [];
  _verarbeiteEventLaeuft = false;
  _queuePausiert = false;
  private _aktuelleSequenzId = 0;
  _queueGeneration = 0;
  _verpassterSpielBeendet: PartieEreignisAntwort | null = null;
  _letztePartieVersion = -1;
  private _reconnect: ((tischId: Uuid) => void) | null = null;

  constructor(
    private readonly echtzeit: EchtzeitPort,
    private readonly patchFn: (aenderungen: Partial<AppZustand>) => void,
    private readonly gibZustand: () => AppZustand
  ) {}

  setzeReconnectCallback(cb: (tischId: Uuid) => void): void {
    this._reconnect = cb;
  }

  pausiereQueue(): void {
    this._queuePausiert = true;
  }

  setzeQueueFort(): void {
    this._queuePausiert = false;
    void this._verarbeiteEventQueue();
  }

  isIdle(): boolean {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- E2E Bridge Pattern
    const loco = (window as any).__locodoko;
    if (loco) {
      loco._storeIdleDebug = {
        queuePausiert: this._queuePausiert,
        eventQueueLength: this._eventQueue.length,
        verarbeiteEventLaeuft: this._verarbeiteEventLaeuft
      };
    }
    if (this._queuePausiert) return true;
    return this._eventQueue.length === 0 && !this._verarbeiteEventLaeuft;
  }

  abonniereEvents(listener: PartieEreignisListener): () => void {
    this._eventListener.add(listener);
    if (this._verpassterSpielBeendet) {
      const verpasst = this._verpassterSpielBeendet;
      this._verpassterSpielBeendet = null;
      void Promise.resolve().then(async () => {
        const res = listener(verpasst);
        if (res instanceof Promise) await res;
      });
    }
    return () => {
      this._eventListener.delete(listener);
      if (this._eventListener.size === 0) this._verpassterSpielBeendet = null;
    };
  }

  abonniereSonderpunkte(listener: SonderpunkteListener): () => void {
    this._sonderpunkteListener.add(listener);
    return () => this._sonderpunkteListener.delete(listener);
  }

  /** Registriert WebSocket-Abonnement für Partie-Kanal; gibt Abmeldefunktion zurück. */
  registrierePartieAbos(partieId: Uuid): () => void {
    const unsubscribe = this.echtzeit.abonnieren<PartieEreignisBatch>(`/user/queue/partie/${partieId}`, (batch) => {
      this.verarbeitePartieBatch(batch);
    });
    this.echtzeit.senden(`/app/partie/${partieId}/snapshot`);
    return unsubscribe;
  }

  verarbeitePartieBatch(batch: PartieEreignisBatch): void {
    Logger.websocket(`Empfange PartieBatch: v=${batch.version}, ${batch.ereignisse.length} Ereignis(se)`, batch);

    const ersteEreignisTyp = batch.ereignisse[0]?.ereignisTyp;
    const erstePartieId = batch.ereignisse[0]?.partieStand?.partieId ?? null;
    const istSnapshot = ersteEreignisTyp === 'SNAPSHOT';
    const istNeuePartie = erstePartieId != null && erstePartieId !== this.gibZustand().partieStand?.partieId;

    if (!istNeuePartie && !istSnapshot && this._letztePartieVersion >= 0) {
      if (batch.version > this._letztePartieVersion + 1) {
        Logger.error(`Batch-Sequenzluecke: Erwartet v=${this._letztePartieVersion + 1}, erhalten v=${batch.version}`);
        const tischId = this.gibZustand().aktuellerTisch?.id;
        if (tischId && this._reconnect) this._reconnect(tischId);
        return;
      }
    }

    if (!istNeuePartie && batch.version < this._letztePartieVersion) {
      Logger.websocket('Verwerfe veralteten Batch', { batchVersion: batch.version, letzte: this._letztePartieVersion });
      return;
    }

    this._letztePartieVersion = batch.version;
    batch.ereignisse.forEach(e => this._eventQueue.push(e));
    void this._verarbeiteEventQueue();
  }

  resetPartieZustand(): void {
    this._letztePartieVersion = -1;
    this._aktuelleSequenzId++;
    this._queueGeneration++;
    this._eventQueue.length = 0;
    this._verarbeiteEventLaeuft = false;
    this._queuePausiert = false;
    this._verpassterSpielBeendet = null;
  }

  async _verarbeiteEventQueue(): Promise<void> {
    if (this._verarbeiteEventLaeuft || this._queuePausiert) return;
    this._verarbeiteEventLaeuft = true;
    try {
      while (this._eventQueue.length > 0 && !this._queuePausiert) {

        // Quiescence Pattern: Warten bis alle Animationen/Szenen-Logik des VORHERIGEN Events beendet sind
        if (typeof window !== 'undefined') {
          const locodoko = (window as { __locodoko?: { isIdle?: (f: boolean) => boolean } }).__locodoko;
          if (locodoko && typeof locodoko.isIdle === 'function') {
            while (!locodoko.isIdle(true) && !this._queuePausiert && this._eventQueue.length > 0) {
              await new Promise<void>((r) => setTimeout(r, 50));
            }
          }
        }

        if (this._queuePausiert || this._eventQueue.length === 0) break;

        const ereignis = this._eventQueue.shift();
        if (!ereignis) break;

        const darfStorePatchen = !!ereignis.partieStand && this._darfPartieStandAktualisieren(ereignis.partieStand, ereignis.version);
        if (!darfStorePatchen && ereignis.partieStand) {
          Logger.websocket('Verarbeite Ereignis ohne Store-Patch (neuerer Snapshot vorhanden)', {
            typ: ereignis.ereignisTyp,
            version: ereignis.version,
            storeVersion: this.gibZustand().partieStand?.version
          });
        }

        this._aktuelleSequenzId++;

        if (ereignis.ereignisTyp === 'SPIEL_BEENDET') {
          if (this._eventListener.size === 0) {
            this._verpassterSpielBeendet = ereignis;
          } else {
            this._verpassterSpielBeendet = null;
          }
        }

        // KI-Verzögerung: Menschlicheres Spielgefühl bei KI-Kartenzügen (nur wenn Menschen am Tisch sind).
        if (ereignis.ereignisTyp === 'KARTE_GESPIELT' && this.gibZustand().uiKonfiguration.kiVerzoegerungMs > 0) {
          const spielerImSpiel = this.gibZustand().partieStand?.laufendesSpiel?.spieler ?? [];
          const istKiZug = spielerImSpiel.find(s => s.position === (ereignis as KarteGespieltEreignis).spielerPosition)?.istKi ?? false;
          const hatMenschlicheSpieler = this.gibZustand().aktuellerTisch?.spieler.some(s => !s.istKi);
          if (istKiZug && hatMenschlicheSpieler) {
            const generationVorDelay = this._queueGeneration;
            await new Promise<void>((r) => setTimeout(r, this.gibZustand().uiKonfiguration.kiVerzoegerungMs));
            if (this._queuePausiert || this._queueGeneration !== generationVorDelay) break;
          }
        }

        // State VOR den Listenern patchen für flüssige Übergänge (KARTE_GESPIELT)
        const prevStand = this.gibZustand().partieStand;
        if (darfStorePatchen) {
          if (ereignis.ereignisTyp === 'KARTE_GESPIELT') {
            if (prevStand) {
              const syntheticStand = this._synthetischerKarteGespielt(prevStand, ereignis as KarteGespieltEreignis);
              this.patchFn({ partieStand: syntheticStand });
            } else {
              this.patchFn({ partieStand: ereignis.partieStand });
            }
          } else if (ereignis.partieStand && ereignis.ereignisTyp !== 'STICH_ABGESCHLOSSEN' && ereignis.ereignisTyp !== 'SPIEL_BEENDET') {
            this.patchFn({ partieStand: ereignis.partieStand });
          }
        }

        try {
          for (const l of this._eventListener) {
            const res = l(ereignis);
            if (res instanceof Promise) await res;
          }
        } catch (e) {
          Logger.error('Event-Listener hat einen Fehler geworfen', e);
        }

        switch (ereignis.ereignisTyp) {
          case 'SNAPSHOT':
            this._eventQueue.length = 0;
            break;
          case 'KARTE_GESPIELT':
            break;
          case 'STICH_ABGESCHLOSSEN': {
            if (darfStorePatchen) this.patchFn({ partieStand: ereignis.partieStand });
            if (ereignis.neueSonderpunkte.length) this._sonderpunkteListener.forEach((l) => l(ereignis.neueSonderpunkte));
            break;
          }
          case 'SPIEL_BEENDET': {
            if (darfStorePatchen) this.patchFn({ partieStand: ereignis.partieStand });
            const erg = ereignis.partieStand.letztesSpielergebnis;
            if (erg) {
              const zustand = this.gibZustand();
              const geber = zustand.partieStand?.laufendesSpiel?.geber ?? 'SUED';
              const istBockrunde = (zustand.partieStand?.laufendesSpiel?.bockrundenZaehler ?? 0) > 0;
              const punkteProSpieler = {} as Record<string, { pkt: number; stand: number }>;
              Object.keys(erg.spielpunkteProSpieler).forEach((pos) => {
                punkteProSpieler[pos] = {
                  pkt: erg.spielpunkteProSpieler[pos as SpielerPosition] ?? 0,
                  stand: ereignis.partieStand.gesamtpunktestand?.[pos as SpielerPosition] ?? 0
                };
              });
              this.patchFn({
                spielProtokollEintraege: [
                  ...zustand.spielProtokollEintraege,
                  {
                    nr: erg.spielNummer,
                    geber,
                    spieltyp: erg.spieltyp,
                    istBockrunde,
                    punkteProSpieler
                  }
                ]
              });
            }
            break;
          }
          case 'ANSAGE_ERFOLGT':
          case 'SCHWEINCHEN_GEMELDET':
          case 'HOCHZEIT_PARTNER_GEFUNDEN':
          case 'SPIEL_GESTARTET':
          case 'AKTION_ABGELEHNT':
            break;
        }
      }
    } finally {
      this._verarbeiteEventLaeuft = false;
    }
  }

  private _synthetischerKarteGespielt(prevStand: PartieStandAntwort, ereignis: KarteGespieltEreignis): PartieStandAntwort {
    if (!prevStand.laufendesSpiel || !ereignis.partieStand.laufendesSpiel) return prevStand;
    const kartenInMitte = [...(prevStand.laufendesSpiel.aktuelleStichmitte ?? [])];
    const maxReihenfolge = kartenInMitte.reduce((max, k) => Math.max(max, k.reihenfolge ?? 0), 0);
    if (!kartenInMitte.some(k => k.spielerPosition === ereignis.spielerPosition)) {
      const [farbe, wert, idx] = ereignis.karteId.split('-');
      kartenInMitte.push({
        spielerPosition: ereignis.spielerPosition,
        karte: { id: ereignis.karteId, farbe: farbe ?? '', wert: wert ?? '', exemplarIndex: parseInt(idx ?? '0', 10) },
        reihenfolge: maxReihenfolge + 1,
      });
    }
    return {
      ...ereignis.partieStand,
      laufendesSpiel: {
        ...ereignis.partieStand.laufendesSpiel,
        aktuelleStichmitte: kartenInMitte,
      }
    };
  }

  _darfPartieStandAktualisieren(neuerStand: PartieStandAntwort, neueVersion: number): boolean {
    const aktuellePartieId = this.gibZustand().partieStand?.partieId;
    if (neuerStand.partieId !== aktuellePartieId) return true;
    const aktuelleStoreVersion = this.gibZustand().partieStand?.version ?? -1;
    const darfPatchen = neueVersion >= aktuelleStoreVersion;
    if (!darfPatchen) {
      Logger.websocket('PartieStand-Patch abgelehnt (veraltet)', {
        neueVersion,
        aktuelleStoreVersion,
        partieId: neuerStand.partieId
      });
    }
    return darfPatchen;
  }
}
