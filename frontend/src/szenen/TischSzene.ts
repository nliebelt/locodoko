import Phaser from 'phaser';
import {
  TEXTUR_BLAU_GRAFIK,
  TEXTUR_FILZ,
  TEXTUR_HOLZ_DUNKEL,
  TEXTUR_KARTE_OFFEN,
  TEXTUR_KARTE_VERDECKT,
  texturSchluesselFuerKarte,
  registriereKartenSpriteTexturen
} from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import {
  erstelleTischAnsichtAusStatus,
  istTrumpfFuerSpieltyp,
  type TischAnsichtModell,
  type SpielerPosition
} from '../model/TischAnsichtModell';
import type { Ansage, KarteAntwort, Sonderpunkt, Tischhintergrund, VorbehaltAnsage } from '../modelle/SpielverwaltungDto';
import { AnimationenService, type AnimierbareKartenobjekte } from '../services/AnimationenService';
import type { AppZustand } from '../store/AppStore';

interface TischLayoutEintrag {
  x: number;
  y: number;
  kartenX: number;
  kartenY: number;
  kartenWinkel: number;
}

type TischLayout = Record<SpielerPosition, TischLayoutEintrag>;

function stichSlotPositionen(mitteX: number, mitteY: number): Record<SpielerPosition, { x: number; y: number }> {
  return {
    SUED: { x: mitteX, y: mitteY + 108 },
    WEST: { x: mitteX - 132, y: mitteY },
    NORD: { x: mitteX, y: mitteY - 108 },
    OST: { x: mitteX + 132, y: mitteY }
  };
}

function kuerzelFuerKarte(karte: KarteAntwort): string {
  const wert = ({
    AS: 'A',
    ZEHN: '10',
    KOENIG: 'K',
    DAME: 'D',
    BUBE: 'B',
    NEUN: '9'
  } as Record<string, string>)[karte.wert] ?? karte.wert.slice(0, 2);
  const farbe = ({
    KREUZ: 'K',
    PIK: 'P',
    HERZ: 'H',
    KARO: 'D'
  } as Record<string, string>)[karte.farbe] ?? karte.farbe.slice(0, 1);
  return `${farbe}${wert}`;
}

function formatiereAnsage(ansage: Ansage): string {
  return ({
    RE: 'Re',
    KONTRA: 'Kontra',
    KEINE_90: 'Keine 90',
    KEINE_60: 'Keine 60',
    KEINE_30: 'Keine 30',
    SCHWARZ: 'Schwarz'
  } as Record<Ansage, string>)[ansage];
}

function formatiereVorbehalt(vorbehalt: VorbehaltAnsage): string {
  return ({
    GESUND: 'Gesund',
    SOLO_DAME: 'Damensolo',
    SOLO_BUBE: 'Bubensolo',
    SOLO_TRUMPF: 'Trumpfsolo',
    SOLO_FLEISCHLOS: 'Fleischlos',
    HOCHZEIT: 'Hochzeit',
    ARMUT: 'Armut'
  } as Record<VorbehaltAnsage, string>)[vorbehalt];
}

function formatiereSonderpunkt(sonderpunkt: Sonderpunkt): string {
  return ({
    FUCHS_GEFANGEN: 'Fuchs gefangen',
    KARLCHEN: 'Karlchen',
    DOPPELKOPF: 'Doppelkopf'
  } as Record<Sonderpunkt, string>)[sonderpunkt];
}

function holeUiRoot(): HTMLElement {
  const wurzel = document.getElementById('ui-root');
  if (!wurzel) {
    throw new Error('Die UI-Wurzel #ui-root wurde nicht gefunden.');
  }
  return wurzel;
}

function berechneLayout(breite: number, hoehe: number): TischLayout {
  return {
    SUED: { x: breite * 0.5, y: hoehe * 0.85, kartenX: breite * 0.32, kartenY: hoehe * 0.89, kartenWinkel: 0 },
    WEST: { x: breite * 0.14, y: hoehe * 0.5, kartenX: breite * 0.1, kartenY: hoehe * 0.41, kartenWinkel: 90 },
    NORD: { x: breite * 0.5, y: hoehe * 0.15, kartenX: breite * 0.32, kartenY: hoehe * 0.11, kartenWinkel: 0 },
    OST: { x: breite * 0.86, y: hoehe * 0.5, kartenX: breite * 0.9, kartenY: hoehe * 0.41, kartenWinkel: 90 }
  };
}

function texturFuerTischhintergrund(tischhintergrund: Tischhintergrund): string {
  return ({
    FILZ_GRUEN: TEXTUR_FILZ,
    HOLZ_DUNKEL: TEXTUR_HOLZ_DUNKEL,
    BLAU_GRAFIK: TEXTUR_BLAU_GRAFIK
  } as Record<Tischhintergrund, string>)[tischhintergrund];
}

