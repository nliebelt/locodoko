import type { TischSzene } from './TischSzene';
import { SPIELER_POSITION, PARTEI, type TischAnsichtModell, type SpielerPosition } from '../modelle/TischAnsichtModell';
import type { Ansage, KarteAntwort, AbgeschlossenerStichAntwort, PartieStandAntwort } from '../modelle/SpielverwaltungDto';
import type { AppZustand } from '../store/AppStore';
import { appStore } from '../anwendung';
import { berechneLayout, stichSlotPositionen, berechneKartenGroesse, berechneKartenAbstand, stichStapelPositionFuer, nameplatePositionFuer } from './layout';
import { formatiereAnsage } from './tischFormatierer';
import { Logger } from '../logger';
import type { AnimierbareKartenobjekte } from '../services/AnimationenService';

export class TischAnimationOrchestrator {
  constructor(private szene: TischSzene) {}

  public async animiereGegnerKarte(pos: SpielerPosition, dauer = 400): Promise<void> {
    const { width: b, height: h } = this.szene.scale.gameSize;
    const layout = berechneLayout(b, h) ;
    const slotPos = stichSlotPositionen(b / 2, h / 2, b, h) ;
    const kg = berechneKartenGroesse(b);
    const tempK = this.szene.kartenRenderer.erstelleKartenansicht(layout[pos].kartenX, layout[pos].kartenY, kg.w, kg.h, { verdeckt: true });
    tempK.setDepth(10); 
    try {
      await this.szene.animationen?.animiereKarteAusspielen({ wurzel: tempK }, slotPos[pos], dauer);
    } finally {
      tempK.destroy(true);
      if (this.szene.wartendeKartenId) {
        this.szene.wartendeKartenId = null;
      }
      this.szene.triggerRender(true);
    }
  }

  public async animiereStichEinziehen(stich: AbgeschlossenerStichAntwort, partieStandAusEvent: PartieStandAntwort): Promise<void> {
    const { width: b, height: h } = this.szene.scale.gameSize;
    const slotPos = stichSlotPositionen(b / 2, h / 2, b, h) ;
    const kg = berechneKartenGroesse(b);
    
    const aModell = this.szene.erstelleModell({ ...appStore.snapshot(), partieStand: partieStandAusEvent });
    const mStich = aModell.letzteAbgeschlosseneStiche.find((s) => s.spielNummer === stich.spielNummer && s.stichNummer === stich.stichNummer);
    if (!mStich) {
      Logger.error('Konnte relativen Stich im Modell nicht finden!');
      return;
    }
    
    const gSp = aModell.spieler.find((s) => s.position === mStich.gewinnerPosition);
    const gKAnz = gSp ? (gSp.sichtbareHandkarten.length > 0 ? gSp.sichtbareHandkarten.length : Math.max(gSp.verbleibendeKarten, 0)) : 0;
    const ziel = stichStapelPositionFuer(mStich.gewinnerPosition, b, h, gKAnz);
    
    Logger.szene('Starte animiereStichEinziehen', { 
      zielX: ziel.x, zielY: ziel.y, gewinner: mStich.gewinnerPosition, karten: mStich.gespielteKarten?.length 
    });

    if (!mStich.gespielteKarten || mStich.gespielteKarten.length === 0) {
      Logger.error('Keine Karten im abgeschlossenen Stich gefunden!');
      return;
    }

    const animK = mStich.gespielteKarten.map((k: { position: string, karte: KarteAntwort }) => { 
      const s = slotPos[k.position as SpielerPosition]; 
      if (!s) {
          Logger.error('Keine Slot-Position fuer SpielerPosition gefunden!', { pos: k.position });
          return { wurzel: this.szene.kartenRenderer.erstelleKartenansicht(b/2, h/2, kg.w, kg.h, { karte: k.karte }) };
      }
      const w = this.szene.kartenRenderer.erstelleKartenansicht(s.x, s.y, kg.w, kg.h, { karte: k.karte }); 
      w.setAngle(s.winkel);
      w.setDepth(100); 
      return { wurzel: w, bild: w.bildObjekt }; 
    });
    
    const npPos = nameplatePositionFuer(mStich.gewinnerPosition, b, h);
    const istH = mStich.gewinnerPosition === SPIELER_POSITION.SUED || mStich.gewinnerPosition === SPIELER_POSITION.NORD;
    const flash = this.szene.add.rectangle(npPos.x, npPos.y, istH ? Math.max(120, b * 0.11) : Math.max(80, b * 0.07), istH ? Math.max(54, h * 0.075) : Math.max(80, h * 0.11), 0xffe082, 0.7).setDepth(150).setAlpha(0);
    
    this.szene.stichEinziehenAktiv = true;
    this.szene.triggerRender(true); 
    
    try { 
      await this.szene.animationen?.animiereStichEinziehen(animK , ziel, mStich.augen, flash); 
    } finally { 
      animK.forEach((k: { wurzel: { destroy: () => void } }) => k.wurzel.destroy()); 
      flash.destroy(); 
      this.szene.stichEinziehenAktiv = false;
    }
  }

  public async spieleKarteMitAnimation(id: string): Promise<void> {
    if (this.szene.wartendeKartenId || this.szene.animationen?.animationLaeuft) return;
    const kObj = this.szene.kartenRenderer.handKartenobjekte.get(id);
    if (!kObj) { appStore.spieleKarte(id); return; }
    const { width: b, height: h } = this.szene.scale.gameSize;
    const ziel = stichSlotPositionen(b / 2, h / 2, b, h).SUED;
    this.szene.wartendeKartenId = id;
    
    this.szene.kartenRenderer.persistenteEigeneKarten.delete(id);
    this.szene.tischEbene?.add(kObj.wurzel); 
    
    appStore.spieleKarte(id);
    
    await this.szene.animationen?.reiheEin(async () => {
      await this.szene.animationen?.animiereKarteAusspielen(kObj, ziel);
      kObj.wurzel.destroy(); 
      if (this.szene.wartendeKartenId === id) this.szene.wartendeKartenId = null;
    });
  }

