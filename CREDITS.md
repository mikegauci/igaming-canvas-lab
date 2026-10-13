# Credits

## Assets

Game symbols, cabinet frames, mountains and characters are drawn in code with PixiJS `Graphics`
or GLSL shaders. The retrowave cabinet illustrations in `design/retrowave-cabinets/artwork/`
were generated with OpenAI's image tool; Mini Slot reuses the Miami illustration for its backdrop
and marquee. Every sound is synthesized at startup by `renderWav()` in `@lab/core`. Mini Slot
uses Orbitron, and the Casino Floor uses both fonts below, self-hosted from Fontsource:

| Font                                                   | Licence                   |
| ------------------------------------------------------ | ------------------------- |
| [Orbitron](https://github.com/theleagueof/orbitron)    | SIL Open Font License 1.1 |
| [Mr Dafoe](https://fonts.google.com/specimen/Mr+Dafoe) | SIL Open Font License 1.1 |

## Libraries

| Library                                                            | Licence                           |
| ------------------------------------------------------------------ | --------------------------------- |
| [PixiJS](https://pixijs.com)                                       | MIT                               |
| [@pixi/sound](https://github.com/pixijs/sound)                     | MIT                               |
| [pixi-filters](https://github.com/pixijs/filters)                  | MIT                               |
| [GSAP](https://gsap.com)                                           | GSAP Standard "no charge" licence |
| [Vite](https://vite.dev), [Vitest](https://vitest.dev), TypeScript | MIT / Apache-2.0                  |

Spine is not used: its runtime licence requires a Spine Editor licence to publish a site that runs
it. The bonus round's mascot is rigged in code behind the same kind of `play(animation)` interface
instead.
