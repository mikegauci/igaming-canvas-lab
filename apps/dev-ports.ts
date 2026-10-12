/**
 * Fixed dev-server ports. `pnpm dev` starts every app, and the hub proxies /<game>/ to each
 * game's server so links between apps work the same as in the deployed site.
 */
export const DEV_PORTS = {
  hub: 5173,
  slot: 5174,
  wheel: 5175,
} as const;
