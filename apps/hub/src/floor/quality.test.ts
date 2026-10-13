import { describe, expect, it, vi } from 'vitest';
import { guessTier, Quality } from './quality';

const frames = (quality: Quality, count: number, ms: number) => {
  for (let i = 0; i < count; i++) quality.sample(ms);
};

describe('guessTier', () => {
  it('starts low-memory devices low', () => {
    expect(guessTier({ cores: 8, memory: 2 })).toBe('low');
  });

  it('does not trust a low core count alone', () => {
    expect(guessTier({ cores: 2, memory: 16 })).toBe('medium');
  });

  it('starts phones and mid-range machines at medium', () => {
    expect(guessTier({ cores: 8, memory: 8, coarsePointer: true })).toBe('medium');
    expect(guessTier({ cores: 4, memory: 8 })).toBe('medium');
  });

  it('starts strong desktops high', () => {
    expect(guessTier({ cores: 8, memory: 8 })).toBe('high');
    expect(guessTier({})).toBe('high');
  });
});

describe('Quality', () => {
  it('stays put while frames are fast', () => {
    const quality = new Quality('high');
    frames(quality, 1000, 16.7);
    expect(quality.tier).toBe('high');
  });

  it('steps down one tier after a slow window, then waits before judging again', () => {
    const quality = new Quality('high');
    const listener = vi.fn();
    quality.onChange(listener);
    frames(quality, 90 + 120, 30);
    expect(quality.tier).toBe('medium');
    expect(listener).toHaveBeenCalledWith(expect.objectContaining({ tier: 'medium', crt: false }));
    frames(quality, 90 + 119, 30);
    expect(quality.tier).toBe('medium');
    frames(quality, 1, 30);
    expect(quality.tier).toBe('low');
    frames(quality, 1000, 30);
    expect(quality.tier).toBe('low');
  });

  it('ignores warm-up frames and one-off hitches', () => {
    const quality = new Quality('high');
    frames(quality, 90, 100);
    frames(quality, 60, 1000);
    frames(quality, 120, 16.7);
    expect(quality.tier).toBe('high');
  });

  it('never changes a tier pinned from the URL', () => {
    const quality = new Quality('high', true);
    frames(quality, 1000, 50);
    expect(quality.tier).toBe('high');
  });
});
