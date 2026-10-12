# iGaming Canvas Lab

Five small casino-style games built with **PixiJS v8 + TypeScript**, plus a playable landing page.

| Game                                                             | Status  | Shows                                                           |
| ---------------------------------------------------------------- | ------- | --------------------------------------------------------------- |
| [Mini Slot Machine](https://igaming-canvas-lab.vercel.app/slot/) | Live    | Masked reel strips, ticker-driven spin, server-decided outcomes |
| Lucky Spin Wheel                                                 | Planned | Rotation tweens to a predetermined segment, custom easing       |
| Scratch Card                                                     | Planned | RenderTexture erase brush, reveal % detection, touch            |
| Crash Multiplier                                                 | Planned | Real-time game loop, state machine, cash-out timing             |
| Bonus Round                                                      | Planned | Spine animation, particles, big-win sequence                    |

## Stack

PixiJS v8 · TypeScript · Vite · GSAP · Spine (`@esotericsoftware/spine-pixi-v8`) · Vitest · pnpm workspaces

## Structure

```
packages/core   shared engine: app bootstrap + letterbox resize, state machine, outcome service, wallet, UI
apps/hub        landing page
apps/<game>     one Vite app per game, served at /<game>/
scripts/        assemble.mjs merges every app build into dist/ for Vercel
```

**Key principle:** the outcome of every round is decided by an outcome service (mocked here with a
seeded RNG, as a server would), and the animation only _displays_ it.

## Mini Slot (`apps/slot`)

A 3×3, 5-line slot. Space spins, pressing it again slam-stops the reels, and ↑/↓ change the bet.

- **Server-decided outcome.** `MockOutcomeServer` picks a stop on each physical reel strip and
  settles the win. The client only animates towards that result.
- **Reel splicing.** Each reel recycles 4 sprites under one rectangular mask. When the result
  arrives, the strip positions that are still off screen are remapped to the result, so the reel
  lands exactly on it after a short back-eased run without any visible jump. The landing tween's
  starting speed matches the spin speed.
- **Maths you can check.** `exactStats()` walks all 24³ stop combinations: **RTP 96.6%**, hit
  rate 21% (1 in 4.7), max win 160× the stake. A unit test checks those figures and compares them
  with a 200,000-spin seeded simulation.
- **Cheap rendering.** Symbols are drawn once as vector `Graphics` and baked into textures with
  `generateTexture`, so the reels are plain batched sprites. Counters use `BitmapText`, and a
  slight vertical stretch fakes motion blur without a filter pass. About 10 draw calls per frame
  (`?debug=1`).
- **Display balance vs real balance.** The wallet is credited as soon as the result arrives. The
  balance panel holds the old figure until the win count-up has finished.

## Development

```bash
corepack enable
pnpm install
pnpm dev          # every app; open http://localhost:5173 (the hub proxies /slot/ etc.)
pnpm test         # unit tests (pure game logic, no Pixi)
pnpm typecheck && pnpm lint
pnpm build        # builds every app into dist/
```

URL flags on any game: `?debug=1` shows FPS, draw calls and node count; `?seed=123` replays the
same sequence of rounds.

## License

MIT. Third-party assets are listed in [CREDITS.md](CREDITS.md).
