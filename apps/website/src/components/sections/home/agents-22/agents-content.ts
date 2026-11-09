/**
 * Home 2.2 "Built for humans and agents" band (storyboard band 5): people direct and
 * review, agents emit validated data. Four surfaces, each one real in this repository:
 *
 * - the agent catalog: `@texuli/catalog` (published; not in the in-development list);
 * - the MCP server: local `npx -y @texuli/mcp` (`@texuli/mcp` is in development) and the
 *   remote `https://texuli.com/mcp`, deployed with the site (read-only, anonymous);
 * - the agent skill: `skills/texuli`, released on its own version line;
 * - validation: `@texuli/catalog/validate` and the `blueprint.validate` MCP operation.
 *
 * Facts: `audit/facts.md` (F-07 in-development packages, F-11 hosting, F-14 catalog,
 * F-19 to F-21 MCP), `packages/catalog/README.md`, `apps/website/public/.well-known/mcp/server-card.json`.
 * No counts are typed: they live in the generated server card and catalog.
 */
import type { SolutionStatus } from '../../../../data/solutions/schema.ts';
import { siteRouteExists } from '../../../foundation/nav-data.ts';

export type RouteExists = (route: string) => boolean;

export const AGENTS_22_COPY = {
  id: 'home-agents-22-title',
  kicker: 'Humans and agents',
  title: 'Built for humans and agents.',
  body: 'People direct, review and edit. Agents describe interfaces as data against a closed catalog, and Texuli validates them before anything renders, with no HTML sinks.',
  art: 'home-agents',
} as const;

export interface AgentSurface {
  readonly id: 'catalog' | 'mcp' | 'skill' | 'validation';
  readonly title: string;
  readonly body: string;
  /** Each entry is something an agent or a host can call or install, with its status. */
  readonly items: readonly Readonly<{ label: string; status: SolutionStatus }>[];
  readonly link: Readonly<{ label: string; href: string }>;
}

export const AGENT_SURFACES: readonly AgentSurface[] = [
  {
    id: 'catalog',
    title: 'The agent catalog',
    body: 'A closed vocabulary of components agents may emit, each with typed props, rendered without HTML sinks.',
    items: [{ label: '@texuli/catalog', status: 'available' }],
    link: { label: 'For agents', href: '/agents-page/' },
  },
  {
    id: 'mcp',
    title: 'The MCP server',
    body: 'Search the catalog, themes and examples, and validate blueprints, from any MCP client.',
    items: [
      { label: 'https://texuli.com/mcp', status: 'available' },
      { label: 'npx -y @texuli/mcp', status: 'in development' },
    ],
    link: { label: 'MCP server', href: '/mcp-server/' },
  },
  {
    id: 'skill',
    title: 'The agent skill',
    body: 'One installable skill that teaches coding agents to build with Texuli.',
    items: [{ label: 'skills/texuli', status: 'available' }],
    link: { label: 'Agent skill', href: '/skill/' },
  },
  {
    id: 'validation',
    title: 'Validation first',
    body: 'Agent output is checked against the catalog before it paints; unsafe keys and unknown components are refused.',
    items: [
      { label: '@texuli/catalog/validate', status: 'available' },
      { label: 'blueprint.validate', status: 'available' },
    ],
    link: { label: 'Try it in the playground', href: '/playground/' },
  },
];

/** The surfaces whose link targets exist; a surface without a page keeps no link. */
export function agentSurfaces(
  exists: RouteExists = siteRouteExists
): Array<Omit<AgentSurface, 'link'> & { link: AgentSurface['link'] | undefined }> {
  return AGENT_SURFACES.map((surface) => ({
    ...surface,
    link: exists(surface.link.href) ? surface.link : undefined,
  }));
}
