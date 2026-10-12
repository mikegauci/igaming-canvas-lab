// Pure game logic with no Pixi or DOM imports. Unit tests and server-side code import this
// entry point (`@lab/core/logic`) so they never pull in the renderer.
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
export { renderWav, type Tone } from './synth';
export { countUpSeconds } from './presentation';
export { Achievements, ACHIEVEMENTS, type AchievementId } from './achievements';
