import manifest from '../package.json' with { type: 'json' };

/**
 * The `@texuli/mcp` version, read from its manifest (the published
 * `dist/version.js` sits at the same depth, so it reads the published
 * `package.json`). It always equals the `@texuli/tools` version: the
 * dependency is pinned exactly and both publish in the same wave.
 */
export const TEXULI_MCP_VERSION: string = manifest.version;
