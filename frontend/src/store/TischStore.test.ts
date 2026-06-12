import { describe, expect, it, vi } from 'vitest';
import type {
  PartieStandAntwort,
  TischAntwort,
  TischEreignisAntwort,
  TischKonfigurationDto
} from '../modelle/SpielverwaltungDto';
import type { SpielverwaltungApi } from '../services/SpielverwaltungApi';
import { SpielverwaltungFehler } from '../services/SpielverwaltungApi';
import type { EchtzeitPort } from '../services/SpielverwaltungEchtzeit';
import { erzeugeAnfangszustand } from './StoreTypen';
import type { AppZustand } from './StoreTypen';
import { TischStore } from './TischStore';

const FAKE_KONFIGURATION: TischKonfigurationDto = {
  ohneNeunen: false,
  anzahlSpiele: 12,
  tischhintergrund: 'FILZ_GRUEN',
  hochzeitErlaubt: true,
  armutErlaubt: true,
  damensoloErlaubt: true,
  bubensoloErlaubt: true,
  fleischlosErlaubt: true,
  trumpfsoloErlaubt: true,
  zweiteDulleSticht: false,
  fuchsGefangenAktiv: true,
  karlchenAktiv: true,
  doppelkopfAktiv: true,
  mindestkartenReKontra: 0,
  mindestkartenKeine90: 0,
  mindestkartenKeine60: 0,
  mindestkartenKeine30: 0,
  mindestkartenSchwarz: 0,
  bockrundenAktiv: false,
  schweinchenAktiv: true,
  dreissigAugenPflichtAktiv: false,
  schmeissenAktiv: false,
  herzDurchgegangenNurHoch: false,
  kiSchwierigkeit: 'STANDARD'
};

const FAKE_TISCH: TischAntwort = {
  id: 'tisch-1',
  name: 'Testtisch',
  einladungsCode: 'ABC123',
  status: 'WARTEND',
  zugangsmodus: 'OFFEN',
  erstelltVonSpielerId: 'spieler-1',
  spieler: [],
  konfiguration: FAKE_KONFIGURATION,
  partieId: null
};

const FAKE_PARTIE_STAND: PartieStandAntwort = {
  partieId: 'partie-1',
  version: 5,
  status: 'LAUFEND',
  anzahlSpiele: 12,
  gespielteSpiele: 2
} as unknown as PartieStandAntwort;

class FakeApi {
  listeTische = vi.fn().mockResolvedValue([]);
  schnellstart = vi.fn().mockResolvedValue(FAKE_TISCH);
  erstelleTisch = vi.fn().mockResolvedValue(FAKE_TISCH);
  betreteTisch = vi.fn().mockResolvedValue(FAKE_TISCH);
  betreteTischViaCode = vi.fn().mockResolvedValue(FAKE_TISCH);
  verlasseTisch = vi.fn().mockResolvedValue({ ok: true });
  starteTisch = vi.fn().mockResolvedValue({ ok: true });
  starteNeuePartie = vi.fn().mockResolvedValue({ ok: true });
  aktualisiereTischKonfiguration = vi.fn().mockResolvedValue(FAKE_KONFIGURATION);
  kickeSpieler = vi.fn().mockResolvedValue({ ok: true });
  ladeTisch = vi.fn().mockResolvedValue(FAKE_TISCH);
  gibPresets = vi.fn().mockResolvedValue([]);
}

/** FakeEchtzeit mit Handler-Capture, damit Ereignisse in Tests simuliert werden können. */
class FakeEchtzeit implements EchtzeitPort {
  readonly senden = vi.fn();
  verbinde = vi.fn().mockResolvedValue(undefined);
  trennen = vi.fn();
  private handlers = new Map<string, Array<(n: unknown) => void>>();

  abonnieren<T>(ziel: string, handler: (n: T) => void): () => void {
    const liste = this.handlers.get(ziel) ?? [];
    liste.push(handler as (n: unknown) => void);
    this.handlers.set(ziel, liste);
    return () => {
      const idx = liste.indexOf(handler as (n: unknown) => void);
      if (idx >= 0) liste.splice(idx, 1);
    };
  }

