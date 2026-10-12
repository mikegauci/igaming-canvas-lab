# iGaming Canvas Lab

Five small casino-style games built with **PixiJS v8 + TypeScript**, plus a playable landing page.

| Game                                                             | Status | Shows                                                           |
| ---------------------------------------------------------------- | ------ | --------------------------------------------------------------- |
| [Mini Slot Machine](https://igaming-canvas-lab.vercel.app/slot/) | Live   | Masked reel strips, ticker-driven spin, server-decided outcomes |
| [Lucky Spin Wheel](https://igaming-canvas-lab.vercel.app/wheel/) | Live   | Rotation tweens to a predetermined segment, custom easing       |
| [Scratch Card](https://igaming-canvas-lab.vercel.app/scratch/)   | Live   | RenderTexture erase brush, reveal % detection, touch            |
| [Crash Multiplier](https://igaming-canvas-lab.vercel.app/crash/) | Live   | Real-time game loop, state machine, cash-out timing             |
| [Bonus Round](https://igaming-canvas-lab.vercel.app/bonus/)      | Live   | Rigged mascot, coin particles, BIG/MEGA/EPIC win sequence       |

## Stack

PixiJS v8 · TypeScript · Vite · GSAP · Vitest · pnpm workspaces

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

## Lucky Wheel (`apps/wheel`)

A 12-segment prize wheel. Space spins, and pressing it again makes the wheel land faster.

- **Weighted, server-decided outcome.** The segments look equal, but the server picks one by
  weight, and also picks where inside it the pointer stops, so seeded replays are exact.
  `exactStats()` gives **RTP 95.6%**, with a 50× jackpot at 0.4%; the odds panel shows the same
  figures.
- **Angle maths.** `targetRotation()` finds the forward rotation, at least a minimum distance away,
  that puts the chosen spot under the pointer. Tests check this round trip on 500 random cases.
- **Custom ease.** `createWheelEase()` decelerates on a power curve, creeps just past the target
  and settles back with a cosine, so the pointer sometimes slips over a peg and back. The tween
  duration is chosen so the ease's starting speed equals the free-spin speed, so there's no jolt
  when the result arrives.
- **Pointer flicks.** Pegs crossing the pointer, forwards or backwards, are counted from the
  rotation each frame and kick the pointer with an elastic spring, plus a throttled tick sound.
- **Cheap rendering.** The face (12 wedges, labels and pegs) is baked into one texture, and the
  rim bulbs share one tinted texture. About 10 draw calls per frame.

## Scratch Card (`apps/scratch`)

A match-3 scratch card. Drag to scratch, or press REVEAL or Space.

- **RenderTexture scratching.** The prizes sit above a silver foil and are masked by a
  `RenderTexture`. Each pointer move paints a round-capped stroke from the last point into it, so
  fast swipes leave no gaps.
- **Coverage without GPU readback.** The same strokes are stamped into a 48×48 `CoverageGrid` in
  memory, which gives per-prize and whole-card coverage cheaply instead of reading pixels back
  every frame. A prize counts as seen at 50%, and past 62% the rest wipes away on its own.
- **Server-decided card.** The prize is drawn first (RTP 94%, a win on 1 card in 3.2). The card is
  then laid out with exactly three of the winning symbol and no other triple, and tests check
  thousands of layouts.
- **Pooled confetti.** `Confetti` in `@lab/core` is a `ParticleContainer` of 400 pre-allocated
  quads (one draw call) recycled across bursts, also used for foil flakes while scratching.

## Crash (`apps/crash`)

Bet, watch the multiplier climb, and cash out before it crashes. Space bets and cashes out, and A
cycles the auto cash-out target.

- **Server-authoritative timing.** `MockCrashServer` draws the crash point when the round starts
  and keeps it secret until it pushes the crash. Cash-outs are judged on the server's clock when
  the request arrives, so network delay counts against the player. The animation is never the
  authority. A test shows a request that looks safe on screen losing because it reached the
  server after the crash.
- **Heavy-tailed maths.** `crashPointFrom(r) = 0.97 / (1 − r)`, rounded down to hundredths, gives
  P(reach x) = 0.97 / x. About 4% of rounds bust at 1.00×, and auto cash-out at 2× returns
  96.5%. Tests check the distribution and the RTP against 200,000 simulated rounds.
- **Real-time chart.** The curve is redrawn each frame from `e^(0.15·t)`, and the axes ease
  towards the tip so the view zooms out as the multiplier climbs. The rocket follows the curve's
  on-screen slope, and stars stream past faster as it climbs. Numbers use `BitmapText`. About
  9 draw calls per frame.
- **Race-safe client.** An instant bust can arrive before the start acknowledgement, and a
  cash-out verdict can arrive after the crash message. Both are handled, and a confirmed cash-out
  is always credited.

## Bonus Round (`apps/bonus`)

Pick one of three chests (click, or press 1, 2 or 3). Big prizes set off the celebration.
`?demo=big`, `?demo=mega` or `?demo=epic` forces that tier so the sequence can be seen without
waiting for a rare draw, and the screen says so.

- **Server-decided pick.** The pick is cosmetic: the server decides the prize, and what the
  other two chests held, when the chest is picked. RTP is 97%, a pick pays on 63% of tries, and a
  BIG WIN or better comes up 1 in 50.
- **BIG → MEGA → EPIC roll-up.** `planCountUp()` turns a win into contiguous steps: the banner
  starts at BIG and upgrades as the counter passes 25× and 50× the stake. Each upgrade fires a
  coin burst, a screen shake and a sound, and the whole thing is one GSAP timeline that Space or
  a tap skips to the end. Tests check the steps.
- **Coin shower.** A pooled `ParticleContainer` (`Confetti` from `@lab/core` with a coin
  texture) holds 360 coins that spin by squashing their x scale. It's one draw call.
- **Rigged mascot, ready for Spine.** "Lucky" is a skeleton of bone containers (body, face, arms
  and legs on their joints) animated by GSAP timelines: idle, anticipate, cheer, celebrate and
  sad. The scene only calls `play(animation)`, so a `spine-pixi-v8` skeleton could take its
  place. Spine isn't used yet: its runtime licence requires a Spine Editor licence to publish a
  site that runs it.

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
