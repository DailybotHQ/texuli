/**
 * Agent discovery for texuli.com (PLAN_011 T-ar-discovery): the one typed
 * source for the files and headers that agents and readiness scanners
 * (isitagentready.com, is-agentic.com) look for first. Pure builders: no
 * file system, no network, no clock (the build passes `now`). The build
 * integration (`src/integrations/agent-discovery.ts`) writes the files into
 * `dist/`, the CSP integration (`src/components/security/csp.ts`) puts the
 * `Link` header and the per-file header rules into `dist/_headers`,
 * `buildRobots` (`seo.ts`) takes the robots directives, and the middleware
 * (`functions/_middleware.ts`) sends the same `Link` value on the Markdown
 * twins it builds. Nothing here is hand-copied into `public/`.
 *
 * Honesty rules (plan rule "honest stubs, never theatre"): every document
 * describes what exists. Access is anonymous and read-only; the OAuth
 * documents are discovery stubs that say so in a `_comment`; the A2A card
 * points at the MCP server and says Texuli has no A2A agent; the Personal
 * Agent Protocol manifest declares website-only discovery (no sessions, no
 * sign-in, no APIs); `service-desc` is advertised only when the build
 * actually contains `/openapi.json`. The ARD catalog (`ai-catalog.json`)
 * is generated here too since PLAN_011 T-ar-api, with the npm packages an
 * agent can run (`@texuli/mcp`, `@texuli/tools`).
 */
import type { Operation } from '@texuli/tools/ops';
import {
  API_PATHS,
  API_PREFIX,
  API_RATE_LIMIT,
  API_RELEASE_STATUS,
} from '../../lib/api-surface.ts';

/** Every discovery path the site serves or links, root-relative. */
export const DISCOVERY_PATHS = Object.freeze({
  apiCatalog: '/.well-known/api-catalog',
  aiCatalog: '/.well-known/ai-catalog.json',
  /** The OpenAPI document T-ar-api generates; linked only when it is built. */
  openapi: '/openapi.json',
  llms: '/llms.txt',
  /** The root copy of the catalog corpus (`llmsFullSource`), written at build. */
  llmsFull: '/llms-full.txt',
  llmsFullSource: '/llms/llms-full.txt',
  oauthAuthorizationServer: '/.well-known/oauth-authorization-server',
  /** RFC 9728: exactly this path, no `.json` suffix. */
  oauthProtectedResource: '/.well-known/oauth-protected-resource',
  jwks: '/.well-known/jwks.json',
  authMd: '/auth.md',
  securityTxt: '/.well-known/security.txt',
  agentCard: '/.well-known/agent-card.json',
  /** Personal Agent Protocol draft 0.1, section 3 (discovery). */
  poppy: '/.well-known/poppy.json',
  mcp: '/mcp',
  mcpWellKnown: '/.well-known/mcp',
  serverCard: '/.well-known/mcp/server-card.json',
  agentSkills: '/.well-known/agent-skills/index.json',
  catalog: '/catalog/catalog.json',
  componentDocs: '/llms/llms.txt',
  skill: '/skill/',
} as const);

/** Where the security policy lives in the repository (RFC 9116 `Policy`). */
export const SECURITY_POLICY_URL = 'https://github.com/DailybotHQ/texuli/blob/main/SECURITY.md';

/** The repository, for documents that link the source of truth. */
export const REPOSITORY_URL = 'https://github.com/DailybotHQ/texuli';

// ---------------------------------------------------------------------------
// robots.txt

/**
 * The site's Content Signals (contentsignals.org, draft-romm-aipref-
 * contentsignals). This repository owns them: Cloudflare's managed Content
 * Signals must stay off for texuli.com, or robots.txt would carry two
 * blocks with the same directive (apps/website/docs/site-aeo.md).
 */
export const CONTENT_SIGNALS = Object.freeze({
  'ai-train': 'yes',
  search: 'yes',
  'ai-input': 'yes',
} as const);

/** `Content-Signal: ai-train=yes, search=yes, ai-input=yes`. */
export function contentSignalDirective(): string {
  const pairs = Object.entries(CONTENT_SIGNALS).map(([key, value]) => `${key}=${value}`);
  return `Content-Signal: ${pairs.join(', ')}`;
}

/** `Agentmap: <origin>/.well-known/ai-catalog.json` (the ARD manifest). */
export function agentmapDirective(origin: string): string {
  return `Agentmap: ${absolute(origin, DISCOVERY_PATHS.aiCatalog)}`;
}

