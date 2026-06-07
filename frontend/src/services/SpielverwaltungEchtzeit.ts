import { Client, type IFrame, type IMessage, type StompSubscription } from '@stomp/stompjs';
import { Logger } from '../logger';

/** Callback-Typ fuer eingehende WebSocket-Nachrichten eines bestimmten Typs. */
export type NachrichtenHandler<T> = (nachricht: T) => void;

/**
 * Port fuer die Echtzeit-Kommunikation per WebSocket/STOMP.
 *
 * Abstrahiert den konkreten STOMP-Client und ermoeglicht Testbarkeit durch Ersatz mit
 * einem Mock. Der AppStore verwendet diesen Port, um Spielereignisse zu empfangen und
 * Spielaktionen zu senden.
 */
export interface EchtzeitPort {
  /**
   * Baut die STOMP-Verbindung ueber WebSocket auf.
   * Idempotent: Bei bestehender oder laufender Verbindung wird das Promise sofort aufgeloest.
   */
  verbinde(): Promise<void>;

  /**
   * Abonniert ein STOMP-Ziel und ruft den Handler bei jeder Nachricht auf.
   * @param ziel - STOMP-Topic oder Queue (z.B. `/topic/tische`)
   * @param handler - Callback fuer eingehende Nachrichten
   * @returns Abmelde-Funktion, die das Abonnement beendet
   */
  abonnieren<T>(ziel: string, handler: NachrichtenHandler<T>): () => void;

  /**
   * Sendet eine Aktion an ein STOMP-Ziel.
   * @param ziel - STOMP-Destination (z.B. `/app/tisch/{id}/karte`)
   * @param payload - Optionaler JSON-Payload (wird serialisiert)
   * @throws Error wenn keine aktive Verbindung besteht
   */
  senden(ziel: string, payload?: unknown): void;

  /** Trennt die WebSocket-Verbindung und gibt alle Ressourcen frei. */
  trennen(): void;

  /**
   * Registriert einen Callback, der nach jedem automatischen STOMP-Reconnect aufgerufen wird.
   * Wird genutzt, um nach Verbindungswiederherstellung Snapshots neu anzufordern.
   */
  registriereReconnectCallback?(callback: () => void): void;
}

function berechneBrokerUrl(): string {
  const protokoll = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protokoll}//${window.location.host}/ws`;
}

function parseNachricht<T>(nachricht: IMessage): T {
  return JSON.parse(nachricht.body) as T;
}

type AbonnementEintrag = {
  readonly ziel: string;
  readonly handler: NachrichtenHandler<unknown>;
  aktuellesAbo: StompSubscription | null;
};

/**
 * Konkrete STOMP-Implementierung des EchtzeitPort.
 *
 * Verwaltet einen einzelnen STOMP-Client mit automatischem Reconnect (5s-Verzoegerung)
 * und Heartbeat-Ueberwachung (10s). Verbindungsaufbau und -trennung sind idempotent.
 * Alle Abonnements und gesendeten Aktionen erfordern eine aktive Verbindung.
 */
export class SpielverwaltungEchtzeit implements EchtzeitPort {
  private client: Client | null = null;

  private verbindungsPromise: Promise<void> | null = null;

  /** Alle aktuell aktiven Abonnements — werden bei Reconnect automatisch wiederhergestellt. */
  private readonly aktiveAbonnements: Array<AbonnementEintrag> = [];

  /** Wird nach jedem automatischen Reconnect aufgerufen (nach Resubscription). */
  private reconnectCallback: (() => void) | null = null;

  /** Merkt ob die Verbindung bereits mindestens einmal aufgebaut wurde. */
  private warVerbunden = false;

