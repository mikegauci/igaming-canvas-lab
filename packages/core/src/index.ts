// Bootstrapping and scenes
export { createGame, type GameOptions, type Game } from './create-game';
export { Scene, SceneManager, type Viewport, type ChangeOptions } from './scene';
export { loadAssets, LoadingScene, type LoadOptions } from './assets';
export { attachDebugOverlay } from './debug-overlay';
export { onKey } from './input';
export { colors, fontFamily } from './theme';

// Pure logic (no Pixi), unit-tested
export { StateMachine, type Transitions } from './state-machine';
export { createRng, seedFromQuery, type Rng, type WeightedEntry } from './rng';
export {
  MockOutcomeServer,
  type MockServerOptions,
  type OutcomeService,
  type Resolver,
  type RoundRequest,
  type RoundResult,
} from './outcome';
export { Wallet, formatCredits, type WalletOptions, type WalletState } from './wallet';
export { localStore, memoryStore, type KeyValueStore } from './storage';

// Audio and UI
export { SoundManager } from './sound';
export { Button, type ButtonOptions } from './ui/button';
export { Label, type LabelVariant } from './ui/label';
export { BalancePanel } from './ui/balance-panel';
