// Collects every app build into one static site for Vercel:
// apps/hub/dist -> dist/, apps/<game>/dist -> dist/<game>/
import { cpSync, existsSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const out = join(root, 'dist');
rmSync(out, { recursive: true, force: true });

for (const app of readdirSync(join(root, 'apps'))) {
  const src = join(root, 'apps', app, 'dist');
  if (!existsSync(src)) throw new Error(`Missing build output: apps/${app}/dist`);
  cpSync(src, app === 'hub' ? out : join(out, app), { recursive: true });
  console.log(`assembled ${app}`);
}
