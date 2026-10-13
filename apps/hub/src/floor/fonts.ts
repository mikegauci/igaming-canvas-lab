import { fontFamily } from '@lab/core';

/** Wide geometric caps for titles, marquees and the HUD. The @font-face rules are in style.css. */
export const displayFont = `Orbitron, ${fontFamily}`;
/** Brush script for the neon "Casino Floor" under the title. */
export const scriptFont = `"Mr Dafoe", cursive`;

const FACES = ['500 16px Orbitron', '700 16px Orbitron', '900 16px Orbitron', '16px "Mr Dafoe"'];

/** How long the floor waits for its fonts before starting with the fallback. */
const FONT_TIMEOUT_MS = 1500;

/**
 * Waits for the floor's web fonts before any text is drawn: Pixi rasterises text to textures, so a
 * label created before its font arrives keeps the fallback font for good. A slow or failed font
 * never holds the floor back for more than FONT_TIMEOUT_MS; it starts with the system font.
 */
export async function loadFonts(): Promise<void> {
  const faces = Promise.all(FACES.map((font) => document.fonts.load(font).catch(() => [])));
  await Promise.race([faces, new Promise((resolve) => setTimeout(resolve, FONT_TIMEOUT_MS))]);
}
