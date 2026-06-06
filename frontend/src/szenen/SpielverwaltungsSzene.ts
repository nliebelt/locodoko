import Phaser from 'phaser';
import { TEXTUR_FILZ, registriereBasisTexturen, ladeHintergrundbilder } from '../assets/AssetLoader';
import { appStore } from '../anwendung';
import type { AppZustand } from '../store/AppStore';
import type { TischListenEintragAntwort, TischPresetAntwort } from '../modelle/SpielverwaltungDto';
import { PhaserButton } from './PhaserButton';
import { zeigeTischErstellenDialog } from './tischErstellenDialog';
import { PhaserList } from '../ui/PhaserList';
import { SpielerProfilModal } from '../ui/SpielerProfilModal';
import { FONT_FAMILY, TEXT_HELL_CSS, FARBE_GOLD_WARM_CSS } from '../ui/designTokens';
import { Logger } from '../logger';
import { zeigeBugreportDialog } from './bugreportDialog';

export class SpielverwaltungsSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;
  private uiContainer?: Phaser.GameObjects.Container;
  private offeneTischeListe?: PhaserList;
  private presets: TischPresetAntwort[] = [];
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

    this.add.tileSprite(this.scale.width / 2, this.scale.height / 2, this.scale.width, this.scale.height, TEXTUR_FILZ).setAlpha(0.95);

    this.add.text(this.scale.width / 2, 80, 'LOCO DOKO', {
      fontFamily: FONT_FAMILY,
      fontSize: '60px',
      color: '#f8f9fa'
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    this.add.text(this.scale.width / 2, 140, 'Dullen. Füchse. Wahnsinn.', {
      fontFamily: FONT_FAMILY,
      fontSize: '20px',
      color: '#a3c4a8'
    }).setOrigin(0.5);

    // Oben-rechts: Spielregeln + Rangliste. Beide Buttons skalieren ihre Breite
    // automatisch an den Text (PhaserButton.breite), daher rechtsbuendig anhand der
    // tatsaechlichen Renderbreite layouten — sonst ueberlappen sie (BUG-LOBBY-TOPRIGHT-CLIPPING-2).
    const randAbstand = 22;
    const buttonLuecke = 16;
    const spielregelnBtn = new PhaserButton(this, {
      x: 0, y: 45, text: '? Spielregeln', typ: 'secondary', breite: 190, hoehe: 40,
      testId: 'btn-spielregeln',
      callback: () => this.scene.start('HilfeSzene', { herkunft: 'SpielverwaltungsSzene' }),
    });
    const ranglisteBtn = new PhaserButton(this, {
      x: 0, y: 45, text: '🏆 Rangliste', typ: 'secondary', breite: 200, hoehe: 40,
      testId: 'btn-rangliste',
      callback: () => this.scene.start('BestenlisterSzene')
    });
    const ranglisteX = this.scale.width - randAbstand - ranglisteBtn.breite / 2;
    ranglisteBtn.setX(ranglisteX);
    spielregelnBtn.setX(ranglisteX - ranglisteBtn.breite / 2 - buttonLuecke - spielregelnBtn.breite / 2);

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
    const gespeicherterFokusIndex = this.fokusIndex;
    this.uiContainer?.removeAll(true);
    if (!this.uiContainer) return;

    this.fokussierbareButtons = [];

    let startY = 220;

    const aktiverTischId = zustand.spieler?.aktiverTischId;
    let sessionRecoveryBtn: PhaserButton | undefined;
    if (aktiverTischId) {
      sessionRecoveryBtn = new PhaserButton(this, {
        x: this.scale.width / 2, y: startY, text: 'Zurück zum Spiel', typ: 'primary',
        callback: () => void appStore.reconnecteTisch(aktiverTischId)
      });
      sessionRecoveryBtn.setName('btn-session-recovery');
      this.uiContainer.add(sessionRecoveryBtn);
      startY += 60;
    }

    const quickGameBtn = new PhaserButton(this, {
      x: this.scale.width / 2, y: startY, text: '▶  Schnellstart', typ: 'primary',
      callback: () => void appStore.erstelleQuickGame()
    });
    quickGameBtn.setName('btn-quick-game');
    this.uiContainer.add(quickGameBtn);
    startY += 60;

    const erstelleTischBtn = new PhaserButton(this, {
      x: this.scale.width / 2, y: startY, text: '+ Neuen Tisch', typ: 'secondary',
      callback: () => zeigeTischErstellenDialog(zustand, this.presets)
    });
    erstelleTischBtn.setName('btn-neuer-tisch');
    this.uiContainer.add(erstelleTischBtn);
    startY += 60;

    const profilBtn = new PhaserButton(this, {
      x: this.scale.width / 2, y: startY, text: 'Mein Profil', typ: 'secondary',
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
      x: this.scale.width / 2, y: startY, text: 'Abmelden', typ: 'secondary',
      callback: () => {
        void appStore.ausloggen().then(() => this.scene.start('LoginSzene'));
      }
    });
    logoutBtn.setName('btn-logout');
    this.uiContainer.add(logoutBtn);
    startY += 60;

    const feedbackBtn = new PhaserButton(this, {
      x: this.scale.width / 2, y: startY, text: '💬 Feedback', typ: 'secondary',
      callback: () => this.zeigeFeedbackDialog()
    });
    feedbackBtn.setName('btn-feedback');
    this.uiContainer.add(feedbackBtn);
    startY += 60;

    const bugreportBtn = new PhaserButton(this, {
      x: this.scale.width / 2, y: startY, text: 'Bug melden (Shift+F1)', typ: 'secondary',
      callback: () => zeigeBugreportDialog(appStore.snapshot())
    });
    bugreportBtn.setName('btn-bugreport');
    this.uiContainer.add(bugreportBtn);

    // Tab-Reihenfolge: Schnellstart → Neuen Tisch → Mein Profil → (Session-Recovery falls sichtbar)
    this.fokussierbareButtons = [quickGameBtn, erstelleTischBtn, profilBtn];
    if (sessionRecoveryBtn) {
      this.fokussierbareButtons.push(sessionRecoveryBtn);
    }

    // Fokus bei Re-Render erhalten (verhindert Race zwischen WS-Update und Tastatur-Navigation)
    this.fokusIndex = Math.min(gespeicherterFokusIndex, this.fokussierbareButtons.length - 1);
    if (this.fokusIndex >= 0) {
      this.fokussierbareButtons[this.fokusIndex].setFocus(true);
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

    this.add.text(this.scale.width / 2, 570, 'Offene Tische', {
      fontFamily: FONT_FAMILY,
      fontSize: '24px',
      color: FARBE_GOLD_WARM_CSS
    }).setOrigin(0.5);

    if (wartendeTische.length === 0 && eigeneLaufendeTische.length === 0) {
      const msg = this.add.text(this.scale.width / 2, 630, 'Keine offenen Tische. Starte ein Schnellspiel!', {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: TEXT_HELL_CSS
      }).setOrigin(0.5);
      this.uiContainer?.add(msg);
      return;
    }

    this.offeneTischeListe = new PhaserList(this, this.scale.width / 2, 645, {
      breite: 600,
      hoehe: 150,
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
    this.kuerzeText(nameTxt, 240);

    if (!hervorgehoben) {
      const spielerTxt = this.add.text(10, 0, `${tisch.spielerAnzahl}/4`, {
        fontFamily: FONT_FAMILY, fontSize: '16px', color: TEXT_HELL_CSS
      }).setOrigin(0, 0.5);
      c.add(spielerTxt);
    }

    const btn = new PhaserButton(this, {
      x: 175, y: 0, text: buttonText, typ: hervorgehoben ? 'secondary' : 'primary', breite: 215, hoehe: 36,
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

  private zeigeFeedbackDialog(): void {
    const backdrop = document.createElement('div');
    backdrop.className = 'ui-modal-backdrop';
    backdrop.setAttribute('role', 'dialog');
    backdrop.setAttribute('aria-modal', 'true');
    backdrop.setAttribute('aria-labelledby', 'feedback-dialog-titel');

    const modal = document.createElement('div');
    modal.className = 'ui-modal';
    modal.style.cssText = 'max-width:480px;padding:24px;';
    modal.innerHTML = [
      '<h2 id="feedback-dialog-titel" style="margin:0 0 16px;color:#ffd700;font-size:18px;">',
      '&#x1F4AC; Feedback senden</h2>',
      '<textarea id="feedback-text" rows="6"',
      ' style="width:100%;box-sizing:border-box;padding:8px;background:#1a2a1a;color:#f0f0f0;',
      'border:1px solid #4ade80;border-radius:4px;font-size:14px;resize:vertical;"',
      ' placeholder="Dein Feedback f&#xFC;r die Beta..."></textarea>',
      '<p id="feedback-status" style="margin:8px 0;min-height:20px;font-size:13px;color:#4ade80;"></p>',
      '<div style="display:flex;gap:12px;justify-content:flex-end;margin-top:8px;">',
      '<button id="feedback-abbrechen"',
      ' style="padding:8px 16px;background:transparent;color:#a0a0a0;border:1px solid #a0a0a0;',
      'border-radius:4px;cursor:pointer;">Abbrechen</button>',
      '<button id="feedback-senden"',
      ' style="padding:8px 16px;background:#4ade80;color:#0a1a0a;border:none;',
      'border-radius:4px;cursor:pointer;font-weight:bold;">Senden</button>',
      '</div>'
    ].join('');
    backdrop.appendChild(modal);

    const uiRoot = document.getElementById('ui-root');
    if (!uiRoot) return;
    uiRoot.appendChild(backdrop);

    const textarea = modal.querySelector('#feedback-text') as HTMLTextAreaElement;
    const statusEl = modal.querySelector('#feedback-status') as HTMLParagraphElement;
    const sendenBtn = modal.querySelector('#feedback-senden') as HTMLButtonElement;
    const abbrechenBtn = modal.querySelector('#feedback-abbrechen') as HTMLButtonElement;

    const schliessen = () => backdrop.remove();
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) schliessen(); });
    abbrechenBtn.addEventListener('click', schliessen);

    sendenBtn.addEventListener('click', () => {
      const text = textarea.value.trim();
      if (!text) {
        statusEl.style.color = '#ff4455';
        statusEl.textContent = 'Bitte gib einen Text ein.';
        return;
      }
      sendenBtn.disabled = true;
      statusEl.style.color = '#4ade80';
      statusEl.textContent = 'Wird gesendet…';
      appStore.gibFeedback(text)
        .then(() => {
          statusEl.textContent = 'Danke für dein Feedback!';
          setTimeout(schliessen, 1500);
        })
        .catch(() => {
          statusEl.style.color = '#ff4455';
          statusEl.textContent = 'Senden fehlgeschlagen. Bitte nochmal versuchen.';
          sendenBtn.disabled = false;
        });
    });

    textarea.focus();
  }

  private kuerzeText(txt: Phaser.GameObjects.Text, maxBreite: number): void {
    if (txt.width <= maxBreite) return;
    let s = txt.text;
    while (s.length > 1 && txt.width > maxBreite) {
      s = s.slice(0, -1);
      txt.setText(s + '…');
    }
  }

  shutdown(): void {
    this.abmeldenStore?.();
    this.input.keyboard?.off('keydown-TAB');
    this.input.keyboard?.off('keydown-ENTER');
    this.uiContainer?.removeAll(true);
    this.offeneTischeListe?.destroy();
  }
}
