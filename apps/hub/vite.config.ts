import { defineConfig } from 'vite';
import { DEV_PORTS } from '../dev-ports';

const { hub, ...games } = DEV_PORTS;

export default defineConfig({
  base: '/',
  server: {
    port: hub,
    strictPort: true,
    // ws: true also forwards each game's HMR socket.
    proxy: Object.fromEntries(
      Object.entries(games).map(([name, port]) => [
        `/${name}/`,
        { target: `http://localhost:${port}`, ws: true },
      ]),
    ),
  },
});
