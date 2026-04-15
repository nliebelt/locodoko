import Phaser from 'phaser';
import { TEXTUR_FILZ } from '../assets/AssetLoader';
import { appStore } from '../anwendung';

function holeUiRoot(): HTMLElement {
  const wurzel = document.getElementById('ui-root');
  if (!wurzel) {
    throw new Error('Die UI-Wurzel #ui-root wurde nicht gefunden.');
  }
  return wurzel;
}

/**
 * Login/Register-Screen — wird vor der SpielverwaltungsSzene angezeigt.
 * Bietet Passwort-Login, Registrierung, Google-OAuth2 und Gast-Modus.
 */
export class LoginSzene extends Phaser.Scene {
  private abmeldenStore?: () => void;

  constructor() {
    super('LoginSzene');
  }

  create(): void {
    this.add.tileSprite(640, 360, 1280, 720, TEXTUR_FILZ).setAlpha(0.95);

    this.add.text(640, 100, 'LOCO DOKO', {
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '80px',
      color: '#f8f9fa'
    }).setOrigin(0.5).setShadow(3, 3, '#000', 0);

    this.add.text(640, 170, 'Dullen. Füchse. Wahnsinn.', {
      fontFamily: '"Space Grotesk", sans-serif',
      fontSize: '24px',
      color: '#a3c4a8'
    }).setOrigin(0.5);

    this.baueUi();

    this.abmeldenStore = appStore.abonnieren((zustand) => {
      if (zustand.bereich === 'SPIELVERWALTUNG' && zustand.authentifiziert) {
        this.scene.start('SpielverwaltungsSzene');
      }
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

    const container = document.createElement('div');
    container.className = 'login-container';
    container.dataset['testid'] = 'login-screen';
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.alignItems = 'center';
    container.style.gap = '16px';
    container.style.marginTop = '220px';
    container.style.maxWidth = '400px';
    container.style.margin = '220px auto 0';

    // Login-Formular
    const loginBox = document.createElement('div');
    loginBox.className = 'neo-card';
    loginBox.style.cssText = 'width:100%;padding:24px;background:rgba(0,0,0,0.4);border-radius:12px;';
    loginBox.innerHTML = `
      <h3 style="color:#f8f9fa;margin:0 0 16px;text-align:center;font-size:20px;">Anmelden</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <input type="text" id="login-benutzername" class="neo-input" placeholder="Benutzername"
               data-testid="input-login-benutzername" autocomplete="username"
               style="padding:10px;border-radius:8px;border:1px solid #555;background:#1a1a2e;color:#f8f9fa;">
        <input type="password" id="login-passwort" class="neo-input" placeholder="Passwort"
               data-testid="input-login-passwort" autocomplete="current-password"
               style="padding:10px;border-radius:8px;border:1px solid #555;background:#1a1a2e;color:#f8f9fa;">
        <button id="btn-login" class="neo-button neo-button--primary" data-testid="btn-login"
                style="padding:12px;border-radius:8px;cursor:pointer;">Einloggen</button>
        <div id="login-fehler" style="color:#ff6b6b;font-size:14px;text-align:center;display:none;"
             data-testid="login-fehler"></div>
      </div>
    `;
    container.appendChild(loginBox);

    // Registrierung-Toggle
    const registerToggle = document.createElement('button');
    registerToggle.className = 'neo-button neo-button--secondary';
    registerToggle.textContent = 'Noch kein Konto? Registrieren';
    registerToggle.dataset['testid'] = 'btn-register-toggle';
    registerToggle.style.cssText = 'padding:10px 20px;border-radius:8px;cursor:pointer;width:100%;';
    container.appendChild(registerToggle);

    // Registrierungs-Formular (initial versteckt)
    const registerBox = document.createElement('div');
    registerBox.className = 'neo-card';
    registerBox.style.cssText = 'width:100%;padding:24px;background:rgba(0,0,0,0.4);border-radius:12px;display:none;';
    registerBox.innerHTML = `
      <h3 style="color:#f8f9fa;margin:0 0 16px;text-align:center;font-size:20px;">Registrieren</h3>
      <div style="display:flex;flex-direction:column;gap:12px;">
        <input type="text" id="register-benutzername" class="neo-input" placeholder="Benutzername (3–20 Zeichen)"
               data-testid="input-register-benutzername" autocomplete="username"
               style="padding:10px;border-radius:8px;border:1px solid #555;background:#1a1a2e;color:#f8f9fa;">
        <input type="password" id="register-passwort" class="neo-input" placeholder="Passwort (min. 8 Zeichen)"
               data-testid="input-register-passwort" autocomplete="new-password"
               style="padding:10px;border-radius:8px;border:1px solid #555;background:#1a1a2e;color:#f8f9fa;">
        <input type="email" id="register-email" class="neo-input" placeholder="E-Mail (optional)"
               data-testid="input-register-email" autocomplete="email"
               style="padding:10px;border-radius:8px;border:1px solid #555;background:#1a1a2e;color:#f8f9fa;">
        <button id="btn-register" class="neo-button neo-button--primary" data-testid="btn-register"
                style="padding:12px;border-radius:8px;cursor:pointer;">Konto erstellen</button>
        <div id="register-fehler" style="color:#ff6b6b;font-size:14px;text-align:center;display:none;"
             data-testid="register-fehler"></div>
      </div>
    `;
    container.appendChild(registerBox);

    // Trennlinie
    const trennlinie = document.createElement('div');
    trennlinie.style.cssText = 'width:100%;text-align:center;color:#888;font-size:14px;margin:4px 0;';
    trennlinie.textContent = '— oder —';
    container.appendChild(trennlinie);

    // Google OAuth2 Button
    const googleBtn = document.createElement('button');
    googleBtn.className = 'neo-button neo-button--secondary';
    googleBtn.textContent = '🔑  Mit Google anmelden';
    googleBtn.dataset['testid'] = 'btn-google-login';
    googleBtn.style.cssText = 'padding:12px 20px;border-radius:8px;cursor:pointer;width:100%;';
    googleBtn.addEventListener('click', () => {
      window.location.href = '/oauth2/authorization/google';
    });
    container.appendChild(googleBtn);

    // Gast-Button
    const gastBtn = document.createElement('button');
    gastBtn.className = 'neo-button neo-button--secondary';
    gastBtn.textContent = '👤  Als Gast spielen';
    gastBtn.dataset['testid'] = 'btn-gast';
    gastBtn.style.cssText = 'padding:12px 20px;border-radius:8px;cursor:pointer;width:100%;opacity:0.8;';
    gastBtn.addEventListener('click', () => {
      void appStore.alsGastStarten();
    });
    container.appendChild(gastBtn);

    uiRoot.appendChild(container);

    // Event-Handler
    registerToggle.addEventListener('click', () => {
      const isVisible = registerBox.style.display !== 'none';
      registerBox.style.display = isVisible ? 'none' : 'block';
      loginBox.style.display = isVisible ? 'block' : 'none';
      registerToggle.textContent = isVisible
        ? 'Noch kein Konto? Registrieren'
        : 'Bereits ein Konto? Einloggen';
    });

    loginBox.querySelector('#btn-login')?.addEventListener('click', () => {
      void this.loginAusfuehren();
    });

    loginBox.querySelector('#login-passwort')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        void this.loginAusfuehren();
      }
    });

