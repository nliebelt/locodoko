import { Client, type IFrame, type IMessage, type StompSubscription } from '@stomp/stompjs';

export type NachrichtenHandler<T> = (nachricht: T) => void;

export interface EchtzeitPort {
  verbinde(): Promise<void>;
  abonnieren<T>(ziel: string, handler: NachrichtenHandler<T>): () => void;
  senden(ziel: string, payload?: unknown): void;
  trennen(): void;
}

function berechneBrokerUrl(): string {
  const protokoll = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protokoll}//${window.location.host}/ws`;
}

function parseNachricht<T>(nachricht: IMessage): T {
  return JSON.parse(nachricht.body) as T;
}

export class SpielverwaltungEchtzeit implements EchtzeitPort {
  private client: Client | null = null;

  private verbindungsPromise: Promise<void> | null = null;

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
        this.verbindungsPromise = null;
        resolve();
      };
      client.onStompError = behebeVerbindungsfehler;
      client.onWebSocketError = behebeVerbindungsfehler;
      client.onWebSocketClose = (event) => {
        if (!event.wasClean && this.verbindungsPromise) {
          behebeVerbindungsfehler(event);
        }
      };
      client.activate();
    });

    return this.verbindungsPromise;
  }

  abonnieren<T>(ziel: string, handler: NachrichtenHandler<T>): () => void {
    const client = this.client;
    if (!client?.connected) {
      throw new Error(`Die WebSocket-Verbindung ist fuer ${ziel} noch nicht bereit.`);
    }

    const subscription: StompSubscription = client.subscribe(ziel, (nachricht) => {
      handler(parseNachricht<T>(nachricht));
    });

    return () => subscription.unsubscribe();
  }

  senden(ziel: string, payload: unknown = {}): void {
    const client = this.client;
    if (!client?.connected) {
      throw new Error(`Die WebSocket-Verbindung ist fuer ${ziel} nicht aktiv.`);
    }

    client.publish({
      destination: ziel,
      body: JSON.stringify(payload)
    });
  }

  trennen(): void {
    this.client?.deactivate();
    this.client = null;
    this.verbindungsPromise = null;
  }
}
