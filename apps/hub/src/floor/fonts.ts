import { fontFamily } from '@lab/core';
import orbitron500 from '@fontsource/orbitron/files/orbitron-latin-500-normal.woff2?url';
import orbitron700 from '@fontsource/orbitron/files/orbitron-latin-700-normal.woff2?url';
import orbitron900 from '@fontsource/orbitron/files/orbitron-latin-900-normal.woff2?url';
import mrDafoe from '@fontsource/mr-dafoe/files/mr-dafoe-latin-400-normal.woff2?url';

/** Wide geometric caps for titles, marquees and the HUD. */
export const displayFont = `Orbitron, ${fontFamily}`;
/** Brush script for the synthwave sign-off under the title. */
export const scriptFont = `"Mr Dafoe", cursive`;

const FACES: [family: string, url: string, weight: string][] = [
  ['Orbitron', orbitron500, '500'],
  ['Orbitron', orbitron700, '700'],
  ['Orbitron', orbitron900, '900'],
  ['Mr Dafoe', mrDafoe, '400'],
];

/**
 * Loads the floor's web fonts before any text is drawn: Pixi rasterises text to textures, so a
 * label created before its font arrives keeps the fallback font for good. On failure the floor
 * still starts, with the system font.
 */
export async function loadFonts(): Promise<void> {
  await Promise.all(
    FACES.map(async ([family, url, weight]) => {
      try {
        const face = new FontFace(family, `url(${url}) format('woff2')`, { weight });
        document.fonts.add(await face.load());
      } catch {
        // The fallback font is fine.
      }
    }),
  );
}
