/** Minimal key/value store so persistence can be swapped for an in-memory one in tests. */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** localStorage, but never throws (private mode, blocked site data, SSR). */
export function localStore(): KeyValueStore {
  return {
    get(key) {
      try {
        return window.localStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.localStorage.setItem(key, value);
      } catch {
        // Persistence is a nicety; the game keeps working without it.
      }
    },
  };
}

/** Per-tab persistence for music position across lobby/game navigation. */
export function sessionStore(): KeyValueStore {
  return {
    get(key) {
      try {
        return window.sessionStorage.getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        window.sessionStorage.setItem(key, value);
      } catch {
        // Music still plays when browser storage is blocked.
      }
    },
  };
}

export function memoryStore(initial: Record<string, string> = {}): KeyValueStore {
  const data = new Map(Object.entries(initial));
  return {
    get: (key) => data.get(key) ?? null,
    set: (key, value) => void data.set(key, value),
  };
}
