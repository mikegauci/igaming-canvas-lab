import { defineConfig } from 'vite';
import { DEV_PORTS } from '../dev-ports';
import { exactStats } from './src/logic/card';

export default defineConfig({
  base: '/scratch/',
  server: { port: DEV_PORTS.scratch, strictPort: true },
  // Constant for a given prize table, so work it out once at build time.
  define: { __CARD_STATS__: JSON.stringify(exactStats()) },
});