// ---------------------------------------------------------------------------
// Link headers (RFC 8288)

/** One `Link` header target. */
export interface LinkTarget {
  href: string;
  rel: string;
  type?: string;
}

/** What a page's `Link` header depends on in the finished build. */
export interface LinkOptions {
  /** `/openapi.json` exists in the build: advertise `service-desc`. */
  openapi: boolean;
  /** The page's Markdown twin, when one was built (`/guides/theming.md`). */
  twin?: string;
}

/**
 * The discovery links every HTML page carries: the API catalog, the
 * OpenAPI description (only when built), the llms.txt guide and the ARD
 * catalog, plus the page's own Markdown twin when one exists.
 */
export function discoveryLinks(options: LinkOptions): LinkTarget[] {
  const links: LinkTarget[] = [{ href: DISCOVERY_PATHS.apiCatalog, rel: 'api-catalog' }];
  if (options.openapi) links.push({ href: DISCOVERY_PATHS.openapi, rel: 'service-desc' });
  links.push(
    { href: DISCOVERY_PATHS.llms, rel: 'describedby' },
    { href: DISCOVERY_PATHS.aiCatalog, rel: 'ai-catalog' }
  );
  if (options.twin) links.push({ href: options.twin, rel: 'alternate', type: 'text/markdown' });
  return links;
}

