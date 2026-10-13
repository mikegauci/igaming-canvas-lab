# Credits

## Assets

There are no third-party art or sound assets. Every symbol, cabinet, skyline and character is
drawn in code with PixiJS `Graphics`, and every sound is synthesized at startup by
`renderWav()` in `@lab/core`. The games use the system UI font; the Casino Floor uses two web
fonts, self-hosted from Fontsource:

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
