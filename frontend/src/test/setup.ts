/**
 * Vitest-Setup: localStorage-Polyfill fuer Node 26 + jsdom.
 *
 * Node 26 fuehrt experimentelles localStorage ein (globalThis.localStorage),
 * das ohne --localstorage-file undefined ist. jsdom 29.x ueberschreibt es nicht,
 * sodass Tests mit localStorage.clear()/setItem() fehlschlagen.
 *
 * Dieses Setup stellt einen einfachen In-Memory-Storage bereit, wenn
 * globalThis.localStorage undefined ist.
 */

if (typeof globalThis.localStorage === 'undefined') {
  const speicher = new Map<string, string>();
  const storage: Storage = {
    getItem: (schluessel: string) => speicher.get(schluessel) ?? null,
    setItem: (schluessel: string, wert: string) => { speicher.set(schluessel, String(wert)); },
    removeItem: (schluessel: string) => { speicher.delete(schluessel); },
    clear: () => { speicher.clear(); },
    key: (index: number) => [...speicher.keys()][index] ?? null,
    get length() { return speicher.size; },
  };
  Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true, configurable: true });
}
