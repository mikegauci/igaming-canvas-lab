# Credits

## Assets

There are no third-party art or sound assets. Every symbol, cabinet, mountain and character is
drawn in code with PixiJS `Graphics` or GLSL shaders, and every sound is synthesized at startup by
`renderWav()` in `@lab/core`. The games use the system UI font; the Casino Floor uses a web
font, self-hosted from Fontsource:

| Font                                                | Licence                   |
| --------------------------------------------------- | ------------------------- |
| [Orbitron](https://github.com/theleagueof/orbitron) | SIL Open Font License 1.1 |

## Libraries

| Library                                                            | Licence                           |
| ------------------------------------------------------------------ | --------------------------------- |
| [PixiJS](https://pixijs.com)                                       | MIT                               |
| [@pixi/sound](https://github.com/pixijs/sound)                     | MIT                               |
| [GSAP](https://gsap.com)                                           | GSAP Standard "no charge" licence |
| [Vite](https://vite.dev), [Vitest](https://vitest.dev), TypeScript | MIT / Apache-2.0                  |

Spine is not used: its runtime licence requires a Spine Editor licence to publish a site that runs
it. The bonus round's mascot is rigged in code behind the same kind of `play(animation)` interface
instead.
