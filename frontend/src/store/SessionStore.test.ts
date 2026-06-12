import { describe, expect, it, vi } from 'vitest';
import type { SpielerSessionAntwort } from '../modelle/SpielverwaltungDto';
import type { SpielverwaltungApi } from '../services/SpielverwaltungApi';
import { SpielverwaltungFehler } from '../services/SpielverwaltungApi';
import type { EchtzeitPort } from '../services/SpielverwaltungEchtzeit';
import { erzeugeAnfangszustand } from './StoreTypen';
import type { AppZustand } from './StoreTypen';
import { SessionStore } from './SessionStore';

const FAKE_SPIELER: SpielerSessionAntwort = {
  spielerId: 'spieler-1',
  name: 'Testnutzer',
  istKi: false
};

class FakeApi {
  initialisiereSpielerSession = vi.fn().mockResolvedValue(FAKE_SPIELER);
  listeTische = vi.fn().mockResolvedValue([]);
  ausloggen = vi.fn().mockResolvedValue(undefined);
  einloggen = vi.fn().mockResolvedValue({ spielerId: 'spieler-1', name: 'Test', authentifizierungsMethode: 'PASSWORT' });
  registrieren = vi.fn().mockResolvedValue({ spielerId: 'spieler-1', name: 'Test', authentifizierungsMethode: 'PASSWORT' });
  ladeSpielerProfil = vi.fn().mockResolvedValue({});
}

class FakeEchtzeit implements EchtzeitPort {
  verbinde = vi.fn().mockResolvedValue(undefined);
  readonly abonnierenMock = vi.fn().mockReturnValue(() => {});
  abonnieren<T>(ziel: string, handler: (n: T) => void): () => void {
    return this.abonnierenMock(ziel, handler) as () => void;
  }
  senden = vi.fn();
  trennen = vi.fn();
}

function baueStore() {
  const api = new FakeApi();
  const echtzeit = new FakeEchtzeit();
  let zustand: AppZustand = erzeugeAnfangszustand();

  const patchFn = (aenderungen: Partial<AppZustand>) => {
    zustand = { ...zustand, ...aenderungen };
  };
  const gibZustand = () => zustand;
  const resetZustand = vi.fn(() => {
    zustand = erzeugeAnfangszustand();
  });

  const store = new SessionStore(api as unknown as SpielverwaltungApi, echtzeit, patchFn, gibZustand, resetZustand);
  return { store, api, echtzeit, gibZustand, resetZustand };
}

