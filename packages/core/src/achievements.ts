import { localStore, type KeyValueStore } from './storage';

/** One badge per game, all reachable in a minute or two so visitors actually see the payoff. */
export const ACHIEVEMENTS = [
  { id: 'slot-spin', game: 'slot', title: 'First spin', hint: 'Spin the slot machine' },
  { id: 'wheel-win', game: 'wheel', title: 'Wheel winner', hint: 'Win anything on the wheel' },
  { id: 'scratch-match', game: 'scratch', title: 'Match three', hint: 'Win on a scratch card' },
  { id: 'crash-2x', game: 'crash', title: 'Steady nerves', hint: 'Cash out at 2× or more' },
  { id: 'bonus-open', game: 'bonus', title: 'Treasure hunter', hint: 'Open a bonus chest' },
] as const;

export type AchievementId = (typeof ACHIEVEMENTS)[number]['id'];

type Listener = (unlocked: ReadonlySet<AchievementId>) => void;

const KNOWN = new Set<string>(ACHIEVEMENTS.map((a) => a.id));

/**
 * Badges shared by the hub and every game through localStorage (same origin), so unlocking one
 * in a game lights it up on the Casino Floor.
 */
export class Achievements {
  private readonly unlocked: Set<AchievementId>;
  private readonly listeners = new Set<Listener>();

  constructor(
    private readonly store: KeyValueStore = localStore(),
    private readonly storageKey = 'lab:achievements',
  ) {
    this.unlocked = new Set(this.restore());
  }

  has(id: AchievementId): boolean {
    return this.unlocked.has(id);
  }

  get count(): number {
    return this.unlocked.size;
  }

  get complete(): boolean {
    return this.unlocked.size === ACHIEVEMENTS.length;
  }

  /** Returns true only the first time, so callers can celebrate once. */
  unlock(id: AchievementId): boolean {
    if (this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    this.store.set(this.storageKey, JSON.stringify([...this.unlocked]));
    for (const listener of this.listeners) listener(this.unlocked);
    return true;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private restore(): AchievementId[] {
    try {
      const saved: unknown = JSON.parse(this.store.get(this.storageKey) ?? '[]');
      return Array.isArray(saved)
        ? saved.filter((id): id is AchievementId => typeof id === 'string' && KNOWN.has(id))
        : [];
    } catch {
      return [];
    }
  }
}
