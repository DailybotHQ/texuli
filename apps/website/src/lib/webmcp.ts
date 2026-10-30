/**
 * The WebMCP bridge (PLAN_011 T-ar-site-mcp, ADR-018): four read-only tools
 * a browser agent finds on every texuli.com page through
 * `navigator.modelContext` (or `document.modelContext`), registered as the
 * layout's module script runs, before `DOMContentLoaded`.
 *
 * - `texuli_search_docs` and `texuli_validate_blueprint` POST one JSON-RPC
 *   `tools/call` to the same-origin remote MCP (`/mcp`: `site.search`,
 *   `blueprint.validate`), so the browser runs the same registry code;
 * - `texuli_read_page` and `texuli_get_component` GET a same-origin Markdown
 *   file (a page's twin, `/llms/components/<id>.md`).
 *
 * Every request goes to `origin` (the page's own); paths are checked before
 * they become URLs. No `eval`, no HTML sinks, no DOM writes: the tools only
 * return text, so the strict CSP and Trusted Types policy stay unchanged
 * (`connect-src 'self'` already covers the requests). Without
 * `modelContext` the bridge does nothing.
 */

/** What a WebMCP tool returns: MCP-shaped text content. */
export interface WebMcpResult {
  content: { type: 'text'; text: string }[];
  isError?: boolean;
}

export interface WebMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations: { readOnlyHint: true };
  execute(args: Record<string, unknown>): Promise<WebMcpResult>;
}

/** The parts of a WebMCP `modelContext` the bridge calls. */
export interface ModelContextLike {
  provideContext?: (context: { tools: WebMcpTool[] }) => unknown;
  registerTool?: (tool: WebMcpTool) => unknown;
}

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

/** The protocol version the bridge sends (tests pin it to the handler's). */
export const WEBMCP_PROTOCOL_VERSION = '2025-11-25';
/** The longest text a tool returns. */
export const WEBMCP_MAX_TEXT = 256 * 1024;

const PATH = /^\/[A-Za-z0-9._~/-]*$/;
const COMPONENT_ID = /^[a-z0-9][a-z0-9-]{0,127}$/;

const text = (value: string, isError = false): WebMcpResult => ({
  content: [{ type: 'text', text: value.slice(0, WEBMCP_MAX_TEXT) }],
  ...(isError ? { isError: true } : {}),
});

/**
 * The twin path of a site path (`/` → `/index.md`, `/guides/theming/` and
 * `/guides/theming` → `/guides/theming.md`, a `.md` path unchanged), or
 * `undefined` for anything that is not a plain same-site path (traversal,
 * `//`, other characters).
 */
