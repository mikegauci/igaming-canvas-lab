import { defineConfig } from 'vite';
import { DEV_PORTS } from '../dev-ports';

export default defineConfig({
  base: '/crash/',
  server: { port: DEV_PORTS.crash, strictPort: true },
});
