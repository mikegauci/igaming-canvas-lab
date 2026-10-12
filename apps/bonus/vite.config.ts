import { defineConfig } from 'vite';
import { DEV_PORTS } from '../dev-ports';
import { exactStats } from './src/logic/prizes';

export default defineConfig({
  base: '/bonus/',
  server: { port: DEV_PORTS.bonus, strictPort: true },
  // Constant for a given prize table, so work it out once at build time.
  define: { __BONUS_STATS__: JSON.stringify(exactStats()) },
});
