import type { TischSzene } from './TischSzene';
import { SPIELER_POSITION } from '../modelle/TischAnsichtModell';
import type { PartieEreignisAntwort, KarteGespieltEreignis, SchweinchenGemeldetEreignis, HochzeitPartnerGefundenEreignis, AktionAbgelehntEreignis } from '../modelle/SpielverwaltungDto';
import { appStore } from '../anwendung';
import { nameplatePositionFuer } from './layout';
import { Logger } from '../logger';
import { ansageBadgeTyp } from '../ui/Nameplate';

const FEHLERCODE_KLARTEXT: Record<string, string> = {
  KARTE_UNGUELTIG: 'Diese Karte kann jetzt nicht gespielt werden.',
  SPIELZUG_UNGUELTIG: 'Ungültiger Spielzug.',
  VORBEHALT_UNGUELTIG: 'Ungültiger Vorbehalt.',
  ARMUT_ANTWORT_UNGUELTIG: 'Ungültige Armut-Antwort.',
  ANSAGE_UNGUELTIG: 'Ungültige Ansage.',
  SPIELER_NICHT_AM_TISCH: 'Du sitzt nicht an diesem Tisch.',
  PARTIE_NICHT_AKTIV: 'Aktuell läuft keine Partie.',
  SPIEL_NICHT_AKTIV: 'Aktuell ist kein Spiel aktiv.',
  GLEICHZEITIGER_ZUGRIFF: 'Gleichzeitiger Zugriff – bitte versuche es erneut.',
  SPIELZUG_KEIN_AUFSPIELER: 'Du bist nicht der Aufspieler.',
  ANFRAGE_UNGUELTIG: 'Ungültige Anfrage.',
  SPIELER_SESSION_UNGUELTIG: 'Sitzung ungültig – bitte erneut anmelden.',
  RATE_LIMIT_UEBERSCHRITTEN: 'Zu viele Anfragen – bitte warte einen Moment.',
  UNGUELTIGES_PRESET: 'Unbekannte Regelvoreinstellung.',
  EINLADUNGSCODE_UNGUELTIG: 'Ungültiger Einladungscode.',
};

function fehlerCodeKlartext(code: string): string {
  return FEHLERCODE_KLARTEXT[code] ?? `Aktion abgelehnt (${code}).`;
}

export class TischEreignisHandler {
  constructor(private szene: TischSzene) {}

  public async verarbeitePartieEreignis(ereignis: PartieEreignisAntwort): Promise<void> {
    Logger.szene('Verarbeite PartieEreignis', { typ: ereignis.ereignisTyp });

    switch (ereignis.ereignisTyp) {
      case 'SPIEL_GESTARTET':
      case 'SPIEL_BEENDET':
        await this.verarbeiteSpielfluss(ereignis);
        break;

      case 'KARTE_GESPIELT':
      case 'STICH_ABGESCHLOSSEN':
        await this.verarbeiteSpielzug(ereignis);
        break;

      case 'ANSAGE_ERFOLGT':
      case 'SCHWEINCHEN_GEMELDET':
      case 'HOCHZEIT_PARTNER_GEFUNDEN':
        await this.verarbeiteAnsagen(ereignis);
        break;

      case 'SNAPSHOT':
      case 'AKTION_ABGELEHNT':
        await this.verarbeiteSynchronisation(ereignis);
        break;
    }
  }

