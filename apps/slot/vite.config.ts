import { defineConfig } from 'vite';
import { DEV_PORTS } from '../dev-ports';
import { exactStats } from './src/logic/stats';

export default defineConfig({
  base: '/slot/',
  server: { port: DEV_PORTS.slot, strictPort: true },
  // Enumerating every reel stop takes a noticeable moment on phones, and the answer only
  // changes with the strips, so work it out once at build time.
  define: { __SLOT_STATS__: JSON.stringify(exactStats()) },
});