export class TischSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;

  private letzterZustand?: AppZustand;

  private hintergrund?: Phaser.GameObjects.TileSprite;

  private tischEbene?: Phaser.GameObjects.Container;

  private panel?: HTMLDivElement;

  private statusElement?: HTMLParagraphElement;

  private spielerListe?: HTMLUListElement;

  private aktionsHinweis?: HTMLParagraphElement;

  private aktionsInhalt?: HTMLDivElement;

  private ansageListe?: HTMLUListElement;

  private punktestandListe?: HTMLUListElement;

  private ergebnisInhalt?: HTMLDivElement;

  private tischhintergrundSelect?: HTMLSelectElement;

  private letzteSticheListe?: HTMLUListElement;

  private letzteSticheButton?: HTMLButtonElement;

  private toastStack?: HTMLDivElement;

  private ausgewaehlteArmutKarten = new Set<string>();

  private armutAnnahmeAktiv = false;

  private letzteSticheOffen = false;

  private animationen?: AnimationenService;

  private letztesModell: TischAnsichtModell | null = null;

  private readonly handKartenobjekte = new Map<string, AnimierbareKartenobjekte>();

  private spielzugAnimationAktiv = false;

  private wartendeKartenId: string | null = null;

  constructor() {
    super('TischSzene');
  }

  create(): void {
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const anfangsModell = erstelleTischAnsichtAusStatus(
      appStore.snapshot().spieler?.spielerId ?? null,
      appStore.snapshot().aktuellerTisch,
      appStore.snapshot().partieStand,
      appStore.snapshot().debugModus
    );
    this.hintergrund = this.add.tileSprite(
      breite / 2,
      hoehe / 2,
      breite,
      hoehe,
      texturFuerTischhintergrund(anfangsModell.tischhintergrund)
    );
    this.animationen = new AnimationenService(this);
    this.baueUi();
    // Individuelle Kartentexturen fuer das franzoesische Blatt laden (idempotent)
    registriereKartenSpriteTexturen(this);
    this.scale.on(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.abmeldenStore = appStore.abonnieren((zustand) => {
      const modell = this.erstelleModell(zustand);
      const vorherigesModell = this.letztesModell;
      this.synchronisiereAnimationszustand(modell, zustand);
      this.letzterZustand = zustand;
      this.aktualisiereUi(zustand, modell);
      if (zustand.bereich === 'LOBBY') {
        this.scene.start('LobbySzene');
        return;
      }
      this.renderTisch(zustand, modell);
      void this.starteFolgeanimationen(vorherigesModell, modell);
      this.letztesModell = modell;
    });
  }

  shutdown(): void {
    this.aufraeumen();
  }

  destroy(): void {
    this.aufraeumen();
  }

  private baueUi(): void {
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';

    const links = document.createElement('div');
    links.className = 'ui-panel ui-panel--compact';
    links.innerHTML = `
      <h2>Tischsteuerung</h2>
      <p class="ui-panel__muted"></p>
      <div class="ui-action-row">
        <button class="ui-button ui-button--secondary" type="button">Zur Lobby</button>
        <button class="ui-button ui-button--danger" type="button">Tisch verlassen</button>
        <button class="ui-button" type="button">Spiel starten</button>
        <button class="ui-button ui-button--secondary" type="button">Debug aus</button>
      </div>
      <div class="ui-grid">
        <div class="ui-stat-card"><span class="ui-hint">Spieltyp</span><strong data-spieltyp>-</strong></div>
        <div class="ui-stat-card"><span class="ui-hint">Phase</span><strong data-phase>-</strong></div>
        <div class="ui-stat-card"><span class="ui-hint">Aktiv</span><strong data-aktiv>-</strong></div>
        <div class="ui-stat-card"><span class="ui-hint">Optionen</span><strong data-optionen>-</strong></div>
       </div>
      <div class="ui-section">
        <span class="ui-hint">Tischhintergrund</span>
        <select class="ui-input ui-input--select" data-tischhintergrund>
          <option value="FILZ_GRUEN">Gruener Filz</option>
          <option value="HOLZ_DUNKEL">Dunkles Holz</option>
          <option value="BLAU_GRAFIK">Blaue Grafik</option>
        </select>
      </div>
      <h3>Spieler am Tisch</h3>
      <ul class="ui-list"></ul>
    `;

    const rechts = document.createElement('div');
    rechts.className = 'ui-panel ui-panel--compact ui-panel--right';
    rechts.innerHTML = `
      <h2>Spielaktionen</h2>
      <p class="ui-panel__muted" data-aktions-hinweis></p>
      <div class="ui-action-stack" data-aktions-inhalt></div>
      <h3>Letzte Auswertung</h3>
      <div class="ui-action-stack" data-ergebnis></div>
      <div class="ui-action-row">
        <button class="ui-button ui-button--secondary" type="button" data-letzte-stiche-toggle>Letzte Stiche anzeigen</button>
      </div>
      <ul class="ui-list ui-list--dense" data-letzte-stiche hidden></ul>
      <h3>Ansagehistorie</h3>
      <ul class="ui-list ui-list--dense" data-ansagen></ul>
      <h3>Punktestand</h3>
      <ul class="ui-list ui-list--dense" data-punktestand></ul>
    `;

    const statusElement = links.querySelector('p');
    const spielerListe = links.querySelector('ul');
    const aktionsHinweis = rechts.querySelector('[data-aktions-hinweis]');
    const aktionsInhalt = rechts.querySelector('[data-aktions-inhalt]');
    const ergebnisInhalt = rechts.querySelector('[data-ergebnis]');
    const letzteSticheListe = rechts.querySelector('[data-letzte-stiche]');
    const letzteSticheButton = rechts.querySelector('[data-letzte-stiche-toggle]');
    const ansageListe = rechts.querySelector('[data-ansagen]');
    const punktestandListe = rechts.querySelector('[data-punktestand]');
    const tischhintergrundSelect = links.querySelector('[data-tischhintergrund]');
    const buttons = links.querySelectorAll('button');
    const lobbyButton = buttons.item(0);
    const leaveButton = buttons.item(1);
    const startButton = buttons.item(2);
    const debugButton = buttons.item(3);
    if (!(statusElement instanceof HTMLParagraphElement)
      || !(spielerListe instanceof HTMLUListElement)
      || !(aktionsHinweis instanceof HTMLParagraphElement)
      || !(aktionsInhalt instanceof HTMLDivElement)
      || !(ergebnisInhalt instanceof HTMLDivElement)
      || !(letzteSticheListe instanceof HTMLUListElement)
      || !(letzteSticheButton instanceof HTMLButtonElement)
      || !(ansageListe instanceof HTMLUListElement)
      || !(punktestandListe instanceof HTMLUListElement)
      || !(tischhintergrundSelect instanceof HTMLSelectElement)
      || !(lobbyButton instanceof HTMLButtonElement)
      || !(leaveButton instanceof HTMLButtonElement)
      || !(startButton instanceof HTMLButtonElement)
      || !(debugButton instanceof HTMLButtonElement)) {
      throw new Error('Tisch-UI konnte nicht aufgebaut werden.');
    }

    lobbyButton.addEventListener('click', () => {
      this.scene.start('LobbySzene');
    });
    leaveButton.addEventListener('click', () => {
      void appStore.verlasseAktuellenTisch();
    });
    startButton.addEventListener('click', () => {
      void appStore.starteAktuellenTisch();
    });
    debugButton.addEventListener('click', () => {
      appStore.toggleDebugModus();
    });
    tischhintergrundSelect.addEventListener('change', () => {
      void appStore.aktualisiereAktuellenTischhintergrund(tischhintergrundSelect.value as Tischhintergrund);
    });
    letzteSticheButton.addEventListener('click', () => {
      this.letzteSticheOffen = !this.letzteSticheOffen;
      if (this.letzterZustand) {
        this.aktualisiereUi(this.letzterZustand);
      }
    });

    const toastStack = document.createElement('div');
    toastStack.className = 'ui-toast-stack';

    this.panel = links;
    this.statusElement = statusElement;
    this.spielerListe = spielerListe;
    this.aktionsHinweis = aktionsHinweis;
    this.aktionsInhalt = aktionsInhalt;
    this.ergebnisInhalt = ergebnisInhalt;
    this.letzteSticheListe = letzteSticheListe;
    this.letzteSticheButton = letzteSticheButton;
    this.ansageListe = ansageListe;
    this.punktestandListe = punktestandListe;
    this.tischhintergrundSelect = tischhintergrundSelect;
    this.toastStack = toastStack;
    uiRoot.append(links, rechts, toastStack);
  }

  private aktualisiereUi(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    const tisch = zustand.aktuellerTisch;
    if (!tisch || !this.statusElement || !this.spielerListe || !this.panel) {
      return;
    }
    this.synchronisiereAktionZustand(modell);

    const buttons = this.panel.querySelectorAll('button');
    const leaveButton = buttons.item(1);
    const startButton = buttons.item(2);
    const debugButton = buttons.item(3);
    if (leaveButton instanceof HTMLButtonElement) {
      leaveButton.disabled = zustand.wirdGeladen || tisch.status !== 'WARTEND';
    }
    if (startButton instanceof HTMLButtonElement) {
      const darfStarten = zustand.spieler?.spielerId === tisch.erstelltVonSpielerId && tisch.status === 'WARTEND';
      startButton.disabled = zustand.wirdGeladen || !darfStarten;
    }
    if (debugButton instanceof HTMLButtonElement) {
      debugButton.textContent = zustand.debugModus ? 'Debug an' : 'Debug aus';
      debugButton.disabled = zustand.wirdGeladen || !zustand.partieStand;
    }
    if (this.tischhintergrundSelect) {
      const darfKonfigurieren = zustand.spieler?.spielerId === tisch.erstelltVonSpielerId && tisch.status === 'WARTEND';
      this.tischhintergrundSelect.value = modell.tischhintergrund;
      this.tischhintergrundSelect.disabled = zustand.wirdGeladen || !darfKonfigurieren;
    }

    const statusZeile = [
      `${tisch.name} · ${tisch.status}`,
      `${tisch.spieler.length}/4 Spieler`,
      tisch.partieId ? `Partie ${tisch.partieId}` : 'Noch keine Partie gestartet'
    ];
    if (zustand.partieStand) {
      statusZeile.push(`Gesamtstand ${zustand.partieStand.gespielteSpiele}/${zustand.partieStand.anzahlSpiele}`);
      if (zustand.partieStand.laufendesSpiel) {
        statusZeile.push(`Phase ${zustand.partieStand.laufendesSpiel.phase}`);
      }
    }
    if (zustand.meldung?.typ === 'fehler') {
      statusZeile.push(`Fehler: ${zustand.meldung.text}`);
    }
    this.statusElement.textContent = statusZeile.join(' · ');
    this.aktualisiereStatistiken(modell);
    this.aktualisiereAktionsbereich(modell, zustand);
    this.aktualisiereErgebnis(modell);
    this.aktualisiereLetzteStiche(modell);
    this.aktualisiereAnsageHistorie(modell);
    this.aktualisierePunktestand(modell);
    this.aktualisiereToasts(zustand);

    this.spielerListe.innerHTML = '';
    modell.spieler.forEach((spieler) => {
      const eintrag = document.createElement('li');
      eintrag.className = 'ui-list-item';
      const badge = spieler.istSelbst ? 'Du' : spieler.istMensch ? 'Mensch' : 'KI';
      const parteiBadge = spieler.partei ? `<span class="ui-badge ui-badge--partei">${spieler.partei}</span>` : '';
      eintrag.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${spieler.name}</strong>
          <span class="ui-badge ${spieler.istSelbst ? 'ui-badge--highlight' : ''}">${badge}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${spieler.istErsteller ? 'Ersteller' : spieler.statusText}</span>
          <span>${spieler.istGeber ? 'Geber' : `${spieler.stiche} Stiche`}</span>
          ${parteiBadge}
        </div>
      `;
      this.spielerListe?.append(eintrag);
    });
  }

  private renderTisch(zustand: AppZustand, modell = this.erstelleModell(zustand)): void {
    this.tischEbene?.destroy(true);
    this.handKartenobjekte.clear();
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const layout = berechneLayout(breite, hoehe);
    const mitteX = breite / 2;
    const mitteY = hoehe / 2;
    const tischBreite = Math.min(breite * 0.76, 980);
    const tischHoehe = Math.min(hoehe * 0.74, 530);
    this.hintergrund
      ?.setTexture(texturFuerTischhintergrund(modell.tischhintergrund))
      .setPosition(mitteX, mitteY)
      .setSize(breite, hoehe);

    const ebene = this.add.container(0, 0);
    ebene.add(this.add.ellipse(mitteX, mitteY, tischBreite, tischHoehe, 0x081c15, 0.32).setStrokeStyle(8, 0xd8f3dc, 0.42));
    ebene.add(this.add.text(mitteX, hoehe * 0.06, modell.titel, {
      color: '#f8f9fa',
      fontSize: `${Math.round(Math.max(24, breite * 0.024))}px`,
      fontStyle: 'bold'
    }).setOrigin(0.5));
    ebene.add(this.add.text(mitteX, hoehe * 0.1, `${modell.untertitel} · ${modell.statusText}`, {
      color: '#d8f3dc',
      fontSize: `${Math.round(Math.max(14, breite * 0.013))}px`
    }).setOrigin(0.5));

    this.renderStichmitte(ebene, modell, mitteX, mitteY);

    modell.spieler.forEach((spieler) => {
      const position = layout[spieler.position];
      const farbe = spieler.istAktivHervorgehoben ? 0xffe082 : 0xcfe6d6;
      ebene.add(this.add.circle(position.x, position.y, Math.max(48, breite * 0.045), farbe, 0.94).setStrokeStyle(4, 0x14361f, 0.35));
      ebene.add(this.add.text(position.x, position.y - 18, spieler.name, {
        color: '#14361f',
        fontSize: `${Math.round(Math.max(15, breite * 0.014))}px`,
        fontStyle: 'bold'
      }).setOrigin(0.5));
      ebene.add(this.add.text(position.x, position.y + 8, spieler.statusText, {
        color: '#14361f',
        fontSize: `${Math.round(Math.max(13, breite * 0.012))}px`
      }).setOrigin(0.5));
      ebene.add(this.add.text(position.x, position.y + 28, spieler.istErsteller ? 'Ersteller' : spieler.verbleibendeKarten > 0 ? `${spieler.verbleibendeKarten} Karten` : 'Wartet', {
        color: '#14361f',
        fontSize: `${Math.round(Math.max(11, breite * 0.01))}px`
      }).setOrigin(0.5));
      if (spieler.partei) {
        ebene.add(this.add.text(position.x, position.y - 46, spieler.partei, {
          color: spieler.partei === 'RE' ? '#ffd166' : '#90caf9',
          fontSize: `${Math.round(Math.max(12, breite * 0.011))}px`,
          fontStyle: 'bold'
        }).setOrigin(0.5));
      }
      if (spieler.istGeber) {
        ebene.add(this.add.text(position.x + 44, position.y - 48, 'G', {
          color: '#f8f9fa',
          fontSize: `${Math.round(Math.max(12, breite * 0.01))}px`,
          fontStyle: 'bold',
          backgroundColor: '#14361f'
        }).setOrigin(0.5));
      }
      this.renderKartenFaecher(ebene, layout, spieler, modell);
    });

    if (modell.gesamtpunktestand.length > 0) {
      const punktetext = modell.gesamtpunktestand
        .map((eintrag) => `${eintrag.name}: ${eintrag.punkte}`)
        .join(' · ');
      ebene.add(this.add.text(mitteX, hoehe * 0.94, `Gesamtstand · ${punktetext}`, {
        color: '#f8f9fa',
        fontSize: `${Math.round(Math.max(14, breite * 0.012))}px`
      }).setOrigin(0.5));
    }

    this.tischEbene = ebene;
  }

  private renderStichmitte(
    ebene: Phaser.GameObjects.Container,
    modell: TischAnsichtModell,
    mitteX: number,
    mitteY: number
  ): void {
    const slotPositionen = stichSlotPositionen(mitteX, mitteY);

    ebene.add(this.add.text(mitteX, mitteY - 160, modell.aktuellerSpieler ? `Am Zug: ${this.nameFuerPosition(modell, modell.aktuellerSpieler)}` : 'Warte auf den naechsten Zug', {
      color: '#f8f9fa',
      fontSize: '20px',
      fontStyle: 'bold'
    }).setOrigin(0.5));

    if (modell.aktuelleStichmitte.length === 0) {
      ebene.add(this.add.text(mitteX, mitteY, 'Noch keine Karte im laufenden Stich', {
        color: '#d8f3dc',
        fontSize: '18px',
        align: 'center'
      }).setOrigin(0.5));
      return;
    }

    modell.aktuelleStichmitte.forEach((eintrag) => {
      const slot = slotPositionen[eintrag.position];
      ebene.add(this.add.image(slot.x, slot.y, texturSchluesselFuerKarte(eintrag.karte.farbe, eintrag.karte.wert)).setDisplaySize(82, 124));
      ebene.add(this.add.text(slot.x, slot.y + 78, eintrag.name, {
        color: '#d8f3dc',
        fontSize: '13px'
      }).setOrigin(0.5));
    });
  }

  private aktualisiereStatistiken(modell: TischAnsichtModell): void {
    if (!this.panel) {
      return;
    }
    this.setzeStatText('spieltyp', modell.spieltyp ?? 'Noch offen');
    this.setzeStatText('phase', modell.phase ?? 'Warten');
    this.setzeStatText('aktiv', modell.aktuellerSpieler ? this.nameFuerPosition(modell, modell.aktuellerSpieler) : 'Niemand');
    const optionen = [...modell.moeglicheAnsagen.map(formatiereAnsage), ...modell.moeglicheVorbehalte.map(formatiereVorbehalt)];
    this.setzeStatText('optionen', optionen.length > 0 ? optionen.join(', ') : 'Keine');
  }

  private aktualisiereAktionsbereich(modell: TischAnsichtModell, zustand: AppZustand): void {
    if (!this.aktionsHinweis || !this.aktionsInhalt) {
      return;
    }

    const aktionenDeaktiviert = zustand.wirdGeladen || this.spielzugAnimationAktiv;
    this.aktionsHinweis.textContent = this.bestimmeAktionsHinweis(modell, zustand);
    this.aktionsInhalt.innerHTML = '';

    if (!zustand.partieStand?.laufendesSpiel) {
      this.aktionsInhalt.append(this.erstelleInfoSektion('Sobald die Partie laeuft, erscheinen hier deine phasenabhaengigen Aktionen.'));
      return;
    }

    const istEigenerZug = modell.aktuellerSpieler === 'SUED';
    if (istEigenerZug && modell.moeglicheVorbehalte.length > 0) {
      this.aktionsInhalt.append(this.erstelleVorbehaltSektion(modell.moeglicheVorbehalte, aktionenDeaktiviert));
    }

    if (istEigenerZug && modell.moeglicheAnsagen.length > 0) {
      this.aktionsInhalt.append(this.erstelleAnsageSektion(modell.moeglicheAnsagen, aktionenDeaktiviert));
    }

    if (istEigenerZug && modell.armutAktion) {
      this.aktionsInhalt.append(this.erstelleArmutSektion(modell, aktionenDeaktiviert));
    }

    if (this.aktionsInhalt.childElementCount === 0) {
      const text = istEigenerZug && modell.phase === 'STICHPHASE'
        ? 'Spiele eine der hervorgehobenen Karten aus deiner Hand.'
        : 'Aktuell wartet das Spiel auf andere Spieler oder auf den naechsten serverseitigen Statuswechsel.';
      this.aktionsInhalt.append(this.erstelleInfoSektion(text));
    }
  }

  private aktualisiereAnsageHistorie(modell: TischAnsichtModell): void {
    if (!this.ansageListe) {
      return;
    }
    this.ansageListe.innerHTML = '';
    const eintraege = modell.ansageHistorie.slice(-6).reverse();
    if (eintraege.length === 0) {
      this.ansageListe.append(this.erstelleListenHinweis('Noch keine oeffentliche Ansage.'));
      return;
    }
    eintraege.forEach((eintrag) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${eintrag.name}</strong>
          <span class="ui-badge">${eintrag.position}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${formatiereAnsage(eintrag.ansage)}</span>
        </div>
      `;
      this.ansageListe?.append(li);
    });
  }

  private aktualisierePunktestand(modell: TischAnsichtModell): void {
    if (!this.punktestandListe) {
      return;
    }
    this.punktestandListe.innerHTML = '';
    if (modell.gesamtpunktestand.length === 0) {
      this.punktestandListe.append(this.erstelleListenHinweis('Sobald ein Spiel gewertet wurde, erscheint hier der Stand.'));
      return;
    }
    modell.gesamtpunktestand.forEach((eintrag) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${eintrag.name}</strong>
          <span class="ui-badge ${eintrag.position === 'SUED' ? 'ui-badge--highlight' : ''}">${eintrag.position}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${eintrag.punkte} Punkte</span>
        </div>
      `;
      this.punktestandListe?.append(li);
    });
  }

  private aktualisiereErgebnis(modell: TischAnsichtModell): void {
    if (!this.ergebnisInhalt) {
      return;
    }
    this.ergebnisInhalt.innerHTML = '';
    const ergebnis = modell.letztesSpielergebnis;
    if (!ergebnis) {
      this.ergebnisInhalt.append(this.erstelleInfoSektion(
        'Sobald ein Spiel abgeschlossen ist, erscheint hier die Auswertung mit Augen, Spielwert und Sonderpunkten.'
      ));
      return;
    }

    const sektion = this.erstelleSektion(
      `Spiel ${ergebnis.spielNummer} · ${ergebnis.spieltyp}`,
      `Sieger: ${ergebnis.siegerPartei} · Spielwert ${ergebnis.spielwert}`
    );
    const augen = document.createElement('div');
    augen.className = 'ui-grid ui-grid--two';
    augen.innerHTML = `
      <div class="ui-stat-card"><span class="ui-hint">Re</span><strong>${ergebnis.augenRe} Augen</strong></div>
      <div class="ui-stat-card"><span class="ui-hint">Kontra</span><strong>${ergebnis.augenKontra} Augen</strong></div>
    `;
    const sonderpunkte = document.createElement('div');
    sonderpunkte.className = 'ui-list-item ui-list-item--dense';
    sonderpunkte.innerHTML = `
      <div class="ui-list-item__headline">
        <strong>Sonderpunkte</strong>
        <span class="ui-badge">${ergebnis.siegerPartei}</span>
      </div>
      <div class="ui-list-item__meta">
        <span>Re: ${ergebnis.sonderpunkteRe.length > 0 ? ergebnis.sonderpunkteRe.map(formatiereSonderpunkt).join(', ') : 'Keine'}</span>
        <span>Kontra: ${ergebnis.sonderpunkteKontra.length > 0 ? ergebnis.sonderpunkteKontra.map(formatiereSonderpunkt).join(', ') : 'Keine'}</span>
      </div>
    `;
    const punkteListe = document.createElement('ul');
    punkteListe.className = 'ui-list ui-list--dense';
    ergebnis.spielpunkte.forEach((eintrag) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>${eintrag.name}</strong>
          <span class="ui-badge ${eintrag.position === 'SUED' ? 'ui-badge--highlight' : ''}">${eintrag.position}</span>
        </div>
        <div class="ui-list-item__meta">
          <span>${eintrag.punkte >= 0 ? '+' : ''}${eintrag.punkte} Spielpunkte</span>
        </div>
      `;
      punkteListe.append(li);
    });
    sektion.append(augen, sonderpunkte, punkteListe);
    this.ergebnisInhalt.append(sektion);
  }

  private aktualisiereLetzteStiche(modell: TischAnsichtModell): void {
    if (!this.letzteSticheListe || !this.letzteSticheButton) {
      return;
    }
    const stiche = modell.letzteAbgeschlosseneStiche.slice(-3).reverse();
    if (stiche.length === 0) {
      this.letzteSticheOffen = false;
      this.letzteSticheButton.disabled = true;
      this.letzteSticheButton.textContent = 'Keine letzten Stiche';
      this.letzteSticheListe.hidden = true;
      this.letzteSticheListe.innerHTML = '';
      return;
    }

    this.letzteSticheButton.disabled = false;
    this.letzteSticheButton.textContent = this.letzteSticheOffen
      ? 'Letzte Stiche ausblenden'
      : 'Letzte Stiche anzeigen';
    this.letzteSticheListe.hidden = !this.letzteSticheOffen;
    this.letzteSticheListe.innerHTML = '';
    stiche.forEach((stich) => {
      const li = document.createElement('li');
      li.className = 'ui-list-item ui-list-item--dense';
      li.innerHTML = `
        <div class="ui-list-item__headline">
          <strong>Stich ${stich.stichNummer} · Spiel ${stich.spielNummer}</strong>
          <span class="ui-badge">${stich.augen} Augen</span>
        </div>
        <div class="ui-list-item__meta">
          <span>Gewinner: ${stich.gewinnerName}</span>
          <span>${stich.gespielteKarten.map((karte) => `${karte.name}: ${kuerzelFuerKarte(karte.karte)}`).join(' · ')}</span>
        </div>
      `;
      this.letzteSticheListe?.append(li);
    });
  }

  private aktualisiereToasts(zustand: AppZustand): void {
    if (!this.toastStack) {
      return;
    }
    this.toastStack.innerHTML = '';
    if (!zustand.meldung) {
      return;
    }
    const toast = document.createElement('div');
    toast.className = `ui-toast ${zustand.meldung.typ === 'fehler' ? 'ui-toast--error' : ''}`;
    toast.innerHTML = `
      <strong>${zustand.meldung.typ === 'fehler' ? 'Fehler' : 'Info'}</strong>
      <div>${zustand.meldung.text}</div>
    `;
    this.toastStack.append(toast);
  }

  private renderKartenFaecher(
    ebene: Phaser.GameObjects.Container,
    layout: TischLayout,
    spieler: TischAnsichtModell['spieler'][number],
    modell: TischAnsichtModell
  ): void {
    const position = layout[spieler.position];
    const offen = spieler.istSelbst || (modell.debugModus && spieler.sichtbareHandkarten.length > 0);
    const sichtbareHandkarten = spieler.sichtbareHandkarten.length > 0 ? spieler.sichtbareHandkarten : undefined;
    const kartenAnzahl = sichtbareHandkarten?.length ?? Math.max(spieler.verbleibendeKarten, 0);
    const armutKarten = spieler.istSelbst ? this.ermittleArmutAuswahl(modell, sichtbareHandkarten ?? []) : null;
    const hatInteraktion = spieler.istSelbst && (modell.spielbareKarten.length > 0 || armutKarten !== null);

    for (let index = 0; index < kartenAnzahl; index += 1) {
      const abstand = spieler.position === 'SUED' || spieler.position === 'NORD' ? index * 28 : index * 16;
      const x = (spieler.position === 'SUED' || spieler.position === 'NORD') ? position.kartenX + abstand : position.kartenX;
      const y = (spieler.position === 'SUED' || spieler.position === 'NORD') ? position.kartenY : position.kartenY + abstand;
      const winkel = spieler.position === 'SUED'
        ? -12 + index * 3
        : spieler.position === 'NORD'
          ? 12 - index * 3
          : position.kartenWinkel;
      const karte = sichtbareHandkarten?.[index];
      const istSpielbar = karte ? modell.spielbareKarten.includes(karte.id) : false;
      const istArmutauswahl = karte ? (armutKarten?.has(karte.id) ?? false) : false;
      const istInteraktiv = !this.spielzugAnimationAktiv && (istSpielbar || istArmutauswahl);
      const istAusgewaehlt = karte ? this.ausgewaehlteArmutKarten.has(karte.id) : false;
      // Kartenspezifische Textur fuer aufgedeckte Karten, Rueckseite fuer verdeckte
      const textur = (offen && karte)
        ? texturSchluesselFuerKarte(karte.farbe, karte.wert)
        : offen ? TEXTUR_KARTE_OFFEN : TEXTUR_KARTE_VERDECKT;
      const basisVersatz = istAusgewaehlt ? -24 : 0;

      const bild = this.add.image(x, y + basisVersatz, textur)
        .setDisplaySize(82, 124)
        .setAngle(winkel)
        .setAlpha(offen ? (hatInteraktion && karte && !istInteraktiv ? 0.5 : 1) : 0.92);
      if (istAusgewaehlt) {
        bild.setTint(0xffe082);
      }
      ebene.add(bild);

      if (karte) {
        this.handKartenobjekte.set(karte.id, { bild });
      }

      if (offen && karte && istInteraktiv) {
        const setzeOffset = (zusatz: number): void => {
          bild.setY(y + basisVersatz + zusatz);
        };
        bild.setInteractive({ useHandCursor: true });
        bild.on('pointerover', () => setzeOffset(-10));
        bild.on('pointerout', () => setzeOffset(0));
        bild.on('pointerdown', () => {
          if (istSpielbar) {
            void this.spieleKarteMitAnimation(karte.id, modell);
            return;
          }
          this.toggleArmutKarte(karte.id, modell.armutAktion?.kartenAnzahl ?? 0);
          this.renderTisch(this.letzterZustand ?? appStore.snapshot());
          this.aktualisiereAktionsbereich(modell, this.letzterZustand ?? appStore.snapshot());
        });
      }
    }
  }

  private erstelleVorbehaltSektion(vorbehalte: VorbehaltAnsage[], deaktiviert: boolean): HTMLElement {
    const sektion = this.erstelleSektion('Vorbehalt waehlen', 'Nur serverseitig erlaubte Optionen sind sichtbar.');
    const buttonReihe = document.createElement('div');
    buttonReihe.className = 'ui-action-row';
    vorbehalte.forEach((vorbehalt) => {
      buttonReihe.append(this.erstelleButton(formatiereVorbehalt(vorbehalt), () => appStore.meldeVorbehalt(vorbehalt), deaktiviert));
    });
    sektion.append(buttonReihe);
    return sektion;
  }

  private erstelleAnsageSektion(ansagen: Ansage[], deaktiviert: boolean): HTMLElement {
    const sektion = this.erstelleSektion('Ansagen', 'Ansagen verschwinden automatisch, sobald sie nicht mehr regelkonform sind.');
    const buttonReihe = document.createElement('div');
    buttonReihe.className = 'ui-action-row';
    ansagen.forEach((ansage) => {
      buttonReihe.append(this.erstelleButton(formatiereAnsage(ansage), () => appStore.sageAnsageAn(ansage), deaktiviert));
    });
    sektion.append(buttonReihe);
    return sektion;
  }

  private erstelleArmutSektion(modell: TischAnsichtModell, deaktiviert: boolean): HTMLElement {
    const armutAktion = modell.armutAktion;
    if (!armutAktion) {
      return this.erstelleInfoSektion('Keine aktive Armut-Aktion vorhanden.');
    }

    if (armutAktion.modus === 'ANBIETEN') {
      const sektion = this.erstelleSektion(
        'Armut anbieten',
        `Waehle genau ${armutAktion.kartenAnzahl} Trumpfkarte${armutAktion.kartenAnzahl === 1 ? '' : 'n'} und bestaetige das Angebot.`
      );
      sektion.append(this.erstelleAuswahlHinweis(armutAktion.kartenAnzahl));
      sektion.append(this.erstelleButton(
        'Trumpfkarten anbieten',
        () => this.bestaetigeArmut(modell),
        deaktiviert || this.ausgewaehlteArmutKarten.size !== armutAktion.kartenAnzahl
      ));
      return sektion;
    }

    const sektion = this.erstelleSektion(
      `Armut von ${armutAktion.armutSpielerName}`,
      `Bei Annahme gibst du ${armutAktion.kartenAnzahl} Karte${armutAktion.kartenAnzahl === 1 ? '' : 'n'} zurueck.`
    );
    if (!this.armutAnnahmeAktiv) {
      const buttonReihe = document.createElement('div');
      buttonReihe.className = 'ui-action-row';
      buttonReihe.append(this.erstelleButton('Annehmen', () => {
        if (armutAktion.kartenAnzahl === 0) {
          appStore.beantworteArmut(true, []);
          return;
        }
        this.armutAnnahmeAktiv = true;
        this.ausgewaehlteArmutKarten.clear();
        this.aktualisiereAktionsbereich(modell, this.letzterZustand ?? appStore.snapshot());
        this.renderTisch(this.letzterZustand ?? appStore.snapshot());
      }, deaktiviert));
      buttonReihe.append(this.erstelleButton('Ablehnen', () => {
        this.armutAnnahmeAktiv = false;
        this.ausgewaehlteArmutKarten.clear();
        appStore.beantworteArmut(false, []);
      }, deaktiviert, 'ui-button--secondary'));
      sektion.append(buttonReihe);
      return sektion;
    }

    sektion.append(this.erstelleAuswahlHinweis(armutAktion.kartenAnzahl));
    const buttonReihe = document.createElement('div');
    buttonReihe.className = 'ui-action-row';
    buttonReihe.append(this.erstelleButton(
      'Annahme bestaetigen',
      () => this.bestaetigeArmut(modell),
      deaktiviert || this.ausgewaehlteArmutKarten.size !== armutAktion.kartenAnzahl
    ));
    buttonReihe.append(this.erstelleButton('Abbrechen', () => {
      this.armutAnnahmeAktiv = false;
      this.ausgewaehlteArmutKarten.clear();
      this.aktualisiereAktionsbereich(modell, this.letzterZustand ?? appStore.snapshot());
      this.renderTisch(this.letzterZustand ?? appStore.snapshot());
    }, deaktiviert, 'ui-button--secondary'));
    sektion.append(buttonReihe);
    return sektion;
  }

  private bestaetigeArmut(modell: TischAnsichtModell): void {
    if (!modell.armutAktion) {
      return;
    }
    appStore.beantworteArmut(true, Array.from(this.ausgewaehlteArmutKarten));
    this.armutAnnahmeAktiv = false;
    this.ausgewaehlteArmutKarten.clear();
  }

  private ermittleArmutAuswahl(modell: TischAnsichtModell, handkarten: KarteAntwort[]): Set<string> | null {
    const armutAktion = modell.armutAktion;
    if (!armutAktion || modell.aktuellerSpieler !== 'SUED') {
      return null;
    }
    if (armutAktion.modus === 'ANTWORTEN' && !this.armutAnnahmeAktiv) {
      return null;
    }
    const ids = armutAktion.modus === 'ANBIETEN'
      ? handkarten.filter((karte) => istTrumpfFuerSpieltyp(karte, modell.spieltyp)).map((karte) => karte.id)
      : handkarten.map((karte) => karte.id);
    return new Set(ids);
  }

  private synchronisiereAktionZustand(modell: TischAnsichtModell): void {
    if (!modell.armutAktion || modell.aktuellerSpieler !== 'SUED') {
      this.armutAnnahmeAktiv = false;
      this.ausgewaehlteArmutKarten.clear();
      return;
    }

    if (modell.armutAktion.modus === 'ANBIETEN') {
      this.armutAnnahmeAktiv = false;
    }

    const eigeneHand = modell.spieler.find((spieler) => spieler.istSelbst)?.sichtbareHandkarten ?? [];
    const sichtbareIds = new Set(eigeneHand.map((karte) => karte.id));
    this.ausgewaehlteArmutKarten = new Set(
      [...this.ausgewaehlteArmutKarten].filter((karteId) => sichtbareIds.has(karteId)).slice(0, modell.armutAktion.kartenAnzahl)
    );
  }

  private toggleArmutKarte(karteId: string, maximum: number): void {
    if (maximum <= 0) {
      return;
    }
    if (this.ausgewaehlteArmutKarten.has(karteId)) {
      this.ausgewaehlteArmutKarten.delete(karteId);
      return;
    }
    if (this.ausgewaehlteArmutKarten.size >= maximum) {
      return;
    }
    this.ausgewaehlteArmutKarten.add(karteId);
  }

  private bestimmeAktionsHinweis(modell: TischAnsichtModell, zustand: AppZustand): string {
    if (this.spielzugAnimationAktiv) {
      return 'Deine Karte wird gerade ausgespielt. Warte kurz auf den serverseitigen Folgezustand.';
    }
    if (!zustand.partieStand?.laufendesSpiel) {
      return 'Noch keine laufende Partie.';
    }
    if (modell.aktuellerSpieler === 'SUED') {
      if (modell.phase === 'STICHPHASE') {
        return 'Du bist dran. Spiel eine serverseitig erlaubte Karte oder taetige eine Ansage.';
      }
      if (modell.phase === 'VORBEHALT_ANSAGE') {
        return 'Du bist an der Reihe, einen Vorbehalt zu melden.';
      }
      if (modell.phase === 'ARMUT_TAUSCH') {
        return 'Die Armutphase wartet auf deine Auswahl.';
      }
      return 'Die aktuelle Phase erwartet eine Aktion von dir.';
    }
    return modell.aktuellerSpieler
      ? `Aktuell ist ${this.nameFuerPosition(modell, modell.aktuellerSpieler)} dran.`
      : 'Warte auf den serverseitigen Phasenwechsel.';
  }

  private erstelleModell(zustand: AppZustand): TischAnsichtModell {
    return erstelleTischAnsichtAusStatus(
      zustand.spieler?.spielerId ?? null,
      zustand.aktuellerTisch,
      zustand.partieStand,
      zustand.debugModus
    );
  }

  private synchronisiereAnimationszustand(modell: TischAnsichtModell, zustand: AppZustand): void {
    if (!this.wartendeKartenId) {
      return;
    }
    const eigeneSichtbareHand = modell.spieler.find((spieler) => spieler.istSelbst)?.sichtbareHandkarten ?? [];
    const karteLiegtInHand = eigeneSichtbareHand.some((karte) => karte.id === this.wartendeKartenId);
    const karteLiegtImStich = modell.aktuelleStichmitte.some((eintrag) => eintrag.karte.id === this.wartendeKartenId);
    if (!karteLiegtInHand || karteLiegtImStich || zustand.meldung?.typ === 'fehler') {
      this.spielzugAnimationAktiv = false;
      this.wartendeKartenId = null;
    }
  }

  private async spieleKarteMitAnimation(karteId: string, modell: TischAnsichtModell): Promise<void> {
    if (this.spielzugAnimationAktiv) {
      return;
    }
    const kartenobjekte = this.handKartenobjekte.get(karteId);
    if (!kartenobjekte) {
      appStore.spieleKarte(karteId);
      return;
    }

    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const ziel = stichSlotPositionen(breite / 2, hoehe / 2).SUED;
    this.spielzugAnimationAktiv = true;
    this.wartendeKartenId = karteId;
    this.aktualisiereAktionsbereich(modell, this.letzterZustand ?? appStore.snapshot());
    await this.animationen?.animiereKarteAusspielen(kartenobjekte, ziel);
    appStore.spieleKarte(karteId);
  }

  private async starteFolgeanimationen(vorherigesModell: TischAnsichtModell | null, aktuellesModell: TischAnsichtModell): Promise<void> {
    const abgeschlossenerStich = this.ermittleNeuAbgeschlossenenStich(vorherigesModell, aktuellesModell);
    if (!abgeschlossenerStich) {
      return;
    }

    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    const slotPositionen = stichSlotPositionen(breite / 2, hoehe / 2);
    const layout = berechneLayout(breite, hoehe);
    const ziel = layout[abgeschlossenerStich.gewinnerPosition];
    const animierteKarten = abgeschlossenerStich.gespielteKarten.map((karte) => {
      const slot = slotPositionen[karte.position];
      const bild = this.add.image(slot.x, slot.y, texturSchluesselFuerKarte(karte.karte.farbe, karte.karte.wert)).setDisplaySize(82, 124);
      return { bild };
    });

    try {
      await this.animationen?.animiereStichEinziehen(animierteKarten, { x: ziel.x, y: ziel.y });
    } finally {
      animierteKarten.forEach((karte) => {
        karte.bild.destroy();
      });
    }
  }

  private ermittleNeuAbgeschlossenenStich(
    vorherigesModell: TischAnsichtModell | null,
    aktuellesModell: TischAnsichtModell
  ): TischAnsichtModell['letzteAbgeschlosseneStiche'][number] | null {
    if (!vorherigesModell || vorherigesModell.aktuelleStichmitte.length !== 4 || aktuellesModell.aktuelleStichmitte.length > 0) {
      return null;
    }
    const letzterVorher = vorherigesModell.letzteAbgeschlosseneStiche.at(-1);
    const letzterAktuell = aktuellesModell.letzteAbgeschlosseneStiche.at(-1);
    if (!letzterAktuell) {
      return null;
    }
    if (letzterVorher
      && letzterVorher.spielNummer === letzterAktuell.spielNummer
      && letzterVorher.stichNummer === letzterAktuell.stichNummer) {
      return null;
    }
    return letzterAktuell;
  }

  private nameFuerPosition(modell: TischAnsichtModell, position: SpielerPosition): string {
    return modell.spieler.find((spieler) => spieler.position === position)?.name ?? position;
  }

  private erstelleSektion(titel: string, beschreibung: string): HTMLDivElement {
    const sektion = document.createElement('div');
    sektion.className = 'ui-section';
    const headline = document.createElement('strong');
    headline.textContent = titel;
    const text = document.createElement('span');
    text.className = 'ui-hint';
    text.textContent = beschreibung;
    sektion.append(headline, text);
    return sektion;
  }

  private erstelleInfoSektion(text: string): HTMLDivElement {
    const sektion = document.createElement('div');
    sektion.className = 'ui-section';
    const hinweis = document.createElement('span');
    hinweis.className = 'ui-hint';
    hinweis.textContent = text;
    sektion.append(hinweis);
    return sektion;
  }

  private erstelleAuswahlHinweis(erwarteteAnzahl: number): HTMLDivElement {
    const auswahl = document.createElement('div');
    auswahl.className = 'ui-selection';
    const ids = Array.from(this.ausgewaehlteArmutKarten);
    auswahl.textContent = ids.length > 0
      ? `Ausgewaehlt (${ids.length}/${erwarteteAnzahl}): ${ids.join(', ')}`
      : `Ausgewaehlt (0/${erwarteteAnzahl}): noch keine Karten.`;
    return auswahl;
  }

  private erstelleButton(
    text: string,
    handler: () => void,
    deaktiviert: boolean,
    klasse = ''
  ): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = ['ui-button', klasse].filter(Boolean).join(' ');
    button.textContent = text;
    button.disabled = deaktiviert;
    button.addEventListener('click', handler);
    return button;
  }

  private erstelleListenHinweis(text: string): HTMLLIElement {
    const li = document.createElement('li');
    li.className = 'ui-list-item ui-list-item--dense';
    li.innerHTML = `<span class="ui-hint">${text}</span>`;
    return li;
  }

  private setzeStatText(name: string, text: string): void {
    const element = this.panel?.querySelector(`[data-${name}]`);
    if (element) {
      element.textContent = text;
    }
  }

  private handleResize(): void {
    const breite = this.scale.gameSize.width;
    const hoehe = this.scale.gameSize.height;
    this.hintergrund?.setPosition(breite / 2, hoehe / 2).setSize(breite, hoehe);
    if (this.letzterZustand?.bereich === 'TISCH') {
      this.renderTisch(this.letzterZustand);
    }
  }

  private aufraeumen(): void {
    this.scale.off(Phaser.Scale.Events.RESIZE, this.handleResize, this);
    this.abmeldenStore?.();
    this.abmeldenStore = undefined;
    this.animationen?.abbrechen();
    this.animationen = undefined;
    this.tischEbene?.destroy(true);
    this.tischEbene = undefined;
    this.hintergrund?.destroy();
    this.hintergrund = undefined;
    this.letzterZustand = undefined;
    this.letztesModell = null;
    this.handKartenobjekte.clear();
    this.spielzugAnimationAktiv = false;
    this.wartendeKartenId = null;
    this.ausgewaehlteArmutKarten.clear();
    this.armutAnnahmeAktiv = false;
    this.letzteSticheOffen = false;
    if (this.panel?.parentElement) {
      this.panel.parentElement.innerHTML = '';
    }
    this.panel = undefined;
    this.ergebnisInhalt = undefined;
    this.letzteSticheListe = undefined;
    this.letzteSticheButton = undefined;
    this.toastStack = undefined;
  }
}
