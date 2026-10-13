/** Minimal key/value store so persistence can be swapped for an in-memory one in tests. */
export interface KeyValueStore {
  get(key: string): string | null;
  set(key: string, value: string): void;
}

/** localStorage, but never throws (private mode, blocked site data, SSR). */
export const localStore = (): KeyValueStore => webStore(() => window.localStorage);

/** sessionStorage, but never throws: same reasons as localStore(). Per tab, e.g. the music position. */
export const sessionStore = (): KeyValueStore => webStore(() => window.sessionStorage);

/** Even reading `window.localStorage` can throw when site data is blocked, hence the getter. */
function webStore(storage: () => Storage): KeyValueStore {
  return {
    get(key) {
      try {
        return storage().getItem(key);
      } catch {
        return null;
      }
    },
    set(key, value) {
      try {
        storage().setItem(key, value);
      } catch {
        // Persistence is a nicety; the game keeps working without it.
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