  private async verarbeiteSpielfluss(ereignis: PartieEreignisAntwort): Promise<void> {
    switch (ereignis.ereignisTyp) {
      case 'SPIEL_GESTARTET': {
        this.szene.rundenEndeController.schliesseRundenEndeModal();
        this.szene.rundenEndeController.schliessePartieEndeModal();
        this.szene.austeilenAktiv = true;
        await this.szene.animationen?.reiheEin(() => this.szene.flashTextManager!.zeigeSpielevent('SpielGestartet'));
        if (ereignis.partieStand.laufendesSpiel?.phase === 'VORBEHALT_ANSAGE') {
          await this.szene.animationen?.reiheEin(() => this.szene.flashTextManager!.zeigeSpielevent('VorbehaltErwartet'));
        }
        const modellG = this.szene.erstelleModell({ ...appStore.snapshot(), partieStand: ereignis.partieStand });
        await this.szene.animationen?.reiheEin(async () => {
          await this.szene.animationOrchestrator.starteAusteilen(modellG, { ...appStore.snapshot(), partieStand: ereignis.partieStand });
          this.szene.austeilenAktiv = false;
        });
        const ankuendigung = modellG.spielankuendigungstext;
        if (ankuendigung) await this.szene.animationen?.reiheEin(() => this.szene.animationOrchestrator.zeigeSpielankuendigung(ankuendigung));
        {
          const bockrundenZaehler = ereignis.partieStand?.laufendesSpiel?.bockrundenZaehler ?? 0;
          if (bockrundenZaehler > 0) {
            const pos = { x: this.szene.scale.gameSize.width / 2, y: this.szene.scale.gameSize.height / 2 };
            await this.szene.animationen?.reiheEin(() => this.szene.animationen!.animiereBockrunde(bockrundenZaehler, pos));
          }
        }
        break;
      }

      case 'SPIEL_BEENDET': {
        const m = this.szene.erstelleModell({ ...appStore.snapshot(), partieStand: ereignis.partieStand });
        const spielNr = m.letztesSpielergebnis?.spielNummer ?? null;
        Logger.szene('Verarbeite SPIEL_BEENDET', { spielNr, bereitsGezeigt: this.szene._letzterGezeigterSpielBeendet });
        if (spielNr !== null && spielNr === this.szene._letzterGezeigterSpielBeendet) break;
        this.szene._letzterGezeigterSpielBeendet = spielNr;

        await this.szene.animationen?.reiheEin(async () => {
          await this.szene.flashTextManager?.zeigeSpielevent('SpielBeendet');
          await this.szene.animationOrchestrator.zeigeGewinnerFlash(m);
        });

        appStore.pausiereQueue();

        if (m.partieBeendet) {
          this.szene.rundenEndeController.zeigePartieEndeModal(m);
        } else {
          void this.szene.rundenEndeController.zeigeRundenEndeModal(m);
        }
        break;
      }
    }
  }

  private async verarbeiteSpielzug(ereignis: PartieEreignisAntwort): Promise<void> {
    switch (ereignis.ereignisTyp) {
      case 'KARTE_GESPIELT': {
        const e = ereignis as KarteGespieltEreignis;
        const eventModell = this.szene.erstelleModell({ ...appStore.snapshot(), partieStand: e.partieStand });
        const eigAbsPos = eventModell.spieler.find((s) => s.istSelbst)?.absolutePosition;
        const relPos = eventModell.spieler.find((s) => s.absolutePosition === e.spielerPosition)?.position;
        if (eigAbsPos && e.spielerPosition !== eigAbsPos && relPos) {
           this.szene.wartendeKartenId = e.karteId;
           const verzoegerung = appStore.snapshot().uiKonfiguration.kiVerzoegerungMs || 400;
           await this.szene.animationen?.reiheEin(() => this.szene.animationOrchestrator.animiereGegnerKarte(relPos, verzoegerung));
        }
        break;
      }

      case 'STICH_ABGESCHLOSSEN': {
        const stiche = ereignis.partieStand.letzteAbgeschlosseneStiche;
        const letzterStich = stiche && stiche.length > 0 ? stiche[stiche.length - 1] : null;
        if (letzterStich) {
          const gewinnerName = this.szene.letztesModell?.spieler.find((s) => s.absolutePosition === letzterStich.gewinnerPosition)?.name;
          const laufendesSpiel = ereignis.partieStand.laufendesSpiel;
          await this.szene.animationen?.reiheEin(async () => {
            const { width: b, height: h } = this.szene.scale.gameSize;
            const npPos = nameplatePositionFuer(letzterStich.gewinnerPosition, b, h);
            await this.szene.flashTextManager?.zeigeSpielevent('StichAbgeschlossen', { x: npPos.x, y: npPos.y, punkte: letzterStich.augen });
            await this.szene.animationOrchestrator.animiereStichEinziehen(letzterStich, ereignis.partieStand);
            if (laufendesSpiel && gewinnerName) {
              await this.szene.flashTextManager?.zeigeSpielevent('NaechsterSpielerErwartet', { spielerName: gewinnerName });
            }
          });
        }
        break;
      }
    }
  }