    registerBox.querySelector('#btn-register')?.addEventListener('click', () => {
      void this.registrierungAusfuehren();
    });

    registerBox.querySelector('#register-email')?.addEventListener('keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Enter') {
        void this.registrierungAusfuehren();
      }
    });

    setTimeout(() => (loginBox.querySelector('#login-benutzername') as HTMLInputElement)?.focus(), 50);
  }

  private async loginAusfuehren(): Promise<void> {
    const benutzername = (document.getElementById('login-benutzername') as HTMLInputElement)?.value?.trim();
    const passwort = (document.getElementById('login-passwort') as HTMLInputElement)?.value;
    const fehlerEl = document.getElementById('login-fehler');

    if (!benutzername || !passwort) {
      this.zeigeFehler(fehlerEl, 'Bitte Benutzername und Passwort eingeben.');
      return;
    }

    try {
      await appStore.einloggen(benutzername, passwort);
    } catch (error) {
      const nachricht = (error instanceof Error && error.message.includes('401'))
        ? 'Ungültige Anmeldedaten.'
        : 'Login fehlgeschlagen. Bitte erneut versuchen.';
      this.zeigeFehler(fehlerEl, nachricht);
    }
  }

  private async registrierungAusfuehren(): Promise<void> {
    const benutzername = (document.getElementById('register-benutzername') as HTMLInputElement)?.value?.trim();
    const passwort = (document.getElementById('register-passwort') as HTMLInputElement)?.value;
    const email = (document.getElementById('register-email') as HTMLInputElement)?.value?.trim() || undefined;
    const fehlerEl = document.getElementById('register-fehler');

    if (!benutzername || benutzername.length < 3 || benutzername.length > 20) {
      this.zeigeFehler(fehlerEl, 'Benutzername muss 3–20 Zeichen lang sein.');
      return;
    }
    if (!passwort || passwort.length < 8) {
      this.zeigeFehler(fehlerEl, 'Passwort muss mindestens 8 Zeichen lang sein.');
      return;
    }

    try {
      await appStore.registrieren(benutzername, passwort, email);
    } catch (error) {
      const nachricht = (error instanceof Error && error.message.includes('409'))
        ? 'Benutzername bereits vergeben.'
        : 'Registrierung fehlgeschlagen. Bitte erneut versuchen.';
      this.zeigeFehler(fehlerEl, nachricht);
    }
  }

  private zeigeFehler(element: HTMLElement | null, text: string): void {
    if (element) {
      element.textContent = text;
      element.style.display = 'block';
    }
  }

  private aufraeumen(): void {
    this.abmeldenStore?.();
    this.abmeldenStore = undefined;
    const uiRoot = holeUiRoot();
    uiRoot.innerHTML = '';
  }
}
