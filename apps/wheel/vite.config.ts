import { defineConfig } from 'vite';
import { DEV_PORTS } from '../dev-ports';
import { exactStats } from './src/logic/prizes';

export default defineConfig({
  base: '/wheel/',
  server: { port: DEV_PORTS.wheel, strictPort: true },
  // Constant for a given prize table, so work it out once at build time.
  define: { __WHEEL_STATS__: JSON.stringify(exactStats()) },
});
