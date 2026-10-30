/**
 * The /mcp-server/ page model (PLAN_011 T-site-090). Everything here is
 * derived from the generated registry data (`mcp-server-data.ts`, written by
 * scripts/generate-surfaces.ts; `pnpm check:surfaces` fails on drift) or
 * from the typed site sources (the remote limits, the release status, the
 * WebMCP bridge), so the page cannot list a tool, limit or door that does
 * not exist. The host snippets are built from the local launch command and
 * the remote URL; `apps/website/tests/site-mcp-server.test.ts` checks the
 * local ones against the `@texuli/mcp` README, their written source.
 */
import { API_RELEASE_STATUS } from '../../lib/api-surface.ts';
import { MCP_BATCH_MAX, MCP_BODY_MAX, MCP_RATE_LIMIT } from '../../lib/mcp-limits.ts';
import { webMcpTools } from '../../lib/webmcp.ts';
import { MCP_SERVER_DATA } from './mcp-server-data.ts';

export const MCP = MCP_SERVER_DATA;
export const RELEASE = API_RELEASE_STATUS;

/** `npx -y @texuli/mcp` → `npx` and `["-y", "@texuli/mcp"]`. */
const [LOCAL_COMMAND, ...LOCAL_ARGS] = MCP.local.launch.split(' ') as [string, ...string[]];
const LOCAL_ARGS_JSON = `[${LOCAL_ARGS.map((arg) => JSON.stringify(arg)).join(', ')}]`;
const REMOTE = MCP.remote.url;

/** The `@texuli/tools` door to the same local server. */
export const TOOLS_LAUNCH = 'npx -p @texuli/tools texuli mcp';

export type HostLanguage = 'json' | 'toml' | 'text';

/** One host's setup: where the config lives and the snippet for each door. */
export interface McpHost {
  id: string;
  name: string;
  /** Where the snippet goes. */
  where: string;
  language: HostLanguage;
  local: string;
  remote: string;
  /** The remote snippet's language when it differs. */
  remoteLanguage?: HostLanguage;
}

export const MCP_HOSTS: readonly McpHost[] = [
  {
    id: 'claude-code',
    name: 'Claude Code',
    where: 'a terminal in the project',
    language: 'text',
    local: `claude mcp add texuli -- ${MCP.local.launch}`,
    remote: `claude mcp add --transport http texuli ${REMOTE}`,
  },
  {
    id: 'cursor',
    name: 'Cursor',
    where: '.cursor/mcp.json in the project, or ~/.cursor/mcp.json',
    language: 'json',
    local: `{
  "mcpServers": {
    "texuli": { "command": "${LOCAL_COMMAND}", "args": ${LOCAL_ARGS_JSON} }
  }
}`,
    remote: `{
  "mcpServers": {
    "texuli": { "url": "${REMOTE}" }
  }
}`,
  },
  {
    id: 'vscode',
    name: 'VS Code',
    where: '.vscode/mcp.json in the workspace',
    language: 'json',
    local: `{
  "servers": {
    "texuli": { "type": "stdio", "command": "${LOCAL_COMMAND}", "args": ${LOCAL_ARGS_JSON} }
  }
}`,
    remote: `{
  "servers": {
    "texuli": { "type": "http", "url": "${REMOTE}" }
  }
}`,
  },
  {
    id: 'windsurf',
    name: 'Windsurf',
    where: '~/.codeium/windsurf/mcp_config.json',
    language: 'json',
    local: `{
  "mcpServers": {
    "texuli": { "command": "${LOCAL_COMMAND}", "args": ${LOCAL_ARGS_JSON} }
  }
}`,
    remote: `{
  "mcpServers": {
    "texuli": { "serverUrl": "${REMOTE}" }
  }
}`,
  },
  {
    id: 'codex',
    name: 'Codex',
    where: '~/.codex/config.toml',
    language: 'toml',
    local: `[mcp_servers.texuli]
command = "${LOCAL_COMMAND}"
args = ${LOCAL_ARGS_JSON}`,
    remote: `[mcp_servers.texuli]
url = "${REMOTE}"`,
  },
  {
    id: 'generic',
    name: 'Any other host',
    where: 'the host’s MCP settings',
    language: 'text',
    local: `stdio command: ${MCP.local.launch}
(already using @texuli/tools: ${TOOLS_LAUNCH})`,
    remote: `Streamable HTTP URL: ${REMOTE}`,
  },
];

