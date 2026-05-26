import Phaser from 'phaser';
import { TEXTUR_FILZ, registriereBasisTexturen, ladeHintergrundbilder } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';
import type { TischListenEintragAntwort, TischPresetAntwort } from '../modelle/SpielverwaltungDto';
import { PhaserButton } from './PhaserButton';
import { PhaserModal } from '../ui/PhaserModal';
import { PhaserList } from '../ui/PhaserList';
import { SpielerProfilModal } from '../ui/SpielerProfilModal';
import { FONT_FAMILY, TEXT_HELL_CSS, FARBE_GOLD_WARM_CSS } from '../ui/designTokens';
import { Logger } from '../logger';

export class SpielverwaltungsSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;
  private uiContainer?: Phaser.GameObjects.Container;
  private offeneTischeListe?: PhaserList;
  private presets: TischPresetAntwort[] = [];
  private currentPresetIndex = 0;
  private isPrivat = false;
  private fokussierbareButtons: PhaserButton[] = [];
  private fokusIndex = -1;

  constructor() {
    super('SpielverwaltungsSzene');
  }

  preload(): void {
    ladeHintergrundbilder(this);
  }

  create(): void {
    registriereBasisTexturen(this);

    this.add.tileSprite(640, 360, 1280, 720, TEXTUR_FILZ).setAlpha(0.95);

    this.add.text(640, 80, 'LOCO DOKO', {
      fontFamily: FONT_FAMILY,
      fontSize: '60px',
      color: '#f8f9fa'
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    this.add.text(640, 140, 'Dullen. Füchse. Wahnsinn.', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: '#a3c4a8'
    }).setOrigin(0.5);

    this.uiContainer = this.add.container(0, 0);

    // Load presets ahead of time for the modal
    appStore.ladePresets().then(p => {
      this.presets = p;
    }).catch((e) => Logger.error('Preset-Laden fehlgeschlagen', e));

    this.abmeldenStore?.();
    this.abmeldenStore = appStore.abonniere((zustand) => {
      this.renderUi(zustand);
      if (zustand.bereich === 'TISCH' && zustand.aktuellerTisch) {
        this.abmeldenStore?.();
        this.scene.start('TischSzene');
      } else if (zustand.bereich === 'LOGIN') {
        this.abmeldenStore?.();
        this.scene.start('LoginSzene');
      }
    });

    this.events.once('shutdown', this.shutdown, this);
    this.registriereKeyboard();

    const pendingCode = sessionStorage.getItem('pendingJoinCode');
    if (pendingCode) {
      sessionStorage.removeItem('pendingJoinCode');
      void appStore.betreteTischViaCode(pendingCode).catch((e) => {
        Logger.error('Automatischer Beitritt fehlgeschlagen', e);
        this.renderUi(appStore.snapshot());
      });
      return;
    }

    this.renderUi(appStore.snapshot());
  }

  private renderUi(zustand: AppZustand): void {
    this.uiContainer?.removeAll(true);
    if (!this.uiContainer) return;

    this.fokusIndex = -1;
    this.fokussierbareButtons = [];

    let startY = 220;

    const aktiverTischId = zustand.spieler?.aktiverTischId;
    let sessionRecoveryBtn: PhaserButton | undefined;
    if (aktiverTischId) {
      sessionRecoveryBtn = new PhaserButton(this, {
        x: 640, y: startY, text: 'Zurück zum Spiel', typ: 'primary',
        callback: () => void appStore.reconnecteTisch(aktiverTischId)
      });
      sessionRecoveryBtn.setName('btn-session-recovery');
      this.uiContainer.add(sessionRecoveryBtn);
      startY += 60;
    }

    const quickGameBtn = new PhaserButton(this, {
      x: 640, y: startY, text: '▶  Quick Game', typ: 'primary',
      callback: () => void appStore.erstelleQuickGame()
    });
    quickGameBtn.setName('btn-quick-game');
    this.uiContainer.add(quickGameBtn);
    startY += 60;

    const erstelleTischBtn = new PhaserButton(this, {
      x: 640, y: startY, text: '+ Neuen Tisch', typ: 'secondary',
      callback: () => this.zeigeErstelleTischModal(zustand)
    });
    erstelleTischBtn.setName('btn-neuer-tisch');
    this.uiContainer.add(erstelleTischBtn);
    startY += 60;

    const profilBtn = new PhaserButton(this, {
      x: 640, y: startY, text: '👤 Mein Profil', typ: 'secondary',
      callback: () => {
        const spielerId = zustand.spieler?.spielerId;
        if (spielerId) {
          appStore.ladeSpielerProfil(spielerId)
            .then(profil => SpielerProfilModal.oeffnenMitDaten(profil))
            .catch(fehler => Logger.error('Profil laden fehlgeschlagen', fehler));
        }
      }
    });
    profilBtn.setName('btn-mein-profil');
    this.uiContainer.add(profilBtn);
    startY += 60;

    const logoutBtn = new PhaserButton(this, {
      x: 640, y: startY, text: '🚪  Abmelden', typ: 'secondary',
      callback: () => {
        void appStore.ausloggen().then(() => this.scene.start('LoginSzene'));
      }
    });
    logoutBtn.setName('btn-logout');
    this.uiContainer.add(logoutBtn);

    // Tab-Reihenfolge: Quick Game → Neuen Tisch → Mein Profil → (Session-Recovery falls sichtbar)
    this.fokussierbareButtons = [quickGameBtn, erstelleTischBtn, profilBtn];
    if (sessionRecoveryBtn) {
      this.fokussierbareButtons.push(sessionRecoveryBtn);
    }

    // List of tables
    this.renderTischListe(zustand.tische, aktiverTischId);
  }

  private registriereKeyboard(): void {
    this.input.keyboard?.on('keydown-TAB', (event: KeyboardEvent) => {
      event.preventDefault();
      if (this.fokussierbareButtons.length === 0) return;
      if (this.fokusIndex >= 0 && this.fokusIndex < this.fokussierbareButtons.length) {
        this.fokussierbareButtons[this.fokusIndex].setFocus(false);
      }
      this.fokusIndex = (this.fokusIndex + 1) % this.fokussierbareButtons.length;
      this.fokussierbareButtons[this.fokusIndex].setFocus(true);
    });

    this.input.keyboard?.on('keydown-ENTER', () => {
      if (this.fokusIndex >= 0 && this.fokusIndex < this.fokussierbareButtons.length) {
        this.fokussierbareButtons[this.fokusIndex].trigger();
      }
    });
  }

  private renderTischListe(tische: TischListenEintragAntwort[], aktiverTischId: string | null | undefined): void {
    if (this.offeneTischeListe) {
      this.offeneTischeListe.destroy();
    }

    const wartendeTische = tische.filter(t => t.status === 'WARTEND');
    const eigeneLaufendeTische = tische.filter(t => t.status === 'IM_SPIEL' && aktiverTischId === t.id);

    this.add.text(640, 500, 'Offene Tische', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: FARBE_GOLD_WARM_CSS
    }).setOrigin(0.5);

    if (wartendeTische.length === 0 && eigeneLaufendeTische.length === 0) {
      const msg = this.add.text(640, 560, 'Keine offenen Tische. Starte ein Quick Game!', {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: TEXT_HELL_CSS
      }).setOrigin(0.5);
      this.uiContainer?.add(msg);
      return;
    }

    this.offeneTischeListe = new PhaserList(this, 640, 620, {
      breite: 600,
      hoehe: 180,
      elementHoehe: 60,
      items: [...eigeneLaufendeTische, ...wartendeTische],
      renderElement: (item: unknown, c: Phaser.GameObjects.Container) => this.renderTischEintrag(item as TischListenEintragAntwort, c, aktiverTischId)
    });
  }

  private renderTischEintrag(tisch: TischListenEintragAntwort, c: Phaser.GameObjects.Container, aktiverTischId: string | null | undefined): void {
    const hervorgehoben = tisch.id === aktiverTischId;
    const buttonText = hervorgehoben ? 'Fortsetzen' : 'Beitreten';
    
    const bg = this.add.rectangle(0, 0, 580, 50, 0x000000, 0.4).setOrigin(0.5);
    c.add(bg);

    const nameTxt = this.add.text(-270, 0, tisch.name, {
      fontFamily: FONT_FAMILY, fontSize: '18px', color: hervorgehoben ? FARBE_GOLD_WARM_CSS : TEXT_HELL_CSS
    }).setOrigin(0, 0.5);
    c.add(nameTxt);

    const spielerTxt = this.add.text(30, 0, hervorgehoben ? 'Laufend' : `${tisch.spielerAnzahl}/4`, {
      fontFamily: FONT_FAMILY, fontSize: '16px', color: TEXT_HELL_CSS
    }).setOrigin(0, 0.5);
    c.add(spielerTxt);

    const btn = new PhaserButton(this, {
      x: 200, y: 0, text: buttonText, typ: hervorgehoben ? 'secondary' : 'primary', breite: 150, hoehe: 36,
      callback: () => {
        if (hervorgehoben) {
          void appStore.reconnecteTisch(tisch.id);
        } else {
          void appStore.betreteTisch(tisch.id);
        }
      }
    });
    c.add(btn);
  }

  private zeigeErstelleTischModal(zustand: AppZustand): void {
    const closeCallback = () => {
      modal.destroy();
    };

    let currentPreset = this.presets[this.currentPresetIndex] || null;

    const doCreate = () => {
      const name = 'Tisch ' + (zustand.spieler?.name || 'Gast');
      if (currentPreset?.name) {
        void appStore.erstelleTischMitPreset(name, currentPreset.name, this.isPrivat).then(() => closeCallback());
      } else {
        void appStore.erstelleTisch(name).then(() => closeCallback());
      }
    };

    const modal = new PhaserModal(this, 640, 360, {
      titel: 'Neuen Tisch erstellen',
      breite: 500,
      hoehe: 300,
      zeigeSchliessenButton: true,
      onClose: closeCallback,
      aktionen: [
        { text: 'Abbrechen', callback: closeCallback, typ: 'secondary', testId: 'btn-abbrechen' },
        { text: 'Erstellen', callback: doCreate, typ: 'primary', testId: 'btn-erstellen' }
      ]
    });

    const cc = modal.getContentContainer();

    // Preset cycler
    const presetLabel = this.add.text(0, -60, 'Regel-Preset:', { fontFamily: FONT_FAMILY, fontSize: '16px', color: TEXT_HELL_CSS }).setOrigin(0.5);
    cc.add(presetLabel);

    const presetValue = this.add.text(0, -30, currentPreset?.label || 'Lädt...', { fontFamily: FONT_FAMILY, fontSize: '20px', color: '#fff' }).setOrigin(0.5);
    cc.add(presetValue);

    const prevBtn = new PhaserButton(this, {
      x: -200, y: -30, text: '<', breite: 40, callback: () => {
        if (this.presets.length === 0) return;
        this.currentPresetIndex = (this.currentPresetIndex - 1 + this.presets.length) % this.presets.length;
        currentPreset = this.presets[this.currentPresetIndex];
        presetValue.setText(currentPreset?.label || '');
      }
    });
    cc.add(prevBtn);

    const nextBtn = new PhaserButton(this, {
      x: 200, y: -30, text: '>', breite: 40, callback: () => {
        if (this.presets.length === 0) return;
        this.currentPresetIndex = (this.currentPresetIndex + 1) % this.presets.length;
        currentPreset = this.presets[this.currentPresetIndex];
        presetValue.setText(currentPreset?.label || '');
      }
    });
    cc.add(nextBtn);

    // Private toggle
    const privatValue = this.add.text(0, 40, `Privat: ${this.isPrivat ? 'JA' : 'NEIN'}`, { fontFamily: FONT_FAMILY, fontSize: '18px', color: '#fff' }).setOrigin(0.5);
    cc.add(privatValue);

    const togglePrivatBtn = new PhaserButton(this, {
      x: 0, y: 80, text: 'Privat Umschalten', typ: 'secondary', breite: 250, callback: () => {
        this.isPrivat = !this.isPrivat;
        privatValue.setText(`Privat: ${this.isPrivat ? 'JA' : 'NEIN'}`);
      }
    });
    cc.add(togglePrivatBtn);

    this.uiContainer?.add(modal);
  }

  shutdown(): void {
    this.abmeldenStore?.();
    this.input.keyboard?.off('keydown-TAB');
    this.input.keyboard?.off('keydown-ENTER');
    this.uiContainer?.removeAll(true);
    this.offeneTischeListe?.destroy();
  }
}
