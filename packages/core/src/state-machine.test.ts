import { describe, expect, it, vi } from 'vitest';
import { StateMachine } from './state-machine';

type State = 'idle' | 'spinning' | 'win';
type Event = 'spin' | 'stop' | 'collect';

const make = () =>
  new StateMachine<State, Event>('idle', {
    idle: { spin: 'spinning' },
    spinning: { stop: 'win' },
    win: { collect: 'idle' },
  });

describe('StateMachine', () => {
  it('follows valid transitions', () => {
    const sm = make();
    expect(sm.send('spin')).toBe(true);
    expect(sm.send('stop')).toBe(true);
    expect(sm.state).toBe('win');
    sm.send('collect');
    expect(sm.state).toBe('idle');
  });

  it('rejects events that are invalid in the current state', () => {
    const sm = make();
    expect(sm.can('stop')).toBe(false);
    expect(sm.send('stop')).toBe(false);
    expect(sm.state).toBe('idle');
  });

  it('notifies listeners and supports unsubscribe', () => {
    const sm = make();
    const listener = vi.fn();
    const off = sm.onChange(listener);
    sm.send('spin');
    expect(listener).toHaveBeenCalledWith('spinning', 'idle', 'spin');
    off();
    sm.send('stop');
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
