/**
 * Komfort-Re-Exporte der generierten OpenAPI-Schema-Typen.
 *
 * Statt {@code components['schemas']['TischAntwort']} kann direkt
 * {@code import type { TischAntwort } from './schema-types'} verwendet werden.
 *
 * NICHT MANUELL BEARBEITEN — wird aus {@code api-types.ts} abgeleitet.
 * Bei Aenderungen an der Backend-API: {@code npm run generate-types} ausfuehren.
 */
import type { components } from './api-types';

// --- Tisch & Lobby ---
export type TischAntwortGenerated = components['schemas']['TischAntwort'];
export type TischListenEintragAntwortGenerated = components['schemas']['TischListenEintragAntwort'];
export type TischKonfigurationDtoGenerated = components['schemas']['TischKonfigurationDto'];
export type TischKurzKonfigurationAntwortGenerated = components['schemas']['TischKurzKonfigurationAntwort'];
export type SpielerAmTischAntwortGenerated = components['schemas']['SpielerAmTischAntwort'];
export type BestaetigungAntwortGenerated = components['schemas']['BestaetigungAntwort'];
export type ApiFehlerAntwortGenerated = components['schemas']['ApiFehlerAntwort'];

// --- Partie & Spiel ---
export type PartieStandAntwortGenerated = components['schemas']['PartieStandAntwort'];
export type LaufendesSpielAntwortGenerated = components['schemas']['LaufendesSpielAntwort'];
export type SpielerImSpielAntwortGenerated = components['schemas']['SpielerImSpielAntwort'];
export type KarteAntwortGenerated = components['schemas']['KarteAntwort'];
export type GespielteKarteAntwortGenerated = components['schemas']['GespielteKarteAntwort'];
export type AnsageEreignisAntwortGenerated = components['schemas']['AnsageEreignisAntwort'];
export type AbgeschlossenerStichAntwortGenerated = components['schemas']['AbgeschlossenerStichAntwort'];
export type LetztesSpielergebnisAntwortGenerated = components['schemas']['LetztesSpielergebnisAntwort'];
export type SonderpunktEreignisDtoGenerated = components['schemas']['SonderpunktEreignisDto'];

// --- WebSocket-Ereignisse ---
export type TischEreignisAntwortGenerated = components['schemas']['TischEreignisAntwort'];
export type TischlisteEreignisAntwortGenerated = components['schemas']['TischlisteEreignisAntwort'];
export type PartieEreignisAntwortGenerated = components['schemas']['PartieEreignisAntwort'];
export type SpielverwaltungWebSocketFehlerAntwortGenerated = components['schemas']['SpielverwaltungWebSocketFehlerAntwort'];
export type VerbindungStatusEreignisAntwortGenerated = components['schemas']['VerbindungStatusEreignisAntwort'];

// --- Spieler & Session ---
export type SpielerSessionAntwortGenerated = components['schemas']['SpielerSessionAntwort'];
export type SpielerProfilAntwortGenerated = components['schemas']['SpielerProfilAntwort'];
export type StatistikAntwortGenerated = components['schemas']['StatistikAntwort'];
export type PartieErgebnisAntwortGenerated = components['schemas']['PartieErgebnisAntwort'];
export type AuthentifizierungsAntwortGenerated = components['schemas']['AuthentifizierungsAntwort'];

// --- System ---
export type SystemstatusAntwortGenerated = components['schemas']['SystemstatusAntwort'];

// --- API-Pfade und Operationen (fuer kuenftige Fetch-Client-Integration) ---
export type { paths, operations } from './api-types';
