/**
 * The /developers/ page data (PLAN_011 T-ar-api): every row comes from a
 * typed source, so the portal cannot drift from what the build serves.
 * The API resources, limits, version and error model come from
 * `src/lib/api-surface.ts`; the MCP facts and tools from the registry's
 * generated page data (`mcp-server-data.ts`, `pnpm check:surfaces`); the
 * MCP limits from `src/lib/mcp-limits.ts`.
 */
import {
  API_ERROR_CODES,
  API_PATHS,
  API_PREFIX,
  API_RATE_LIMIT,
  API_RELEASE_STATUS,
  API_RESOURCES,
  API_VERSION,
  API_VERSIONING,
  aliasOperationId,
  apiProblem,
} from '../../lib/api-surface.ts';
import { MCP_BATCH_MAX, MCP_BODY_MAX, MCP_RATE_LIMIT } from '../../lib/mcp-limits.ts';
import { MCP_SERVER_DATA } from '../mcp-server/mcp-server-data.ts';
import { DISCOVERY_PATHS } from '../seo/agent-discovery.ts';

export const SITE_ORIGIN = 'https://texuli.com';

export const RELEASE = API_RELEASE_STATUS;
export const VERSION = API_VERSION;
export const PATHS = API_PATHS;
export const PREFIX = API_PREFIX;
export const VERSIONING = API_VERSIONING;

/** One endpoint row: the versioned path first, the site file it reads second. */
export interface EndpointRow {
  key: string;
  title: string;
  summary: string;
  path: string;
  operationId: string;
  siteFile: string;
}

export const ENDPOINTS: readonly EndpointRow[] = API_RESOURCES.map((resource) => ({
  key: resource.key,
  title: resource.title,
  summary: resource.summary,
  path: resource.alias,
  operationId: aliasOperationId(resource),
  siteFile: resource.path,
}));

/** The limits table: one row per surface. */
export const LIMITS = [
  {
    surface: '/api/',
    policy: `"${API_RATE_LIMIT.name}";q=${API_RATE_LIMIT.capacity};w=${API_RATE_LIMIT.windowSeconds}`,
    rule: `${API_RATE_LIMIT.capacity} requests per client per ${API_RATE_LIMIT.windowSeconds} seconds. GET, HEAD and OPTIONS only.`,
  },
  {
    surface: '/mcp',
    policy: `"${MCP_RATE_LIMIT.name}";q=${MCP_RATE_LIMIT.capacity};w=${MCP_RATE_LIMIT.windowSeconds}`,
    rule: `${MCP_RATE_LIMIT.capacity} messages per client per ${MCP_RATE_LIMIT.windowSeconds} seconds (each message of a batch counts), batches of at most ${MCP_BATCH_MAX}, bodies of at most ${Math.round(MCP_BODY_MAX / 1024)} KB.`,
  },
] as const;

/** The MCP doors and the tools the remote one serves. */
export const MCP = {
  remote: MCP_SERVER_DATA.remote.url,
  local: MCP_SERVER_DATA.local.launch,
  serverCard: MCP_SERVER_DATA.serverCard,
  protocolVersion: MCP_SERVER_DATA.protocolVersion,
  remoteTools: MCP_SERVER_DATA.tools.filter((tool) => tool.remote).map((tool) => tool.name),
  localOnlyTools: MCP_SERVER_DATA.tools.filter((tool) => !tool.remote).map((tool) => tool.name),
} as const;

/** `catalog.search` → `texuli catalog search`. */
export function cliCommand(operation: string): string {
  return `texuli ${operation.split('.').join(' ')}`;
}

/** The CLI commands of every operation, from the same registry. */
export const CLI_COMMANDS: readonly string[] = MCP_SERVER_DATA.tools.map((tool) =>
  cliCommand(tool.name)
);

/** The machine-readable files an agent can start from. */
export const AGENT_FILES = [
  {
    href: API_PATHS.openapi,
    label: 'OpenAPI 3.1 description',
    note: 'every endpoint above and POST /mcp',
  },
  {
    href: API_PATHS.index,
    label: 'API index',
    note: `the ${API_PREFIX}/ endpoints with their operationIds, as JSON`,
  },
  { href: DISCOVERY_PATHS.llms, label: 'llms.txt', note: 'the site guide for language models' },
  {
    href: DISCOVERY_PATHS.llmsFull,
    label: 'llms-full.txt',
    note: 'every component doc in one file',
  },
  {
    href: '/md-manifest.json',
    label: 'Markdown twins manifest',
    note: `every page and its .md twin, versioned at ${API_PREFIX}/twins.json (or send Accept: text/markdown to a page URL)`,
  },
  { href: DISCOVERY_PATHS.skill, label: 'The Texuli skill', note: 'install it in a coding agent' },
  { href: DISCOVERY_PATHS.apiCatalog, label: 'API catalog', note: 'RFC 9727 linkset' },
  {
    href: DISCOVERY_PATHS.aiCatalog,
    label: 'AI catalog',
    note: 'the ARD resource catalog, npm packages included',
  },
  {
    href: DISCOVERY_PATHS.authMd,
    label: 'auth.md',
    note: 'how agents access the site: anonymously',
  },
] as const;

export const ERROR_CODES = API_ERROR_CODES;

/** A real problem body, as the middleware sends it for a miss. */
export const PROBLEM_EXAMPLE = JSON.stringify(
  apiProblem('resource_not_found', `${API_PREFIX}/no-such-file.json`, SITE_ORIGIN),
  null,
  2
);
