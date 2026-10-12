import { describe, expect, it, vi } from 'vitest';
import { Achievements, ACHIEVEMENTS } from './achievements';
import { memoryStore } from './storage';

describe('Achievements', () => {
  it('unlocks once and reports the first time only', () => {
    const achievements = new Achievements(memoryStore());
    expect(achievements.unlock('slot-spin')).toBe(true);
    expect(achievements.unlock('slot-spin')).toBe(false);
    expect(achievements.has('slot-spin')).toBe(true);
    expect(achievements.count).toBe(1);
  });

  it('persists, so a badge earned in a game shows on the hub', () => {
    const store = memoryStore();
    new Achievements(store).unlock('crash-2x');
    expect(new Achievements(store).has('crash-2x')).toBe(true);
  });

  it('is complete once every badge is unlocked', () => {
    const achievements = new Achievements(memoryStore());
    ACHIEVEMENTS.forEach((a) => achievements.unlock(a.id));
    expect(achievements.complete).toBe(true);
  });

  it('ignores corrupted or unknown saved data', () => {
    expect(new Achievements(memoryStore({ 'lab:achievements': 'nope' })).count).toBe(0);
    const mixed = memoryStore({ 'lab:achievements': '["bonus-open","hacked",42]' });
    const achievements = new Achievements(mixed);
    expect(achievements.count).toBe(1);
    expect(achievements.has('bonus-open')).toBe(true);
  });

  it('notifies listeners on new unlocks only', () => {
    const achievements = new Achievements(memoryStore());
    const listener = vi.fn();
    achievements.onChange(listener);
    achievements.unlock('wheel-win');
    achievements.unlock('wheel-win');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
