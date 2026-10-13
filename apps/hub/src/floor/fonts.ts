import { fontFamily } from '@lab/core';

/** Wide geometric caps for titles, marquees and the HUD. The @font-face rules are in style.css. */
export const displayFont = `Orbitron, ${fontFamily}`;

const WEIGHTS = ['500', '700', '900'];

/** How long the floor waits for its fonts before starting with the fallback. */
const FONT_TIMEOUT_MS = 1500;

/**
 * Waits for the floor's web fonts before any text is drawn: Pixi rasterises text to textures, so a
 * label created before its font arrives keeps the fallback font for good. A slow or failed font
 * never holds the floor back for more than FONT_TIMEOUT_MS; it starts with the system font.
 */
export async function loadFonts(): Promise<void> {
  const faces = Promise.all(
    WEIGHTS.map((weight) => document.fonts.load(`${weight} 16px Orbitron`).catch(() => [])),
  );
  await Promise.race([faces, new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS))]);
}
