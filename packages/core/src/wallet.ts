import { localStore, type KeyValueStore } from './storage';

export interface WalletState {
  balance: number;
  bet: number;
}

export interface WalletOptions {
  store?: KeyValueStore;
  /** Shared by the hub and every game (same origin), so credits carry between them. */
  storageKey?: string;
  initialBalance?: number;
  betLevels?: readonly number[];
  defaultBet?: number;
  /** Max bet stakes the balance rounded down to a multiple of this (e.g. a slot's line count). */
  betStep?: number;
}

type Listener = (state: WalletState) => void;

const assertAmount = (amount: number) => {
  if (!Number.isInteger(amount) || amount < 0) throw new RangeError(`Invalid amount: ${amount}`);
};

/** Fake credits. Whole numbers only, so there is no floating-point drift in balances. */
export class Wallet {
  readonly betLevels: readonly number[];
  readonly betStep: number;
  private readonly store: KeyValueStore;
  private readonly storageKey: string;
  private readonly initialBalance: number;
  private _balance: number;
  private _bet: number;
  private listeners = new Set<Listener>();

  constructor({
    store = localStore(),
    storageKey = 'lab:wallet',
    initialBalance = 1000,
    betLevels = [1, 2, 5, 10, 20, 50, 100],
    defaultBet = betLevels[2] ?? betLevels[0],
    betStep = 1,
  }: WalletOptions = {}) {
    if (betLevels.length === 0) throw new RangeError('Wallet needs at least one bet level');
    if (!Number.isInteger(betStep) || betStep < 1)
      throw new RangeError(`Invalid bet step: ${betStep}`);
    betLevels.forEach(assertAmount);
    assertAmount(initialBalance);

    this.store = store;
    this.storageKey = storageKey;
    this.initialBalance = initialBalance;
    this.betLevels = [...betLevels].sort((a, b) => a - b);
    this.betStep = betStep;
    this._bet =
      defaultBet !== undefined && betLevels.includes(defaultBet) ? defaultBet : this.betLevels[0]!;
    this._balance = this.restore() ?? initialBalance;
  }

  get balance(): number {
    return this._balance;
  }

  get bet(): number {
    return this._bet;
  }

  get state(): WalletState {
    return { balance: this._balance, bet: this._bet };
  }

  canAfford(amount: number = this._bet): boolean {
    return amount <= this._balance;
  }

  setBet(amount: number): void {
    if (!this.betLevels.includes(amount)) throw new RangeError(`Bet ${amount} is not a bet level`);
    this.changeBet(amount);
  }

  /**
   * Moves the bet to the next level up or down, clamped to the ends of the list. From a max bet
   * that sits between levels, it goes to the nearest level in that direction.
   */
  stepBet(direction: 1 | -1): void {
    const levels = this.betLevels;
    const next =
      direction === 1
        ? (levels.find((level) => level > this._bet) ?? levels[levels.length - 1]!)
        : ([...levels].reverse().find((level) => level < this._bet) ?? levels[0]!);
    this.setBet(next);
  }

  /**
   * Max bet: the whole balance (rounded down to a multiple of `betStep`), or the lowest level if
   * the balance is below it.
   */
  maxBet(): void {
    const allIn = Math.floor(this._balance / this.betStep) * this.betStep;
    this.changeBet(Math.max(allIn, this.betLevels[0]!));
  }

  /** Takes the stake. Returns false, and changes nothing, if the balance is too low. */
  debit(amount: number = this._bet): boolean {
    assertAmount(amount);
    if (amount > this._balance) return false;
    this.update(this._balance - amount);
    return true;
  }

  credit(amount: number): void {
    assertAmount(amount);
    if (amount > 0) this.update(this._balance + amount);
  }

  /** Free refill for a demo: only when the player can no longer afford the smallest bet. */
  topUp(): boolean {
    if (this.canAfford(this.betLevels[0])) return false;
    this.update(this.initialBalance);
    return true;
  }

  onChange(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private changeBet(amount: number) {
    if (amount === this._bet) return;
    this._bet = amount;
    this.emit();
  }

  private update(balance: number) {
    this._balance = balance;
    this.store.set(this.storageKey, JSON.stringify({ balance }));
    this.emit();
  }

  private emit() {
    const state = this.state;
    for (const listener of this.listeners) listener(state);
  }

  private restore(): number | null {
    try {
      const saved: unknown = JSON.parse(this.store.get(this.storageKey) ?? 'null');
      const balance = (saved as { balance?: unknown } | null)?.balance;
      return typeof balance === 'number' && Number.isInteger(balance) && balance >= 0
        ? balance
        : null;
    } catch {
      return null;
    }
  }
}

const creditFormat = new Intl.NumberFormat('en-US');

export const formatCredits = (amount: number): string => creditFormat.format(amount);