  sendeTischEreignis(tischId: string, ereignis: TischEreignisAntwort): void {
    (this.handlers.get(`/topic/tisch/${tischId}`) ?? []).forEach((h) => h(ereignis));
  }

  anzahlAbonnements(): number {
    return [...this.handlers.values()].reduce((s, l) => s + l.length, 0);
  }
}

function baueStore() {
  const api = new FakeApi();
  const echtzeit = new FakeEchtzeit();
  let zustand: AppZustand = erzeugeAnfangszustand();
  const onNeuePartie = vi.fn().mockReturnValue(() => {});
  const onPartieReset = vi.fn();

  const patchFn = (aenderungen: Partial<AppZustand>) => {
    zustand = { ...zustand, ...aenderungen };
  };
  const gibZustand = () => zustand;

  const store = new TischStore(
    api as unknown as SpielverwaltungApi,
    echtzeit,
    patchFn,
    gibZustand,
    onNeuePartie,
    onPartieReset
  );
  return { store, api, echtzeit, gibZustand, onNeuePartie, onPartieReset };
}

describe('TischStore', () => {
  describe('aktualisiereTischliste()', () => {
    it('lädt Tischliste von API und patcht Zustand', async () => {
      const { store, api, gibZustand } = baueStore();
      const tischListe = [{ id: 't1', name: 'Tisch 1', spielerAnzahl: 2 }];
      api.listeTische.mockResolvedValue(tischListe);

      await store.aktualisiereTischliste();

      expect(gibZustand().tische).toEqual(tischListe);
    });

    it('sendet WebSocket-Snapshot-Befehl', async () => {
      const { store, echtzeit } = baueStore();

      await store.aktualisiereTischliste();

      expect(echtzeit.senden).toHaveBeenCalledWith('/app/tische/snapshot');
    });

    it('setzt Fehlermeldung und wirdGeladen=false bei API-Fehler', async () => {
      const { store, api, gibZustand } = baueStore();
      api.listeTische.mockRejectedValue(new SpielverwaltungFehler('SERVERFEHLER', 'Verbindungsfehler'));

      await store.aktualisiereTischliste();

      expect(gibZustand().meldung?.typ).toBe('fehler');
      expect(gibZustand().meldung?.fehlerCode).toBe('SERVERFEHLER');
      expect(gibZustand().wirdGeladen).toBe(false);
    });
  });

  describe('erstelleQuickGame()', () => {
    it('erstellt Tisch via Schnellstart und setzt bereich=TISCH', async () => {
      const { store, gibZustand } = baueStore();

      await store.erstelleQuickGame();

      expect(gibZustand().aktuellerTisch).toEqual(FAKE_TISCH);
      expect(gibZustand().bereich).toBe('TISCH');
    });

    it('sendet Snapshot-Befehl für neuen Tisch', async () => {
      const { store, echtzeit } = baueStore();

      await store.erstelleQuickGame();

      expect(echtzeit.senden).toHaveBeenCalledWith(`/app/tisch/${FAKE_TISCH.id}/snapshot`);
    });
  });

  describe('erstelleKonfiguriertenTisch()', () => {
    it('setzt Fehler-Meldung bei leerem Tischnamen ohne API-Aufruf', async () => {
      const { store, api, gibZustand } = baueStore();

      await store.erstelleKonfiguriertenTisch('   ', {});

      expect(gibZustand().meldung?.fehlerCode).toBe('ANFRAGE_UNGUELTIG');
      expect(api.erstelleTisch).not.toHaveBeenCalled();
    });

    it('ruft aktualisiereTischKonfiguration auf wenn Konfiguration nicht leer', async () => {
      const { store, api } = baueStore();

      await store.erstelleKonfiguriertenTisch('Mein Tisch', { ohneNeunen: true });

      expect(api.aktualisiereTischKonfiguration).toHaveBeenCalledOnce();
    });

    it('überspringt Konfigurationsaufruf wenn Konfiguration leer', async () => {
      const { store, api } = baueStore();

      await store.erstelleKonfiguriertenTisch('Mein Tisch', {});

      expect(api.aktualisiereTischKonfiguration).not.toHaveBeenCalled();
    });
  });

  describe('erstelleTischMitPreset()', () => {
    it('setzt Fehler-Meldung bei leerem Tischnamen', async () => {
      const { store, api, gibZustand } = baueStore();

      await store.erstelleTischMitPreset('', 'TURNIER');

      expect(gibZustand().meldung?.fehlerCode).toBe('ANFRAGE_UNGUELTIG');
      expect(api.erstelleTisch).not.toHaveBeenCalled();
    });

    it('erstellt Tisch mit Preset und öffnet ihn', async () => {
      const { store, api, gibZustand } = baueStore();

      await store.erstelleTischMitPreset('Tisch', 'TURNIER');

      expect(api.erstelleTisch).toHaveBeenCalledWith('Tisch', undefined, undefined, 'TURNIER', undefined);
      expect(gibZustand().aktuellerTisch).toEqual(FAKE_TISCH);
    });
  });

  describe('betreteTisch()', () => {
    it('öffnet Tisch nach Beitreten', async () => {
      const { store, gibZustand } = baueStore();

      await store.betreteTisch('tisch-1');

      expect(gibZustand().aktuellerTisch).toEqual(FAKE_TISCH);
      expect(gibZustand().bereich).toBe('TISCH');
    });
  });

  describe('betreteTischViaCode()', () => {
    it('öffnet Tisch nach Beitreten via Einladungscode', async () => {
      const { store, gibZustand } = baueStore();

      await store.betreteTischViaCode('ABC123');

      expect(gibZustand().aktuellerTisch).toEqual(FAKE_TISCH);
      expect(gibZustand().bereich).toBe('TISCH');
    });
  });

  describe('reconnecteTisch()', () => {
    it('setzt aktuellerTisch und partieStand auf null vor Snapshot', () => {
      const { store, gibZustand } = baueStore();

      store.reconnecteTisch('tisch-1');

      expect(gibZustand().aktuellerTisch).toBeNull();
      expect(gibZustand().partieStand).toBeNull();
    });

    it('setzt bereich=TISCH und sendet Snapshot-Befehl', () => {
      const { store, echtzeit, gibZustand } = baueStore();

      store.reconnecteTisch('tisch-1');

      expect(gibZustand().bereich).toBe('TISCH');
      expect(echtzeit.senden).toHaveBeenCalledWith('/app/tisch/tisch-1/snapshot');
    });

    it('registriert Tisch-Abonnements nach Reset', () => {
      const { store, echtzeit } = baueStore();

      store.reconnecteTisch('tisch-1');

      // /topic/tisch/... und /user/queue/tisch/... = 2 Abos
      expect(echtzeit.anzahlAbonnements()).toBe(2);
    });
  });

  describe('verlasseAktuellenTisch()', () => {
    it('tut nichts wenn kein aktuellerTisch gesetzt', async () => {
      const { store, api } = baueStore();

      await store.verlasseAktuellenTisch();

      expect(api.verlasseTisch).not.toHaveBeenCalled();
    });

    it('verlässt Tisch und setzt bereich=SPIELVERWALTUNG', async () => {
      const { store, api, gibZustand } = baueStore();
      await store.betreteTisch('tisch-1');
      api.listeTische.mockResolvedValue([]);

      await store.verlasseAktuellenTisch();

      expect(api.verlasseTisch).toHaveBeenCalledWith(FAKE_TISCH.id);
      expect(gibZustand().aktuellerTisch).toBeNull();
      expect(gibZustand().bereich).toBe('SPIELVERWALTUNG');
    });

    it('setzt Tisch-Abonnements zurück', async () => {
      const { store, echtzeit, onPartieReset } = baueStore();
      await store.betreteTisch('tisch-1');

      await store.verlasseAktuellenTisch();

      expect(echtzeit.anzahlAbonnements()).toBe(0);
      expect(onPartieReset).toHaveBeenCalled();
    });
  });

  describe('setzeTischAbosZurueck()', () => {
    it('meldet alle registrierten Tisch-Abonnements ab', async () => {
      const { store, echtzeit } = baueStore();
      await store.betreteTisch('tisch-1');
      expect(echtzeit.anzahlAbonnements()).toBeGreaterThan(0);

      store.setzeTischAbosZurueck();

      expect(echtzeit.anzahlAbonnements()).toBe(0);
    });

    it('ruft onPartieReset auf', () => {
      const { store, onPartieReset } = baueStore();

      store.setzeTischAbosZurueck();

      expect(onPartieReset).toHaveBeenCalledOnce();
    });
  });

  describe('verarbeiteTischEreignis() via Tisch-Abo', () => {
    async function mitOffenemTisch() {
      const ctx = baueStore();
      await ctx.store.betreteTisch('tisch-1');
      return ctx;
    }

    it('COUNTDOWN_TICK setzt countdownSekunden aus Ereignis', async () => {
      const { echtzeit, gibZustand } = await mitOffenemTisch();

      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'COUNTDOWN_TICK',
        tischId: 'tisch-1',
        tisch: null,
        partieStand: null,
        verbleibendeSekunden: 42
      });

      expect(gibZustand().countdownSekunden).toBe(42);
    });

    it('PARTIE_ABGEBROCHEN setzt Abos zurück und zeigt Info-Meldung', async () => {
      const { echtzeit, gibZustand, onPartieReset } = await mitOffenemTisch();

      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'PARTIE_ABGEBROCHEN',
        tischId: 'tisch-1',
        tisch: null,
        partieStand: null
      });

      expect(gibZustand().bereich).toBe('SPIELVERWALTUNG');
      expect(gibZustand().aktuellerTisch).toBeNull();
      expect(gibZustand().meldung?.typ).toBe('info');
      expect(gibZustand().meldung?.fehlerCode).toBe('PARTIE_ABGEBROCHEN');
      expect(echtzeit.anzahlAbonnements()).toBe(0);
      expect(onPartieReset).toHaveBeenCalled();
    });

    it('TISCH_ENTFERNT setzt Abos zurück und navigiert zu SPIELVERWALTUNG', async () => {
      const { echtzeit, gibZustand, onPartieReset } = await mitOffenemTisch();

      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'TISCH_ENTFERNT',
        tischId: 'tisch-1',
        tisch: null,
        partieStand: null
      });

      expect(gibZustand().bereich).toBe('SPIELVERWALTUNG');
      expect(gibZustand().aktuellerTisch).toBeNull();
      expect(echtzeit.anzahlAbonnements()).toBe(0);
      expect(onPartieReset).toHaveBeenCalled();
    });

    it('tisch=null (ohne TISCH_ENTFERNT) wird wie TISCH_ENTFERNT behandelt', async () => {
      const { echtzeit, gibZustand } = await mitOffenemTisch();

      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'SPIELER_VERLASSEN',
        tischId: 'tisch-1',
        tisch: null,
        partieStand: null
      });

      expect(gibZustand().bereich).toBe('SPIELVERWALTUNG');
      expect(gibZustand().aktuellerTisch).toBeNull();
    });

    it('aktualisiert PartieStand wenn neue Version höher als aktuelle', async () => {
      const { echtzeit, gibZustand } = await mitOffenemTisch();
      const neuerStand = { ...FAKE_PARTIE_STAND, version: 10 };

      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'TISCH_SNAPSHOT',
        tischId: 'tisch-1',
        tisch: FAKE_TISCH,
        partieStand: neuerStand
      });

      expect(gibZustand().partieStand?.version).toBe(10);
    });

    it('ignoriert PartieStand wenn Version veraltet und gleiche PartieId', async () => {
      const { echtzeit, gibZustand } = await mitOffenemTisch();
      // Erst aktuellen Stand setzen
      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'TISCH_SNAPSHOT',
        tischId: 'tisch-1',
        tisch: FAKE_TISCH,
        partieStand: { ...FAKE_PARTIE_STAND, version: 10 }
      });
      expect(gibZustand().partieStand?.version).toBe(10);

      // Veralteten Stand senden
      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'TISCH_SNAPSHOT',
        tischId: 'tisch-1',
        tisch: FAKE_TISCH,
        partieStand: { ...FAKE_PARTIE_STAND, version: 3 }
      });

      // Version darf nicht zurückfallen
      expect(gibZustand().partieStand?.version).toBe(10);
    });

    it('aktualisiert PartieStand immer wenn neue PartieId (istNeuePartie=true)', async () => {
      const { echtzeit, gibZustand } = await mitOffenemTisch();
      // Erst hohen Stand setzen
      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'TISCH_SNAPSHOT',
        tischId: 'tisch-1',
        tisch: FAKE_TISCH,
        partieStand: { ...FAKE_PARTIE_STAND, partieId: 'partie-alt', version: 99 }
      });

      // Neues Partie-ID mit niedrigerer Version
      const neuePartie = { ...FAKE_PARTIE_STAND, partieId: 'partie-neu', version: 1 };
      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'TISCH_SNAPSHOT',
        tischId: 'tisch-1',
        tisch: FAKE_TISCH,
        partieStand: neuePartie
      });

      expect(gibZustand().partieStand?.partieId).toBe('partie-neu');
    });

    it('SPIEL_GESTARTET setzt countdownSekunden auf null', async () => {
      const { echtzeit, gibZustand } = await mitOffenemTisch();
      // Countdown vorab setzen
      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'COUNTDOWN_TICK',
        tischId: 'tisch-1',
        tisch: null,
        partieStand: null,
        verbleibendeSekunden: 5
      });
      expect(gibZustand().countdownSekunden).toBe(5);

      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'SPIEL_GESTARTET',
        tischId: 'tisch-1',
        tisch: FAKE_TISCH,
        partieStand: null
      });

      expect(gibZustand().countdownSekunden).toBeNull();
    });

    it('ruft onNeuePartie auf wenn Tisch eine neue PartieId meldet', async () => {
      const { echtzeit, onNeuePartie } = await mitOffenemTisch();
      const tischMitPartie = { ...FAKE_TISCH, partieId: 'partie-2' };

      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'TISCH_SNAPSHOT',
        tischId: 'tisch-1',
        tisch: tischMitPartie,
        partieStand: null
      });

      expect(onNeuePartie).toHaveBeenCalledWith('partie-2');
    });

    it('registriert Partie-Abo nicht doppelt bei gleicher PartieId', async () => {
      const { echtzeit, onNeuePartie } = await mitOffenemTisch();
      const tischMitPartie = { ...FAKE_TISCH, partieId: 'partie-2' };

      // Zweimal dasselbe Ereignis — onNeuePartie darf nur einmal pro PartieId aufgerufen werden
      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'TISCH_SNAPSHOT',
        tischId: 'tisch-1',
        tisch: tischMitPartie,
        partieStand: null
      });
      echtzeit.sendeTischEreignis('tisch-1', {
        ereignisTyp: 'TISCH_SNAPSHOT',
        tischId: 'tisch-1',
        tisch: tischMitPartie,
        partieStand: null
      });

      expect(onNeuePartie).toHaveBeenCalledOnce();
    });
  });

  describe('sendeSpielaktion()', () => {
    it('setzt meldung=null und sendet Aktion via echtzeit', () => {
      const { store, echtzeit } = baueStore();

      store.sendeSpielaktion('/app/tisch/t1/karte', { karteId: 'k1' });

      expect(echtzeit.senden).toHaveBeenCalledWith('/app/tisch/t1/karte', { karteId: 'k1' });
    });

    it('setzt Fehler-Meldung wenn echtzeit.senden wirft', () => {
      const { store, echtzeit, gibZustand } = baueStore();
      echtzeit.senden.mockImplementation(() => { throw new Error('Keine Verbindung'); });

      store.sendeSpielaktion('/app/tisch/t1/karte', { karteId: 'k1' });

      expect(gibZustand().meldung?.typ).toBe('fehler');
      expect(gibZustand().meldung?.text).toBe('Keine Verbindung');
    });
  });

  describe('fuehreMitStatus() — Lade-Indikator und Fehlerbehandlung', () => {
    it('setzt wirdGeladen=true während der Aktion und false danach', async () => {
      const { store, api, gibZustand } = baueStore();
      const zustände: boolean[] = [];
      api.listeTische.mockImplementation(async () => {
        zustände.push(gibZustand().wirdGeladen);
        return [];
      });

      await store.aktualisiereTischliste();

      expect(zustände).toEqual([true]);
      expect(gibZustand().wirdGeladen).toBe(false);
    });

    it('setzt fehlerCode in Meldung wenn SpielverwaltungFehler geworfen wird', async () => {
      const { store, api, gibZustand } = baueStore();
      api.schnellstart.mockRejectedValue(new SpielverwaltungFehler('TISCH_VOLL', 'Tisch ist voll'));

      await store.erstelleQuickGame();

      expect(gibZustand().meldung?.fehlerCode).toBe('TISCH_VOLL');
      expect(gibZustand().meldung?.typ).toBe('fehler');
    });
  });

  describe('aktualisiereAktuellenTischhintergrund()', () => {
    it('aktualisiert Hintergrund und setzt meldung=null', async () => {
      const { store, api, gibZustand } = baueStore();
      await store.betreteTisch('tisch-1');
      api.aktualisiereTischKonfiguration.mockResolvedValue({ ...FAKE_KONFIGURATION, tischhintergrund: 'BLAU_GRAFIK' });

      await store.aktualisiereAktuellenTischhintergrund('BLAU_GRAFIK');

      expect(api.aktualisiereTischKonfiguration).toHaveBeenCalled();
      expect(gibZustand().meldung).toBeNull();
    });

    it('überspringt API-Aufruf wenn Hintergrund bereits gesetzt', async () => {
      const { store, api } = baueStore();
      await store.betreteTisch('tisch-1');

      // FAKE_TISCH hat tischhintergrund='FILZ_GRUEN', nochmals setzen → kein Aufruf
      await store.aktualisiereAktuellenTischhintergrund('FILZ_GRUEN');

      expect(api.aktualisiereTischKonfiguration).not.toHaveBeenCalled();
    });
  });

  describe('aktualisiereAktuelleKiSchwierigkeit()', () => {
    it('aktualisiert KI-Schwierigkeit und setzt meldung=null', async () => {
      const { store, api, gibZustand } = baueStore();
      await store.betreteTisch('tisch-1');
      api.aktualisiereTischKonfiguration.mockResolvedValue({ ...FAKE_KONFIGURATION, kiSchwierigkeit: 'SCHWER' });

      await store.aktualisiereAktuelleKiSchwierigkeit('SCHWER');

      expect(api.aktualisiereTischKonfiguration).toHaveBeenCalled();
      expect(gibZustand().meldung).toBeNull();
    });

    it('überspringt API-Aufruf wenn Schwierigkeit bereits gesetzt', async () => {
      const { store, api } = baueStore();
      await store.betreteTisch('tisch-1');

      // FAKE_TISCH hat kiSchwierigkeit='STANDARD', nochmals setzen → kein Aufruf
      await store.aktualisiereAktuelleKiSchwierigkeit('STANDARD');

      expect(api.aktualisiereTischKonfiguration).not.toHaveBeenCalled();
    });
  });

  describe('kickeSpieler()', () => {
    it('tut nichts wenn kein aktuellerTisch', async () => {
      const { store, api } = baueStore();

      await store.kickeSpieler('spieler-2');

      expect(api.kickeSpieler).not.toHaveBeenCalled();
    });

    it('kickt Spieler via API wenn aktuellerTisch gesetzt', async () => {
      const { store, api } = baueStore();
      await store.betreteTisch('tisch-1');

      await store.kickeSpieler('spieler-2');

      expect(api.kickeSpieler).toHaveBeenCalledWith(FAKE_TISCH.id, 'spieler-2');
    });
  });
});
