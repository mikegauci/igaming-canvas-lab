import { fontFamily } from '@lab/core';
import orbitron500 from '@fontsource/orbitron/files/orbitron-latin-500-normal.woff2?url';
import orbitron700 from '@fontsource/orbitron/files/orbitron-latin-700-normal.woff2?url';
import orbitron900 from '@fontsource/orbitron/files/orbitron-latin-900-normal.woff2?url';

/** Wide geometric caps for titles, marquees and the HUD. */
export const displayFont = `Orbitron, ${fontFamily}`;

const FACES: [url: string, weight: string][] = [
  [orbitron500, '500'],
  [orbitron700, '700'],
  [orbitron900, '900'],
];

/** How long the floor waits for its fonts before starting with the fallback. */
const FONT_TIMEOUT_MS = 1500;

/**
 * Loads the floor's web fonts before any text is drawn: Pixi rasterises text to textures, so a
 * label created before its font arrives keeps the fallback font for good. A slow or failed font
 * never holds the floor back for more than FONT_TIMEOUT_MS; it starts with the system font.
 */
export async function loadFonts(): Promise<void> {
  const faces = Promise.all(
    FACES.map(async ([url, weight]) => {
      try {
        const face = new FontFace('Orbitron', `url(${url}) format('woff2')`, { weight });
        document.fonts.add(await face.load());
      } catch {
        // The fallback font is fine.
      }
    }),
  );
  await Promise.race([faces, new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS))]);
}