/** The tool groups the page renders, in registry runtime order. */
export const TOOL_GROUPS = [
  {
    runtime: 'edge',
    title: 'Edge tools',
    note: 'Pure functions over the built catalog and themes: served by both doors.',
  },
  {
    runtime: 'node',
    title: 'Node tools',
    note: 'Need Node.js (file formats): served by the local door only; the remote answers runtime-unavailable.',
  },
  {
    runtime: 'site',
    title: 'Site tools',
    note: 'Read the deployed texuli.com through its Markdown twins: served by the remote door only.',
  },
] as const;

export type Tool = (typeof MCP.tools)[number];

export function toolsIn(runtime: string): Tool[] {
  return MCP.tools.filter((tool) => tool.runtime === runtime);
}

/** Which doors serve a tool, as words. */
export function doorsOf(tool: Pick<Tool, 'remote' | 'local'>): string {
  if (tool.remote && tool.local) return 'Remote and local';
  return tool.remote ? 'Remote only' : 'Local only';
}

const bytes = (value: number) =>
  value >= 1024 * 1024
    ? `${Math.round((value / (1024 * 1024)) * 10) / 10} MiB`
    : value >= 1024
      ? `${Math.round(value / 1024)} KiB`
      : `${value} B`;

/** A tool's limits in one line: input bytes, item cap and time budget. */
export function limitsOf(tool: Tool): string {
  const limits = tool.limits as { inputBytes: number; items?: number; timeMs: number };
  const parts = [`input ${bytes(limits.inputBytes)}`];
  if (limits.items !== undefined) parts.push(`${limits.items} items`);
  parts.push(`${limits.timeMs / 1000} s`);
  return parts.join(' · ');
}

/** The remote door's limits, from the numbers the endpoint enforces. */
export const REMOTE_LIMITS = [
  `Bodies of at most ${bytes(MCP_BODY_MAX)} (413 past it).`,
  `Batches of at most ${MCP_BATCH_MAX} messages.`,
  `${MCP_RATE_LIMIT.capacity} messages per client per ${MCP_RATE_LIMIT.windowSeconds} seconds, best-effort (429 with Retry-After; every answer carries RateLimit-Policy and RateLimit).`,
  `A ${MCP.remote.callTimeoutMs / 1000} s guard per message, on top of each tool’s own limits.`,
  'A browser request must come from texuli.com, a texuli.pages.dev preview or localhost; server-side agents send no Origin and are allowed.',
] as const;

export const LOCAL_LIMITS = [
  `A stdio message over ${bytes(MCP.local.messageBytes)} is refused before parsing.`,
  'No network: no tool fetches anything or needs a secret.',
  'stdout is the protocol; logs and errors go to stderr.',
] as const;

/** The WebMCP tools the site pages offer a browser agent (read at build, never called). */
export const WEBMCP_TOOLS = webMcpTools(
  async () => new Response(null, { status: 204 }),
  'https://texuli.com'
).map((tool) => ({ name: tool.name, description: tool.description }));

/** The `tools/list` request for the try-it section. */
export const CURL_TOOLS_LIST = `curl -s ${REMOTE} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -H 'MCP-Protocol-Version: ${MCP.protocolVersion}' \\
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'`;

export const CURL_TOOLS_CALL = `curl -s ${REMOTE} \\
  -H 'Content-Type: application/json' \\
  -H 'Accept: application/json, text/event-stream' \\
  -H 'MCP-Protocol-Version: ${MCP.protocolVersion}' \\
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/call","params":{"name":"site.search","arguments":{"query":"dark mode","limit":3}}}'`;

/** The counts the page states and the spec compares with the registry. */
export const COUNTS = {
  tools: MCP.tools.length,
  remote: MCP.tools.filter((tool) => tool.remote).length,
  local: MCP.tools.filter((tool) => tool.local).length,
  resources: MCP.resources.length,
  templates: MCP.resourceTemplates.length,
  prompts: MCP.prompts.length,
} as const;
