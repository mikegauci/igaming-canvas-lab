import { describe, expect, it, vi } from 'vitest';
import { memoryStore } from './storage';
import { formatCredits, Wallet } from './wallet';

const make = (saved?: string) =>
  new Wallet({
    store: memoryStore(saved === undefined ? {} : { 'lab:wallet': saved }),
    initialBalance: 100,
    betLevels: [1, 5, 10],
    defaultBet: 5,
  });

describe('Wallet', () => {
  it('starts with the initial balance and default bet', () => {
    expect(make().state).toEqual({ balance: 100, bet: 5 });
  });

  it('debits and credits whole credits', () => {
    const wallet = make();
    expect(wallet.debit()).toBe(true);
    wallet.credit(20);
    expect(wallet.balance).toBe(115);
  });

  it('refuses a debit it cannot cover and leaves the balance alone', () => {
    const wallet = make();
    expect(wallet.debit(101)).toBe(false);
    expect(wallet.balance).toBe(100);
  });

  it('rejects negative or fractional amounts', () => {
    const wallet = make();
    expect(() => wallet.credit(-1)).toThrow(RangeError);
    expect(() => wallet.debit(0.5)).toThrow(RangeError);
  });

  it('max bet picks the highest level the balance covers', () => {
    const wallet = make();
    wallet.maxBet();
    expect(wallet.bet).toBe(10);
    wallet.debit(93);
    wallet.maxBet();
    expect(wallet.bet).toBe(5);
    wallet.debit(7);
    wallet.maxBet();
    expect(wallet.bet).toBe(1);
  });

  it('persists the balance so it carries between the hub and the games', () => {
    const store = memoryStore();
    const first = new Wallet({ store, initialBalance: 100 });
    first.debit(30);
    expect(new Wallet({ store, initialBalance: 100 }).balance).toBe(70);
  });

  it('ignores corrupted or invalid saved data', () => {
    expect(make('not json').balance).toBe(100);
    expect(make('{"balance":-5}').balance).toBe(100);
    expect(make('{"balance":"lots"}').balance).toBe(100);
    expect(make('{"balance":42}').balance).toBe(42);
  });

  it('steps through bet levels and clamps at both ends', () => {
    const wallet = make();
    wallet.stepBet(1);
    expect(wallet.bet).toBe(10);
    wallet.stepBet(1);
    expect(wallet.bet).toBe(10);
    wallet.stepBet(-1);
    wallet.stepBet(-1);
    wallet.stepBet(-1);
    expect(wallet.bet).toBe(1);
    expect(() => wallet.setBet(3)).toThrow(RangeError);
  });

  it('notifies listeners on every change until unsubscribed', () => {
    const wallet = make();
    const listener = vi.fn();
    const off = wallet.onChange(listener);

    wallet.debit();
    expect(listener).toHaveBeenLastCalledWith({ balance: 95, bet: 5 });
    wallet.setBet(10);
    expect(listener).toHaveBeenLastCalledWith({ balance: 95, bet: 10 });
    off();
    wallet.credit(1);
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('tops up only when the smallest bet is unaffordable', () => {
    const wallet = make();
    expect(wallet.topUp()).toBe(false);
    wallet.debit(100);
    expect(wallet.topUp()).toBe(true);
    expect(wallet.balance).toBe(100);
  });
});

describe('formatCredits', () => {
  it('adds thousands separators', () => {
    expect(formatCredits(1234567)).toBe('1,234,567');
  });
});
