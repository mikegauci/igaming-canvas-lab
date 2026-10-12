import { createGame } from '@lab/core';
import { Graphics } from 'pixi.js';

// Placeholder backdrop: drifting neon dots. The Casino Floor replaces this in Phase 3.
const stage = document.getElementById('stage');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

if (stage && !reducedMotion) {
  const { app, root } = await createGame({ parent: stage, designWidth: 1280, designHeight: 720 });
  const colors = [0xff3ea5, 0x3ef0ff, 0xffd23e];

  const dots = Array.from({ length: 40 }, (_, i) => {
    const dot = new Graphics().circle(0, 0, 2 + Math.random() * 4).fill({
      color: colors[i % colors.length],
      alpha: 0.5,
    });
    dot.position.set(Math.random() * 1280, Math.random() * 720);
    root.addChild(dot);
    return { dot, speed: 0.2 + Math.random() * 0.6 };
  });

  app.ticker.add((ticker) => {
    for (const { dot, speed } of dots) {
      dot.y -= speed * ticker.deltaTime;
      if (dot.y < -10) dot.y = 730;
    }
  });
}