  private async verarbeiteAnsagen(ereignis: PartieEreignisAntwort): Promise<void> {
    switch (ereignis.ereignisTyp) {
      case 'ANSAGE_ERFOLGT': {
        const historie = ereignis.partieStand.laufendesSpiel?.ansageHistorie;
        const letzteAnsage = historie && historie.length > 0 ? historie[historie.length - 1] : null;
        if (letzteAnsage) {
          await this.szene.animationen?.reiheEin(() => this.szene.animationOrchestrator.starteAnsageBannerAnimationen([letzteAnsage.ansage]));
          const relPos = this.szene.letztesModell?.spieler.find((s) => s.absolutePosition === letzteAnsage.spielerPosition)?.position;
          const badgeTyp = ansageBadgeTyp(letzteAnsage.ansage);
          if (relPos && badgeTyp) this.szene.nameplates.get(relPos)?.showAnsage(badgeTyp);
        }
        break;
      }

      case 'SCHWEINCHEN_GEMELDET': {
        const e = ereignis as SchweinchenGemeldetEreignis;
        const gewinnerSpieler = this.szene.letztesModell?.spieler.find((s) => s.absolutePosition === e.spielerPosition);
        const name = gewinnerSpieler?.name ?? 'Spieler';
        const { width: b, height: h } = this.szene.scale.gameSize;
        const pos = nameplatePositionFuer(e.spielerPosition, b, h);
        await this.szene.animationen?.reiheEin(() => this.szene.flashTextManager!.zeigeSpielevent('SchweinchenGemeldet', { spielerName: name, x: pos.x, y: pos.y }));
        break;
      }

      case 'HOCHZEIT_PARTNER_GEFUNDEN': {
        const e = ereignis as HochzeitPartnerGefundenEreignis;
        const partner = this.szene.letztesModell?.spieler.find((s) => s.absolutePosition === e.partnerPosition);
        const solist = this.szene.letztesModell?.spieler.find((s) => s.position === SPIELER_POSITION.SUED);

        if (partner) this.szene.nameplates.get(partner.position)?.setHochzeitPartner(true);
        if (solist) this.szene.nameplates.get(solist.position)?.setHochzeitPartner(true);

        await this.szene.animationen?.reiheEin(() => this.szene.flashTextManager!.zeigeSpielevent('HochzeitPartnerGefunden', { spielerName: partner?.name ?? 'Spieler' }));
        break;
      }
    }
  }

  private async verarbeiteSynchronisation(ereignis: PartieEreignisAntwort): Promise<void> {
    switch (ereignis.ereignisTyp) {
      case 'SNAPSHOT': {
        const ps = ereignis.partieStand;
        if (ps && !ps.laufendesSpiel && ps.letztesSpielergebnis) {
          const spielNr = ps.letztesSpielergebnis.spielNummer;
          if (spielNr !== this.szene._letzterGezeigterSpielBeendet) {
            this.szene._letzterGezeigterSpielBeendet = spielNr;
            this.szene._zeigeOverlayNachSnapshot = { spielNummer: spielNr, partieBeendet: ps.status === 'BEENDET' };
          }
        }
        break;
      }

      case 'AKTION_ABGELEHNT': {
        const e = ereignis as AktionAbgelehntEreignis;
        this.szene.toastManager?.zeige({ text: fehlerCodeKlartext(e.fehlerCode), typ: 'fehler' });
        const loco = window.__locodoko;
        if (loco) loco._letzterFehlerToast = e.fehlerCode;
        break;
      }
    }
  }
}
