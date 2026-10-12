# iGaming Canvas Lab

Five small casino-style games built with **PixiJS v8 + TypeScript**, plus a playable landing page.

| Game              | Status  | Shows                                                           |
| ----------------- | ------- | --------------------------------------------------------------- |
| Mini Slot Machine | Planned | Masked reel strips, ticker-driven spin, server-decided outcomes |
| Lucky Spin Wheel  | Planned | Rotation tweens to a predetermined segment, custom easing       |
| Scratch Card      | Planned | RenderTexture erase brush, reveal % detection, touch            |
| Crash Multiplier  | Planned | Real-time game loop, state machine, cash-out timing             |
| Bonus Round       | Planned | Spine animation, particles, big-win sequence                    |

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

## Development

```bash
corepack enable
pnpm install
pnpm dev          # hub
pnpm test         # unit tests (pure game logic, no Pixi)
pnpm typecheck && pnpm lint
pnpm build        # builds every app into dist/
```

## License

MIT. Third-party assets are listed in [CREDITS.md](CREDITS.md).
