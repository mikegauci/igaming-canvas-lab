// Bootstrapping and scenes
export { createGame, type GameOptions, type Game } from './create-game';
export { Scene, SceneManager, type Viewport, type ChangeOptions } from './scene';
export { loadAssets, LoadingScene, type LoadOptions } from './assets';
export { attachDebugOverlay } from './debug-overlay';
export { onKey } from './input';
export { colors, fontFamily } from './theme';

// Pure logic (no Pixi), unit-tested
export * from './logic';

// Audio and UI
export { SoundManager } from './sound';
export { Button, type ButtonOptions } from './ui/button';
export { Label, type LabelVariant } from './ui/label';
export { BalancePanel } from './ui/balance-panel';
export { MuteButton } from './ui/mute-button';
