import { describe, expect, it } from 'vitest';
import { IDLE_AFTER_MS, IDLE_FPS, IdleThrottle } from './idle-throttle';

const setup = (idle = true) => {
  let time = 0;
  const state = { idle };
  const ticker = { maxFPS: 0 };
  const throttle = new IdleThrottle(
    ticker,
    () => state.idle,
    () => time,
  );
  return { ticker, throttle, state, advance: (ms: number) => (time += ms) };
};

describe('IdleThrottle', () => {
  it('stays uncapped until the scene has been idle with no input for a while', () => {
    const { ticker, throttle, advance } = setup();
    advance(IDLE_AFTER_MS - 1);
    throttle.tick();
    expect(ticker.maxFPS).toBe(0);
    advance(1);
    throttle.tick();
    expect(ticker.maxFPS).toBe(IDLE_FPS);
  });

  it('never caps while a round is in progress', () => {
    const { ticker, throttle, advance } = setup(false);
    advance(IDLE_AFTER_MS * 10);
    throttle.tick();
    expect(ticker.maxFPS).toBe(0);
  });

  it('restores the full rate at once on input or when a round starts', () => {
    const { ticker, throttle, state, advance } = setup();
    advance(IDLE_AFTER_MS);
    throttle.tick();
    throttle.poke();
    expect(ticker.maxFPS).toBe(0);
    throttle.tick();
    expect(ticker.maxFPS).toBe(0);

    advance(IDLE_AFTER_MS);
    throttle.tick();
    expect(ticker.maxFPS).toBe(IDLE_FPS);
    state.idle = false;
    throttle.tick();
    expect(ticker.maxFPS).toBe(0);
  });
});