export function webMcpTwinPath(path: string): string | undefined {
  const clean = path.trim().replace(/[?#].*$/s, '');
  if (!PATH.test(clean) || clean.includes('//')) return undefined;
  if (clean.split('/').some((segment) => segment === '.' || segment === '..')) return undefined;
  if (clean === '/' || clean === '/index.md') return '/index.md';
  if (clean.endsWith('.md')) return clean;
  return `${clean.replace(/\/$/, '')}.md`;
}

/** The four tools, bound to a fetcher and the page origin. */
export function webMcpTools(fetcher: Fetcher, origin: string): WebMcpTool[] {
  const callMcp = async (name: string, args: Record<string, unknown>) => {
    const response = await fetcher(`${origin}/mcp`, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'mcp-protocol-version': WEBMCP_PROTOCOL_VERSION,
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name, arguments: args },
      }),
    });
    if (!response.ok) return text(`The texuli.com MCP answered HTTP ${response.status}.`, true);
    const answer = (await response.json()) as {
      result?: { content?: { text?: string }[]; isError?: boolean };
      error?: { message?: string };
    };
    const result = answer.result;
    if (!result) return text(answer.error?.message ?? 'The MCP returned no result.', true);
    return text(result.content?.[0]?.text ?? '', result.isError === true);
  };
  const getText = async (path: string, missing: string) => {
    const response = await fetcher(`${origin}${path}`, {
      credentials: 'same-origin',
      headers: { accept: 'text/markdown' },
    });
    return response.ok ? text(await response.text()) : text(missing, true);
  };
  const guard =
    (run: (args: Record<string, unknown>) => Promise<WebMcpResult>) =>
    async (args: Record<string, unknown>) => {
      try {
        return await run(args ?? {});
      } catch (error) {
        return text(`The tool failed: ${error instanceof Error ? error.message : 'error'}.`, true);
      }
    };
  const readOnly = { readOnlyHint: true } as const;

  return [
    {
      name: 'texuli_search_docs',
      description:
        'Search texuli.com (guides, components, themes, agent docs) by words in page titles, headings and descriptions. Returns ranked pages with their path, URL, Markdown twin and matching headings, as JSON.',
      inputSchema: {
        type: 'object',
        properties: {
          query: { type: 'string', maxLength: 200, description: 'Words to look for.' },
          limit: { type: 'integer', minimum: 1, maximum: 50, description: 'Hits (1 to 50).' },
        },
        required: ['query'],
      },
      annotations: readOnly,
      execute: guard((args) =>
        callMcp('site.search', {
          query: String(args.query ?? ''),
          ...(typeof args.limit === 'number' ? { limit: args.limit } : {}),
        })
      ),
    },
    {
      name: 'texuli_read_page',
      description:
        'Read a texuli.com page as Markdown (its twin): pass a path such as "/guides/theming/" or "/". Returns the Markdown text.',
      inputSchema: {
        type: 'object',
        properties: {
          path: {
            type: 'string',
            maxLength: 512,
            pattern: PATH.source,
            description: 'A site path, e.g. /guides/theming/.',
          },
        },
        required: ['path'],
      },
      annotations: readOnly,
      execute: guard(async (args) => {
        const twin = webMcpTwinPath(String(args.path ?? ''));
        if (!twin) return text('Pass a plain texuli.com path such as /guides/theming/.', true);
        return getText(twin, `No texuli.com page at ${twin}; find one with texuli_search_docs.`);
      }),
    },
    {
      name: 'texuli_get_component',
      description:
        'Read the agent documentation of one Texuli component (props, examples, tiers, accessibility) by its catalog id, e.g. "card". Returns Markdown.',
      inputSchema: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            maxLength: 128,
            pattern: COMPONENT_ID.source,
            description: 'A component id, e.g. card or data-grid.',
          },
        },
        required: ['id'],
      },
      annotations: readOnly,
      execute: guard(async (args) => {
        const id = String(args.id ?? '');
        if (!COMPONENT_ID.test(id)) return text('Pass a component id such as card.', true);
        return getText(
          `/llms/components/${id}.md`,
          `No component "${id}"; find ids with texuli_search_docs.`
        );
      }),
    },
    {
      name: 'texuli_validate_blueprint',
      description:
        "Validate a Texuli blueprint draft (a catalog tree, an array of trees or a texuli-blueprint envelope) with the catalog's checks. Returns valid, status and diagnostics with stable codes, as JSON.",
      inputSchema: {
        type: 'object',
        properties: {
          draft: { type: ['object', 'array'], description: 'The blueprint draft.' },
          tier: { type: 'string', enum: ['untrusted', 'developer'] },
          fragment: { type: 'boolean', description: 'Accept any roots.' },
        },
        required: ['draft'],
      },
      annotations: readOnly,
      execute: guard((args) =>
        callMcp('blueprint.validate', {
          draft: args.draft,
          ...(args.tier === 'developer' || args.tier === 'untrusted' ? { tier: args.tier } : {}),
          ...(typeof args.fragment === 'boolean' ? { fragment: args.fragment } : {}),
        })
      ),
    },
  ];
}

/** The browser globals the bridge reads. */
export interface WebMcpScope {
  navigator?: { modelContext?: ModelContextLike };
  document?: { modelContext?: ModelContextLike };
  location: { origin: string };
  fetch: Fetcher;
}

/**
 * Register the tools: `provideContext` when the page's `modelContext` has
 * it, else `registerTool` once per tool. Returns how it registered, or
 * `none` when WebMCP is absent (a no-op).
 */
export function registerWebMcp(scope: WebMcpScope): 'provideContext' | 'registerTool' | 'none' {
  const context = scope.navigator?.modelContext ?? scope.document?.modelContext;
  if (!context) return 'none';
  const tools = webMcpTools((input, init) => scope.fetch(input, init), scope.location.origin);
  if (typeof context.provideContext === 'function') {
    try {
      context.provideContext({ tools });
      return 'provideContext';
    } catch {
      // Fall back to one registration per tool.
    }
  }
  if (typeof context.registerTool !== 'function') return 'none';
  let registered = 0;
  for (const tool of tools) {
    try {
      context.registerTool(tool);
      registered += 1;
    } catch {
      // A tool the host refuses is skipped; the others stay.
    }
  }
  return registered > 0 ? 'registerTool' : 'none';
}
