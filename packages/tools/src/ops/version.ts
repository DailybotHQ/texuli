import manifest from '../../package.json' with { type: 'json' };

/**
 * The `@texuli/tools` version, read from its package manifest at build time
 * (the published `dist/ops/version.js` sits at the same depth, so it reads
 * the published `package.json`). Every door reports it, e.g. the MCP
 * `serverInfo.version`.
 */
export const TOOLS_VERSION: string = manifest.version;
