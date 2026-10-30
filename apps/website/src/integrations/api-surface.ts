/**
 * Build integration for the public JSON API (PLAN_011 T-ar-api). After
 * `astro build`, and after the Markdown twins (whose `md-manifest.json` the
 * examples read), it writes into `dist/`:
 *
 * - `/api/index.json` and `/api/health.json`;
 * - `/openapi.json` (`src/lib/openapi.ts`), with examples read from the
 *   built files and the MCP tools from the `@texuli/tools` registry (every
 *   operation the remote door serves, so a new one appears without an
 *   edit here).
 *
 * The `/api/v1/` aliases are not written: the middleware maps each one to
 * its source file and reads it from `env.ASSETS`
 * (`functions/_lib/api-endpoint.ts`). Then it runs `checkOpenApi` over the
 * finished build and fails it on a duplicate operationId, an unresolved
 * `$ref`, a described file that is not built or an alias whose source file
 * is not built. Runs before the agent discovery integration (which
 * advertises `service-desc` only when `/openapi.json` exists) and the CSP
 * integration (which writes the `_headers` rules from `apiHeaderRules`).
 */
import { existsSync, statSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS_VERSION, texuliOps } from '@texuli/tools/ops';
import type { AstroIntegration } from 'astro';
import { MCP_SERVER_DATA } from '../components/mcp-server/mcp-server-data.ts';
import { API_PATHS, API_PREFIX } from '../lib/api-surface.ts';
import { MCP_BATCH_MAX, MCP_BODY_MAX, MCP_RATE_LIMIT } from '../lib/mcp-limits.ts';
import {
  apiEndpoints,
  buildApiIndex,
  buildHealth,
  buildOpenApi,
  checkOpenApi,
  type OpenApiFacts,
} from '../lib/openapi.ts';

const MCP_DOCS_URL = 'https://github.com/DailybotHQ/texuli/blob/main/packages/tools/docs/mcp.md';

/** The library theme ids the build wrote under `/theme-data/`. */
export async function builtThemeIds(out: string): Promise<string[]> {
  const dir = join(out, 'theme-data');
  if (!existsSync(dir)) return [];
  return (await readdir(dir))
    .filter((name) => name.endsWith('.json'))
    .map((name) => name.slice(0, -'.json'.length))
    .sort();
}

async function readJson(out: string, path: string): Promise<unknown> {
  return JSON.parse(await readFile(join(out, path.slice(1)), 'utf8'));
}

/** Small, real examples cut from the built files. */
async function examplesFrom(out: string, themeId: string | undefined) {
  const catalog = (await readJson(out, '/catalog/catalog.json')) as Record<string, unknown> & {
    entries: unknown[];
  };
  const twins = (await readJson(out, '/md-manifest.json')) as { twins: Record<string, string> };
  const first = <T>(list: unknown, count = 1) => (list as T[]).slice(0, count);
  return {
    Catalog: { ...catalog, entries: first(catalog.entries) },
    ThemeCatalog: first(await readJson(out, '/theme-catalog.json'), 2),
    ThemeDarkSwatchList: first(await readJson(out, '/theme-catalog-dark.json'), 2),
    ThemeGalleryCardList: first(await readJson(out, '/theme-gallery.json')),
    ...(themeId ? { ThemeData: await readJson(out, `/theme-data/${themeId}.json`) } : {}),
    TwinsManifest: { twins: Object.fromEntries(Object.entries(twins.twins).slice(0, 3)) },
  };
}

/** The facts for one build of `dist` at `out`. */
export async function openApiFacts(out: string, site: string | URL): Promise<OpenApiFacts> {
  const themeIds = await builtThemeIds(out);
  const themeId = themeIds.includes('ocean') ? 'ocean' : themeIds[0];
  const origin = new URL(site).origin;
  const index = buildApiIndex({ origin, version: TOOLS_VERSION });
  const health = buildHealth({
    version: TOOLS_VERSION,
    builtAt: new Date(0),
    endpoints: apiEndpoints().length,
  });
  return {
    origin,
    version: TOOLS_VERSION,
    // Every operation the remote door serves: all runtimes but `node`.
    operations: texuliOps
      .list()
      .filter((operation) => operation.runtime !== 'node')
      .map(({ name, title, summary, input, output }) => ({
        name,
        title,
        summary,
        input: input as Record<string, unknown>,
        output: output as Record<string, unknown>,
      })),
    mcp: {
      protocolVersion: MCP_SERVER_DATA.protocolVersion,
      protocolVersions: MCP_SERVER_DATA.protocolVersions,
      capacity: MCP_RATE_LIMIT.capacity,
      windowSeconds: MCP_RATE_LIMIT.windowSeconds,
      batchMax: MCP_BATCH_MAX,
      bodyMax: MCP_BODY_MAX,
      docsUrl: MCP_DOCS_URL,
      serverCard: MCP_SERVER_DATA.serverCard,
    },
    parameterExamples: themeId ? { theme: themeId } : {},
    examples: { ...(await examplesFrom(out, themeId)), ApiIndex: index, Health: health },
  };
}

const json = (value: unknown) => `${JSON.stringify(value, null, 2)}\n`;

export function apiSurfaceIntegration(): AstroIntegration {
  let site: string | URL | undefined;
  return {
    name: 'texuli-api-surface',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!site) {
          logger.warn('No `site` configured: skipping the API files and /openapi.json.');
          return;
        }
        const out = fileURLToPath(dir);
        const write = async (path: string, body: string) => {
          const target = join(out, path.slice(1));
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, body);
        };
        const facts = await openApiFacts(out, site);
        await write(API_PATHS.index, json(buildApiIndex(facts)));
        await write(
          API_PATHS.health,
          json(
            buildHealth({
              version: facts.version,
              builtAt: new Date(),
              endpoints: apiEndpoints().length,
            })
          )
        );
        const themeIds = await builtThemeIds(out);
        const document = buildOpenApi(facts);
        await write(API_PATHS.openapi, json(document));
        const problems = checkOpenApi(document, {
          exists: (path) => {
            const file = join(out, path.slice(1));
            return existsSync(file) && statSync(file).isFile();
          },
          expand: () => themeIds,
          functionPaths: [API_PATHS.mcp],
        });
        if (problems.length > 0)
          throw new Error(`/openapi.json does not match the build:\n- ${problems.join('\n- ')}`);
        const operations = Object.keys(document.paths as object).length;
        logger.info(
          `/openapi.json written (${operations} paths, ${facts.operations.length} MCP tools), ${API_PATHS.index} and ${API_PATHS.health}; the ${API_PREFIX}/ aliases are served by the middleware from their source files (none written).`
        );
      },
    },
  };
}
