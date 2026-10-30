/**
 * Build integration for the agent discovery files (PLAN_011
 * T-ar-discovery). After `astro build` it writes every document
 * `src/components/seo/agent-discovery.ts` builds (API catalog, OAuth
 * discovery stubs, the empty JWKS, `/auth.md`, `security.txt`, the A2A card
 * and the Personal Agent Protocol manifest) into `dist/`, and copies the
 * built catalog corpus `/llms/llms-full.txt` to `/llms-full.txt`, so the
 * root file is the same bytes, never a second generator. The facts come
 * from the repository: the site origin from the Astro config, the MCP
 * operations and version from `@texuli/tools/ops`, the security contact
 * from the root SECURITY.md, the MCP limits from `src/lib/mcp-limits.ts`
 * (which the endpoint in `functions/_lib/mcp-endpoint.ts` enforces). Runs before the CSP integration, which writes
 * the header rules for these files into `dist/_headers`.
 */
import { existsSync } from 'node:fs';
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TOOLS_VERSION, texuliOps } from '@texuli/tools/ops';
import type { AstroIntegration } from 'astro';
import {
  DISCOVERY_PATHS,
  type DiscoveryFacts,
  discoveryFiles,
  securityContactFrom,
} from '../components/seo/agent-discovery.ts';
import { MCP_BATCH_MAX, MCP_BODY_MAX, MCP_RATE_LIMIT } from '../lib/mcp-limits.ts';

const SECURITY_POLICY = fileURLToPath(new URL('../../../../SECURITY.md', import.meta.url));

/** The facts for one build of `dist` at `out`. */
export async function discoveryFacts(
  out: string,
  site: string | URL,
  now = new Date()
): Promise<DiscoveryFacts> {
  return {
    origin: new URL(site).origin,
    toolsVersion: TOOLS_VERSION,
    operations: texuliOps.list({ runtimes: ['edge'] }),
    securityContact: securityContactFrom(await readFile(SECURITY_POLICY, 'utf8')),
    now,
    openapi: existsSync(join(out, DISCOVERY_PATHS.openapi.slice(1))),
    mcpLimits: {
      capacity: MCP_RATE_LIMIT.capacity,
      windowSeconds: MCP_RATE_LIMIT.windowSeconds,
      batchMax: MCP_BATCH_MAX,
      bodyMax: MCP_BODY_MAX,
    },
  };
}

export function agentDiscoveryIntegration(): AstroIntegration {
  let site: string | URL | undefined;
  return {
    name: 'texuli-agent-discovery',
    hooks: {
      'astro:config:done': ({ config }) => {
        site = config.site;
      },
      'astro:build:done': async ({ dir, logger }) => {
        if (!site) {
          logger.warn('No `site` configured: skipping the agent discovery files.');
          return;
        }
        const out = fileURLToPath(dir);
        const files = discoveryFiles(await discoveryFacts(out, site));
        for (const file of files) {
          const target = join(out, file.path.slice(1));
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, file.body);
        }
        await copyFile(
          join(out, DISCOVERY_PATHS.llmsFullSource.slice(1)),
          join(out, DISCOVERY_PATHS.llmsFull.slice(1))
        );
        logger.info(
          `${files.length} agent discovery files written (${files.map((file) => file.path).join(', ')}), plus ${DISCOVERY_PATHS.llmsFull}.`
        );
      },
    },
  };
}
