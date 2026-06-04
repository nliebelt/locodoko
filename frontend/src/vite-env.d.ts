/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Sentry-DSN fuer die Fehlererfassung. Leer/undefiniert => Sentry deaktiviert. */
  readonly VITE_SENTRY_DSN?: string;
  /** Sentry-Umgebung (z.B. "produktion", "beta", "lokal"). */
  readonly VITE_SENTRY_ENVIRONMENT?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
