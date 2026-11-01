/**
 * The `@texuli/tools` version that every door reports (e.g. the MCP
 * `serverInfo.version`). A plain constant rather than a JSON import: import
 * attributes (`with { type: 'json' }`) are not supported by every bundler
 * that builds the remote MCP (Cloudflare Pages' Functions build), and a
 * plain JSON import breaks Node ESM. `tests/ops.test.ts` fails when this
 * drifts from `packages/tools/package.json`.
 */
export const TOOLS_VERSION = '0.12.0';