/** A link target may not break out of its angle brackets or quotes. */
const UNSAFE_LINK_PART = /[\s<>"',;\\]/;

/**
 * One RFC 8288 `Link` field value: `<href>; rel="…"[; type="…"]`, comma
 * separated. A target that could break the syntax throws (it is built from
 * fixed paths and built file names, so a throw is a build bug).
 */
export function formatLinkHeader(links: readonly LinkTarget[]): string {
  return links
    .map((link) => {
      for (const part of [link.href, link.rel, link.type ?? ''])
        if (UNSAFE_LINK_PART.test(part)) throw new Error(`unsafe Link header part: ${part}`);
      const rootRelative = link.href.startsWith('/') && !link.href.startsWith('//');
      if (!rootRelative && !link.href.startsWith('https://'))
        throw new Error(`a Link target must be root-relative or https: ${link.href}`);
      return `<${link.href}>; rel="${link.rel}"${link.type ? `; type="${link.type}"` : ''}`;
    })
    .join(', ');
}

/**
 * The Markdown twin a built page route may have: `/` → `/index.md`,
 * `/guides/theming/` (or its `index.html`) → `/guides/theming.md`. Whether
 * it exists is a question for the build output, not for this function.
 */
export function twinCandidate(route: string): string | undefined {
  const page = route.endsWith('/index.html') ? route.slice(0, -'index.html'.length) : route;
  if (page === '/') return '/index.md';
  if (!page.startsWith('/') || !page.endsWith('/') || page.length < 3) return undefined;
  return `${page.slice(0, -1)}.md`;
}

// ---------------------------------------------------------------------------
// Static files and their headers

/** One generated discovery file. */
export interface DiscoveryFile {
  /** Root-relative path, also the `_headers` rule path. */
  path: string;
  contentType: string;
  body: string;
  /** Send `Access-Control-Allow-Origin: *` (public, read-only documents). */
  cors: boolean;
}

/** The facts the generated documents state, all from the repository. */
export interface DiscoveryFacts {
  /** `https://texuli.com`, from the Astro `site`. */
  origin: string;
  /** The `@texuli/tools` version that serves the MCP operations. */
  toolsVersion: string;
  /** The operations the remote MCP serves (the registry's `edge` and `site` runtimes). */
  operations: readonly Pick<Operation, 'name' | 'title' | 'summary' | 'annotations'>[];
  /** The security contact address, read from the root SECURITY.md. */
  securityContact: string;
  /** The build time; security.txt expires one year later. */
  now: Date;
  /** `/openapi.json` exists in the build. */
  openapi: boolean;
  /** The remote MCP's limits, from `functions/_lib/mcp-endpoint.ts`. */
  mcpLimits: McpLimits;
}

/** The limits `/auth.md` states, as the endpoint enforces them. */
export interface McpLimits {
  /** Messages per client per window. */
  capacity: number;
  windowSeconds: number;
  /** Messages per JSON-RPC batch. */
  batchMax: number;
  /** Request body bytes. */
  bodyMax: number;
}

const JSON_TYPE = 'application/json';

function absolute(origin: string, path: string): string {
  return new URL(path, origin).href;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

const ANONYMOUS_COMMENT =
  'texuli.com is a public documentation and component-library site. Every page, file and the MCP server are read-only and anonymous: no account, no registration, no credential and no token is needed or issued.';

/** RFC 9727 API catalog (served as `application/linkset+json`). */
export function apiCatalog(facts: Pick<DiscoveryFacts, 'origin' | 'openapi'>): unknown {
  const at = (path: string) => absolute(facts.origin, path);
  const site = [
    ...(facts.openapi
      ? [
          {
            rel: 'service-desc',
            href: at(DISCOVERY_PATHS.openapi),
            type: 'application/vnd.oai.openapi+json',
            title: 'OpenAPI description of the read-only JSON surface',
          },
        ]
      : []),
    {
      rel: 'service-doc',
      href: at(DISCOVERY_PATHS.llms),
      type: 'text/plain',
      title: 'Texuli site guide for LLMs',
    },
    {
      rel: 'service-doc',
      href: at(DISCOVERY_PATHS.llmsFull),
      type: 'text/plain',
      title: 'Texuli full content corpus for LLMs',
    },
    {
      rel: 'service-doc',
      href: at(DISCOVERY_PATHS.authMd),
      type: 'text/markdown',
      title: 'How agents access texuli.com (anonymous, read-only)',
    },
    {
      rel: 'service-doc',
      href: at(API_PATHS.docs),
      type: 'text/html',
      title: 'Developer portal: the JSON API, MCP, CLI, limits and versioning',
    },
    {
      rel: 'status',
      href: at(API_PATHS.health),
      type: JSON_TYPE,
      title: 'API health (a static file written by the build)',
    },
    {
      rel: 'item',
      // The static index (built everywhere); it lists the /api/v1/ URLs,
      // which only the middleware serves.
      href: at(API_PATHS.index),
      type: JSON_TYPE,
      title: 'API index: every endpoint with its operationId',
    },
    {
      rel: 'item',
      href: at(DISCOVERY_PATHS.catalog),
      type: JSON_TYPE,
      title: 'Catalog manifest snapshot',
    },
    {
      rel: 'item',
      href: at(DISCOVERY_PATHS.componentDocs),
      type: 'text/plain',
      title: 'Component docs bundle index',
    },
    { rel: 'item', href: at(DISCOVERY_PATHS.skill), type: 'text/html', title: 'The Texuli skill' },
    {
      rel: 'describedby',
      href: at(DISCOVERY_PATHS.aiCatalog),
      type: JSON_TYPE,
      title: 'Agentic resource discovery catalog',
    },
  ];
  return {
    linkset: [
      { anchor: at('/'), links: site },
      {
        anchor: at(DISCOVERY_PATHS.mcp),
        links: [
          {
            rel: 'service-desc',
            href: at(DISCOVERY_PATHS.serverCard),
            type: JSON_TYPE,
            title: 'MCP server card',
          },
          {
            rel: 'service-doc',
            href: at(DISCOVERY_PATHS.authMd),
            type: 'text/markdown',
            title: 'Access and limits of the MCP server',
          },
        ],
      },
    ],
  };
}

/**
 * RFC 8414 authorization-server metadata: a discovery stub. The endpoints
 * are reserved paths that accept nothing; `jwks_uri` resolves to an empty
 * key set, which is the truth (no token is ever signed).
 */
export function oauthAuthorizationServer(facts: Pick<DiscoveryFacts, 'origin'>): unknown {
  const at = (path: string) => absolute(facts.origin, path);
  return {
    _comment: `${ANONYMOUS_COMMENT} This RFC 8414 document exists so agents that probe for OAuth learn that quickly. The authorization and token endpoints are reserved paths that accept no request; the key set is empty because nothing is signed. Read ${at(DISCOVERY_PATHS.authMd)}.`,
    issuer: facts.origin,
    authorization_endpoint: at('/oauth/authorize'),
    token_endpoint: at('/oauth/token'),
    jwks_uri: at(DISCOVERY_PATHS.jwks),
    grant_types_supported: ['authorization_code'],
    response_types_supported: ['code'],
    scopes_supported: ['read'],
    token_endpoint_auth_methods_supported: ['none'],
    service_documentation: at(DISCOVERY_PATHS.authMd),
    agent_auth: {
      _comment:
        'Auth.md discovery block. Agents use texuli.com anonymously: there is nothing to register, claim or present. The register and claim URIs are reserved paths that accept no request; do not probe them.',
      skill: at(DISCOVERY_PATHS.authMd),
      register_uri: at('/agent/auth'),
      identity_endpoint: at('/agent/auth'),
      claim_uri: at('/agent/auth/claim'),
      claim_endpoint: at('/agent/auth/claim'),
      identity_types_supported: ['anonymous'],
      anonymous: { credential_types_supported: ['bearer'] },
      credential_types_supported: ['bearer'],
    },
  };
}

/** RFC 9728 protected-resource metadata: the site, read scope, anonymous. */
export function oauthProtectedResource(facts: Pick<DiscoveryFacts, 'origin'>): unknown {
  return {
    _comment: `${ANONYMOUS_COMMENT} This RFC 9728 document is a discovery stub: no resource on texuli.com asks for a token, and the "read" scope is the only kind of access there is. The authorization server it names is the site's own stub.`,
    resource: facts.origin,
    authorization_servers: [facts.origin],
    scopes_supported: ['read'],
    bearer_methods_supported: ['header'],
    resource_name: 'Texuli',
    resource_documentation: absolute(facts.origin, DISCOVERY_PATHS.authMd),
  };
}

/** The empty JSON Web Key Set behind `jwks_uri`: no key, because nothing is signed. */
export function jwks(): unknown {
  return { keys: [] };
}

/** `/auth.md`: anonymous access, the MCP endpoint and its limits, in prose. */
export function authMd(
  facts: Pick<DiscoveryFacts, 'origin' | 'securityContact' | 'mcpLimits'>
): string {
  const at = (path: string) => absolute(facts.origin, path);
  const limits = facts.mcpLimits;
  const kb = Math.round(limits.bodyMax / 1024);
  return `# auth.md: texuli.com

> How AI agents and other automated clients access texuli.com: anonymously,
> read-only, with no registration and no credential.

## Audience

Agents (assistants, crawlers, MCP and A2A clients) that read \`/auth.md\`
before deciding how to authenticate.

## Access model

| Aspect | Value |
| --- | --- |
| Identity required | None: anonymous access |
| Credentials | None are needed and none are issued |
| Registration | None. There is no account system |
| Protected resources | None |
| Access | Read-only. Nothing on the site changes state for a request |

## What an agent can read

- Every page, as HTML, and its Markdown twin: the page URL plus \`.md\`
  (\`/index.md\` for the home page). The page's \`Link\` header and its head
  name it with \`rel="alternate"; type="text/markdown"\`, and a request that
  sends \`Accept: text/markdown\` to the page URL gets it.
- [${at(DISCOVERY_PATHS.llms)}](${at(DISCOVERY_PATHS.llms)}) (the site guide) and
  [${at(DISCOVERY_PATHS.llmsFull)}](${at(DISCOVERY_PATHS.llmsFull)}) (the full corpus).
- [${at(DISCOVERY_PATHS.apiCatalog)}](${at(DISCOVERY_PATHS.apiCatalog)}) (RFC 9727) and
  [${at(DISCOVERY_PATHS.aiCatalog)}](${at(DISCOVERY_PATHS.aiCatalog)}) (the resource catalog).
- [${at(DISCOVERY_PATHS.agentSkills)}](${at(DISCOVERY_PATHS.agentSkills)}) (the agent skills index).

## The MCP server

- **Endpoint:** \`${at(DISCOVERY_PATHS.mcp)}\` (also answered at \`${at(DISCOVERY_PATHS.mcpWellKnown)}\`).
- **Card:** [${at(DISCOVERY_PATHS.serverCard)}](${at(DISCOVERY_PATHS.serverCard)}).
- **Transport:** stateless Streamable HTTP. Send \`POST\` with a JSON-RPC
  message (or a batch of at most ${limits.batchMax}), \`Content-Type: application/json\`
  and an \`Accept\` that allows \`application/json\`. Responses are JSON; there
  is no SSE stream and no session.
- **Authentication:** none. Send no \`Authorization\` header.
- **Operations:** read-only (search, read and validate the catalog,
  examples, blueprints and themes). The server lists them in \`tools/list\`.

## The JSON API

- **Index:** [${at(API_PATHS.index)}](${at(API_PATHS.index)}); **OpenAPI:**
  [${at(API_PATHS.openapi)}](${at(API_PATHS.openapi)}); **portal:**
  [${at(API_PATHS.docs)}](${at(API_PATHS.docs)}).
- Read-only files under \`${API_PREFIX}/\` (\`GET\` and \`HEAD\`), anonymous, CORS \`*\`.
  Every answer carries \`X-API-Version\`; errors are RFC 9457
  \`application/problem+json\`.

## Limits

- ${API_RATE_LIMIT.capacity} JSON API requests per client per ${API_RATE_LIMIT.windowSeconds} seconds under \`/api/\`, with the
  same \`RateLimit-Policy\`, \`RateLimit\` and \`429\` + \`Retry-After\` fields.
- ${limits.capacity} MCP messages per client per ${limits.windowSeconds} seconds; each message in a
  batch counts. Every answer carries \`RateLimit-Policy\` and \`RateLimit\`
  headers. Past the limit the answer is \`429\` with \`Retry-After\`: wait
  that many seconds.
- A request body is at most ${kb} KB.
- Browsers may call the endpoint only from texuli.com. A server-side agent
  sends no \`Origin\` header and is allowed.

## OAuth discovery documents

For agents that probe the standard OAuth paths, the site publishes
discovery stubs that state the same thing as this file: anonymous,
read-only, nothing to register.

- [${at(DISCOVERY_PATHS.oauthProtectedResource)}](${at(DISCOVERY_PATHS.oauthProtectedResource)}) (RFC 9728)
- [${at(DISCOVERY_PATHS.oauthAuthorizationServer)}](${at(DISCOVERY_PATHS.oauthAuthorizationServer)}) (RFC 8414)

Their endpoints are reserved paths that accept no request. Do not probe
them.

## Contact

Security reports: ${facts.securityContact} (see
[${at(DISCOVERY_PATHS.securityTxt)}](${at(DISCOVERY_PATHS.securityTxt)})).
Everything else: ${REPOSITORY_URL}.
`;
}

/** The address after `**Email:**` in the root SECURITY.md. */
export function securityContactFrom(policy: string): string {
  const match = /\*\*Email:\*\*\s*([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/.exec(policy);
  if (!match?.[1]) throw new Error('SECURITY.md names no **Email:** reporting address');
  return match[1];
}

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** RFC 9116 security.txt; `Expires` is one year after the build. */
export function securityTxt(
  facts: Pick<DiscoveryFacts, 'origin' | 'securityContact' | 'now'>
): string {
  const expires = new Date(facts.now.getTime() + YEAR_MS);
  expires.setUTCMilliseconds(0);
  return [
    '# texuli.com security contact (RFC 9116). Generated at build time.',
    `Contact: mailto:${facts.securityContact}`,
    `Expires: ${expires.toISOString().replace('.000Z', 'Z')}`,
    `Canonical: ${absolute(facts.origin, DISCOVERY_PATHS.securityTxt)}`,
    `Policy: ${SECURITY_POLICY_URL}`,
    'Preferred-Languages: en',
    '',
  ].join('\n');
}

/**
 * The A2A agent card. Texuli has no A2A agent: the card is a discovery
 * pointer to the MCP server, and the interface says so (`protocolBinding:
 * "MCP"`, not an A2A binding). Skills are the operations the remote MCP
 * serves; capabilities are A2A's flat flags, all off.
 */
export function agentCard(
  facts: Pick<DiscoveryFacts, 'origin' | 'toolsVersion' | 'operations'>
): unknown {
  const endpoint = absolute(facts.origin, DISCOVERY_PATHS.mcp);
  return {
    _comment: `Texuli runs no A2A agent and no conversation endpoint. This card points agents at the one agent-facing service, the read-only MCP server at ${endpoint} (protocol binding MCP, JSON-RPC over stateless Streamable HTTP). ${ANONYMOUS_COMMENT}`,
    name: 'Texuli',
    description:
      'Read-only MCP server for Texuli, the open-source Svelte 5 component library by Dailybot, Inc.: search and read the component catalog, examples and themes, and validate blueprints.',
    url: endpoint,
    version: facts.toolsVersion,
    supportedInterfaces: [{ url: endpoint, protocolBinding: 'MCP' }],
    provider: { organization: 'Dailybot, Inc.', url: 'https://www.dailybot.com/' },
    documentationUrl: absolute(facts.origin, DISCOVERY_PATHS.authMd),
    iconUrl: absolute(facts.origin, '/brand/texuli-logo-light.png'),
    capabilities: { streaming: false, pushNotifications: false, extendedAgentCard: false },
    securitySchemes: {},
    defaultInputModes: ['application/json'],
    defaultOutputModes: ['application/json'],
    skills: facts.operations.map((operation) => ({
      id: operation.name,
      name: operation.title,
      description: operation.summary,
      tags: [operation.name.split('.')[0] ?? operation.name, 'read-only'],
    })),
  };
}

/**
 * Personal Agent Protocol (draft 0.1) website-only discovery: the
 * organization and its domain, and an empty `web` block. No sessions,
 * sign-in, agent protocols or APIs are declared, because none exist.
 */
export function poppyManifest(facts: Pick<DiscoveryFacts, 'origin'>): unknown {
  return {
    _comment:
      'Website-only discovery: texuli.com offers no personal-agent sessions, sign-in or APIs under this protocol. Texuli is an open-source project by Dailybot, Inc.',
    protocol_version: '0.1',
    organization: { name: 'Texuli', domain: new URL(facts.origin).hostname },
    web: {},
  };
}

/** One ARD catalog entry (Agentic Resource Discovery). */
export interface AiCatalogEntry {
  identifier: string;
  displayName: string;
  type: string;
  url: string;
  description: string;
  tags: string[];
  capabilities?: string[];
  representativeQueries: string[];
}

const NPM = 'https://www.npmjs.com/package/';
const NPM_TYPE = 'application/vnd.npm.package+json';

/**
 * The ARD catalog (`/.well-known/ai-catalog.json`, `Agentmap` in robots):
 * the content, data, server, API and skill resources of texuli.com, plus the
 * npm packages an agent runs. URLs on texuli.com must be built paths (the
 * AEO audit resolves them); copy describes only what exists.
 */
export function aiCatalog(facts: Pick<DiscoveryFacts, 'origin' | 'openapi'>): unknown {
  const at = (path: string) => absolute(facts.origin, path);
  const host = new URL(facts.origin).hostname;
  const urn = (kind: string, name: string) => `urn:air:${host}:${kind}:${name}`;
  const status =
    API_RELEASE_STATUS.state === 'released' ? '' : ' (in development, first published in 0.9.0)';
  const entries: AiCatalogEntry[] = [
    {
      identifier: urn('content', 'llms-txt'),
      displayName: 'Texuli Site Guide for LLMs',
      type: 'text/plain',
      url: at(DISCOVERY_PATHS.llms),
      description:
        'Curated map of texuli.com for language models: getting started, guides, component families, primitives, themes and the agent surfaces, as Markdown links.',
      tags: ['llms-txt', 'content', 'navigation'],
      representativeQueries: [
        'what is Texuli and what can I build with it',
        'give me a map of the Texuli component families',
        'how do Texuli web components relate to the Kotlin renderer',
      ],
    },
    {
      identifier: urn('content', 'llms-full-txt'),
      displayName: 'Texuli Full Content Corpus for LLMs',
      type: 'text/plain',
      url: at(DISCOVERY_PATHS.llmsFull),
      description:
        "Expanded llms.txt corpus (also at /llms/llms-full.txt, the same bytes) with the catalog's component documentation for retrieval and grounding. Every page also has a Markdown twin at the same path plus .md (guides/theming.md beside guides/theming/).",
      tags: ['llms-txt', 'content', 'corpus', 'markdown'],
      representativeQueries: [
        'read the full Texuli component documentation for grounding',
        'fetch the Markdown twin of the Button component page',
      ],
    },
    {
      identifier: urn('content', 'component-docs'),
      displayName: 'Texuli Component Docs Bundle',
      type: 'text/plain',
      url: at(DISCOVERY_PATHS.componentDocs),
      description:
        'The llms bundle index over one pre-rendered Markdown document per catalog component, each also served standalone at /llms/components/<id>.md.',
      tags: ['llms-txt', 'components', 'catalog'],
      representativeQueries: [
        'list every Texuli component with its llms doc',
        'open the llms doc for the dialog component',
      ],
    },
    {
      identifier: urn('data', 'catalog'),
      displayName: 'Texuli Catalog Manifest Snapshot',
      type: JSON_TYPE,
      url: at(DISCOVERY_PATHS.catalog),
      description:
        'The agent catalog snapshot: every component manifest with props, variants, examples, a11y notes and keyboard interactions, the data the sink-free renderer consumes. Also served as /api/v1/catalog.json. A README beside it names the content hash.',
      tags: ['catalog', 'json', 'components', 'a2ui'],
      capabilities: [
        'component manifests with prop schemas',
        'examples as renderable props',
        'a11y and keyboard documentation per component',
      ],
      representativeQueries: [
        'fetch the Texuli catalog snapshot as JSON',
        'what props does the Texuli button component accept',
        'which Texuli components are agent-emittable',
      ],
    },
    {
      identifier: urn('server', 'mcp'),
      displayName: 'Texuli MCP Server',
      type: JSON_TYPE,
      url: at(DISCOVERY_PATHS.mcp),
      description: `Read-only MCP server over stateless Streamable HTTP at ${at(DISCOVERY_PATHS.mcp)} (alias /.well-known/mcp): search and read the component catalog, examples and themes, and validate blueprints. POST JSON-RPC, anonymous, rate limited; the server card is /.well-known/mcp/server-card.json and access is described in /auth.md.`,
      tags: ['mcp', 'catalog', 'themes', 'read-only'],
      representativeQueries: [
        'search the Texuli component catalog for a date picker',
        'validate this Texuli blueprint draft',
        'list Texuli themes with a dark mode',
      ],
    },
    ...(facts.openapi
      ? [
          {
            identifier: urn('api', 'openapi'),
            displayName: 'Texuli Public API (OpenAPI 3.1)',
            type: 'application/vnd.oai.openapi+json',
            url: at(DISCOVERY_PATHS.openapi),
            description:
              'OpenAPI 3.1 description of the read-only JSON API (the catalog, themes, the Markdown twins manifest, health, every /api/v1/ path) and POST /mcp, with an operationId and a typed schema on every operation. Anonymous; X-API-Version and RateLimit headers; RFC 9457 errors.',
            tags: ['openapi', 'api', 'json', 'read-only'],
            representativeQueries: [
              'get the OpenAPI description of texuli.com',
              'which JSON endpoints does texuli.com serve',
            ],
          },
        ]
      : []),
    {
      identifier: urn('api', 'catalog'),
      displayName: 'Texuli API Catalog',
      type: 'application/linkset+json',
      url: at(DISCOVERY_PATHS.apiCatalog),
      description:
        'RFC 9727 API catalog linkset pointing at the OpenAPI description, the developer portal, the health file, the service documentation (llms.txt), the catalog snapshot, the component docs bundle and the skill.',
      tags: ['api-catalog', 'rfc9727', 'linkset'],
      representativeQueries: [
        'where is the API catalog for texuli.com',
        'find the service documentation for Texuli',
      ],
    },
    {
      identifier: urn('skills', 'agent-readiness'),
      displayName: 'Texuli Agent Skills Index',
      type: 'application/agent-skills+json',
      url: at(DISCOVERY_PATHS.agentSkills),
      description:
        'Agent Skills Discovery index listing every SKILL.md in the Texuli skill pack (the router and each sub-skill), served with the pack itself under /skill-pack/ and pinned by SHA-256 digest.',
      tags: ['agent-skills', 'discovery', 'well-known'],
      representativeQueries: [
        'which agent skills does texuli.com publish',
        'show the agent skills discovery index for Texuli',
      ],
    },
    {
      identifier: urn('skills', 'pack'),
      displayName: 'The Texuli Skill Pack',
      type: 'text/markdown',
      url: at('/skill-pack/SKILL.md'),
      description:
        'The distributable Texuli skill, served raw: a router that teaches coding agents to build with Texuli (components, themes, media, blueprints, contribution). Offline and install-free to read; the /skill/ page documents per-host installation and checksums.',
      tags: ['skill', 'agents', 'documentation'],
      representativeQueries: [
        'read the Texuli skill router for coding agents',
        'how do I install the Texuli skill in my coding agent',
      ],
    },
    {
      identifier: urn('package', 'npm'),
      displayName: 'Texuli on npm',
      type: NPM_TYPE,
      url: `${NPM}texuli`,
      description:
        'The Texuli package on npm (the 0.12 line, a pre-1.0 release): styled components built on owned primitives, tokens and the agent catalog. Scoped @texuli/* packages ship alongside it.',
      tags: ['npm', 'svelte', 'components', 'pre-1.0'],
      representativeQueries: ['install Texuli from npm', 'which @texuli packages exist on npm'],
    },
    {
      identifier: urn('package', 'mcp'),
      displayName: 'Texuli MCP server on npm (@texuli/mcp)',
      type: NPM_TYPE,
      url: `${NPM}@texuli/mcp`,
      description: `The local Texuli MCP server over stdio${status}: every MCP host runs \`npx -y @texuli/mcp\`. The same operations as the remote server, plus the ones that need Node (PDF and DOCX export).`,
      tags: ['npm', 'mcp', 'stdio', 'cli'],
      representativeQueries: [
        'add the Texuli MCP server to my coding agent',
        'run the Texuli MCP server locally',
      ],
    },
    {
      identifier: urn('package', 'tools'),
      displayName: 'Texuli CLI and tools on npm (@texuli/tools)',
      type: NPM_TYPE,
      url: `${NPM}@texuli/tools`,
      description:
        'The Texuli developer tools: the `texuli` CLI (`texuli <group> <verb>` for every operation since 0.9.0, `texuli ds` for design systems since 0.10.0; deck and document commands since the 0.8 line), init, theme, add and update commands, and the llms generator. Run without installing with `npx -p @texuli/tools texuli help`.',
      tags: ['npm', 'cli', 'tools'],
      representativeQueries: [
        'search the Texuli catalog from the command line',
        'validate a Texuli blueprint with a CLI',
      ],
    },
  ];
  return {
    specVersion: '1.0',
    host: {
      displayName: 'Texuli',
      identifier: `did:web:${host}`,
      documentationUrl: at('/guides/'),
      logoUrl: at('/brand/texuli-logo-light.png'),
    },
    entries,
  };
}

/** The served shape of every generated file: path, content type and CORS. */
export const DISCOVERY_FILE_TYPES: readonly Omit<DiscoveryFile, 'body'>[] = Object.freeze([
  { path: DISCOVERY_PATHS.apiCatalog, contentType: 'application/linkset+json', cors: true },
  { path: DISCOVERY_PATHS.aiCatalog, contentType: JSON_TYPE, cors: true },
  { path: DISCOVERY_PATHS.oauthAuthorizationServer, contentType: JSON_TYPE, cors: true },
  { path: DISCOVERY_PATHS.oauthProtectedResource, contentType: JSON_TYPE, cors: true },
  { path: DISCOVERY_PATHS.jwks, contentType: JSON_TYPE, cors: true },
  { path: DISCOVERY_PATHS.agentCard, contentType: JSON_TYPE, cors: true },
  { path: DISCOVERY_PATHS.poppy, contentType: JSON_TYPE, cors: true },
  { path: DISCOVERY_PATHS.authMd, contentType: 'text/markdown; charset=utf-8', cors: false },
  { path: DISCOVERY_PATHS.securityTxt, contentType: 'text/plain; charset=utf-8', cors: false },
]);

/** Every file the build writes, with its content type and CORS. */
export function discoveryFiles(facts: DiscoveryFacts): DiscoveryFile[] {
  const bodies: Record<string, string> = {
    [DISCOVERY_PATHS.apiCatalog]: json(apiCatalog(facts)),
    [DISCOVERY_PATHS.aiCatalog]: json(aiCatalog(facts)),
    [DISCOVERY_PATHS.oauthAuthorizationServer]: json(oauthAuthorizationServer(facts)),
    [DISCOVERY_PATHS.oauthProtectedResource]: json(oauthProtectedResource(facts)),
    [DISCOVERY_PATHS.jwks]: json(jwks()),
    [DISCOVERY_PATHS.agentCard]: json(agentCard(facts)),
    [DISCOVERY_PATHS.poppy]: json(poppyManifest(facts)),
    [DISCOVERY_PATHS.authMd]: authMd(facts),
    [DISCOVERY_PATHS.securityTxt]: securityTxt(facts),
  };
  return DISCOVERY_FILE_TYPES.map((type) => {
    const body = bodies[type.path];
    if (body === undefined) throw new Error(`no generator for ${type.path}`);
    return { ...type, body };
  });
}

/**
 * The `_headers` rules for the discovery files: the generated ones and the
 * root llms-full.txt copy. Cloudflare Pages applies these only to static
 * asset responses.
 */
export function discoveryHeaderRules(
  files: readonly Omit<DiscoveryFile, 'body'>[] = DISCOVERY_FILE_TYPES
): string[] {
  const all = [
    ...files,
    { path: DISCOVERY_PATHS.llmsFull, contentType: 'text/plain; charset=utf-8', cors: false },
  ];
  return all.map(
    (file) =>
      `${file.path}\n  Content-Type: ${file.contentType}${file.cors ? '\n  Access-Control-Allow-Origin: *' : ''}\n  X-Content-Type-Options: nosniff\n  Cache-Control: public, max-age=300, must-revalidate`
  );
}