describe('SessionStore', () => {
  describe('initialisieren()', () => {
    it('lädt Session, verbindet WebSocket und setzt initialisiert=true bei Erfolg', async () => {
      const { store, gibZustand } = baueStore();

      await store.initialisieren();

      expect(gibZustand().initialisiert).toBe(true);
      expect(gibZustand().verbindung).toBe('verbunden');
      expect(gibZustand().spieler).toEqual(FAKE_SPIELER);
      expect(gibZustand().meldung).toBeNull();
    });

    it('überspringt zweiten Initialisierungsaufruf wenn bereits initialisiert', async () => {
      const { store, api } = baueStore();

      await store.initialisieren();
      await store.initialisieren();

      // API darf nur einmal aufgerufen werden
      expect(api.initialisiereSpielerSession).toHaveBeenCalledOnce();
    });

    it('setzt verbindung=offline und wirft bei API-Fehler (Token-Expired)', async () => {
      const { store, api, gibZustand } = baueStore();
      api.initialisiereSpielerSession.mockRejectedValue(
        new SpielverwaltungFehler('NICHT_AUTHENTIFIZIERT', 'Session abgelaufen')
      );

      await expect(store.initialisieren()).rejects.toThrow('Initialisierung fehlgeschlagen.');

      expect(gibZustand().verbindung).toBe('offline');
      expect(gibZustand().initialisiert).toBe(false);
    });

    it('setzt Fehlermeldung in meldung bei Initialisierungsfehler', async () => {
      const { store, api, gibZustand } = baueStore();
      api.initialisiereSpielerSession.mockRejectedValue(new Error('Netzwerkfehler'));

      await expect(store.initialisieren()).rejects.toThrow();

      expect(gibZustand().meldung).not.toBeNull();
      expect(gibZustand().meldung?.typ).toBe('fehler');
      expect(gibZustand().meldung?.text).toBe('Initialisierung fehlgeschlagen.');
    });

    it('setzt wirdGeladen=false nach Fehler', async () => {
      const { store, api, gibZustand } = baueStore();
      api.initialisiereSpielerSession.mockRejectedValue(new Error('Fehler'));

      await expect(store.initialisieren()).rejects.toThrow();

      expect(gibZustand().wirdGeladen).toBe(false);
    });
  });

  describe('ausloggen() — Logout-Fehler', () => {
    it('trennt Echtzeit und setzt Zustand zurück auch wenn api.ausloggen() fehlschlägt', async () => {
      const { store, api, echtzeit, resetZustand } = baueStore();
      api.ausloggen.mockRejectedValue(new Error('Netzwerkfehler'));

      // ausloggen() darf nicht werfen, weil .catch(() => undefined) den Fehler ignoriert
      await expect(store.ausloggen()).resolves.toBeUndefined();

      expect(echtzeit.trennen).toHaveBeenCalledOnce();
      expect(resetZustand).toHaveBeenCalledOnce();
    });

    it('setzt Zustand zurück bei erfolgreichem Logout', async () => {
      const { store, echtzeit, resetZustand } = baueStore();

      await store.ausloggen();

      expect(echtzeit.trennen).toHaveBeenCalledOnce();
      expect(resetZustand).toHaveBeenCalledOnce();
    });
  });

  describe('alsGastStarten() — GastStart-Fehler', () => {
    it('setzt authentifiziert=true und bereich=SPIELVERWALTUNG vor initialisieren', async () => {
      const { store, api, gibZustand } = baueStore();
      const aufgezeichneteZustaende: AppZustand[] = [];
      api.initialisiereSpielerSession.mockImplementation(async () => {
        aufgezeichneteZustaende.push(gibZustand());
        return FAKE_SPIELER;
      });

      await store.alsGastStarten();

      expect(aufgezeichneteZustaende).toHaveLength(1);
      expect(aufgezeichneteZustaende[0].authentifiziert).toBe(true);
      expect(aufgezeichneteZustaende[0].bereich).toBe('SPIELVERWALTUNG');
    });

    it('setzt meldung und wirdGeladen=false wenn initialisieren fehlschlägt', async () => {
      const { store, api, gibZustand } = baueStore();
      api.initialisiereSpielerSession.mockRejectedValue(new Error('Server nicht erreichbar'));

      await expect(store.alsGastStarten()).rejects.toThrow();

      expect(gibZustand().wirdGeladen).toBe(false);
      expect(gibZustand().meldung?.typ).toBe('fehler');
      expect(gibZustand().verbindung).toBe('offline');
    });
  });

  describe('trenneGemeinsameAbos()', () => {
    it('meldet alle 3 gemeinsamen Abonnements nach initialisieren ab', async () => {
      const { store, echtzeit } = baueStore();
      let abmeldeAnrufe = 0;
      echtzeit.abonnierenMock.mockReturnValue(() => {
        abmeldeAnrufe++;
      });

      await store.initialisieren();
      store.trenneGemeinsameAbos();

      // SessionStore registriert 3 Abonnements: /topic/tische, /user/queue/tische, /user/queue/fehler
      expect(abmeldeAnrufe).toBe(3);
    });

    it('ist sicher aufzurufen wenn keine Abonnements registriert sind', () => {
      const { store } = baueStore();

      expect(() => store.trenneGemeinsameAbos()).not.toThrow();
    });

    it('registriert Abonnements nicht doppelt bei mehrfachem initialisieren', async () => {
      const { store, echtzeit } = baueStore();

      await store.initialisieren();
      // zweiter Aufruf überspringt (initialisiert=true)
      await store.initialisieren();

      // abonnieren wird nur 3-mal aufgerufen (nicht 6-mal)
      expect(echtzeit.abonnierenMock).toHaveBeenCalledTimes(3);
    });
  });
});