  /**
   * Baut die STOMP-Verbindung auf und wartet auf erfolgreiche Verbindung.
   * Bei laufendem Verbindungsversuch wird das bestehende Promise zurückgegeben.
   * @throws Error wenn die WebSocket-Verbindung fehlschlägt.
   */
  async verbinde(): Promise<void> {
    if (this.client?.connected) {
      return;
    }

    if (this.verbindungsPromise) {
      return this.verbindungsPromise;
    }

    this.client = new Client({
      brokerURL: berechneBrokerUrl(),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      debug: () => undefined
    });

    this.verbindungsPromise = new Promise<void>((resolve, reject) => {
      const client = this.client;
      if (!client) {
        reject(new Error('Der WebSocket-Client konnte nicht initialisiert werden.'));
        return;
      }

      const behebeVerbindungsfehler = (frame: IFrame | CloseEvent | string): void => {
        if (this.verbindungsPromise) {
          this.verbindungsPromise = null;
          if (typeof frame === 'string') {
            reject(new Error(frame));
            return;
          }
          if ('body' in frame && typeof frame.body === 'string' && frame.body) {
            reject(new Error(frame.body));
            return;
          }
          reject(new Error('Die WebSocket-Verbindung konnte nicht aufgebaut werden.'));
        }
      };

      client.onConnect = () => {
        Logger.websocket('STOMP verbunden');

        // Bei Reconnect: alle aktiven Abonnements auf der neuen STOMP-Session wiederherstellen.
        // STOMP stellt Subscriptions nach Verbindungsverlust NICHT selbst wieder her.
        for (const eintrag of this.aktiveAbonnements) {
          eintrag.aktuellesAbo = client.subscribe(eintrag.ziel, (nachricht) => {
            Logger.websocket('Nachricht empfangen', { topic: eintrag.ziel, body: nachricht.body });
            eintrag.handler(parseNachricht(nachricht));
          });
        }

        const istReconnect = this.warVerbunden;
        this.warVerbunden = true;
        this.verbindungsPromise = null;
        resolve();

        if (istReconnect && this.reconnectCallback) {
          this.reconnectCallback();
        }
      };
      client.onStompError = behebeVerbindungsfehler;
      client.onWebSocketError = behebeVerbindungsfehler;
      client.onWebSocketClose = (event) => {
        Logger.websocket('STOMP getrennt', { wasClean: event.wasClean, code: event.code });
        if (!event.wasClean && this.verbindungsPromise) {
          behebeVerbindungsfehler(event);
        }
      };
      client.activate();
    });

    return this.verbindungsPromise;
  }

  /**
   * Abonniert ein STOMP-Ziel und ruft den Handler bei jeder Nachricht auf.
   * Die Nachricht wird automatisch aus JSON deserialisiert.
   * @param ziel - STOMP-Topic oder Queue (z.B. `/topic/tische`)
   * @param handler - Callback mit dem deserialisierten Nachrichtenobjekt.
   * @returns Abmelde-Funktion für dieses Abonnement.
   * @throws Error wenn keine aktive STOMP-Verbindung besteht.
   */
  abonnieren<T>(ziel: string, handler: NachrichtenHandler<T>): () => void {
    const client = this.client;
    if (!client?.connected) {
      throw new Error(`Die WebSocket-Verbindung ist für ${ziel} noch nicht bereit.`);
    }

    Logger.websocket('Subscribed', { topic: ziel });
    const eintrag: AbonnementEintrag = { ziel, handler: handler as NachrichtenHandler<unknown>, aktuellesAbo: null };
    eintrag.aktuellesAbo = client.subscribe(ziel, (nachricht) => {
      Logger.websocket('Nachricht empfangen', { topic: ziel, body: nachricht.body });
      handler(parseNachricht<T>(nachricht));
    });
    this.aktiveAbonnements.push(eintrag);

    return () => {
      eintrag.aktuellesAbo?.unsubscribe();
      const index = this.aktiveAbonnements.indexOf(eintrag);
      if (index >= 0) this.aktiveAbonnements.splice(index, 1);
    };
  }

  /**
   * Serialisiert den Payload als JSON und sendet ihn an das STOMP-Ziel.
   * @param ziel - STOMP-Destination (z.B. `/app/tisch/{id}/karte`)
   * @param payload - Zu sendende Daten (Standard: leeres Objekt).
   * @throws Error wenn keine aktive STOMP-Verbindung besteht.
   */
  senden(ziel: string, payload: unknown = {}): void {
    const client = this.client;
    if (!client?.connected) {
      throw new Error(`Die WebSocket-Verbindung ist für ${ziel} nicht aktiv.`);
    }

    Logger.websocket('Aktion gesendet', { destination: ziel, body: payload });
    client.publish({
      destination: ziel,
      body: JSON.stringify(payload)
    });
  }

  registriereReconnectCallback(callback: () => void): void {
    this.reconnectCallback = callback;
  }

  /** Deaktiviert den STOMP-Client und setzt alle Verbindungsreferenzen zurück. */
  trennen(): void {
    this.client?.deactivate();
    this.client = null;
    this.verbindungsPromise = null;
    this.aktiveAbonnements.length = 0;
    this.warVerbunden = false;
  }
}