  public async starteAusteilen(modell: TischAnsichtModell, zustand: AppZustand): Promise<void> {
    const { width: b, height: h } = this.szene.scale.gameSize;
    const layout = berechneLayout(b, h) ;
    const kg = berechneKartenGroesse(b);
    const kAb = berechneKartenAbstand(b, h);

    const uhrzeigersinn: SpielerPosition[] = [SPIELER_POSITION.SUED, SPIELER_POSITION.WEST, SPIELER_POSITION.NORD, SPIELER_POSITION.OST];
    const geber = modell.spieler.find((s) => s.istGeber);
    const geberIdx = geber ? uhrzeigersinn.indexOf(geber.position) : 0;
    const dealReihenfolge = [1, 2, 3, 0].map((offset) => {
      const pos = uhrzeigersinn[(geberIdx + offset) % 4];
      return modell.spieler.find((s) => s.position === pos);
    }).filter((s): s is TischAnsichtModell['spieler'][number] => s !== undefined);

    type Paket = { kartenobjekte: AnimierbareKartenobjekte; ziel: { x: number; y: number } };
    const kartenProSpieler = new Map<SpielerPosition, Paket[]>();
    for (const s of dealReihenfolge) {
      const kAnz = s.sichtbareHandkarten.length > 0 ? s.sichtbareHandkarten.length : Math.max(s.verbleibendeKarten, 0);
      const istH = s.position === SPIELER_POSITION.SUED || s.position === SPIELER_POSITION.NORD;
      const stX = istH ? b / 2 - ((kAnz - 1) * kAb.horizontal) / 2 : layout[s.position].kartenX;
      const fMap: Record<SpielerPosition, [number, number]> = { SUED: [-12, 5], NORD: [12, -5], WEST: [78, 5], OST: [102, -5] };
      const [fB, fS] = fMap[s.position];
      const istG = s.position === SPIELER_POSITION.NORD || s.position === SPIELER_POSITION.OST;
      const spielerPakete: Paket[] = [];
      for (let i = 0; i < kAnz; i++) {
        const fI = istG ? kAnz - 1 - i : i;
        const w = fB + fI * fS;
        const k = s.sichtbareHandkarten?.[i];
        const wuz = (s.istSelbst && k) ? this.szene.kartenRenderer.erstelleKartenansicht(b / 2, h / 2, kg.w, kg.h, { karte: k }) : this.szene.kartenRenderer.erstelleKartenansicht(b / 2, h / 2, kg.w, kg.h, { verdeckt: true });
        wuz.setAngle(w);
        wuz.setDepth(10);
        spielerPakete.push({ kartenobjekte: { wurzel: wuz, bild: wuz.bildObjekt  }, ziel: { x: istH ? stX + fI * kAb.horizontal : layout[s.position].kartenX, y: istH ? layout[s.position].kartenY : layout[s.position].kartenY + fI * kAb.vertikal } });
      }
      kartenProSpieler.set(s.position, spielerPakete);
    }

    const pakete: Paket[] = [];
    const perPlayerIndex = new Map<SpielerPosition, number>(dealReihenfolge.map((s) => [s.position, 0]));
    for (const rundeKarten of [3, 4, 3]) {
      for (let k = 0; k < rundeKarten; k++) {
        for (const s of dealReihenfolge) {
          const idx = perPlayerIndex.get(s.position)!;
          const sp = kartenProSpieler.get(s.position)!;
          if (idx < sp.length) { pakete.push(sp[idx]); perPlayerIndex.set(s.position, idx + 1); }
        }
      }
    }

    try { await this.szene.animationen?.animiereKartenAusteilen(pakete); } finally { pakete.forEach((p) => p.kartenobjekte.wurzel.destroy()); this.szene.austeilenAktiv = false; this.szene.renderTisch(this.szene.letzterZustand ?? zustand); }
  }

  public async starteAnsageBannerAnimationen(neue: Ansage[]): Promise<void> {
    const modell = this.szene.letztesModell;
    if (!modell) return;
    for (const a of neue) {
      const { width: b, height: h } = this.szene.scale.gameSize;
      const f = a === PARTEI.RE ? '#ffd166' : a === PARTEI.KONTRA ? '#90caf9' : '#ffffff';
      await this.szene.animationen?.animiereAnsageBanner(formatiereAnsage(a), { x: b / 2, y: h * 0.18 }, undefined, f);
    }
  }

  public async zeigeGewinnerFlash(m: TischAnsichtModell): Promise<void> {
    const e = m.letztesSpielergebnis;
    if (!e) return;
    const { width: b, height: h } = this.szene.scale.gameSize;
    await this.szene.animationen?.animiereGewinnerFlash(`${e.siegerPartei} gewinnt!`, m.spieler.filter((s) => s.partei === e.siegerPartei).map((s) => s.name).join(', '), `+${e.spielwert} Punkte`, e.siegerPartei === PARTEI.RE ? '#ffd166' : '#90caf9', { x: b / 2, y: h / 2 });
  }

  public async zeigeSpielankuendigung(m: string): Promise<void> {
    await this.szene.animationen?.animiereSoloAnkuendigung(m, { x: this.szene.scale.gameSize.width / 2, y: this.szene.scale.gameSize.height / 2 });
  }
}
