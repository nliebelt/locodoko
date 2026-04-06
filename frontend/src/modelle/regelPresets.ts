import type { TischKonfigurationDto } from './SpielverwaltungDto';

export type RegelPresetName = 'LOCO_BLAT' | 'DKV' | 'OHNE_NEUNEN_LOCO_BLAT' | 'BENUTZERDEFINIERT';

/** Alle Regelfelder ohne die Tisch-Meta-Felder (Rundenanzahl, Hintergrund, KI). */
export type RegelFelder = Omit<TischKonfigurationDto, 'anzahlSpiele' | 'tischhintergrund' | 'kiSchwierigkeit'>;

const LOCO_BLAT_REGELN: RegelFelder = {
    ohneNeunen: false,
    zweiteDulleSticht: true,
    hochzeitErlaubt: true,
    armutErlaubt: true,
    damensoloErlaubt: true,
    bubensoloErlaubt: true,
    fleischlosErlaubt: true,
    trumpfsoloErlaubt: true,
    fuchsGefangenAktiv: true,
    karlchenAktiv: true,
    doppelkopfAktiv: true,
    bockrundenAktiv: true,
    schweinchenAktiv: true,
    dreissigAugenPflichtAktiv: true,
    mindestkartenReKontra: 11,
    mindestkartenKeine90: 10,
    mindestkartenKeine60: 9,
    mindestkartenKeine30: 8,
    mindestkartenSchwarz: 7,
};

const DKV_REGELN: RegelFelder = {
    ...LOCO_BLAT_REGELN,
    bockrundenAktiv: false,
    schweinchenAktiv: false,
    dreissigAugenPflichtAktiv: false,
};

const OHNE_NEUNEN_LOCO_BLAT_REGELN: RegelFelder = {
    ...LOCO_BLAT_REGELN,
    ohneNeunen: true,
    mindestkartenReKontra: 9,
    mindestkartenKeine90: 8,
    mindestkartenKeine60: 7,
    mindestkartenKeine30: 6,
    mindestkartenSchwarz: 5,
};

export const REGEL_PRESETS: Record<Exclude<RegelPresetName, 'BENUTZERDEFINIERT'>, RegelFelder> = {
    LOCO_BLAT: LOCO_BLAT_REGELN,
    DKV: DKV_REGELN,
    OHNE_NEUNEN_LOCO_BLAT: OHNE_NEUNEN_LOCO_BLAT_REGELN,
};

export const PRESET_BEZEICHNUNGEN: Record<RegelPresetName, string> = {
    LOCO_BLAT: 'Loco Blatt',
    DKV: 'DKV-Turnier',
    OHNE_NEUNEN_LOCO_BLAT: 'Ohne Neunen',
    BENUTZERDEFINIERT: 'Benutzerdefiniert',
};

/** Gibt die Mindestkarten-Standardwerte für mit/ohne Neunen zurück. */
export function standardMindestkarten(ohneNeunen: boolean): Pick<RegelFelder,
    'mindestkartenReKontra' | 'mindestkartenKeine90' | 'mindestkartenKeine60' | 'mindestkartenKeine30' | 'mindestkartenSchwarz'
> {
    return ohneNeunen
        ? { mindestkartenReKontra: 9, mindestkartenKeine90: 8, mindestkartenKeine60: 7, mindestkartenKeine30: 6, mindestkartenSchwarz: 5 }
        : { mindestkartenReKontra: 11, mindestkartenKeine90: 10, mindestkartenKeine60: 9, mindestkartenKeine30: 8, mindestkartenSchwarz: 7 };
}
